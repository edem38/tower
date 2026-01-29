/**
 * SEND THE WAVE - Moteur de jeu
 * Gère toute la logique de jeu côté serveur
 */

const CONSTANTS = require('./constants');
const aiController = require('./ai');

class GameEngine {
  constructor() {
    this.games = new Map(); // roomCode -> gameState
    this.gameLoops = new Map(); // roomCode -> intervalId
  }

  /**
   * Initialise une nouvelle partie
   */
  initGame(room) {
    // Sélectionner la carte (aléatoire ou spécifiée)
    const mapIds = Object.keys(CONSTANTS.MAPS);
    const selectedMapId = room.mapId || mapIds[Math.floor(Math.random() * mapIds.length)];
    const selectedMap = CONSTANTS.MAPS[selectedMapId];
    
    const gameState = {
      roomCode: room.code,
      status: 'waiting', // waiting, countdown, playing, finished
      tick: 0,
      startTime: null,
      timeRemaining: CONSTANTS.MATCH_DURATION,
      
      // Carte sélectionnée
      mapId: selectedMapId,
      map: selectedMap,
      
      // Joueurs
      players: {},
      
      // Entités
      creeps: [],
      projectiles: [],
      effects: [],
      
      // Compteurs
      nextCreepId: 1,
      nextTowerId: 1,
      nextProjectileId: 1,
      
      // Vagues auto
      lastAutoWave: 0,
      waveNumber: 1,
      
      // Fin de partie
      winner: null,
      endReason: null
    };

    // Initialiser les joueurs
    for (const [playerId, playerData] of room.players) {
      gameState.players[playerId] = {
        id: playerId,
        name: playerData.name,
        index: playerData.index,
        isAI: playerData.isAI || false,
        aiDifficulty: playerData.aiDifficulty || 'NORMAL',
        
        hp: CONSTANTS.PLAYER.START_HP,
        gold: CONSTANTS.PLAYER.START_GOLD,
        
        towers: [],
        packCooldowns: {},
        abilityCooldowns: {},
        
        // Stats
        goldEarned: CONSTANTS.PLAYER.START_GOLD,
        goldSpent: 0,
        creepsKilled: 0,
        damageDealt: 0,
        creepsSent: 0,
        maxCombo: 0,
        stats: {
          towersBuilt: 0,
          towersUpgraded: 0,
          towersSold: 0,
          towersDestroyed: 0,
          towersLost: 0
        }
      };
    }

    this.games.set(room.code, gameState);
    return gameState;
  }

  /**
   * Démarre la partie
   */
  startGame(roomCode, updateCallback, endCallback) {
    const gameState = this.games.get(roomCode);
    if (!gameState) return;

    // Countdown
    gameState.status = 'countdown';
    let countdown = CONSTANTS.COUNTDOWN_DURATION;

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        
        // Démarrer le jeu
        gameState.status = 'playing';
        gameState.startTime = Date.now();
        
        // Boucle de jeu principale
        const tickInterval = 1000 / CONSTANTS.TICK_RATE;
        let lastUpdate = Date.now();
        let syncCounter = 0;
        
        const gameLoop = setInterval(() => {
          try {
            if (gameState.status !== 'playing') {
              clearInterval(gameLoop);
              return;
            }

            const now = Date.now();
            const deltaTime = (now - lastUpdate) / 1000;
            lastUpdate = now;

            // Mise à jour du jeu
            this.update(gameState, deltaTime);

            // Sync aux clients
            syncCounter++;
            if (syncCounter >= CONSTANTS.TICK_RATE / CONSTANTS.SYNC_RATE) {
              syncCounter = 0;
              updateCallback(gameState);
            }

            // Vérifier fin de partie
            if (gameState.status === 'finished') {
              clearInterval(gameLoop);
              this.gameLoops.delete(roomCode);
              endCallback(gameState);
            }
          } catch (error) {
            console.error('[GAME] Erreur dans la boucle de jeu:', error);
          }
        }, tickInterval);

        this.gameLoops.set(roomCode, gameLoop);
      }
    }, 1000);
  }

  /**
   * Mise à jour principale du jeu
   */
  update(gameState, deltaTime) {
    // Limiter deltaTime pour éviter les sauts (si le jeu lag)
    deltaTime = Math.min(deltaTime, 0.1);
    
    gameState.tick++;

    // Temps restant
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    gameState.timeRemaining = Math.max(0, CONSTANTS.MATCH_DURATION - elapsed);

    // Or passif
    for (const player of Object.values(gameState.players)) {
      const goldGain = CONSTANTS.PLAYER.GOLD_PER_SECOND * deltaTime;
      player.gold += goldGain;
      player.goldEarned += goldGain;
      
      // Cooldowns des packs
      for (const packId in player.packCooldowns) {
        if (player.packCooldowns[packId] > 0) {
          player.packCooldowns[packId] -= deltaTime;
        }
      }
      
      // Cooldowns des capacités
      for (const abilityId in player.abilityCooldowns) {
        if (player.abilityCooldowns[abilityId] > 0) {
          player.abilityCooldowns[abilityId] -= deltaTime;
        }
      }
      
    }

    // Vagues automatiques
    this.updateAutoWaves(gameState);

    // IA
    for (const player of Object.values(gameState.players)) {
      if (player.isAI && player.hp > 0) {
        aiController.update(gameState, player);
      }
    }

    // Creeps
    this.updateCreeps(gameState, deltaTime);

    // Tours (tir)
    this.updateTowers(gameState, deltaTime);

    // Projectiles
    this.updateProjectiles(gameState, deltaTime);

    // Effets visuels
    this.updateEffects(gameState, deltaTime);

    // Vérifier fin de partie
    this.checkGameEnd(gameState);
  }

  /**
   * Vagues automatiques
   */
  updateAutoWaves(gameState) {
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    const waveInterval = CONSTANTS.AUTO_WAVES.INTERVAL;
    
    if (elapsed - gameState.lastAutoWave >= waveInterval) {
      gameState.lastAutoWave = elapsed;
      gameState.waveNumber++;
      
      // Calculer le nombre de creeps
      const minutes = elapsed / 60;
      const creepCount = Math.floor(
        CONSTANTS.AUTO_WAVES.BASE_CREEPS + 
        minutes * CONSTANTS.AUTO_WAVES.SCALING
      );
      
      // Envoyer des creeps à chaque joueur
      for (const player of Object.values(gameState.players)) {
        if (player.hp <= 0) continue;
        
        for (let i = 0; i < creepCount; i++) {
          setTimeout(() => {
            this.spawnCreep(gameState, 'NORMAL', player.id, null);
          }, i * 400);
        }
      }
    }
  }

  /**
   * Mise à jour des creeps
   */
  updateCreeps(gameState, deltaTime) {
    const path = gameState.map?.path || CONSTANTS.PATH_WAYPOINTS;
    
    for (let i = gameState.creeps.length - 1; i >= 0; i--) {
      const creep = gameState.creeps[i];
      
      if (creep.hp <= 0) {
        // Creep mort
        const killer = gameState.players[creep.killedBy];
        if (killer) {
          const creepDef = CONSTANTS.CREEPS[creep.type];
          killer.gold += creepDef.reward;
          killer.goldEarned += creepDef.reward;
          killer.creepsKilled++;
        }
        
        // Effet de mort
        gameState.effects.push({
          type: 'death',
          x: creep.x,
          y: creep.y,
          creepType: creep.type,
          duration: 0.5
        });
        
        gameState.creeps.splice(i, 1);
        continue;
      }

      // === LOGIQUE SABOTEUR ===
      if (creep.targetsTowers) {
        // Trouver une tour cible si pas déjà définie
        if (!creep.targetTowerId) {
          const targetPlayer = gameState.players[creep.targetPlayerId];
          if (targetPlayer && targetPlayer.towers.length > 0) {
            // Choisir une tour aléatoire
            const randomTower = targetPlayer.towers[Math.floor(Math.random() * targetPlayer.towers.length)];
            creep.targetTowerId = randomTower.id;
          } else {
            // Pas de tours, aller vers la base normalement
            creep.targetsTowers = false;
          }
        }
        
        // Se déplacer vers la tour cible
        if (creep.targetTowerId) {
          const targetPlayer = gameState.players[creep.targetPlayerId];
          const targetTower = targetPlayer?.towers.find(t => t.id === creep.targetTowerId);
          
          if (targetTower) {
            const dx = targetTower.x - creep.x;
            const dy = targetTower.y - creep.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Appliquer le slow
            let speedMultiplier = 1;
            if (creep.slowUntil && Date.now() < creep.slowUntil) {
              speedMultiplier = 1 - creep.slowAmount;
            }
            
            const speed = creep.speed * speedMultiplier;
            const moveDistance = speed * deltaTime;
            
            if (dist <= 10) {
              // Atteint la tour - la détruire !
              this.destroyTower(gameState, creep.targetPlayerId, creep.targetTowerId, creep.senderId);
              gameState.creeps.splice(i, 1);
              continue;
            } else {
              // Se déplacer vers la tour
              creep.x += (dx / dist) * moveDistance;
              creep.y += (dy / dist) * moveDistance;
              creep.direction = Math.atan2(dy, dx);
            }
            continue;
          } else {
            // Tour détruite par autre chose, trouver nouvelle cible
            creep.targetTowerId = null;
          }
        }
      }

      // === LOGIQUE NORMALE (non-saboteur) ===
      // Appliquer le slow
      let speedMultiplier = 1;
      if (creep.slowUntil && Date.now() < creep.slowUntil) {
        speedMultiplier = 1 - creep.slowAmount;
      }

      // Déplacement vers le waypoint actuel
      const target = path[creep.waypointIndex];
      if (!target) {
        // Arrivé à la fin = dégâts à la base
        const targetPlayer = gameState.players[creep.targetPlayerId];
        if (targetPlayer) {
          const creepDef = CONSTANTS.CREEPS[creep.type];
          targetPlayer.hp -= creepDef.damage;
          
          // Effet de dégât à la base
          gameState.effects.push({
            type: 'baseDamage',
            playerId: creep.targetPlayerId,
            damage: creepDef.damage,
            duration: 0.8
          });
        }
        
        gameState.creeps.splice(i, 1);
        continue;
      }

      const dx = target.x - creep.x;
      const dy = target.y - creep.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Utiliser la vitesse scalée du creep
      const speed = creep.speed * speedMultiplier;
      const moveDistance = speed * deltaTime;

      if (dist <= moveDistance) {
        // Atteint le waypoint
        creep.x = target.x;
        creep.y = target.y;
        creep.waypointIndex++;
      } else {
        // Se déplacer vers le waypoint
        creep.x += (dx / dist) * moveDistance;
        creep.y += (dy / dist) * moveDistance;
      }

      // Direction pour le rendu
      creep.direction = Math.atan2(dy, dx);
    }
  }

  /**
   * Mise à jour des tours
   */
  updateTowers(gameState, deltaTime) {
    for (const player of Object.values(gameState.players)) {
      for (const tower of player.towers) {
        tower.cooldown -= deltaTime;
        
        if (tower.cooldown <= 0) {
          // Chercher une cible
          const target = this.findTarget(gameState, tower, player.id);
          
          if (target) {
            this.fireTower(gameState, tower, target, player);
            
            const towerDef = CONSTANTS.TOWERS[tower.type];
            const upgrade = tower.level > 1 ? towerDef.upgrades[tower.level - 2] : null;
            tower.cooldown = upgrade?.fireRate || towerDef.fireRate;
          }
        }
      }
    }
  }

  /**
   * Trouve une cible pour une tour
   */
  findTarget(gameState, tower, ownerId) {
    const towerDef = CONSTANTS.TOWERS[tower.type];
    const upgrade = tower.level > 1 ? towerDef.upgrades[tower.level - 2] : null;
    const range = upgrade?.range || towerDef.range;
    
    let bestTarget = null;
    let bestProgress = -1;
    
    for (const creep of gameState.creeps) {
      // Ne cibler que les creeps qui attaquent ce joueur
      if (creep.targetPlayerId !== ownerId) continue;
      
      const dx = creep.x - tower.x;
      const dy = creep.y - tower.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= range) {
        // Priorité au creep le plus avancé
        if (creep.waypointIndex > bestProgress) {
          bestProgress = creep.waypointIndex;
          bestTarget = creep;
        }
      }
    }
    
    return bestTarget;
  }

  /**
   * Tire avec une tour
   */
  fireTower(gameState, tower, target, player) {
    const towerDef = CONSTANTS.TOWERS[tower.type];
    const upgrade = tower.level > 1 ? towerDef.upgrades[tower.level - 2] : null;
    
    const damage = upgrade?.damage || towerDef.damage;
    
    // Créer le projectile
    const projectile = {
      id: gameState.nextProjectileId++,
      towerId: tower.id,
      towerType: tower.type,
      x: tower.x,
      y: tower.y,
      targetId: target.id,
      damage: damage,
      speed: 400,
      ownerId: player.id
    };
    
    // Propriétés spéciales
    if (tower.type === 'CANON') {
      projectile.splashRadius = upgrade?.splashRadius || towerDef.splashRadius;
    }
    if (tower.type === 'ICE') {
      projectile.slowAmount = upgrade?.slowAmount || towerDef.slowAmount;
      projectile.slowDuration = upgrade?.slowDuration || towerDef.slowDuration;
    }
    
    gameState.projectiles.push(projectile);
    
    // Animation de tir
    tower.lastFire = Date.now();
  }

  /**
   * Mise à jour des projectiles
   */
  updateProjectiles(gameState, deltaTime) {
    // Limiter le nombre de projectiles
    const MAX_PROJECTILES = 30;
    while (gameState.projectiles.length > MAX_PROJECTILES) {
      gameState.projectiles.shift();
    }
    
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
      const proj = gameState.projectiles[i];
      
      // Trouver la cible
      const target = gameState.creeps.find(c => c.id === proj.targetId);
      
      if (!target) {
        // Cible morte, supprimer le projectile
        gameState.projectiles.splice(i, 1);
        continue;
      }
      
      // Déplacement vers la cible
      const dx = target.x - proj.x;
      const dy = target.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const moveDistance = proj.speed * deltaTime;
      
      if (dist <= moveDistance) {
        // Impact!
        this.projectileHit(gameState, proj, target);
        gameState.projectiles.splice(i, 1);
      } else {
        proj.x += (dx / dist) * moveDistance;
        proj.y += (dy / dist) * moveDistance;
      }
    }
  }

  /**
   * Impact d'un projectile
   */
  projectileHit(gameState, proj, target) {
    const owner = gameState.players[proj.ownerId];
    
    // Dégâts splash (Canon)
    if (proj.splashRadius) {
      for (const creep of gameState.creeps) {
        if (creep.targetPlayerId !== proj.ownerId) continue;
        
        const dx = creep.x - target.x;
        const dy = creep.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= proj.splashRadius) {
          const splashDamage = dist === 0 ? proj.damage : proj.damage * (1 - dist / proj.splashRadius);
          creep.hp -= splashDamage;
          creep.killedBy = proj.ownerId;
          if (owner) owner.damageDealt += splashDamage;
        }
      }
      
      // Effet explosion
      gameState.effects.push({
        type: 'explosion',
        x: target.x,
        y: target.y,
        radius: proj.splashRadius,
        duration: 0.3
      });
    } else {
      // Dégâts simple
      target.hp -= proj.damage;
      target.killedBy = proj.ownerId;
      if (owner) owner.damageDealt += proj.damage;
    }
    
    // Slow (Glace)
    if (proj.slowAmount) {
      target.slowAmount = proj.slowAmount;
      target.slowUntil = Date.now() + proj.slowDuration * 1000;
      
      // Effet gel
      gameState.effects.push({
        type: 'freeze',
        creepId: target.id,
        duration: proj.slowDuration
      });
    }
    
    // Effet impact
    gameState.effects.push({
      type: 'hit',
      x: target.x,
      y: target.y,
      towerType: proj.towerType,
      duration: 0.2
    });
  }

  /**
   * Mise à jour des effets
   */
  updateEffects(gameState, deltaTime) {
    // Limiter le nombre d'effets
    const MAX_EFFECTS = 20;
    
    for (let i = gameState.effects.length - 1; i >= 0; i--) {
      gameState.effects[i].duration -= deltaTime;
      if (gameState.effects[i].duration <= 0) {
        gameState.effects.splice(i, 1);
      }
    }
    
    // Si trop d'effets, supprimer les plus anciens
    while (gameState.effects.length > MAX_EFFECTS) {
      gameState.effects.shift();
    }
  }

  /**
   * Vérifie les conditions de fin de partie
   */
  checkGameEnd(gameState) {
    const alivePlayers = Object.values(gameState.players).filter(p => p.hp > 0);
    
    // Un seul survivant
    if (alivePlayers.length === 1) {
      gameState.status = 'finished';
      gameState.winner = alivePlayers[0].id;
      gameState.endReason = 'elimination';
      return;
    }
    
    // Tous morts (match nul)
    if (alivePlayers.length === 0) {
      gameState.status = 'finished';
      gameState.winner = null;
      gameState.endReason = 'draw';
      return;
    }
    
    // Temps écoulé
    if (gameState.timeRemaining <= 0) {
      gameState.status = 'finished';
      
      // Gagnant = plus de HP
      const sorted = alivePlayers.sort((a, b) => b.hp - a.hp);
      if (sorted.length >= 2 && sorted[0].hp === sorted[1].hp) {
        // Égalité de HP -> plus d'or
        sorted.sort((a, b) => b.gold - a.gold);
      }
      
      gameState.winner = sorted[0]?.id || null;
      gameState.endReason = 'timeout';
    }
  }

  // === ACTIONS DES JOUEURS ===

  /**
   * Place une tour
   */
  placeTower(gameState, playerId, towerType, x, y) {
    const player = gameState.players[playerId];
    if (!player) return { success: false, error: 'Joueur introuvable' };
    
    const towerDef = CONSTANTS.TOWERS[towerType];
    if (!towerDef) return { success: false, error: 'Type de tour invalide' };
    
    if (player.gold < towerDef.cost) {
      return { success: false, error: 'Or insuffisant' };
    }
    
    // Vérifier position valide
    if (!this.isValidTowerPosition(gameState, playerId, x, y)) {
      return { success: false, error: 'Position invalide' };
    }
    
    // Créer la tour
    const tower = {
      id: gameState.nextTowerId++,
      type: towerType,
      x: Math.round(x),
      y: Math.round(y),
      level: 1,
      cooldown: 0,
      lastFire: 0
    };
    
    player.towers.push(tower);
    player.gold -= towerDef.cost;
    player.goldSpent += towerDef.cost;
    player.stats.towersBuilt++;
    
    return { success: true, tower };
  }

  /**
   * Vérifie si une position est valide pour une tour
   */
  isValidTowerPosition(gameState, playerId, x, y) {
    const path = gameState.map?.path || CONSTANTS.PATH_WAYPOINTS;
    const minDist = CONSTANTS.MAP.TOWER_MIN_DISTANCE;
    const mapWidth = CONSTANTS.MAP.WIDTH;
    const mapHeight = CONSTANTS.MAP.HEIGHT;
    
    // Vérifier qu'on est dans les limites de la carte
    if (x < 20 || x > mapWidth - 20 || y < 20 || y > mapHeight - 20) {
      return false;
    }
    
    // Vérifier qu'on n'est pas sur le chemin
    for (let i = 0; i < path.length - 1; i++) {
      const dist = this.distToSegment(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
      if (dist < CONSTANTS.MAP.PATH_WIDTH) {
        return false;
      }
    }
    
    // Vérifier distance avec autres tours
    const player = gameState.players[playerId];
    for (const tower of player.towers) {
      const dx = tower.x - x;
      const dy = tower.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Distance point-segment
   */
  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.sqrt((px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2);
  }

  /**
   * Améliore une tour
   */
  upgradeTower(gameState, playerId, towerId) {
    const player = gameState.players[playerId];
    if (!player) return { success: false, error: 'Joueur introuvable' };
    
    const tower = player.towers.find(t => t.id === towerId);
    if (!tower) return { success: false, error: 'Tour introuvable' };
    
    if (tower.level >= 3) {
      return { success: false, error: 'Niveau maximum atteint' };
    }
    
    const towerDef = CONSTANTS.TOWERS[tower.type];
    const upgrade = towerDef.upgrades[tower.level - 1];
    
    if (player.gold < upgrade.cost) {
      return { success: false, error: 'Or insuffisant' };
    }
    
    player.gold -= upgrade.cost;
    player.goldSpent += upgrade.cost;
    tower.level++;
    player.stats.towersUpgraded++;
    
    return { success: true, tower };
  }

  /**
   * Vend une tour
   */
  sellTower(gameState, playerId, towerId) {
    const player = gameState.players[playerId];
    if (!player) return { success: false, error: 'Joueur introuvable' };
    
    const towerIndex = player.towers.findIndex(t => t.id === towerId);
    if (towerIndex === -1) return { success: false, error: 'Tour introuvable' };
    
    const tower = player.towers[towerIndex];
    const towerDef = CONSTANTS.TOWERS[tower.type];
    
    // Calcul du remboursement (50% du coût total)
    let totalCost = towerDef.cost;
    for (let i = 0; i < tower.level - 1; i++) {
      totalCost += towerDef.upgrades[i].cost;
    }
    const refund = Math.floor(totalCost * 0.5);
    
    player.towers.splice(towerIndex, 1);
    player.gold += refund;
    player.goldEarned += refund;
    player.stats.towersSold++;
    
    return { success: true, refund };
  }

  /**
   * Détruit une tour (par saboteur ou missile)
   */
  destroyTower(gameState, playerId, towerId, destroyerId = null) {
    const player = gameState.players[playerId];
    if (!player) return { success: false, error: 'Joueur introuvable' };
    
    const towerIndex = player.towers.findIndex(t => t.id === towerId);
    if (towerIndex === -1) return { success: false, error: 'Tour introuvable' };
    
    const tower = player.towers[towerIndex];
    
    // Effet d'explosion
    gameState.effects.push({
      type: 'towerDestroyed',
      x: tower.x,
      y: tower.y,
      playerId: playerId,
      duration: 1.0
    });
    
    // Retirer la tour
    player.towers.splice(towerIndex, 1);
    player.stats.towersLost = (player.stats.towersLost || 0) + 1;
    
    // Stats pour le destructeur
    if (destroyerId) {
      const destroyer = gameState.players[destroyerId];
      if (destroyer) {
        destroyer.stats.towersDestroyed = (destroyer.stats.towersDestroyed || 0) + 1;
      }
    }
    
    return { success: true, tower };
  }

  /**
   * Utilise la capacité missile
   */
  useMissile(gameState, playerId, targetPlayerId, targetTowerId) {
    const player = gameState.players[playerId];
    if (!player) return { success: false, error: 'Joueur introuvable' };
    
    const ability = CONSTANTS.ABILITIES.MISSILE;
    
    // Vérifier le coût
    if (player.gold < ability.cost) {
      return { success: false, error: 'Or insuffisant' };
    }
    
    // Vérifier le cooldown
    if (!player.abilityCooldowns) player.abilityCooldowns = {};
    if (player.abilityCooldowns['MISSILE'] && player.abilityCooldowns['MISSILE'] > 0) {
      return { success: false, error: 'En recharge' };
    }
    
    // Vérifier la cible
    const targetPlayer = gameState.players[targetPlayerId];
    if (!targetPlayer) return { success: false, error: 'Cible introuvable' };
    
    const targetTower = targetPlayer.towers.find(t => t.id === targetTowerId);
    if (!targetTower) return { success: false, error: 'Tour cible introuvable' };
    
    // Débiter l'or
    player.gold -= ability.cost;
    player.goldSpent += ability.cost;
    
    // Appliquer le cooldown
    player.abilityCooldowns['MISSILE'] = ability.cooldown;
    
    // Créer l'effet de missile
    gameState.effects.push({
      type: 'missile',
      startX: 50,
      startY: 50,
      targetX: targetTower.x,
      targetY: targetTower.y,
      targetTowerId: targetTowerId,
      targetPlayerId: targetPlayerId,
      playerId: playerId,
      duration: 1.5
    });
    
    // Détruire la tour après un délai (pour l'animation)
    setTimeout(() => {
      this.destroyTower(gameState, targetPlayerId, targetTowerId, playerId);
    }, 1500);
    
    return { success: true };
  }

  /**
   * Envoie une vague de creeps
   */
  sendWave(gameState, playerId, packId, targetPlayerId) {
    const player = gameState.players[playerId];
    if (!player) return { success: false, error: 'Joueur introuvable' };
    
    const target = gameState.players[targetPlayerId];
    if (!target) return { success: false, error: 'Cible introuvable' };
    
    if (targetPlayerId === playerId) {
      return { success: false, error: 'Impossible de s\'attaquer soi-même' };
    }
    
    // Vérifier limite de creeps sur la map
    const maxCreeps = CONSTANTS.AI.MAX_CREEPS || 50;
    if (gameState.creeps.length >= maxCreeps) {
      return { success: false, error: 'Trop de creeps sur la carte' };
    }
    
    const pack = CONSTANTS.WAVE_PACKS[packId];
    if (!pack) return { success: false, error: 'Pack invalide' };
    
    if (player.gold < pack.cost) {
      return { success: false, error: 'Or insuffisant' };
    }
    
    // Vérifier cooldown
    if (player.packCooldowns[packId] && player.packCooldowns[packId] > 0) {
      return { success: false, error: 'Cooldown en cours' };
    }
    
    // Débiter l'or
    player.gold -= pack.cost;
    player.goldSpent += pack.cost;
    
    // Appliquer cooldown
    if (pack.cooldown > 0) {
      player.packCooldowns[packId] = pack.cooldown;
    }
    
    // === CALCUL DU SCALING (basé sur le temps et tours ennemies uniquement) ===
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    const minutes = elapsed / 60;
    const enemyTowerCount = target.towers.length;
    
    let hpMultiplier = 1 + (minutes * CONSTANTS.SCALING.HP_PER_MINUTE) 
                        + (enemyTowerCount * CONSTANTS.SCALING.HP_PER_ENEMY_TOWER);
    hpMultiplier = Math.min(hpMultiplier, CONSTANTS.SCALING.MAX_HP_MULTIPLIER);
    
    let speedMultiplier = 1 + (minutes * CONSTANTS.SCALING.SPEED_PER_MINUTE);
    speedMultiplier = Math.min(speedMultiplier, CONSTANTS.SCALING.MAX_SPEED_MULTIPLIER);
    
    // Spawn les creeps
    for (let i = 0; i < pack.count; i++) {
      setTimeout(() => {
        this.spawnCreep(gameState, pack.creepType, targetPlayerId, playerId, hpMultiplier, speedMultiplier);
      }, i * pack.delay);
    }
    
    player.creepsSent += pack.count;
    
    return { success: true };
  }

  /**
   * Fait spawn un creep avec scaling
   */
  spawnCreep(gameState, creepType, targetPlayerId, senderId, hpMultiplier = 1, speedMultiplier = 1) {
    const creepDef = CONSTANTS.CREEPS[creepType];
    const path = gameState.map?.path || CONSTANTS.PATH_WAYPOINTS;
    
    // Appliquer le scaling
    const scaledHp = Math.round(creepDef.hp * hpMultiplier);
    const scaledSpeed = creepDef.speed * speedMultiplier;
    
    const creep = {
      id: gameState.nextCreepId++,
      type: creepType,
      x: path[0].x,
      y: path[0].y,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: scaledSpeed,
      waypointIndex: 1,
      targetPlayerId: targetPlayerId,
      senderId: senderId,
      killedBy: null,
      slowAmount: 0,
      slowUntil: 0,
      direction: 0,
      // Indicateurs visuels
      isScaled: hpMultiplier > 1.2,
      scaleLevel: hpMultiplier,
      // Saboteur spécifique
      targetsTowers: creepDef.targetsTowers || false,
      targetTowerId: null  // Sera défini dans update
    };
    
    gameState.creeps.push(creep);
    return creep;
  }

  /**
   * Récupère l'état minimal pour sync client
   */
  getMinimalState(gameState, forPlayerId = null) {
    // Limiter les creeps envoyés
    const maxCreepsToSend = 25;
    const creepsToSend = gameState.creeps.slice(0, maxCreepsToSend);
    
    // Limiter les projectiles envoyés  
    const maxProjectilesToSend = 15;
    const projectilesToSend = gameState.projectiles.slice(0, maxProjectilesToSend);
    
    // Limiter les effets envoyés
    const maxEffectsToSend = 10;
    const effectsToSend = gameState.effects.slice(0, maxEffectsToSend);
    
    return {
      tick: gameState.tick,
      timeRemaining: Math.round(gameState.timeRemaining),
      status: gameState.status,
      waveNumber: gameState.waveNumber,
      mapId: gameState.mapId,
      
      players: Object.values(gameState.players).map(p => ({
        id: p.id,
        name: p.name,
        index: p.index,
        hp: p.hp,
        gold: Math.round(p.gold),
        isAI: p.isAI,
        towers: p.towers.map(t => ({
          id: t.id,
          type: t.type,
          x: t.x,
          y: t.y,
          level: t.level
        })),
        packCooldowns: { ...p.packCooldowns },
        combo: {
          level: p.combo.level,
          timeLeft: Math.max(0, CONSTANTS.COMBO.WINDOW - (Date.now() - p.combo.lastWaveTime) / 1000)
        }
      })),
      
      creeps: creepsToSend.map(c => ({
        id: c.id,
        type: c.type,
        x: Math.round(c.x),
        y: Math.round(c.y),
        hp: c.hp,
        maxHp: c.maxHp,
        targetPlayerId: c.targetPlayerId,
        isSlowed: c.slowUntil > Date.now()
      })),
      
      projectiles: projectilesToSend.map(p => ({
        id: p.id,
        x: Math.round(p.x),
        y: Math.round(p.y),
        towerType: p.towerType
      })),
      
      effects: effectsToSend
    };
  }

  /**
   * Récupère l'état complet d'une partie
   */
  getGameState(roomCode) {
    return this.games.get(roomCode);
  }

  /**
   * Nettoie une partie terminée
   */
  cleanupGame(roomCode) {
    // Arrêter la boucle de jeu
    const loop = this.gameLoops.get(roomCode);
    if (loop) {
      clearInterval(loop);
      this.gameLoops.delete(roomCode);
    }
    
    // Nettoyer les IA
    const gameState = this.games.get(roomCode);
    if (gameState) {
      for (const player of Object.values(gameState.players)) {
        if (player.isAI) {
          aiController.cleanup(player.id);
        }
      }
    }
    
    // Supprimer l'état
    this.games.delete(roomCode);
    console.log(`[GAME] Partie ${roomCode} nettoyée`);
  }
}

module.exports = new GameEngine();