'use strict';

const crypto = require('crypto');
const { getDb } = require('./db');

function recordEvent(eventType, payload) {
  const db = getDb();
  const id = 'evt_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO telemetry_events (id, event_type, payload_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, eventType, JSON.stringify(payload || {}), now);

  return { id, success: true };
}

function recordError(errorData, req) {
  const db = getDb();
  const id = 'err_' + crypto.randomUUID();
  const now = new Date().toISOString();

  const message = String(errorData.message || 'Unknown error').slice(0, 500);
  const stack = String(errorData.stack || '').slice(0, 2000);
  const url = String(errorData.url || req.url || '').slice(0, 500);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 250);

  db.prepare(`
    INSERT INTO telemetry_errors (id, message, stack, url, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, message, stack, url, userAgent, now);

  return { id, recorded: true };
}

function getTelemetrySummary() {
  const db = getDb();
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM telemetry_events').get().count;
  const totalErrors = db.prepare('SELECT COUNT(*) as count FROM telemetry_errors').get().count;
  const recentErrors = db.prepare('SELECT * FROM telemetry_errors ORDER BY created_at DESC LIMIT 20').all();
  const topEvents = db.prepare('SELECT event_type, COUNT(*) as count FROM telemetry_events GROUP BY event_type ORDER BY count DESC LIMIT 10').all();

  return {
    totalEvents,
    totalErrors,
    recentErrors,
    topEvents
  };
}

module.exports = {
  recordEvent,
  recordError,
  getTelemetrySummary
};
