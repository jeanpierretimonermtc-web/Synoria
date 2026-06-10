SYNORIA v1.4.0 — Build macOS
==============================

Le fichier DMG pour macOS doit être généré via GitHub Actions.
Il ne peut pas être construit depuis Windows.

COMMENT OBTENIR LE DMG
-----------------------
1. Allez sur le dépôt GitHub du projet
2. Cliquez sur l'onglet "Actions"
3. Sélectionnez le workflow "Build macOS (Synoria)"
4. Cliquez sur "Run workflow" (bouton à droite)
5. Saisissez la version : 1.4.0
6. Lancez le build (environ 5-10 minutes)
7. Téléchargez l'artifact "Synoria-macOS-1.4.0" dans la liste des runs

OU via un tag Git :
   git tag v1.4.0
   git push origin v1.4.0
   → Le workflow se déclenche automatiquement

FICHIER GÉNÉRÉ
--------------
  Synoria-1.4.0-universal.dmg

  Compatible :
  - macOS Intel (x64)    — Mac avant fin 2020
  - macOS Apple Silicon  — Mac M1/M2/M3/M4 (depuis fin 2020)
  - macOS 10.13 High Sierra minimum

INSTALLATION SUR MAC
--------------------
1. Double-cliquez sur Synoria-1.4.0-universal.dmg
2. Glissez Synoria.app dans le dossier Applications
3. Au premier lancement : clic droit → Ouvrir (pour autoriser l'app)
4. Réglages Système → Confidentialité et sécurité → Ouvrir quand même

------
Synoria — Logiciel de gestion de dossiers patients
Conforme RGPD · Données 100% locales · Chiffrement AES-256-GCM
Juin 2026
