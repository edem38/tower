/**
 * SEND THE WAVE - Intelligence Artificielle
 * Gère le comportement des bots
 */

const CONSTANTS = require('./constants');

class AIController {
  constructor() {
    this.lastActions = new Map();
  }

  /**
   * Met à jour l'IA pour un joueur
   */
  update(gameState, player) {
    // Vérifications de sécurité
    if (!gameState || gameState.status !== 'playing') return;
    if (!player || player.hp <= 0) return;
    
    const now = Date.now();
    const playerId = player.id;
    
    // Initialiser le tracking
    if (!this.lastActions.has(playerId)) {
      this.lastActions.set(playerId, {
        lastTower: now,
        lastAttack: now
      });
    }
    
    const actions = this.lastActions.get(playerId);
    const difficulty = CONSTANTS.AI.DIFFICULTY[player.aiDifficulty] || CONSTANTS.AI.DIFFICULTY.NORMAL;
    
    // Calculer les intervalles
    const towerInterval = CONSTANTS.AI.TOWER_INTERVAL * (difficulty.attackSpeed || 1);
    const attackInterval = CONSTANTS.AI.ATTACK_INTERVAL * (difficulty.attackSpeed || 1);

    // Placement de tours
    if (now - actions.lastTower > towerInterval) {
      this.tryPlaceTower(gameState, player, difficulty);
      actions.lastTower = now;
    }

    // Upgrade de tours (moins fréquent)
    if (player.gold > 100 && Math.random() < 0.1) {
      this.tryUpgradeTower(gameState, player);
    }

    // Envoi de vagues
    if (now - actions.lastAttack > attackInterval) {
      this.tryAttack(gameState, player, difficulty);
      actions.lastAttack = now;
    }
  }

  /**
   * Essaie de placer une tour
   */
  tryPlaceTower(gameState, player, difficulty) {
    if (!gameState || gameState.status !== 'playing') return;
    if (Math.random() > difficulty.accuracy) return;
    
    const GameEngine = require('./gameEngine');
    
    // Choisir un type de tour
    const types = ['ARCHER', 'ARCHER', 'CANON', 'ICE'];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    
    const towerDef = CONSTANTS.TOWERS[chosenType];
    if (!towerDef || player.gold < towerDef.cost) return;

    // Trouver une position
    const pos = this.findTowerPosition(gameState, player);
    if (pos) {
      GameEngine.placeTower(gameState, player.id, chosenType, pos.x, pos.y);
    }
  }

  /**
   * Trouve une position valide pour une tour
   */
  findTowerPosition(gameState, player) {
    const zones = gameState.map?.zones || CONSTANTS.PLACEMENT_ZONES || [];
    const path = gameState.map?.path || CONSTANTS.PATH_WAYPOINTS || [];
    
    for (let attempt = 0; attempt < 15; attempt++) {
      if (zones.length === 0) return null;
      
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const x = zone.x + 20 + Math.random() * (zone.width - 40);
      const y = zone.y + 20 + Math.random() * (zone.height - 40);
      
      // Vérifier collision avec autres tours
      let valid = true;
      for (const tower of player.towers) {
        const dx = tower.x - x;
        const dy = tower.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
          valid = false;
          break;
        }
      }
      
      // Vérifier pas sur le chemin
      if (valid && path.length > 1) {
        for (let i = 0; i < path.length - 1; i++) {
          const dist = this.pointToSegmentDist(x, y, path[i].x, path[i].y, path[i+1].x, path[i+1].y);
          if (dist < 45) {
            valid = false;
            break;
          }
        }
      }
      
      if (valid) return { x, y };
    }
    
    return null;
  }

  /**
   * Distance point à segment
   */
  pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  }

  /**
   * Essaie d'améliorer une tour
   */
  tryUpgradeTower(gameState, player) {
    if (!gameState || gameState.status !== 'playing') return;
    
    const GameEngine = require('./gameEngine');
    
    const upgradable = player.towers.filter(t => t.level < 3);
    if (upgradable.length === 0) return;
    
    const tower = upgradable[Math.floor(Math.random() * upgradable.length)];
    const towerDef = CONSTANTS.TOWERS[tower.type];
    if (!towerDef || !towerDef.upgrades) return;
    
    const upgrade = towerDef.upgrades[tower.level - 1];
    if (upgrade && player.gold >= upgrade.cost) {
      GameEngine.upgradeTower(gameState, player.id, tower.id);
    }
  }

  /**
   * Essaie d'envoyer une vague
   */
  tryAttack(gameState, player, difficulty) {
    if (!gameState || gameState.status !== 'playing') return;
    
    // Limite de creeps
    const maxCreeps = CONSTANTS.AI.MAX_CREEPS || 30;
    if (gameState.creeps.length >= maxCreeps - 5) return;
    
    const GameEngine = require('./gameEngine');
    
    // Trouver un adversaire vivant
    const opponents = Object.values(gameState.players).filter(p => p.id !== player.id && p.hp > 0);
    if (opponents.length === 0) return;
    
    const target = opponents[0];
    
    // Choisir un pack selon l'or disponible
    let packId = null;
    
    if (player.gold >= 200 && target.hp < 30 && (!player.packCooldowns['BOSS_PACK'] || player.packCooldowns['BOSS_PACK'] <= 0)) {
      packId = 'BOSS_PACK';
    } else if (player.gold >= 60 && (!player.packCooldowns['TANK_PACK'] || player.packCooldowns['TANK_PACK'] <= 0) && Math.random() < 0.3) {
      packId = 'TANK_PACK';
    } else if (player.gold >= 50) {
      packId = 'NORMAL_PACK';
    } else if (player.gold >= 35) {
      packId = 'SMALL_PACK';
    }
    
    if (packId) {
      GameEngine.sendWave(gameState, player.id, packId, target.id);
    }
  }

  /**
   * Nettoie les données d'un joueur
   */
  cleanup(playerId) {
    this.lastActions.delete(playerId);
  }
}

module.exports = new AIController();