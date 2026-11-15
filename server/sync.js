'use strict';

const auth = require('./auth');

function handleSync(userId, clientPayload) {
  if (!userId) throw new Error('Authentication required for sync.');

  const { saved = [], removedSaved = [], notes = [], progress } = clientPayload || {};

  // 1. Process saved items
  if (Array.isArray(saved)) {
    saved.forEach(item => {
      if (item.type && item.id) {
        auth.saveItem(userId, item.type, item.id);
      }
    });
  }

  // 2. Process removals
  if (Array.isArray(removedSaved)) {
    removedSaved.forEach(item => {
      if (item.type && item.id) {
        auth.unsaveItem(userId, item.type, item.id);
      }
    });
  }

  // 3. Process new / updated notes
  if (Array.isArray(notes)) {
    notes.forEach(note => {
      if (note.id && !note._deleted) {
        // Check if exists
        const existingData = auth.getUserData(userId);
        const match = existingData.notes.find(n => n.id === note.id);
        if (match) {
          auth.updateNote(userId, note.id, note);
        } else {
          auth.addNote(userId, note);
        }
      } else if (note.id && note._deleted) {
        auth.deleteNote(userId, note.id);
      }
    });
  }

  // 4. Update progress if provided
  if (progress) {
    auth.updateProgress(userId, progress);
  }

  // 5. Return fresh canonical state
  return auth.getUserData(userId);
}

module.exports = {
  handleSync
};
