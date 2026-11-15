'use strict';

const crypto = require('crypto');
const { getDb } = require('./db');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function register(email, password, name = '') {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail.includes('@') || password.length < 8) {
    throw new Error('Valid email and password (minimum 8 characters) required.');
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const now = new Date().toISOString();
  const userId = 'user_' + crypto.randomUUID();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'explorer', ?, ?, ?)
  `).run(userId, cleanEmail, hash, salt, name.trim() || cleanEmail.split('@')[0], now, now);

  return createSession(userId);
}

function login(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const computedHash = hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) {
    throw new Error('Invalid email or password.');
  }

  return createSession(user.id);
}

function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expires, now.toISOString());

  const user = db.prepare('SELECT id, email, role, name, created_at FROM users WHERE id = ?').get(userId);

  return {
    token,
    expiresAt: expires,
    user
  };
}

function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = String(req.headers['x-auth-token']).trim();
  }

  if (!token) return null;

  const db = getDb();
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.email, u.role, u.name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: session.id,
    email: session.email,
    role: session.role,
    name: session.name,
    token: session.token
  };
}

function logout(token) {
  if (!token) return;
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getUserData(userId) {
  const db = getDb();
  const user = db.prepare('SELECT id, email, role, name, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  const savedRows = db.prepare('SELECT item_type, item_id, created_at FROM saved_items WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const notesRows = db.prepare('SELECT id, target_type, target_id, title, content, tags, created_at, updated_at FROM field_notes WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  const progressRow = db.prepare('SELECT badges, quizzes, expeditions FROM user_progress WHERE user_id = ?').get(userId);

  const saved = {
    forest: [],
    species: [],
    story: [],
    discovery: [],
    prehistoric: []
  };

  savedRows.forEach(row => {
    if (saved[row.item_type]) {
      saved[row.item_type].push(row.item_id);
    }
  });

  let badges = [];
  let quizzes = {};
  let expeditions = [];

  if (progressRow) {
    try { badges = JSON.parse(progressRow.badges || '[]'); } catch (_) {}
    try { quizzes = JSON.parse(progressRow.quizzes || '{}'); } catch (_) {}
    try { expeditions = JSON.parse(progressRow.expeditions || '[]'); } catch (_) {}
  }

  return {
    user,
    saved,
    notes: notesRows,
    progress: {
      badges,
      quizzes,
      expeditions
    }
  };
}

function saveItem(userId, itemType, itemId) {
  const db = getDb();
  const id = 'save_' + crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO saved_items (id, user_id, item_type, item_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, itemType, itemId, now);
}

function unsaveItem(userId, itemType, itemId) {
  const db = getDb();
  db.prepare('DELETE FROM saved_items WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .run(userId, itemType, itemId);
}

function addNote(userId, { targetType, targetId, title, content, tags = '' }) {
  const db = getDb();
  const id = 'note_' + crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO field_notes (id, user_id, target_type, target_id, title, content, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, targetType, targetId, title, content, tags, now, now);
  return { id, targetType, targetId, title, content, tags, createdAt: now, updatedAt: now };
}

function updateNote(userId, noteId, { title, content, tags }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE field_notes
    SET title = COALESCE(?, title),
        content = COALESCE(?, content),
        tags = COALESCE(?, tags),
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    title !== undefined ? title : null,
    content !== undefined ? content : null,
    tags !== undefined ? tags : null,
    now,
    noteId,
    userId
  );
  return db.prepare('SELECT * FROM field_notes WHERE id = ?').get(noteId);
}

function deleteNote(userId, noteId) {
  const db = getDb();
  db.prepare('DELETE FROM field_notes WHERE id = ? AND user_id = ?').run(noteId, userId);
}

function updateProgress(userId, { badges, quizzes, expeditions }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO user_progress (user_id, badges, quizzes, expeditions, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      badges = COALESCE(excluded.badges, user_progress.badges),
      quizzes = COALESCE(excluded.quizzes, user_progress.quizzes),
      expeditions = COALESCE(excluded.expeditions, user_progress.expeditions),
      updated_at = excluded.updated_at
  `).run(
    userId,
    badges !== undefined ? JSON.stringify(badges) : null,
    quizzes !== undefined ? JSON.stringify(quizzes) : null,
    expeditions !== undefined ? JSON.stringify(expeditions) : null,
    now
  );
}

module.exports = {
  register,
  login,
  authenticate,
  logout,
  getUserData,
  saveItem,
  unsaveItem,
  addNote,
  updateNote,
  deleteNote,
  updateProgress
};
