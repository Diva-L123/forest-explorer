'use strict';

export const CONFIG = {
  FRAME_COUNT: 192,
  FRAME_PATH: './frames_webp/frame_',
  STORAGE: {
    accounts: 'fe.accounts.v1',
    session: 'fe.session.v1',
    userData: 'fe.userdata.v1.',
    schema: 'fe.schema.v1',
    offlinePack: 'fe.offline_pack.v1',
    language: 'fe.lang.v1',
    soundscape: 'fe.soundscape.v1'
  },
  SAVE_KEYS: {
    forest: 'savedForests',
    species: 'savedSpecies',
    story: 'savedStories',
    discovery: 'savedDiscoveries'
  },
  OPEN_ATTRS: {
    forest: 'data-open-forest',
    species: 'data-open-species',
    story: 'data-open-story',
    discovery: 'data-open-discovery',
    prehistoric: 'data-open-prehistoric'
  },
  PAGE_SIZE: {
    forests: 6,
    wildlife: 8,
    rare: 8,
    stories: 4,
    prehistoric: 6
  },
  MOBILE_PAGE_SIZE: {
    forests: 4,
    wildlife: 6,
    rare: 6,
    stories: 3,
    prehistoric: 4
  },
  API_BASE: '/api',
  DEFAULT_LANGUAGE: 'en'
};
