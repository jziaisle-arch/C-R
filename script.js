/**
 * Imposter Who? - Core Game Logic
 */

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, duration, type = 'sine') {
    if (this.muted) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) { 
      console.error(e); 
    }
  }

  playClick() { 
    this.playTone(600, 0.05, 'triangle'); 
  }
  
  playReveal() { 
    this.playTone(400, 0.1, 'sine');
    setTimeout(() => this.playTone(800, 0.2, 'sine'), 100);
  }
}

const audio = new SoundController();

// Game State
let categoriesData = {};
let players = [];
let assignedRoles = [];
let currentRevealIndex = 0;
let isGameInProgress = false;
let usedWordsHistory = new Set();

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const privacyScreen = document.getElementById('privacy-screen');
const revealScreen = document.getElementById('reveal-screen');
const starterScreen = document.getElementById('starter-screen');
const resultsScreen = document.getElementById('results-screen');

const categorySelect = document.getElementById('category-select');
const playerNameInput = document.getElementById('player-name-input');
const addPlayerBtn = document.getElementById('add-player-btn');
const playerList = document.getElementById('player-list');
const playerCountLabel = document.getElementById('player-count-label');
const impostorCountSelect = document.getElementById('impostor-count-select');
const startGameBtn = document.getElementById('start-game-btn');
const noClueToggle = document.getElementById('no-clue-toggle');

const nextUpPlayerName = document.getElementById('next-up-player-name');
const confirmPassBtn = document.getElementById('confirm-pass-btn');

const currentPlayerName = document.getElementById('current-player-name');
const secretWordDisplay = document.getElementById('secret-word-display');
const currentPlayerIndex = document.getElementById('current-player-index');
const totalPlayersIndex = document.getElementById('total-players-index');
const nextPlayerBtn = document.getElementById('next-player-btn');

const starterPlayerName = document.getElementById('starter-player-name');
const proceedBtn = document.getElementById('proceed-btn');

const resultsSummary = document.getElementById('results-summary');
const showImpostorBtn = document.getElementById('show-impostor-btn');
const newGameBtn = document.getElementById('new-game-btn');
const muteBtn = document.getElementById('mute-btn');

window.addEventListener('DOMContentLoaded', async () => {
  loadSavedPlayers();
  await fetchWords();
  setupEventListeners();
  setupHoldCard();
  setupRefreshPreventer();
  updatePlayerUI();
});

function setupRefreshPreventer() {
  window.addEventListener('beforeunload', (e) => {
    if (isGameInProgress) {
      e.preventDefault();
      e.returnValue = ''; 
    }
  });
}

async function fetchWords() {
  try {
    const res = await fetch('words.json');
    categoriesData = await res.json();
    populateCategories();
  } catch (e) {
    console.error('Error loading word data:', e);
  }
}

function populateCategories() {
  categorySelect.innerHTML = '';
  
  const allOpt = document.createElement('option');
  allOpt.value = "ALL";
  allOpt.textContent = "All Categories";
  categorySelect.appendChild(allOpt);

  Object.keys(categoriesData).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

function setupEventListeners() {
  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
  });

  addPlayerBtn.addEventListener('click', addPlayer);
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlayer();
  });

  startGameBtn.addEventListener('click', startGame);
  confirmPassBtn.addEventListener('click', showRevealCardScreen);
  nextPlayerBtn.addEventListener('click', advanceRevealScreen);
  proceedBtn.addEventListener('click', handleProceedFromStarter);
  showImpostorBtn.addEventListener('click', revealImpostors);
  newGameBtn.addEventListener('click', resetToSetup);
}

function addPlayer() {
  const name = playerNameInput.value.trim();
  if (name && !players.includes(name)) {
    players.push(name);
    playerNameInput.value = '';
    savePlayers();
    updatePlayerUI();
    audio.playClick();
  }
}

function removePlayer(name) {
  players = players.filter(p => p !== name);
  savePlayers();
  updatePlayerUI();
  audio.playClick();
}

function updatePlayerUI() {
  playerList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.className = 'player-tag';
    li.innerHTML = `${p} <button onclick="removePlayer('${p}')">&times;</button>`;
    playerList.appendChild(li);
  });
  
  playerCountLabel.textContent = players.length;
  startGameBtn.disabled = players.length < 3;
}

function savePlayers() {
  localStorage.setItem('game_players', JSON.stringify(players));
}

function loadSavedPlayers() {
  const saved = localStorage.getItem('game_players');
  if (saved) players = JSON.parse(saved);
}

function startGame() {
  audio.playClick();
  isGameInProgress = true;

  const selectedCat = categorySelect.value;
  
  let wordList = [];
  if (selectedCat === "ALL") {
    Object.values(categoriesData).forEach(pairs => {
      wordList = wordList.concat(pairs);
    });
  } else {
    wordList = categoriesData[selectedCat] || [];
  }

  let unusedWords = wordList.filter(pair => !usedWordsHistory.has(pair.civilian));
  if (unusedWords.length === 0) {
    usedWordsHistory.clear();
    unusedWords = [...wordList];
  }

  const defaultPair = unusedWords[Math.floor(Math.random() * unusedWords.length)];
  usedWordsHistory.add(defaultPair.civilian);

  const selectedImpostors = parseInt(impostorCountSelect.value, 10);
  const noClueMode = noClueToggle.checked;

  const impostorIndices = new Set();
  const isSpecialRound = Math.random() < 0.005;
  let isTrollRound = false;

  if (isSpecialRound) {
    if (Math.random() < 0.5) {
      isTrollRound = true;
      players.forEach((_, idx) => impostorIndices.add(idx));
    } else {
      impostorIndices.clear();
    }
  } else {
    while (impostorIndices.size < Math.min(selectedImpostors, players.length)) {
      impostorIndices.add(Math.floor(Math.random() * players.length));
    }
  }

  const availableImpostorWords = wordList
    .map(pair => pair.impostor)
    .sort(() => Math.random() - 0.5);

  assignedRoles = players.map((player, idx) => {
    const isImpostor = impostorIndices.has(idx);
    let word = defaultPair.civilian;

    if (isTrollRound) {
      const uniqueWord = availableImpostorWords[idx % availableImpostorWords.length];
      word = noClueMode ? "???" : uniqueWord;
    } else if (isImpostor) {
      word = noClueMode ? "???" : defaultPair.impostor;
    }

    return { name: player, word: word, isImpostor: isImpostor };
  });

  currentRevealIndex = 0;
  setupScreen.classList.add('hidden');
  showPrivacyPassScreen();
}

function showPrivacyPassScreen() {
  const currentPlayer = assignedRoles[currentRevealIndex];
  nextUpPlayerName.textContent = currentPlayer.name;
  
  revealScreen.classList.add('hidden');
  privacyScreen.classList.remove('hidden');
}

function showRevealCardScreen() {
  audio.playClick();
  privacyScreen.classList.add('hidden');
  revealScreen.classList.remove('hidden');
  updateRevealCard();
}

function setupHoldCard() {
  const holdCard = document.getElementById('hold-card');
  const cardFront = holdCard.querySelector('.hold-card-front');
  const cardBack = document.getElementById('hold-card-back');

  const startHold = (e) => {
    e.preventDefault();
    audio.playReveal();
    cardFront.classList.add('hidden');
    cardBack.classList.remove('hidden');
    nextPlayerBtn.classList.remove('hidden');
  };

  const endHold = (e) => {
    e.preventDefault();
    cardFront.classList.remove('hidden');
    cardBack.classList.add('hidden');
  };

  holdCard.addEventListener('mousedown', startHold);
  holdCard.addEventListener('mouseup', endHold);
  holdCard.addEventListener('mouseleave', endHold);

  holdCard.addEventListener('touchstart', startHold, { passive: false });
  holdCard.addEventListener('touchend', endHold, { passive: false });
}

function updateRevealCard() {
  const currentPlayer = assignedRoles[currentRevealIndex];
  currentPlayerName.textContent = currentPlayer.name;
  secretWordDisplay.textContent = currentPlayer.word;

  currentPlayerIndex.textContent = currentRevealIndex + 1;
  totalPlayersIndex.textContent = assignedRoles.length;
  
  if (currentRevealIndex === assignedRoles.length - 1) {
    nextPlayerBtn.textContent = "Start Game";
  } else {
    nextPlayerBtn.textContent = "Next Player";
  }

  nextPlayerBtn.classList.add('hidden');
}

function advanceRevealScreen() {
  audio.playClick();
  currentRevealIndex++;

  if (currentRevealIndex < assignedRoles.length) {
    showPrivacyPassScreen();
  } else {
    revealScreen.classList.add('hidden');
    showStarterScreen();
  }
}

function showStarterScreen() {
  const randomStarter = players[Math.floor(Math.random() * players.length)];
  starterPlayerName.textContent = randomStarter;
  starterScreen.classList.remove('hidden');
}

function handleProceedFromStarter() {
  audio.playClick();
  starterScreen.classList.add('hidden');
  showResults();
}

function showResults() {
  resultsScreen.classList.remove('hidden');

  showImpostorBtn.classList.remove('hidden');
  resultsSummary.classList.add('hidden');

  resultsSummary.innerHTML = '';
  assignedRoles.forEach(r => {
    const row = document.createElement('div');
    row.className = 'result-row';
    const roleClass = r.isImpostor ? 'role-impostor' : 'role-civilian';
    const roleText = r.isImpostor ? 'Imposter' : 'Civilian';

    row.innerHTML = `
      <div>
        <strong>${r.name}</strong>
        <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Word: ${r.word}</div>
      </div>
      <span class="role-badge ${roleClass}">${roleText}</span>
    `;
    resultsSummary.appendChild(row);
  });
}

function revealImpostors() {
  audio.playClick();
  showImpostorBtn.classList.add('hidden');
  resultsSummary.classList.remove('hidden');
  triggerConfetti();
}

function resetToSetup() {
  audio.playClick();
  isGameInProgress = false;
  resultsScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
}

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 60 }).map(() => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10 - 3,
    color: `hsl(${Math.random() * 360}, 80%, 60%)`,
    size: Math.random() * 5 + 3,
    life: 80
  }));

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach(p => {
      if (p.life > 0) {
        active = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    });

    if (active) requestAnimationFrame(render);
  }

  render();
}
