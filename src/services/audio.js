'use strict';

import { state, emit } from '../core/state.js';
import { $ } from '../utils/dom.js';

export function initAmbientAudio() {
  const toggleBtn = $('#audioToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAmbientAudio);
  }
}

export function setBiome(biome) {
  state.audio.biome = biome;
  if (state.audio.playing) {
    // restart with new biome
    stopAmbientAudio();
    startAmbientAudio();
  }
}

export function toggleAmbientAudio() {
  if (state.audio.playing) {
    stopAmbientAudio();
  } else {
    startAmbientAudio();
  }
}

export function startAmbientAudio() {
  if (state.audio.playing) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  if (!state.audio.context) {
    state.audio.context = new AudioContext();
  }

  const ctx = state.audio.context;
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const sampleRate = ctx.sampleRate;
  const bufferDuration = 5; // 5 seconds looped noise
  const bufferSize = sampleRate * bufferDuration;
  const noiseBuffer = ctx.createBuffer(2, bufferSize, sampleRate);

  // Generate pink/brownish filtered noise based on biome
  for (let channel = 0; channel < 2; channel++) {
    const data = noiseBuffer.getChannelData(channel);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown/Pink integration
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  // Bandpass filter to sculpt biome wind/canopy
  const filter = ctx.createBiquadFilter();
  if (state.audio.biome === 'tropical') {
    filter.type = 'lowpass';
    filter.frequency.value = 580; // Heavy humid canopy
  } else if (state.audio.biome === 'taiga') {
    filter.type = 'bandpass';
    filter.frequency.value = 420; // Boreal wind
    filter.Q.value = 1.2;
  } else if (state.audio.biome === 'mangrove') {
    filter.type = 'lowpass';
    filter.frequency.value = 350; // Low tidal swell
  } else {
    filter.type = 'lowpass';
    filter.frequency.value = 750; // Temperate breeze
  }

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 3);

  noiseSource.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  noiseSource.start();

  state.audio.source = noiseSource;
  state.audio.gain = masterGain;
  state.audio.playing = true;

  updateAudioUi(true);

  // Periodic procedural birdsong / fauna calls
  scheduleNextFaunaCall();
  emit('audio:change', { playing: true, biome: state.audio.biome });
}

function scheduleNextFaunaCall() {
  if (!state.audio.playing) return;
  const delay = Math.random() * 5000 + 3500;
  state.audio.birdTimer = setTimeout(() => {
    if (state.audio.playing && state.audio.context) {
      playProceduralFauna(state.audio.context);
      scheduleNextFaunaCall();
    }
  }, delay);
}

function playProceduralFauna(ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const startTime = ctx.currentTime;

  if (state.audio.biome === 'taiga') {
    // Wolf howl / loon call
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, startTime);
    osc.frequency.exponentialRampToValueAtTime(480, startTime + 0.8);
    osc.frequency.exponentialRampToValueAtTime(290, startTime + 1.8);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 2.1);
  } else {
    // Warbler / Canopy songbird chirp
    osc.type = 'sine';
    const baseFreq = 2200 + Math.random() * 800;
    osc.frequency.setValueAtTime(baseFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, startTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, startTime + 0.18);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.04, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.26);
  }
}

export function stopAmbientAudio() {
  if (!state.audio.playing) return;

  clearTimeout(state.audio.birdTimer);

  if (state.audio.gain && state.audio.context) {
    const ctx = state.audio.context;
    state.audio.gain.gain.setValueAtTime(state.audio.gain.gain.value, ctx.currentTime);
    state.audio.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    setTimeout(() => {
      try {
        state.audio.source?.stop();
        state.audio.source?.disconnect();
      } catch (_) {}
      state.audio.playing = false;
      updateAudioUi(false);
      emit('audio:change', { playing: false });
    }, 1250);
  } else {
    state.audio.playing = false;
    updateAudioUi(false);
    emit('audio:change', { playing: false });
  }
}

function updateAudioUi(isPlaying) {
  const toggleBtn = $('#audioToggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', String(isPlaying));
    toggleBtn.classList.toggle('is-playing', isPlaying);
  }
}
