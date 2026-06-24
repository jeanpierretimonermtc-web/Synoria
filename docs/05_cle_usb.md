# Synoria sur clé USB — Mode portable

Ce manuel décrit le fonctionnement de Synoria en mode portable, c'est-à-dire exécuté directement depuis une clé USB sans installation sur le PC hôte.

---

## 1. Présentation du mode portable

Synoria portable est une version autonome de l'application qui fonctionne **entièrement depuis la clé USB**. Aucune installation sur le PC n'est nécessaire, aucune trace n'est laissée sur la machine hôte.

| Caractéristique | Valeur |
|----------------|--------|
| Stockage des données | Sur la clé USB (dossier `data/`) |
| Installation requise | Non |
| Compatibilité | Windows 10 / 11, 64 bits |
| Connexion internet | Non requise (sauf pour Google Calendar) |

> ⚠️ **Attention :** Toutes vos données de patients sont stockées **sur la clé USB**. La perte ou la casse de la clé sans sauvegarde entraîne une perte définitive des données.

---

## 2. Contenu de la clé USB

Après le premier démarrage, votre clé USB contient les éléments suivants :

```
Clé USB/
├── Synoria.exe              ← L'application (double-clic pour démarrer)
└── data/                    ← Créé automatiquement au premier lancement
    ├── database/
    │   ├── mtc.sqlite.enc   ← Base de données chiffrée (permanente)
    │   └── mtc.sqlite       ← Base de travail (présente uniquement pendant une session)
    ├── auth.json            ← Vérificateur de mot de passe + sel cryptographique
    ├── encryption.key       ← Clé de chiffrement des sauvegardes
    ├── settings.json        ← Paramètres de l'application
    ├── active.plugin.json   ← Plugin actif (si configuré)
    └── exports/             ← Exports Excel, JSON, registre RGPD
```

> ⚠️ **Attention :** Ne supprimez jamais manuellement les fichiers `auth.json` et `encryption.key`. Leur suppression entraînerait la perte définitive de l'accès aux données.

---

## 3. Premier démarrage

1. **Brancher** la clé USB sur le PC
2. **Ouvrir** l'explorateur de fichiers et naviguer vers la clé USB
3. **Double-cliquer** sur `Synoria.exe`
4. Windows peut afficher un avertissement "Application inconnue" — cliquer **Exécuter quand même**
5. L'assistant de démarrage s'affiche : **créez votre mot de passe** (8 caractères minimum)
6. Confirmez le mot de passe → Synoria s'ouvre

Le dossier `data/` est créé automatiquement sur la clé USB lors de ce premier lancement.

> 💡 **Conseil :** Notez votre mot de passe dans un endroit sécurisé (gestionnaire de mots de passe, coffre physique). Sans lui, vos données sont inaccessibles — même pour l'éditeur du logiciel.

---

## 4. Utilisation quotidienne

### Démarrer Synoria

1. Brancher la clé USB
2. Double-cliquer sur `Synoria.exe`
3. Saisir le mot de passe → l'application s'ouvre

### Fermer Synoria correctement

> ⚠️ **Attention :** Ne débranchez **jamais** la clé USB pendant que Synoria est en cours d'exécution. À la fermeture, Synoria rechiffre automatiquement la base de données. Un débranchement brutal pendant cette phase peut corrompre les données.

1. Fermer toutes les fenêtres Synoria (ou File → Quitter)
2. Attendre que l'application soit complètement fermée (icône disparue de la barre des tâches)
3. **Éjecter proprement la clé USB** depuis l'explorateur de fichiers (clic droit → Éjecter) ou depuis la barre d'état système
4. Débrancher physiquement la clé

### Utilisation sur un autre PC

La clé fonctionne sur **n'importe quel PC Windows 64 bits**. Aucune configuration supplémentaire n'est requise. Le mot de passe reste le même quelle que soit la machine utilisée.

---

## 5. Sauvegardes recommandées

> ⚠️ **Attention :** Une clé USB est un support physique fragile. Ne conservez **jamais** vos données uniquement sur la clé sans sauvegarde externe.

### Sauvegarde depuis l'application (recommandé)

1. Dans Synoria : **Paramètres → Sauvegarde → Exporter une sauvegarde générale**
2. Choisir une destination sur un autre support (disque externe, réseau, cloud chiffré)
3. Le fichier généré (`.json.enc`) est chiffré — il peut être stocké sur n'importe quel support

> 💡 **Conseil :** Configurez un chemin de sauvegarde automatique vers un dossier cloud synchronisé (OneDrive, Google Drive) depuis Paramètres → Sauvegarde → *Chemin de sauvegarde générale*. Synoria chiffre les sauvegardes avant de les écrire.

### Sauvegarde manuelle du dossier `data/`

En complément, vous pouvez copier manuellement l'intégralité du dossier `data/` vers un autre support. Cette copie contient la base chiffrée et peut servir de point de restauration d'urgence.

| Fréquence conseillée | Situation |
|----------------------|-----------|
| Quotidienne | Cabinet avec volume élevé de patients |
| Hebdomadaire | Usage modéré |
| Avant chaque mise à jour | Obligatoire |

---

## 6. Précautions importantes

### Risques liés à la clé USB

| Risque | Conséquence | Prévention |
|--------|-------------|-----------|
| Perte de la clé | Données chiffrées — inaccessibles sans le mot de passe | Sauvegarde régulière sur support séparé |
| Casse physique | Perte définitive si pas de sauvegarde | Sauvegarde obligatoire |
| Clé lente | Ralentissement à l'ouverture / fermeture | Utiliser une clé **USB 3.0 minimum** |
| Débranchement brutal | Risque de corruption de la base | Toujours éjecter proprement |

> 💡 **Conseil :** Privilégiez une clé USB 3.0 (connecteur bleu) ou 3.1 d'une marque reconnue (SanDisk, Kingston, Samsung). Les clés USB "publicitaires" bon marché sont plus sujettes aux pannes.

### Sécurité

- Si la clé USB est **perdue ou volée**, les données restent chiffrées en AES-256-GCM et sont inaccessibles sans le mot de passe — aucune action technique immédiate n'est requise
- N'utilisez pas Synoria sur des **PC publics** (cybercafé, borne de consultation) — votre mot de passe pourrait être intercepté par un keylogger
- Évitez les PC partagés sans antivirus à jour

---

## 7. Transférer vers la version installée

Si vous souhaitez passer du mode portable à la version installée sur un PC fixe :

1. **Fermer Synoria** sur la clé USB (attendre le rechiffrement complet)
2. **Installer Synoria** sur le PC cible (télécharger l'installateur depuis le site)
3. **Lancer Synoria installé une première fois** et le fermer immédiatement sans créer de mot de passe
4. Ouvrir l'explorateur et naviguer vers :
   ```
   C:\Users\[votre nom]\AppData\Roaming\Synoria\
   ```
5. **Copier le contenu du dossier `data/`** de la clé USB vers ce dossier (écraser les fichiers existants)
6. Relancer Synoria installé → saisir **le même mot de passe** qu'en mode portable

> 💡 **Conseil :** Si le dossier `AppData` n'est pas visible dans l'explorateur, affichez les fichiers cachés : Vue → Options → Affichage → Afficher les fichiers, dossiers et lecteurs cachés.

---

## 8. Différences avec la version installée

| Fonctionnalité | Version installée | Version portable (clé USB) |
|----------------|-------------------|---------------------------|
| Mise à jour automatique | Oui | Non — remplacer `Synoria.exe` manuellement |
| Performances | Optimales (SSD interne) | Dépend de la vitesse de la clé USB |
| Menu Démarrer / raccourcis | Oui | Non |
| Traces sur le PC | Dossier AppData | Aucune |
| Mobilité (utilisable partout) | Non | Oui |
| Données sur le PC hôte | Oui | Non — tout est sur la clé |

### Mettre à jour la version portable

1. Télécharger le nouveau `Synoria.exe` depuis le site officiel
2. Fermer Synoria (si ouvert)
3. Remplacer l'ancien `Synoria.exe` sur la clé USB par le nouveau fichier
4. Relancer — la mise à jour est effective

> ⚠️ **Attention :** Avant toute mise à jour du fichier exécutable, effectuez une sauvegarde complète depuis l'application (Paramètres → Sauvegarde → Exporter). Les mises à jour peuvent inclure des migrations de base de données — si une erreur survient, la sauvegarde permet de revenir à l'état précédent.
