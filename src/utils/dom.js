'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtml(value) {
  const holder = document.createElement('div');
  holder.innerHTML = String(value || '');
  return (holder.textContent || '').replace(/\s+/g, ' ').trim();
}

export function debounce(fn, wait = 180) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function showToast(message, type = 'success', duration = 4200) {
  let container = $('#toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-indicator"></span>
    <span class="toast-message">${esc(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

export function syncBodyLock() {
  const anyModalOpen = Boolean(
    $('.modal-overlay.is-open') ||
    $('.search-overlay.is-open') ||
    $('.auth-overlay.is-open') ||
    $('.side-drawer.is-open') ||
    $('.lightbox.is-open') ||
    $('#mobileMenu.is-open')
  );
  document.body.classList.toggle('modal-open', anyModalOpen);
}
