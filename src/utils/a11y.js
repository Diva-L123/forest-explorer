'use strict';

import { $, $$ } from './dom.js';

let activeTrap = null;
let lastFocusedElement = null;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export function trapFocus(container, onClose) {
  releaseFocus();
  lastFocusedElement = document.activeElement;

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof onClose === 'function') onClose();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusables = $$(FOCUSABLE_SELECTOR, container).filter(el => el.offsetParent !== null);
    if (!focusables.length) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handleKeydown);
  activeTrap = { container, handleKeydown };

  // Focus initial element: prefer input if available, else first focusable
  const inputEl = container.querySelector('input:not([type="hidden"]), textarea');
  const firstFocusable = inputEl || $(FOCUSABLE_SELECTOR, container);
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 60);
  }
}

export function releaseFocus() {
  if (activeTrap) {
    activeTrap.container.removeEventListener('keydown', activeTrap.handleKeydown);
    activeTrap = null;
  }
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    try {
      lastFocusedElement.focus();
    } catch (_) {}
    lastFocusedElement = null;
  }
}

export function announce(message, priority = 'polite') {
  let announcer = $('#a11yAnnouncer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'a11yAnnouncer';
    announcer.className = 'sr-only';
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcer);
  }
  announcer.setAttribute('aria-live', priority);
  announcer.textContent = '';
  // Force screen reader update
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}
