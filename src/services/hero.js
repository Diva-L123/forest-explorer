'use strict';

import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $ } from '../utils/dom.js';

export function initHeroSequence() {
  const canvas = $('#forestCanvas');
  if (!canvas) return;

  state.hero.ctx = canvas.getContext('2d');
  state.hero.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  resizeHeroCanvas();
  window.addEventListener('resize', resizeHeroCanvas);

  // Load initial frame and start progressive preloading
  loadHeroFrame(1, true);

  if (!state.hero.reducedMotion) {
    preloadHeroFrames();
    startHeroPlayback();
  }
}

export function setHeroVisible(visible) {
  state.hero.visible = Boolean(visible);
  if (state.hero.visible) {
    if (!state.hero.timer && !state.hero.reducedMotion) {
      startHeroPlayback();
    }
  } else {
    // Pause hero loop when leaving home section to save CPU and battery
    stopHeroPlayback();
  }
}

function resizeHeroCanvas() {
  const canvas = $('#forestCanvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  if (state.hero.images[state.hero.frame]) {
    drawHeroFrame(state.hero.frame);
  }
}

function loadHeroFrame(index, drawWhenReady = false) {
  if (state.hero.images[index]) return state.hero.images[index];

  const img = new Image();
  const padIndex = String(index).padStart(4, '0');
  img.src = `${CONFIG.FRAME_PATH}${padIndex}.webp`;

  img.onload = () => {
    state.hero.images[index] = img;
    if (drawWhenReady && state.hero.frame === index) {
      drawHeroFrame(index);
    }
  };
  return img;
}

function preloadHeroFrames() {
  // Preload first 48 immediately for instant fluid start
  for (let i = 1; i <= 48; i++) {
    loadHeroFrame(i);
  }

  // Preload remainder in steady, high-throughput chunks
  const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
  let next = 49;
  function loadChunk() {
    for (let i = 0; i < 16 && next <= CONFIG.FRAME_COUNT; i++, next++) {
      loadHeroFrame(next);
    }
    if (next <= CONFIG.FRAME_COUNT) {
      idleCallback(loadChunk);
    }
  }
  idleCallback(loadChunk);
}

function drawHeroFrame(index) {
  const img = state.hero.images[index];
  const canvas = $('#forestCanvas');
  const ctx = state.hero.ctx;
  if (!img || !canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Cover aspect fit
  const imgRatio = img.width / img.height;
  const canvasRatio = canvas.width / canvas.height;
  let renderWidth, renderHeight, offsetX, offsetY;

  if (canvasRatio > imgRatio) {
    renderWidth = canvas.width;
    renderHeight = canvas.width / imgRatio;
    offsetX = 0;
    offsetY = (canvas.height - renderHeight) / 2;
  } else {
    renderWidth = canvas.height * imgRatio;
    renderHeight = canvas.height;
    offsetX = (canvas.width - renderWidth) / 2;
    offsetY = 0;
  }

  ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);

  // Look-ahead buffer: ensure next 2 frames in direction are preloaded
  const nextFrame = index + state.hero.direction;
  if (nextFrame >= 1 && nextFrame <= CONFIG.FRAME_COUNT && !state.hero.images[nextFrame]) {
    loadHeroFrame(nextFrame);
  }
}

function startHeroPlayback() {
  if (state.hero.timer) return;

  const fps = 24;
  const interval = 1000 / fps;

  state.hero.timer = setInterval(() => {
    if (!state.hero.visible) return;

    state.hero.frame += state.hero.direction;
    if (state.hero.frame >= CONFIG.FRAME_COUNT) {
      state.hero.frame = CONFIG.FRAME_COUNT;
      state.hero.direction = -1;
    } else if (state.hero.frame <= 1) {
      state.hero.frame = 1;
      state.hero.direction = 1;
    }

    if (state.hero.images[state.hero.frame]) {
      drawHeroFrame(state.hero.frame);
    }
  }, interval);
}

export function stopHeroPlayback() {
  if (state.hero.timer) {
    clearInterval(state.hero.timer);
    state.hero.timer = null;
  }
}
