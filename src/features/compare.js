'use strict';

import { state, emit } from '../core/state.js';
import { $, $$, esc, showToast, syncBodyLock } from '../utils/dom.js';
import { formatArea } from '../utils/formatters.js';
import { trapFocus, releaseFocus } from '../utils/a11y.js';

export function initCompare() {
  bindCompareEvents();
  checkCompareUrlParams();
}

export function toggleCompareForest(forestId) {
  const forest = state.forests.find(f => f.id === forestId);
  if (!forest) return;

  const idx = state.compareList.findIndex(f => f.id === forestId);
  if (idx >= 0) {
    state.compareList.splice(idx, 1);
    showToast(`Removed ${forest.name} from comparison.`);
  } else {
    if (state.compareList.length >= 3) {
      showToast('You can compare a maximum of 3 forests at once.', 'warning');
      return;
    }
    state.compareList.push(forest);
    showToast(`Added ${forest.name} to comparison!`);
  }

  updateCompareBadge();
  emit('compare:change', state.compareList);
}

export function openCompareModal() {
  if (state.compareList.length < 2) {
    showToast('Select at least 2 forests to compare.', 'info');
    return;
  }

  let modal = $('#compareModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'compareModal';
    modal.className = 'modal-overlay compare-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Forest Comparison');
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card compare-card">
      <div class="modal-header">
        <div class="compare-title-block">
          <h2>Forest Comparative Matrix</h2>
          <p class="lede">Side-by-side metric analysis of selected forest biomes.</p>
        </div>
        <div class="compare-actions">
          <button class="btn btn-secondary btn-sm" id="shareCompareBtn" type="button">Share Comparison</button>
          <button class="modal-close" id="compareCloseBtn" type="button" aria-label="Close comparison">
            <svg class="icon"><use href="#icon-close"></use></svg>
          </button>
        </div>
      </div>
      <div class="compare-table-container">
        ${renderCompareTable(state.compareList)}
      </div>
    </div>
  `;

  modal.classList.add('is-open');
  syncBodyLock();
  trapFocus(modal, closeCompareModal);

  $('#compareCloseBtn').addEventListener('click', closeCompareModal);
  $('#shareCompareBtn').addEventListener('click', shareCompareLink);
}

export function closeCompareModal() {
  const modal = $('#compareModal');
  if (modal) {
    modal.classList.remove('is-open');
  }
  releaseFocus();
  syncBodyLock();
}

function renderCompareTable(forests) {
  return `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Metric</th>
          ${forests.map(f => `
            <th>
              <div class="compare-forest-head">
                <img src="${esc(f.coverImage)}" alt="${esc(f.name)}" class="compare-forest-thumb">
                <strong>${esc(f.name)}</strong>
                <span class="compare-country">${esc(f.country)}, ${esc(f.continent)}</span>
              </div>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Biome & Type</strong></td>
          ${forests.map(f => `<td>${esc(f.type)} / ${esc(f.biome || 'N/A')}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Surface Area</strong></td>
          ${forests.map(f => `<td><strong>${formatArea(f.areaKm2)}</strong></td>`).join('')}
        </tr>
        <tr>
          <td><strong>Canopy Coverage</strong></td>
          ${forests.map(f => `<td>${esc(f.canopyCoverage || 'N/A')}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Climate</strong></td>
          ${forests.map(f => `<td>${esc(f.climate || 'N/A')}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Established / Status</strong></td>
          ${forests.map(f => `<td>${esc(f.established || 'Protected')}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Key Threats</strong></td>
          ${forests.map(f => `
            <td>
              <ul class="compare-list">
                ${(f.threats || []).map(t => `<li>${esc(t)}</li>`).join('')}
              </ul>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td><strong>Ecological Highlights</strong></td>
          ${forests.map(f => `
            <td>
              <ul class="compare-list">
                ${(f.highlights || []).slice(0, 3).map(h => `<li>${esc(h)}</li>`).join('')}
              </ul>
            </td>
          `).join('')}
        </tr>
      </tbody>
    </table>
  `;
}

function updateCompareBadge() {
  const count = state.compareList.length;
  let pill = $('#compareNavBtn');
  if (!pill) {
    const actions = $('.header-actions');
    if (actions) {
      pill = document.createElement('button');
      pill.id = 'compareNavBtn';
      pill.className = 'btn btn-secondary btn-sm compare-pill';
      pill.style.display = 'none';
      actions.insertBefore(pill, actions.firstChild);
      pill.addEventListener('click', openCompareModal);
    }
  }

  if (pill) {
    if (count >= 2) {
      pill.style.display = 'inline-flex';
      pill.innerHTML = `<svg class="icon"><use href="#icon-compass"></use></svg> Compare (${count})`;
    } else {
      pill.style.display = 'none';
    }
  }
}

function shareCompareLink() {
  const ids = state.compareList.map(f => f.id).join(',');
  const shareUrl = `${window.location.origin}${window.location.pathname}#compare?ids=${ids}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('Comparison link copied to clipboard!');
  }).catch(() => {
    showToast(shareUrl, 'info', 6000);
  });
}

function checkCompareUrlParams() {
  const hash = window.location.hash;
  if (hash.startsWith('#compare?')) {
    const params = new URLSearchParams(hash.slice(9));
    const ids = params.get('ids')?.split(',') || [];
    setTimeout(() => {
      ids.forEach(id => {
        const forest = state.forests.find(f => f.id === id);
        if (forest && !state.compareList.some(f => f.id === id)) {
          state.compareList.push(forest);
        }
      });
      if (state.compareList.length >= 2) {
        updateCompareBadge();
        openCompareModal();
      }
    }, 600);
  }
}

function bindCompareEvents() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-compare-forest]');
    if (btn) {
      e.stopPropagation();
      const forestId = btn.getAttribute('data-compare-forest');
      toggleCompareForest(forestId);
    }
  });
}
