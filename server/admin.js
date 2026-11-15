'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('./db');

const UPLOADS_DIR = path.join(__dirname, '..', 'images', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function submitContent(authorId, contentType, title, data) {
  if (!contentType || !title || !data) {
    throw new Error('contentType, title, and data are required.');
  }

  const db = getDb();
  const id = 'sub_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO editorial_submissions (id, author_id, content_type, title, data_json, status, curator_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', '', ?, ?)
  `).run(id, authorId || null, contentType, title, JSON.stringify(data), now, now);

  return { id, status: 'pending', createdAt: now };
}

function listSubmissions(status = 'pending') {
  const db = getDb();
  let query = 'SELECT * FROM editorial_submissions';
  const params = [];
  if (status && status !== 'all') {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(r => ({
    ...r,
    data: JSON.parse(r.data_json || '{}')
  }));
}

function reviewSubmission(submissionId, decision, curatorNotes = '') {
  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error('Decision must be either "approved" or "rejected".');
  }

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE editorial_submissions
    SET status = ?, curator_notes = ?, updated_at = ?
    WHERE id = ?
  `).run(decision, curatorNotes, now, submissionId);

  return { id: submissionId, status: decision, updatedAt: now };
}

function saveUploadedImage(base64Data, filename) {
  if (!base64Data) throw new Error('No image payload provided.');

  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let buffer;
  let ext = '.jpg';

  if (matches) {
    const mime = matches[1];
    if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/webp') ext = '.webp';
    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(base64Data, 'base64');
  }

  const safeName = (filename || 'upload').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now() + ext;
  const filePath = path.join(UPLOADS_DIR, safeName);

  fs.writeFileSync(filePath, buffer);
  return {
    url: `/images/uploads/${safeName}`,
    size: buffer.length
  };
}

module.exports = {
  submitContent,
  listSubmissions,
  reviewSubmission,
  saveUploadedImage
};
