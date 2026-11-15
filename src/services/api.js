'use strict';

import { state, emit } from '../core/state.js';
import { CONFIG } from '../core/config.js';

function getAuthHeader() {
  const token = state.session?.token || localStorage.getItem(CONFIG.STORAGE.session);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    // If network error, flag offline
    if (!navigator.onLine || err.name === 'TypeError') {
      state.offlineMode = true;
      emit('network:offline');
    }
    throw err;
  }
}

export const api = {
  // Atlas data loader
  async loadAtlasData() {
    const files = [
      ['forests', './data/forests.json'],
      ['species', './data/species.json'],
      ['stories', './data/stories.json'],
      ['discoveries', './data/discoveries.json'],
      ['prehistoric', './data/prehistoric.json']
    ];

    const results = await Promise.all(files.map(async ([key, path]) => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Cache in localStorage for offline field mode
        try {
          localStorage.setItem(`fe.cache.${key}`, JSON.stringify(data));
        } catch (_) {}
        return [key, data];
      } catch (err) {
        console.warn(`Falling back to offline cache for ${key}`, err);
        const cached = localStorage.getItem(`fe.cache.${key}`);
        if (cached) {
          return [key, JSON.parse(cached)];
        }
        throw err;
      }
    }));

    results.forEach(([key, data]) => {
      state[key] = data;
    });
  },

  // Auth & Account
  async register(email, password, name) {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    return res;
  },

  async login(email, password) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    return res;
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (_) {}
  },

  async getMe() {
    return await request('/auth/me');
  },

  // Saved items & Notes
  async saveItem(itemType, itemId) {
    return await request('/user/save', {
      method: 'POST',
      body: JSON.stringify({ itemType, itemId })
    });
  },

  async unsaveItem(itemType, itemId) {
    return await request('/user/save', {
      method: 'DELETE',
      body: JSON.stringify({ itemType, itemId })
    });
  },

  async createNote(note) {
    return await request('/user/notes', {
      method: 'POST',
      body: JSON.stringify(note)
    });
  },

  async updateNote(note) {
    return await request('/user/notes', {
      method: 'PUT',
      body: JSON.stringify(note)
    });
  },

  async deleteNote(id) {
    return await request('/user/notes', {
      method: 'DELETE',
      body: JSON.stringify({ id })
    });
  },

  // Cross-device sync
  async sync(delta) {
    return await request('/sync', {
      method: 'POST',
      body: JSON.stringify(delta)
    });
  },

  // Server-proxied Wikimedia Commons
  async fetchWikimedia(query, limit = 14) {
    const params = new URLSearchParams({ query, limit: String(limit) });
    return await request(`/media/wikimedia?${params.toString()}`);
  },

  // Admin content submission & moderation
  async submitContent(contentType, title, data) {
    return await request('/admin/submit', {
      method: 'POST',
      body: JSON.stringify({ contentType, title, data })
    });
  },

  async getSubmissions(status = 'pending') {
    return await request(`/admin/submissions?status=${status}`);
  },

  async reviewSubmission(submissionId, decision, curatorNotes) {
    return await request('/admin/review', {
      method: 'POST',
      body: JSON.stringify({ submissionId, decision, curatorNotes })
    });
  },

  async uploadImage(imageData, filename) {
    return await request('/admin/upload', {
      method: 'POST',
      body: JSON.stringify({ imageData, filename })
    });
  },

  // Telemetry & Error monitoring
  async sendTelemetryEvent(type, payload) {
    try {
      await request('/telemetry/event', {
        method: 'POST',
        body: JSON.stringify({ type, payload })
      });
    } catch (_) {}
  },

  async sendTelemetryError(errInfo) {
    try {
      await request('/telemetry/errors', {
        method: 'POST',
        body: JSON.stringify(errInfo)
      });
    } catch (_) {}
  }
};
