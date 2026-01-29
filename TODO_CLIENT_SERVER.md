# 🔧 Modifications Restantes - Client et Serveur

## ✅ Déjà Fait

1. ✅ constants.js - Saboteur, missile, limite 60
2. ✅ gameEngine.js - Logique saboteur, destroyTower(), useMissile()
3. ✅ index.html - Boutons saboteur et missile
4. ✅ style.css - Styles + responsive mobile

## 📝 À Faire

### client.js - Modifications Nécessaires

#### 1. Ajouter dans Game state (ligne ~60)
```javascript
missileMode: false,
targetingTower: null,
```

#### 2. Ajouter gestionnaire bouton missile (après ligne ~370)
```javascript
// Bouton Missile
document.getElementById('btn-missile').addEventListener('click', () => {
  Sounds.click();
  toggleMissileMode();
});
```

#### 3. Ajouter fonction toggleMissileMode (après ligne ~700)
```javascript
function toggleMissileMode() {
  if (!Game.constants) return;
  
  const ability = Game.constants.ABILITIES?.MISSILE;
  if (!ability) return;
  
  const me = Game.state?.players.find(p => p.id === Game.playerId);
  if (!me) return;
  
  // Vérifier l'or
  if (me.gold < ability.cost) {
    showNotification('Or insuffisant!', 'error');
    return;
  }
  
  // Vérifier le cooldown
  if (me.abilityCooldowns?.MISSILE && me.abilityCooldowns.MISSILE > 0) {
    showNotification(`Cooldown: ${Math.ceil(me.abilityCooldowns.MISSILE)}s`, 'error');
    return;
  }
  
  // Activer le mode ciblage
  Game.missileMode = !Game.missileMode;
  const btn = document.getElementById('btn-missile');
  const canvas = document.getElementById('game-canvas');
  
  if (Game.missileMode) {
    btn.classList.add('active');
    canvas.classList.add('targeting');
    showNotification('Cliquez sur une tour ennemie', 'info');
  } else {
    btn.classList.remove('active');
    canvas.classList.remove('targeting');
  }
}
```

#### 4. Modifier handleClick pour gérer le missile (ligne ~880)
```javascript
function handleClick(screenX, screenY) {
  if (Game.screen !== 'game' || !Game.constants) return;
  
  const gameX = (screenX - Game.offsetX - Game.panX) / Game.scale;
  const gameY = (screenY - Game.offsetY - Game.panY) / Game.scale;
  
  // MODE MISSILE - Cibler une tour ennemie
  if (Game.missileMode && Game.state) {
    const opponents = Game.state.players.filter(p => p.id !== Game.playerId);
    
    for (const opponent of opponents) {
      for (const tower of opponent.towers) {
        const dx = tower.x - gameX;
        const dy = tower.y - gameY;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
          // Tour trouvée !
          Game.socket.emit('useMissile', {
            targetPlayerId: opponent.id,
            targetTowerId: tower.id
          });
          
          // Désactiver le mode
          Game.missileMode = false;
          document.getElementById('btn-missile').classList.remove('active');
          document.getElementById('game-canvas').classList.remove('targeting');
          return;
        }
      }
    }
    
    showNotification('Cliquez sur une tour ennemie', 'error');
    return;
  }
  
  // RESTE DU CODE EXISTANT...
```

#### 5. Mettre à jour cooldowns dans l'UI (dans render ou updateHUD)
```javascript
// Mettre à jour les cooldowns de capacités
if (Game.state) {
  const me = Game.state.players.find(p => p.id === Game.playerId);
  if (me) {
    // Missile
    const missileCd = me.abilityCooldowns?.MISSILE || 0;
    const missileEl = document.getElementById('missile-cooldown');
    if (missileEl) {
      if (missileCd > 0) {
        missileEl.textContent = Math.ceil(missileCd) + 's';
        missileEl.style.display = 'block';
      } else {
        missileEl.style.display = 'none';
      }
    }
    
    // Saboteur
    const saboteurCd = me.packCooldowns?.SABOTEUR_PACK || 0;
    const saboteurEl = document.getElementById('saboteur-cooldown');
    if (saboteurEl) {
      if (saboteurCd > 0) {
        saboteurEl.textContent = Math.ceil(saboteurCd) + 's';
        saboteurEl.style.display = 'block';
      } else {
        saboteurEl.style.display = 'none';
      }
    }
  }
}
```

#### 6. Dessiner les saboteurs différemment (dans drawCreeps)
```javascript
// Dans la boucle de dessin des creeps
if (creep.targetsTowers) {
  // Dessiner flèche vers la tour cible si elle existe
  if (creep.targetTowerId && Game.state) {
    const targetPlayer = Game.state.players.find(p => 
      p.towers.some(t => t.id === creep.targetTowerId)
    );
    if (targetPlayer) {
      const targetTower = targetPlayer.towers.find(t => t.id === creep.targetTowerId);
      if (targetTower) {
        ctx.strokeStyle = '#9C27B0';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(creep.x, creep.y);
        ctx.lineTo(targetTower.x, targetTower.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}
```

#### 7. Gérer les nouveaux effets (towerDestroyed, missile)
```javascript
// Dans drawEffects
if (effect.type === 'towerDestroyed') {
  // Explosion violette
  ctx.fillStyle = `rgba(156, 39, 176, ${effect.alpha})`;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 40 * (1 - effect.alpha), 0, Math.PI * 2);
  ctx.fill();
  
  // Cercle extérieur
  ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.8})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 50 * (1 - effect.alpha), 0, Math.PI * 2);
  ctx.stroke();
}

if (effect.type === 'missile') {
  // Dessiner le missile en vol
  const progress = 1 - (effect.timeLeft / effect.duration);
  const x = effect.startX + (effect.targetX - effect.startX) * progress;
  const y = effect.startY + (effect.targetY - effect.startY) * progress;
  
  ctx.fillStyle = '#2196F3';
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Traînée
  ctx.strokeStyle = 'rgba(33, 150, 243, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(effect.startX, effect.startY);
  ctx.lineTo(x, y);
  ctx.stroke();
}
```

### server.js - Modifications Nécessaires

#### Ajouter le gestionnaire missile (après ligne ~260)
```javascript
/**
 * Utiliser la capacité missile
 */
socket.on('useMissile', ({ targetPlayerId, targetTowerId }) => {
  const room = roomManager.getPlayerRoom(socket.id);
  if (!room) return;
  
  const gameState = gameEngine.getGameState(room.code);
  if (!gameState || gameState.status !== 'playing') return;
  
  const result = gameEngine.useMissile(gameState, socket.id, targetPlayerId, targetTowerId);
  
  if (result.success) {
    socket.emit('missileUsed', { targetPlayerId, targetTowerId });
  } else {
    socket.emit('actionError', result.error);
  }
});
```

#### Envoyer ABILITIES dans constants (déjà présent normalement)
```javascript
// Dans gameStarting, vérifier que ABILITIES est envoyé
constants: {
  ABILITIES: CONSTANTS.ABILITIES,  // Ajouter si manquant
  // ... reste
}
```

---

## 🎯 Ordre d'Implémentation Recommandé

1. Modifier client.js (toutes les fonctions ci-dessus)
2. Modifier server.js (gestionnaire useMissile)
3. Tester en local
4. Déployer

---

## 🧪 Tests à Faire

- [ ] Saboteur spawn et va vers une tour
- [ ] Saboteur détruit la tour en arrivant
- [ ] Missile : mode ciblage activé/désactivé
- [ ] Missile : destruction instantanée de tour
- [ ] Cooldowns affichés correctement
- [ ] Limité à 60 créatures sur la carte
- [ ] UI mobile : tous les boutons visibles avec zoom
- [ ] UI mobile : boutons assez gros (75x68px)

---

Veux-tu que je code ces modifications maintenant ou tu préfères le faire toi-même avec ce guide ?
