'use strict';

import { state, emit } from '../core/state.js';
import { $, $$, esc, showToast, syncBodyLock } from '../utils/dom.js';
import { trapFocus, releaseFocus } from '../utils/a11y.js';

export const BADGES_CATALOG = [
  { id: 'canopy-pioneer', name: 'Canopy Pioneer', desc: 'Explored 3 tropical rainforest field guides.', icon: 'leaf' },
  { id: 'old-growth-guardian', name: 'Old Growth Guardian', desc: 'Read stories of ancient primeval trees.', icon: 'shield' },
  { id: 'apex-tracker', name: 'Apex Tracker', desc: 'Saved 5 endangered wildlife species to your journal.', icon: 'paw' },
  { id: 'deep-time-traveler', name: 'Deep Time Traveler', desc: 'Discovered the prehistoric creatures of the atlas.', icon: 'book' },
  { id: 'global-ranger', name: 'Global Ranger', desc: 'Mapped forests across 4 different continents.', icon: 'globe' },
  { id: 'quiz-master', name: 'Forest Master', desc: 'Passed the Natural History Field Quiz with 100%.', icon: 'check' }
];

export const SAMPLE_QUIZ = [
  {
    q: 'Which forest is known as "The Lungs of the Earth", producing a substantial fraction of South America\'s fresh oxygen and rainfall cycle?',
    options: ['Amazon Rainforest', 'Białowieża Forest', 'Black Forest', 'Yakushima'],
    answer: 0,
    explanation: 'The Amazon Basin spans over 6 million square kilometers and generates its own rainfall through evapotranspiration.'
  },
  {
    q: 'Which ancient tree species in Japan inspired the mythical forests of Studio Ghibli\'s Princess Mononoke?',
    options: ['Bunya Pine', 'Jōmon Sugi (Yakushima Cedar)', 'Coast Redwood', 'Bristlecone Pine'],
    answer: 1,
    explanation: 'The Jōmon Sugi in Yakushima is estimated to be between 2,170 and 7,200 years old.'
  },
  {
    q: 'What is the IUCN conservation category for species facing the highest risk of extinction in the wild?',
    options: ['Near Threatened (NT)', 'Vulnerable (VU)', 'Critically Endangered (CR)', 'Least Concern (LC)'],
    answer: 2,
    explanation: 'Critically Endangered (CR) signifies the highest threat level before Extinct in the Wild (EW).'
  }
];

export function openQuizModal() {
  let modal = $('#quizModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quizModal';
    modal.className = 'modal-overlay quiz-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Field Knowledge Quiz');
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card quiz-card">
      <div class="modal-header">
        <div>
          <h2>Naturalist Field Knowledge Quiz</h2>
          <p class="lede">Test your forestry and conservation acumen to earn the Forest Master badge.</p>
        </div>
        <button class="modal-close" id="quizCloseBtn" type="button" aria-label="Close quiz">
          <svg class="icon"><use href="#icon-close"></use></svg>
        </button>
      </div>
      <div class="quiz-body" id="quizQuestionsContainer">
        ${renderQuizQuestions()}
      </div>
      <div class="quiz-footer">
        <button class="btn btn-primary" id="submitQuizBtn" type="button">Submit Answers</button>
      </div>
    </div>
  `;

  modal.classList.add('is-open');
  syncBodyLock();
  trapFocus(modal, closeQuizModal);

  $('#quizCloseBtn').addEventListener('click', closeQuizModal);
  $('#submitQuizBtn').addEventListener('click', evaluateQuiz);
}

export function closeQuizModal() {
  const modal = $('#quizModal');
  if (modal) modal.classList.remove('is-open');
  releaseFocus();
  syncBodyLock();
}

function renderQuizQuestions() {
  return SAMPLE_QUIZ.map((item, qIdx) => `
    <div class="quiz-question-block" data-q-index="${qIdx}">
      <h4>${qIdx + 1}. ${esc(item.q)}</h4>
      <div class="quiz-options-grid">
        ${item.options.map((opt, optIdx) => `
          <label class="quiz-option-label">
            <input type="radio" name="quiz_q_${qIdx}" value="${optIdx}">
            <span>${esc(opt)}</span>
          </label>
        `).join('')}
      </div>
      <div class="quiz-feedback" id="quiz_feedback_${qIdx}"></div>
    </div>
  `).join('');
}

function evaluateQuiz() {
  let correctCount = 0;

  SAMPLE_QUIZ.forEach((item, qIdx) => {
    const selected = $(`input[name="quiz_q_${qIdx}"]:checked`);
    const feedback = $(`#quiz_feedback_${qIdx}`);

    if (selected && parseInt(selected.value, 10) === item.answer) {
      correctCount++;
      if (feedback) {
        feedback.className = 'quiz-feedback feedback-correct';
        feedback.innerHTML = `&#10004; Correct! ${esc(item.explanation)}`;
      }
    } else {
      if (feedback) {
        feedback.className = 'quiz-feedback feedback-incorrect';
        feedback.innerHTML = `&#10008; Incorrect. Answer: ${esc(item.options[item.answer])}. ${esc(item.explanation)}`;
      }
    }
  });

  if (correctCount === SAMPLE_QUIZ.length) {
    awardBadge('quiz-master');
    showToast('Congratulations! Perfect score! You unlocked the Forest Master badge! 🏆', 'success', 6000);
  } else {
    showToast(`You scored ${correctCount} / ${SAMPLE_QUIZ.length}. Review answers above!`, 'info', 5000);
  }
}

export function awardBadge(badgeId) {
  const progress = state.userData.progress || { badges: [], quizzes: {} };
  if (!progress.badges.includes(badgeId)) {
    progress.badges.push(badgeId);
    state.userData.progress = progress;
    const badge = BADGES_CATALOG.find(b => b.id === badgeId);
    if (badge) {
      showToast(`Badge Unlocked: ${badge.name}! 🏅`);
    }
    emit('badge:unlocked', badgeId);
  }
}
