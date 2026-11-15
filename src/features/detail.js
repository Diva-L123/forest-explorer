'use strict';

import { state, emit, on } from '../core/state.js';
import { $, $$, esc, showToast, syncBodyLock } from '../utils/dom.js';
import { formatDate, formatArea, formatCoordinates } from '../utils/formatters.js';
import { trapFocus, releaseFocus } from '../utils/a11y.js';
import { api } from '../services/api.js';
import { openAuthModal } from './auth.js';

const FREE_GALLERY_LIMIT = 3;
let activeDetail = null;

export function initDetailModals() {
  bindDetailEvents();
  checkDetailUrlHash();
  on('auth:changed', () => {
    if (activeDetail?.type === 'forest' && $('#detailModal')?.classList.contains('is-open')) {
      openDetail('forest', activeDetail.id);
    }
  });
}

export function openDetail(type, id) {
  const modal = $('#detailModal');
  const content = $('#detailModalContent');
  if (!modal || !content) return;

  let markup = '';
  if (type === 'forest') {
    const forest = state.forests.find(f => f.id === id);
    if (!forest) return;
    markup = renderForestDetail(forest);
    // Hydrate gallery with both local 10+ images and server-proxied Wikimedia photos
    loadForestGallery(forest);
  } else if (type === 'species') {
    const sp = state.species.find(s => s.id === id);
    if (!sp) return;
    markup = renderSpeciesDetail(sp);
  } else if (type === 'story') {
    let st = state.stories.find(s => s.id === id);
    if (!st) {
      const disc = state.discoveries.find(d => d.id === id);
      if (disc) {
        return openDetail('discovery', id);
      }
      return;
    }
    markup = renderStoryDetail(st);
  } else if (type === 'discovery') {
    let disc = state.discoveries.find(d => d.id === id);
    if (!disc) {
      const st = state.stories.find(s => s.id === id);
      if (st) {
        return openDetail('story', id);
      }
      return;
    }
    markup = renderDiscoveryDetail(disc);
  } else if (type === 'prehistoric') {
    const pre = state.prehistoric.find(p => p.id === id);
    if (!pre) return;
    markup = renderPrehistoricDetail(pre);
  }

  activeDetail = { type, id };
  content.innerHTML = markup;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyLock();
  trapFocus(modal, closeDetail);

  // Update deep link in URL
  history.replaceState(null, '', `#${type}/${id}`);
}

export function closeDetail() {
  const modal = $('#detailModal');
  if (!modal) return;
  activeDetail = null;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  releaseFocus();
  syncBodyLock();

  // Reset URL hash to whichever section the user was actively exploring (never kick to home)
  const activePageEl = $('.page.is-active');
  const activePage = activePageEl?.getAttribute('data-page') || 'forests';
  history.replaceState(null, '', `#${activePage}`);
}

function renderForestDetail(forest) {
  const isSaved = (state.userData.saved?.forest || []).includes(forest.id);
  const relatedStory = state.stories.find(s => s.forestId === forest.id || s.forestName === forest.name);

  // Myths are shown first, before everything else
  const myths = forest.myths || [];
  const highlightedMyth = myths.find(m => m.highlighted) || myths[0] || null;
  const secondaryMyths = myths.filter(m => m !== highlightedMyth);

  // 8K Fauna inhabitants
  const faunaList = forest.fauna8k || [];

  // Gallery access: guests see a preview, signed-in explorers unlock everything
  const isUnlocked = Boolean(state.session?.token);
  const galleryImages = forest.gallery || [];
  const forestImageCount = Math.max(10, galleryImages.length);
  const freeCount = isUnlocked ? galleryImages.length : Math.min(FREE_GALLERY_LIMIT, galleryImages.length);
  const lockedImageCount = Math.max(0, forestImageCount - freeCount);

  return `
    <article class="detail-sheet">
      <header class="detail-hero" style="background-image: url('${esc(forest.coverImage)}')">
        <div class="detail-hero-content">
          <span class="detail-kicker">${esc(forest.continent)} &bull; ${esc(forest.country)} &bull; ${esc(forest.type)}</span>
          <h1>${esc(forest.name)}</h1>
          <p class="tagline">${esc(forest.tagline || '')}</p>
          <div class="detail-actions-row">
            <button class="btn btn-primary btn-sm save-toggle-btn ${isSaved ? 'is-saved' : ''}" data-toggle-save="forest" data-id="${esc(forest.id)}" type="button">
              <svg class="icon"><use href="#icon-bookmark"></use></svg>
              <span>${isSaved ? 'Saved to Journal' : 'Save to Journal'}</span>
            </button>
            <button class="btn btn-secondary btn-sm" data-compare-forest="${esc(forest.id)}" type="button">
              <svg class="icon"><use href="#icon-compass"></use></svg> Compare Forest
            </button>
            <button class="btn btn-secondary btn-sm" id="shareDetailBtn" type="button">
              Share Link
            </button>
          </div>
        </div>
      </header>

      <div class="detail-body">
        <div class="detail-grid">
          <div class="detail-main">
            <!-- 1. MYTHS & SACRED LORE FIRST -->
            ${myths.length > 0 ? `
              <section class="detail-section myths-section">
                <div class="section-title-wrap">
                  <div class="fauna-header-flex">
                    <h3>Myths &amp; Sacred Lore</h3>
                    <span class="gallery-count-pill">${myths.length} ${myths.length === 1 ? 'Legend' : 'Legends'}</span>
                  </div>
                  <span class="subtext">Ancestral myths and oral traditions recorded from the people of ${esc(forest.name)}</span>
                </div>
                ${highlightedMyth ? `
                  <div class="highlighted-myth-hero-card">
                    <div class="myth-badge-row">
                      <span class="sacred-lore-tag">&#10024; Featured Myth &amp; Sacred Lore</span>
                      <span class="myth-origin-pill">${esc(highlightedMyth.origin || 'Ancestral Tradition')}</span>
                    </div>
                    <h3>${esc(highlightedMyth.title)}</h3>
                    <p class="myth-lead-story">${esc(highlightedMyth.story)}</p>
                    ${highlightedMyth.source ? `<div class="myth-source-cite"><strong>Cultural Reference:</strong> ${esc(highlightedMyth.source)}</div>` : ''}
                  </div>
                ` : ''}
                ${secondaryMyths.length > 0 ? `
                  <div class="myths-grid">
                    ${secondaryMyths.map(m => `
                      <article class="myth-card">
                        <div class="myth-head">
                          <span class="myth-origin-badge">${esc(m.origin || 'Regional Tradition')}</span>
                          <h4>${esc(m.title)}</h4>
                        </div>
                        <p class="myth-text">${esc(m.story)}</p>
                        ${m.source ? `<div class="myth-source"><strong>Source:</strong> ${esc(m.source)}</div>` : ''}
                      </article>
                    `).join('')}
                  </div>
                ` : ''}
              </section>
            ` : ''}

            <!-- 2. FEATURED DEEP STORY -->
            ${relatedStory ? `
              <div class="forest-story-banner" data-open-story="${esc(relatedStory.id)}" tabindex="0" role="button" aria-label="Read featured story: ${esc(relatedStory.title)}">
                <div class="story-banner-kicker">
                  <svg class="icon"><use href="#icon-book"></use></svg>
                  <span>Featured Deep Narrative &bull; ${esc(relatedStory.category || 'Expedition Chronicle')}</span>
                </div>
                <h4>${esc(relatedStory.title)}</h4>
                <p>${esc(relatedStory.teaser || relatedStory.summary || '')}</p>
                <button class="btn btn-primary btn-xs read-story-btn" type="button" data-open-story="${esc(relatedStory.id)}">Read Complete Story &rarr;</button>
              </div>
            ` : ''}

            <!-- 3. COMPLETE 8K FOREST IMAGES -->
            <section class="detail-section forest-8k-section">
              <div class="section-title-wrap">
                <div class="fauna-header-flex">
                  <h3>Complete 8K Forest Image Archive</h3>
                  <span class="fauna-8k-badge">&#9733; 8K Ultra-HD Forest</span>
                </div>
                <span class="subtext">Every high-resolution canopy, landscape and understory view of ${esc(forest.name)} (${forestImageCount} images${!isUnlocked ? ` &bull; ${lockedImageCount} locked` : ''})</span>
              </div>
              <div class="commons-gallery-grid" id="detailGalleryContainer">
                ${renderInitialTenGalleryImages(forest, freeCount)}
                ${!isUnlocked && lockedImageCount > 0 ? `
                  <button class="gallery-locked-card" type="button" data-unlock-gallery aria-label="Sign in to unlock ${lockedImageCount} more forest images">
                    <svg class="gallery-lock-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                    <strong>${lockedImageCount} more 8K images</strong>
                    <span>Sign in to unlock the complete forest archive</span>
                    <span class="gallery-unlock-btn">Sign in to view</span>
                  </button>
                ` : ''}
              </div>
            </section>

            <!-- 4. ANIMALS & FAUNA IMAGES -->
            ${faunaList.length > 0 ? `
              <section class="detail-section fauna-8k-section">
                <div class="section-title-wrap">
                  <div class="fauna-header-flex">
                    <h3>Native Wildlife &amp; 8K Fauna Archive</h3>
                    <span class="fauna-8k-badge">&#9733; 8K Ultra-HD Animals</span>
                  </div>
                  <span class="subtext">Photographic field records of animal species living within the ${esc(forest.name)} canopy</span>
                </div>
                <div class="fauna-8k-grid">
                  ${faunaList.map(animal => `
                    <div class="fauna-8k-card" data-lightbox-url="${esc(animal.image8k || animal.image)}" data-caption="${esc(animal.commonName)} (${esc(animal.scientificName)}) — 8K Ultra-HD Fauna Archive">
                      <div class="fauna-img-wrap">
                        <img src="${esc(animal.image || animal.image8k)}" alt="${esc(animal.commonName)}" loading="lazy">
                        <span class="resolution-badge">8K ULTRA-HD</span>
                        <span class="status-badge status-${esc(animal.status?.toLowerCase() || 'lc')}">${esc(animal.status || 'LC')}</span>
                      </div>
                      <div class="fauna-info">
                        <h4>${esc(animal.commonName)}</h4>
                        <span class="species-italic">${esc(animal.scientificName)}</span>
                        <p>${esc(animal.overview)}</p>
                        <span class="zoom-hint">Click photo for 8K zoom &rarr;</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </section>
            ` : ''}

            <!-- NATURAL HISTORY & ECOLOGY -->
            <section class="detail-section">
              <h3>Natural History &amp; Ecology</h3>
              <p class="lede-text">${esc(forest.shortStory || forest.overview)}</p>
              ${forest.overview && forest.overview !== forest.shortStory ? `<p>${esc(forest.overview)}</p>` : ''}
            </section>

            <!-- CANOPY & VEGETATION -->
            <section class="detail-section">
              <h3>Vegetation &amp; Canopy Architecture</h3>
              <p>${esc(forest.vegetation || forest.ecology || 'Dense primary canopy with rich understory vegetation.')}</p>
            </section>

            <!-- CONSERVATION -->
            <section class="detail-section">
              <h3>Conservation Challenges &amp; Stewardship</h3>
              <ul class="bullet-list">
                ${(forest.threats || []).map(t => `<li>${esc(t)}</li>`).join('')}
              </ul>
              ${forest.conservation ? `<p class="conservation-note">${esc(forest.conservation)}</p>` : ''}
            </section>
          </div>

          <aside class="detail-sidebar">
            <div class="sidebar-fact-card">
              <h4>Forest Vital Statistics</h4>
              <dl class="fact-dl">
                <dt>Biome</dt><dd>${esc(forest.biome || forest.type)}</dd>
                <dt>Surface Area</dt><dd>${formatArea(forest.areaKm2)}</dd>
                <dt>Canopy Cover</dt><dd>${esc(forest.canopyCoverage || 'N/A')}</dd>
                <dt>Climate</dt><dd>${esc(forest.climate || 'N/A')}</dd>
                <dt>Coordinates</dt><dd>${formatCoordinates(forest.coordinates)}</dd>
                <dt>Status</dt><dd>${esc(forest.established || 'Protected')}</dd>
              </dl>
            </div>
            ${forest.note ? `
              <div class="sidebar-fact-card note-card-sidebar">
                <h4>Editorial Field Note</h4>
                <p class="faint-copy">${esc(forest.note.slice(0, 300))}${forest.note.length > 300 ? '...' : ''}</p>
              </div>
            ` : ''}
          </aside>
        </div>
      </div>
    </article>
  `;
}

function renderInitialTenGalleryImages(forest, limit) {
  const items = (forest.gallery || []).slice(0, limit);
  return items.map((img, i) => `
    <figure class="gallery-item-figure" data-lightbox-url="${esc(img.url)}" data-caption="${esc(img.caption || img.title)}">
      <img src="${esc(img.url)}" alt="${esc(img.title)}" loading="${i < 4 ? 'eager' : 'lazy'}" class="gallery-item-img">
      <figcaption class="gallery-caption">
        <strong>${esc(img.title)}</strong>
        <p>${esc(img.caption || '')}</p>
      </figcaption>
    </figure>
  `).join('');
}

async function loadForestGallery(forest) {
  const container = $('#detailGalleryContainer');
  if (!container) return;
  if (!state.session?.token) return;

  try {
    const query = forest.imageQuery || `${forest.name} forest`;
    const res = await api.fetchWikimedia(query, 14);
    const liveImages = res?.images || [];

    if (liveImages.length > 0) {
      // Combine live Wikimedia images with local gallery to ensure at least 10-14 magnificent views
      const combined = [
        ...liveImages.slice(0, 8).map(img => ({
          url: img.full || img.url,
          thumb: img.url,
          srcset: img.srcset,
          title: img.title,
          caption: img.caption || img.title
        })),
        ...(forest.gallery || []).slice(0, 6).map(img => ({
          url: img.url,
          thumb: img.url,
          srcset: '',
          title: img.title,
          caption: img.caption || img.title
        }))
      ];

      // Deduplicate by title
      const seen = new Set();
      const unique = combined.filter(item => {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
      });

      if (unique.length >= 10) {
        container.innerHTML = unique.map((img, i) => `
          <figure class="gallery-item-figure" data-lightbox-url="${esc(img.url)}" data-caption="${esc(img.caption)}">
            <img src="${esc(img.thumb)}" ${img.srcset ? `srcset="${esc(img.srcset)}" sizes="(max-width: 768px) 100vw, 380px"` : ''} alt="${esc(img.title)}" loading="${i < 4 ? 'eager' : 'lazy'}" class="gallery-item-img">
            <figcaption class="gallery-caption">
              <strong>${esc(img.title)}</strong>
              <p>${esc(img.caption?.slice(0, 100) || '')}</p>
            </figcaption>
          </figure>
        `).join('');
      }
    }
  } catch (_) {
    // If live fetch fails, initial 10+ local gallery images are already rendered
  }
}

function renderSpeciesDetail(sp) {
  const isSaved = (state.userData.saved?.species || []).includes(sp.id);
  return `
    <article class="detail-sheet">
      <header class="detail-hero" style="background-image: url('${esc(sp.coverImage || sp.image || './images/species/okapi.jpg')}')">
        <div class="detail-hero-content">
          <span class="detail-kicker">IUCN Red List: ${esc(sp.status || sp.conservationStatus || 'LC')}</span>
          <h1>${esc(sp.commonName)}</h1>
          <p class="tagline species-italic">${esc(sp.scientificName)}</p>
          <div class="detail-actions-row">
            <button class="btn btn-primary btn-sm save-toggle-btn ${isSaved ? 'is-saved' : ''}" data-toggle-save="species" data-id="${esc(sp.id)}" type="button">
              <svg class="icon"><use href="#icon-bookmark"></use></svg>
              <span>${isSaved ? 'Saved to Journal' : 'Save Species'}</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="shareDetailBtn" type="button">Share Link</button>
          </div>
        </div>
      </header>
      <div class="detail-body">
        <div class="detail-section">
          <h3>Species Profile</h3>
          <p class="lede-text">${esc(sp.overview || sp.description)}</p>
        </div>
        <div class="detail-section">
          <h3>Habitat &amp; Ecology</h3>
          <p>${esc(sp.habitat || sp.ecology || 'Inhabits primary undisturbed forest canopies.')}</p>
        </div>
      </div>
    </article>
  `;
}

function renderStoryDetail(st) {
  return `
    <article class="detail-sheet">
      <header class="detail-hero" style="background-image: url('${esc(st.coverImage || st.image || './images/bialowieza/01_ancient_oak.jpg')}')">
        <div class="detail-hero-content">
          <span class="detail-kicker">${esc(st.category || 'Forest Lore')} &bull; ${esc(st.forestName || st.location || '')}</span>
          <h1>${esc(st.title)}</h1>
        </div>
      </header>
      <div class="detail-body">
        <div class="detail-section">
          <p class="lede-text">${esc(st.teaser || st.summary || '')}</p>
          ${st.content ? `<div class="story-content-body"><p>${esc(st.content)}</p></div>` : ''}
          ${st.story ? `<div class="story-content-body"><p>${esc(st.story)}</p></div>` : ''}
        </div>
        ${st.forestId ? `
          <div class="story-forest-link">
            <button class="btn btn-secondary btn-sm" data-open-forest="${esc(st.forestId)}" type="button">
              &larr; Return to ${esc(st.forestName || 'Forest Field Card')}
            </button>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

function renderDiscoveryDetail(d) {
  return `
    <article class="detail-sheet">
      <header class="detail-hero" style="background-image: url('${esc(d.coverImage || d.image || './images/cheonggyecheon/1_morning_mist.jpg')}')">
        <div class="detail-hero-content">
          <span class="detail-kicker">Field Discovery &bull; ${esc(d.region || d.rarityBadge || '')}</span>
          <h1>${esc(d.title)}</h1>
        </div>
      </header>
      <div class="detail-body">
        <div class="detail-section">
          <p class="lede-text">${esc(d.summary || d.excerpt || d.description || '')}</p>
        </div>
      </div>
    </article>
  `;
}

function renderPrehistoricDetail(p) {
  return `
    <article class="detail-sheet">
      <div class="detail-body">
        <div class="detail-section">
          <span class="detail-kicker">Deep Time Atlas &bull; ${esc(p.period || p.era || '')}</span>
          <h1>${esc(p.name)}</h1>
          <p class="lede-text">${esc(p.scare || p.significance || '')}</p>
          <dl class="fact-dl">
            <dt>Estimated Size</dt><dd>${esc(p.size || 'Megafauna')}</dd>
            <dt>Dietary Guild</dt><dd>${esc(p.diet || 'Herbivore')}</dd>
            <dt>Fossil Range</dt><dd>${esc(p.range || p.age || 'Pleistocene')}</dd>
          </dl>
        </div>
      </div>
    </article>
  `;
}

function checkDetailUrlHash() {
  const hash = window.location.hash.slice(1);
  if (hash.includes('/')) {
    const [type, id] = hash.split('/');
    setTimeout(() => {
      openDetail(type, id);
    }, 400);
  }
}

function bindDetailEvents() {
  $('#detailModalClose')?.addEventListener('click', closeDetail);

  document.addEventListener('click', e => {
    // Open Forest
    const fBtn = e.target.closest('[data-open-forest]');
    if (fBtn && !e.target.closest('.save-btn, button[data-compare-forest]')) {
      e.preventDefault();
      openDetail('forest', fBtn.getAttribute('data-open-forest'));
      return;
    }
    // Open Species
    const sBtn = e.target.closest('[data-open-species]');
    if (sBtn && !e.target.closest('.save-btn')) {
      e.preventDefault();
      openDetail('species', sBtn.getAttribute('data-open-species'));
      return;
    }
    // Open Story
    const stBtn = e.target.closest('[data-open-story]');
    if (stBtn) {
      e.preventDefault();
      const id = stBtn.getAttribute('data-open-story');
      if (id?.startsWith('disc-') || (!state.stories.some(s => s.id === id) && state.discoveries.some(d => d.id === id))) {
        openDetail('discovery', id);
      } else {
        openDetail('story', id);
      }
      return;
    }
    // Open Discovery
    const dBtn = e.target.closest('[data-open-discovery]');
    if (dBtn) {
      e.preventDefault();
      openDetail('discovery', dBtn.getAttribute('data-open-discovery'));
      return;
    }
    // Open Prehistoric
    const pBtn = e.target.closest('[data-open-prehistoric]');
    if (pBtn) {
      e.preventDefault();
      openDetail('prehistoric', pBtn.getAttribute('data-open-prehistoric'));
      return;
    }
    // Close detail modal via [data-close-detail]
    const closeBtn = e.target.closest('[data-close-detail]');
    if (closeBtn) {
      e.preventDefault();
      closeDetail();
      return;
    }
    // Unlock full forest gallery (requires sign in)
    const unlockBtn = e.target.closest('[data-unlock-gallery]');
    if (unlockBtn) {
      e.preventDefault();
      openAuthModal('login');
      return;
    }
    // Open Lightbox
    const lbItem = e.target.closest('[data-lightbox-url]');
    if (lbItem) {
      openLightbox(lbItem.getAttribute('data-lightbox-url'), lbItem.getAttribute('data-caption'));
    }
    // Share button
    const shareBtn = e.target.closest('#shareDetailBtn');
    if (shareBtn) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Link copied to clipboard!');
      });
    }
  });
}

function openLightbox(url, caption = '') {
  let lb = $('#lightbox');
  if (!lb) return;
  const img = $('#lightboxImg');
  const cap = $('#lightboxCaption');
  if (img) img.src = url;
  if (cap) cap.textContent = caption;

  lb.classList.add('is-open');
  lb.setAttribute('aria-hidden', 'false');
  syncBodyLock();

  $('#lightboxClose')?.addEventListener('click', closeLightbox, { once: true });
}

function closeLightbox() {
  const lb = $('#lightbox');
  if (lb) {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
  }
  syncBodyLock();
}

export function openSources() {
  const content = $('#detailModalContent');
  const modal = $('#detailModal');
  if (!content || !modal) return;

  const forestSources = state.forests.flatMap(forest => forest.sources || []);
  const speciesSources = state.species.flatMap(species => species.references || []);
  const storySources = state.stories.flatMap(story => story.references || []);
  const all = [...new Set([...forestSources, ...speciesSources, ...storySources].map(referenceText))].sort();

  content.innerHTML = `
    <article class="detail-sheet">
      <header class="detail-hero" style="background-image: url('./images/monteverde/1_canopy_bridge.jpg')">
        <div class="detail-hero-content">
          <span class="detail-kicker">Transparency &bull; Attribution &bull; Open Questions</span>
          <h1>Data Sources and Credits</h1>
          <p class="detail-subtitle">The atlas separates observed records, conservation assessments, cultural memory and open field questions. Every profile keeps its sources close.</p>
        </div>
      </header>
      <div class="detail-body">
        <div class="detail-grid">
          <div class="detail-main">
            <p class="detail-lede">Forest descriptions draw on public conservation, forestry and natural-history references. Species statuses follow IUCN categories where available. Images are project assets or Wikimedia Commons files credited in the relevant records.</p>
            <section class="detail-section">
              <h3>Reference List (${all.length})</h3>
              <ul class="reference-list" style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.35rem;">
                ${all.map(item => `<li>&bull; ${esc(item)}</li>`).join('')}
              </ul>
            </section>
            <section class="detail-section">
              <h3>Image Licensing</h3>
              <p>Individual credits and licences are stored with each forest gallery and species profile. If an image is reused elsewhere, verify the original source and licence first.</p>
            </section>
            <section class="detail-section">
              <h3>About Verification</h3>
              <p>Folklore, cultural memory and unconfirmed field notes are explicitly labelled. They are not presented as verified science. Species locations are generalised, never precise.</p>
            </section>
            <div class="detail-actions-bottom" style="margin-top:1.5rem;">
              <button class="btn btn-primary btn-sm" type="button" data-close-detail>Close Sources</button>
            </div>
          </div>
          <aside class="detail-side">
            <div class="fact-card">
              <h4>This Edition</h4>
              <dl class="fact-dl">
                <dt>Forests</dt><dd>${state.forests.length}</dd>
                <dt>Species</dt><dd>${state.species.length}</dd>
                <dt>Stories</dt><dd>${state.stories.length}</dd>
                <dt>Field Notes</dt><dd>${state.discoveries.length}</dd>
                <dt>Prehistoric</dt><dd>${state.prehistoric.length}</dd>
                <dt>Image Archive</dt><dd>Local project assets + credited Commons media</dd>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </article>
  `;

  activeDetail = { type: 'sources', id: 'all' };
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyLock();
  trapFocus(modal, closeDetail);
}

function referenceText(reference) {
  if (typeof reference === 'string') return reference;
  return reference?.label || reference?.title || reference?.source || reference?.url || 'Source';
}

