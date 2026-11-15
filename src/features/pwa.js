'use strict';

import { state, emit } from '../core/state.js';
import { $, showToast } from '../utils/dom.js';

let deferredPrompt = null;

export function initPwa() {
  registerServiceWorker();
  listenInstallPrompt();
  listenNetworkStatus();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('🌿 Service Worker active in scope:', reg.scope);
        })
        .catch(err => {
          console.warn('Service worker registration ignored:', err);
        });
    });
  }
}

function listenInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });
}

function showInstallPromotion() {
  let installBtn = $('#pwaInstallBtn');
  if (!installBtn) {
    const actions = $('.header-actions');
    if (actions) {
      installBtn = document.createElement('button');
      installBtn.id = 'pwaInstallBtn';
      installBtn.className = 'btn btn-secondary btn-xs pwa-install-btn';
      installBtn.innerHTML = '<svg class="icon"><use href="#icon-bookmark"></use></svg> Install App';
      actions.insertBefore(installBtn, actions.firstChild);
    }
  }

  if (installBtn) {
    installBtn.style.display = 'inline-flex';
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Thank you for installing Forest Explorer!');
      }
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }
}

function listenNetworkStatus() {
  window.addEventListener('online', () => {
    state.offlineMode = false;
    showToast('Network connection restored. Syncing field journal...', 'success');
    emit('network:online');
  });

  window.addEventListener('offline', () => {
    state.offlineMode = true;
    showToast('Operating in Field Mode (Offline). Atlas data remains accessible.', 'warning', 6000);
    emit('network:offline');
  });
}

export async function downloadOfflineFieldPack() {
  showToast('Downloading Field Pack for offline exploration...', 'info');
  try {
    const cache = await caches.open('forest-explorer-fieldpack-v1');
    const urls = [
      './',
      './index.html',
      './styles.css',
      './src/main.js',
      './data/forests.json',
      './data/species.json',
      './data/stories.json',
      './data/discoveries.json',
      './data/prehistoric.json'
    ];
    await cache.addAll(urls);
    showToast('Offline Field Pack ready! You can now explore without internet.', 'success');
  } catch (err) {
    showToast('Could not cache offline pack: ' + err.message, 'error');
  }
}
