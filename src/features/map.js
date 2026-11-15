'use strict';

import { state, emit } from '../core/state.js';
import { $, $$, esc, showToast } from '../utils/dom.js';
import { haversineDistance } from '../utils/formatters.js';

export function initForestMap() {
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
      maxZoom: 10,
      scrollWheelZoom: true
    }).setView([18, 12], 2);

    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    window.L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    // Marker cluster group or fast layer group
    state.markerLayer = window.L.layerGroup().addTo(state.map);

    renderMapContinents();
    renderMapSpeciesFilter();
    renderMapMarkers(true);
    bindMapControls();

    state.map.on('click', () => {
      state.map.closePopup();
    });

    setTimeout(() => state.map?.invalidateSize(), 400);
  } catch (error) {
    console.warn('Leaflet map initialization failed.', error);
    showMapFallback();
  }
}

function renderMapContinents() {
  const container = $('#mapContinents');
  if (!container) return;
  const continents = [...new Set(state.forests.map(forest => forest.continent).filter(Boolean))].sort();
  container.innerHTML = `
    <button class="map-continent ${state.mapContinent === 'all' ? 'is-active' : ''}" type="button" data-map-continent="all">All</button>
    ${continents.map(c => `
      <button class="map-continent ${state.mapContinent === c ? 'is-active' : ''}" type="button" data-map-continent="${esc(c)}">${esc(c)}</button>
    `).join('')}
  `;
}

function renderMapSpeciesFilter() {
  const select = $('#mapSpeciesSelect');
  if (!select) return;

  const keySpecies = state.species.slice(0, 15);
  select.innerHTML = `
    <option value="all">All Species Habitats</option>
    ${keySpecies.map(sp => `
      <option value="${esc(sp.id)}">${esc(sp.commonName)} (${esc(sp.status || 'LC')})</option>
    `).join('')}
  `;
}

export function renderMapMarkers(fit = false) {
  if (!state.map || !state.markerLayer) return;

  const continent = state.mapContinent;
  const speciesFilter = state.mapSpeciesFilter;

  const forests = state.forests.filter(forest => {
    const coords = forest.coordinates;
    if (!coords || !Number.isFinite(Number(coords.lat)) || !Number.isFinite(Number(coords.lng))) return false;
    if (continent !== 'all' && forest.continent !== continent) return false;
    if (speciesFilter !== 'all') {
      const matchSpecies = state.species.find(s => s.id === speciesFilter);
      if (matchSpecies && matchSpecies.forestId && matchSpecies.forestId !== forest.id) {
        return false;
      }
    }
    return true;
  });

  state.markerLayer.clearLayers();
  state.markers.clear();

  // Fast grid-based clustering or individual pins
  forests.forEach(forest => {
    const icon = window.L.divIcon({
      className: '',
      html: `<div class="map-marker ${mapsTypeClass(forest.type)}" aria-label="${esc(forest.name)}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = window.L.marker([Number(forest.coordinates.lat), Number(forest.coordinates.lng)], {
      icon,
      title: forest.name
    });

    marker.on('click', () => selectMapForest(forest.id, true));
    marker.addTo(state.markerLayer);
    state.markers.set(forest.id, marker);
  });

  const count = $('#mapCount');
  if (count) {
    count.textContent = `${forests.length} mapped ${forests.length === 1 ? 'forest' : 'forests'}`;
  }

  $$('.map-continent').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-map-continent') === continent);
  });

  if (!forests.some(f => f.id === state.activeMapForest)) {
    state.activeMapForest = forests[0]?.id || null;
  }

  if (state.activeMapForest) {
    setMapInfo(state.forests.find(f => f.id === state.activeMapForest));
    markActiveMapMarker();
  }

  if (fit && forests.length) {
    const bounds = window.L.latLngBounds(forests.map(f => [Number(f.coordinates.lat), Number(f.coordinates.lng)]));
    state.map.fitBounds(bounds.pad(0.2), { maxZoom: continent === 'all' ? 3 : 5 });
  }
}

export function selectMapForest(id, pan = false) {
  const forest = state.forests.find(f => f.id === id);
  if (!forest || !state.map) return;

  state.activeMapForest = id;
  setMapInfo(forest);
  markActiveMapMarker();

  if (pan && forest.coordinates) {
    state.map.panTo([Number(forest.coordinates.lat), Number(forest.coordinates.lng)], { animate: true, duration: 0.6 });
  }
}

function markActiveMapMarker() {
  state.markers.forEach((marker, id) => {
    const el = marker.getElement();
    const pin = el?.querySelector('.map-marker');
    if (pin) pin.classList.toggle('is-active', id === state.activeMapForest);
  });
}

function setMapInfo(forest) {
  const info = $('#mapInfo');
  if (!info || !forest) return;

  info.innerHTML = `
    <div class="map-info-inner">
      <img src="${esc(forest.coverImage)}" alt="${esc(forest.name)}" class="map-info-img">
      <div class="map-info-copy">
        <span class="map-info-kicker">${esc(forest.continent)} &bull; ${esc(forest.type)}</span>
        <h3>${esc(forest.name)}</h3>
        <p>${esc(forest.tagline || forest.shortStory?.slice(0, 140) + '...')}</p>
        <div class="map-info-actions">
          <button class="btn btn-primary btn-sm" type="button" data-open-forest="${esc(forest.id)}">Explore Field Card</button>
          <button class="btn btn-secondary btn-sm" type="button" data-compare-forest="${esc(forest.id)}">Add to Compare</button>
        </div>
      </div>
    </div>
  `;
}

function mapsTypeClass(type) {
  if (type === 'Mangrove' || type === 'Riparian') return 'wetland';
  if (type === 'Tropical' || type === 'Cloud') return 'tropical';
  if (type === 'Boreal') return 'boreal';
  return 'temperate';
}

export function locateUserAndFindNearestForest() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'warning');
    return;
  }

  showToast('Locating your position...', 'info');

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    state.userLocation = { lat: userLat, lng: userLng };

    // Find nearest forest
    let nearest = null;
    let minDistance = Infinity;

    state.forests.forEach(f => {
      if (f.coordinates?.lat && f.coordinates?.lng) {
        const d = haversineDistance(userLat, userLng, Number(f.coordinates.lat), Number(f.coordinates.lng));
        if (d < minDistance) {
          minDistance = d;
          nearest = f;
        }
      }
    });

    if (nearest) {
      showToast(`Nearest forest: ${nearest.name} (${Math.round(minDistance).toLocaleString()} km away)!`);
      selectMapForest(nearest.id, true);
      state.map.setView([nearest.coordinates.lat, nearest.coordinates.lng], 6, { animate: true });
    }
  }, err => {
    showToast('Unable to retrieve location: ' + err.message, 'error');
  });
}

function bindMapControls() {
  $('#locateMeBtn')?.addEventListener('click', locateUserAndFindNearestForest);

  $('#mapContinents')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-map-continent]');
    if (btn) {
      state.mapContinent = btn.getAttribute('data-map-continent');
      renderMapMarkers(true);
    }
  });

  $('#mapSpeciesSelect')?.addEventListener('change', e => {
    state.mapSpeciesFilter = e.target.value;
    renderMapMarkers(false);
  });
}

function showMapFallback() {
  const mapElement = $('#forestMap');
  if (!mapElement) return;
  mapElement.innerHTML = `
    <div class="map-fallback-box">
      <h3>Interactive Map Offline</h3>
      <p>Could not load Leaflet map tiles. Select a forest from the list below:</p>
      <div class="fallback-list">
        ${state.forests.slice(0, 12).map(f => `
          <button class="fallback-item" data-open-forest="${esc(f.id)}">${esc(f.name)} (${esc(f.continent)})</button>
        `).join('')}
      </div>
    </div>
  `;
}
