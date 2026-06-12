SYNORIA v1.4.2 — Version Clé USB
==================================

Ce dossier contient la version portable de Synoria,
prévue pour fonctionner directement depuis une clé USB.

CONTENU
-------
  Synoria 1.4.2.exe   — Exécutable portable (aucune installation requise)
  data/               — Dossier de données (créé automatiquement au premier lancement)
                        Contient la base de données chiffrée et les paramètres

UTILISATION
-----------
1. Copiez ce dossier (CleUSB/) à la racine de votre clé USB
2. Branchez la clé USB sur n'importe quel PC Windows 10/11 64 bits
3. Double-cliquez sur "Synoria 1.4.2.exe"
4. Les données sont stockées dans le dossier "data/" sur la clé USB,
   pas sur l'ordinateur utilisé

PREMIER LANCEMENT
-----------------
Au premier démarrage, Synoria vous demande de créer un mot de passe
et de remplir votre profil praticien (nom, adresse, SIRET...).
Ce mot de passe chiffre votre base de données. Conservez-le précieusement —
il ne peut pas être récupéré en cas d'oubli.

ATTENTION — ÉJECTION
--------------------
Fermez toujours Synoria avant d'éjecter la clé USB.
Le logiciel rechiffre la base de données à la fermeture.
Une éjection brusque pendant que Synoria est ouvert
pourrait corrompre vos données.

SAUVEGARDE
----------
Il est fortement conseillé de configurer une sauvegarde automatique
vers un dossier sur votre ordinateur (Paramètres > Sauvegardes).
En cas de perte ou de casse de la clé USB, votre sauvegarde
vous permettra de tout récupérer.

MISE À JOUR depuis v1.4.1
--------------------------
1. Fermez Synoria
2. Remplacez "Synoria 1.4.1.exe" par "Synoria 1.4.2.exe"
3. Le dossier "data/" est conservé — vos données sont intactes
4. Au premier lancement, la migration v14 s'applique automatiquement
   (création de la table session_templates)

NOUVEAUTÉS v1.4.2
-----------------
- Templates de séance : sauvegardez et rechargez vos modèles cliniques
- Recherche globale : Ctrl+K pour chercher dans patients et séances
- Mode sombre entièrement finalisé (écran de connexion inclus)
- Raccourcis clavier Ctrl+1 à Ctrl+7 pour naviguer entre les pages
- Vérification d'intégrité des sauvegardes

------
Synoria — Logiciel de gestion de dossiers patients
Conforme RGPD · Données 100% locales · Chiffrement AES-256-GCM
Windows 10/11 64 bits
Juin 2026
