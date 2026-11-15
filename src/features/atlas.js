'use strict';

import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, $$, esc } from '../utils/dom.js';
import { formatArea, formatDate } from '../utils/formatters.js';

export function renderAtlas() {
  renderFeaturedForests();
  populateForestFilters();
  renderForests();
  renderWildlifeCategories();
  renderWildlife();
  renderRareAndDiscoveries();
  renderStories();
  renderPrehistoric();
  bindFilterEvents();
}

function renderFeaturedForests() {
  const container = $('#featuredForests');
  if (!container) return;

  const featured = state.forests.slice(0, 3);
  container.innerHTML = featured.map((forest, index) => {
    const label = index === 0 ? 'Featured primeval canopy' : 'Forest field card';
    const speciesCount = forest.speciesIds?.length || 0;
    return `
      <article class="featured-forest-card" data-open-forest="${esc(forest.id)}" tabindex="0" role="button" aria-label="Open ${esc(forest.name)}">
        <img src="${esc(forest.coverImage)}" alt="${esc(forest.name)}" loading="${index === 0 ? 'eager' : 'lazy'}">
        <div class="featured-shade"></div>
        <div class="featured-content">
          <div class="card-kicker">
            <span>${esc(label)}</span>
            <span>${esc(forest.continent)}</span>
            <span>${esc(forest.type)}</span>
          </div>
          <h3>${esc(forest.name)}</h3>
          <p>${esc(forest.tagline || '')}</p>
          <div class="featured-foot">
            <span>${esc(forest.country)} &bull; ${speciesCount > 0 ? speciesCount + ' species profiles' : formatArea(forest.areaKm2)}</span>
            <button class="save-btn ${isForestSaved(forest.id) ? 'is-saved' : ''}" data-toggle-save="forest" data-id="${esc(forest.id)}" type="button" aria-label="Save ${esc(forest.name)}">
              <svg class="icon"><use href="#icon-bookmark"></use></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function populateForestFilters() {
  const continentFilter = $('#forestContinentFilter') || $('#forestContinentSelect');
  const typeFilter = $('#forestTypeFilter') || $('#forestTypeSelect');
  if (!continentFilter || !typeFilter) return;

  const continents = [...new Set(state.forests.map(f => f.continent).filter(Boolean))].sort();
  const types = [...new Set(state.forests.map(f => f.type).filter(Boolean))].sort();

  continentFilter.innerHTML = '<option value="all">All Continents</option>' +
    continents.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  typeFilter.innerHTML = '<option value="all">All Forest Types</option>' +
    types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
}

export function renderForests() {
  const grid = $('#forestGrid');
  if (!grid) return;

  const filters = state.forestFilters;
  let items = state.forests.filter(f => {
    if (filters.continent !== 'all' && f.continent !== filters.continent) return false;
    if (filters.type !== 'all' && f.type !== filters.type) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const match = f.name.toLowerCase().includes(q) || f.country.toLowerCase().includes(q) || (f.biome && f.biome.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Sorting
  if (filters.sort === 'name') {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (filters.sort === 'area') {
    items.sort((a, b) => (Number(b.areaKm2) || 0) - (Number(a.areaKm2) || 0));
  }

  // Header dynamic stats label
  const countLabel = $('#forestCountLabel');
  if (countLabel && state.forests.length) {
    const continentCount = new Set(state.forests.map(f => f.continent).filter(Boolean)).size;
    countLabel.textContent = `${state.forests.length} forests across ${continentCount} continents`;
  }

  // Results meta and empty state
  const meta = $('#forestResultsMeta');
  if (meta) {
    const isDefault = !filters.q && filters.continent === 'all' && filters.type === 'all';
    meta.textContent = isDefault ? `Showing all ${items.length} forests` : `Showing ${items.length} of ${state.forests.length} forests`;
  }
  const empty = $('#forestEmptyState');
  if (empty) {
    empty.hidden = items.length > 0;
  }

  // Pagination
  const pageSize = CONFIG.PAGE_SIZE.forests;
  const page = state.pagers.forests || 1;
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

  grid.innerHTML = pagedItems.map(f => {
    const saved = isForestSaved(f.id);
    return `
      <article class="forest-card" data-open-forest="${esc(f.id)}" tabindex="0" role="button" aria-label="Open ${esc(f.name)} field card">
        <div class="forest-card-media">
          <img src="${esc(f.coverImage)}" alt="${esc(f.name)}" loading="lazy">
          <span class="type-tag">${esc(f.type)}</span>
          <button class="save-btn ${saved ? 'is-saved' : ''}" data-toggle-save="forest" data-id="${esc(f.id)}" type="button" aria-label="Save ${esc(f.name)}">
            <svg class="icon"><use href="#icon-bookmark"></use></svg>
          </button>
        </div>
        <div class="forest-card-body">
          <div class="card-meta">
            <span class="region-tag">${esc(f.continent)}</span>
            <span>${esc(f.country)}</span>
          </div>
          <h3>${esc(f.name)}</h3>
          <p class="forest-tagline">${esc(f.tagline || f.shortStory?.slice(0, 110) + '...')}</p>
          <div class="forest-card-foot">
            <span>${esc(f.canopyCoverage || '65%')} canopy</span>
            <span class="card-link">Open field card <svg class="icon"><use href="#icon-arrow"></use></svg></span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  renderPager('forestPager', page, totalPages, 'forests');
}

function renderWildlifeCategories() {
  const container = $('#wildlifeCategories');
  if (!container) return;
  const categories = ['All', ...new Set(state.species.map(s => s.category).filter(Boolean))];
  container.innerHTML = categories.map(cat => `
    <button class="filter-chip ${state.wildlifeFilters.category === cat ? 'is-active' : ''}" data-wildlife-cat="${esc(cat)}" type="button">${esc(cat)}</button>
  `).join('');
}

export function renderWildlife() {
  const grid = $('#speciesGrid') || $('#wildlifeGrid');
  if (!grid) return;

  const filters = state.wildlifeFilters;
  let items = state.species.filter(s => {
    if (filters.category !== 'All' && s.category !== filters.category) return false;
    if (filters.status !== 'all' && s.status !== filters.status && s.conservationStatus !== filters.status) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const match = String(s.commonName || '').toLowerCase().includes(q) || String(s.scientificName || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Results meta and empty state
  const meta = $('#wildlifeResultsMeta');
  if (meta) {
    const isDefault = !filters.q && filters.category === 'All' && filters.status === 'all';
    meta.textContent = isDefault ? `Showing all ${items.length} species` : `Showing ${items.length} of ${state.species.length} species`;
  }
  const empty = $('#speciesEmptyState') || $('#wildlifeEmptyState');
  if (empty) {
    empty.hidden = items.length > 0;
  }

  const pageSize = CONFIG.PAGE_SIZE.wildlife;
  const page = state.pagers.wildlife || 1;
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

  grid.innerHTML = pagedItems.map(s => {
    const status = s.status || s.conservationStatus || 'LC';
    const statusClass = status.toLowerCase();
    const isSaved = isSpeciesSaved(s.id);
    return `
      <article class="species-card" data-open-species="${esc(s.id)}" tabindex="0" role="button" aria-label="Open ${esc(s.commonName)} profile">
        <div class="species-media">
          <img src="${esc(s.coverImage || s.image || './images/species/okapi.jpg')}" alt="${esc(s.commonName)}" loading="lazy">
          <span class="status-badge status-${esc(statusClass)}">${esc(status)}</span>
          <button class="save-btn ${isSaved ? 'is-saved' : ''}" data-toggle-save="species" data-id="${esc(s.id)}" type="button" aria-label="Save ${esc(s.commonName)}">
            <svg class="icon"><use href="#icon-bookmark"></use></svg>
          </button>
        </div>
        <div class="species-body">
          <div class="card-kicker">
            <span>${esc(s.category || 'Wildlife')}</span>
            <span class="species-italic">${esc(s.scientificName)}</span>
          </div>
          <h3>${esc(s.commonName)}</h3>
          <p>${esc(s.overview?.slice(0, 110) || s.description?.slice(0, 110) || '')}...</p>
          <div class="species-card-foot">
            <span>Habitat: ${esc(s.biome || 'Primary forest')}</span>
            <span class="card-link">Profile <svg class="icon"><use href="#icon-arrow"></use></svg></span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  renderPager('wildlifePager', page, totalPages, 'wildlife');
}

export function renderRareAndDiscoveries() {
  const rareGrid = $('#rareSpeciesGrid');
  const rareCount = $('#rareSpeciesCount');
  const discoveriesContainer = $('#discoveriesList') || $('#discoveriesGrid');

  // Render Living Rarities grid
  const priority = { CR: 0, EN: 1, VU: 2, EX: 3, NT: 4, LC: 5, NE: 6 };
  const rare = state.species
    .filter(s => s.rare || ['CR', 'EN', 'VU'].includes(s.conservationStatus || s.status))
    .sort((a, b) => (priority[a.conservationStatus || a.status] ?? 9) - (priority[b.conservationStatus || b.status] ?? 9) || a.commonName.localeCompare(b.commonName));

  if (rareCount) {
    rareCount.textContent = `${rare.length} species`;
  }

  if (rareGrid) {
    const pageSize = CONFIG.PAGE_SIZE.rare || 8;
    const page = state.pagers.rare || 1;
    const totalPages = Math.ceil(rare.length / pageSize) || 1;
    const pagedItems = rare.slice((page - 1) * pageSize, page * pageSize);

    rareGrid.innerHTML = pagedItems.map(s => {
      const status = s.conservationStatus || s.status || 'VU';
      const statusClass = status.toLowerCase();
      return `
        <article class="rare-species-card" data-open-species="${esc(s.id)}" tabindex="0" role="button" aria-label="Open ${esc(s.commonName)} profile">
          <img src="${esc(s.coverImage || s.image || './images/species/okapi.jpg')}" alt="${esc(s.commonName)}" loading="lazy">
          <div class="rare-species-copy">
            <span class="status-badge status-${esc(statusClass)}">${esc(status)}</span>
            <h4>${esc(s.commonName)}</h4>
            <p>${esc(s.scientificName)}</p>
          </div>
        </article>
      `;
    }).join('');

    renderPager('rarePager', page, totalPages, 'rare');
  }

  // Render Field Discoveries
  if (discoveriesContainer) {
    discoveriesContainer.innerHTML = state.discoveries.map(d => `
      <article class="discovery-item" data-open-discovery="${esc(d.id)}" tabindex="0" role="button" aria-label="Open field note: ${esc(d.title)}">
        <div class="discovery-thumb">
          <img src="${esc(d.coverImage || d.image || './images/cheonggyecheon/1_morning_mist.jpg')}" alt="${esc(d.title)}" loading="lazy">
        </div>
        <div class="discovery-copy">
          <div class="card-kicker">
            <span>${esc(d.region || d.rarityBadge || 'Field Discovery')}</span>
            <span class="verified-mini ${d.verified ? '' : 'pending'}">${d.verified ? 'Reviewed' : 'Field Note'}</span>
          </div>
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.summary || d.excerpt || '')}</p>
          ${d.author ? `<footer style="margin-top:0.4rem;font-size:0.75rem;color:var(--faint);"><span>${esc(d.author)}</span> ${d.date ? `&bull; <time datetime="${esc(d.date)}">${esc(formatDate(d.date))}</time>` : ''}</footer>` : ''}
        </div>
      </article>
    `).join('');
  }
}

export function renderStories() {
  const feature = $('#storiesFeature');
  const grid = $('#storiesGrid');
  if (!grid) return;

  const stories = [...state.stories].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const lead = stories[0];
  const rest = stories.slice(1);

  if (feature && lead) {
    feature.innerHTML = `
      <article class="story-feature" data-open-story="${esc(lead.id)}" tabindex="0" role="button" aria-label="Read ${esc(lead.title)}">
        <div class="story-feature-media">
          <img src="${esc(lead.coverImage || lead.image || './images/bialowieza/01_ancient_oak.jpg')}" alt="${esc(lead.title)}" loading="lazy">
          <span class="type-tag">${esc(lead.category || 'Featured Story')}</span>
        </div>
        <div class="story-feature-copy">
          <span class="eyebrow">${lead.verified ? 'Verified forest story' : 'Legend and memory'}</span>
          <h3>${esc(lead.title)}</h3>
          <p class="story-quote">“${esc(lead.quote || lead.teaser || lead.summary || '')}”</p>
          <p>${esc(lead.teaser || lead.summary || '')}</p>
          <div class="story-meta">
            <span>${esc(lead.forestName || lead.location || '')}</span>
            ${lead.date ? `<span>${esc(formatDate(lead.date))}</span>` : ''}
            <span>${esc(lead.origin || 'Field narrative')}</span>
          </div>
          <span class="card-link">Read the story <svg class="icon"><use href="#icon-arrow"></use></svg></span>
        </div>
      </article>
    `;
  }

  const pageSize = CONFIG.PAGE_SIZE.stories || 4;
  const page = state.pagers.stories || 1;
  const totalPages = Math.ceil(rest.length / pageSize) || 1;
  const pagedItems = rest.slice((page - 1) * pageSize, page * pageSize);

  grid.innerHTML = pagedItems.map(st => `
    <article class="story-card" data-open-story="${esc(st.id)}" tabindex="0" role="button" aria-label="Read ${esc(st.title)}">
      <div class="story-media">
        <img src="${esc(st.coverImage || st.image || './images/bialowieza/01_ancient_oak.jpg')}" alt="${esc(st.title)}" loading="lazy">
        <span class="type-tag">${esc(st.category || 'Lore')}</span>
      </div>
      <div class="story-card-body">
        <div class="card-kicker">
          <span>${esc(st.forestName || st.location || 'Lore')}</span>
          <span class="verified-mini ${st.verified ? '' : 'pending'}">${st.verified ? 'Verified Narrative' : 'Folklore & Legend'}</span>
        </div>
        <h3>${esc(st.title)}</h3>
        <p>${esc(st.teaser || st.summary || st.content?.slice(0, 140) + '...')}</p>
        <div class="story-foot">
          <span>Read story <svg class="icon"><use href="#icon-arrow"></use></svg></span>
        </div>
      </div>
    </article>
  `).join('');

  renderPager('storiesPager', page, totalPages, 'stories');
}

export function renderPrehistoric() {
  const grid = $('#prehistoricGrid');
  const afterDarkGrid = $('#afterDarkGrid');
  if (!grid) return;

  const prehistoric = state.prehistoric.filter(item => item.category === 'prehistoric');
  const afterDark = state.prehistoric.filter(item => item.category === 'afterdark');

  const pageSize = CONFIG.PAGE_SIZE.prehistoric || 6;
  const page = state.pagers.prehistoric || 1;
  const totalPages = Math.ceil(prehistoric.length / pageSize) || 1;
  const pagedItems = prehistoric.slice((page - 1) * pageSize, page * pageSize);

  grid.innerHTML = pagedItems.map(p => `
    <article class="prehistoric-card" data-open-prehistoric="${esc(p.id)}" tabindex="0" role="button" aria-label="Open ${esc(p.name)} deep-time card">
      <div class="prehistoric-media">
        <div class="deep-time-placeholder"><span>${esc(p.name?.slice(0, 2) || 'DT')}</span></div>
        <span class="deep-time-tag">${esc(p.era || p.period || 'Prehistoric')}</span>
        <span class="deep-time-age">${esc(p.age || p.diet || '')}</span>
      </div>
      <div class="prehistoric-copy">
        <h3>${esc(p.name)}</h3>
        <span class="scientific-name">${esc(p.scientificName || '')}</span>
        <p>${esc(p.scare || p.significance || '')}</p>
        <span class="card-link">Open deep-time card <svg class="icon"><use href="#icon-arrow"></use></svg></span>
      </div>
    </article>
  `).join('');

  renderPager('prehistoricPager', page, totalPages, 'prehistoric');

  if (afterDarkGrid) {
    afterDarkGrid.innerHTML = afterDark.map(item => `
      <article class="after-dark-card" data-open-prehistoric="${esc(item.id)}" tabindex="0" role="button" aria-label="Open ${esc(item.name)} after-dark card">
        <div class="after-dark-media">
          <div class="deep-time-placeholder"><svg class="icon"><use href="#icon-paw"></use></svg><span>${esc(item.era || 'Night')}</span></div>
          <span class="after-dark-glow" aria-hidden="true"></span>
        </div>
        <div class="after-dark-copy">
          <strong>${esc(item.name)}</strong>
          <span>${esc(item.scare || item.description || '')}</span>
        </div>
      </article>
    `).join('');
  }

  const count = $('#prehistoricCount');
  if (count) count.textContent = `${prehistoric.length} species`;

  const label = $('#prehistoricCountLabel');
  if (label) {
    label.textContent = `${prehistoric.length} deep-time species · ${afterDark.length} after-dark encounters`;
  }
}

function renderPager(containerId, current, total, type) {
  const container = $(`#${containerId}`);
  if (!container) return;

  if (total <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="pager-row">
      <button class="pager-btn" ${current <= 1 ? 'disabled' : ''} data-page-nav="${type}:prev">&larr; Prev</button>
      <span class="pager-info">Page ${current} of ${total}</span>
      <button class="pager-btn" ${current >= total ? 'disabled' : ''} data-page-nav="${type}:next">Next &rarr;</button>
    </div>
  `;
}

function isForestSaved(id) {
  return (state.userData.saved?.forest || []).includes(id);
}

function isSpeciesSaved(id) {
  return (state.userData.saved?.species || []).includes(id);
}

function bindFilterEvents() {
  // Forest search input
  $('#forestSearchInput')?.addEventListener('input', e => {
    state.forestFilters.q = e.target.value.trim();
    state.pagers.forests = 1;
    renderForests();
  });

  // Reset forest filters
  $('#clearForestFilters')?.addEventListener('click', () => {
    state.forestFilters = { q: '', continent: 'all', type: 'all', sort: 'featured' };
    state.pagers.forests = 1;
    const searchInput = $('#forestSearchInput');
    if (searchInput) searchInput.value = '';
    const contFilter = $('#forestContinentFilter') || $('#forestContinentSelect');
    if (contFilter) contFilter.value = 'all';
    const typeFilter = $('#forestTypeFilter') || $('#forestTypeSelect');
    if (typeFilter) typeFilter.value = 'all';
    const sortFilter = $('#forestSortSelect');
    if (sortFilter) sortFilter.value = 'featured';
    renderForests();
  });

  // Wildlife search input
  $('#wildlifeSearchInput')?.addEventListener('input', e => {
    state.wildlifeFilters.q = e.target.value.trim();
    state.pagers.wildlife = 1;
    renderWildlife();
  });

  // Reset wildlife filters
  $('#clearWildlifeFilters')?.addEventListener('click', () => {
    state.wildlifeFilters = { q: '', category: 'All', status: 'all' };
    state.pagers.wildlife = 1;
    const searchInput = $('#wildlifeSearchInput');
    if (searchInput) searchInput.value = '';
    const statusFilter = $('#wildlifeStatusFilter');
    if (statusFilter) statusFilter.value = 'all';
    $$('#wildlifeCategories .filter-chip').forEach(c => {
      c.classList.toggle('is-active', c.getAttribute('data-wildlife-cat') === 'All');
    });
    renderWildlife();
  });

  const continentFilter = $('#forestContinentFilter') || $('#forestContinentSelect');
  continentFilter?.addEventListener('change', e => {
    state.forestFilters.continent = e.target.value;
    state.pagers.forests = 1;
    renderForests();
  });

  const typeFilter = $('#forestTypeFilter') || $('#forestTypeSelect');
  typeFilter?.addEventListener('change', e => {
    state.forestFilters.type = e.target.value;
    state.pagers.forests = 1;
    renderForests();
  });

  const sortFilter = $('#forestSortSelect');
  sortFilter?.addEventListener('change', e => {
    state.forestFilters.sort = e.target.value;
    state.pagers.forests = 1;
    renderForests();
  });

  const statusFilter = $('#wildlifeStatusFilter');
  statusFilter?.addEventListener('change', e => {
    state.wildlifeFilters.status = e.target.value;
    state.pagers.wildlife = 1;
    renderWildlife();
  });

  $('#wildlifeCategories')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-wildlife-cat]');
    if (chip) {
      state.wildlifeFilters.category = chip.getAttribute('data-wildlife-cat');
      state.pagers.wildlife = 1;
      $$('#wildlifeCategories .filter-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      renderWildlife();
    }
  });

  document.addEventListener('click', e => {
    const pagerBtn = e.target.closest('[data-page-nav]');
    if (pagerBtn) {
      const [type, action] = pagerBtn.getAttribute('data-page-nav').split(':');
      if (action === 'prev') {
        state.pagers[type] = Math.max(1, (state.pagers[type] || 1) - 1);
      } else {
        state.pagers[type] = (state.pagers[type] || 1) + 1;
      }
      if (type === 'forests') renderForests();
      if (type === 'wildlife') renderWildlife();
      if (type === 'rare') renderRareAndDiscoveries();
      if (type === 'stories') renderStories();
      if (type === 'prehistoric') renderPrehistoric();
    }
  });
}
