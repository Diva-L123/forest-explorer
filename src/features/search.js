'use strict';

import { state } from '../core/state.js';
import { $, $$, esc, syncBodyLock } from '../utils/dom.js';
import { trapFocus, releaseFocus } from '../utils/a11y.js';

function getSearchInput() {
  return $('#universalSearchInput') || $('#searchInput');
}

export function initSearch() {
  const openBtn = $('#searchOpenBtn');
  const closeBtn = $('#searchCloseBtn');
  const overlay = $('#searchOverlay');
  const input = getSearchInput();

  openBtn?.addEventListener('click', () => openSearch());
  closeBtn?.addEventListener('click', closeSearch);

  input?.addEventListener('input', e => {
    renderSearchResults(e.target.value.trim());
  });

  // Popular search chips (Jaguar / Mangrove / Quetzal / Congo)
  $$('[data-search-hint]').forEach(btn => {
    btn.addEventListener('click', () => {
      const hint = btn.getAttribute('data-search-hint');
      const searchInput = getSearchInput();
      if (searchInput) {
        searchInput.value = hint;
        renderSearchResults(hint);
        searchInput.focus();
      }
    });
  });

  // Clicking a search result closes the search overlay so detail view is revealed
  $('#searchResults')?.addEventListener('click', e => {
    if (e.target.closest('.search-result-row, [data-open-forest], [data-open-species], [data-open-story], [data-open-discovery], [data-open-prehistoric]')) {
      closeSearch();
    }
  });

  // Clicking overlay backdrop outside dialog closes search
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) {
      closeSearch();
    }
  });

  // Global shortcut '/' to search
  window.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openSearch();
    }
  });
}

export function openSearch(query = '') {
  const overlay = $('#searchOverlay');
  const input = getSearchInput();
  if (!overlay || !input) return;

  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  syncBodyLock();
  trapFocus(overlay, closeSearch);

  input.value = query;
  input.focus();
  setTimeout(() => input.focus(), 80);
  renderSearchResults(query);
}

export function closeSearch() {
  const overlay = $('#searchOverlay');
  if (!overlay) return;

  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  releaseFocus();
  syncBodyLock();
}

function renderSearchResults(query) {
  const container = $('#searchResults');
  if (!container) return;

  if (!query) {
    container.innerHTML = '<div class="search-empty"><p>Type a forest name, animal, continent, or biome to search the atlas.</p></div>';
    return;
  }

  const results = searchAtlas(query);
  const total = results.forests.length + results.species.length + results.stories.length + results.discoveries.length + results.prehistoric.length;

  if (total === 0) {
    container.innerHTML = `<div class="search-empty"><p>No results found matching "<strong>${esc(query)}</strong>".</p></div>`;
    return;
  }

  container.innerHTML = `
    ${renderSearchGroup('Forests', results.forests, 'forest', query)}
    ${renderSearchGroup('Wildlife', results.species, 'species', query)}
    ${renderSearchGroup('Forest Stories', results.stories, 'story', query)}
    ${renderSearchGroup('Field Discoveries', results.discoveries, 'discovery', query)}
    ${renderSearchGroup('Deep Time', results.prehistoric, 'prehistoric', query)}
  `;
}

function searchAtlas(q) {
  const query = q.toLowerCase();
  const match = str => String(str || '').toLowerCase().includes(query);

  const forests = state.forests.filter(f =>
    match(f.name) || match(f.country) || match(f.continent) || match(f.type) || match(f.biome) || match(f.tagline)
  ).slice(0, 6);

  const species = state.species.filter(s =>
    match(s.commonName) || match(s.scientificName) || match(s.category) || match(s.overview)
  ).slice(0, 6);

  const stories = state.stories.filter(st =>
    match(st.title) || match(st.forest) || match(st.forestName) || match(st.location) || match(st.summary) || match(st.teaser)
  ).slice(0, 4);

  const discoveries = state.discoveries.filter(d =>
    match(d.title) || match(d.region) || match(d.rarityBadge) || match(d.summary) || match(d.excerpt)
  ).slice(0, 4);

  const prehistoric = state.prehistoric.filter(p =>
    match(p.name) || match(p.period) || match(p.era) || match(p.diet) || match(p.significance) || match(p.scare)
  ).slice(0, 4);

  return { forests, species, stories, discoveries, prehistoric };
}

function renderSearchGroup(title, items, type, query) {
  if (!items.length) return '';
  return `
    <div class="search-group">
      <h4>${esc(title)} (${items.length})</h4>
      <div class="search-group-items">
        ${items.map(item => `
          <div class="search-result-row" data-open-${type}="${esc(item.id)}">
            <span class="search-row-title">${highlight(item.name || item.commonName || item.title, query)}</span>
            <span class="search-row-meta">${esc(item.continent || item.scientificName || item.period || item.rarityBadge || '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function highlight(text, query) {
  if (!query || !text) return esc(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return esc(text).replace(regex, '<mark>$1</mark>');
}
