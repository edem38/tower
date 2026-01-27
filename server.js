/**
 * SEND THE WAVE - Serveur principal
 * Express + Socket.io
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const roomManager = require('./rooms');
const gameEngine = require('./gameEngine');
const CONSTANTS = require('./constants');

// === CONFIGURATION ===
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// === SERVIR LES FICHIERS STATIQUES ===
app.use(express.static(path.join(__dirname)));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API stats
app.get('/api/stats', (req, res) => {
  res.json(roomManager.getStats());
});

// API constantes (pour debug/affichage)
app.get('/api/constants', (req, res) => {
  res.json({
    TOWERS: CONSTANTS.TOWERS,
    CREEPS: CONSTANTS.CREEPS,
    WAVE_PACKS: CONSTANTS.WAVE_PACKS,
    MATCH_DURATION: CONSTANTS.MATCH_DURATION
  });
});

// === GESTION DES CONNEXIONS SOCKET ===
io.on('connection', (socket) => {
  console.log(`[SOCKET] Connexion: ${socket.id}`);
  
  let playerName = `Joueur_${socket.id.slice(0, 4)}`;

  // === LOBBY ===
  
  /**
   * Définir le nom du joueur
   */
  socket.on('setName', (name) => {
    if (name && typeof name === 'string') {
      playerName = name.slice(0, 20); // Limite 20 caractères
    }
    socket.emit('nameSet', playerName);
  });

  /**
   * Créer une room
   */
  socket.on('createRoom', (options = {}) => {
    const room = roomManager.createRoom(socket.id, options);
    const result = roomManager.joinRoom(socket.id, playerName, room.code);
    
    if (result.success) {
      socket.join(room.code);
      socket.emit('roomCreated', {
        code: room.code,
        player: result.player,
        players: [...room.players.values()]
      });
    } else {
      socket.emit('error', result.error);
    }
  });

  /**
   * Rejoindre une room
   */
  socket.on('joinRoom', (roomCode) => {
    const result = roomManager.joinRoom(socket.id, playerName, roomCode.toUpperCase());
    
    if (result.success) {
      socket.join(roomCode);
      socket.emit('roomJoined', {
        code: roomCode,
        player: result.player,
        players: [...result.room.players.values()]
      });
      
      // Notifier les autres
      socket.to(roomCode).emit('playerJoined', result.player);
    } else {
      socket.emit('error', result.error);
    }
  });

  /**
   * Match rapide
   */
  socket.on('quickMatch', () => {
    const result = roomManager.quickMatch(socket.id, playerName);
    
    if (result.success) {
      socket.join(result.room.code);
      socket.emit('roomJoined', {
        code: result.room.code,
        player: result.player,
        players: [...result.room.players.values()],
        isQuickMatch: true
      });
      
      // Notifier les autres
      socket.to(result.room.code).emit('playerJoined', result.player);
    } else {
      socket.emit('error', result.error);
    }
  });

  /**
   * Jouer contre l'IA
   */
  socket.on('playVsAI', (difficulty = 'NORMAL') => {
    const room = roomManager.createRoom(socket.id, { vsAI: true });
    const result = roomManager.joinRoom(socket.id, playerName, room.code);
    
    if (result.success) {
      socket.join(room.code);
      const aiPlayer = roomManager.addAI(room.code, difficulty);
      
      socket.emit('roomCreated', {
        code: room.code,
        player: result.player,
        players: [...room.players.values()],
        vsAI: true
      });
      
      // Auto-ready pour partie IA
      roomManager.setPlayerReady(socket.id, true);
      startGameIfReady(room.code);
    }
  });

  /**
   * Marquer prêt
   */
  socket.on('ready', (ready = true) => {
    const result = roomManager.setPlayerReady(socket.id, ready);
    if (result) {
      io.to(result.room.code).emit('playerReady', {
        playerId: socket.id,
        ready,
        allReady: result.allReady
      });
      
      if (result.allReady) {
        startGameIfReady(result.room.code);
      }
    }
  });

  /**
   * Quitter la room
   */
  socket.on('leaveRoom', () => {
    handleLeave(socket);
  });

  // === ACTIONS DE JEU ===

  /**
   * Placer une tour
   */
  socket.on('placeTower', ({ towerType, x, y }) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    const gameState = gameEngine.getGameState(room.code);
    if (!gameState || gameState.status !== 'playing') return;
    
    const result = gameEngine.placeTower(gameState, socket.id, towerType, x, y);
    
    if (result.success) {
      socket.emit('towerPlaced', result.tower);
    } else {
      socket.emit('actionError', result.error);
    }
  });

  /**
   * Upgrade une tour
   */
  socket.on('upgradeTower', (towerId) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    const gameState = gameEngine.getGameState(room.code);
    if (!gameState || gameState.status !== 'playing') return;
    
    const result = gameEngine.upgradeTower(gameState, socket.id, towerId);
    
    if (result.success) {
      socket.emit('towerUpgraded', result.tower);
    } else {
      socket.emit('actionError', result.error);
    }
  });

  /**
   * Vendre une tour
   */
  socket.on('sellTower', (towerId) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    const gameState = gameEngine.getGameState(room.code);
    if (!gameState || gameState.status !== 'playing') return;
    
    const result = gameEngine.sellTower(gameState, socket.id, towerId);
    
    if (result.success) {
      socket.emit('towerSold', { towerId, refund: result.refund });
    } else {
      socket.emit('actionError', result.error);
    }
  });

  /**
   * Envoyer une vague
   */
  socket.on('sendWave', ({ packId, targetPlayerId }) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    const gameState = gameEngine.getGameState(room.code);
    if (!gameState || gameState.status !== 'playing') return;
    
    // Si pas de cible spécifiée, prendre le premier adversaire
    if (!targetPlayerId) {
      const opponents = Object.keys(gameState.players).filter(id => id !== socket.id);
      targetPlayerId = opponents[0];
    }
    
    const result = gameEngine.sendWave(gameState, socket.id, packId, targetPlayerId);
    
    if (result.success) {
      socket.emit('waveSent', { 
        packId, 
        targetPlayerId,
        combo: result.combo
      });
    } else {
      socket.emit('actionError', result.error);
    }
  });

  /**
   * Demande de sync complète (debug/reconnexion)
   */
  socket.on('requestSync', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    const gameState = gameEngine.getGameState(room.code);
    if (gameState) {
      socket.emit('gameSync', gameEngine.getMinimalState(gameState, socket.id));
    }
  });

  /**
   * Abandon de partie
   */
  socket.on('surrender', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    const gameState = gameEngine.getGameState(room.code);
    if (!gameState || gameState.status !== 'playing') return;
    
    // Mettre les HP du joueur à 0
    const player = gameState.players[socket.id];
    if (player) {
      player.hp = 0;
      console.log(`[GAME] ${player.name} a abandonné`);
    }
  });

  // === DÉCONNEXION ===
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Déconnexion: ${socket.id}`);
    handleLeave(socket);
  });

  // === FONCTIONS UTILITAIRES ===

  function handleLeave(socket) {
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      if (result.closed) {
        io.to(result.roomCode).emit('roomClosed', 'L\'hôte a quitté');
        gameEngine.cleanupGame(result.roomCode);
      } else {
        socket.to(result.room.code).emit('playerLeft', socket.id);
      }
    }
  }

  function startGameIfReady(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    
    const allReady = [...room.players.values()].every(p => p.ready);
    const enoughPlayers = room.players.size >= 2 || room.vsAI;
    
    if (allReady && enoughPlayers && room.state === 'waiting') {
      room.state = 'countdown';
      
      // Initialiser la partie
      const gameState = gameEngine.initGame(room);
      
      // Envoyer le démarrage à tous
      io.to(roomCode).emit('gameStarting', {
        countdown: CONSTANTS.COUNTDOWN_DURATION,
        players: [...room.players.values()].map(p => ({
          id: p.id,
          name: p.name,
          index: p.index,
          isAI: p.isAI
        })),
        // Envoyer la carte sélectionnée
        map: gameState.map,
        mapId: gameState.mapId,
        constants: {
          TOWERS: CONSTANTS.TOWERS,
          CREEPS: CONSTANTS.CREEPS,
          WAVE_PACKS: CONSTANTS.WAVE_PACKS,
          PATH_WAYPOINTS: gameState.map.path,
          MAP: CONSTANTS.MAP,
          PLACEMENT_ZONES: gameState.map.zones,
          COMBO: CONSTANTS.COMBO,
          SCALING: CONSTANTS.SCALING,
          MAPS: CONSTANTS.MAPS
        }
      });
      
      // Démarrer le moteur de jeu
      gameEngine.startGame(
        roomCode,
        // Callback de mise à jour
        (state) => {
          const minimalState = gameEngine.getMinimalState(state);
          io.to(roomCode).emit('gameUpdate', minimalState);
        },
        // Callback de fin
        (state) => {
          room.state = 'finished';
          io.to(roomCode).emit('gameEnded', {
            winner: state.winner,
            reason: state.endReason,
            players: Object.values(state.players).map(p => ({
              id: p.id,
              name: p.name,
              hp: p.hp,
              gold: Math.round(p.gold),
              goldEarned: Math.round(p.goldEarned),
              goldSpent: Math.round(p.goldSpent),
              creepsKilled: p.creepsKilled,
              damageDealt: Math.round(p.damageDealt),
              stats: p.stats
            }))
          });
          
          // Nettoyer après 30 secondes
          setTimeout(() => {
            gameEngine.cleanupGame(roomCode);
            roomManager.closeRoom(roomCode);
          }, 30000);
        }
      );
    }
  }
});

// === DÉMARRAGE DU SERVEUR ===
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         🎮 SEND THE WAVE - Serveur démarré       ║
║══════════════════════════════════════════════════║
║  URL:    http://localhost:${PORT}                    ║
║  Tick:   ${CONSTANTS.TICK_RATE} ticks/seconde                      ║
║  Match:  ${CONSTANTS.MATCH_DURATION / 60} minutes                            ║
╚══════════════════════════════════════════════════╝
  `);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n[SERVER] Arrêt en cours...');
  
  // Fermer toutes les parties
  for (const roomCode of roomManager.rooms.keys()) {
    gameEngine.cleanupGame(roomCode);
  }
  
  server.close(() => {
    console.log('[SERVER] Arrêté proprement');
    process.exit(0);
  });
});
