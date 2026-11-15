'use strict';

export const state = {
  // Atlas data arrays
  forests: [],
  species: [],
  stories: [],
  discoveries: [],
  prehistoric: [],

  // Filters & Pagers
  forestFilters: { q: '', continent: 'all', type: 'all', sort: 'featured' },
  wildlifeFilters: { q: '', category: 'All', status: 'all' },
  pagers: { forests: 1, wildlife: 1, rare: 1, stories: 1, prehistoric: 1 },

  // Media & Gallery
  prehistoricMedia: {},
  mediaRequests: {},
  galleryToken: 0,

  // Map state
  mapContinent: 'all',
  mapSpeciesFilter: 'all',
  map: null,
  markerClusterGroup: null,
  markerLayer: null,
  markers: new Map(),
  activeMapForest: null,
  userLocation: null,

  // Comparison state
  compareList: [], // array of forest objects (max 3)

  // Auth, sync & user state
  session: null,
  userData: {
    saved: { forest: [], species: [], story: [], discovery: [], prehistoric: [] },
    notes: [],
    progress: { badges: [], quizzes: {}, expeditions: [] }
  },
  pendingSave: null,
  searchTimer: null,
  offlineMode: false,
  currentLanguage: 'en',

  // Audio system state
  audio: {
    context: null,
    source: null,
    gain: null,
    birdTimer: null,
    playing: false,
    biome: 'tropical' // 'tropical' | 'taiga' | 'temperate' | 'mangrove'
  },

  // Hero canvas sequence state
  hero: {
    ctx: null,
    images: [],
    frame: 1,
    direction: 1,
    timer: null,
    visible: true,
    reducedMotion: false
  }
};

const listeners = new Map();

export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  return () => off(event, callback);
}

export function off(event, callback) {
  if (listeners.has(event)) {
    listeners.get(event).delete(callback);
  }
}

export function emit(event, data) {
  if (listeners.has(event)) {
    listeners.get(event).forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    });
  }
}
