'use strict';

const test = require('node:test');
const assert = require('node:assert');

const auth = require('../server/auth');
const sync = require('../server/sync');
const admin = require('../server/admin');
const telemetry = require('../server/telemetry');

test('Server Backend Core Logic & Services', async (t) => {
  const testEmail = `scout_${Date.now()}@forest.local`;
  let session = null;

  await t.test('auth.register creates an account with hashed credentials', () => {
    session = auth.register(testEmail, 'Password123!', 'Field Scout');
    assert.ok(session.token, 'Should return a token');
    assert.strictEqual(session.user.email, testEmail);
    assert.strictEqual(session.user.role, 'explorer');
  });

  await t.test('auth.register rejects duplicate email', () => {
    assert.throws(() => {
      auth.register(testEmail, 'Password123!');
    }, /already exists/);
  });

  await t.test('auth.login verifies credentials correctly', () => {
    const loginSession = auth.login(testEmail, 'Password123!');
    assert.ok(loginSession.token);
    assert.strictEqual(loginSession.user.id, session.user.id);
  });

  await t.test('auth.login rejects incorrect password', () => {
    assert.throws(() => {
      auth.login(testEmail, 'WrongPassword!');
    }, /Invalid email or password/);
  });

  await t.test('auth.authenticate validates token in authorization header', () => {
    const mockReq = { headers: { authorization: `Bearer ${session.token}` } };
    const authUser = auth.authenticate(mockReq);
    assert.ok(authUser);
    assert.strictEqual(authUser.email, testEmail);
  });

  await t.test('auth.saveItem & unsaveItem manages bookmarks', () => {
    auth.saveItem(session.user.id, 'forest', 'bialowieza-forest');
    let data = auth.getUserData(session.user.id);
    assert.ok(data.saved.forest.includes('bialowieza-forest'));

    auth.unsaveItem(session.user.id, 'forest', 'bialowieza-forest');
    data = auth.getUserData(session.user.id);
    assert.ok(!data.saved.forest.includes('bialowieza-forest'));
  });

  let note = null;

  await t.test('auth.addNote, updateNote, deleteNote manages field notes', () => {
    note = auth.addNote(session.user.id, {
      targetType: 'forest',
      targetId: 'amazon-rainforest',
      title: 'Canopy observation',
      content: 'Recorded sounds of macaws at dawn.',
      tags: 'wildlife,birds'
    });
    assert.ok(note.id);
    assert.strictEqual(note.title, 'Canopy observation');

    auth.updateNote(session.user.id, note.id, {
      title: 'Updated Canopy observation'
    });

    let data = auth.getUserData(session.user.id);
    const found = data.notes.find(n => n.id === note.id);
    assert.strictEqual(found.title, 'Updated Canopy observation');

    auth.deleteNote(session.user.id, note.id);
    data = auth.getUserData(session.user.id);
    assert.ok(!data.notes.some(n => n.id === note.id));
  });

  await t.test('sync.handleSync processes client deltas and returns updated state', () => {
    const syncResult = sync.handleSync(session.user.id, {
      saved: [{ type: 'species', id: 'okapi' }],
      progress: {
        badges: ['canopy-pioneer', 'apex-tracker'],
        quizzes: { 'taiga-quiz': 95 }
      }
    });

    assert.ok(syncResult.saved.species.includes('okapi'));
    assert.ok(syncResult.progress.badges.includes('canopy-pioneer'));
    assert.strictEqual(syncResult.progress.quizzes['taiga-quiz'], 95);
  });

  await t.test('admin.submitContent, listSubmissions, and reviewSubmission', () => {
    const submission = admin.submitContent(session.user.id, 'forest', 'Daintree Expansion', {
      biome: 'Tropical Lowland',
      hectares: 12000
    });
    assert.ok(submission.id);
    assert.strictEqual(submission.status, 'pending');

    const pendingList = admin.listSubmissions('pending');
    assert.ok(pendingList.some(s => s.id === submission.id));

    const reviewed = admin.reviewSubmission(submission.id, 'approved', 'Verified by senior curator.');
    assert.strictEqual(reviewed.status, 'approved');
  });

  await t.test('telemetry.recordEvent and recordError store telemetry without errors', () => {
    const event = telemetry.recordEvent('section_view', { section: 'deeptime' });
    assert.strictEqual(event.success, true);

    const error = telemetry.recordError({ message: 'Mock runtime exception', stack: 'TestStack' }, { url: '/forests', headers: {} });
    assert.strictEqual(error.recorded, true);

    const summary = telemetry.getTelemetrySummary();
    assert.ok(summary.totalEvents >= 1);
    assert.ok(summary.totalErrors >= 1);
  });
});
