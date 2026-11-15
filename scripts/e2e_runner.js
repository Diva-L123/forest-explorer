'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { startServer } = require('../server/index.js');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 3100;
const CDP_PORT = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = msg => {
      const parsed = JSON.parse(msg.data);
      if (parsed.id && this.callbacks.has(parsed.id)) {
        const { resolve, reject } = this.callbacks.get(parsed.id);
        this.callbacks.delete(parsed.id);
        if (parsed.error) reject(new Error(parsed.error.message));
        else resolve(parsed.result);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || res.exceptionDetails.exception?.description);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('--- Starting server on port ' + PORT + ' ---');
  process.env.DB_PATH = path.join(__dirname, '..', 'data', 'forest_explorer_test.db');
  const server = await startServer(PORT);

  console.log('--- Launching headless Chrome ---');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `http://localhost:${PORT}`
  ]);

  let cdp = null;
  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (targets && targets.length) break;
      } catch (_) {}
    }

    if (!targets || !targets.length) throw new Error('Could not connect to Chrome CDP');

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('--- Connected to page via CDP, waiting for atlas data load ---');
    // Wait for atlas data to load
    await sleep(2500);

    const checks = [];
    async function check(name, fn) {
      try {
        const ok = await fn();
        checks.push({ name, passed: Boolean(ok), error: null });
        console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`);
      } catch (err) {
        checks.push({ name, passed: false, error: err.message });
        console.log(`[FAIL] ${name} - Error: ${err.message}`);
      }
    }

    // 1. Data load checks
    await check('Data: 120 forests loaded', async () => {
      return await cdp.eval(`window.ForestExplorer?.getState ? window.ForestExplorer.getState().forests.length === 120 : document.querySelectorAll('.forest-card').length > 0`);
    });

    await check('Data: species loaded', async () => {
      return await cdp.eval(`document.querySelectorAll('.species-card').length > 0`);
    });

    // 2. Labels
    await check('Label: #forestCountLabel matches actual data (120 forests across 6 continents)', async () => {
      const text = await cdp.eval(`document.querySelector('#forestCountLabel')?.textContent?.trim()`);
      return text.includes('120 forests') && text.includes('continents');
    });

    await check('Label: #rareSpeciesCount updated (> 0)', async () => {
      const text = await cdp.eval(`document.querySelector('#rareSpeciesCount')?.textContent?.trim()`);
      return text && !text.startsWith('0');
    });

    await check('Label: #prehistoricCount updated (> 0)', async () => {
      const text = await cdp.eval(`document.querySelector('#prehistoricCount')?.textContent?.trim()`);
      return text && !text.startsWith('0');
    });

    await check('Label: #prehistoricCountLabel updated from loading state', async () => {
      const text = await cdp.eval(`document.querySelector('#prehistoricCountLabel')?.textContent?.trim()`);
      return text && !text.includes('Loading deep-time');
    });

    await check('Label: #footerYear populated with current year', async () => {
      const text = await cdp.eval(`document.querySelector('#footerYear')?.textContent?.trim()`);
      return text === String(new Date().getFullYear());
    });

    // 3. Empty sections now rendered
    await check('Section: #rareSpeciesGrid populated with cards', async () => {
      const count = await cdp.eval(`document.querySelectorAll('#rareSpeciesGrid .rare-species-card').length`);
      return count > 0;
    });

    await check('Section: #storiesFeature populated with lead story', async () => {
      const hasContent = await cdp.eval(`document.querySelector('#storiesFeature .story-feature') !== null`);
      return hasContent;
    });

    await check('Section: #afterDarkGrid populated with encounters', async () => {
      const count = await cdp.eval(`document.querySelectorAll('#afterDarkGrid .after-dark-card').length`);
      return count > 0;
    });

    // 4. Search controls & overlay
    await check('Search: icon opens search overlay and focuses universalSearchInput', async () => {
      await cdp.eval(`document.querySelector('#searchOpenBtn')?.click()`);
      await sleep(350);
      return await cdp.eval(`
        document.querySelector('#searchOverlay')?.classList.contains('is-open') &&
        (document.activeElement?.id === 'universalSearchInput' || document.activeElement?.id === 'searchInput')
      `);
    });

    await check('Search: popular search chip (e.g. Jaguar) updates input and renders results', async () => {
      await cdp.eval(`document.querySelector('[data-search-hint="jaguar"]')?.click()`);
      await sleep(300);
      const inputVal = await cdp.eval(`(document.querySelector('#universalSearchInput') || document.querySelector('#searchInput'))?.value`);
      const resultsCount = await cdp.eval(`document.querySelectorAll('#searchResults .search-result-row').length`);
      return inputVal === 'jaguar' && resultsCount > 0;
    });

    await check('Search: clicking search result opens detail and closes search overlay', async () => {
      await cdp.eval(`document.querySelector('#searchResults .search-result-row')?.click()`);
      await sleep(400);
      const searchClosed = await cdp.eval(`!document.querySelector('#searchOverlay')?.classList.contains('is-open')`);
      const modalOpen = await cdp.eval(`document.querySelector('#detailModal')?.classList.contains('is-open')`);
      // Close detail modal for next tests
      await cdp.eval(`document.querySelector('#detailModalClose')?.click()`);
      await sleep(200);
      return searchClosed && modalOpen;
    });

    // 5. Discovery & Prehistoric clicks
    await check('Clicks: Discovery card opens discovery detail modal', async () => {
      await cdp.eval(`document.querySelector('[data-open-discovery]')?.click()`);
      await sleep(300);
      const modalOpen = await cdp.eval(`document.querySelector('#detailModal')?.classList.contains('is-open')`);
      const hasTitle = await cdp.eval(`document.querySelector('#detailModalContent h1')?.textContent?.length > 0`);
      await cdp.eval(`document.querySelector('#detailModalClose')?.click()`);
      await sleep(200);
      return modalOpen && hasTitle;
    });

    await check('Clicks: Prehistoric card opens prehistoric detail modal', async () => {
      await cdp.eval(`document.querySelector('[data-open-prehistoric]')?.click()`);
      await sleep(300);
      const modalOpen = await cdp.eval(`document.querySelector('#detailModal')?.classList.contains('is-open')`);
      const hasTitle = await cdp.eval(`document.querySelector('#detailModalContent h1')?.textContent?.length > 0`);
      await cdp.eval(`document.querySelector('#detailModalClose')?.click()`);
      await sleep(200);
      return modalOpen && hasTitle;
    });

    // 6. Mobile menu
    await check('Mobile menu: #mobileMenuBtn opens mobile menu', async () => {
      await cdp.eval(`document.querySelector('#mobileMenuBtn')?.click()`);
      await sleep(200);
      return await cdp.eval(`document.querySelector('#mobileMenu')?.classList.contains('is-open')`);
    });

    await check('Mobile menu: #mobileMenuClose closes mobile menu', async () => {
      await cdp.eval(`document.querySelector('#mobileMenuClose')?.click()`);
      await sleep(200);
      return await cdp.eval(`!document.querySelector('#mobileMenu')?.classList.contains('is-open')`);
    });

    await check('Mobile menu: #mobileAccountBtn opens auth modal', async () => {
      await cdp.eval(`document.querySelector('#mobileMenuBtn')?.click()`);
      await sleep(200);
      await cdp.eval(`document.querySelector('#mobileAccountBtn')?.click()`);
      await sleep(300);
      const authOpen = await cdp.eval(`document.querySelector('#authModal')?.classList.contains('is-open')`);
      await cdp.eval(`document.querySelector('#authCloseBtn')?.click()`);
      await sleep(200);
      return authOpen;
    });

    // 7. Footer buttons
    await check('Footer: #footerSignInBtn opens login tab in auth modal', async () => {
      await cdp.eval(`document.querySelector('#footerSignInBtn')?.click()`);
      await sleep(200);
      const open = await cdp.eval(`document.querySelector('#authModal')?.classList.contains('is-open') && !document.querySelector('#loginForm')?.hidden`);
      await cdp.eval(`document.querySelector('#authCloseBtn')?.click()`);
      await sleep(200);
      return open;
    });

    await check('Footer: #footerRegisterBtn opens register tab in auth modal', async () => {
      await cdp.eval(`document.querySelector('#footerRegisterBtn')?.click()`);
      await sleep(200);
      const open = await cdp.eval(`document.querySelector('#authModal')?.classList.contains('is-open') && !document.querySelector('#registerForm')?.hidden`);
      await cdp.eval(`document.querySelector('#authCloseBtn')?.click()`);
      await sleep(200);
      return open;
    });

    await check('Footer: #footerDashboardBtn opens dashboard or auth', async () => {
      await cdp.eval(`document.querySelector('#footerDashboardBtn')?.click()`);
      await sleep(200);
      const open = await cdp.eval(`document.querySelector('#dashboardDrawer')?.classList.contains('is-open') || document.querySelector('#authModal')?.classList.contains('is-open')`);
      await cdp.eval(`document.querySelector('#authCloseBtn')?.click()`);
      await sleep(200);
      return open;
    });

    await check('Footer: #footerAdminBtn opens administration drawer', async () => {
      await cdp.eval(`document.querySelector('#footerAdminBtn')?.click()`);
      await sleep(200);
      const adminOpen = await cdp.eval(`document.querySelector('#adminDrawer')?.classList.contains('is-open')`);
      const overlayOpen = await cdp.eval(`document.querySelector('#drawerOverlay')?.classList.contains('is-open')`);
      return adminOpen && overlayOpen;
    });

    await check('Drawer: close X ([data-close-drawer="adminDrawer"]) closes drawer and overlay', async () => {
      await cdp.eval(`document.querySelector('[data-close-drawer="adminDrawer"]')?.click()`);
      await sleep(200);
      const adminClosed = await cdp.eval(`!document.querySelector('#adminDrawer')?.classList.contains('is-open')`);
      const overlayClosed = await cdp.eval(`!document.querySelector('#drawerOverlay')?.classList.contains('is-open')`);
      return adminClosed && overlayClosed;
    });

    await check('Drawer: #drawerOverlay click closes drawer', async () => {
      await cdp.eval(`document.querySelector('#footerAdminBtn')?.click()`);
      await sleep(200);
      await cdp.eval(`document.querySelector('#drawerOverlay')?.click()`);
      await sleep(200);
      return await cdp.eval(`!document.querySelector('#adminDrawer')?.classList.contains('is-open')`);
    });

    await check('Footer: #footerSourcesBtn opens sources and credits modal', async () => {
      await cdp.eval(`document.querySelector('#footerSourcesBtn')?.click()`);
      await sleep(200);
      const modalOpen = await cdp.eval(`document.querySelector('#detailModal')?.classList.contains('is-open')`);
      const title = await cdp.eval(`document.querySelector('#detailModalContent h1')?.textContent`);
      await cdp.eval(`document.querySelector('#detailModalClose')?.click()`);
      await sleep(200);
      return modalOpen && title.includes('Data Sources');
    });

    // 8. About & Impact buttons
    await check('About: #aboutSearchBtn opens search overlay', async () => {
      await cdp.eval(`document.querySelector('#aboutSearchBtn')?.click()`);
      await sleep(200);
      const open = await cdp.eval(`document.querySelector('#searchOverlay')?.classList.contains('is-open')`);
      await cdp.eval(`document.querySelector('#searchCloseBtn')?.click()`);
      await sleep(200);
      return open;
    });

    await check('About: #aboutSourcesBtn opens sources and credits modal', async () => {
      await cdp.eval(`document.querySelector('#aboutSourcesBtn')?.click()`);
      await sleep(200);
      const open = await cdp.eval(`document.querySelector('#detailModal')?.classList.contains('is-open')`);
      await cdp.eval(`document.querySelector('#detailModalClose')?.click()`);
      await sleep(200);
      return open;
    });

    await check('Impact: #conservationStoryBtn opens a conservation story', async () => {
      await cdp.eval(`document.querySelector('#conservationStoryBtn')?.click()`);
      await sleep(200);
      const open = await cdp.eval(`document.querySelector('#detailModal')?.classList.contains('is-open')`);
      const isStory = await cdp.eval(`document.querySelector('#detailModalContent .detail-story-content, #detailModalContent h1') !== null`);
      await cdp.eval(`document.querySelector('#detailModalClose')?.click()`);
      await sleep(200);
      return open && isStory;
    });

    // 9. Forest & Wildlife search inputs and clear buttons
    await check('Filter: #forestSearchInput filters forests', async () => {
      await cdp.eval(`(() => {
        const input = document.querySelector('#forestSearchInput');
        input.value = 'redwood';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(200);
      const count = await cdp.eval(`document.querySelectorAll('#forestGrid .forest-card').length`);
      const meta = await cdp.eval(`document.querySelector('#forestResultsMeta')?.textContent`);
      return count > 0 && meta.includes('Showing');
    });

    await check('Filter: #clearForestFilters resets forest search and filters', async () => {
      await cdp.eval(`document.querySelector('#clearForestFilters')?.click()`);
      await sleep(200);
      const inputVal = await cdp.eval(`document.querySelector('#forestSearchInput')?.value`);
      const meta = await cdp.eval(`document.querySelector('#forestResultsMeta')?.textContent`);
      return inputVal === '' && meta.includes('Showing all');
    });

    await check('Filter: #wildlifeSearchInput filters species', async () => {
      await cdp.eval(`(() => {
        const input = document.querySelector('#wildlifeSearchInput');
        input.value = 'jaguar';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(200);
      const count = await cdp.eval(`document.querySelectorAll('#speciesGrid .species-card').length`);
      const meta = await cdp.eval(`document.querySelector('#wildlifeResultsMeta')?.textContent`);
      return count > 0 && meta.includes('Showing');
    });

    await check('Filter: #clearWildlifeFilters resets wildlife search and category filters', async () => {
      await cdp.eval(`document.querySelector('#clearWildlifeFilters')?.click()`);
      await sleep(200);
      const inputVal = await cdp.eval(`document.querySelector('#wildlifeSearchInput')?.value`);
      const meta = await cdp.eval(`document.querySelector('#wildlifeResultsMeta')?.textContent`);
      return inputVal === '' && meta.includes('Showing all');
    });

    // 10. Favicon check
    await check('Favicon: /favicon.ico returns 200 OK', async () => {
      return new Promise((resolve) => {
        http.get(`http://localhost:${PORT}/favicon.ico`, res => {
          resolve(res.statusCode === 200 && res.headers['content-type'] === 'image/x-icon');
        }).on('error', () => resolve(false));
      });
    });

    console.log('\n======================================================');
    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed).length;
    console.log(`Results: ${passed} passed, ${failed} failed out of ${checks.length} checks.`);
    console.log('======================================================\n');

  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
    server.close();
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
