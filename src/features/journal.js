'use strict';

import { state, emit } from '../core/state.js';
import { $, $$, esc, showToast, syncBodyLock } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { trapFocus, releaseFocus } from '../utils/a11y.js';
import { api } from '../services/api.js';

export function initJournal() {
  bindJournalEvents();
}

export function openDashboard() {
  const drawer = $('#dashboardDrawer');
  const overlay = $('#drawerOverlay');
  if (!drawer) return;

  renderDashboard();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  if (overlay) {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  syncBodyLock();
  trapFocus(drawer, closeDashboard);
}

export function closeDashboard() {
  const drawer = $('#dashboardDrawer');
  const overlay = $('#drawerOverlay');
  if (drawer) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  releaseFocus();
  syncBodyLock();
}

export function openAdmin() {
  const drawer = $('#adminDrawer');
  const overlay = $('#drawerOverlay');
  if (!drawer) return;

  renderAdmin();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  if (overlay) {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  syncBodyLock();
  trapFocus(drawer, closeAdmin);
}

export function closeAdmin() {
  const drawer = $('#adminDrawer');
  const overlay = $('#drawerOverlay');
  if (drawer) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  releaseFocus();
  syncBodyLock();
}

export function closeAllDrawers() {
  $$('.side-drawer').forEach(d => {
    d.classList.remove('is-open');
    d.setAttribute('aria-hidden', 'true');
  });
  const overlay = $('#drawerOverlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  releaseFocus();
  syncBodyLock();
}

export function renderAdmin() {
  const body = $('#adminBody');
  if (!body) return;

  const saved = state.userData.saved || {};
  const savedTotal = (saved.forest?.length || 0) + (saved.species?.length || 0) + (saved.story?.length || 0) + (saved.discovery?.length || 0);

  body.innerHTML = `
    <div class="admin-note" style="padding:1rem;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:1.5rem;font-size:0.9rem;line-height:1.5;color:var(--faint);">
      Administrator console for Forest Explorer. Manage atlas records and view local session analytics.
    </div>
    <div class="admin-stats" style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.75rem;margin-bottom:1.5rem;">
      <div class="stat-badge" style="background:rgba(255,255,255,0.04);padding:0.75rem;border-radius:8px;text-align:center;">
        <span class="stat-num" style="display:block;font-size:1.5rem;font-weight:700;color:var(--text);">${state.forests.length}</span>
        <span class="stat-lbl" style="font-size:0.75rem;color:var(--faint);text-transform:uppercase;">Forests</span>
      </div>
      <div class="stat-badge" style="background:rgba(255,255,255,0.04);padding:0.75rem;border-radius:8px;text-align:center;">
        <span class="stat-num" style="display:block;font-size:1.5rem;font-weight:700;color:var(--text);">${state.species.length}</span>
        <span class="stat-lbl" style="font-size:0.75rem;color:var(--faint);text-transform:uppercase;">Species</span>
      </div>
      <div class="stat-badge" style="background:rgba(255,255,255,0.04);padding:0.75rem;border-radius:8px;text-align:center;">
        <span class="stat-num" style="display:block;font-size:1.5rem;font-weight:700;color:var(--text);">${state.stories.length}</span>
        <span class="stat-lbl" style="font-size:0.75rem;color:var(--faint);text-transform:uppercase;">Stories</span>
      </div>
      <div class="stat-badge" style="background:rgba(255,255,255,0.04);padding:0.75rem;border-radius:8px;text-align:center;">
        <span class="stat-num" style="display:block;font-size:1.5rem;font-weight:700;color:var(--text);">${state.prehistoric.length}</span>
        <span class="stat-lbl" style="font-size:0.75rem;color:var(--faint);text-transform:uppercase;">Deep Time</span>
      </div>
    </div>
    <div class="drawer-section">
      <h3>Active Session</h3>
      <p style="margin-top:0.5rem;font-size:0.9rem;"><strong>User:</strong> ${esc(state.session?.user?.name || state.session?.user?.email || 'Demonstration Explorer')}</p>
      <p style="font-size:0.85rem;color:var(--faint);">Saved items: ${savedTotal} &bull; Notes: ${(state.userData.notes || []).length}</p>
    </div>
    <div class="drawer-section" style="margin-top:1.5rem;">
      <h3>Administrative Actions</h3>
      <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:0.75rem;">
        <button class="btn btn-secondary btn-sm" id="adminExportDataBtn" type="button">Export Atlas Summary</button>
        <button class="btn btn-glass btn-sm" id="adminClearSavedBtn" type="button">Reset Saved Bookmarks</button>
      </div>
    </div>
  `;

  $('#adminExportDataBtn')?.addEventListener('click', () => {
    const summary = {
      exportedAt: new Date().toISOString(),
      user: state.session?.user || 'Guest Explorer',
      counts: {
        forests: state.forests.length,
        species: state.species.length,
        stories: state.stories.length,
        discoveries: state.discoveries.length,
        prehistoric: state.prehistoric.length
      }
    };
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forest-explorer-admin-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Admin summary exported.');
  });

  $('#adminClearSavedBtn')?.addEventListener('click', () => {
    if (confirm('Clear saved bookmarks for this session?')) {
      state.userData.saved = { forest: [], species: [], story: [], discovery: [], prehistoric: [] };
      showToast('Bookmarks reset.');
      renderAdmin();
      renderDashboard();
    }
  });
}

export function renderDashboard() {
  const body = $('#dashboardBody');
  if (!body) return;

  const saved = state.userData.saved;
  const notes = state.userData.notes || [];
  const progress = state.userData.progress || {};

  const totalSaved = (saved.forest?.length || 0) + (saved.species?.length || 0) + (saved.story?.length || 0);

  body.innerHTML = `
    <div class="dashboard-header-stats">
      <div class="stat-badge">
        <span class="stat-num">${totalSaved}</span>
        <span class="stat-lbl">Saved Items</span>
      </div>
      <div class="stat-badge">
        <span class="stat-num">${notes.length}</span>
        <span class="stat-lbl">Field Notes</span>
      </div>
      <div class="stat-badge">
        <span class="stat-num">${(progress.badges || []).length}</span>
        <span class="stat-lbl">Badges</span>
      </div>
    </div>

    <div class="journal-export-row">
      <button class="btn btn-secondary btn-sm" id="exportJsonBtn" type="button">
        <svg class="icon"><use href="#icon-bookmark"></use></svg> Export JSON
      </button>
      <button class="btn btn-primary btn-sm" id="exportPdfBtn" type="button">
        <svg class="icon"><use href="#icon-book"></use></svg> Print / Save PDF
      </button>
    </div>

    <div class="drawer-section">
      <div class="section-head-split">
        <h3>Field Notes & Observations</h3>
        <button class="btn btn-secondary btn-xs" id="addNewNoteBtn" type="button">+ New Note</button>
      </div>
      <div class="notes-list" id="notesListContainer">
        ${renderNotesList(notes)}
      </div>
    </div>

    <div class="drawer-section">
      <h3>Saved Forests (${saved.forest?.length || 0})</h3>
      <div class="saved-item-cards">
        ${(saved.forest || []).map(id => {
          const forest = state.forests.find(f => f.id === id);
          if (!forest) return '';
          return `
            <div class="saved-item-mini" data-open-forest="${esc(forest.id)}">
              <img src="${esc(forest.coverImage)}" alt="" class="mini-thumb">
              <div class="mini-copy">
                <strong>${esc(forest.name)}</strong>
                <span>${esc(forest.continent)}</span>
              </div>
            </div>
          `;
        }).join('') || '<p class="faint">No saved forests yet.</p>'}
      </div>
    </div>

    <div class="drawer-section">
      <h3>Saved Species (${saved.species?.length || 0})</h3>
      <div class="saved-item-cards">
        ${(saved.species || []).map(id => {
          const sp = state.species.find(s => s.id === id);
          if (!sp) return '';
          return `
            <div class="saved-item-mini" data-open-species="${esc(sp.id)}">
              <img src="${esc(sp.coverImage || './images/species/okapi.jpg')}" alt="" class="mini-thumb">
              <div class="mini-copy">
                <strong>${esc(sp.commonName)}</strong>
                <span class="species-italic">${esc(sp.scientificName)}</span>
              </div>
            </div>
          `;
        }).join('') || '<p class="faint">No saved species yet.</p>'}
      </div>
    </div>
  `;

  $('#exportJsonBtn')?.addEventListener('click', exportJournalJson);
  $('#exportPdfBtn')?.addEventListener('click', exportJournalPdf);
  $('#addNewNoteBtn')?.addEventListener('click', promptNewNote);
}

function renderNotesList(notes) {
  if (!notes || !notes.length) {
    return '<p class="faint">No field observations recorded yet. Click "+ New Note" to write one!</p>';
  }

  return notes.map(note => `
    <article class="note-card" data-note-id="${esc(note.id)}">
      <div class="note-card-head">
        <h4>${esc(note.title)}</h4>
        <span class="note-date">${formatDate(note.created_at || note.createdAt)}</span>
      </div>
      <p class="note-content">${esc(note.content)}</p>
      ${note.tags ? `<div class="note-tags">${note.tags.split(',').map(t => `<span class="tag-pill">${esc(t.trim())}</span>`).join('')}</div>` : ''}
      <div class="note-actions">
        <button class="link-btn text-danger btn-xs delete-note-btn" data-delete-note="${esc(note.id)}" type="button">Delete</button>
      </div>
    </article>
  `).join('');
}

export function exportJournalJson() {
  const exportData = {
    exportedAt: new Date().toISOString(),
    account: state.session?.email || 'Guest Explorer',
    saved: state.userData.saved,
    notes: state.userData.notes,
    progress: state.userData.progress
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forest-explorer-journal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Journal exported to JSON!');
}

export function exportJournalPdf() {
  // Publication-grade printable format using window.print()
  window.print();
}

async function promptNewNote() {
  const title = prompt('Enter observation title:');
  if (!title) return;
  const content = prompt('Enter notes or observations:');
  if (!content) return;
  const tags = prompt('Enter tags (comma separated, e.g. wildlife, rain):') || '';

  try {
    const newNote = {
      targetType: 'general',
      targetId: 'field',
      title,
      content,
      tags
    };

    if (state.session?.token) {
      const created = await api.createNote(newNote);
      state.userData.notes.unshift(created);
    } else {
      // Offline / guest mode
      newNote.id = 'note_' + Date.now();
      newNote.createdAt = new Date().toISOString();
      state.userData.notes.unshift(newNote);
    }

    renderDashboard();
    showToast('Field note saved!');
  } catch (err) {
    showToast('Could not save note: ' + err.message, 'error');
  }
}

function bindJournalEvents() {
  document.addEventListener('click', async e => {
    // Close drawers via [data-close-drawer]
    const closeDrawerBtn = e.target.closest('[data-close-drawer]');
    if (closeDrawerBtn) {
      e.preventDefault();
      const target = closeDrawerBtn.getAttribute('data-close-drawer');
      if (target === 'adminDrawer') {
        closeAdmin();
      } else {
        closeDashboard();
      }
      return;
    }

    // Close drawers via drawerOverlay click
    if (e.target.id === 'drawerOverlay' || e.target.closest('#drawerOverlay')) {
      e.preventDefault();
      closeAllDrawers();
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-note]');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-delete-note');
      if (confirm('Delete this observation?')) {
        try {
          if (state.session?.token) {
            await api.deleteNote(id);
          }
          state.userData.notes = state.userData.notes.filter(n => n.id !== id);
          renderDashboard();
          showToast('Note deleted.');
        } catch (err) {
          showToast('Failed to delete note: ' + err.message, 'error');
        }
      }
    }
  });
}
