'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

test('Atlas Data Files Integrity', async (t) => {
  await t.test('all primary JSON files exist and are valid JSON arrays', () => {
    const files = ['forests.json', 'species.json', 'stories.json', 'discoveries.json', 'prehistoric.json'];
    files.forEach(file => {
      const fullPath = path.join(DATA_DIR, file);
      assert.ok(fs.existsSync(fullPath), `File ${file} should exist`);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(raw);
      assert.ok(Array.isArray(data), `${file} should contain a JSON array`);
      assert.ok(data.length > 0, `${file} should not be empty`);
    });
  });

  await t.test('forests.json records meet schema requirements', () => {
    const forests = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'forests.json'), 'utf8'));
    const ids = new Set();
    const coverImages = new Set();

    forests.forEach((forest, idx) => {
      assert.ok(forest.id, `Forest at index ${idx} missing id`);
      assert.ok(!ids.has(forest.id), `Duplicate forest id found: ${forest.id}`);
      ids.add(forest.id);

      assert.ok(forest.name, `Forest ${forest.id} missing name`);
      assert.ok(forest.continent, `Forest ${forest.id} missing continent`);
      assert.ok(forest.type, `Forest ${forest.id} missing type`);
      assert.ok(forest.coverImage, `Forest ${forest.id} missing coverImage`);
      assert.ok(!coverImages.has(forest.coverImage), `Forest coverImage should be unique, duplicate: ${forest.coverImage}`);
      coverImages.add(forest.coverImage);

      assert.ok(Array.isArray(forest.myths) && forest.myths.length > 0, `Forest ${forest.id} must have myths array`);
      assert.ok(forest.myths.some(m => m.highlighted), `Forest ${forest.id} must have at least one highlighted myth`);
      forest.myths.forEach(m => {
        assert.ok(m.title, `Myth in ${forest.id} missing title`);
        assert.ok(m.origin, `Myth in ${forest.id} missing origin`);
        assert.ok(m.story, `Myth in ${forest.id} missing story`);
      });

      assert.ok(Array.isArray(forest.gallery) && forest.gallery.length >= 10, `Forest ${forest.id} must have at least 10 gallery images, got ${forest.gallery?.length}`);
      assert.ok(Array.isArray(forest.fauna8k) && forest.fauna8k.length >= 2, `Forest ${forest.id} must have at least 2 8K fauna animals`);

      if (forest.coordinates) {
        const lat = Number(forest.coordinates.lat);
        const lng = Number(forest.coordinates.lng);
        assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, `Invalid lat in ${forest.id}: ${lat}`);
        assert.ok(Number.isFinite(lng) && lng >= -180 && lng <= 180, `Invalid lng in ${forest.id}: ${lng}`);
      }
    });

    assert.strictEqual(forests.length, 120, 'Expected exactly 120 forests in atlas');
    assert.strictEqual(coverImages.size, 120, 'Expected 120 unique cover images across 120 forests');
  });

  await t.test('stories.json forestId references link to existing forests', () => {
    const forests = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'forests.json'), 'utf8'));
    const stories = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'stories.json'), 'utf8'));
    const forestIds = new Set(forests.map(f => f.id));

    stories.forEach(story => {
      if (story.forestId) {
        assert.ok(forestIds.has(story.forestId), `Story ${story.id} references non-existent forestId ${story.forestId}`);
      }
    });
  });

  await t.test('species.json records have required fields and valid IUCN statuses', () => {
    const species = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'species.json'), 'utf8'));
    const validStatuses = ['CR', 'EN', 'VU', 'NT', 'LC', 'EW', 'EX', 'DD', 'NE'];

    species.forEach(sp => {
      assert.ok(sp.id, `Species missing id`);
      assert.ok(sp.commonName, `Species ${sp.id} missing commonName`);
      assert.ok(sp.scientificName, `Species ${sp.id} missing scientificName`);
      if (sp.status) {
        assert.ok(validStatuses.includes(sp.status.toUpperCase()), `Invalid IUCN code ${sp.status} for ${sp.id}`);
      }
    });
  });
});
