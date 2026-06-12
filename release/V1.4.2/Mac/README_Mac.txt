SYNORIA v1.4.2 — Build macOS
==============================

Le fichier DMG pour macOS est généré via GitHub Actions sur ce dépôt.
Le build se déclenche automatiquement lors du push du tag v1.4.2.

COMMENT OBTENIR LE DMG
-----------------------
1. Allez sur le dépôt GitHub du projet
2. Cliquez sur l'onglet "Actions"
3. Sélectionnez le workflow "Build macOS (Synoria)"
4. Cliquez sur le run déclenché par le tag v1.4.2
5. Téléchargez l'artifact "Synoria-macOS-1.4.2" (disponible 90 jours)

OU via la page Releases :
   https://github.com/jeanpierretimonermtc-web/Synoria/releases/tag/v1.4.2

FICHIER GÉNÉRÉ
--------------
  Synoria-1.4.2-universal.dmg

  Compatible :
  - macOS Intel (x64)    — Mac avant fin 2020
  - macOS Apple Silicon  — Mac M1/M2/M3/M4 (depuis fin 2020)
  - macOS 10.13 High Sierra minimum

INSTALLATION SUR MAC
--------------------
1. Double-cliquez sur Synoria-1.4.2-universal.dmg
2. Glissez Synoria.app dans le dossier Applications
3. Au premier lancement : clic droit → Ouvrir (pour autoriser l'app)
4. Réglages Système → Confidentialité et sécurité → Ouvrir quand même

MISE À JOUR depuis v1.4.1
--------------------------
1. Téléchargez le nouveau DMG
2. Glissez Synoria.app dans Applications (remplace l'ancienne version)
3. Vos données sont conservées dans ~/Library/Application Support/Synoria/

DÉCLENCHER LE BUILD MANUELLEMENT
----------------------------------
Si le build n'a pas été déclenché automatiquement par le tag :
1. Allez sur Actions > "Build macOS (Synoria)"
2. Cliquez "Run workflow"
3. Entrez la version : 1.4.2
4. Lancez le build

------
Synoria — Logiciel de gestion de dossiers patients
Conforme RGPD · Données 100% locales · Chiffrement AES-256-GCM
Juin 2026
