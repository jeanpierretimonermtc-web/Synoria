# Instructions — Builder Synoria sur Mac

Merci de m'aider à compiler l'application !
Cela prend environ **15–20 minutes** et génère 2 fichiers `.dmg`.

---

## Ce dont tu as besoin

- Un **Mac** (Apple Silicon M1/M2/M3 ou Intel, peu importe)
- **Node.js 18 ou plus récent** — téléchargeable sur https://nodejs.org (prends "LTS")
- Les **sources du projet** (dossier `synoria_test` que je t'envoie)

---

## Étapes

### 1. Vérifier Node.js

Ouvre le **Terminal** (Cmd+Espace → "Terminal") et tape :

```
node -v
```

Tu dois voir quelque chose comme `v22.x.x`. Si tu vois "command not found", installe Node.js depuis https://nodejs.org puis recommence.

---

### 2. Installer les outils Xcode (si pas déjà fait)

Dans le Terminal :

```
xcode-select --install
```

Une fenêtre s'ouvre → clique "Installer". Si tu vois "already installed", c'est bon.

---

### 3. Placer le dossier du projet

Décompresse l'archive que je t'ai envoyée. Tu obtiens un dossier `synoria_test`.

Place-le où tu veux (Bureau, Documents...).

---

### 4. Lancer le script de build

Dans le Terminal, navigue jusqu'au dossier `synoria_test` :

```
cd ~/Desktop/synoria_test
```

*(adapte le chemin si tu l'as mis ailleurs)*

Rends le script exécutable puis lance-le :

```
chmod +x scripts/build-mac-manual.sh
./scripts/build-mac-manual.sh 1.5.7
```

Le script fait tout automatiquement :
- Détecte si ton Mac est Apple Silicon ou Intel
- Compile la version arm64 (Apple Silicon)
- Compile la version x64 (Intel) via Rosetta si nécessaire
- Vérifie que les binaires sont bien dans la bonne architecture
- Place les fichiers finaux dans `release-mac-v1.5.7/`

---

### 5. Récupérer les fichiers

À la fin, le script affiche le chemin du dossier de sortie :

```
release-mac-v1.5.7/
├── Synoria-v1.5.7-arm64.dmg   ← Apple Silicon (M1/M2/M3)
└── Synoria-v1.5.7-x64.dmg    ← Intel (avant fin 2020)
```

Envoie-moi ces 2 fichiers via **WeTransfer**, **Google Drive**, ou **iCloud Drive**.

---

## En cas d'erreur

### "npm ERR! ..." pendant l'installation
Essaie :
```
npm cache clean --force
./scripts/build-mac-manual.sh 1.5.7
```

### "electron-rebuild" échoue
Installe les outils Xcode et Python :
```
xcode-select --install
brew install python3
```
Si tu n'as pas Homebrew : https://brew.sh

### "better-sqlite3 n'est PAS x86_64"
Rosetta 2 n'est pas installée. Lance :
```
softwareupdate --install-rosetta --agree-to-license
```
Puis relance le script.

### Le script s'arrête avec une erreur rouge
Copie le message d'erreur et envoie-le moi, je regarderai.

---

## Ce que fait le script (pour les curieux)

1. Vérifie Node.js, Python3 et Xcode CLI Tools
2. Détecte l'architecture du Mac (arm64 ou x86_64)
3. Configure les identifiants de l'application (appId cabinet)
4. Sur Mac Apple Silicon :
   - Build arm64 avec `npm install` natif
   - Build x64 avec `arch -x86_64 npm install` (émulation Rosetta)
5. Sur Mac Intel :
   - Build x64 natif uniquement
6. Vérifie avec `file *.node` que l'architecture est correcte avant chaque build
7. Copie les DMG dans `release-mac-v1.5.7/`

---

*Synoria — Jean-Pierre Timoner — jeanpierre.timoner.mtc@gmail.com*
