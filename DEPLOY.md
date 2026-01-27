# 📘 Guide de Déploiement - Send the Wave

## 🎯 Structure du Projet sur GitHub

Tous les fichiers doivent être **à la racine** du repository :

```
tower-war/
├── server.js
├── gameEngine.js
├── rooms.js
├── ai.js
├── constants.js
├── client.js
├── index.html
├── style.css
├── package.json
├── .gitignore
└── README.md
```

## 📤 Upload sur GitHub

### Méthode 1 : Via l'interface GitHub

1. Créez un nouveau repository sur GitHub
2. Uploadez **tous les fichiers** directement à la racine (pas de dossiers !)
3. Commitez les changements

### Méthode 2 : Via Git CLI

```bash
# Initialiser le repo
git init
git add .
git commit -m "Initial commit"

# Connecter à GitHub
git remote add origin https://github.com/votre-username/tower-war.git
git branch -M main
git push -u origin main
```

## 🚀 Déploiement sur Render

### Étape 1 : Connecter GitHub

1. Allez sur [render.com](https://render.com)
2. Créez un compte (gratuit)
3. Connectez votre compte GitHub

### Étape 2 : Créer un Web Service

1. Cliquez sur **"New +"** → **"Web Service"**
2. Sélectionnez votre repository `tower-war`
3. Configurez :

```
Name: send-the-wave (ou votre choix)
Environment: Node
Region: Choisissez la plus proche de vous
Branch: main
Root Directory: (laisser vide)
Build Command: npm install
Start Command: npm start
```

### Étape 3 : Plan gratuit

- Sélectionnez **"Free"** (0$/mois)
- ⚠️ Note : Le serveur gratuit se met en veille après 15min d'inactivité

### Étape 4 : Déployer

1. Cliquez sur **"Create Web Service"**
2. Attendez 2-3 minutes (build + déploiement)
3. Votre jeu sera disponible à `https://votre-nom.onrender.com`

## ✅ Vérification

Une fois déployé, vérifiez dans les logs :

```
✅ Server running on port 10000
✅ Socket connection: xxxxx
```

## 🔧 Dépannage

### Erreur "Cannot find module"
- Vérifiez que **tous les fichiers** sont à la racine
- Vérifiez que `package.json` a `"main": "server.js"`
- Vérifiez que `"start": "node server.js"` dans scripts

### Le serveur démarre mais ne répond pas
- Vérifiez que le port utilisé est `process.env.PORT || 3000`
- Vérifiez les logs Render pour les erreurs

### Le jeu ne charge pas
- Vérifiez que `index.html`, `client.js`, `style.css` sont bien à la racine
- Testez en local d'abord avec `npm start`

## 🔄 Mise à jour du déploiement

Pour mettre à jour votre jeu :

1. Modifiez vos fichiers localement
2. Committez et pushez sur GitHub
3. Render redéploiera automatiquement !

```bash
git add .
git commit -m "Update game"
git push
```

## 💡 Conseils

- ✅ Testez toujours en local avant de déployer
- ✅ Vérifiez que tous les fichiers sont commités
- ✅ Gardez une copie locale de votre projet
- ✅ Le plan gratuit Render suffit pour débuter !

---

Besoin d'aide ? Vérifiez les logs Render ou testez en local !
