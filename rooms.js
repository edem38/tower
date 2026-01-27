/**
 * SEND THE WAVE - Gestion des salles
 * Crée, gère et supprime les parties multijoueur
 */

const CONSTANTS = require('./constants');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerToRoom = new Map();
    this.waitingQueue = [];     // File d'attente matchmaking
  }

  /**
   * Génère un code de room unique
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Crée une nouvelle room
   */
  createRoom(hostId, options = {}) {
    const code = this.generateRoomCode();
    const room = {
      code,
      hostId,
      players: new Map(),
      maxPlayers: options.maxPlayers || 2,
      mode: options.mode || '1v1',        // '1v1', 'ffa4', '2v2'
      isPrivate: options.isPrivate || false,
      vsAI: options.vsAI || false,
      aiDifficulty: options.aiDifficulty || 'NORMAL',
      state: 'waiting',                    // waiting, countdown, playing, finished
      gameState: null,
      createdAt: Date.now()
    };
    
    this.rooms.set(code, room);
    console.log(`[ROOM] Créée: ${code} par ${hostId}`);
    return room;
  }

  /**
   * Ajoute un joueur à une room
   */
  joinRoom(playerId, playerName, roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room introuvable' };
    }
    if (room.state !== 'waiting') {
      return { success: false, error: 'Partie déjà en cours' };
    }
    if (room.players.size >= room.maxPlayers) {
      return { success: false, error: 'Room pleine' };
    }

    const playerIndex = room.players.size;
    const player = {
      id: playerId,
      name: playerName || `Joueur ${playerIndex + 1}`,
      index: playerIndex,
      ready: false,
      isAI: false
    };

    room.players.set(playerId, player);
    this.playerToRoom.set(playerId, roomCode);
    
    console.log(`[ROOM] ${playerName} rejoint ${roomCode}`);
    return { success: true, room, player };
  }

  /**
   * Ajoute une IA à la room
   */
  addAI(roomCode, difficulty = 'NORMAL') {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const aiId = `AI_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const playerIndex = room.players.size;
    
    const aiPlayer = {
      id: aiId,
      name: `🤖 IA (${difficulty})`,
      index: playerIndex,
      ready: true,
      isAI: true,
      aiDifficulty: difficulty
    };

    room.players.set(aiId, aiPlayer);
    room.vsAI = true;
    
    console.log(`[ROOM] IA ajoutée à ${roomCode}`);
    return aiPlayer;
  }

  /**
   * Retire un joueur d'une room
   */
  leaveRoom(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.players.delete(playerId);
    this.playerToRoom.delete(playerId);

    // Si la room est vide ou si l'host part, on ferme
    if (room.players.size === 0 || playerId === room.hostId) {
      this.closeRoom(roomCode);
      return { closed: true, roomCode };
    }

    // Nouveau host si nécessaire
    if (playerId === room.hostId) {
      const newHost = room.players.keys().next().value;
      room.hostId = newHost;
    }

    return { closed: false, room };
  }

  /**
   * Ferme une room
   */
  closeRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // Nettoyer les références joueurs
    for (const playerId of room.players.keys()) {
      this.playerToRoom.delete(playerId);
    }

    this.rooms.delete(roomCode);
    console.log(`[ROOM] Fermée: ${roomCode}`);
  }

  /**
   * Matchmaking rapide 1v1
   */
  quickMatch(playerId, playerName) {
    // Chercher une room en attente
    for (const [code, room] of this.rooms) {
      if (room.state === 'waiting' && 
          !room.isPrivate && 
          !room.vsAI &&
          room.players.size < room.maxPlayers) {
        return this.joinRoom(playerId, playerName, code);
      }
    }

    // Sinon créer une nouvelle room publique
    const room = this.createRoom(playerId, { isPrivate: false });
    return this.joinRoom(playerId, playerName, room.code);
  }

  /**
   * Obtient la room d'un joueur
   */
  getPlayerRoom(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    return roomCode ? this.rooms.get(roomCode) : null;
  }

  /**
   * Obtient une room par code
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  /**
   * Marque un joueur comme prêt
   */
  setPlayerReady(playerId, ready) {
    const room = this.getPlayerRoom(playerId);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (player) {
      player.ready = ready;
    }

    // Vérifie si tous sont prêts
    const allReady = [...room.players.values()].every(p => p.ready);
    const enoughPlayers = room.players.size >= 2 || room.vsAI;

    return { room, allReady: allReady && enoughPlayers };
  }

  /**
   * Liste les rooms publiques disponibles
   */
  listPublicRooms() {
    const publicRooms = [];
    for (const [code, room] of this.rooms) {
      if (!room.isPrivate && room.state === 'waiting') {
        publicRooms.push({
          code,
          players: room.players.size,
          maxPlayers: room.maxPlayers,
          mode: room.mode
        });
      }
    }
    return publicRooms;
  }

  /**
   * Statistiques
   */
  getStats() {
    let totalPlayers = 0;
    let activeGames = 0;
    
    for (const room of this.rooms.values()) {
      totalPlayers += room.players.size;
      if (room.state === 'playing') activeGames++;
    }

    return {
      totalRooms: this.rooms.size,
      totalPlayers,
      activeGames
    };
  }
}

module.exports = new RoomManager();
