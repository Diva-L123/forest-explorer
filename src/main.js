'use strict';

import { state, emit } from './core/state.js';
import { api } from './services/api.js';
import { initI18n } from './services/i18n.js';
import { initHeroSequence } from './services/hero.js';
import { initAmbientAudio } from './services/audio.js';
import { initNavigation } from './features/navigation.js';
import { renderAtlas } from './features/atlas.js';
import { initForestMap } from './features/map.js';
import { initSearch } from './features/search.js';
import { initDetailModals } from './features/detail.js';
import { initCompare } from './features/compare.js';
import { initJournal } from './features/journal.js';
import { initAuth } from './features/auth.js';
import { initPwa } from './features/pwa.js';
import { openQuizModal } from './features/gamification.js';
import { showToast, syncBodyLock, $ } from './utils/dom.js';

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  // 1. Initialize error and telemetry trackers
  setupGlobalTelemetry();
  setupImageFallbacks();

  // 2. Initialize i18n & navigation system
  initI18n();
  initNavigation();
  initHeroSequence();
  initAmbientAudio();
  initSearch();
  initDetailModals();
  initCompare();
  initJournal();
  initPwa();

  // 3. Connect Auth & Session
  try {
    await initAuth();
  } catch (err) {
    console.warn('Session startup note:', err);
  }

  // 4. Load Atlas datasets
  try {
    await api.loadAtlasData();
    renderAtlas();
    initForestMap();
    updateHeaderStats();
    showToast('🌿 Atlas loaded: Explore 120+ primeval forests.');
  } catch (err) {
    console.error('Atlas data load error:', err);
    showToast('Failed to load online data. Utilizing offline field cache.', 'warning', 6000);
  }

  // 5. Quiz button trigger
  $('#quizTriggerBtn')?.addEventListener('click', openQuizModal);

  syncBodyLock();
}

function updateHeaderStats() {
  const countEl = $('#heroForestCount');
  if (countEl && state.forests?.length) {
    countEl.textContent = state.forests.length;
  }
}

function setupImageFallbacks() {
  const FALLBACK_IMAGES = [
    './images/amazon/1_canopy_sunrise.jpg',
    './images/bialowieza/01_ancient_oak.jpg',
    './images/black_forest/2_conifer_sunbeams.jpg',
    './images/cheonggyecheon/1_morning_mist.jpg',
    './images/congo/01_likouala_river.jpg',
    './images/daintree/01_canopy.jpg',
    './images/monteverde/1_canopy_bridge.jpg',
    './images/redwood/1_living_giants.jpg',
    './images/sundarbans/01_mangrove_tide.jpg'
  ];

  window.addEventListener('error', e => {
    if (e.target && e.target.tagName === 'IMG') {
      const img = e.target;
      if (img.dataset.fallbackTried) return;
      img.dataset.fallbackTried = 'true';
      const seed = Math.abs(String(img.alt || img.src).split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0));
      const fallback = FALLBACK_IMAGES[seed % FALLBACK_IMAGES.length];
      img.src = fallback;
    }
  }, true);
}

function setupGlobalTelemetry() {
  // Capture unhandled runtime exceptions
  window.addEventListener('error', event => {
    api.sendTelemetryError({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', event => {
    api.sendTelemetryError({
      message: event.reason?.message || 'Unhandled Promise Rejection',
      stack: event.reason?.stack
    });
  });
}
