/**
 * SEND THE WAVE - Client
 * Gère le rendu, les contrôles et la communication serveur
 */

// === SYSTÈME DE SONS ===
const Sounds = {
  enabled: true,
  volume: 0.3,
  audioContext: null,
  
  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('[SOUND] AudioContext non supporté');
      this.enabled = false;
    }
  },
  
  // Générer un son simple avec oscillateur
  play(type, frequency = 440, duration = 0.1) {
    if (!this.enabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail
    }
  },
  
  // Sons prédéfinis
  towerPlace() { this.play('sine', 520, 0.15); this.play('sine', 660, 0.1); },
  towerUpgrade() { this.play('sine', 440, 0.1); this.play('sine', 550, 0.1); this.play('sine', 660, 0.15); },
  towerSell() { this.play('sawtooth', 300, 0.2); },
  waveSend() { this.play('square', 200, 0.1); this.play('square', 250, 0.1); },
  creepDeath() { this.play('sine', 800, 0.05); },
  damage() { this.play('sawtooth', 150, 0.2); },
  combo() { this.play('sine', 440, 0.1); this.play('sine', 550, 0.1); this.play('sine', 660, 0.1); this.play('sine', 880, 0.2); },
  victory() { this.play('sine', 523, 0.2); this.play('sine', 659, 0.2); this.play('sine', 784, 0.3); },
  defeat() { this.play('sawtooth', 200, 0.3); this.play('sawtooth', 150, 0.4); },
  click() { this.play('sine', 600, 0.05); },
  error() { this.play('square', 200, 0.15); }
};

// === ÉTAT GLOBAL ===
const Game = {
  socket: null,
  screen: 'menu',
  
  // Joueur local
  playerId: null,
  playerName: '',
  playerIndex: 0,
  
  // Room
  roomCode: null,
  isHost: false,
  vsAI: false,
  aiDifficulty: 'NORMAL',
  
  // État de jeu (reçu du serveur)
  state: null,
  constants: null,
  
  // Carte
  map: null,
  mapId: null,
  
  // Combo
  comboDisplay: null,  // { text, alpha, time }
  
  // Sélection UI
  selectedTowerType: null,
  selectedTower: null,
  placementMode: false,
  
  // Canvas
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  
  // Zoom et pan mobile
  minScale: 0.5,
  maxScale: 2.0,
  panX: 0,
  panY: 0,
  lastTapTime: 0,
  
  // Rendu
  lastRender: 0,
  fps: 0,
  frameCount: 0,
  lastFpsUpdate: 0,
  
  // Interpolation
  prevState: null,
  stateTime: 0,
  
  // Touch
  touchStart: null,
  isDragging: false,
  
  // === DÉTECTION APPAREIL ET TAILLES ADAPTATIVES ===
  isMobile: false,
  isTablet: false,
  deviceType: 'desktop', // 'mobile', 'tablet', 'desktop'
  
  // Facteurs de taille selon l'appareil (seront calculés dans detectDevice)
  sizeFactor: 1.0,
  
  // Tailles calculées (mises à jour par updateSizes)
  sizes: {
    // Tours
    towerRadius: 18,
    towerEmoji: 20,
    towerBorder: 2,
    towerLevelFont: 10,
    
    // Creeps (facteurs appliqués aux tailles de base)
    creepScale: 1.0,
    creepEmojiScale: 1.0,
    creepHpBarHeight: 4,
    
    // Projectiles
    projectileSize: 5,
    
    // Général
    minCreepSize: 6,
    maxCreepSize: 24
  }
};

/**
 * Détecte le type d'appareil et configure les tailles
 */
function detectDevice() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minDimension = Math.min(width, height);
  
  // Détection basée sur la taille d'écran et le touch
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  if (minDimension < 500 || (hasTouch && width < 768)) {
    Game.isMobile = true;
    Game.isTablet = false;
    Game.deviceType = 'mobile';
    Game.sizeFactor = 0.6; // 60% de la taille normale
  } else if (minDimension < 900 || (hasTouch && width < 1024)) {
    Game.isMobile = false;
    Game.isTablet = true;
    Game.deviceType = 'tablet';
    Game.sizeFactor = 0.85; // 85% de la taille normale
  } else {
    Game.isMobile = false;
    Game.isTablet = false;
    Game.deviceType = 'desktop';
    Game.sizeFactor = 1.0; // Taille normale
  }
  
  updateSizes();
  console.log(`[DEVICE] Type: ${Game.deviceType}, Factor: ${Game.sizeFactor}, Screen: ${width}x${height}`);
}

/**
 * Met à jour les tailles en fonction du facteur et du zoom
 */
function updateSizes() {
  const factor = Game.sizeFactor;
  
  // Facteur de zoom inversé (plus on zoom, plus les éléments peuvent être petits visuellement)
  // Mais on garde une taille minimum lisible
  const zoomFactor = Math.max(0.7, Math.min(1.3, 1 / Game.scale));
  const combinedFactor = factor * zoomFactor;
  
  Game.sizes = {
    // Tours - taille fixe mais adaptée à l'appareil
    towerRadius: Math.round(18 * factor),
    towerEmoji: Math.round(20 * factor),
    towerBorder: Math.max(1, Math.round(2 * factor)),
    towerLevelFont: Math.round(10 * factor),
    towerRangeIndicator: Math.round(25 * factor),
    
    // Creeps - s'adaptent au zoom aussi
    creepScale: combinedFactor,
    creepEmojiScale: combinedFactor,
    creepHpBarHeight: Math.max(2, Math.round(4 * factor)),
    creepBorder: Math.max(1, Math.round(2 * factor)),
    
    // Projectiles
    projectileSize: Math.max(2, Math.round(5 * combinedFactor)),
    projectileTrail: Math.max(2, Math.round(4 * combinedFactor)),
    
    // Limites pour les creeps
    minCreepSize: Game.isMobile ? 5 : 8,
    maxCreepSize: Game.isMobile ? 16 : 24,
    
    // Mode simplifié sur mobile (cercles au lieu d'emojis si trop petit)
    useSimpleMode: Game.isMobile && Game.scale < 0.8
  };
}

// === INITIALISATION ===
document.addEventListener('DOMContentLoaded', () => {
  // Détecter le type d'appareil en premier
  detectDevice();
  
  Sounds.init();
  initSocket();
  initUI();
  initCanvas();
  
  // Charger le nom sauvegardé
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    document.getElementById('player-name').value = savedName;
  }
  
  // Stats serveur
  fetchStats();
  setInterval(fetchStats, 10000);
  
  // Boucle de rendu
  requestAnimationFrame(render);
  
  // Activer le son au premier clic (requis par les navigateurs)
  document.addEventListener('click', () => {
    if (Sounds.audioContext && Sounds.audioContext.state === 'suspended') {
      Sounds.audioContext.resume();
    }
  }, { once: true });
  
  // Re-détecter si la fenêtre change de taille (rotation, etc.)
  window.addEventListener('resize', () => {
    detectDevice();
  });
});

// === SOCKET.IO ===
function initSocket() {
  Game.socket = io();
  
  // Connexion
  Game.socket.on('connect', () => {
    Game.playerId = Game.socket.id;
    console.log('[SOCKET] Connecté:', Game.playerId);
  });
  
  Game.socket.on('disconnect', () => {
    console.log('[SOCKET] Déconnecté');
    showNotification('Connexion perdue', 'error');
    showScreen('menu');
  });
  
  // Nom défini
  Game.socket.on('nameSet', (name) => {
    Game.playerName = name;
  });
  
  // Room créée
  Game.socket.on('roomCreated', (data) => {
    Game.roomCode = data.code;
    Game.isHost = true;
    Game.vsAI = data.vsAI || false;
    updateLobby(data);
    if (!data.vsAI) {
      showScreen('lobby');
    }
  });
  
  // Room rejointe
  Game.socket.on('roomJoined', (data) => {
    Game.roomCode = data.code;
    Game.isHost = false;
    updateLobby(data);
    showScreen('lobby');
  });
  
  // Joueur rejoint
  Game.socket.on('playerJoined', (player) => {
    showNotification(`${player.name} a rejoint`, 'info');
    // Mettre à jour la liste
    const room = { players: [] };
    document.querySelectorAll('.player-item').forEach(el => {
      room.players.push({ name: el.dataset.name, ready: el.classList.contains('ready') });
    });
    room.players.push(player);
    updatePlayersList(room.players);
  });
  
  // Joueur parti
  Game.socket.on('playerLeft', (playerId) => {
    showNotification('Un joueur a quitté', 'info');
  });
  
  // Joueur prêt
  Game.socket.on('playerReady', (data) => {
    updatePlayerReady(data.playerId, data.ready);
    if (data.allReady) {
      document.getElementById('lobby-status').textContent = 'Tous prêts! Lancement...';
    }
  });
  
  // Room fermée
  Game.socket.on('roomClosed', (reason) => {
    showNotification(reason || 'La room a été fermée', 'error');
    showScreen('menu');
  });
  
  // Erreur
  Game.socket.on('error', (message) => {
    showNotification(message, 'error');
  });
  
  // === ÉVÉNEMENTS DE JEU ===
  
  // Partie démarre
  Game.socket.on('gameStarting', (data) => {
    console.log('[GAME] Démarrage...', data);
    Game.constants = data.constants;
    Game.map = data.map;
    Game.mapId = data.mapId;
    Game.state = null;
    Game.comboDisplay = null;
    
    // Trouver notre index
    const me = data.players.find(p => p.id === Game.playerId);
    if (me) {
      Game.playerIndex = me.index;
    }
    
    showScreen('game');
    
    // IMPORTANT: Recalculer le canvas maintenant qu'on a les constantes
    setTimeout(() => {
      resizeCanvas();
      // Activer les boutons dès le départ
      updateTowerButtons();
      updateWaveButtons();
    }, 50);
    
    showCountdown(data.countdown);
    
    // Afficher la carte
    showNotification(`Carte: ${Game.map.name}`, 'info');
    
    // Mise à jour HUD initial
    updateHUD(data.players);
  });
  
  // Mise à jour de jeu
  Game.socket.on('gameUpdate', (state) => {
    Game.prevState = Game.state;
    Game.state = state;
    Game.stateTime = Date.now();
    
    updateHUD();
    updateCooldowns();
  });
  
  // Tour placée
  Game.socket.on('towerPlaced', (tower) => {
    Sounds.towerPlace();
    showNotification('Tour placée!', 'success');
    Game.selectedTowerType = null;
    Game.placementMode = false;
    updateTowerButtons();
  });
  
  // Tour améliorée
  Game.socket.on('towerUpgraded', (tower) => {
    Sounds.towerUpgrade();
    showNotification('Tour améliorée!', 'success');
    if (Game.selectedTower && Game.selectedTower.id === tower.id) {
      Game.selectedTower = tower;
      updateTowerInfo();
    }
  });
  
  // Tour vendue
  Game.socket.on('towerSold', (data) => {
    Sounds.towerSell();
    showNotification(`Tour vendue (+${data.refund}💰)`, 'success');
    Game.selectedTower = null;
    hideTowerInfo();
  });
  
  // Vague envoyée
  Game.socket.on('waveSent', (data) => {
    Sounds.waveSend();
    if (data.combo && data.combo.level >= 2) {
      Sounds.combo();
      Game.comboDisplay = {
        text: data.combo.name,
        level: data.combo.level,
        alpha: 1,
        time: Date.now()
      };
      showNotification(`${data.combo.name}`, 'success');
    } else {
      showNotification('Vague envoyée!', 'success');
    }
  });
  
  // Erreur d'action
  Game.socket.on('actionError', (error) => {
    Sounds.error();
    showNotification(error, 'error');
  });
  
  // Fin de partie
  Game.socket.on('gameEnded', (data) => {
    console.log('[GAME] Terminé:', data);
    if (data.winner === Game.playerId) {
      Sounds.victory();
    } else {
      Sounds.defeat();
    }
    showEndScreen(data);
  });
}

// === UI ===
function initUI() {
  // Menu principal
  document.getElementById('btn-quick-match').addEventListener('click', () => { Sounds.click(); quickMatch(); });
  document.getElementById('btn-create-room').addEventListener('click', () => { Sounds.click(); createRoom(); });
  document.getElementById('btn-join-room').addEventListener('click', () => { Sounds.click(); showJoinInput(); });
  document.getElementById('btn-vs-ai').addEventListener('click', () => { Sounds.click(); toggleAIOptions(); });
  
  // AI difficulty
  document.querySelectorAll('.ai-difficulty .btn-small').forEach(btn => {
    btn.addEventListener('click', () => {
      Sounds.click();
      document.querySelectorAll('.ai-difficulty .btn-small').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Game.aiDifficulty = btn.dataset.difficulty;
    });
  });
  
  // Bouton Lancer la partie VS IA
  document.getElementById('btn-start-ai').addEventListener('click', () => {
    Sounds.click();
    startAIGame();
  });
  
  // Join input
  document.getElementById('btn-join-submit').addEventListener('click', () => { Sounds.click(); joinRoom(); });
  document.getElementById('btn-join-cancel').addEventListener('click', () => { Sounds.click(); hideJoinInput(); });
  document.getElementById('room-code-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  // Lobby
  document.getElementById('btn-ready').addEventListener('click', () => { Sounds.click(); toggleReady(); });
  document.getElementById('btn-leave').addEventListener('click', () => { Sounds.click(); leaveRoom(); });
  
  // Jeu - Tours
  document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.addEventListener('click', () => { Sounds.click(); selectTower(btn.dataset.tower); });
  });
  
  // Jeu - Vagues
  document.querySelectorAll('.wave-btn').forEach(btn => {
    btn.addEventListener('click', () => { Sounds.click(); sendWave(btn.dataset.pack); });
  });
  
  // Jeu - Abandon
  document.getElementById('btn-surrender').addEventListener('click', () => {
    Sounds.click();
    surrender();
  });
  
  // Contrôles mobiles
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    Sounds.click();
    Game.scale = Math.min(Game.maxScale, Game.scale * 1.2);
    updateSizes(); // Mettre à jour les tailles
  });
  
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    Sounds.click();
    Game.scale = Math.max(Game.minScale, Game.scale / 1.2);
    updateSizes(); // Mettre à jour les tailles
  });
  
  document.getElementById('btn-reset-view').addEventListener('click', () => {
    Sounds.click();
    Game.panX = 0;
    Game.panY = 0;
    resizeCanvas(); // Reset scale aussi
    updateSizes(); // Mettre à jour les tailles
  });
  
  // Info tour
  document.getElementById('btn-upgrade-selected').addEventListener('click', () => { Sounds.click(); upgradeSelected(); });
  document.getElementById('btn-sell-selected').addEventListener('click', () => { Sounds.click(); sellSelected(); });
  document.getElementById('btn-close-info').addEventListener('click', () => { Sounds.click(); hideTowerInfo(); });
  
  // Fin
  document.getElementById('btn-play-again').addEventListener('click', () => { Sounds.click(); playAgain(); });
  document.getElementById('btn-back-menu').addEventListener('click', () => { Sounds.click(); backToMenu(); });
  
  // Nom du joueur
  document.getElementById('player-name').addEventListener('change', (e) => {
    const name = e.target.value.trim();
    if (name) {
      Game.playerName = name;
      localStorage.setItem('playerName', name);
      Game.socket.emit('setName', name);
    }
  });
}

function initCanvas() {
  Game.canvas = document.getElementById('game-canvas');
  Game.ctx = Game.canvas.getContext('2d');
  
  // Resize handler
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  
  // Events souris
  Game.canvas.addEventListener('click', handleCanvasClick);
  Game.canvas.addEventListener('mousemove', handleCanvasMove);
  
  // Events tactiles
  Game.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  Game.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  Game.canvas.addEventListener('touchend', handleTouchEnd);
  
  // Zoom avec pinch
  let lastPinchDistance = 0;
  Game.canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  Game.canvas.addEventListener('gesturechange', (e) => e.preventDefault());
  Game.canvas.addEventListener('gestureend', (e) => e.preventDefault());
}

function resizeCanvas() {
  const container = Game.canvas.parentElement;
  Game.canvas.width = container.clientWidth;
  Game.canvas.height = container.clientHeight;
  Game.width = Game.canvas.width;
  Game.height = Game.canvas.height;
  
  // Calculer l'échelle pour adapter la map
  // Utiliser des valeurs par défaut si constants pas encore chargées
  const mapWidth = Game.constants?.MAP?.WIDTH || 800;
  const mapHeight = Game.constants?.MAP?.HEIGHT || 600;
  
  Game.scale = Math.min(
    Game.width / mapWidth,
    (Game.height - 150) / mapHeight // Espace pour HUD
  );
  
  // S'assurer que l'échelle est valide
  if (Game.scale <= 0 || !isFinite(Game.scale)) {
    Game.scale = 1;
  }
  
  Game.offsetX = (Game.width - mapWidth * Game.scale) / 2;
  Game.offsetY = 60; // Sous le HUD
  
  console.log('[CANVAS] Resize:', Game.width, 'x', Game.height, 'scale:', Game.scale);
}

// === SCREENS ===
function showScreen(screenId) {
  Game.screen = screenId;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`${screenId}-screen`).classList.add('active');
}

// === MENU ACTIONS ===
function quickMatch() {
  const name = document.getElementById('player-name').value.trim() || 'Joueur';
  Game.socket.emit('setName', name);
  Game.socket.emit('quickMatch');
}

function createRoom() {
  const name = document.getElementById('player-name').value.trim() || 'Joueur';
  Game.socket.emit('setName', name);
  Game.socket.emit('createRoom', { isPrivate: false });
}

function showJoinInput() {
  document.getElementById('join-input').style.display = 'flex';
  document.getElementById('room-code-input').focus();
}

function hideJoinInput() {
  document.getElementById('join-input').style.display = 'none';
}

function joinRoom() {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (code.length < 3) {
    showNotification('Code invalide', 'error');
    return;
  }
  
  const name = document.getElementById('player-name').value.trim() || 'Joueur';
  Game.socket.emit('setName', name);
  Game.socket.emit('joinRoom', code);
}

function toggleAIOptions() {
  const options = document.getElementById('ai-options');
  if (options.style.display === 'none' || options.style.display === '') {
    options.style.display = 'block';
  } else {
    options.style.display = 'none';
  }
}

function startAIGame() {
  const name = document.getElementById('player-name').value.trim() || 'Joueur';
  localStorage.setItem('playerName', name);
  Game.socket.emit('setName', name);
  Game.socket.emit('playVsAI', Game.aiDifficulty);
  
  // Masquer les options
  document.getElementById('ai-options').style.display = 'none';
}

// === LOBBY ===
function updateLobby(data) {
  document.getElementById('lobby-room-code').textContent = data.code;
  
  const me = data.players.find(p => p.id === Game.playerId);
  if (me) {
    Game.playerIndex = me.index;
  }
  
  updatePlayersList(data.players);
}

function updatePlayersList(players) {
  const list = document.getElementById('players-list');
  list.innerHTML = '';
  
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-item' + (p.ready ? ' ready' : '');
    div.dataset.id = p.id;
    div.dataset.name = p.name;
    div.innerHTML = `
      <span>${p.isAI ? '🤖 ' : ''}${p.name}${p.id === Game.playerId ? ' (vous)' : ''}</span>
      <span class="ready-badge">${p.ready ? '✓ Prêt' : 'En attente'}</span>
    `;
    list.appendChild(div);
  });
}

function updatePlayerReady(playerId, ready) {
  const item = document.querySelector(`.player-item[data-id="${playerId}"]`);
  if (item) {
    item.classList.toggle('ready', ready);
    item.querySelector('.ready-badge').textContent = ready ? '✓ Prêt' : 'En attente';
  }
}

function toggleReady() {
  const btn = document.getElementById('btn-ready');
  const isReady = btn.classList.toggle('active');
  btn.textContent = isReady ? '✗ Annuler' : '✓ Prêt';
  Game.socket.emit('ready', isReady);
}

function leaveRoom() {
  Game.socket.emit('leaveRoom');
  showScreen('menu');
}

// === ABANDON ===
function surrender() {
  if (confirm('Êtes-vous sûr de vouloir abandonner ?')) {
    Sounds.defeat();
    Game.socket.emit('surrender');
    showNotification('Vous avez abandonné...', 'error');
  }
}

// === COUNTDOWN ===
function showCountdown(seconds) {
  const overlay = document.getElementById('countdown-overlay');
  const number = document.getElementById('countdown-number');
  overlay.style.display = 'flex';
  
  let count = seconds;
  number.textContent = count;
  
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      number.textContent = count;
    } else {
      clearInterval(interval);
      overlay.style.display = 'none';
      number.textContent = 'GO!';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }, 1000);
}

// === HUD ===
function updateHUD(players) {
  if (!Game.state && !players) return;
  
  const playersList = players || Game.state?.players;
  if (!playersList) return;
  
  // Trouver moi et l'adversaire
  const me = playersList.find(p => p.id === Game.playerId);
  const enemy = playersList.find(p => p.id !== Game.playerId);
  
  if (me) {
    document.getElementById('hud-my-name').textContent = me.name;
    document.getElementById('hud-my-hp').textContent = Math.max(0, Math.round(me.hp));
    document.getElementById('hud-my-hp-bar').style.width = `${Math.max(0, me.hp)}%`;
    document.getElementById('hud-my-gold').textContent = `💰 ${Math.round(me.gold)}`;
    
    // Activer/désactiver les boutons selon l'or
    updateTowerButtons();
    updateWaveButtons();
  }
  
  if (enemy) {
    document.getElementById('hud-enemy-name').textContent = enemy.name + (enemy.isAI ? ' 🤖' : '');
    document.getElementById('hud-enemy-hp').textContent = Math.max(0, Math.round(enemy.hp));
    document.getElementById('hud-enemy-hp-bar').style.width = `${Math.max(0, enemy.hp)}%`;
  }
  
  // Timer
  if (Game.state) {
    const minutes = Math.floor(Game.state.timeRemaining / 60);
    const seconds = Math.floor(Game.state.timeRemaining % 60);
    document.getElementById('hud-timer').textContent = 
      `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('hud-wave').textContent = `Vague ${Game.state.waveNumber}`;
  }
}

function updateTowerButtons() {
  if (!Game.constants) return;
  
  // Trouver l'or du joueur - depuis state ou valeur par défaut
  let myGold = 150; // Valeur par défaut
  if (Game.state && Game.state.players) {
    const me = Game.state.players.find(p => p.id === Game.playerId);
    if (me) myGold = me.gold;
  }
  
  document.querySelectorAll('.tower-btn').forEach(btn => {
    const towerType = btn.dataset.tower;
    const def = Game.constants.TOWERS[towerType];
    btn.disabled = myGold < def.cost;
    btn.classList.toggle('selected', Game.selectedTowerType === towerType);
  });
}

function updateWaveButtons() {
  if (!Game.constants) return;
  
  // Trouver l'or et cooldowns du joueur
  let myGold = 150;
  let myCooldowns = {};
  
  if (Game.state && Game.state.players) {
    const me = Game.state.players.find(p => p.id === Game.playerId);
    if (me) {
      myGold = me.gold;
      myCooldowns = me.packCooldowns || {};
    }
  }
  
  document.querySelectorAll('.wave-btn').forEach(btn => {
    const packId = btn.dataset.pack;
    const pack = Game.constants.WAVE_PACKS[packId];
    const cooldown = myCooldowns[packId] || 0;
    
    btn.disabled = myGold < pack.cost || cooldown > 0;
  });
}

function updateCooldowns() {
  if (!Game.state) return;
  
  const me = Game.state.players.find(p => p.id === Game.playerId);
  if (!me) return;
  
  // Boss cooldown display
  const bossCooldown = me.packCooldowns['BOSS_PACK'] || 0;
  const cooldownEl = document.getElementById('boss-cooldown');
  if (bossCooldown > 0) {
    cooldownEl.textContent = Math.ceil(bossCooldown) + 's';
  } else {
    cooldownEl.textContent = '';
  }
}

// === TOWER SELECTION ===
function selectTower(towerType) {
  if (Game.selectedTowerType === towerType) {
    // Désélectionner
    Game.selectedTowerType = null;
    Game.placementMode = false;
  } else {
    Game.selectedTowerType = towerType;
    Game.placementMode = true;
    Game.selectedTower = null;
    hideTowerInfo();
  }
  updateTowerButtons();
}

// === TOWER INFO PANEL ===
function showTowerInfo(tower) {
  Game.selectedTower = tower;
  Game.selectedTowerType = null;
  Game.placementMode = false;
  updateTowerButtons();
  
  const def = Game.constants.TOWERS[tower.type];
  const upgrade = tower.level > 1 ? def.upgrades[tower.level - 2] : null;
  
  document.getElementById('selected-tower-name').textContent = 
    `${def.emoji} ${def.name} Nv.${tower.level}`;
  
  const damage = upgrade?.damage || def.damage;
  const range = upgrade?.range || def.range;
  document.getElementById('selected-tower-stats').textContent = 
    `DMG: ${damage} | Portée: ${range}`;
  
  // Coût upgrade
  if (tower.level < 3) {
    const nextUpgrade = def.upgrades[tower.level - 1];
    document.getElementById('upgrade-cost').textContent = nextUpgrade.cost;
    document.getElementById('btn-upgrade-selected').disabled = false;
  } else {
    document.getElementById('upgrade-cost').textContent = 'MAX';
    document.getElementById('btn-upgrade-selected').disabled = true;
  }
  
  // Valeur vente
  let totalCost = def.cost;
  for (let i = 0; i < tower.level - 1; i++) {
    totalCost += def.upgrades[i].cost;
  }
  document.getElementById('sell-value').textContent = Math.floor(totalCost * 0.5);
  
  document.getElementById('tower-info').style.display = 'block';
}

function hideTowerInfo() {
  Game.selectedTower = null;
  document.getElementById('tower-info').style.display = 'none';
}

function updateTowerInfo() {
  if (Game.selectedTower) {
    showTowerInfo(Game.selectedTower);
  }
}

function upgradeSelected() {
  if (Game.selectedTower) {
    Game.socket.emit('upgradeTower', Game.selectedTower.id);
  }
}

function sellSelected() {
  if (Game.selectedTower) {
    Game.socket.emit('sellTower', Game.selectedTower.id);
  }
}

// === WAVE SENDING ===
function sendWave(packId) {
  if (!Game.state || !Game.state.players) {
    showNotification('En attente du jeu...', 'error');
    return;
  }
  
  // Trouver un adversaire
  const enemy = Game.state.players.find(p => p.id !== Game.playerId);
  if (enemy) {
    console.log('[WAVE] Envoi pack:', packId, 'vers:', enemy.id);
    Game.socket.emit('sendWave', { packId, targetPlayerId: enemy.id });
  } else {
    showNotification('Aucun adversaire trouvé', 'error');
  }
}

// === CANVAS EVENTS ===
function handleCanvasClick(e) {
  const rect = Game.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  handleClick(x, y);
}

function handleTouchStart(e) {
  e.preventDefault();
  const touches = e.touches;
  
  if (touches.length === 1) {
    // Un doigt - pan ou clic
    const touch = touches[0];
    const rect = Game.canvas.getBoundingClientRect();
    Game.touchStart = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      panX: Game.panX,
      panY: Game.panY,
      time: Date.now()
    };
    Game.isDragging = false;
  } else if (touches.length === 2) {
    // Deux doigts - zoom
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    Game.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
    Game.lastScale = Game.scale;
    Game.isDragging = false;
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  const touches = e.touches;
  
  if (touches.length === 1 && Game.touchStart) {
    // Pan avec un doigt
    const touch = touches[0];
    const rect = Game.canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    const dx = currentX - Game.touchStart.x;
    const dy = currentY - Game.touchStart.y;
    
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      Game.isDragging = true;
      Game.panX = Game.touchStart.panX + dx;
      Game.panY = Game.touchStart.panY + dy;
      
      // Limiter le pan
      const mapWidth = (Game.constants?.MAP?.WIDTH || 800) * Game.scale;
      const mapHeight = (Game.constants?.MAP?.HEIGHT || 600) * Game.scale;
      Game.panX = Math.max(Math.min(Game.panX, 200), -mapWidth + Game.width - 200);
      Game.panY = Math.max(Math.min(Game.panY, 200), -mapHeight + Game.height - 200);
    }
  } else if (touches.length === 2 && Game.lastPinchDistance) {
    // Zoom avec deux doigts
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const scaleChange = distance / Game.lastPinchDistance;
    Game.scale = Math.max(Game.minScale, Math.min(Game.maxScale, Game.lastScale * scaleChange));
    Game.isDragging = true;
    updateSizes(); // Mettre à jour les tailles pendant le pinch
  }
}

function handleTouchEnd(e) {
  if (Game.touchStart && !Game.isDragging && e.touches.length === 0) {
    // Détecter double-tap
    const now = Date.now();
    if (now - Game.lastTapTime < 300) {
      // Double-tap détecté - toggle zoom
      if (Game.scale > 1.2) {
        // Dézoomer
        Game.scale = Game.minScale;
        Game.panX = 0;
        Game.panY = 0;
      } else {
        // Zoomer sur le point tapé
        const rect = Game.canvas.getBoundingClientRect();
        const centerX = Game.touchStart.x - Game.width / 2;
        const centerY = Game.touchStart.y - Game.height / 2;
        
        Game.scale = 1.5;
        Game.panX = -centerX * 0.5;
        Game.panY = -centerY * 0.5;
      }
      updateSizes(); // Mettre à jour les tailles après double-tap
    } else {
      // Clic simple
      handleClick(Game.touchStart.x, Game.touchStart.y);
    }
    Game.lastTapTime = now;
  }
  
  if (e.touches.length < 2) {
    Game.lastPinchDistance = 0;
  }
  if (e.touches.length === 0) {
    Game.touchStart = null;
    Game.isDragging = false;
  }
}

function handleCanvasMove(e) {
  // Preview de placement (optionnel)
}

function handleClick(screenX, screenY) {
  if (Game.screen !== 'game' || !Game.constants) return;
  
  // Convertir en coordonnées de jeu (avec pan)
  const gameX = (screenX - Game.offsetX - Game.panX) / Game.scale;
  const gameY = (screenY - Game.offsetY - Game.panY) / Game.scale;
  
  // Vérifier les limites
  if (gameX < 0 || gameX > Game.constants.MAP.WIDTH ||
      gameY < 0 || gameY > Game.constants.MAP.HEIGHT) {
    return;
  }
  
  // Mode placement de tour
  if (Game.placementMode && Game.selectedTowerType) {
    console.log('[CLICK] Placement tour:', Game.selectedTowerType, 'at', gameX, gameY);
    Game.socket.emit('placeTower', {
      towerType: Game.selectedTowerType,
      x: gameX,
      y: gameY
    });
    return;
  }
  
  // Sélection de tour existante (nécessite state)
  if (Game.state) {
    const me = Game.state.players.find(p => p.id === Game.playerId);
    if (me) {
      for (const tower of me.towers) {
        const dx = tower.x - gameX;
        const dy = tower.y - gameY;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
          showTowerInfo(tower);
          return;
        }
      }
    }
  }
  
  // Clic dans le vide = désélectionner
  hideTowerInfo();
}

// === RENDU ===
function render(timestamp) {
  requestAnimationFrame(render);
  
  if (Game.screen !== 'game' || !Game.ctx) return;
  
  // FPS
  Game.frameCount++;
  if (timestamp - Game.lastFpsUpdate > 1000) {
    Game.fps = Game.frameCount;
    Game.frameCount = 0;
    Game.lastFpsUpdate = timestamp;
  }
  
  const ctx = Game.ctx;
  const w = Game.width;
  const h = Game.height;
  
  // Clear
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  
  // On peut dessiner la map même sans state (pendant countdown)
  if (!Game.constants) return;
  
  // Transformer pour la map (avec pan et zoom)
  ctx.save();
  ctx.translate(Game.offsetX + Game.panX, Game.offsetY + Game.panY);
  ctx.scale(Game.scale, Game.scale);
  
  // Fond de la map
  drawMap(ctx);
  
  // Chemin (toujours visible)
  drawPath(ctx);
  
  // Le reste nécessite l'état du jeu
  if (Game.state) {
    // Zones de placement (si mode placement actif)
    drawPlacementZones(ctx);
    
    // Tours
    drawTowers(ctx);
    
    // Creeps
    drawCreeps(ctx);
    
    // Projectiles
    drawProjectiles(ctx);
    
    // Effets
    drawEffects(ctx);
  }
  
  // Preview de placement
  if (Game.placementMode && Game.selectedTowerType) {
    // Le preview suivrait la souris (à implémenter)
  }
  
  ctx.restore();
  
  // === AFFICHAGE COMBO (hors transformation) ===
  if (Game.comboDisplay) {
    const elapsed = (Date.now() - Game.comboDisplay.time) / 1000;
    if (elapsed < 2) {
      Game.comboDisplay.alpha = Math.max(0, 1 - elapsed / 2);
      
      ctx.save();
      ctx.globalAlpha = Game.comboDisplay.alpha;
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Couleur selon niveau
      const colors = ['#fff', '#4CAF50', '#FFC107', '#FF9800', '#f44336', '#E91E63'];
      ctx.fillStyle = colors[Game.comboDisplay.level] || '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      
      const y = h / 3 - elapsed * 30;
      ctx.strokeText(Game.comboDisplay.text, w / 2, y);
      ctx.fillText(Game.comboDisplay.text, w / 2, y);
      ctx.restore();
    } else {
      Game.comboDisplay = null;
    }
  }
  
  // === AFFICHAGE INDICATEUR COMBO ACTIF ===
  if (Game.state) {
    const me = Game.state.players.find(p => p.id === Game.playerId);
    if (me && me.combo && me.combo.level > 0 && me.combo.timeLeft > 0) {
      ctx.save();
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`🔥 Combo x${me.combo.level} (${me.combo.timeLeft.toFixed(1)}s)`, 10, h - 100);
      ctx.restore();
    }
  }
  
  // Debug info (optionnel)
  // drawDebug(ctx);
  
  // Mettre à jour l'indicateur de zoom
  const zoomIndicator = document.getElementById('zoom-indicator');
  if (zoomIndicator && Game.screen === 'game') {
    const baseScale = Math.min(
      Game.width / (Game.constants?.MAP?.WIDTH || 800),
      (Game.height - 150) / (Game.constants?.MAP?.HEIGHT || 600)
    );
    const zoomPercent = Math.round((Game.scale / baseScale) * 100);
    zoomIndicator.textContent = `${zoomPercent}%`;
  }
}

function drawMap(ctx) {
  const map = Game.constants.MAP;
  const theme = Game.map?.theme || 'forest';
  
  // Couleurs selon le thème
  const themes = {
    forest: { bg: '#16213e', grid: 'rgba(255,255,255,0.03)', base: '#4CAF50' },
    desert: { bg: '#3d2914', grid: 'rgba(255,200,100,0.05)', base: '#FFA000' },
    ice: { bg: '#1a3a4a', grid: 'rgba(200,230,255,0.05)', base: '#00BCD4' }
  };
  const colors = themes[theme] || themes.forest;
  
  // Fond de map
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, map.WIDTH, map.HEIGHT);
  
  // Grille subtile
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < map.WIDTH; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, map.HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < map.HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(map.WIDTH, y);
    ctx.stroke();
  }
  
  // Base du joueur
  const basePos = Game.map?.basePosition || { x: 200, y: 550 };
  const baseGradient = ctx.createRadialGradient(basePos.x, basePos.y, 10, basePos.x, basePos.y, 60);
  baseGradient.addColorStop(0, colors.base + '80');
  baseGradient.addColorStop(1, colors.base + '00');
  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.arc(basePos.x, basePos.y, 50, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = colors.base;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏠', basePos.x, basePos.y);
}

function drawPlacementZones(ctx) {
  if (!Game.placementMode) return;
  
  // Utiliser les zones de la carte sélectionnée
  const zones = Game.map?.zones || Game.constants.PLACEMENT_ZONES || [];
  
  ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
  ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  
  for (const zone of zones) {
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
  }
  
  ctx.setLineDash([]);
}

function drawPath(ctx) {
  const path = Game.constants.PATH_WAYPOINTS;
  const theme = Game.map?.theme || 'forest';
  
  // Couleurs selon le thème
  const pathColors = {
    forest: { main: ['#5D4E37', '#3E3428'], border: '#8B7355', spawn: '#f44336' },
    desert: { main: ['#C4A35A', '#8B7355'], border: '#DEB887', spawn: '#FF5722' },
    ice: { main: ['#5A7A8A', '#3A5A6A'], border: '#8AB4C4', spawn: '#E91E63' }
  };
  const colors = pathColors[theme] || pathColors.forest;
  
  // Ombre du chemin
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = Game.constants.MAP.PATH_WIDTH + 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  
  // Chemin principal
  const gradient = ctx.createLinearGradient(0, 0, 0, 600);
  gradient.addColorStop(0, colors.main[0]);
  gradient.addColorStop(1, colors.main[1]);
  
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Game.constants.MAP.PATH_WIDTH;
  
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  
  // Bordures du chemin
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Point de spawn
  ctx.fillStyle = colors.spawn;
  ctx.beginPath();
  ctx.arc(path[0].x, path[0].y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚔', path[0].x, path[0].y);
}

function drawTowers(ctx) {
  if (!Game.state || !Game.state.players) return;
  
  const sizes = Game.sizes;
  
  for (const player of Game.state.players) {
    if (!player.towers) continue;
    for (const tower of player.towers) {
      const def = Game.constants.TOWERS[tower.type];
      const isSelected = Game.selectedTower && Game.selectedTower.id === tower.id;
      const isMine = player.id === Game.playerId;
      
      // Portée (si sélectionnée)
      if (isSelected) {
        const upgrade = tower.level > 1 ? def.upgrades[tower.level - 2] : null;
        const range = upgrade?.range || def.range;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = sizes.towerBorder;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      
      // Base de la tour
      ctx.fillStyle = isMine ? def.color : '#666';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, sizes.towerRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Bordure
      ctx.strokeStyle = isSelected ? '#FFD700' : (isMine ? '#fff' : '#999');
      ctx.lineWidth = isSelected ? sizes.towerBorder + 1 : sizes.towerBorder;
      ctx.stroke();
      
      // Emoji ou cercle simple selon le mode
      if (sizes.useSimpleMode) {
        // Mode simplifié : juste un symbole au centre
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, sizes.towerRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Mode normal avec emoji
        ctx.font = `${sizes.towerEmoji}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(def.emoji, tower.x, tower.y);
      }
      
      // Niveau (étoiles)
      if (tower.level > 1) {
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${sizes.towerLevelFont}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('★'.repeat(tower.level - 1), tower.x, tower.y + sizes.towerRadius + 4);
      }
      
      // Animation de tir
      if (tower.lastFire && Date.now() - tower.lastFire < 150) {
        ctx.strokeStyle = def.color;
        ctx.lineWidth = sizes.towerBorder + 1;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, sizes.towerRangeIndicator, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

function drawCreeps(ctx) {
  if (!Game.state || !Game.state.creeps) return;
  
  const sizes = Game.sizes;
  
  for (const creep of Game.state.creeps) {
    const def = Game.constants.CREEPS[creep.type];
    const isTargetingMe = creep.targetPlayerId === Game.playerId;
    
    // Calculer la taille adaptative du creep
    let creepSize = def.size * sizes.creepScale;
    creepSize = Math.max(sizes.minCreepSize, Math.min(sizes.maxCreepSize, creepSize));
    
    const emojiSize = Math.round(creepSize * sizes.creepEmojiScale);
    
    // Ombre (plus petite sur mobile)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(creep.x + 2, creep.y + 3, creepSize * 0.7, creepSize * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Aura pour les creeps scalés (combo) - seulement si pas en mode simplifié
    if (creep.isScaled && !sizes.useSimpleMode) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(creep.x, creep.y, creepSize + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Corps du creep
    ctx.fillStyle = creep.isSlowed ? '#88CCFF' : def.color;
    ctx.beginPath();
    ctx.arc(creep.x, creep.y, creepSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Bordure selon si nous menace + scaled
    if (creep.isScaled) {
      ctx.strokeStyle = '#FF6600';
      ctx.lineWidth = sizes.creepBorder + 1;
    } else {
      ctx.strokeStyle = isTargetingMe ? '#f44336' : '#333';
      ctx.lineWidth = sizes.creepBorder;
    }
    ctx.stroke();
    
    // Emoji ou cercle simple selon le mode et la taille
    if (sizes.useSimpleMode || creepSize < 8) {
      // Mode simplifié : petit point au centre
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(creep.x, creep.y, creepSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mode normal avec emoji
      ctx.font = `${emojiSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, creep.x, creep.y);
    }
    
    // Barre de vie (adaptative)
    const hpPercent = creep.hp / creep.maxHp;
    const barWidth = creepSize * 1.8;
    const barHeight = sizes.creepHpBarHeight;
    const barX = creep.x - barWidth / 2;
    const barY = creep.y - creepSize - barHeight - 2;
    
    // Fond de la barre
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // HP - couleur différente si scalé
    if (creep.isScaled) {
      ctx.fillStyle = hpPercent > 0.5 ? '#FF9800' : hpPercent > 0.25 ? '#FF5722' : '#f44336';
    } else {
      ctx.fillStyle = hpPercent > 0.5 ? '#4CAF50' : hpPercent > 0.25 ? '#FFC107' : '#f44336';
    }
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    
    // Indicateur de slow (seulement si assez grand)
    if (creep.isSlowed && creepSize >= 10 && !sizes.useSimpleMode) {
      ctx.fillStyle = '#2196F3';
      ctx.font = `${Math.round(emojiSize * 0.6)}px Arial`;
      ctx.fillText('❄', creep.x + creepSize, creep.y - creepSize);
    }
  }
}

function drawProjectiles(ctx) {
  if (!Game.state || !Game.state.projectiles) return;
  
  const sizes = Game.sizes;
  
  for (const proj of Game.state.projectiles) {
    const def = Game.constants.TOWERS[proj.towerType];
    
    // Traînée
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, sizes.projectileTrail, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Projectile
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, sizes.projectileSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, sizes.projectileSize * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects(ctx) {
  if (!Game.state || !Game.state.effects) return;
  
  for (const effect of Game.state.effects) {
    const alpha = effect.duration / 0.5;
    
    switch (effect.type) {
      case 'explosion':
        ctx.strokeStyle = `rgba(255, 87, 34, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case 'death':
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💥', effect.x, effect.y - (1 - alpha) * 20);
        break;
        
      case 'hit':
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 8 * alpha, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'baseDamage':
        ctx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`-${effect.damage}`, 200, 540 - (1 - alpha) * 30);
        break;
    }
  }
}

function drawDebug(ctx) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(10, 70, 120, 80);
  
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`FPS: ${Game.fps}`, 20, 90);
  ctx.fillText(`Tick: ${Game.state?.tick || 0}`, 20, 105);
  ctx.fillText(`Creeps: ${Game.state?.creeps.length || 0}`, 20, 120);
  ctx.fillText(`Scale: ${Game.scale.toFixed(2)}`, 20, 135);
}

// === END SCREEN ===
function showEndScreen(data) {
  showScreen('end');
  
  const isWinner = data.winner === Game.playerId;
  const title = document.getElementById('end-title');
  
  if (data.winner === null) {
    title.textContent = '🤝 Match Nul!';
    title.className = '';
  } else if (isWinner) {
    title.textContent = '🏆 Victoire!';
    title.className = 'victory';
  } else {
    title.textContent = '💀 Défaite';
    title.className = 'defeat';
  }
  
  // Raison
  const reasons = {
    elimination: isWinner ? 'Vous avez éliminé votre adversaire!' : 'Votre base a été détruite.',
    timeout: 'Le temps est écoulé.',
    draw: 'Les deux bases ont été détruites.'
  };
  document.getElementById('end-reason').textContent = reasons[data.reason] || '';
  
  // Stats
  const stats = document.getElementById('end-stats');
  stats.innerHTML = '';
  
  for (const player of data.players) {
    const isMe = player.id === Game.playerId;
    const div = document.createElement('div');
    div.innerHTML = `
      <h3 style="margin: 10px 0; color: ${isMe ? '#4CAF50' : '#f44336'}">
        ${player.name} ${player.id === data.winner ? '👑' : ''}
      </h3>
      <div class="end-stat-row">
        <span>❤️ HP Final</span>
        <span>${Math.max(0, Math.round(player.hp))}</span>
      </div>
      <div class="end-stat-row">
        <span>💰 Or total gagné</span>
        <span>${Math.round(player.goldEarned)}</span>
      </div>
      <div class="end-stat-row">
        <span>⚔️ Creeps éliminés</span>
        <span>${player.creepsKilled}</span>
      </div>
      <div class="end-stat-row">
        <span>💥 Dégâts infligés</span>
        <span>${Math.round(player.damageDealt)}</span>
      </div>
      <div class="end-stat-row">
        <span>🏰 Tours construites</span>
        <span>${player.stats?.towersBuilt || 0}</span>
      </div>
    `;
    stats.appendChild(div);
  }
}

function playAgain() {
  // Nettoyer l'état avant de relancer
  resetGameState();
  
  // Relancer une partie similaire
  if (Game.vsAI) {
    // Afficher le menu pour choisir la difficulté
    showScreen('menu');
    document.getElementById('ai-options').style.display = 'block';
  } else {
    Game.socket.emit('quickMatch');
  }
}

function backToMenu() {
  // Nettoyer l'état
  resetGameState();
  
  // Retour au menu
  showScreen('menu');
}

// === NETTOYAGE ===
function resetGameState() {
  console.log('[GAME] Nettoyage de l\'état...');
  
  // Réinitialiser l'état du jeu
  Game.state = null;
  Game.constants = null;
  Game.map = null;
  Game.mapId = null;
  Game.comboDisplay = null;
  
  // Réinitialiser les sélections
  Game.selectedTowerType = null;
  Game.selectedTower = null;
  Game.placementMode = false;
  
  // Réinitialiser les infos de room
  Game.roomCode = null;
  Game.isHost = false;
  
  // Réinitialiser le canvas
  Game.prevState = null;
  Game.stateTime = 0;
  
  // Masquer les panneaux
  hideTowerInfo();
  document.getElementById('countdown-overlay').style.display = 'none';
  
  // Demander au serveur de quitter la room actuelle
  Game.socket.emit('leaveRoom');
  
  console.log('[GAME] État nettoyé');
}

// === NOTIFICATIONS ===
function showNotification(message, type = 'info') {
  const container = document.getElementById('notifications');
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.textContent = message;
  container.appendChild(notif);
  
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateY(-10px)';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// === STATS SERVEUR ===
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('server-stats').textContent = 
      `${stats.totalPlayers} joueurs | ${stats.activeGames} parties en cours`;
  } catch (e) {
    // Silently fail
  }
}