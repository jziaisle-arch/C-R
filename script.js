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

// State Variables
let categoriesData = {};
let players = [];
let assignedRoles = [];
let currentRevealIndex = 0;
let isGameInProgress = false;
let usedWordsHistory = new Set();

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
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
const trollModeToggle = document.getElementById('troll-mode-toggle');

const currentPlayerName = document.getElementById('current-player-name');
const secretWordDisplay = document.getElementById('secret-word-display');
const currentPlayerIndex = document.getElementById('current-player-index');
const totalPlayersIndex = document.getElementById('total-players-index');
const nextPlayerBtn = document.getElementById('next-player-btn');

const holdCardInner = document.getElementById('hold-card-inner');
const holdCardWrapper = document.getElementById('hold-card-wrapper');

const starterPlayerName = document.getElementById('starter-player-name');
const proceedBtn = document.getElementById('proceed-btn');

const resultsCardInner = document.getElementById('results-card-inner');
const impostorNamesDisplay = document.getElementById('impostor-names-display');
const civilianWordDisplay = document.getElementById('civilian-word-display');

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
  allOpt.value = 'ALL';
  allOpt.textContent = '✨ All Categories';
  categorySelect.appendChild(allOpt);

  Object.keys(categoriesData).forEach((cat) => {
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
  players = players.filter((p) => p !== name);
  savePlayers();
  updatePlayerUI();
  audio.playClick();
}

function updatePlayerUI() {
  playerList.innerHTML = '';
  players.forEach((p) => {
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
  if (Object.keys(categoriesData).length === 0) {
    alert('Word categories are still loading or unavailable.');
    return;
  }

  audio.playClick();
  isGameInProgress = true;

  const selectedCat = categorySelect.value;
  let wordList = [];

  if (selectedCat === 'ALL') {
    Object.values(categoriesData).forEach((pairs) => {
      wordList = wordList.concat(pairs);
    });
  } else {
    wordList = categoriesData[selectedCat] || [];
  }

  if (wordList.length === 0) {
    alert('No words found for this category.');
    return;
  }

  let unusedWords = wordList.filter((pair) => !usedWordsHistory.has(pair.civilian));
  if (unusedWords.length === 0) {
    usedWordsHistory.clear();
    unusedWords = [...wordList];
  }

  const defaultPair = unusedWords[Math.floor(Math.random() * unusedWords.length)];
  usedWordsHistory.add(defaultPair.civilian);

  const selectedImpostors = parseInt(impostorCountSelect.value, 10);
  const noClueMode = noClueToggle.checked;

  const isTrollModeEnabled = trollModeToggle.checked;
  const isTrollRound = isTrollModeEnabled && Math.random() < 0.04;

  const impostorIndices = new Set();

  if (!isTrollRound) {
    while (impostorIndices.size < Math.min(selectedImpostors, players.length)) {
      impostorIndices.add(Math.floor(Math.random() * players.length));
    }
  }

  assignedRoles = players.map((player, idx) => {
    const isImpostor = impostorIndices.has(idx);
    let word = defaultPair.civilian;

    if (isImpostor) {
      word = noClueMode ? '???' : defaultPair.impostor;
    }

    return { name: player, word: word, isImpostor: isImpostor };
  });

  currentRevealIndex = 0;
  setupScreen.classList.add('hidden');
  revealScreen.classList.remove('hidden');

  updateRevealCard();
}

function setupHoldCard() {
  const startHold = (e) => {
    e.preventDefault();
    audio.playReveal();
    holdCardInner.classList.add('is-flipped');
    
    // Smoothly fade out button container when card is held
    nextPlayerBtn.parentElement.classList.add('visibility-hidden');
  };

  const endHold = (e) => {
    e.preventDefault();
    holdCardInner.classList.remove('is-flipped');
    
    // Smoothly fade back in when card is released
    nextPlayerBtn.parentElement.classList.remove('visibility-hidden');
  };

  holdCardWrapper.addEventListener('mousedown', startHold);
  holdCardWrapper.addEventListener('mouseup', endHold);
  holdCardWrapper.addEventListener('mouseleave', endHold);

  holdCardWrapper.addEventListener('touchstart', startHold, { passive: false });
  holdCardWrapper.addEventListener('touchend', endHold, { passive: false });
}

function updateRevealCard() {
  holdCardInner.classList.remove('is-flipped');

  const currentPlayer = assignedRoles[currentRevealIndex];
  currentPlayerName.textContent = currentPlayer.name;
  secretWordDisplay.textContent = currentPlayer.word;

  currentPlayerIndex.textContent = currentRevealIndex + 1;
  totalPlayersIndex.textContent = assignedRoles.length;

  if (currentRevealIndex === assignedRoles.length - 1) {
    nextPlayerBtn.textContent = 'Start Discussion';
  } else {
    nextPlayerBtn.textContent = 'Next Player';
  }

  // Keep button container hidden until user holds & releases the next card
  nextPlayerBtn.parentElement.classList.add('visibility-hidden');
}

function advanceRevealScreen() {
  audio.playClick();

  // 1. Instantly hide button to prevent text flickers
  nextPlayerBtn.parentElement.classList.add('visibility-hidden');

  currentRevealIndex++;

  if (currentRevealIndex < assignedRoles.length) {
    holdCardWrapper.classList.add('slide-out');

    // 2. Delay content update until card slides away
    setTimeout(() => {
      updateRevealCard();
      holdCardWrapper.classList.remove('slide-out');
      holdCardWrapper.classList.add('slide-in');

      setTimeout(() => {
        holdCardWrapper.classList.remove('slide-in');
      }, 180);
    }, 180);
  } else {
    revealScreen.classList.add('hidden');
    showStarterScreen();
  }
}

function showStarterScreen() {
  const randomStarter = players[Math.floor(Math.random() * players.length)];
  starterPlayerName.textContent = randomStarter;

  // Reset card state to ensure clean pop-in animation
  const card = starterScreen.querySelector('.starter-card');
  if (card) {
    card.classList.remove('fade-out');
  }

  starterScreen.classList.remove('hidden');
}

function handleProceedFromStarter() {
  audio.playClick();

  const card = starterScreen.querySelector('.starter-card');
  if (card) {
    card.classList.add('fade-out');
  }

  setTimeout(() => {
    starterScreen.classList.add('hidden');
    showResults();
  }, 220);
}

function showResults() {
  const resultsCardWrapper = document.getElementById('results-card-wrapper');
  
  // Ensure wrapper card animation resets when entering screen
  if (resultsCardWrapper) {
    resultsCardWrapper.classList.remove('fade-out');
  }

  resultsScreen.classList.remove('hidden');
  showImpostorBtn.classList.remove('hidden');
  newGameBtn.classList.add('hidden');

  // Reset Card to Front Face
  resultsCardInner.classList.remove('is-flipped');

  // 1. Find Impostor Names
  const impostors = assignedRoles.filter((r) => r.isImpostor);
  if (impostors.length > 0) {
    impostorNamesDisplay.innerHTML = impostors.map((i) => `<div>${i.name}</div>`).join('');
  } else {
    // Troll Mode (Everyone was Civilian)
    impostorNamesDisplay.innerHTML = `<div style="color: #22c55e;">NO ONE!<br><span style="font-size:0.9rem;">(Troll Round 😜)</span></div>`;
  }

  // 2. Find Civilian Word
  const civilianPlayer = assignedRoles.find((r) => !r.isImpostor) || assignedRoles[0];
  civilianWordDisplay.textContent = civilianPlayer ? civilianPlayer.word : '???';
}

function revealImpostors() {
  audio.playReveal();

  // Flip card over smoothly!
  resultsCardInner.classList.add('is-flipped');

  showImpostorBtn.classList.add('hidden');
  newGameBtn.classList.remove('hidden');
}

function resetToSetup() {
  audio.playClick();
  
  const resultsCardWrapper = document.getElementById('results-card-wrapper');
  if (resultsCardWrapper) {
    resultsCardWrapper.classList.add('fade-out');
  }

  setTimeout(() => {
    isGameInProgress = false;
    resultsScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
  }, 220);
}
