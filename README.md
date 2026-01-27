# 🎮 Send the Wave

Tower Defense PvP - Jeu web multijoueur temps réel

## 📋 Description

Send the Wave est un jeu de tower defense PvP où deux joueurs s'affrontent en temps réel. Placez vos tours pour défendre votre base tout en envoyant des vagues de créatures vers votre adversaire !

## ✨ Fonctionnalités

- 🎯 Mode 1v1 en temps réel
- 🤖 Mode contre IA (3 niveaux de difficulté)
- 🗺️ 3 cartes différentes (Serpent, Spirale, Carrefour)
- 🏰 3 types de tours (Archer, Canon, Glace)
- 👾 4 types de créatures (Rapide, Normal, Tank, Boss)
- 📱 Compatible mobile et desktop
- 🔄 Système de scaling dynamique
- ⚡ Système de combo visuel

## 🚀 Installation

### Prérequis

- Node.js >= 18.0.0
- npm

### Installation locale

```bash
# Cloner le repo
git clone https://github.com/votre-username/tower-war.git
cd tower-war

# Installer les dépendances
npm install

# Lancer le serveur
npm start
```

Le jeu sera accessible sur `http://localhost:3000`

## 📦 Déploiement sur Render

1. Connectez votre repo GitHub à Render
2. Créez un nouveau Web Service
3. Configuration :
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Déployez !

## 🎮 Comment jouer

1. **Entrez votre pseudo**
2. **Choisissez un mode** :
   - Match Rapide : trouvez un adversaire automatiquement
   - Créer une Partie : obtenez un code à partager
   - Rejoindre : entrez le code d'une partie
   - Contre l'IA : entraînez-vous contre un bot

3. **Pendant la partie** :
   - Placez des tours dans les zones vertes
   - Envoyez des vagues vers votre adversaire
   - Améliorez vos tours pour plus de puissance
   - Défendez votre base (100 HP)

## 🏗️ Structure du projet

```
tower-war/
├── server.js          # Serveur Express + Socket.io
├── gameEngine.js      # Moteur de jeu principal
├── rooms.js           # Gestion des salles multijoueur
├── ai.js              # Intelligence artificielle
├── constants.js       # Configuration du jeu
├── client.js          # Code client (Canvas + Socket)
├── index.html         # Interface utilisateur
├── style.css          # Styles responsive
└── package.json       # Dépendances
```

## 🛠️ Technologies utilisées

- **Backend** : Node.js, Express, Socket.io
- **Frontend** : HTML5 Canvas, Vanilla JavaScript
- **Temps réel** : WebSocket via Socket.io

## 📝 Licence

MIT

## 👤 Auteur

Développé par anys (edem38)

---

Bon jeu ! 🎮
