'use strict';

const FRAME_COUNT = 192;
const FRAME_PATH = './frames_webp/frame_';

const STORAGE = {
  accounts: 'fe.accounts.v1',
  session: 'fe.session.v1',
  userData: 'fe.userdata.v1.',
  schema: 'fe.schema.v1'
};

const SAVE_KEYS = {
  forest: 'savedForests',
  species: 'savedSpecies',
  story: 'savedStories',
  discovery: 'savedDiscoveries'
};

const OPEN_ATTRS = {
  forest: 'data-open-forest',
  species: 'data-open-species',
  story: 'data-open-story',
  discovery: 'data-open-discovery',
  prehistoric: 'data-open-prehistoric'
};

const PAGE_SIZE = {
  forests: 6,
  wildlife: 8,
  rare: 8,
  stories: 4,
  prehistoric: 6
};

const MOBILE_PAGE_SIZE = {
  forests: 4,
  wildlife: 6,
  rare: 6,
  stories: 3,
  prehistoric: 4
};

function pageSizeFor(type) {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  return (mobile ? MOBILE_PAGE_SIZE[type] : PAGE_SIZE[type]) || 8;
}

const state = {
  forests: [],
  species: [],
  stories: [],
  discoveries: [],
  prehistoric: [],
  forestFilters: { q: '', continent: 'all', type: 'all', sort: 'featured' },
  wildlifeFilters: { q: '', category: 'All', status: 'all' },
  pagers: { forests: 1, wildlife: 1, rare: 1, stories: 1, prehistoric: 1 },
  prehistoricMedia: {},
  mediaRequests: {},
  galleryToken: 0,
  mapContinent: 'all',
  map: null,
  markerLayer: null,
  markers: new Map(),
  activeMapForest: null,
  session: null,
  pendingSave: null,
  searchTimer: null,
  audio: {
    context: null,
    source: null,
    gain: null,
    birdTimer: null,
    playing: false
  },
  hero: {
    ctx: null,
    images: [],
    frame: 1,
    direction: 1,
    timer: null,
    visible: true,
    reducedMotion: false
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindInterfaceEvents();
  initPageSystem();
  initNavigation();
  let mobileLayout = window.matchMedia('(max-width: 760px)').matches;
  window.addEventListener('resize', debounce(() => {
    const nextMobile = window.matchMedia('(max-width: 760px)').matches;
    if (nextMobile === mobileLayout) return;
    mobileLayout = nextMobile;
    renderForests();
    renderWildlife();
    renderRareAndDiscoveries();
    renderStories();
    renderPrehistoric();
  }, 220));
  initHeroSequence();
  initAmbientAudio();
  renderFooterYear();

  try {
    await initAuth();
  } catch (error) {
    console.warn('Local account system unavailable.', error);
  }

  try {
    await loadAtlasData();
    renderAtlas();
  } catch (error) {
    console.error('Atlas data failed to load.', error);
    showToast('The atlas data could not be loaded. Run the site through node server.js rather than opening index.html directly.', 'error', 6500);
    renderLoadFailure();
  }

  syncBodyLock();
}

async function loadAtlasData() {
  const files = [
    ['forests', './data/forests.json'],
    ['species', './data/species.json'],
    ['stories', './data/stories.json'],
    ['discoveries', './data/discoveries.json'],
    ['prehistoric', './data/prehistoric.json']
  ];

  const results = await Promise.all(files.map(async ([key, url]) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load ' + url + ' (' + response.status + ')');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Expected an array in ' + url);
    return [key, data];
  }));

  results.forEach(([key, data]) => {
    state[key] = data;
  });
}

function renderAtlas() {
  updateHeroStats();
  renderFeaturedForests();
  populateForestFilters();
  renderForests();
  initForestMap();
  renderWildlifeCategories();
  renderWildlife();
  renderRareAndDiscoveries();
  renderStories();
  renderPrehistoric();
  if (window.ForestPages?.current() === 'deeptime') hydrateDeepTimeImages();
  applySavedStates();
  if (state.session) renderAccount();
}

function renderLoadFailure() {
  const forestGrid = $('#forestGrid');
  const speciesGrid = $('#speciesGrid');
  const storiesGrid = $('#storiesGrid');

  if (forestGrid) {
    forestGrid.innerHTML = '<div class="empty-state"><h3>The forest archive is unavailable.</h3><p>Start the local server with <strong>node server.js</strong>, then reload this page.</p></div>';
  }
  if (speciesGrid) {
    speciesGrid.innerHTML = '<div class="empty-state"><h3>Wildlife records could not be loaded.</h3><p>Check that the data folder is beside index.html.</p></div>';
  }
  if (storiesGrid) {
    storiesGrid.innerHTML = '';
  }
  const featured = $('#featuredForests');
  if (featured) featured.innerHTML = '';
}

function updateHeroStats() {
  const continents = new Set(state.forests.map(forest => forest.continent).filter(Boolean));
  const statForests = $('#statForests');
  const statSpecies = $('#statSpecies');
  const statContinents = $('#statContinents');

  if (statForests) statForests.textContent = String(state.forests.length);
  if (statSpecies) statSpecies.textContent = String(state.species.length);
  if (statContinents) statContinents.textContent = String(continents.size);

  const forestCount = $('#forestCountLabel');
  if (forestCount) forestCount.textContent = state.forests.length + ' forests across ' + continents.size + ' continents';

  const speciesCount = $('#speciesCountLabel');
  if (speciesCount) speciesCount.textContent = state.species.length + ' species in the field guide';
}

function initHeroSequence() {
  const canvas = $('#forestCanvas');
  if (!canvas) return;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  state.hero.ctx = context;
  state.hero.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.hero.images = Array.from({ length: FRAME_COUNT }, () => null);

  resizeHeroCanvas();
  loadHeroFrame(1, true);

  if (state.hero.reducedMotion) {
    window.addEventListener('resize', debounce(() => {
      resizeHeroCanvas();
      drawHeroFrame(1);
    }, 160));
    return;
  }

  preloadHeroFrames();

  const play = () => {
    stopHeroPlayback();
    state.hero.timer = window.setInterval(() => {
      if (!state.hero.visible || document.visibilityState !== 'visible') return;
      let next = state.hero.frame + state.hero.direction;
      if (next > FRAME_COUNT) {
        next = FRAME_COUNT - 1;
        state.hero.direction = -1;
      } else if (next < 1) {
        next = 2;
        state.hero.direction = 1;
      }
      state.hero.frame = next;
      drawHeroFrame(next);
    }, 110);
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      state.hero.visible = entry.isIntersecting;
    });
  }, { threshold: 0.02 });
  observer.observe($('#home') || canvas);

  window.addEventListener('resize', debounce(() => {
    resizeHeroCanvas();
    drawHeroFrame(state.hero.frame);
  }, 160));

  window.addEventListener('load', play, { once: true });
  window.setTimeout(play, 500);
}

function resizeHeroCanvas() {
  const canvas = $('#forestCanvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  drawHeroFrame(state.hero.frame);
}

function loadHeroFrame(index, drawWhenReady = false) {
  if (index < 1 || index > FRAME_COUNT || state.hero.images[index - 1]) {
    if (drawWhenReady) drawHeroFrame(index);
    return;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = FRAME_PATH + String(index).padStart(4, '0') + '.webp';
  image.addEventListener('load', () => {
    state.hero.images[index - 1] = image;
    if (drawWhenReady || index === state.hero.frame) drawHeroFrame(index);
  }, { once: true });
}

function preloadHeroFrames() {
  let next = 1;
  const concurrency = 7;

  const worker = () => {
    if (next > FRAME_COUNT) return;
    const index = next++;
    if (!state.hero.images[index - 1]) loadHeroFrame(index);
    window.setTimeout(worker, state.hero.visible ? 45 : 180);
  };

  for (let i = 0; i < concurrency; i += 1) {
    window.setTimeout(worker, i * 70);
  }
}

function drawHeroFrame(index) {
  const canvas = $('#forestCanvas');
  const ctx = state.hero.ctx;
  if (!canvas || !ctx) return;
  const image = state.hero.images[index - 1];

  if (!image) {
    if (index !== 1) {
      const fallback = state.hero.images[0];
      if (fallback) drawCoverImage(ctx, fallback, canvas);
    }
    return;
  }

  drawCoverImage(ctx, image, canvas);
}

function drawCoverImage(ctx, image, canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    drawWidth = height * imageRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawHeight = width / imageRatio;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.fillStyle = '#030805';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function stopHeroPlayback() {
  if (state.hero.timer) {
    window.clearInterval(state.hero.timer);
    state.hero.timer = null;
  }
}

const PAGE_LABELS = {
  home: 'Home',
  forests: 'Forests',
  map: 'Map',
  wildlife: 'Wildlife',
  rare: 'Discoveries',
  stories: 'Stories',
  deeptime: 'Deep Time',
  conservation: 'Impact',
  about: 'About'
};

function overlayIsOpen() {
  return Boolean(
    $('#mobileMenu')?.classList.contains('is-open') ||
    $('#searchOverlay')?.classList.contains('is-open') ||
    $('#detailModal')?.classList.contains('is-open') ||
    $('#authModal')?.classList.contains('is-open') ||
    $('#lightbox')?.classList.contains('is-open') ||
    $('.side-drawer.is-open')
  );
}

function initPageSystem() {
  const pages = $$('#main [data-page]');
  if (!pages.length) return;

  const dots = $('#pageDots');
  const position = $('#pagePosition');
  const prevBtn = $('#pagePrevBtn');
  const nextBtn = $('#pageNextBtn');
  const prevLabel = $('#pagePrevLabel');
  const nextLabel = $('#pageNextLabel');
  const header = $('#siteHeader');
  let pageIndex = 0;

  const labelFor = page => PAGE_LABELS[page.id] || capitalize(page.id.replace(/-/g, ' '));

  if (dots) {
    dots.innerHTML = pages.map((page, index) =>
      '<button class="page-dot" type="button" data-page-index="' + index + '" aria-label="Go to ' + esc(labelFor(page)) + '"><span></span></button>'
    ).join('');
  }

  const syncNav = id => {
    $$('[data-nav], [data-mobile-link]').forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
    });
  };

  const goToIndex = (index, options = {}) => {
    const next = Math.max(0, Math.min(pages.length - 1, index));
    if (next === pageIndex && options.force !== true) {
      if (!options.silent) return;
    }
    pageIndex = next;
    pages.forEach((page, i) => {
      const active = i === pageIndex;
      page.classList.toggle('is-active', active);
      page.setAttribute('aria-hidden', String(!active));
      if (active) page.scrollTop = 0;
    });

    const current = pages[pageIndex];
    const id = current.id;
    syncNav(id);
    if (header) header.classList.toggle('is-scrolled', id !== 'home');

    if (dots) {
      $$('.page-dot', dots).forEach((dot, i) => {
        dot.classList.toggle('is-active', i === pageIndex);
        dot.setAttribute('aria-current', i === pageIndex ? 'page' : 'false');
      });
    }

    if (position) position.textContent = String(pageIndex + 1).padStart(2, '0') + ' / ' + String(pages.length).padStart(2, '0');

    const prev = pages[pageIndex - 1];
    const nextPage = pages[pageIndex + 1];
    if (prevBtn) prevBtn.disabled = !prev;
    if (nextBtn) nextBtn.disabled = !nextPage;
    if (prevLabel) prevLabel.textContent = prev ? labelFor(prev) : 'Start';
    if (nextLabel) nextLabel.textContent = nextPage ? labelFor(nextPage) : 'End';

    if (!options.silent && location.hash !== '#' + id) {
      try {
        history.replaceState(null, '', '#' + id);
      } catch (error) {
        location.hash = id;
      }
    }

    if (id === 'deeptime') hydrateDeepTimeImages();
  };

  const goToId = id => {
    const index = pages.findIndex(page => page.id === id);
    if (index >= 0) goToIndex(index);
  };

  const next = () => goToIndex(pageIndex + 1);
  const prev = () => goToIndex(pageIndex - 1);

  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);
  $$('[data-page-next]').forEach(button => button.addEventListener('click', next));
  $$('[data-page-prev]').forEach(button => button.addEventListener('click', prev));
  dots?.addEventListener('click', event => {
    const dot = event.target.closest('[data-page-index]');
    if (dot) goToIndex(Number(dot.getAttribute('data-page-index')));
  });

  window.ForestPages = {
    goToIndex,
    goToId,
    next,
    prev,
    current: () => pages[pageIndex]?.id || ''
  };

  const initialId = location.hash.slice(1);
  const initialIndex = pages.findIndex(page => page.id === initialId);
  goToIndex(initialIndex >= 0 ? initialIndex : 0, { silent: true, force: true });

  window.addEventListener('hashchange', () => goToId(location.hash.slice(1)));

  let wheelLock = 0;
  window.addEventListener('wheel', event => {
    if (overlayIsOpen() || Math.abs(event.deltaY) < 16) return;
    const page = pages[pageIndex];
    if (!page) return;
    const down = event.deltaY > 0;
    const atTop = page.scrollTop <= 1;
    const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 2;
    if ((down && atBottom) || (!down && atTop)) {
      const now = Date.now();
      if (now < wheelLock) return;
      wheelLock = now + 750;
      if (down) next();
      else prev();
    }
  }, { passive: true });

  let touchStartY = null;
  let touchStartX = null;
  document.addEventListener('touchstart', event => {
    if (overlayIsOpen() || event.touches.length !== 1) return;
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', event => {
    if (touchStartY === null || overlayIsOpen()) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dy = touchStartY - touch.clientY;
    const dx = touchStartX - touch.clientX;
    touchStartY = null;
    touchStartX = null;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx)) return;
    const page = pages[pageIndex];
    const atTop = page.scrollTop <= 1;
    const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 2;
    if (dy > 0 && atBottom) next();
    if (dy < 0 && atTop) prev();
  }, { passive: true });
}

function initNavigation() {
  const header = $('#siteHeader');
  const mobileMenu = $('#mobileMenu');
  const menuBtn = $('#mobileMenuBtn');
  const menuClose = $('#mobileMenuClose');

  const updateHeader = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const setMenu = open => {
    if (!mobileMenu || !menuBtn) return;
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    syncBodyLock();
    if (open) {
      window.setTimeout(() => menuClose?.focus(), 120);
    }
  };

  menuBtn?.addEventListener('click', () => setMenu(!mobileMenu?.classList.contains('is-open')));
  menuClose?.addEventListener('click', () => setMenu(false));
  $$('#mobileMenu [data-mobile-link]').forEach(link => link.addEventListener('click', () => setMenu(false)));
  $('#mobileAccountBtn')?.addEventListener('click', () => {
    setMenu(false);
    if (state.session) openDashboard();
    else openAuth('login');
  });

  document.addEventListener('click', event => {
    const scrollLink = event.target.closest('[data-scroll]');
    if (scrollLink) {
      const href = scrollLink.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          event.preventDefault();
          setMenu(false);
          if (target.matches('[data-page]') && window.ForestPages) {
            window.ForestPages.goToId(target.id);
          } else {
            target.scrollIntoView({ behavior: state.hero.reducedMotion ? 'auto' : 'smooth', block: 'start' });
          }
        }
      }
    }

    const scrollTarget = event.target.closest('[data-scroll-target]');
    if (scrollTarget) {
      const target = document.querySelector(scrollTarget.getAttribute('data-scroll-target'));
      if (target) {
        if (target.matches('[data-page]') && window.ForestPages) window.ForestPages.goToId(target.id);
        else target.scrollIntoView({ behavior: state.hero.reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
  });
}

function renderFooterYear() {
  const year = $('#footerYear');
  if (year) year.textContent = String(new Date().getFullYear());
}

function initAmbientAudio() {
  const button = $('#audioToggle');
  if (!button) return;
  button.addEventListener('click', toggleAmbientAudio);
}

function toggleAmbientAudio() {
  if (state.audio.playing) {
    stopAmbientAudio();
    showToast('Ambient forest sound paused.');
  } else {
    const started = startAmbientAudio();
    if (started) showToast('Ambient forest sound on. A gentle synthetic soundscape.');
  }
}

function startAmbientAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    showToast('This browser does not support ambient audio.', 'error');
    return false;
  }

  try {
    if (!state.audio.context) {
      state.audio.context = new AudioContextClass();
    }

    const ctx = state.audio.context;
    if (ctx.state === 'suspended') ctx.resume();

    const bufferSize = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.018 * white) / 1.018;
      channel[i] = last * 3.2;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 640;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 1.8);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    const birdTimer = window.setInterval(() => {
      if (!state.audio.playing || document.visibilityState !== 'visible') return;
      if (Math.random() > 0.53) playSyntheticBird(ctx);
    }, 3700);

    state.audio.source = source;
    state.audio.gain = gain;
    state.audio.birdTimer = birdTimer;
    state.audio.playing = true;

    const button = $('#audioToggle');
    button?.classList.add('is-playing');
    button?.setAttribute('aria-pressed', 'true');
    return true;
  } catch (error) {
    console.warn('Ambient audio could not start.', error);
    showToast('The ambient sound could not start in this browser.', 'error');
    return false;
  }
}

function playSyntheticBird(ctx) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const base = 2100 + Math.random() * 900;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(base, now);
  oscillator.frequency.exponentialRampToValueAtTime(base + 520, now + 0.075);
  oscillator.frequency.exponentialRampToValueAtTime(base - 210, now + 0.18);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.017, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.26);
}

function stopAmbientAudio() {
  const { context, source, gain, birdTimer } = state.audio;
  if (birdTimer) window.clearInterval(birdTimer);

  if (gain && context) {
    try {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25);
    } catch (error) {
      console.warn('Could not fade ambient audio.', error);
    }
  }

  if (source) {
    try {
      source.stop((context?.currentTime || 0) + 0.28);
    } catch (error) {
      console.warn('Could not stop ambient source.', error);
    }
  }

  state.audio.source = null;
  state.audio.gain = null;
  state.audio.birdTimer = null;
  state.audio.playing = false;

  const button = $('#audioToggle');
  button?.classList.remove('is-playing');
  button?.setAttribute('aria-pressed', 'false');
}

function debounce(fn, wait = 180) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

const PAGER_IDS = {
  forests: 'forestPager',
  wildlife: 'wildlifePager',
  rare: 'rarePager',
  stories: 'storiesPager',
  prehistoric: 'prehistoricPager'
};

function paginate(items, type) {
  const size = pageSizeFor(type);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, state.pagers[type] || 1), totalPages);
  state.pagers[type] = current;
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    current,
    totalPages,
    start,
    size
  };
}

function pagerMarkup(type, current, totalPages) {
  if (totalPages <= 1) return '';
  const buttons = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (totalPages > 7 && page !== 1 && page !== totalPages && Math.abs(page - current) > 1) {
      if (Math.abs(page - current) === 2) buttons.push('<span class="pager-gap" aria-hidden="true">…</span>');
      continue;
    }
    buttons.push(
      '<button type="button" class="pager-btn' + (page === current ? ' is-active' : '') + '" data-pager-type="' + esc(type) + '" data-pager-page="' + page + '"' +
      (page === current ? ' aria-current="page"' : '') + ' aria-label="Go to page ' + page + '">' + page + '</button>'
    );
  }
  return '<div class="pager-inner">' +
    '<button type="button" class="pager-step" data-pager-type="' + esc(type) + '" data-pager-page="' + Math.max(1, current - 1) + '"' + (current === 1 ? ' disabled' : '') + ' aria-label="Previous page">' +
      '<svg class="icon"><use href="#icon-arrow"></use></svg>' +
    '</button>' +
    buttons.join('') +
    '<button type="button" class="pager-step" data-pager-type="' + esc(type) + '" data-pager-page="' + Math.min(totalPages, current + 1) + '"' + (current === totalPages ? ' disabled' : '') + ' aria-label="Next page">' +
      '<svg class="icon"><use href="#icon-arrow"></use></svg>' +
    '</button>' +
  '</div>';
}

function renderPager(type, current, totalPages) {
  const container = document.getElementById(PAGER_IDS[type]);
  if (!container) return;
  container.innerHTML = pagerMarkup(type, current, totalPages);
  container.hidden = totalPages <= 1;
}

function forestById(id) {
  return state.forests.find(forest => forest.id === id) || null;
}

function speciesById(id) {
  return state.species.find(species => species.id === id) || null;
}

function storyById(id) {
  return state.stories.find(story => story.id === id) || null;
}

function discoveryById(id) {
  return state.discoveries.find(discovery => discovery.id === id) || null;
}

function prehistoricById(id) {
  return state.prehistoric.find(item => item.id === id) || null;
}

function itemByType(type, id) {
  if (type === 'forest') return forestById(id);
  if (type === 'species') return speciesById(id);
  if (type === 'story') return storyById(id);
  if (type === 'discovery') return discoveryById(id);
  if (type === 'prehistoric') return prehistoricById(id);
  return null;
}

function forestNameForSpecies(species) {
  const ids = species.forestIds?.length ? species.forestIds : [species.forestId];
  const names = ids.map(id => forestById(id)?.name).filter(Boolean);
  return names.join(' · ') || 'Forest habitat';
}

function speciesName(id) {
  return speciesById(id)?.commonName || id;
}

function renderFeaturedForests() {
  const container = $('#featuredForests');
  if (!container) return;

  const curated = [
    'bialowieza-primeval-forest',
    'congo-basin-rainforest',
    'daintree-rainforest'
  ];
  const selected = curated.map(forestById).filter(Boolean);
  if (selected.length < 3) {
    state.forests.slice(0, 3).forEach(forest => {
      if (!selected.includes(forest)) selected.push(forest);
    });
  }

  container.innerHTML = selected.slice(0, 3).map((forest, index) => {
    const label = index === 0 ? 'Featured canopy' : 'Forest field card';
    return '<article class="featured-forest-card" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(forest.name) + '">' +
      '<img src="' + esc(forest.coverImage) + '" alt="' + esc(forest.name) + '" loading="' + (index === 0 ? 'eager' : 'lazy') + '">' +
      '<div class="featured-shade"></div>' +
      '<div class="featured-content">' +
        '<div class="card-kicker"><span>' + esc(label) + '</span><span>' + esc(forest.continent) + '</span><span>' + esc(forest.type) + '</span></div>' +
        '<h3>' + esc(forest.name) + '</h3>' +
        '<p>' + esc(forest.tagline) + '</p>' +
        '<div class="featured-foot">' +
          '<span>' + esc(forest.country) + ' · ' + (forest.speciesIds?.length || 0) + ' species profiles</span>' +
          saveButton('forest', forest.id, 'Save ' + forest.name) +
        '</div>' +
      '</div>' +
    '</article>';
  }).join('');
}

function populateForestFilters() {
  const continentSelect = $('#forestContinentFilter');
  const typeSelect = $('#forestTypeFilter');
  if (!continentSelect || !typeSelect) return;

  const continents = [...new Set(state.forests.map(forest => forest.continent).filter(Boolean))].sort();
  const types = [...new Set(state.forests.map(forest => forest.type).filter(Boolean))].sort();

  continentSelect.innerHTML = '<option value="all">All continents</option>' +
    continents.map(value => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join('');
  typeSelect.innerHTML = '<option value="all">All types</option>' +
    types.map(value => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join('');
}

function getFilteredForests() {
  const { q, continent, type, sort } = state.forestFilters;
  const query = q.trim().toLowerCase();

  const filtered = state.forests.filter(forest => {
    if (continent !== 'all' && forest.continent !== continent) return false;
    if (type !== 'all' && forest.type !== type) return false;
    if (!query) return true;
    return searchableForestText(forest).includes(query);
  });

  if (sort === 'az') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'za') {
    filtered.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'country') {
    filtered.sort((a, b) => a.country.localeCompare(b.country));
  }

  return filtered;
}

function searchableForestText(forest) {
  return [
    forest.name,
    forest.country,
    forest.region,
    forest.continent,
    forest.type,
    forest.biome,
    forest.climate,
    forest.tagline,
    forest.shortStory,
    forest.overview
  ].filter(Boolean).join(' ').toLowerCase();
}

function renderForests() {
  const grid = $('#forestGrid');
  const empty = $('#forestEmptyState');
  const meta = $('#forestResultsMeta');
  const chips = $('#forestActiveFilters');
  if (!grid) return;

  const filtered = getFilteredForests();
  const { q, continent, type } = state.forestFilters;
  const paged = paginate(filtered, 'forests');

  grid.innerHTML = paged.items.map(forestCardMarkup).join('');
  if (empty) empty.hidden = filtered.length > 0;
  grid.hidden = filtered.length === 0;

  if (meta) {
    const from = filtered.length ? paged.start + 1 : 0;
    const to = Math.min(paged.start + paged.size, filtered.length);
    meta.innerHTML = filtered.length === state.forests.length
      ? 'Showing <strong>' + from + '–' + to + '</strong> of <strong>' + state.forests.length + '</strong> forests'
      : 'Showing <strong>' + from + '–' + to + '</strong> of <strong>' + filtered.length + '</strong> matching forests';
  }

  renderPager('forests', paged.current, paged.totalPages);

  if (chips) {
    const chipMarkup = [];
    if (q.trim()) chipMarkup.push(filterChip('Search: ' + q.trim(), 'q'));
    if (continent !== 'all') chipMarkup.push(filterChip(continent, 'continent'));
    if (type !== 'all') chipMarkup.push(filterChip(type, 'type'));
    chips.innerHTML = chipMarkup.join('');
  }

  applySavedStates();
}

function forestCardMarkup(forest) {
  return '<article class="forest-card" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(forest.name) + ' field card">' +
    '<div class="forest-card-media">' +
      '<img src="' + esc(forest.coverImage) + '" alt="' + esc(forest.name) + '" loading="lazy">' +
      '<span class="type-tag">' + esc(forest.type) + '</span>' +
      saveButton('forest', forest.id, 'Save ' + forest.name) +
    '</div>' +
    '<div class="forest-card-body">' +
      '<div class="card-meta"><span class="region-tag">' + esc(forest.continent) + '</span><span>' + esc(forest.country) + '</span></div>' +
      '<h3>' + esc(forest.name) + '</h3>' +
      '<p class="forest-tagline">' + esc(forest.tagline) + '</p>' +
      '<div class="forest-card-foot"><span>' + esc(forest.canopyCoverage) + ' canopy</span><span class="card-link">Open field card <svg class="icon"><use href="#icon-arrow"></use></svg></span></div>' +
    '</div>' +
  '</article>';
}

function filterChip(label, key) {
  return '<span class="filter-chip">' + esc(label) + '<button type="button" data-remove-filter="' + esc(key) + '" aria-label="Remove ' + esc(label) + ' filter">' +
    '<svg class="icon" style="width:10px;height:10px"><use href="#icon-close"></use></svg></button></span>';
}

function resetForestFilters() {
  state.forestFilters = { q: '', continent: 'all', type: 'all', sort: 'featured' };
  state.pagers.forests = 1;
  const search = $('#forestSearchInput');
  const continent = $('#forestContinentFilter');
  const type = $('#forestTypeFilter');
  const sort = $('#forestSortSelect');
  if (search) search.value = '';
  if (continent) continent.value = 'all';
  if (type) type.value = 'all';
  if (sort) sort.value = 'featured';
  renderForests();
}

function renderWildlifeCategories() {
  const container = $('#wildlifeCategories');
  if (!container) return;

  const counts = new Map();
  state.species.forEach(species => counts.set(species.category, (counts.get(species.category) || 0) + 1));
  const categories = [...counts.keys()].sort();
  const allCount = state.species.length;

  container.innerHTML = '<button class="category-tab ' + (state.wildlifeFilters.category === 'All' ? 'is-active' : '') + '" type="button" data-species-category="All" role="tab" aria-selected="' + (state.wildlifeFilters.category === 'All') + '">All life <small>' + allCount + '</small></button>' +
    categories.map(category => {
      const active = state.wildlifeFilters.category === category;
      return '<button class="category-tab ' + (active ? 'is-active' : '') + '" type="button" data-species-category="' + esc(category) + '" role="tab" aria-selected="' + active + '">' + esc(category) + ' <small>' + counts.get(category) + '</small></button>';
    }).join('');
}

function getFilteredSpecies() {
  const { q, category, status } = state.wildlifeFilters;
  const query = q.trim().toLowerCase();

  const filtered = state.species.filter(species => {
    if (category !== 'All' && species.category !== category) return false;
    if (status !== 'all' && species.conservationStatus !== status) return false;
    if (!query) return true;
    const text = [
      species.commonName,
      species.scientificName,
      species.category,
      species.statusLabel,
      species.diet,
      species.habitat,
      species.distribution,
      forestNameForSpecies(species)
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query);
  });

  filtered.sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    return a.commonName.localeCompare(b.commonName);
  });

  return filtered;
}

function renderWildlife() {
  const grid = $('#speciesGrid');
  const empty = $('#speciesEmptyState');
  const meta = $('#wildlifeResultsMeta');
  if (!grid) return;

  const filtered = getFilteredSpecies();
  const paged = paginate(filtered, 'wildlife');
  grid.innerHTML = paged.items.map(speciesCardMarkup).join('');
  if (empty) empty.hidden = filtered.length > 0;
  grid.hidden = filtered.length === 0;

  if (meta) {
    const suffix = state.wildlifeFilters.category === 'All' ? 'species' : state.wildlifeFilters.category.toLowerCase();
    const from = filtered.length ? paged.start + 1 : 0;
    const to = Math.min(paged.start + paged.size, filtered.length);
    meta.innerHTML = filtered.length === state.species.length
      ? 'Showing <strong>' + from + '–' + to + '</strong> of <strong>' + state.species.length + '</strong> species'
      : 'Showing <strong>' + from + '–' + to + '</strong> of <strong>' + filtered.length + '</strong> matching ' + esc(suffix);
  }

  renderPager('wildlife', paged.current, paged.totalPages);
  renderWildlifeCategories();
  applySavedStates();
}

function speciesCardMarkup(species) {
  const statusClass = statusCssClass(species.conservationStatus);
  return '<article class="species-card" ' + OPEN_ATTRS.species + '="' + esc(species.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(species.commonName) + ' profile">' +
    '<div class="species-media">' +
      '<img src="' + esc(species.image) + '" alt="' + esc(species.imageCaption || species.commonName) + '" loading="lazy">' +
      '<span class="status-badge ' + statusClass + '">' + esc(species.conservationStatus) + '</span>' +
      saveButton('species', species.id, 'Save ' + species.commonName) +
    '</div>' +
    '<div class="species-body">' +
      '<span class="species-category">' + esc(species.category) + '</span>' +
      '<h3>' + esc(species.commonName) + '</h3>' +
      '<span class="scientific-name">' + esc(species.scientificName) + '</span>' +
      '<p class="species-forest">' + esc(forestNameForSpecies(species)) + '</p>' +
      '<div class="species-foot"><span class="species-status-text ' + statusClass + '">' + esc(species.statusLabel || species.conservationStatus) + '</span><span class="card-link">Profile <svg class="icon"><use href="#icon-arrow"></use></svg></span></div>' +
    '</div>' +
  '</article>';
}

function statusCssClass(code) {
  return String(code || '').toLowerCase();
}

function resetWildlifeFilters() {
  state.wildlifeFilters = { q: '', category: 'All', status: 'all' };
  state.pagers.wildlife = 1;
  const search = $('#wildlifeSearchInput');
  const status = $('#wildlifeStatusFilter');
  if (search) search.value = '';
  if (status) status.value = 'all';
  renderWildlife();
}

function renderRareAndDiscoveries() {
  const rareGrid = $('#rareSpeciesGrid');
  const rareCount = $('#rareSpeciesCount');
  const discoveriesList = $('#discoveriesList');
  if (rareGrid) {
    const priority = { CR: 0, EN: 1, VU: 2, EX: 3, NT: 4, LC: 5, NE: 6 };
    const rare = state.species
      .filter(species => species.rare)
      .sort((a, b) => (priority[a.conservationStatus] ?? 9) - (priority[b.conservationStatus] ?? 9) || a.commonName.localeCompare(b.commonName));

    const paged = paginate(rare, 'rare');
    rareGrid.innerHTML = paged.items.map(species => {
      return '<article class="rare-species-card" ' + OPEN_ATTRS.species + '="' + esc(species.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(species.commonName) + ' profile">' +
        '<img src="' + esc(species.image) + '" alt="' + esc(species.commonName) + '" loading="lazy">' +
        '<div class="rare-species-copy"><span class="status-badge ' + statusCssClass(species.conservationStatus) + '">' + esc(species.conservationStatus) + '</span>' +
        '<h4>' + esc(species.commonName) + '</h4><p>' + esc(species.scientificName) + '</p></div>' +
      '</article>';
    }).join('');

    if (rareCount) rareCount.textContent = rare.length + ' rare species';
    renderPager('rare', paged.current, paged.totalPages);
  }

  if (discoveriesList) {
    discoveriesList.innerHTML = state.discoveries.map(discovery => {
      return '<article class="discovery-item" ' + OPEN_ATTRS.discovery + '="' + esc(discovery.id) + '" tabindex="0" role="button" aria-label="Open field note: ' + esc(discovery.title) + '">' +
        '<div class="discovery-thumb"><img src="' + esc(discovery.image) + '" alt="' + esc(discovery.title) + '" loading="lazy"></div>' +
        '<div class="discovery-copy">' +
          '<div class="card-kicker"><span>' + esc(discovery.rarityBadge) + '</span><span class="verified-mini ' + (discovery.verified ? '' : 'pending') + '">' + (discovery.verified ? 'Reviewed' : 'Pending') + '</span></div>' +
          '<h3>' + esc(discovery.title) + '</h3>' +
          '<p>' + esc(discovery.excerpt) + '</p>' +
          '<footer><span>' + esc(discovery.author) + '</span><time datetime="' + esc(discovery.date) + '">' + esc(formatDate(discovery.date)) + '</time></footer>' +
        '</div>' +
      '</article>';
    }).join('');
  }
}

function renderStories() {
  const feature = $('#storiesFeature');
  const grid = $('#storiesGrid');
  if (!feature || !grid) return;

  const stories = [...state.stories].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [lead, ...rest] = stories;
  const paged = paginate(rest, 'stories');

  feature.innerHTML = lead ? storyFeatureMarkup(lead) : '';
  grid.innerHTML = paged.items.map(storyCardMarkup).join('');
  renderPager('stories', paged.current, paged.totalPages);
  applySavedStates();
}

function storyFeatureMarkup(story) {
  return '<article class="story-feature" ' + OPEN_ATTRS.story + '="' + esc(story.id) + '" tabindex="0" role="button" aria-label="Read ' + esc(story.title) + '">' +
    '<div class="story-feature-media"><img src="' + esc(story.image) + '" alt="' + esc(story.title) + '" loading="lazy"><span class="type-tag">' + esc(story.category) + '</span></div>' +
    '<div class="story-feature-copy">' +
      '<span class="eyebrow">' + (story.verified ? 'Verified forest story' : 'Legend and memory') + '</span>' +
      '<h3>' + esc(story.title) + '</h3>' +
      '<p class="story-quote">“' + esc(story.quote || story.teaser) + '”</p>' +
      '<p>' + esc(story.teaser) + '</p>' +
      '<div class="story-meta"><span>' + esc(story.forestName) + '</span><span>' + esc(formatDate(story.date)) + '</span><span>' + esc(story.origin) + '</span></div>' +
      '<span class="card-link">Read the story <svg class="icon"><use href="#icon-arrow"></use></svg></span>' +
    '</div>' +
  '</article>';
}

function storyCardMarkup(story) {
  return '<article class="story-card" ' + OPEN_ATTRS.story + '="' + esc(story.id) + '" tabindex="0" role="button" aria-label="Read ' + esc(story.title) + '">' +
    '<div class="story-media"><img src="' + esc(story.image) + '" alt="' + esc(story.title) + '" loading="lazy"><span class="type-tag">' + esc(story.category) + '</span></div>' +
    '<div class="story-card-body">' +
      '<div class="card-kicker"><span>' + esc(story.forestName) + '</span><span class="verified-mini ' + (story.verified ? '' : 'pending') + '">' + esc(story.verificationLabel) + '</span></div>' +
      '<h3>' + esc(story.title) + '</h3>' +
      '<p>' + esc(story.teaser) + '</p>' +
      '<footer><span>' + esc(formatDate(story.date)) + '</span><span>' + esc(story.origin) + '</span></footer>' +
    '</div>' +
  '</article>';
}

function renderPrehistoric() {
  const grid = $('#prehistoricGrid');
  if (!grid) return;

  const prehistoric = state.prehistoric.filter(item => item.category === 'prehistoric');
  const afterDark = state.prehistoric.filter(item => item.category === 'afterdark');
  const paged = paginate(prehistoric, 'prehistoric');

  grid.innerHTML = paged.items.map(prehistoricCardMarkup).join('');
  renderPager('prehistoric', paged.current, paged.totalPages);

  const afterDarkGrid = $('#afterDarkGrid');
  if (afterDarkGrid) afterDarkGrid.innerHTML = afterDark.map(afterDarkCardMarkup).join('');

  const count = $('#prehistoricCount');
  if (count) count.textContent = prehistoric.length + ' species';
  const label = $('#prehistoricCountLabel');
  if (label) label.textContent = prehistoric.length + ' deep-time species · ' + afterDark.length + ' after-dark encounters';
}

function deepTimeMediaMarkup(item, alt) {
  const media = state.prehistoricMedia[item.id];
  if (media && (media.thumb || media.full)) {
    return '<img src="' + esc(media.thumb || media.full) + '" alt="' + esc(alt || item.name) + '" loading="lazy" decoding="async">';
  }
  return '<div class="deep-time-placeholder" aria-hidden="true"><svg class="icon"><use href="#icon-paw"></use></svg><span>' + esc(item.era) + '</span></div>';
}

function prehistoricCardMarkup(item) {
  return '<article class="prehistoric-card" ' + OPEN_ATTRS.prehistoric + '="' + esc(item.id) + '" data-deep-time-id="' + esc(item.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(item.name) + ' deep-time card">' +
    '<div class="prehistoric-media">' + deepTimeMediaMarkup(item) +
      '<span class="deep-time-tag">' + esc(item.era) + '</span>' +
      '<span class="deep-time-age">' + esc(item.age) + '</span>' +
    '</div>' +
    '<div class="prehistoric-copy">' +
      '<h3>' + esc(item.name) + '</h3>' +
      '<span class="scientific-name">' + esc(item.scientificName) + '</span>' +
      '<p>' + esc(item.scare) + '</p>' +
      '<span class="card-link">Open deep-time card <svg class="icon"><use href="#icon-arrow"></use></svg></span>' +
    '</div>' +
  '</article>';
}

function afterDarkCardMarkup(item) {
  return '<article class="after-dark-card" ' + OPEN_ATTRS.prehistoric + '="' + esc(item.id) + '" data-deep-time-id="' + esc(item.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(item.name) + ' after-dark card">' +
    '<div class="after-dark-media">' + deepTimeMediaMarkup(item) + '<span class="after-dark-glow" aria-hidden="true"></span></div>' +
    '<div class="after-dark-copy"><strong>' + esc(item.name) + '</strong><span>' + esc(item.scare) + '</span></div>' +
  '</article>';
}

async function hydrateDeepTimeImages() {
  if (!state.prehistoric.length) return;
  await Promise.all(state.prehistoric.map(async item => {
    if (state.prehistoricMedia[item.id] || state.mediaRequests[item.id]) return;
    state.mediaRequests[item.id] = true;
    try {
      const media = await fetchWikipediaImage(item.wikiTitle || item.name);
      if (media) {
        state.prehistoricMedia[item.id] = media;
        updateDeepTimeMedia(item.id, media);
      }
    } catch (error) {
      console.warn('Deep-time image unavailable for ' + item.name, error);
    }
  }));
}

function updateDeepTimeMedia(id, media) {
  const thumb = media.thumb || media.full;
  if (!thumb) return;
  $$('[data-deep-time-id="' + id + '"]').forEach(card => {
    const mediaWrap = card.querySelector('.prehistoric-media, .after-dark-media');
    if (!mediaWrap || mediaWrap.querySelector('img')) return;
    const placeholder = mediaWrap.querySelector('.deep-time-placeholder');
    const img = document.createElement('img');
    img.src = thumb;
    img.alt = media.title || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (placeholder) placeholder.replaceWith(img);
    else mediaWrap.prepend(img);
  });
}

async function fetchWikipediaImage(title) {
  const slug = String(title || '').trim().replace(/\s+/g, '_');
  if (!slug) return null;
  const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(slug) + '?redirect=true', {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('Wikipedia image request failed (' + response.status + ')');
  const data = await response.json();
  const full = data.originalimage?.source || data.thumbnail?.source || '';
  const thumb = data.thumbnail?.source || full;
  if (!thumb) return null;
  return {
    thumb,
    full: full || thumb,
    title: data.title || title,
    credit: 'Wikipedia / Wikimedia Commons'
  };
}

function prehistoricDetailMarkup(item) {
  const media = state.prehistoricMedia[item.id];
  const image = media?.full || media?.thumb || './images/black_forest/2_conifer_sunbeams.jpg';
  const related = (item.forestIds || []).map(forestById).filter(Boolean).slice(0, 4);
  const isAfterDark = item.category === 'afterdark';

  return detailHeroMarkup({
    type: 'prehistoric',
    id: item.id,
    image,
    imageAlt: item.name,
    kicker: [isAfterDark ? 'After dark' : 'Deep time', item.era, item.region],
    title: item.name,
    subtitle: item.scientificName
  }) +
  '<div class="detail-body"><div class="detail-grid"><div class="detail-main">' +
    '<p class="detail-lede">' + esc(item.description) + '</p>' +
    '<section class="detail-section deep-time-scare"><h3>' + (isAfterDark ? 'Why it raises the hairs' : 'The detail that stays with you') + '</h3><p>' + esc(item.scare) + '</p></section>' +
    (related.length ? '<section class="detail-section"><h3>Forests to imagine it in</h3><div class="related-chips">' + related.map(forest => '<button class="related-chip" type="button" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '">' + esc(forest.name) + '</button>').join('') + '</div></section>' : '') +
    '<div class="detail-actions-bottom"><button class="btn btn-primary btn-small" type="button" data-close-detail>Close deep-time card</button></div>' +
  '</div><aside class="detail-side">' +
    factCard(isAfterDark ? 'Encounter facts' : 'Deep-time facts', [
      ['Age', item.age],
      ['Era', item.era],
      ['Region', item.region],
      ['Diet', item.diet],
      ['Size', item.size]
    ]) +
    '<div class="fact-card"><h3>Image source</h3><p class="reference-list" style="font-size:.64rem;color:var(--faint)">' + esc(media?.credit || 'Wikipedia / Wikimedia Commons') + '</p></div>' +
  '</aside></div></div>';
}

function initForestMap() {
  const mapElement = $('#forestMap');
  if (!mapElement) return;

  if (!window.L || typeof window.L.map !== 'function') {
    showMapFallback();
    return;
  }

  try {
    state.map = window.L.map(mapElement, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 7,
      scrollWheelZoom: false
    }).setView([18, 12], 2);

    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    window.L.control.zoom({ position: 'bottomright' }).addTo(state.map);
    state.markerLayer = window.L.layerGroup().addTo(state.map);

    renderMapContinents();
    renderMapMarkers(true);

    state.map.on('click', () => {
      state.map.closePopup();
    });

    window.setTimeout(() => state.map?.invalidateSize(), 400);
  } catch (error) {
    console.warn('Leaflet map failed.', error);
    showMapFallback();
  }
}

function renderMapContinents() {
  const container = $('#mapContinents');
  if (!container) return;
  const continents = [...new Set(state.forests.map(forest => forest.continent).filter(Boolean))].sort();
  container.innerHTML = '<button class="map-continent is-active" type="button" data-map-continent="all">All</button>' +
    continents.map(continent => '<button class="map-continent" type="button" data-map-continent="' + esc(continent) + '">' + esc(continent) + '</button>').join('');
}

function renderMapMarkers(fit = false) {
  if (!state.map || !state.markerLayer) return;

  const continent = state.mapContinent;
  const forests = state.forests.filter(forest => {
    const coordinates = forest.coordinates;
    if (!coordinates || !Number.isFinite(Number(coordinates.lat)) || !Number.isFinite(Number(coordinates.lng))) return false;
    return continent === 'all' || forest.continent === continent;
  });

  state.markerLayer.clearLayers();
  state.markers.clear();

  forests.forEach(forest => {
    const icon = window.L.divIcon({
      className: '',
      html: '<div class="map-marker ' + mapsTypeClass(forest.type) + '" aria-hidden="true"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    const marker = window.L.marker([Number(forest.coordinates.lat), Number(forest.coordinates.lng)], {
      icon,
      title: forest.name,
      alt: forest.name + ' forest marker'
    });
    marker.on('click', () => selectMapForest(forest.id, true));
    marker.addTo(state.markerLayer);
    state.markers.set(forest.id, marker);
  });

  const count = $('#mapCount');
  if (count) count.textContent = forests.length + ' mapped ' + (forests.length === 1 ? 'forest' : 'forests');

  $$('.map-continent').forEach(button => {
    button.classList.toggle('is-active', button.getAttribute('data-map-continent') === continent);
  });

  if (!forests.some(forest => forest.id === state.activeMapForest)) {
    state.activeMapForest = forests[0]?.id || null;
  }

  if (state.activeMapForest) {
    setMapInfo(forestById(state.activeMapForest));
    markActiveMapMarker();
  } else {
    const info = $('#mapInfo');
    if (info) info.innerHTML = '<div class="map-info-inner"><div class="map-info-copy"><h3>No forest in this view.</h3><p>Choose another continent to continue exploring.</p></div></div>';
  }

  if (fit && forests.length) {
    const bounds = window.L.latLngBounds(forests.map(forest => [Number(forest.coordinates.lat), Number(forest.coordinates.lng)]));
    state.map.fitBounds(bounds.pad(0.22), { maxZoom: continent === 'all' ? 3 : 4 });
  }
}

function mapsTypeClass(type) {
  if (type === 'Mangrove' || type === 'Riparian') return 'wetland';
  if (type === 'Tropical' || type === 'Cloud') return 'tropical';
  return 'temperate';
}

function selectMapForest(id, pan = false) {
  const forest = forestById(id);
  if (!forest || !state.map) return;
  state.activeMapForest = id;
  setMapInfo(forest);
  markActiveMapMarker();

  if (pan && forest.coordinates) {
    state.map.panTo([Number(forest.coordinates.lat), Number(forest.coordinates.lng)], { animate: true, duration: 0.7 });
  }
}

function markActiveMapMarker() {
  state.markers.forEach((marker, id) => {
    const element = marker.getElement();
    const pin = element?.querySelector('.map-marker');
    if (pin) pin.classList.toggle('is-active', id === state.activeMapForest);
  });
}

function setMapInfo(forest) {
  const info = $('#mapInfo');
  if (!info) return;
  if (!forest) {
    info.innerHTML = '';
    return;
  }

  const speciesCount = forest.speciesIds?.length || 0;
  info.innerHTML = '<div class="map-info-inner">' +
    '<div class="map-info-image"><img src="' + esc(forest.coverImage) + '" alt="' + esc(forest.name) + '" loading="lazy"><span class="type-tag">' + esc(forest.type) + '</span></div>' +
    '<div class="map-info-copy">' +
      '<span class="eyebrow">' + esc(forest.continent) + ' · ' + esc(forest.country) + '</span>' +
      '<h3>' + esc(forest.name) + '</h3>' +
      '<p>' + esc(forest.tagline) + '</p>' +
      '<dl class="mini-stats">' +
        '<div><dt>Biome</dt><dd>' + esc(forest.type) + '</dd></div>' +
        '<div><dt>Canopy</dt><dd>' + esc(forest.canopyCoverage) + '</dd></div>' +
        '<div><dt>Climate</dt><dd>' + esc(forest.climate) + '</dd></div>' +
        '<div><dt>Species</dt><dd>' + speciesCount + ' linked</dd></div>' +
      '</dl>' +
      '<div class="map-info-actions">' +
        '<button class="btn btn-primary btn-small" type="button" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '">Explore forest</button>' +
        saveButton('forest', forest.id, 'Save ' + forest.name) +
      '</div>' +
    '</div>' +
  '</div>';
  applySavedStates();
}

function showMapFallback() {
  const mapElement = $('#forestMap');
  const fallback = $('#mapFallback');
  if (mapElement) mapElement.hidden = true;
  if (fallback) {
    fallback.hidden = false;
    fallback.innerHTML = '<svg class="icon"><use href="#icon-map"></use></svg><p>The interactive map could not load. Browse the mapped forests from the list instead.</p>' +
      '<div class="map-fallback-list">' + state.forests.map(forest => '<button type="button" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '">' + esc(forest.name) + '</button>').join('') + '</div>';
  }
  const info = $('#mapInfo');
  if (info) info.innerHTML = '<div class="map-info-inner"><div class="map-info-copy"><span class="eyebrow">Forest atlas</span><h3>' + state.forests.length + ' forests, one living planet.</h3><p>Select a forest from the fallback list to open its field card.</p></div></div>';
}

function openSearch(initialQuery = '') {
  const overlay = $('#searchOverlay');
  const input = $('#universalSearchInput');
  if (!overlay || !input) return;

  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  input.value = initialQuery;
  renderSearchResults(initialQuery);
  syncBodyLock();
  window.setTimeout(() => input.focus(), 120);
}

function closeSearch() {
  const overlay = $('#searchOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  syncBodyLock();
}

function renderSearchResults(rawQuery) {
  const container = $('#searchResults');
  if (!container) return;

  const query = rawQuery.trim();
  const results = searchAtlas(query);
  const groups = [];

  if (results.forests.length) groups.push(searchGroupMarkup('Forests', results.forests, 'forest', query));
  if (results.species.length) groups.push(searchGroupMarkup('Wildlife', results.species, 'species', query));
  if (results.stories.length) groups.push(searchGroupMarkup('Forest stories', results.stories, 'story', query));
  if (results.discoveries.length) groups.push(searchGroupMarkup('Field notes', results.discoveries, 'discovery', query));

  container.innerHTML = groups.length
    ? groups.join('')
    : '<div class="search-empty">No forest, species or story matches “' + esc(query) + '”. Try a broader search.</div>';
}

function searchAtlas(query) {
  const normalized = query.toLowerCase();
  const limit = normalized ? 6 : 4;

  const forestResults = state.forests
    .filter(forest => !normalized || searchableForestText(forest).includes(normalized))
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name))
    .slice(0, limit);

  const speciesResults = state.species
    .filter(species => {
      if (!normalized) return species.featured;
      return [
        species.commonName,
        species.scientificName,
        species.category,
        species.statusLabel,
        species.diet,
        species.habitat,
        species.distribution,
        forestNameForSpecies(species)
      ].filter(Boolean).join(' ').toLowerCase().includes(normalized);
    })
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.commonName.localeCompare(b.commonName))
    .slice(0, limit);

  const storyResults = state.stories
    .filter(story => {
      if (!normalized) return story.verified;
      return [
        story.title,
        story.teaser,
        story.quote,
        story.category,
        story.forestName,
        story.origin
      ].filter(Boolean).join(' ').toLowerCase().includes(normalized);
    })
    .slice(0, limit);

  const discoveryResults = state.discoveries
    .filter(discovery => {
      if (!normalized) return discovery.verified;
      return [
        discovery.title,
        discovery.excerpt,
        discovery.content,
        discovery.rarityBadge,
        discovery.author,
        discovery.forestName,
        (discovery.tags || []).join(' ')
      ].filter(Boolean).join(' ').toLowerCase().includes(normalized);
    })
    .slice(0, limit);

  return {
    forests: forestResults,
    species: speciesResults,
    stories: storyResults,
    discoveries: discoveryResults
  };
}

function searchGroupMarkup(title, items, type, query) {
  const label = query ? title : 'Start with ' + title.toLowerCase();
  return '<section class="search-group"><h3>' + esc(label) + '</h3><div>' +
    items.map(item => searchResultMarkup(item, type, query)).join('') +
  '</div></section>';
}

function searchResultMarkup(item, type, query) {
  const image = type === 'species' || type === 'story' || type === 'discovery' ? item.image : item.coverImage;
  const title = type === 'species' ? item.commonName : type === 'forest' ? item.name : item.title;
  let subtitle = '';

  if (type === 'forest') subtitle = item.country + ' · ' + item.type;
  if (type === 'species') subtitle = item.scientificName + ' · ' + item.statusLabel;
  if (type === 'story') subtitle = item.forestName + ' · ' + item.category;
  if (type === 'discovery') subtitle = item.author + ' · ' + item.rarityBadge;

  return '<button class="search-result" type="button" ' + OPEN_ATTRS[type] + '="' + esc(item.id) + '">' +
    '<img src="' + esc(image) + '" alt="" loading="lazy">' +
    '<span><strong>' + highlightText(title, query) + '</strong><small>' + esc(subtitle) + '</small></span>' +
    '<svg class="icon"><use href="#icon-arrow"></use></svg>' +
  '</button>';
}

function highlightText(text, query) {
  if (!query) return esc(text);
  const safeText = esc(text);
  const safeQuery = esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return safeText.replace(new RegExp('(' + safeQuery + ')', 'ig'), '<mark>$1</mark>');
  } catch (error) {
    return safeText;
  }
}

function openDetail(type, id) {
  const item = itemByType(type, id);
  if (!item) {
    showToast('That record could not be found.', 'error');
    return;
  }

  let html = '';
  if (type === 'forest') html = forestDetailMarkup(item);
  if (type === 'species') html = speciesDetailMarkup(item);
  if (type === 'story') html = storyDetailMarkup(item);
  if (type === 'discovery') html = discoveryDetailMarkup(item);
  if (type === 'prehistoric') html = prehistoricDetailMarkup(item);

  const content = $('#detailModalContent');
  const modal = $('#detailModal');
  if (!content || !modal) return;

  content.innerHTML = html;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  const shell = $('.modal-shell', modal);
  if (shell) shell.scrollTop = 0;
  syncBodyLock();
  addRecent(type, id);

  if (type === 'forest') loadLiveForestGallery(item);
  if (type === 'prehistoric' && !state.prehistoricMedia[id]) {
    fetchWikipediaImage(item.wikiTitle || item.name).then(media => {
      if (!media) return;
      state.prehistoricMedia[id] = media;
      updateDeepTimeMedia(id, media);
      const hero = $('.detail-hero img', content);
      if (hero) hero.src = media.full || media.thumb;
    }).catch(() => {});
  }

  window.setTimeout(() => $('#detailModalClose')?.focus(), 120);
}

function closeDetail() {
  const modal = $('#detailModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyLock();
}

function detailHeroMarkup(options) {
  return '<header class="detail-hero">' +
    '<img src="' + esc(options.image) + '" alt="' + esc(options.imageAlt || options.title) + '">' +
    '<div class="detail-hero-content">' +
      '<div class="detail-kicker">' + options.kicker.map(item => '<span>' + esc(item) + '</span>').join('') + '</div>' +
      '<h2 id="detailModalTitle">' + esc(options.title) + '</h2>' +
      '<p class="detail-subtitle">' + esc(options.subtitle) + '</p>' +
      '<div class="detail-hero-actions">' +
        saveButton(options.type, options.id, 'Save ' + options.title) +
        '<button class="btn btn-glass btn-small" type="button" data-share-type="' + esc(options.type) + '" data-share-id="' + esc(options.id) + '">Share <svg class="icon"><use href="#icon-arrow"></use></svg></button>' +
      '</div>' +
    '</div>' +
  '</header>';
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const COMMONS_SKIP = /\b(map|satellite|modis|esa|diagram|logo|flag|chart|graph|timelapse|locator)\b|global forest change|fire and smoke/i;

function stripHtml(value) {
  const holder = document.createElement('div');
  holder.innerHTML = String(value || '');
  return (holder.textContent || '').replace(/\s+/g, ' ').trim();
}

async function fetchCommonsImages(query, options = {}) {
  const limit = Math.min(Math.max(options.limit || 12, 1), 30);
  const width = options.width || 3840;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: String(query || 'forest') + ' filetype:bitmap',
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: String(width)
  });

  const response = await fetch(COMMONS_API + '?' + params.toString());
  if (!response.ok) throw new Error('Wikimedia Commons request failed (' + response.status + ')');
  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {});

  return pages
    .filter(page => page.imageinfo?.[0] && /^image\/(jpeg|png|webp)$/i.test(page.imageinfo[0].mime || ''))
    .filter(page => !COMMONS_SKIP.test(String(page.title || '')))
    .map(page => {
      const info = page.imageinfo[0];
      const meta = info.extmetadata || {};
      return {
        url: info.thumburl || info.url,
        full: info.url,
        title: String(page.title || 'Forest image').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
        caption: stripHtml(meta.ImageDescription?.value || '') || 'Wikimedia Commons forest photograph',
        credit: stripHtml(meta.Artist?.value || 'Wikimedia Commons contributor'),
        license: stripHtml(meta.LicenseShortName?.value || 'See source file')
      };
    })
    .filter(photo => photo.url);
}

function forestImageQueries(forest) {
  const cleanName = String(forest.name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' ')
    .replace(/\b(National Park|National Forest|Forest Reserve|Biosphere Reserve|Riparian Corridor|Wilderness|Reserve|Park|Corridor)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleanName.replace(/^The\s+/i, '').split(' ').filter(Boolean);
  const firstWord = words[0] || '';
  const firstTwo = words.slice(0, 2).join(' ');
  const firstThree = words.slice(0, 3).join(' ');
  const country = String(forest.country || '').split('/')[0].trim();
  const candidates = [
    forest.imageQuery,
    cleanName,
    firstThree,
    firstTwo,
    firstWord,
    country + ' ' + forest.type + ' forest',
    forest.biome,
    forest.type + ' forest ' + forest.continent
  ];
  return [...new Set(candidates.map(value => String(value || '').trim()).filter(Boolean))];
}

async function fetchForestCommonsImages(forest, target = 14) {
  const queries = forestImageQueries(forest);
  const results = await Promise.allSettled(queries.map(query => fetchCommonsImages(query, { limit: 24, width: 2560 })));
  const seen = new Set();
  const photos = [];

  results.forEach(result => {
    if (result.status !== 'fulfilled') {
      console.warn('Commons search failed.', result.reason);
      return;
    }
    for (const photo of result.value) {
      if (photos.length >= target) break;
      const key = photo.full || photo.url;
      if (seen.has(key)) continue;
      seen.add(key);
      photos.push(photo);
    }
  });

  return photos;
}

function gallerySkeletons(count) {
  return Array.from({ length: count }, () => '<div class="gallery-skeleton" aria-hidden="true"></div>').join('');
}

async function loadLiveForestGallery(forest) {
  const container = $('#forestLiveGallery');
  if (!container) return;
  const token = ++state.galleryToken;
  const status = $('#forestGalleryStatus');
  if (status) status.textContent = 'Searching Wikimedia Commons for high-resolution images…';

  try {
    const photos = await fetchForestCommonsImages(forest, 14);
    if (token !== state.galleryToken) return;
    if (!photos.length) throw new Error('No images returned');
    container.innerHTML = photos.map(photo => galleryButtonMarkup({
      url: photo.url,
      thumb: photo.url,
      full: photo.full,
      title: photo.title,
      caption: photo.caption,
      credit: photo.credit + ' · ' + photo.license
    })).join('');
    if (status) status.textContent = photos.length + ' live high-resolution images · click any image to enlarge';
  } catch (error) {
    if (token !== state.galleryToken) return;
    container.innerHTML = '<div class="gallery-empty">Live images could not be loaded right now. The local archive above is still available.</div>';
    if (status) status.textContent = 'Live image search unavailable';
    console.warn('Live gallery unavailable for ' + forest.name, error);
  }
}

function forestDetailMarkup(forest) {
  const linkedSpecies = (forest.speciesIds || []).map(speciesById).filter(Boolean);
  const linkedStories = state.stories.filter(story => story.forestId === forest.id).slice(0, 4);
  const gallery = (forest.gallery || []).map(photo => galleryButtonMarkup(photo)).join('');
  const highlights = (forest.highlights || []).map(item => '<li>' + esc(item) + '</li>').join('');
  const threats = (forest.threats || []).map(item => '<li>' + esc(item) + '</li>').join('');

  return detailHeroMarkup({
    type: 'forest',
    id: forest.id,
    image: forest.coverImage,
    imageAlt: forest.name,
    kicker: [forest.continent, forest.country, forest.type],
    title: forest.name,
    subtitle: forest.tagline
  }) +
  '<div class="detail-body"><div class="detail-grid"><div class="detail-main">' +
    '<p class="detail-lede">' + esc(forest.overview || forest.shortStory) + '</p>' +
    '<section class="detail-section"><h3>The place</h3><p>' + esc(forest.geography) + '</p></section>' +
    '<section class="detail-section"><h3>Vegetation</h3><p>' + esc(forest.vegetation) + '</p></section>' +
    '<section class="detail-section"><h3>Ecology</h3><p>' + esc(forest.ecology) + '</p></section>' +
    '<section class="detail-section"><h3>Field highlights</h3><ul class="detail-section-list">' + highlights + '</ul></section>' +
    (linkedSpecies.length ? '<section class="detail-section"><h3>Wildlife in this forest</h3><div class="related-chips">' + linkedSpecies.map(species => '<button class="related-chip" type="button" ' + OPEN_ATTRS.species + '="' + esc(species.id) + '">' + esc(species.commonName) + '</button>').join('') + '</div></section>' : '') +
    '<section class="detail-section gallery-section"><div class="gallery-head"><h3>Image archive</h3><span class="gallery-status" id="forestGalleryStatus">Loading live images…</span></div>' +
      (gallery ? '<div class="detail-gallery local-gallery">' + gallery + '</div>' : '') +
      '<div class="detail-gallery live-gallery" id="forestLiveGallery">' + gallerySkeletons(8) + '</div>' +
    '</section>' +
    (threats ? '<section class="detail-section"><h3>Pressures</h3><ul class="detail-section-list">' + threats + '</ul></section>' : '') +
    '<section class="detail-section"><h3>Conservation</h3><p>' + esc(forest.conservation) + '</p></section>' +
    referenceSection(forest.sources, 'Sources') +
    '<div class="detail-actions-bottom"><button class="btn btn-primary btn-small" type="button" data-close-detail>Close field card</button></div>' +
  '</div><aside class="detail-side">' +
    factCard('Quick facts', [
      ['Continent', forest.continent],
      ['Country', forest.country],
      ['Biome', forest.biome],
      ['Area', formatArea(forest.areaKm2)],
      ['Established', forest.established],
      ['Canopy', forest.canopyCoverage],
      ['Climate', forest.climate],
      ['Coordinates', formatCoordinates(forest.coordinates)]
    ]) +
    (linkedStories.length ? factCard('Stories from here', linkedStories.map(story => '<button class="related-chip" type="button" ' + OPEN_ATTRS.story + '="' + esc(story.id) + '">' + esc(story.title) + '</button>'), true) : '') +
  '</aside></div></div>';
}

function speciesDetailMarkup(species) {
  const forest = forestById(species.forestId);
  const statusClass = statusCssClass(species.conservationStatus);
  const traits = (species.keyTraits || []).map(trait => '<li>' + esc(trait) + '</li>').join('');
  const classification = Object.entries(species.classification || {})
    .map(([key, value]) => '<div><span>' + esc(capitalize(key)) + '</span><span>' + esc(value) + '</span></div>')
    .join('');

  return detailHeroMarkup({
    type: 'species',
    id: species.id,
    image: species.image,
    imageAlt: species.imageCaption || species.commonName,
    kicker: [species.category, species.statusLabel, forest?.name || 'Forest habitat'],
    title: species.commonName,
    subtitle: species.description
  }) +
  '<div class="detail-body"><div class="detail-grid"><div class="detail-main">' +
    '<p class="detail-lede"><em>' + esc(species.scientificName) + '</em> · ' + esc(species.statusLabel) + '</p>' +
    '<section class="detail-section"><h3>Field portrait</h3><p>' + esc(species.physical) + '</p></section>' +
    '<section class="detail-section"><h3>Behaviour</h3><p>' + esc(species.behaviour) + '</p></section>' +
    '<section class="detail-section"><h3>Reproduction</h3><p>' + esc(species.reproduction) + '</p></section>' +
    '<section class="detail-section"><h3>Habitat</h3><p>' + esc(species.habitat) + '</p></section>' +
    '<section class="detail-section"><h3>Distribution</h3><p>' + esc(species.distribution) + '</p></section>' +
    (traits ? '<section class="detail-section"><h3>Distinguishing traits</h3><ul class="detail-section-list">' + traits + '</ul></section>' : '') +
    (classification ? '<section class="detail-section"><h3>Classification</h3><div class="classification-list">' + classification + '</div></section>' : '') +
    referenceSection(species.references, 'References') +
    '<div class="detail-actions-bottom">' +
      (forest ? '<button class="btn btn-primary btn-small" type="button" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '">Open ' + esc(forest.name) + '</button>' : '') +
      '<button class="btn btn-glass btn-small" type="button" data-close-detail>Close profile</button>' +
    '</div>' +
  '</div><aside class="detail-side">' +
    factCard('Conservation card', [
      ['Status', species.statusLabel],
      ['Code', species.conservationStatus],
      ['Endemic', species.endemic ? 'Yes' : 'No'],
      ['Rare', species.rare ? 'Yes' : 'No'],
      ['Diet', species.diet],
      ['Activity', species.activity],
      ['Size', species.size],
      ['Lifespan', species.lifespan],
      ['Forest', forest?.name || 'Multiple habitats']
    ]) +
    '<div class="fact-card"><h3>Image credit</h3><p class="reference-list" style="font-size:.64rem;color:var(--faint)">' + esc(species.imageCredit || 'Forest Explorer visual archive') + '<br>' + esc(species.imageLicense || 'Project asset') + '</p></div>' +
  '</aside></div></div>';
}

function storyDetailMarkup(story) {
  const forest = forestById(story.forestId);
  const chapters = (story.chapters || []).map(chapter => '<article class="chapter"><h4>' + esc(chapter.heading) + '</h4><p>' + esc(chapter.text) + '</p></article>').join('');
  const highlights = (story.highlights || []).map(item => '<li>' + esc(item) + '</li>').join('');
  const related = (story.relatedSpeciesIds || []).map(speciesById).filter(Boolean);

  return detailHeroMarkup({
    type: 'story',
    id: story.id,
    image: story.image,
    imageAlt: story.title,
    kicker: [story.category, story.forestName, story.verified ? 'Verified account' : 'Legend and memory'],
    title: story.title,
    subtitle: story.teaser
  }) +
  '<div class="detail-body"><div class="detail-grid"><div class="detail-main">' +
    '<blockquote class="detail-quote">“' + esc(story.quote) + '”</blockquote>' +
    '<section class="detail-section"><h3>The account</h3><div class="chapter-list">' + chapters + '</div></section>' +
    (highlights ? '<section class="detail-section"><h3>What stayed with us</h3><ul class="detail-section-list">' + highlights + '</ul></section>' : '') +
    (related.length ? '<section class="detail-section"><h3>Related wildlife</h3><div class="related-chips">' + related.map(species => '<button class="related-chip" type="button" ' + OPEN_ATTRS.species + '="' + esc(species.id) + '">' + esc(species.commonName) + '</button>').join('') + '</div></section>' : '') +
    referenceSection(story.references, 'Sources') +
    '<div class="detail-actions-bottom">' +
      (forest ? '<button class="btn btn-primary btn-small" type="button" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '">Open ' + esc(forest.name) + '</button>' : '') +
      '<button class="btn btn-glass btn-small" type="button" data-close-detail>Close story</button>' +
    '</div>' +
  '</div><aside class="detail-side">' +
    factCard('Story card', [
      ['Category', story.category],
      ['Forest', story.forestName],
      ['Origin', story.origin],
      ['Published', formatDate(story.date)],
      ['Verification', story.verificationLabel],
      ['Reading time', estimateReadingTime((story.chapters || []).map(chapter => chapter.text).join(' '))],
      ['Rating', story.thrillRating || 'Not rated']
    ]) +
    '<div class="fact-card"><h3>Verification note</h3><p style="font-size:.68rem;line-height:1.6;color:var(--faint)">' + (story.verified ? 'This account has been matched to the listed sources. Labels separate documented history from folklore and interpretation.' : 'This account includes cultural memory or unverified tradition. It is presented as story, not as confirmed science.') + '</p></div>' +
  '</aside></div></div>';
}

function discoveryDetailMarkup(discovery) {
  const tags = (discovery.tags || []).map(tag => '<span>' + esc(tag) + '</span>').join('');
  const forest = forestById(discovery.forestId);

  return detailHeroMarkup({
    type: 'discovery',
    id: discovery.id,
    image: discovery.image,
    imageAlt: discovery.title,
    kicker: [discovery.rarityBadge, discovery.forestName, discovery.verified ? 'Reviewed' : 'Verification pending'],
    title: discovery.title,
    subtitle: discovery.excerpt
  }) +
  '<div class="detail-body"><div class="detail-grid"><div class="detail-main">' +
    '<p class="detail-lede">' + esc(discovery.excerpt) + '</p>' +
    '<section class="detail-section"><h3>Field note</h3><p>' + esc(discovery.content) + '</p></section>' +
    '<section class="detail-section"><h3>Observation tags</h3><div class="tag-row">' + tags + '</div></section>' +
    '<section class="detail-section"><h3>Source note</h3><p>' + esc(discovery.source) + '</p></section>' +
    '<div class="detail-actions-bottom">' +
      (forest ? '<button class="btn btn-primary btn-small" type="button" ' + OPEN_ATTRS.forest + '="' + esc(forest.id) + '">Open ' + esc(forest.name) + '</button>' : '') +
      '<button class="btn btn-glass btn-small" type="button" data-close-detail>Close field note</button>' +
    '</div>' +
  '</div><aside class="detail-side">' +
    factCard('Observation record', [
      ['Author', discovery.author],
      ['Role', discovery.authorRole],
      ['Date', formatDate(discovery.date)],
      ['Forest', discovery.forestName],
      ['Habitat', discovery.forestType],
      ['Likes', String(discovery.likes || 0)],
      ['Review', discovery.verificationLabel]
    ]) +
    '<div class="fact-card"><h3>How to read this</h3><p style="font-size:.68rem;line-height:1.6;color:var(--faint)">' + (discovery.verified ? 'This record has an editorial review label and a traceable source note.' : 'This field note is awaiting independent verification. Treat it as an observation to follow, not a settled finding.') + '</p></div>' +
  '</aside></div></div>';
}

function galleryButtonMarkup(photo) {
  const thumb = photo.thumb || photo.url;
  const full = photo.full || photo.url;
  return '<button type="button" data-lightbox-src="' + esc(full) + '" data-lightbox-title="' + esc(photo.title) + '" data-lightbox-caption="' + esc(photo.caption) + '" data-lightbox-credit="' + esc(photo.credit || '') + '" aria-label="View ' + esc(photo.title) + ' full size">' +
    '<img src="' + esc(thumb) + '" alt="' + esc(photo.title) + '" loading="lazy" decoding="async">' +
  '</button>';
}

function factCard(title, rows, rawValue = false) {
  if (rawValue) {
    return '<div class="fact-card"><h3>' + esc(title) + '</h3><div class="related-chips">' + rows.join('') + '</div></div>';
  }

  const body = rows
    .filter(row => row[1] !== undefined && row[1] !== null && row[1] !== '')
    .map(row => '<div class="fact-row"><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>')
    .join('');

  return '<div class="fact-card"><h3>' + esc(title) + '</h3><dl class="fact-list">' + body + '</dl></div>';
}

function referenceSection(references, title) {
  if (!references || !references.length) return '';
  return '<section class="detail-section"><h3>' + esc(title) + '</h3><ul class="reference-list">' +
    references.map(reference => '<li>' + esc(referenceText(reference)) + '</li>').join('') +
  '</ul></section>';
}

function referenceText(reference) {
  if (typeof reference === 'string') return reference;
  return reference.label || reference.title || reference.source || reference.url || 'Source';
}

function openSources() {
  const forestSources = state.forests.flatMap(forest => forest.sources || []);
  const speciesSources = state.species.flatMap(species => species.references || []);
  const storySources = state.stories.flatMap(story => story.references || []);
  const all = [...new Set([...forestSources, ...speciesSources, ...storySources].map(referenceText))].sort();

  const content = $('#detailModalContent');
  const modal = $('#detailModal');
  if (!content || !modal) return;

  content.innerHTML = '<header class="detail-hero">' +
    '<img src="./images/monteverde/1_canopy_bridge.jpg" alt="Cloud forest canopy bridge">' +
    '<div class="detail-hero-content">' +
      '<div class="detail-kicker"><span>Transparency</span><span>Attribution</span><span>Open questions</span></div>' +
      '<h2 id="detailModalTitle">Data sources and credits.</h2>' +
      '<p class="detail-subtitle">The atlas separates observed records, conservation assessments, cultural memory and open field questions. Every profile keeps its sources close.</p>' +
    '</div>' +
  '</header>' +
  '<div class="detail-body"><div class="detail-grid"><div class="detail-main">' +
    '<p class="detail-lede">Forest descriptions draw on public conservation, forestry and natural-history references. Species statuses follow IUCN categories where available. Images are project assets or Wikimedia Commons files credited in the relevant records.</p>' +
    '<section class="detail-section"><h3>Reference list</h3><ul class="reference-list">' + all.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></section>' +
    '<section class="detail-section"><h3>Image licensing</h3><p>Individual credits and licences are stored with each forest gallery and species profile. If an image is reused elsewhere, verify the original source and licence first.</p></section>' +
    '<section class="detail-section"><h3>About verification</h3><p>Folklore, cultural memory and unconfirmed field notes are explicitly labelled. They are not presented as verified science. Species locations are generalised, never precise.</p></section>' +
    '<div class="detail-actions-bottom"><button class="btn btn-primary btn-small" type="button" data-close-detail>Close sources</button></div>' +
  '</div><aside class="detail-side">' +
    factCard('This edition', [
      ['Forests', String(state.forests.length)],
      ['Species', String(state.species.length)],
      ['Stories', String(state.stories.length)],
      ['Field notes', String(state.discoveries.length)],
      ['Image archive', 'Local project assets + credited Commons media'],
      ['Account model', 'Local demonstration only']
    ]) +
  '</aside></div></div>';

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  const shell = $('.modal-shell', modal);
  if (shell) shell.scrollTop = 0;
  syncBodyLock();
  window.setTimeout(() => $('#detailModalClose')?.focus(), 120);
}

function openLightbox(source) {
  const lightbox = $('#lightbox');
  const image = $('#lightboxImg');
  const caption = $('#lightboxCaption');
  if (!lightbox || !image || !caption) return;

  image.src = source.src;
  image.alt = source.title || '';
  caption.innerHTML = '<strong>' + esc(source.title || '') + '</strong>' +
    (source.caption ? '<span> · ' + esc(source.caption) + '</span>' : '') +
    (source.credit ? '<small>' + esc(source.credit) + '</small>' : '');

  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  syncBodyLock();
}

function closeLightbox() {
  const lightbox = $('#lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  syncBodyLock();
}

async function shareItem(type, id) {
  const item = itemByType(type, id);
  if (!item) return;
  const title = type === 'species' ? item.commonName : type === 'forest' || type === 'prehistoric' ? item.name : item.title;
  const section = type === 'forest' ? 'forests' : type === 'species' ? 'wildlife' : type === 'story' ? 'stories' : type === 'prehistoric' ? 'deeptime' : 'rare';
  const url = location.origin + location.pathname + '#' + section;
  const text = 'Forest Explorer: ' + title;

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard.writeText(text + ' — ' + url);
    showToast('Link copied to the clipboard.');
  } catch (error) {
    console.warn('Share cancelled or unavailable.', error);
  }
}

function formatDate(value) {
  if (!value) return 'Date unknown';
  const date = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatArea(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Not recorded';
  if (number < 1) return Math.round(number * 100) + ' ha';
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(number) + ' km²';
}

function formatCoordinates(coordinates) {
  if (!coordinates || !Number.isFinite(Number(coordinates.lat)) || !Number.isFinite(Number(coordinates.lng))) return 'Not mapped';
  const lat = Math.abs(Number(coordinates.lat)).toFixed(2) + '° ' + (Number(coordinates.lat) >= 0 ? 'N' : 'S');
  const lng = Math.abs(Number(coordinates.lng)).toFixed(2) + '° ' + (Number(coordinates.lng) >= 0 ? 'E' : 'W');
  return lat + ', ' + lng;
}

function estimateReadingTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220)) + ' min read';
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function esc(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function initAuth() {
  await ensureDemoAccount();
  restoreSession();
  renderAccount();
}

function safeGet(store, key) {
  try {
    return window[store].getItem(key);
  } catch (error) {
    console.warn('Storage is unavailable.', error);
    return null;
  }
}

function safeSet(store, key, value) {
  try {
    window[store].setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Could not write to storage.', error);
    return false;
  }
}

function safeRemove(store, key) {
  try {
    window[store].removeItem(key);
  } catch (error) {
    console.warn('Could not clear storage.', error);
  }
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getAccounts() {
  const parsed = safeParse(safeGet('localStorage', STORAGE.accounts), []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAccounts(accounts) {
  safeSet('localStorage', STORAGE.accounts, JSON.stringify(accounts));
}

async function ensureDemoAccount() {
  const accounts = getAccounts();
  const email = 'explorer@forest.app';
  if (accounts.some(account => account.email === email)) return;

  const salt = generateSalt();
  const passwordHash = await hashPassword('QuietForest2026!', salt);
  accounts.push({
    email,
    name: 'Demo Explorer',
    salt,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString()
  });
  saveAccounts(accounts);
}

function generateSalt() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  return Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32);
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function hashPassword(password, salt) {
  if (window.crypto?.subtle && window.TextEncoder) {
    const encoder = new TextEncoder();
    const material = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(salt), iterations: 120000, hash: 'SHA-256' },
      material,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }

  return fallbackHash(salt + ':' + password);
}

function fallbackHash(text) {
  let hash = 2166136261;
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i) + round;
      hash = Math.imul(hash, 16777619);
    }
  }
  return 'fallback-' + (hash >>> 0).toString(16);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function restoreSession() {
  const saved = safeParse(safeGet('localStorage', STORAGE.session), null) ||
    safeParse(safeGet('sessionStorage', STORAGE.session), null);
  if (!saved || !saved.email) {
    state.session = null;
    return;
  }

  const account = getAccounts().find(item => item.email === saved.email);
  if (!account) {
    safeRemove('localStorage', STORAGE.session);
    safeRemove('sessionStorage', STORAGE.session);
    state.session = null;
    return;
  }

  state.session = {
    email: account.email,
    name: account.name,
    role: account.role || 'explorer',
    remember: Boolean(saved.remember)
  };
}

function persistSession(account, remember) {
  const session = {
    email: account.email,
    name: account.name,
    role: account.role || 'explorer',
    remember
  };
  const serialized = JSON.stringify(session);
  safeRemove('localStorage', STORAGE.session);
  safeRemove('sessionStorage', STORAGE.session);
  safeSet(remember ? 'localStorage' : 'sessionStorage', STORAGE.session, serialized);
  state.session = session;
}

function clearSession() {
  safeRemove('localStorage', STORAGE.session);
  safeRemove('sessionStorage', STORAGE.session);
  state.session = null;
}

function renderAccount() {
  const label = $('#accountBtnLabel');
  const accountButton = $('#accountBtn');
  if (!label) return;

  if (state.session) {
    const firstName = state.session.name.split(/\s+/)[0];
    label.textContent = firstName;
    accountButton?.setAttribute('aria-label', 'Open dashboard for ' + state.session.name);
    accountButton?.setAttribute('title', 'My field journal');
  } else {
    label.textContent = 'Sign in';
    accountButton?.setAttribute('aria-label', 'Sign in to Forest Explorer');
    accountButton?.setAttribute('title', 'Sign in');
  }
}

function openAuth(tab = 'login') {
  const modal = $('#authModal');
  if (!modal) return;

  switchAuthTab(tab);
  const loginError = $('#loginError');
  const registerError = $('#registerError');
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyLock();
  window.setTimeout(() => {
    const target = tab === 'register' ? $('#registerName') : $('#loginEmail');
    target?.focus();
  }, 120);
}

function closeAuth() {
  const modal = $('#authModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyLock();
}

function switchAuthTab(tab) {
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');
  if (!loginForm || !registerForm) return;

  const isRegister = tab === 'register';
  loginForm.hidden = isRegister;
  registerForm.hidden = !isRegister;
  $$('.auth-tab').forEach(button => {
    const active = button.getAttribute('data-auth-tab') === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const emailInput = $('#loginEmail');
  const passwordInput = $('#loginPassword');
  const remember = $('#rememberMe');
  const errorBox = $('#loginError');
  const submit = $('#loginSubmitBtn');
  if (!emailInput || !passwordInput || !submit) return;

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  if (errorBox) errorBox.textContent = '';

  if (!email || !password) {
    if (errorBox) errorBox.textContent = 'Enter your email address and password.';
    return;
  }

  const account = getAccounts().find(item => item.email === email);
  if (!account) {
    if (errorBox) errorBox.textContent = 'No local account uses that email address.';
    return;
  }

  submit.disabled = true;
  const original = submit.textContent;
  submit.textContent = 'Signing in...';

  try {
    const candidate = await hashPassword(password, account.salt);
    if (candidate !== account.passwordHash) {
      if (errorBox) errorBox.textContent = 'That password does not match this local account.';
      return;
    }

    persistSession(account, Boolean(remember?.checked));
    closeAuth();
    renderAccount();
    applySavedStates();
    showToast('Welcome back, ' + account.name + '.');
    flushPendingSave();
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const nameInput = $('#registerName');
  const emailInput = $('#registerEmail');
  const passwordInput = $('#registerPassword');
  const confirmInput = $('#registerPasswordConfirm');
  const errorBox = $('#registerError');
  const submit = $('#registerSubmitBtn');
  if (!nameInput || !emailInput || !passwordInput || !confirmInput || !submit) return;

  const name = nameInput.value.trim();
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const confirmation = confirmInput.value;
  if (errorBox) errorBox.textContent = '';

  if (name.length < 2) {
    if (errorBox) errorBox.textContent = 'Enter the name you would like to use.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errorBox) errorBox.textContent = 'Enter a valid email address.';
    return;
  }
  if (password.length < 8) {
    if (errorBox) errorBox.textContent = 'Use a password with at least eight characters.';
    return;
  }
  if (password !== confirmation) {
    if (errorBox) errorBox.textContent = 'The two passwords do not match.';
    return;
  }

  const accounts = getAccounts();
  if (accounts.some(account => account.email === email)) {
    if (errorBox) errorBox.textContent = 'A local account already uses that email address.';
    return;
  }

  submit.disabled = true;
  const original = submit.textContent;
  submit.textContent = 'Creating account...';

  try {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const account = {
      email,
      name,
      salt,
      passwordHash,
      role: 'explorer',
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
    saveAccounts(accounts);
    persistSession(account, true);
    closeAuth();
    renderAccount();
    applySavedStates();
    showToast('Your field journal is ready, ' + name.split(/\s+/)[0] + '.');
    flushPendingSave();
  } catch (error) {
    console.warn('Account could not be created.', error);
    if (errorBox) errorBox.textContent = 'The account could not be created in this browser.';
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
}

function updatePasswordMeter(value) {
  const bar = $('#passwordMeterBar');
  if (!bar) return;
  let score = 12;
  if (value.length >= 6) score = 34;
  if (value.length >= 8) score = 58;
  if (value.length >= 12) score = 78;
  if (value.length >= 15 && /[A-Z]/.test(value) && /\d/.test(value)) score = 100;
  bar.style.width = score + '%';
  bar.style.background = score < 40 ? 'var(--danger)' : score < 75 ? 'var(--gold)' : 'var(--green)';
}

function emptyUserData() {
  return {
    savedForests: [],
    savedSpecies: [],
    savedStories: [],
    savedDiscoveries: [],
    recent: []
  };
}

function getUserData(email = state.session?.email) {
  if (!email) return emptyUserData();
  const data = safeParse(safeGet('localStorage', STORAGE.userData + email), emptyUserData());
  return {
    savedForests: Array.isArray(data.savedForests) ? data.savedForests : [],
    savedSpecies: Array.isArray(data.savedSpecies) ? data.savedSpecies : [],
    savedStories: Array.isArray(data.savedStories) ? data.savedStories : [],
    savedDiscoveries: Array.isArray(data.savedDiscoveries) ? data.savedDiscoveries : [],
    recent: Array.isArray(data.recent) ? data.recent : []
  };
}

function saveUserData(data, email = state.session?.email) {
  if (!email) return;
  safeSet('localStorage', STORAGE.userData + email, JSON.stringify(data));
}

function isSaved(type, id) {
  if (!state.session) return false;
  const key = SAVE_KEYS[type];
  if (!key) return false;
  return getUserData()[key].includes(id);
}

function saveButton(type, id, label) {
  if (!SAVE_KEYS[type]) return '';
  const saved = isSaved(type, id);
  const action = saved ? 'Remove from saved ' : 'Save ';
  return '<button class="save-btn ' + (saved ? 'is-saved' : '') + '" type="button" data-save-type="' + esc(type) + '" data-save-id="' + esc(id) + '" aria-label="' + esc(action + label) + '" aria-pressed="' + saved + '" title="' + esc(action + label) + '">' +
    '<svg class="icon"><use href="#icon-bookmark"></use></svg>' +
  '</button>';
}

function applySavedStates() {
  $$('[data-save-type]').forEach(button => {
    const type = button.getAttribute('data-save-type');
    const id = button.getAttribute('data-save-id');
    const saved = isSaved(type, id);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    const item = itemByType(type, id);
    const title = type === 'species' ? item?.commonName : item?.name || item?.title || 'this record';
    const action = saved ? 'Remove ' + title + ' from saved items' : 'Save ' + title;
    button.setAttribute('aria-label', action);
    button.setAttribute('title', action);
  });
}

function setSaved(type, id, saved, notify = true) {
  if (!state.session) return false;
  const key = SAVE_KEYS[type];
  if (!key) return false;
  const data = getUserData();
  const list = data[key];
  const index = list.indexOf(id);

  if (saved && index === -1) list.push(id);
  if (!saved && index !== -1) list.splice(index, 1);
  saveUserData(data);
  applySavedStates();

  if (notify) {
    const item = itemByType(type, id);
    const title = type === 'species' ? item?.commonName : item?.name || item?.title || 'Item';
    showToast(saved ? title + ' saved to your field journal.' : title + ' removed from saved items.', saved ? 'success' : 'info');
  }

  if ($('#dashboardDrawer')?.classList.contains('is-open')) renderDashboard();
  if ($('#adminDrawer')?.classList.contains('is-open')) renderAdmin();
  return true;
}

function toggleSave(type, id) {
  if (!state.session) {
    state.pendingSave = { type, id };
    openAuth('login');
    showToast('Sign in to keep a personal field journal.', 'gold');
    return;
  }
  setSaved(type, id, !isSaved(type, id));
}

function flushPendingSave() {
  if (!state.pendingSave || !state.session) return;
  const pending = state.pendingSave;
  state.pendingSave = null;
  setSaved(pending.type, pending.id, true, false);
  const item = itemByType(pending.type, pending.id);
  const title = pending.type === 'species' ? item?.commonName : item?.name || item?.title || 'Item';
  showToast(title + ' saved to your field journal.');
}

function removeSaved(type, id) {
  if (!state.session) return;
  setSaved(type, id, false, false);
  showToast('Removed from saved items.');
  if ($('#dashboardDrawer')?.classList.contains('is-open')) renderDashboard();
  if ($('#adminDrawer')?.classList.contains('is-open')) renderAdmin();
}

function addRecent(type, id) {
  if (!state.session) return;
  const data = getUserData();
  data.recent = data.recent.filter(entry => !(entry.type === type && entry.id === id));
  data.recent.unshift({ type, id, at: Date.now() });
  data.recent = data.recent.slice(0, 12);
  saveUserData(data);
}

function renderDashboard() {
  const body = $('#dashboardBody');
  if (!body) return;
  if (!state.session) {
    body.innerHTML = '<div class="drawer-empty">Sign in to open your field journal.</div>';
    return;
  }

  const data = getUserData();
  const initials = state.session.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

  body.innerHTML = '<div class="dashboard-profile">' +
      '<span class="profile-avatar">' + esc(initials) + '</span>' +
      '<div><h3>' + esc(state.session.name) + '</h3><p>' + esc(state.session.email) + ' · ' + (state.session.role === 'admin' ? 'Administrator' : 'Explorer') + '</p></div>' +
    '</div>' +
    '<div class="profile-stats">' +
      '<div><strong>' + data.savedForests.length + '</strong><span>Forests</span></div>' +
      '<div><strong>' + data.savedSpecies.length + '</strong><span>Species</span></div>' +
      '<div><strong>' + data.savedStories.length + '</strong><span>Stories</span></div>' +
    '</div>' +
    savedSectionMarkup('Saved forests', 'forest', data.savedForests) +
    savedSectionMarkup('Saved wildlife', 'species', data.savedSpecies) +
    savedSectionMarkup('Saved stories', 'story', data.savedStories) +
    savedSectionMarkup('Saved field notes', 'discovery', data.savedDiscoveries) +
    recentSectionMarkup(data.recent) +
    '<div class="drawer-actions">' +
      (state.session.role === 'admin' ? '<button class="btn btn-glass btn-small" type="button" data-action="open-admin">Administration</button>' : '') +
      '<button class="btn btn-danger btn-small" type="button" data-action="signout">Sign out</button>' +
    '</div>';

  applySavedStates();
}

function savedSectionMarkup(title, type, ids) {
  const items = ids.map(id => itemByType(type, id)).filter(Boolean);
  return '<section class="drawer-section"><div class="drawer-section-head"><h3>' + esc(title) + '</h3><span>' + items.length + '</span></div>' +
    (items.length ? '<div class="saved-list">' + items.map(item => savedItemMarkup(item, type)).join('') + '</div>'
      : '<div class="drawer-empty">Nothing saved yet. Open a field card and use the bookmark button.</div>') +
  '</section>';
}

function itemImage(item, type) {
  if (type === 'forest') return item.coverImage;
  if (type === 'prehistoric') return state.prehistoricMedia[item.id]?.thumb || './images/black_forest/2_conifer_sunbeams.jpg';
  return item.image || './images/monteverde/1_canopy_bridge.jpg';
}

function savedItemMarkup(item, type) {
  const title = type === 'species' ? item.commonName : item.name || item.title;
  const subtitle = type === 'species'
    ? item.scientificName
    : type === 'forest'
      ? item.country + ' · ' + item.type
      : item.forestName || item.category || '';
  const image = itemImage(item, type);

  return '<div class="saved-item" ' + OPEN_ATTRS[type] + '="' + esc(item.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(title) + '">' +
    '<img src="' + esc(image) + '" alt="" loading="lazy">' +
    '<span class="saved-item-copy"><strong>' + esc(title) + '</strong><small>' + esc(subtitle) + '</small></span>' +
    '<button class="remove-saved" type="button" data-remove-saved="' + esc(item.id) + '" data-remove-type="' + esc(type) + '" aria-label="Remove ' + esc(title) + ' from saved items"><svg class="icon" style="width:13px;height:13px"><use href="#icon-close"></use></svg></button>' +
  '</div>';
}

function recentSectionMarkup(recent) {
  const items = (recent || [])
    .map(entry => ({ entry, item: itemByType(entry.type, entry.id) }))
    .filter(entry => entry.item)
    .slice(0, 6);

  return '<section class="drawer-section"><div class="drawer-section-head"><h3>Recent exploration</h3><span>' + items.length + '</span></div>' +
    (items.length ? '<div class="saved-list">' + items.map(({ entry, item }) => {
      const title = entry.type === 'species' ? item.commonName : item.name || item.title;
      return '<div class="saved-item" ' + OPEN_ATTRS[entry.type] + '="' + esc(item.id) + '" tabindex="0" role="button" aria-label="Reopen ' + esc(title) + '">' +
        '<img src="' + esc(itemImage(item, entry.type)) + '" alt="" loading="lazy">' +
        '<span class="saved-item-copy"><strong>' + esc(title) + '</strong><small>' + esc(capitalize(entry.type)) + '</small></span>' +
      '</div>';
    }).join('') + '</div>'
      : '<div class="drawer-empty">Your recent forests, species and stories will appear here.</div>') +
  '</section>';
}

function openDashboard() {
  if (!state.session) {
    openAuth('login');
    return;
  }
  renderDashboard();
  openDrawer('dashboardDrawer');
}

function openAdmin() {
  if (!state.session) {
    openAuth('login');
    return;
  }
  if (state.session.role !== 'admin') {
    showToast('This local account does not have administration access. The demo explorer account is an administrator.', 'gold', 6200);
    return;
  }
  renderAdmin();
  openDrawer('adminDrawer');
}

function openDrawer(id) {
  const drawer = document.getElementById(id);
  const overlay = $('#drawerOverlay');
  if (!drawer) return;
  closeAllDrawers(false);
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  if (overlay) {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  syncBodyLock();
  window.setTimeout(() => drawer.querySelector('[data-close-drawer]')?.focus(), 120);
}

function closeDrawer(id) {
  const drawer = document.getElementById(id);
  if (!drawer) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  if (!$('.side-drawer.is-open')) {
    const overlay = $('#drawerOverlay');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }
  syncBodyLock();
}

function closeAllDrawers(updateLock = true) {
  $$('.side-drawer.is-open').forEach(drawer => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  });
  const overlay = $('#drawerOverlay');
  overlay?.classList.remove('is-open');
  overlay?.setAttribute('aria-hidden', 'true');
  if (updateLock) syncBodyLock();
}

function renderAdmin() {
  const body = $('#adminBody');
  if (!body) return;
  if (!state.session || state.session.role !== 'admin') {
    body.innerHTML = '<div class="drawer-empty">Administrator access is required.</div>';
    return;
  }

  const accounts = getAccounts();
  const data = getUserData();
  const savedTotal = data.savedForests.length + data.savedSpecies.length + data.savedStories.length + data.savedDiscoveries.length;

  body.innerHTML = '<div class="admin-note">This administration panel reviews the local demonstration database only. Credentials never leave this browser, and password hashes are not displayed here.</div>' +
    '<div class="admin-stats">' +
      '<div class="admin-stat"><strong>' + state.forests.length + '</strong><span>Forest records</span></div>' +
      '<div class="admin-stat"><strong>' + state.species.length + '</strong><span>Species records</span></div>' +
      '<div class="admin-stat"><strong>' + state.stories.length + '</strong><span>Stories</span></div>' +
      '<div class="admin-stat"><strong>' + state.discoveries.length + '</strong><span>Field notes</span></div>' +
      '<div class="admin-stat"><strong>' + accounts.length + '</strong><span>Local accounts</span></div>' +
      '<div class="admin-stat"><strong>' + savedTotal + '</strong><span>Your saved items</span></div>' +
    '</div>' +
    '<section class="drawer-section"><div class="drawer-section-head"><h3>Local accounts</h3><span>' + accounts.length + '</span></div>' +
      '<table class="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Created</th></tr></thead><tbody>' +
        accounts.map(account => '<tr><td>' + esc(account.name) + '<br><span style="color:var(--faint)">' + esc(account.email) + '</span></td><td>' + esc(capitalize(account.role || 'explorer')) + '</td><td>' + esc(formatDate(account.createdAt)) + '</td></tr>').join('') +
      '</tbody></table>' +
    '</section>' +
    '<section class="drawer-section"><div class="drawer-section-head"><h3>Local data tools</h3><span>Demo only</span></div>' +
      '<div class="drawer-actions">' +
        '<button class="btn btn-glass btn-small" type="button" data-action="export-local">Export summary</button>' +
        '<button class="btn btn-danger btn-small" type="button" data-action="reset-saved">Clear my saved items</button>' +
        '<button class="btn btn-glass btn-small" type="button" data-action="refresh-admin">Refresh</button>' +
      '</div>' +
    '</section>';
}

function exportLocalData() {
  const accounts = getAccounts().map(account => ({
    name: account.name,
    email: account.email,
    role: account.role,
    createdAt: account.createdAt
  }));
  const payload = {
    exportedAt: new Date().toISOString(),
    note: 'Local demonstration account summary. Password hashes are intentionally excluded.',
    accounts,
    currentUserData: state.session ? getUserData() : null,
    atlasCounts: {
      forests: state.forests.length,
      species: state.species.length,
      stories: state.stories.length,
      discoveries: state.discoveries.length
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'forest-explorer-local-summary.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Local account summary exported.');
}

function logout() {
  if (!state.session) return;
  const name = state.session.name.split(/\s+/)[0];
  clearSession();
  closeAllDrawers();
  renderAccount();
  applySavedStates();
  showToast('Signed out. Your saved items stay on this device, ' + name + '.');
}

function showToast(message, type = 'success', duration = 4200) {
  const stack = $('#toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type === 'error' ? 'is-error' : type === 'gold' ? 'is-gold' : '');
  const icon = type === 'error' ? '#icon-close' : type === 'gold' ? '#icon-shield' : '#icon-check';
  toast.innerHTML = '<svg class="icon"><use href="' + icon + '"></use></svg><span>' + esc(message) + '</span>';
  stack.appendChild(toast);
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 260);
  }, duration);
}

function syncBodyLock() {
  const open = Boolean(
    $('#mobileMenu')?.classList.contains('is-open') ||
    $('#searchOverlay')?.classList.contains('is-open') ||
    $('#detailModal')?.classList.contains('is-open') ||
    $('#authModal')?.classList.contains('is-open') ||
    $('#lightbox')?.classList.contains('is-open') ||
    $('.side-drawer.is-open')
  );
  document.body.classList.toggle('is-locked', open);
}

function bindInterfaceEvents() {
  $('#searchOpenBtn')?.addEventListener('click', () => openSearch(''));
  $('#searchCloseBtn')?.addEventListener('click', closeSearch);
  $('#accountBtn')?.addEventListener('click', () => state.session ? openDashboard() : openAuth('login'));
  $('#detailModalClose')?.addEventListener('click', closeDetail);
  $('#authCloseBtn')?.addEventListener('click', closeAuth);
  $('#lightboxClose')?.addEventListener('click', closeLightbox);
  $('#footerSourcesBtn')?.addEventListener('click', event => {
    event.preventDefault();
    openSources();
  });
  $('#footerSignInBtn')?.addEventListener('click', event => {
    event.preventDefault();
    openAuth('login');
  });
  $('#footerRegisterBtn')?.addEventListener('click', event => {
    event.preventDefault();
    openAuth('register');
  });
  $('#footerDashboardBtn')?.addEventListener('click', event => {
    event.preventDefault();
    openDashboard();
  });
  $('#footerAdminBtn')?.addEventListener('click', event => {
    event.preventDefault();
    openAdmin();
  });
  $('#aboutSearchBtn')?.addEventListener('click', () => openSearch(''));
  $('#conservationStoryBtn')?.addEventListener('click', () => {
    const story = state.stories.find(item => /conservation/i.test(item.category) && item.verified) ||
      state.stories.find(item => /conservation/i.test(item.category)) ||
      state.stories[state.stories.length - 1];
    if (story) openDetail('story', story.id);
    else showToast('Conservation stories are still being catalogued.', 'gold');
  });

  const universalInput = $('#universalSearchInput');
  const runUniversalSearch = debounce(() => renderSearchResults(universalInput?.value || ''), 120);
  universalInput?.addEventListener('input', runUniversalSearch);
  $('#searchHints')?.addEventListener('click', event => {
    const hint = event.target.closest('[data-search-hint]');
    if (!hint || !universalInput) return;
    universalInput.value = hint.getAttribute('data-search-hint');
    renderSearchResults(universalInput.value);
    universalInput.focus();
  });

  const forestSearch = $('#forestSearchInput');
  const runForestSearch = debounce(() => renderForests(), 150);
  forestSearch?.addEventListener('input', () => {
    state.forestFilters.q = forestSearch.value;
    state.pagers.forests = 1;
    runForestSearch();
  });
  $('#forestContinentFilter')?.addEventListener('change', event => {
    state.forestFilters.continent = event.target.value;
    state.pagers.forests = 1;
    renderForests();
  });
  $('#forestTypeFilter')?.addEventListener('change', event => {
    state.forestFilters.type = event.target.value;
    state.pagers.forests = 1;
    renderForests();
  });
  $('#forestSortSelect')?.addEventListener('change', event => {
    state.forestFilters.sort = event.target.value;
    state.pagers.forests = 1;
    renderForests();
  });
  $('#clearForestFilters')?.addEventListener('click', resetForestFilters);
  $('#forestActiveFilters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-filter]');
    if (!button) return;
    const key = button.getAttribute('data-remove-filter');
    if (key === 'q') {
      state.forestFilters.q = '';
      if (forestSearch) forestSearch.value = '';
    }
    if (key === 'continent') {
      state.forestFilters.continent = 'all';
      const select = $('#forestContinentFilter');
      if (select) select.value = 'all';
    }
    if (key === 'type') {
      state.forestFilters.type = 'all';
      const select = $('#forestTypeFilter');
      if (select) select.value = 'all';
    }
    state.pagers.forests = 1;
    renderForests();
  });

  const wildlifeSearch = $('#wildlifeSearchInput');
  const runWildlifeSearch = debounce(() => renderWildlife(), 150);
  wildlifeSearch?.addEventListener('input', () => {
    state.wildlifeFilters.q = wildlifeSearch.value;
    state.pagers.wildlife = 1;
    runWildlifeSearch();
  });
  $('#wildlifeStatusFilter')?.addEventListener('change', event => {
    state.wildlifeFilters.status = event.target.value;
    state.pagers.wildlife = 1;
    renderWildlife();
  });
  $('#clearWildlifeFilters')?.addEventListener('click', resetWildlifeFilters);
  $('#wildlifeCategories')?.addEventListener('click', event => {
    const button = event.target.closest('[data-species-category]');
    if (!button) return;
    state.wildlifeFilters.category = button.getAttribute('data-species-category');
    state.pagers.wildlife = 1;
    renderWildlife();
  });

  $('#mapContinents')?.addEventListener('click', event => {
    const button = event.target.closest('[data-map-continent]');
    if (!button) return;
    state.mapContinent = button.getAttribute('data-map-continent');
    renderMapMarkers(true);
  });

  $('#loginForm')?.addEventListener('submit', handleLogin);
  $('#registerForm')?.addEventListener('submit', handleRegister);
  $('#forgotPasswordBtn')?.addEventListener('click', () => {
    showToast('This local demonstration cannot send email. Use the demo account or create a new local account.', 'gold', 6200);
  });
  $('#registerPassword')?.addEventListener('input', event => updatePasswordMeter(event.target.value));

  $$('.auth-tab').forEach(button => {
    button.addEventListener('click', () => switchAuthTab(button.getAttribute('data-auth-tab')));
  });

  $('#drawerOverlay')?.addEventListener('click', () => closeAllDrawers());

  ['searchOverlay', 'detailModal', 'authModal', 'lightbox'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', event => {
      if (event.target.id !== id) return;
      if (id === 'searchOverlay') closeSearch();
      if (id === 'detailModal') closeDetail();
      if (id === 'authModal') closeAuth();
      if (id === 'lightbox') closeLightbox();
    });
  });

  document.addEventListener('click', handleDelegatedClick);
  document.addEventListener('keydown', handleGlobalKeydown);
}

function handleDelegatedClick(event) {
  const target = event.target;
  const save = target.closest('[data-save-type]');
  if (save) {
    event.preventDefault();
    event.stopPropagation();
    toggleSave(save.getAttribute('data-save-type'), save.getAttribute('data-save-id'));
    return;
  }

  const remove = target.closest('[data-remove-saved]');
  if (remove) {
    event.preventDefault();
    event.stopPropagation();
    removeSaved(remove.getAttribute('data-remove-type'), remove.getAttribute('data-remove-saved'));
    return;
  }

  const share = target.closest('[data-share-type]');
  if (share) {
    event.preventDefault();
    shareItem(share.getAttribute('data-share-type'), share.getAttribute('data-share-id'));
    return;
  }

  const lightbox = target.closest('[data-lightbox-src]');
  if (lightbox) {
    event.preventDefault();
    openLightbox({
      src: lightbox.getAttribute('data-lightbox-src'),
      title: lightbox.getAttribute('data-lightbox-title'),
      caption: lightbox.getAttribute('data-lightbox-caption'),
      credit: lightbox.getAttribute('data-lightbox-credit')
    });
    return;
  }

  const closeDetailButton = target.closest('[data-close-detail]');
  if (closeDetailButton) {
    closeDetail();
    return;
  }

  const closeDrawerButton = target.closest('[data-close-drawer]');
  if (closeDrawerButton) {
    closeDrawer(closeDrawerButton.getAttribute('data-close-drawer'));
    return;
  }

  const passwordToggle = target.closest('[data-toggle-password]');
  if (passwordToggle) {
    const input = document.getElementById(passwordToggle.getAttribute('data-toggle-password'));
    if (input) {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      passwordToggle.textContent = show ? 'Hide' : 'Show';
    }
    return;
  }

  const action = target.closest('[data-action]');
  if (action) {
    event.preventDefault();
    const actionName = action.getAttribute('data-action');
    if (actionName === 'signout') logout();
    if (actionName === 'open-admin') openAdmin();
    if (actionName === 'export-local') exportLocalData();
    if (actionName === 'refresh-admin') renderAdmin();
    if (actionName === 'reset-saved') {
      if (!state.session) return;
      if (!window.confirm('Clear all saved forests, species, stories and recent history for this local account?')) return;
      saveUserData(emptyUserData());
      applySavedStates();
      renderAdmin();
      showToast('Your saved items and recent history were cleared.');
    }
    return;
  }

  const pagerButton = target.closest('[data-pager-type]');
  if (pagerButton) {
    event.preventDefault();
    const type = pagerButton.getAttribute('data-pager-type');
    const page = Number(pagerButton.getAttribute('data-pager-page'));
    if (type && Number.isFinite(page)) {
      state.pagers[type] = page;
      if (type === 'forests') renderForests();
      if (type === 'wildlife') renderWildlife();
      if (type === 'rare') renderRareAndDiscoveries();
      if (type === 'stories') renderStories();
      if (type === 'prehistoric') renderPrehistoric();
      const activePage = $('.page.is-active');
      if (activePage) activePage.scrollTop = 0;
    }
    return;
  }

  const typeOrder = ['forest', 'species', 'story', 'discovery', 'prehistoric'];
  for (const type of typeOrder) {
    const opener = target.closest('[' + OPEN_ATTRS[type] + ']');
    if (opener) {
      event.preventDefault();
      const id = opener.getAttribute(OPEN_ATTRS[type]);
      closeSearch();
      closeAllDrawers();
      const mobileClose = $('#mobileMenuClose');
      if ($('#mobileMenu')?.classList.contains('is-open')) mobileClose?.click();
      openDetail(type, id);
      return;
    }
  }
}

function handleGlobalKeydown(event) {
  const key = event.key;

  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch('');
    return;
  }

  if (key === '/' && !event.ctrlKey && !event.metaKey) {
    const active = document.activeElement;
    const tag = active?.tagName?.toLowerCase();
    if (!['input', 'textarea', 'select'].includes(tag) && !active?.isContentEditable) {
      event.preventDefault();
      openSearch('');
      return;
    }
  }

  if (key === 'Escape') {
    if ($('#lightbox')?.classList.contains('is-open')) {
      closeLightbox();
    } else if ($('#authModal')?.classList.contains('is-open')) {
      closeAuth();
    } else if ($('#detailModal')?.classList.contains('is-open')) {
      closeDetail();
    } else if ($('#searchOverlay')?.classList.contains('is-open')) {
      closeSearch();
    } else if ($('.side-drawer.is-open')) {
      closeAllDrawers();
    } else if ($('#mobileMenu')?.classList.contains('is-open')) {
      $('#mobileMenuClose')?.click();
    }
    return;
  }

  if (!overlayIsOpen() && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const focused = document.activeElement;
    const focusedTag = focused?.tagName?.toLowerCase();
    const typing = ['input', 'textarea', 'select'].includes(focusedTag) || focused?.isContentEditable;
    if (!typing && window.ForestPages) {
      if (key === 'ArrowDown' || key === 'PageDown') {
        event.preventDefault();
        window.ForestPages.next();
        return;
      }
      if (key === 'ArrowUp' || key === 'PageUp') {
        event.preventDefault();
        window.ForestPages.prev();
        return;
      }
      if (key === 'Home') {
        event.preventDefault();
        window.ForestPages.goToIndex(0);
        return;
      }
      if (key === 'End') {
        event.preventDefault();
        window.ForestPages.goToIndex(999);
        return;
      }
    }
  }

  if (key === 'Enter' || key === ' ') {
    const active = document.activeElement;
    if (!active || active.tagName === 'BUTTON' || active.tagName === 'A' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
    const opener = active.matches('[data-open-forest], [data-open-species], [data-open-story], [data-open-discovery], [data-open-prehistoric], [data-open-drawer]')
      ? active
      : null;
    if (opener) {
      event.preventDefault();
      opener.click();
    }
  }
}

window.ForestExplorer = {
  openDetail,
  openSearch,
  openDashboard,
  openAdmin,
  openLightbox,
  getState: () => state
};


