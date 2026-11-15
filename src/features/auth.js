'use strict';

import { state, emit } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, $$, showToast, syncBodyLock } from '../utils/dom.js';
import { trapFocus, releaseFocus } from '../utils/a11y.js';
import { api } from '../services/api.js';
import { openDashboard } from './journal.js';

export function initAuth() {
  bindAuthEvents();
  restoreSession();
}

async function restoreSession() {
  const token = localStorage.getItem(CONFIG.STORAGE.session);
  if (!token) return;

  state.session = { token };
  try {
    const userData = await api.getMe();
    state.session.user = userData.user;
    state.userData = userData;
    updateAuthUi(true);
    emit('auth:changed', state.session);
  } catch (err) {
    console.warn('Session restoration failed:', err);
    localStorage.removeItem(CONFIG.STORAGE.session);
    state.session = null;
    updateAuthUi(false);
  }
}

export function openAuthModal(tab = 'login') {
  const modal = $('#authModal');
  if (!modal) return;

  const loginError = $('#loginError');
  const registerError = $('#registerError');
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';

  switchAuthTab(tab);
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyLock();
  trapFocus(modal, closeAuthModal);
}

export function closeAuthModal() {
  const modal = $('#authModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  releaseFocus();
  syncBodyLock();
}

function switchAuthTab(tab) {
  const isRegister = tab === 'register';
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');

  if (loginForm) loginForm.hidden = isRegister;
  if (registerForm) registerForm.hidden = !isRegister;

  $$('.auth-tab').forEach(button => {
    const active = button.getAttribute('data-auth-tab') === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function updateAuthUi(isLoggedIn) {
  const accountBtnLabel = $('#accountBtnLabel');
  const accountBtn = $('#accountBtn');
  const mobileAccountBtn = $('#mobileAccountBtn');

  if (accountBtnLabel) {
    accountBtnLabel.textContent = isLoggedIn ? (state.session?.user?.name || 'Explorer') : 'Sign in';
  }
  if (accountBtn) {
    accountBtn.classList.toggle('is-logged-in', isLoggedIn);
  }
  if (mobileAccountBtn) {
    mobileAccountBtn.textContent = isLoggedIn ? (state.session?.user?.name || 'My dashboard') : 'Sign in to your account';
  }
}

function bindAuthEvents() {
  $('#accountBtn')?.addEventListener('click', () => {
    if (state.session?.user) {
      openDashboard();
    } else {
      openAuthModal('login');
    }
  });

  $('#authCloseBtn')?.addEventListener('click', closeAuthModal);
  $$('.auth-tab').forEach(button => {
    button.addEventListener('click', () => switchAuthTab(button.getAttribute('data-auth-tab')));
  });

  $('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#loginEmail')?.value;
    const password = $('#loginPassword')?.value;
    const errorBox = $('#loginError');
    if (errorBox) errorBox.textContent = '';

    try {
      const res = await api.login(email, password);
      state.session = res;
      localStorage.setItem(CONFIG.STORAGE.session, res.token);
      const userData = await api.getMe();
      state.userData = userData;
      updateAuthUi(true);
      closeAuthModal();
      showToast(`Welcome back, ${res.user.name || 'Explorer'}!`);
      emit('auth:changed', state.session);
    } catch (err) {
      if (errorBox) errorBox.textContent = err.message;
      showToast(err.message, 'error');
    }
  });

  $('#registerForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#registerName')?.value;
    const email = $('#registerEmail')?.value;
    const password = $('#registerPassword')?.value;
    const confirmation = $('#registerPasswordConfirm')?.value;
    const errorBox = $('#registerError');
    if (errorBox) errorBox.textContent = '';

    if (!name || name.trim().length < 2) {
      if (errorBox) errorBox.textContent = 'Enter the name you would like to use.';
      return;
    }
    if (password !== confirmation) {
      if (errorBox) errorBox.textContent = 'Passwords do not match.';
      return;
    }

    try {
      const res = await api.register(email, password, name);
      state.session = res;
      localStorage.setItem(CONFIG.STORAGE.session, res.token);
      state.userData = await api.getMe();
      updateAuthUi(true);
      closeAuthModal();
      showToast(`Account created! Welcome to Forest Explorer, ${name || 'Explorer'}!`);
      emit('auth:changed', state.session);
    } catch (err) {
      if (errorBox) errorBox.textContent = err.message;
      showToast(err.message, 'error');
    }
  });

  document.addEventListener('click', e => {
    const toggle = e.target.closest('[data-toggle-password]');
    if (!toggle) return;
    const input = document.getElementById(toggle.getAttribute('data-toggle-password'));
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
  });

  // Delegated bookmark click
  document.addEventListener('click', async e => {
    const saveBtn = e.target.closest('[data-toggle-save]');
    if (saveBtn) {
      e.preventDefault();
      const type = saveBtn.getAttribute('data-toggle-save');
      const id = saveBtn.getAttribute('data-id');
      const list = state.userData.saved[type] || [];
      const isSaved = list.includes(id);

      if (isSaved) {
        state.userData.saved[type] = list.filter(item => item !== id);
        saveBtn.classList.remove('is-saved');
        saveBtn.querySelector('span').textContent = 'Save to Journal';
        if (state.session?.token) {
          await api.unsaveItem(type, id).catch(() => {});
        }
        showToast(`Removed from saved ${type}s.`);
      } else {
        list.push(id);
        state.userData.saved[type] = list;
        saveBtn.classList.add('is-saved');
        saveBtn.querySelector('span').textContent = 'Saved to Journal';
        if (state.session?.token) {
          await api.saveItem(type, id).catch(() => {});
        }
        showToast(`Saved to field journal! 🔖`);
      }
    }
  });
}
