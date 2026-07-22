/**
 * Imposter Who? - Complete Logic with Refresh Preventer Guard
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
    } catch (e) { console.error(e); }
  }

  playClick() { this.playTone(600, 0.05, 'triangle'); }
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

let currentVoterIndex = 0;
let voteTallies = {};
let votingEnabled = true;
let isGameInProgress = false; // Flag para sa Refresh Preventer

let usedWordsHistory = new Set(); // History tracker para walang ulitan

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const revealScreen = document.getElementById('reveal-screen');
const starterScreen = document.getElementById('starter-screen');
const votingScreen = document.getElementById('voting-screen');
const resultsScreen = document.getElementById('results-screen');

const categorySelect = document.getElementById('category-select');
const playerNameInput = document.getElementById('player-name-input');
const addPlayerBtn = document.getElementById('add-player-btn');
const playerList = document.getElementById('player-list');
const playerCountLabel = document.getElementById('player-count-label');
const impostorCountSelect = document.getElementById('impostor-count-select');
const startGameBtn = document.getElementById('start-game-btn');
const votingToggle = document.getElementById('voting-toggle');
const noClueToggle = document.getElementById('no-clue-toggle');

const currentPlayerName = document.getElementById('current-player-name');
const secretWordDisplay = document.getElementById('secret-word-display');
const currentPlayerIndex = document.getElementById('current-player-index');
const totalPlayersIndex = document.getElementById('total-players-index');
const nextPlayerBtn = document.getElementById('next-player-btn');

const starterPlayerName = document.getElementById('starter-player-name');
const proceedBtn = document.getElementById('proceed-btn');

const currentVoterName = document.getElementById('current-voter-name');
const currentVoterIndexEl = document.getElementById('current-voter-index');
const totalVotersIndexEl = document.getElementById('total-voters-index');
const individualVoteSelect = document.getElementById('individual-vote-select');
const submitIndividualVoteBtn = document.getElementById('submit-individual-vote-btn');

const resultsSummary = document.getElementById('results-summary');
const mostVotedBanner = document.getElementById('most-voted-banner');
const showImpostorBtn = document.getElementById('show-impostor-btn');
const newGameBtn = document.getElementById('new-game-btn');
const muteBtn = document.getElementById('mute-btn');

window.addEventListener('DOMContentLoaded', async () => {
  loadSavedPlayers();
  await fetchWords();
  setupEventListeners();
  setupHoldCard();
  setupRefreshPreventer(); // I-initialize ang Refresh Preventer
  updatePlayerUI();
});

/* REFRESH PREVENTER FUNCTION */
function setupRefreshPreventer() {
  window.addEventListener('beforeunload', (e) => {
    if (isGameInProgress) {
      // Pinipigilan ang pag-refresh kapag ongoing ang laro
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
    console.error('Error loading JSON data:', e);
  }
}

function populateCategories() {
  categorySelect.innerHTML = '';
  
  const allOpt = document.createElement('option');
  allOpt.value = "ALL";
  allOpt.textContent = "✨ All Categories Combined";
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
  nextPlayerBtn.addEventListener('click', advanceRevealScreen);
  proceedBtn.addEventListener('click', handleProceedFromStarter);
  submitIndividualVoteBtn.addEventListener('click', handleIndividualVoteSubmit);
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
  isGameInProgress = true; // I-activate ang Refresh Guard

  votingEnabled = votingToggle.checked;
  const selectedCat = categorySelect.value;
  
  let wordList = [];
  if (selectedCat === "ALL") {
    Object.values(categoriesData).forEach(pairs => {
      wordList = wordList.concat(pairs);
    });
  } else {
    wordList = categoriesData[selectedCat] || [];
  }

  // Filter out used words
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
    nextPlayerBtn.textContent = "Start Discussion";
  } else {
    nextPlayerBtn.textContent = "Next Player";
  }

  nextPlayerBtn.classList.add('hidden');
}

function advanceRevealScreen() {
  audio.playClick();
  currentRevealIndex++;

  if (currentRevealIndex < assignedRoles.length) {
    updateRevealCard();
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

  if (votingEnabled) {
    votingScreen.classList.remove('hidden');
    startIndividualVoting();
  } else {
    showResults(false);
  }
}

function startIndividualVoting() {
  currentVoterIndex = 0;
  voteTallies = {};
  players.forEach(p => voteTallies[p] = 0);
  updateIndividualVoterCard();
}

function updateIndividualVoterCard() {
  const voter = players[currentVoterIndex];
  currentVoterName.textContent = voter;
  
  currentVoterIndexEl.textContent = currentVoterIndex + 1;
  totalVotersIndexEl.textContent = players.length;

  individualVoteSelect.innerHTML = '';
  players.forEach(target => {
    if (target !== voter) {
      const opt = document.createElement('option');
      opt.value = target;
      opt.textContent = target;
      individualVoteSelect.appendChild(opt);
    }
  });
}

function handleIndividualVoteSubmit() {
  audio.playClick();
  const selectedTarget = individualVoteSelect.value;
  
  if (selectedTarget) {
    voteTallies[selectedTarget] = (voteTallies[selectedTarget] || 0) + 1;
  }

  currentVoterIndex++;

  if (currentVoterIndex < players.length) {
    updateIndividualVoterCard();
  } else {
    showResults(true);
  }
}

function showResults(hasVoted = true) {
  votingScreen.classList.add('hidden');
  resultsScreen.classList.remove('hidden');

  showImpostorBtn.classList.remove('hidden');
  resultsSummary.classList.add('hidden');
  mostVotedBanner.classList.add('hidden');

  if (hasVoted) {
    let maxVotes = -1;
    let mostVotedPlayers = [];

    Object.entries(voteTallies).forEach(([player, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedPlayers = [player];
      } else if (count === maxVotes && count > 0) {
        mostVotedPlayers.push(player);
      }
    });

    mostVotedBanner.classList.remove('hidden');
    if (mostVotedPlayers.length === 1 && maxVotes > 0) {
      mostVotedBanner.textContent = `Most Voted Out: ${mostVotedPlayers[0]} (${maxVotes} votes)`;
    } else if (mostVotedPlayers.length > 1 && maxVotes > 0) {
      mostVotedBanner.textContent = `Tied Votes: ${mostVotedPlayers.join(', ')} (${maxVotes} votes each)`;
    } else {
      mostVotedBanner.textContent = `No votes were cast!`;
    }
  }

  resultsSummary.innerHTML = '';
  assignedRoles.forEach(r => {
    const row = document.createElement('div');
    row.className = 'result-row';
    const roleClass = r.isImpostor ? 'role-impostor' : 'role-civilian';
    const roleText = r.isImpostor ? 'Imposter' : 'Civilian';

    row.innerHTML = `
      <span>${r.name}</span> 
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
  isGameInProgress = false; // I-off ang Refresh Guard kapag bumalik sa setup
  resultsScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
}

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 80 }).map(() => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12 - 4,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    size: Math.random() * 6 + 4,
    life: 100
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
