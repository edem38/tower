/**
 * SEND THE WAVE - Constantes du jeu
 * Toutes les valeurs configurables sont ici
 */

const CONSTANTS = {
  // === SERVEUR ===
  TICK_RATE: 15,              // Réduit de 20 à 15 ticks par seconde
  SYNC_RATE: 8,               // Réduit de 10 à 8 syncs par seconde
  
  // === MATCH ===
  MATCH_DURATION: 480,        // 8 minutes en secondes
  COUNTDOWN_DURATION: 3,      // Compte à rebours avant le match
  
  // === JOUEUR ===
  PLAYER: {
    START_HP: 100,
    MAX_HP: 100,
    START_GOLD: 150,
    GOLD_PER_SECOND: 5,       // Revenu passif
  },
  
  // === CARTE ===
  MAP: {
    WIDTH: 800,
    HEIGHT: 600,
    LANE_WIDTH: 400,          // Largeur d'une lane
    PATH_WIDTH: 40,           // Largeur du chemin
    TOWER_SIZE: 30,           // Taille d'une tour
    TOWER_MIN_DISTANCE: 35,   // Distance min entre tours
  },
  
  // === CARTES DISPONIBLES ===
  MAPS: {
    SERPENT: {
      id: 'SERPENT',
      name: 'Serpent',
      description: 'Chemin en S classique',
      path: [
        { x: 0, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 100, y: 200 },
        { x: 100, y: 300 },
        { x: 300, y: 300 },
        { x: 300, y: 400 },
        { x: 100, y: 400 },
        { x: 100, y: 500 },
        { x: 200, y: 550 },
      ],
      zones: [
        // Zone haute (entre spawn et premier virage)
        { x: 20, y: 40, width: 280, height: 50 },
        // Zone après premier virage horizontal
        { x: 320, y: 80, width: 70, height: 140 },
        // Zone milieu gauche
        { x: 20, y: 130, width: 70, height: 160 },
        // Zone entre les virages du milieu
        { x: 120, y: 230, width: 160, height: 50 },
        // Zone milieu droite
        { x: 320, y: 230, width: 70, height: 160 },
        // Zone entre virages bas
        { x: 120, y: 330, width: 160, height: 50 },
        // Zone bas gauche
        { x: 20, y: 330, width: 70, height: 160 },
        // Zone bas (près de la base)
        { x: 120, y: 430, width: 160, height: 50 },
        // Zone finale près de la base
        { x: 220, y: 480, width: 80, height: 60 },
      ],
      basePosition: { x: 200, y: 550 },
      spawnPosition: { x: 0, y: 100 },
      theme: 'forest'
    },

    CROSSROADS: {
      id: 'CROSSROADS',
      name: 'Carrefour',
      description: 'Chemin avec intersections',
      path: [
        { x: 0, y: 300 },
        { x: 200, y: 300 },
        { x: 200, y: 100 },
        { x: 400, y: 100 },
        { x: 400, y: 300 },
        { x: 600, y: 300 },
        { x: 600, y: 500 },
        { x: 400, y: 500 },
        { x: 400, y: 400 },
        { x: 200, y: 400 },
        { x: 200, y: 550 },
      ],
      zones: [
        // Zone spawn gauche
        { x: 20, y: 230, width: 160, height: 60 },
        // Zone haut gauche
        { x: 20, y: 80, width: 160, height: 130 },
        // Zone haut centre-gauche
        { x: 220, y: 40, width: 160, height: 50 },
        // Zone haut centre-droite
        { x: 420, y: 40, width: 160, height: 50 },
        // Zone haut droite
        { x: 420, y: 120, width: 160, height: 160 },
        // Zone centre
        { x: 220, y: 130, width: 160, height: 150 },
        // Zone droite milieu
        { x: 620, y: 230, width: 70, height: 160 },
        // Zone bas droite
        { x: 420, y: 320, width: 160, height: 70 },
        // Zone bas centre
        { x: 220, y: 420, width: 160, height: 70 },
        // Zone près de la base
        { x: 120, y: 480, width: 70, height: 70 },
      ],
      basePosition: { x: 200, y: 550 },
      spawnPosition: { x: 0, y: 300 },
      theme: 'ice'
    }
  },
  
  // Carte par défaut (pour compatibilité)
  PATH_WAYPOINTS: [
    { x: 0, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 200 },
    { x: 100, y: 200 },
    { x: 100, y: 300 },
    { x: 300, y: 300 },
    { x: 300, y: 400 },
    { x: 100, y: 400 },
    { x: 100, y: 500 },
    { x: 200, y: 550 },
  ],
  
  // === SCALING DYNAMIQUE ===
  SCALING: {
    // Bonus HP des creeps par minute de jeu
    HP_PER_MINUTE: 0.12,          // +12% HP par minute
    // Bonus HP par tour adverse
    HP_PER_ENEMY_TOWER: 0.03,     // +3% HP par tour ennemie
    // Bonus vitesse par minute
    SPEED_PER_MINUTE: 0.015,      // +1.5% vitesse par minute
    // Cap maximum de scaling
    MAX_HP_MULTIPLIER: 2.5,       // Max 2.5x HP
    MAX_SPEED_MULTIPLIER: 1.4,    // Max 1.4x vitesse
  },
  
  // === SYSTÈME DE COMBO (visuel uniquement, pas de bonus) ===
  COMBO: {
    WINDOW: 5,                    // Fenêtre de temps en secondes pour enchaîner
    MAX_LEVEL: 5,                 // Niveau max de combo
  },
  
  // === TOURS ===
  TOWERS: {
    ARCHER: {
      id: 'ARCHER',
      name: 'Archer',
      emoji: '🏹',
      cost: 50,
      damage: 12,
      range: 100,
      fireRate: 0.4,          // Secondes entre tirs
      color: '#4CAF50',
      upgrades: [
        { cost: 40, damage: 18, range: 110, fireRate: 0.35 },
        { cost: 70, damage: 28, range: 130, fireRate: 0.3 }
      ]
    },
    CANON: {
      id: 'CANON',
      name: 'Canon',
      emoji: '💣',
      cost: 80,
      damage: 45,
      range: 85,
      fireRate: 1.5,
      splashRadius: 35,
      color: '#FF5722',
      upgrades: [
        { cost: 60, damage: 70, splashRadius: 45 },
        { cost: 100, damage: 110, splashRadius: 55, range: 95 }
      ]
    },
    ICE: {
      id: 'ICE',
      name: 'Glace',
      emoji: '❄️',
      cost: 60,
      damage: 8,
      range: 90,
      fireRate: 0.8,
      slowAmount: 0.3,        // 30% ralentissement
      slowDuration: 1.2,      // Secondes
      color: '#2196F3',
      upgrades: [
        { cost: 50, damage: 12, slowAmount: 0.4, slowDuration: 1.5 },
        { cost: 80, damage: 18, slowAmount: 0.5, slowDuration: 2, range: 100 }
      ]
    }
  },
  
  // === CREEPS (stats de base, seront scalés) ===
  CREEPS: {
    SMALL: {
      id: 'SMALL',
      name: 'Rapide',
      emoji: '👻',
      hp: 40,                 // Augmenté de 25 à 40
      speed: 80,              // Augmenté de 70 à 80
      reward: 5,
      damage: 1,
      color: '#8BC34A',
      size: 12
    },
    NORMAL: {
      id: 'NORMAL',
      name: 'Normal',
      emoji: '👾',
      hp: 100,                // Augmenté de 60 à 100
      speed: 55,              // Augmenté de 45 à 55
      reward: 10,
      damage: 2,
      color: '#FFC107',
      size: 15
    },
    TANK: {
      id: 'TANK',
      name: 'Tank',
      emoji: '🤖',
      hp: 400,                // Augmenté de 250 à 400
      speed: 35,              // Augmenté de 28 à 35
      reward: 30,
      damage: 5,
      color: '#9C27B0',
      size: 20
    },
    BOSS: {
      id: 'BOSS',
      name: 'Boss',
      emoji: '👹',
      hp: 2000,               // Augmenté de 1200 à 2000
      speed: 25,              // Augmenté de 18 à 25
      reward: 120,
      damage: 25,
      color: '#F44336',
      size: 28
    },
    SABOTEUR: {
      id: 'SABOTEUR',
      name: 'Saboteur',
      emoji: '🥷',
      hp: 150,
      speed: 65,
      reward: 50,
      damage: 0,              // Ne fait pas de dégâts à la base
      color: '#673AB7',
      size: 18,
      targetsTowers: true     // Cible les tours au lieu de la base
    }
  },
  
  // === VAGUES (envoi PvP) ===
  WAVE_PACKS: {
    SMALL_PACK: {
      id: 'SMALL_PACK',
      name: '5x Rapides',
      creepType: 'SMALL',
      count: 5,
      cost: 35,
      delay: 250,             // Réduit pour envoi plus rapide
      cooldown: 0
    },
    NORMAL_PACK: {
      id: 'NORMAL_PACK',
      name: '3x Normaux',
      creepType: 'NORMAL',
      count: 3,
      cost: 50,
      delay: 400,
      cooldown: 0
    },
    TANK_PACK: {
      id: 'TANK_PACK',
      name: '1x Tank',
      creepType: 'TANK',
      count: 1,
      cost: 60,
      delay: 0,
      cooldown: 5
    },
    BOSS_PACK: {
      id: 'BOSS_PACK',
      name: '1x Boss',
      creepType: 'BOSS',
      count: 1,
      cost: 200,
      delay: 0,
      cooldown: 60
    },
    SABOTEUR_PACK: {
      id: 'SABOTEUR_PACK',
      name: '1x Saboteur',
      creepType: 'SABOTEUR',
      count: 1,
      cost: 180,
      delay: 0,
      cooldown: 30
    }
  },
  
  // === CAPACITÉS SPÉCIALES ===
  ABILITIES: {
    MISSILE: {
      id: 'MISSILE',
      name: 'Missile',
      emoji: '🚀',
      cost: 250,
      cooldown: 45,
      description: 'Détruit une tour ennemie'
    }
  },
  
  // === VAGUES AUTOMATIQUES (PvE de base) ===
  AUTO_WAVES: {
    INTERVAL: 25,             // Secondes entre vagues auto
    BASE_CREEPS: 2,           // Creeps de base par vague
    SCALING: 0.3,             // Creeps supplémentaires par minute
  },
  
  // === IA ===
  AI: {
    REACTION_TIME: 500,       // ms avant réaction
    TOWER_INTERVAL: 7000,     // ms entre placements de tour
    ATTACK_INTERVAL: 10000,   // ms entre envois de vagues
    COMBO_CHANCE: 0.2,        // Chance de faire des combos (réduit)
    MAX_CREEPS: 60,           // Limite de creeps sur la map (augmenté)
    DIFFICULTY: {
      EASY: { goldMultiplier: 0.8, accuracy: 0.6, attackSpeed: 1.5 },
      NORMAL: { goldMultiplier: 1.0, accuracy: 0.75, attackSpeed: 1.0 },
      HARD: { goldMultiplier: 1.15, accuracy: 0.85, attackSpeed: 0.85 }
    }
  }
};

// Zones de placement désactivées - on peut construire partout
// CONSTANTS.PLACEMENT_ZONES = CONSTANTS.MAPS.SERPENT.zones;

module.exports = CONSTANTS;