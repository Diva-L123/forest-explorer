'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const auth = require('./auth');
const mediaProxy = require('./mediaProxy');
const sync = require('./sync');
const admin = require('./admin');
const telemetry = require('./telemetry');

const PORT = process.env.PORT || 3000;
const BASE_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // 10MB limit for image uploads
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large.'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  // --- API ROUTER ---
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health check
      if (pathname === '/api/health') {
        return sendJson(res, 200, { status: 'healthy', version: '2.0.0', time: new Date().toISOString() });
      }

      // 2. Auth routes
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await parseBody(req);
        const result = auth.register(body.email, body.password, body.name);
        return sendJson(res, 201, result);
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const result = auth.login(body.email, body.password);
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const session = auth.authenticate(req);
        if (session) auth.logout(session.token);
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const data = auth.getUserData(session.id);
        return sendJson(res, 200, data);
      }

      // 3. User Data & Saved Items
      if (pathname === '/api/user/data' && method === 'GET') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const data = auth.getUserData(session.id);
        return sendJson(res, 200, data);
      }

      if (pathname === '/api/user/save' && method === 'POST') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        auth.saveItem(session.id, body.itemType, body.itemId);
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/user/save' && method === 'DELETE') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        auth.unsaveItem(session.id, body.itemType, body.itemId);
        return sendJson(res, 200, { success: true });
      }

      // 4. Field Notes
      if (pathname === '/api/user/notes' && method === 'POST') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        const note = auth.addNote(session.id, body);
        return sendJson(res, 201, note);
      }

      if (pathname === '/api/user/notes' && method === 'PUT') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        const updated = auth.updateNote(session.id, body.id, body);
        return sendJson(res, 200, updated);
      }

      if (pathname === '/api/user/notes' && method === 'DELETE') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        auth.deleteNote(session.id, body.id);
        return sendJson(res, 200, { success: true });
      }

      // 5. User Progress (Quizzes & Badges)
      if (pathname === '/api/user/progress' && method === 'POST') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        auth.updateProgress(session.id, body);
        return sendJson(res, 200, { success: true });
      }

      // 6. Cross-Device Sync
      if (pathname === '/api/sync' && method === 'POST') {
        const session = auth.authenticate(req);
        if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
        const body = await parseBody(req);
        const result = sync.handleSync(session.id, body);
        return sendJson(res, 200, result);
      }

      // 7. Wikimedia Proxy & Smart Curation
      if (pathname === '/api/media/wikimedia' && method === 'GET') {
        const query = parsedUrl.query.query;
        const limit = parseInt(parsedUrl.query.limit || '14', 10);
        const results = await mediaProxy.searchWikimedia(query, { limit });
        return sendJson(res, 200, { query, count: results.length, images: results });
      }

      // 8. Admin & Editorial Submissions
      if (pathname === '/api/admin/submit' && method === 'POST') {
        const session = auth.authenticate(req);
        const body = await parseBody(req);
        const submission = admin.submitContent(session?.id, body.contentType, body.title, body.data);
        return sendJson(res, 201, submission);
      }

      if (pathname === '/api/admin/submissions' && method === 'GET') {
        const session = auth.authenticate(req);
        if (!session || session.role !== 'admin') {
          return sendJson(res, 403, { error: 'Administrator access required.' });
        }
        const submissions = admin.listSubmissions(parsedUrl.query.status || 'pending');
        return sendJson(res, 200, { submissions });
      }

      if (pathname === '/api/admin/review' && method === 'POST') {
        const session = auth.authenticate(req);
        if (!session || session.role !== 'admin') {
          return sendJson(res, 403, { error: 'Administrator access required.' });
        }
        const body = await parseBody(req);
        const review = admin.reviewSubmission(body.submissionId, body.decision, body.curatorNotes);
        return sendJson(res, 200, review);
      }

      if (pathname === '/api/admin/upload' && method === 'POST') {
        const session = auth.authenticate(req);
        if (!session || session.role !== 'admin') {
          return sendJson(res, 403, { error: 'Administrator access required.' });
        }
        const body = await parseBody(req);
        const upload = admin.saveUploadedImage(body.imageData, body.filename);
        return sendJson(res, 201, upload);
      }

      // 9. Telemetry & Error Logging
      if (pathname === '/api/telemetry/event' && method === 'POST') {
        const body = await parseBody(req);
        telemetry.recordEvent(body.type || 'pageview', body.payload);
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/telemetry/errors' && method === 'POST') {
        const body = await parseBody(req);
        telemetry.recordError(body, req);
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/telemetry/stats' && method === 'GET') {
        const session = auth.authenticate(req);
        if (!session || session.role !== 'admin') {
          return sendJson(res, 403, { error: 'Administrator access required.' });
        }
        const stats = telemetry.getTelemetrySummary();
        return sendJson(res, 200, stats);
      }

      return sendJson(res, 404, { error: 'API route not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 400, { error: err.message || 'Internal server error' });
    }
  }

  // --- STATIC FILE SERVING ---
  let safeUrl = decodeURI(pathname);
  if (safeUrl === '/' || safeUrl === '') safeUrl = '/index.html';

  const filePath = path.join(BASE_DIR, path.normalize(safeUrl).replace(/^(\.\.[\/\\])+/, ''));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Handle video streaming
    if (ext === '.mp4') {
      const range = req.headers.range;
      const fileSize = stats.size;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        fileStream.pipe(res);
        return;
      }
    }

    // Static asset caching: 1 year for hero webp frames, no-cache for html & data
    let cacheControl = 'no-cache';
    if (filePath.includes('frames_webp') || filePath.includes('images')) {
      cacheControl = 'public, max-age=31536000, immutable';
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheControl
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(`🌿 Forest Explorer 2.0 Server Active!`);
      console.log(`📡 URL: http://localhost:${port}`);
      console.log(`🚀 Mode: Modular ESM + SQLite + API`);
      console.log(`======================================================\n`);
      resolve(server);
    });
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        const nextPort = port + 1;
        console.log(`Port ${port} in use, trying ${nextPort}...`);
        startServer(nextPort).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer
};
