# 🌿 Dossier Patient MTC — Guide complet d'installation et d'utilisation

Application de bureau pour la gestion des dossiers patients en Médecine Traditionnelle Chinoise.  
Construite avec **Electron + React + TypeScript + SQLite**.

---

## 📋 Table des matières

1. [Installer Node.js](#1-installer-nodejs)
2. [Ouvrir le projet dans VS Code](#2-ouvrir-le-projet-dans-vs-code)
3. [Installer les dépendances](#3-installer-les-dépendances)
4. [Lancer l'application en mode développement](#4-lancer-lapplication-en-mode-développement)
5. [Compiler pour la production](#5-compiler-pour-la-production)
6. [Où se trouve la base de données SQLite](#6-où-se-trouve-la-base-de-données-sqlite)
7. [Sauvegarder et restaurer les données](#7-sauvegarder-et-restaurer-les-données)
8. [Exporter les séances](#8-exporter-les-séances)
9. [Architecture du projet](#9-architecture-du-projet)
10. [Parties à améliorer](#10-parties-à-améliorer)

---

## 1. Installer Node.js

Node.js est le moteur JavaScript nécessaire pour faire tourner Electron et les outils de développement.

### Télécharger Node.js

1. Rendez-vous sur **[https://nodejs.org](https://nodejs.org)**
2. Cliquez sur le bouton **LTS** (Long Term Support) — version stable recommandée
3. Téléchargez le fichier `.msi` pour Windows
4. Lancez l'installateur et suivez les étapes (laissez toutes les options par défaut)
5. ✅ Cochez **"Add to PATH"** si l'option est proposée

### Vérifier l'installation

Ouvrez le terminal **PowerShell** ou **l'invite de commandes** et tapez :

```powershell
node --version
# Résultat attendu : v20.x.x ou supérieur

npm --version
# Résultat attendu : 10.x.x ou supérieur
```

> **Note :** Si ces commandes ne fonctionnent pas, redémarrez votre ordinateur après l'installation de Node.js.

---

## 2. Ouvrir le projet dans VS Code

### Télécharger VS Code (si pas encore installé)

Rendez-vous sur **[https://code.visualstudio.com](https://code.visualstudio.com)** et téléchargez la version Windows.

### Ouvrir le projet

**Option A — Via le terminal :**
```powershell
cd C:\Users\timjp\development\dossier-patient-mtc
code .
```

**Option B — Via VS Code :**
1. Ouvrez VS Code
2. Menu `Fichier` → `Ouvrir le dossier…`
3. Naviguez vers `C:\Users\timjp\development\dossier-patient-mtc`
4. Cliquez sur **Sélectionner un dossier**

### Extensions VS Code recommandées

Installez ces extensions depuis l'onglet Extensions (Ctrl+Shift+X) :

| Extension | Identifiant | Utilité |
|-----------|-------------|---------|
| ESLint | `dbaeumer.vscode-eslint` | Qualité du code |
| Prettier | `esbenp.prettier-vscode` | Formatage automatique |
| TypeScript Vue Plugin | `Vue.vscode-typescript-vue-plugin` | Support TypeScript |
| SQLite Viewer | `qwtel.sqlite-viewer` | Visualiser la BDD directement dans VS Code |

---

## 3. Installer les dépendances

Ouvrez un terminal dans le dossier du projet (VS Code : `Terminal` → `Nouveau terminal`) :

```powershell
cd C:\Users\timjp\development\dossier-patient-mtc
npm install
```

Cette commande télécharge automatiquement tous les modules nécessaires listés dans `package.json` :

| Module | Version | Rôle |
|--------|---------|------|
| `electron` | ^28 | Fenêtre de bureau native |
| `react` + `react-dom` | ^18 | Interface utilisateur |
| `react-router-dom` | ^6 | Navigation entre les pages |
| `better-sqlite3` | ^9 | Base de données SQLite (rapide, synchrone) |
| `xlsx` | ^0.18 | Export Excel |
| `uuid` | ^9 | Génération d'identifiants uniques |
| `vite` | ^5 | Bundler rapide |
| `typescript` | ^5 | Typage statique |

> **Durée :** L'installation prend 2 à 5 minutes selon votre connexion internet.

> **⚠️ Si vous voyez une erreur sur `better-sqlite3` :** Ce module nécessite une compilation native.
> Installez les Build Tools Visual Studio avec :
> ```powershell
> npm install --global windows-build-tools
> ```
> Ou installez **Visual Studio Build Tools** depuis [https://visualstudio.microsoft.com/visual-cpp-build-tools/](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

---

## 4. Lancer l'application en mode développement

```powershell
npm run electron:dev
```

Cette commande fait trois choses en parallèle :
1. Lance **Vite** (serveur de développement React sur `http://localhost:5173`)
2. Attend que Vite soit prêt
3. Lance **Electron** qui charge l'interface React

La fenêtre de l'application s'ouvre automatiquement. Toute modification dans le code source se reflète instantanément (Hot Module Replacement).

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run electron:dev` | **Mode développement** (recommandé pour travailler) |
| `npm run build` | Compile React + Electron |
| `npm run electron:build` | Crée un installateur `.exe` pour distribuer l'app |

---

## 5. Compiler pour la production

Pour créer un installateur Windows distributable :

```powershell
npm run electron:build
```

L'installateur sera créé dans le dossier `release/` :
- Fichier `.exe` installable
- Application portable

> **Note :** La compilation prend 3-10 minutes. Elle nécessite une connexion internet pour télécharger les ressources Electron.

---

## 6. Où se trouve la base de données SQLite

La base de données SQLite est stockée automatiquement dans le dossier **AppData** de Windows :

```
C:\Users\<VotreNom>\AppData\Roaming\dossier-patient-mtc\database\mtc.sqlite
```

Pour accéder rapidement à ce dossier, tapez dans l'explorateur Windows :
```
%APPDATA%\dossier-patient-mtc\database\
```

### Visualiser la base de données

**Option 1 — Dans VS Code** avec l'extension **SQLite Viewer** :
1. Naviguez jusqu'au fichier `mtc.sqlite`
2. Clic droit → **Open with SQLite Viewer**

**Option 2 — DB Browser for SQLite** (logiciel gratuit) :
- Télécharger sur [https://sqlitebrowser.org](https://sqlitebrowser.org)
- Ouvrir le fichier `mtc.sqlite`

### Structure de la base de données

| Table | Contenu |
|-------|---------|
| `patients` | Identité, contacts, antécédents, médicaments, alertes |
| `sessions` | Toutes les données de séance (motif, diagnostic, traitement…) |
| `sessions.systemes_json` | Questionnaire par systèmes (JSON blob) |
| `sessions.energy_tests_json` | Tests énergétiques (JSON blob) |
| `exports` | Historique des exports |
| `schema_version` | Version du schéma (migrations) |

---

## 7. Sauvegarder et restaurer les données

### Créer une sauvegarde

Depuis l'application, cliquez sur **💾 Sauvegarder** en haut à droite.

La sauvegarde est enregistrée dans :
```
C:\Users\<VotreNom>\AppData\Roaming\dossier-patient-mtc\backups\
```

Format : `mtc-backup-YYYY-MM-DD.json` (fichier JSON lisible contenant tous les patients et séances)

### Restaurer une sauvegarde

1. Cliquez sur **📂 Importer** en haut à droite
2. Sélectionnez un fichier `.json` de sauvegarde
3. Les données sont importées (les existants sont mis à jour, les nouveaux sont créés)

> **⚠️ Important :** Faites toujours une sauvegarde avant d'importer !

### Sauvegarde manuelle

Pour une sécurité maximale, copiez aussi manuellement le fichier SQLite :
```powershell
# Exemple de commande de copie manuelle
Copy-Item "$env:APPDATA\dossier-patient-mtc\database\mtc.sqlite" -Destination "D:\Sauvegardes\mtc-$(Get-Date -Format 'yyyy-MM-dd').sqlite"
```

---

## 8. Exporter les séances

Depuis la page **Résumé complet**, trois exports sont disponibles :

### ⬇ Export JSON
- Exporte toutes les données de la séance au format JSON
- Fichier créé dans : `%APPDATA%\dossier-patient-mtc\exports\seance-mtc-DATE.json`
- Utile pour : archivage, échange de données, import dans d'autres systèmes

### ⬇ Export Excel
- Crée un fichier `.xlsx` avec toutes les données dans des colonnes
- Fichier créé dans : `%APPDATA%\dossier-patient-mtc\exports\seance-mtc-DATE.xlsx`
- Utile pour : analyse statistique, rapports, transmission à des confrères

### 🖨 Imprimer
- Ouvre la boîte de dialogue d'impression du système
- Permet d'imprimer ou de **sauvegarder en PDF** (choisir "Microsoft Print to PDF" comme imprimante)
- La mise en page est optimisée pour l'impression (sections clairement délimitées)

---

## 9. Architecture du projet

```
dossier-patient-mtc/
├── src/
│   ├── main/                          # Processus principal Electron (Node.js)
│   │   ├── index.ts                   # Point d'entrée Electron
│   │   ├── preload.ts                 # Bridge sécurisé (contextBridge)
│   │   ├── database/
│   │   │   ├── connection.ts          # Connexion SQLite
│   │   │   ├── migrations.ts          # Création des tables
│   │   │   └── repositories/
│   │   │       ├── patientRepository.ts
│   │   │       └── sessionRepository.ts
│   │   ├── ipc/
│   │   │   └── handlers.ts            # Handlers IPC (pont main ↔ renderer)
│   │   └── services/
│   │       ├── backupService.ts       # Import/export de sauvegarde JSON
│   │       └── exportService.ts       # Export Excel
│   ├── renderer/                      # Interface React (navigateur)
│   │   ├── App.tsx                    # Routing + Navigation
│   │   ├── index.tsx                  # Point d'entrée React
│   │   ├── components/
│   │   │   └── common/Toast.tsx       # Notifications
│   │   ├── hooks/useToast.ts          # Hook notifications
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx      # Tableau de bord
│   │   │   ├── PatientsPage.tsx       # Gestion patients
│   │   │   ├── NewSessionPage.tsx     # Nouvelle séance (formulaire complet)
│   │   │   ├── HistoryPage.tsx        # Historique avec filtres
│   │   │   ├── SummaryPage.tsx        # Résumé complet + exports
│   │   │   └── CalendarPage.tsx       # Calendrier mensuel
│   │   ├── styles/global.css          # Styles globaux (palette MTC beige/vert)
│   │   └── utils/
│   │       ├── format.ts              # Utilitaires de formatage
│   │       └── sessionData.ts         # Données statiques MTC (MV, Foyers, etc.)
│   └── shared/
│       └── types.ts                   # Types TypeScript partagés + interface IpcApi
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

### Flux de données

```
Interface React (renderer)
    ↓ window.mtcApi.xxx()
Preload (contextBridge)     ← sécurisé, pas d'accès direct à Node
    ↓ ipcRenderer.invoke()
Handlers IPC (main)
    ↓ 
Repositories SQLite
    ↓
Fichier mtc.sqlite
```

---

## 10. Parties à améliorer

### Fonctionnalités prioritaires

1. **Mode édition de séance existante**
   - Actuellement, une séance peut être créée et dupliquée mais pas éditée directement
   - Ajouter un bouton "Modifier" dans l'historique qui charge la séance dans `NewSessionPage`
   - Implémenter `updateSession()` depuis le formulaire

2. **Export PDF natif**
   - L'export PDF actuel passe par la boîte de dialogue d'impression
   - Intégrer `electron-pdf` ou `puppeteer` pour un export PDF automatique sans interaction

3. **Calendrier amélioré**
   - Vue semaine (pas seulement mensuelle)
   - Gestion des rendez-vous futurs (aujourd'hui seules les séances passées sont enregistrées)
   - Rappels / notifications

4. **Statistiques avancées**
   - Graphiques d'évolution par patient (Chart.js ou Recharts)
   - Statistiques par pathologie, par praticien, par mois
   - Export rapport mensuel

5. **Recherche globale**
   - Recherche en plein texte dans toutes les séances simultanément
   - Filtres par diagnostic MTC, points d'acupuncture, plantes

### Améliorations UX

6. **Auto-complétion**
   - Points d'acupuncture avec auto-complétion (liste des 361 points classiques)
   - Plantes médicinales depuis une base de données matière médicale
   - Diagnostics MTC fréquents

7. **Modèles de séance** (templates)
   - Sauvegarder des traitements types pour les réutiliser rapidement
   - Ex: "Syndrome Vide de Yang du Rein" avec points et plantes pré-remplis

8. **Mode multi-praticien**
   - Authentification par praticien
   - Filtrage des séances par praticien
   - Agenda partagé

### Technique

9. **Tests automatisés**
   - Tests unitaires sur les repositories SQLite (Jest)
   - Tests d'intégration IPC
   - Tests E2E avec Playwright/Spectron

10. **Synchronisation cloud**
    - Sync avec Supabase ou autre backend pour accès multi-appareils
    - Chiffrement des données sensibles (RGPD)

11. **Mise à jour automatique**
    - Intégrer `electron-updater` pour les mises à jour automatiques depuis GitHub Releases

---

## 🚀 Démarrage rapide (résumé en 3 commandes)

```powershell
# 1. Aller dans le dossier du projet
cd C:\Users\timjp\development\dossier-patient-mtc

# 2. Installer les dépendances (une seule fois)
npm install

# 3. Lancer l'application
npm run electron:dev
```

---

## 🔧 Résolution de problèmes courants

### L'application ne démarre pas

```powershell
# Supprimer les modules et réinstaller
Remove-Item -Recurse -Force node_modules
npm install
npm run electron:dev
```

### Erreur "Cannot find module 'better-sqlite3'"

```powershell
# Recompiler le module natif pour la version Electron installée
npm run postinstall
# ou
npx electron-rebuild
```

### La base de données est corrompue

1. Fermez l'application
2. Allez dans `%APPDATA%\dossier-patient-mtc\backups\`
3. Prenez la dernière sauvegarde JSON
4. Supprimez `%APPDATA%\dossier-patient-mtc\database\mtc.sqlite`
5. Relancez l'application (la BDD est recréée vide)
6. Importez la sauvegarde JSON via **📂 Importer**

### L'interface est vide / page blanche

Ouvrez les outils développeur (`Ctrl+Shift+I` dans l'application) et regardez la console pour le message d'erreur.

---

*Application développée pour la pratique de la Médecine Traditionnelle Chinoise.*  
*Stack : Electron 28 · React 18 · TypeScript 5 · SQLite (better-sqlite3) · Vite 5*
