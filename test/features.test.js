'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { haversineDistance, formatArea, formatCoordinates, estimateReadingTime } = require('../src/utils/formatters.js');

test('Client Utilities & Feature Engines', async (t) => {
  await t.test('haversineDistance calculates accurate km distance between geographic points', () => {
    // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ~ 343 km
    const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(dist >= 340 && dist <= 350, `Distance should be ~343km, got ${dist}`);
  });

  await t.test('formatArea formats metric areas cleanly', () => {
    assert.strictEqual(formatArea(6000000), '6.0M km²');
    assert.strictEqual(formatArea(12000), '12.0k km²');
    assert.strictEqual(formatArea(500), '500 km²');
  });

  await t.test('formatCoordinates returns cardinal hemisphere representations', () => {
    const coords = { lat: 37.5694, lng: 126.98 };
    const formatted = formatCoordinates(coords);
    assert.strictEqual(formatted, '37.57° N, 126.98° E');

    const southWest = { lat: -3.4653, lng: -62.2159 };
    assert.strictEqual(formatCoordinates(southWest), '3.47° S, 62.22° W');
  });

  await t.test('estimateReadingTime calculates reasonable word-count based estimate', () => {
    const shortText = 'The Amazon rainforest is a moist broadleaf tropical rainforest.';
    assert.strictEqual(estimateReadingTime(shortText), '1 min read');

    const longText = new Array(500).fill('forest').join(' ');
    assert.strictEqual(estimateReadingTime(longText), '3 min read');
  });
});
