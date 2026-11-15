'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'forest_explorer.db');

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'explorer',
      name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, item_type, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS field_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id TEXT PRIMARY KEY,
      badges TEXT DEFAULT '[]',
      quizzes TEXT DEFAULT '{}',
      expeditions TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS editorial_submissions (
      id TEXT PRIMARY KEY,
      author_id TEXT,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      data_json TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      curator_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS telemetry_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS telemetry_errors (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      stack TEXT,
      url TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed default admin if not existing
  seedAdmin(db);
}

function seedAdmin(db) {
  const check = db.prepare('SELECT id FROM users WHERE email = ?').get('explorer@forest.app');
  if (!check) {
    // Default seeded explorer admin: explorer@forest.app / QuietForest2026!
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('QuietForest2026!', salt, 100000, 64, 'sha512').toString('hex');
    const now = new Date().toISOString();
    const id = 'user_' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, role, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 'Lead Forest Ranger', ?, ?)
    `).run(id, 'explorer@forest.app', hash, salt, now, now);

    // Initial default saved items
    const defaultSaved = [
      ['forest', 'cheonggyecheon-urban-stream'],
      ['forest', 'amazon-rainforest'],
      ['species', 'boyd-forest-dragon'],
      ['story', 'lost-forest-cloud-mountain']
    ];

    const insertSaved = db.prepare(`
      INSERT OR IGNORE INTO saved_items (id, user_id, item_type, item_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    defaultSaved.forEach(([type, itemId]) => {
      insertSaved.run('save_' + crypto.randomUUID(), id, type, itemId, now);
    });

    // Initial field note
    db.prepare(`
      INSERT INTO field_notes (id, user_id, target_type, target_id, title, content, tags, created_at, updated_at)
      VALUES (?, ?, 'forest', 'cheonggyecheon-urban-stream', 'Daylighted stream observation', 'Noticed grey herons nesting near stepping stones after the seasonal rains.', 'wildlife,urban-restoration', ?, ?)
    `).run('note_' + crypto.randomUUID(), id, now, now);
  }
}

module.exports = {
  getDb
};
