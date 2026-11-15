'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache_wikimedia');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory LRU-like cache map: key -> { timestamp, data }
const MEM_CACHE = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

// Strict curation filter: exclude cartography, emblems, logos, charts, satellite diagrams
const UNWANTED_TERMS = /\b(map|locator|satellite|modis|esa|diagram|logo|flag|chart|graph|timelapse|icon|stamp|seal|emblem|coat of arms|vector|plan|bathymetry|elevation model|contour|topography|distribution)\b/i;

function getCacheKey(str) {
  return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex');
}

function readCache(key) {
  // Check memory
  const mem = MEM_CACHE.get(key);
  if (mem && (Date.now() - mem.timestamp < CACHE_TTL_MS)) {
    return mem.data;
  }

  // Check disk
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        MEM_CACHE.set(key, parsed);
        return parsed.data;
      }
    } catch (_) {}
  }
  return null;
}

function writeCache(key, data) {
  const record = { timestamp: Date.now(), data };
  MEM_CACHE.set(key, record);
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(record), 'utf8');
  } catch (_) {}
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds responsive srcset from a Wikimedia thumbnail URL
 */
function buildSrcset(thumbUrl, originalUrl) {
  if (!thumbUrl) return { src: originalUrl, srcset: '' };

  // Example Wikimedia thumb URL:
  // https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/File.jpg/2560px-File.jpg
  const widthMatch = thumbUrl.match(/\/(\d+)px-[^/]+$/);
  if (!widthMatch) {
    return { src: thumbUrl, srcset: `${thumbUrl} 1280w` };
  }

  const widths = [640, 1280, 1920, 2560];
  const srcsetParts = widths.map(w => {
    const resized = thumbUrl.replace(/\/\d+px-([^/]+)$/, `/${w}px-$1`);
    return `${resized} ${w}w`;
  });

  return {
    src: thumbUrl.replace(/\/\d+px-([^/]+)$/, '/1280px-$1'),
    srcset: srcsetParts.join(', '),
    original: originalUrl
  };
}

async function searchWikimedia(query, options = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  const limit = Math.min(Math.max(options.limit || 14, 1), 30);
  const cacheKey = getCacheKey(`search_${cleanQuery}_${limit}`);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${cleanQuery} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '2560'
  });

  const url = `${COMMONS_API}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ForestExplorerBot/2.0 (contact@forest.app)' }
  });

  if (!response.ok) {
    throw new Error(`Wikimedia Commons returned HTTP ${response.status}`);
  }

  const json = await response.json();
  const pages = Object.values(json?.query?.pages || {});

  const curated = pages
    .filter(page => {
      const info = page.imageinfo?.[0];
      if (!info) return false;
      // Only valid raster photos
      if (!/^image\/(jpeg|png|webp)$/i.test(info.mime || '')) return false;
      // Filter out small icons or low-res sketches
      if (info.width && info.width < 1000) return false;
      // Filter out unwanted map or diagram terms
      const title = String(page.title || '');
      if (UNWANTED_TERMS.test(title)) return false;
      return true;
    })
    .map(page => {
      const info = page.imageinfo[0];
      const meta = info.extmetadata || {};
      const title = String(page.title || 'Forest image')
        .replace(/^File:/, '')
        .replace(/\.[a-z0-9]+$/i, '');
      const rawThumb = info.thumburl || info.url;
      const responsive = buildSrcset(rawThumb, info.url);

      return {
        title,
        caption: stripHtml(meta.ImageDescription?.value || '') || 'Wikimedia Commons forest photograph',
        credit: stripHtml(meta.Artist?.value || 'Wikimedia Commons contributor'),
        license: stripHtml(meta.LicenseShortName?.value || 'See source file'),
        licenseUrl: meta.LicenseUrl?.value || '',
        url: responsive.src,
        srcset: responsive.srcset,
        full: info.url,
        width: info.width || 0,
        height: info.height || 0
      };
    })
    .filter(item => item.url);

  writeCache(cacheKey, curated);
  return curated;
}

module.exports = {
  searchWikimedia,
  buildSrcset
};
