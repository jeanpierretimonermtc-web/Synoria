# Manuel Administrateur — Synoria

Ce document est destiné à l'administrateur du logiciel Synoria — qu'il s'agisse du praticien lui-même ou d'un technicien de confiance. Il couvre les fonctions avancées de maintenance, de diagnostic et de sécurité.

> ⚠️ **Attention :** Ne partagez jamais ce document avec des tiers non autorisés. Les informations qu'il contient concernent des données de santé protégées.

---

## 1. Accès au panneau administration

Le panneau d'administration est accessible depuis **Paramètres → onglet Administration**.

Un mot de passe administrateur distinct du mot de passe utilisateur protège cet accès. Par défaut, ce mot de passe est `admin`. **Changez-le immédiatement après la première ouverture.**

Pour le modifier : Paramètres → Administration → *Changer le mot de passe admin* → saisir l'ancien, puis le nouveau deux fois.

Le panneau donne accès à des fonctions sensibles : journaux système, diagnostic base de données, checkpoint WAL, rapport de support. **Ne laissez jamais ce panneau ouvert sans surveillance.**

---

## 2. Journaux système

Les journaux enregistrent les événements techniques de l'application : démarrages, erreurs, avertissements, opérations de chiffrement.

**Accès :** Paramètres → Administration → *Journaux système*

Le journal affiche les N dernières lignes (configurable). Chaque entrée comporte un horodatage, un niveau (`INFO`, `WARN`, `ERROR`) et un message.

| Niveau | Signification |
|--------|--------------|
| `INFO` | Événement normal (démarrage, sauvegarde réussie) |
| `WARN` | Situation inhabituellement (checkpoint retardé, sauvegarde manquée) |
| `ERROR` | Erreur récupérée (tentative de lecture échouée, plugin invalide) |

> 💡 **Conseil :** Consultez les journaux immédiatement après qu'un utilisateur signale un dysfonctionnement. Notez l'heure précise de l'incident pour filtrer les entrées pertinentes.

Les journaux peuvent être effacés via le bouton *Vider les journaux*. Envisagez d'exporter le fichier de log avant de l'effacer si vous souhaitez conserver un historique.

---

## 3. Intégrité de la base de données

Synoria intègre un diagnostic SQLite permettant de vérifier l'état structurel de la base de données.

**Accès :** Paramètres → Administration → *Diagnostic base de données* → *Lancer le diagnostic*

Le diagnostic effectue une vérification d'intégrité complète (`PRAGMA integrity_check`) et retourne un résultat :

| Résultat | Signification |
|----------|--------------|
| `ok` | Base de données saine, aucune action requise |
| Erreurs listées | Corruption détectée — agir immédiatement |

> ⚠️ **Attention :** En cas d'erreurs détectées, **n'écrivez plus de nouvelles données**. Fermez l'application et restaurez la dernière sauvegarde valide (voir section 9).

Si le diagnostic retourne `ok` mais que des anomalies persistent à l'usage, contactez le support avec le rapport de diagnostic (section 7).

---

## 4. WAL Checkpoint

**WAL (Write-Ahead Log)** est un mécanisme de SQLite qui consigne les modifications dans un fichier temporaire avant de les intégrer à la base principale. Ce mécanisme améliore les performances mais peut laisser des données non consolidées si l'application est fermée anormalement.

**Accès :** Paramètres → Administration → *Forcer un checkpoint WAL*

Synoria effectue un checkpoint automatique à chaque fermeture normale de l'application. Le forcer manuellement est utile dans deux cas :

- Avant une **sauvegarde manuelle d'urgence** (copie directe du fichier `.sqlite`)
- Après une fermeture anormale (coupure de courant, crash) pour s'assurer que toutes les données sont bien persistées

> 💡 **Conseil :** En fonctionnement normal, vous n'avez pas besoin d'intervenir sur le WAL. Synoria le gère automatiquement.

---

## 5. Statistiques de la base

Le panneau d'administration affiche un tableau de bord statistique de la base de données.

| Indicateur | Description |
|------------|-------------|
| Patients actifs / archivés | Nombre total de fiches patients |
| Séances enregistrées | Nombre total de consultations |
| Rendez-vous planifiés | Agenda à venir |
| Factures générées | Total du journal de facturation |
| Taille de la base | En mégaoctets (base de travail déchiffrée) |
| Taille chiffrée | Taille du fichier `.sqlite.enc` sur disque |

Ces statistiques sont utiles pour évaluer les performances attendues et pour communiquer l'état du système dans un rapport de support.

---

## 6. Sauvegarde forcée

**Accès :** Paramètres → Administration → *Sauvegarde générale immédiate*

Cette action déclenche une sauvegarde générale complète (tous les patients, toutes les séances, toutes les factures) sans attendre la sauvegarde automatique planifiée.

Déclenchez une sauvegarde forcée dans les situations suivantes :

- **Avant une mise à jour** du logiciel
- **Avant une réinstallation** du système d'exploitation
- **Avant un transfert** vers un nouveau PC
- En cas de **doute sur l'intégrité** des données

> ⚠️ **Attention :** La sauvegarde est chiffrée avec la clé `encryption.key` stockée dans le dossier de données. Sans cette clé, la sauvegarde est inaccessible. Ne supprimez jamais ce fichier.

> 💡 **Conseil :** Configurez un chemin de sauvegarde sur un **support externe** (clé USB, disque réseau) dans Paramètres → Sauvegarde, de sorte que la sauvegarde forcée soit toujours hors du PC principal.

---

## 7. Rapport de diagnostic

**Accès :** Paramètres → Administration → *Générer un rapport de diagnostic*

Le rapport compile en un seul document :

- Version de Synoria, version Electron, version Node.js
- Système d'exploitation (version, architecture)
- Chemin des données utilisateur
- Configuration active (paramètres non sensibles)
- Statistiques de la base (patients, séances, taille)
- Résultat du dernier diagnostic d'intégrité
- Dernières lignes du journal système

**Usages du rapport :**

| Usage | Description |
|-------|-------------|
| Support éditeur | À joindre à tout signalement de bug à l'équipe Synoria |
| Récupération d'urgence | Permet à un technicien de connaître l'état exact du système avant intervention |
| Archivage | Bonne pratique avant chaque mise à jour majeure |

Le rapport est exporté en fichier texte dans le dossier `exports/` du répertoire de données.

---

## 8. Informations système

Le bas du panneau administration affiche en permanence les informations techniques de l'environnement d'exécution :

| Information | Exemple |
|-------------|---------|
| Version Synoria | 1.3.0 |
| Version Electron | 28.x |
| Version Node.js | 18.x |
| Chemin données utilisateur | `C:\Users\[nom]\AppData\Roaming\Synoria\` |
| Base chiffrée (taille) | `mtc.sqlite.enc` — 4,2 Mo |
| Base de travail (taille) | `mtc.sqlite` — 4,8 Mo |

---

## 9. Procédures d'urgence

### Mot de passe oublié

> ⚠️ **Attention :** Le chiffrement AES-256-GCM utilisé par Synoria ne dispose d'aucune porte dérobée. **Sans le mot de passe, les données sont inaccessibles, y compris pour l'éditeur du logiciel.** Il n'existe aucune procédure de récupération sans le mot de passe.

La seule solution en cas de perte du mot de passe est de restaurer une sauvegarde créée avant la perte, puis de redéfinir un nouveau mot de passe. Si aucune sauvegarde n'est disponible, les données sont définitivement perdues.

### Base de données corrompue

1. Fermer Synoria immédiatement
2. Ne pas relancer l'application
3. Localiser la dernière sauvegarde valide (fichier `.json.enc` dans le dossier de sauvegarde)
4. Relancer Synoria → Paramètres → Sauvegarde → *Restaurer une sauvegarde*
5. Sélectionner le fichier de sauvegarde → confirmer l'opération

### Réinstallation sans perte de données

1. Effectuer une sauvegarde générale forcée (section 6)
2. Copier manuellement le dossier de données (`AppData\Roaming\Synoria\`) vers un support externe
3. Réinstaller le système d'exploitation ou Synoria
4. Relancer Synoria et restaurer la sauvegarde

### Transfert vers un nouveau PC

1. Sur l'ancien PC : sauvegarde générale + copie du dossier de données complet
2. Installer Synoria sur le nouveau PC
3. Copier le dossier de données vers `AppData\Roaming\Synoria\` du nouveau PC
4. Lancer Synoria → utiliser le même mot de passe qu'avant

> 💡 **Conseil :** Lors d'un transfert, copiez l'intégralité du dossier de données (y compris `auth.json`, `mtc.sqlite.enc` et `encryption.key`) pour conserver à la fois la base et les sauvegardes chiffrées.

---

## 10. Sécurité

### Fichiers sensibles

| Fichier | Rôle | À protéger |
|---------|------|-----------|
| `auth.json` | Sel cryptographique + vérificateur du mot de passe | Oui |
| `mtc.sqlite.enc` | Base de données chiffrée | Oui |
| `encryption.key` | Clé de chiffrement des sauvegardes | Critique |
| `mtc.sqlite` | Base de travail (présente uniquement en session) | Oui |

> ⚠️ **Attention :** Le fichier `encryption.key` est aussi important que le mot de passe. Sans lui, aucune sauvegarde ne peut être restaurée. Conservez-en une copie sur un support séparé et sécurisé.

### Bonnes pratiques

- Ne communiquez jamais votre mot de passe, même au support technique. Synoria n'a pas besoin de votre mot de passe pour vous assister.
- Verrouillez l'application manuellement (icône cadenas) dès que vous quittez votre poste.
- Le verrouillage automatique s'active après 20 minutes d'inactivité.
- Le chiffrement AES-256-GCM utilisé est de **niveau bancaire** — les données chiffrées sur le disque sont illisibles sans le mot de passe.

### En cas de perte ou vol du PC

Les données restent chiffrées sur le disque et sont inaccessibles sans le mot de passe. Aucune action technique immédiate n'est requise sur Synoria, mais :

1. Signalez l'incident à votre délégué à la protection des données (si applicable)
2. Révoquez tout accès Google Calendar lié depuis [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
3. Documentez l'incident pour le registre RGPD (article 33 RGPD — notification CNIL sous 72h si applicable)
