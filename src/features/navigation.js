'use strict';

import { state, emit } from '../core/state.js';
import { $, $$, esc, syncBodyLock, showToast } from '../utils/dom.js';
import { setHeroVisible } from '../services/hero.js';
import { openSearch } from './search.js';
import { openDetail, openSources } from './detail.js';
import { openAuthModal } from './auth.js';
import { openDashboard, openAdmin } from './journal.js';

const PAGES = ['home', 'forests', 'map', 'wildlife', 'rare', 'stories', 'deeptime', 'conservation', 'about'];
const PAGE_LABELS = {
  home: 'Home',
  forests: 'Forest Atlas',
  map: 'Interactive Map',
  wildlife: 'Wildlife Guides',
  rare: 'Rare Discoveries',
  stories: 'Forest Stories',
  deeptime: 'Deep Time',
  conservation: 'Impact & Stewardship',
  about: 'About Project'
};

let currentPageIndex = 0;
let isTransitioning = false;

export function initNavigation() {
  initDots();
  bindNavClicks();
  bindMobileMenu();
  bindGlobalActions();
  populateFooterYear();
  bindKeyboardNavigation();
  handleInitialHash();

  window.addEventListener('popstate', handlePopState);
}

function initDots() {
  const dots = $('#pageDots');
  if (dots) {
    dots.innerHTML = PAGES.map((pageId, index) =>
      `<button class="page-dot ${index === 0 ? 'is-active' : ''}" type="button" data-page-index="${index}" aria-label="Go to ${esc(PAGE_LABELS[pageId] || pageId)}"><span></span></button>`
    ).join('');

    dots.addEventListener('click', e => {
      const dot = e.target.closest('[data-page-index]');
      if (dot) {
        goToPage(Number(dot.getAttribute('data-page-index')));
      }
    });
  }

  $('#pagePrevBtn')?.addEventListener('click', () => goToPage(currentPageIndex - 1));
  $('#pageNextBtn')?.addEventListener('click', () => goToPage(currentPageIndex + 1));
}

export function goToPage(target, pushHash = true) {
  let index = typeof target === 'number' ? target : PAGES.indexOf(target);
  if (index < 0) index = 0;
  if (index >= PAGES.length) index = PAGES.length - 1;

  if (index === currentPageIndex && document.querySelector(`.page[data-page="${PAGES[index]}"].is-active`)) {
    return;
  }

  isTransitioning = true;
  const outgoingIndex = currentPageIndex;
  currentPageIndex = index;

  const outgoingPageId = PAGES[outgoingIndex];
  const incomingPageId = PAGES[currentPageIndex];

  const outgoingEl = document.querySelector(`.page[data-page="${outgoingPageId}"]`) || document.getElementById(outgoingPageId);
  const incomingEl = document.querySelector(`.page[data-page="${incomingPageId}"]`) || document.getElementById(incomingPageId);

  // Mark outgoing page with is-previous for upward parallax exit
  if (outgoingEl && outgoingEl !== incomingEl) {
    outgoingEl.classList.remove('is-active');
    outgoingEl.classList.add('is-previous');
    setTimeout(() => {
      outgoingEl.classList.remove('is-previous');
    }, 450);
  }

  if (incomingEl) {
    incomingEl.classList.add('is-active');
    incomingEl.scrollTop = 0;
  }

  // Update navigation links & header
  $$('[data-nav], [data-mobile-link]').forEach(link => {
    const href = link.getAttribute('href')?.replace('#', '');
    link.classList.toggle('is-active', href === incomingPageId);
  });

  $('#siteHeader')?.classList.toggle('is-scrolled', incomingPageId !== 'home');

  // Update dots and page indicator
  const dots = $('#pageDots');
  if (dots) {
    $$('.page-dot', dots).forEach((dot, i) => {
      dot.classList.toggle('is-active', i === currentPageIndex);
      dot.setAttribute('aria-current', i === currentPageIndex ? 'page' : 'false');
    });
  }

  const posEl = $('#pagePosition');
  if (posEl) {
    posEl.textContent = `${String(currentPageIndex + 1).padStart(2, '0')} / ${String(PAGES.length).padStart(2, '0')}`;
  }

  const prevBtn = $('#pagePrevBtn');
  const nextBtn = $('#pageNextBtn');
  const prevLabel = $('#pagePrevLabel');
  const nextLabel = $('#pageNextLabel');

  if (prevBtn) prevBtn.disabled = currentPageIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentPageIndex >= PAGES.length - 1;

  if (prevLabel) prevLabel.textContent = currentPageIndex > 0 ? PAGE_LABELS[PAGES[currentPageIndex - 1]] : 'Start';
  if (nextLabel) nextLabel.textContent = currentPageIndex < PAGES.length - 1 ? PAGE_LABELS[PAGES[currentPageIndex + 1]] : 'End';

  // Control Hero Playback: pause when leaving home to save CPU/battery
  setHeroVisible(incomingPageId === 'home');

  // Invalidate Leaflet map size when entering map page
  if (incomingPageId === 'map' && state.map) {
    setTimeout(() => state.map.invalidateSize(), 300);
  }

  // Push to URL hash if requested
  if (pushHash && window.location.hash.slice(1).split('/')[0] !== incomingPageId) {
    history.pushState({ page: incomingPageId }, '', `#${incomingPageId}`);
  }

  emit('page:change', incomingPageId);

  setTimeout(() => {
    isTransitioning = false;
  }, 460);
}

function bindNavClicks() {
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-nav], [data-mobile-link], a[href^="#"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('#!')) return;

    const target = href.replace('#', '').split('/')[0].split('?')[0];
    if (PAGES.includes(target)) {
      e.preventDefault();
      $('#mobileMenu')?.classList.remove('is-open');
      goToPage(target);
    }
  });

  // Explicit home navigation via brand link
  $('.brand')?.addEventListener('click', e => {
    e.preventDefault();
    goToPage('home');
  });
}

export function openMobileMenu() {
  const menu = $('#mobileMenu');
  const btn = $('#mobileMenuBtn');
  if (!menu) return;
  menu.classList.add('is-open');
  menu.setAttribute('aria-hidden', 'false');
  btn?.setAttribute('aria-expanded', 'true');
  syncBodyLock();
}

export function closeMobileMenu() {
  const menu = $('#mobileMenu');
  const btn = $('#mobileMenuBtn');
  if (!menu) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  btn?.setAttribute('aria-expanded', 'false');
  syncBodyLock();
}

function bindMobileMenu() {
  $('#mobileMenuBtn')?.addEventListener('click', () => {
    const menu = $('#mobileMenu');
    if (menu?.classList.contains('is-open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  $('#mobileMenuClose')?.addEventListener('click', closeMobileMenu);

  $('#mobileAccountBtn')?.addEventListener('click', () => {
    closeMobileMenu();
    if (state.session?.user) {
      openDashboard();
    } else {
      openAuthModal('login');
    }
  });
}

function bindGlobalActions() {
  // Footer: Sign in, Create account, My dashboard, Administration, Data sources
  $('#footerSignInBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openAuthModal('login');
  });

  $('#footerRegisterBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openAuthModal('register');
  });

  $('#footerDashboardBtn')?.addEventListener('click', e => {
    e.preventDefault();
    if (state.session?.user) {
      openDashboard();
    } else {
      openAuthModal('login');
    }
  });

  $('#footerAdminBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openAdmin();
  });

  $('#footerSourcesBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openSources();
  });

  // About: "Search the atlas", "Data sources"
  $('#aboutSearchBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openSearch();
  });

  $('#aboutSourcesBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openSources();
  });

  // Impact: "Read a conservation story"
  $('#conservationStoryBtn')?.addEventListener('click', e => {
    e.preventDefault();
    const story = state.stories.find(item => /conservation/i.test(item.category) && item.verified) ||
      state.stories.find(item => /conservation/i.test(item.category)) ||
      state.stories[0];
    if (story) {
      openDetail('story', story.id);
    } else {
      showToast('Conservation stories are being catalogued.', 'info');
    }
  });
}

function populateFooterYear() {
  const yearEl = $('#footerYear');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

/**
 * Strict navigation rule:
 * Users navigate to sections via navbar, mobile menu, brand logo, or page control buttons.
 * Normal vertical wheel scrolling and trackpad gestures scroll the active view naturally,
 * preventing accidental kicks back to Home while reading.
 */
function bindKeyboardNavigation() {
  window.addEventListener('keydown', e => {
    if (document.body.classList.contains('modal-open')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTypingTarget(e.target)) return;

    // Arrow keys only cycle full pages when focused on page step controls
    if (document.activeElement?.classList.contains('page-step')) {
      if (['ArrowRight', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        goToPage(currentPageIndex + 1);
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        goToPage(currentPageIndex - 1);
      }
    }
  });
}

function isTypingTarget(target) {
  const el = target instanceof Element
    ? target.closest('input, textarea, select, [contenteditable="true"]')
    : null;
  return Boolean(el);
}

function handleInitialHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    goToPage('home', false);
    return;
  }

  const parts = hash.split('/');
  const base = parts[0].split('?')[0];

  if (PAGES.includes(base)) {
    goToPage(base, false);
  } else {
    // If deep link is #forest/..., default base to forests
    if (base === 'forest') {
      goToPage('forests', false);
    } else if (base === 'species') {
      goToPage('wildlife', false);
    } else if (base === 'story') {
      goToPage('stories', false);
    } else {
      goToPage('home', false);
    }
  }
}

function handlePopState() {
  const hash = window.location.hash.slice(1);
  const base = hash.split('/')[0].split('?')[0];
  if (PAGES.includes(base)) {
    goToPage(base, false);
  }
}
