# 📘 Manuel d'utilisation — Synoria

> Version du logiciel : **1.5.0**  
> Dernière mise à jour : juin 2026

---

## 1. 🏥 Présentation de Synoria

### Ce qu'est Synoria

Synoria est un logiciel de bureau (**desktop**) conçu pour les thérapeutes de santé. Il vous permet de gérer vos dossiers patients, vos séances, votre calendrier de rendez-vous et votre comptabilité — le tout **installé sur votre ordinateur**, sans aucune connexion à un serveur externe.

| Caractéristique | Détail |
|---|---|
| Type | Application desktop (Windows / Mac) |
| Stockage | Local uniquement — vos données restent chez vous |
| Chiffrement | AES-256 (norme bancaire) — base de données chiffrée au repos |
| Accès | Protégé par mot de passe personnel |
| Connexion Internet | Non requise (sauf Google Calendar en option) |

### Ce que Synoria n'est PAS

- ❌ Pas de cloud — aucune donnée envoyée sur Internet
- ❌ Pas d'abonnement mensuel — vous achetez une fois, vous utilisez sans limite
- ❌ Pas de télémétrie — aucune statistique anonymisée collectée
- ❌ Pas un logiciel médical certifié — usage réservé aux praticiens en médecines complémentaires

### Spécialités supportées

Synoria s'adapte à votre pratique grâce à un système de **plugins** :

| Mode | Description |
|---|---|
| **Mode simple** | Formulaire générique (7 sections libres) — pour toute thérapie |
| **MTC Jean-Pierre** | Formulaire MTC complet (pouls, langue, barrage, 5 éléments, points...) |
| **Kinésiologie** | Formulaire dédié Charlotte Decaens |
| **Ostéopathie** | Formulaire ostéopathique structuré |

---

## 2. 🔐 Premier démarrage

### Création du mot de passe

Au tout premier lancement, Synoria vous demande de créer un mot de passe. Ce mot de passe **chiffre intégralement votre base de données**.

> ⚠️ **Attention :** Si vous perdez ce mot de passe, vos données seront **inaccessibles**. Notez-le dans un endroit sûr (gestionnaire de mots de passe, coffre-fort, etc.).

- Minimum recommandé : 8 caractères, mélange lettres et chiffres
- Le mot de passe n'est jamais envoyé sur Internet
- Il peut être changé dans **Paramètres → Sécurité**

### Écran de verrouillage

À chaque ouverture de l'application, Synoria affiche un écran de verrouillage. Saisissez votre mot de passe pour accéder à vos données.

### Verrouillage automatique

Après **20 minutes d'inactivité**, Synoria se verrouille automatiquement pour protéger vos données. Vous retrouvez l'application dans l'état exact où vous l'avez laissée après avoir resaisi votre mot de passe.

> 💡 **Conseil :** Vous pouvez aussi verrouiller manuellement l'application à tout moment via le bouton 🔒 dans la navigation.

---

## 3. 📊 Tableau de bord

Le tableau de bord est la page d'accueil de Synoria. Il vous donne une vue d'ensemble de votre activité.

### Statistiques en temps réel

- Nombre total de patients actifs
- Nombre de séances ce mois-ci
- Chiffre d'affaires mensuel estimé
- Nombre de séances cette semaine

### Prochains rendez-vous

Les 5 prochains RDV sont affichés avec le nom du patient, la date et l'heure. Depuis chaque RDV, trois boutons sont disponibles :

| Bouton | Action |
|---|---|
| **Séance** | Ouvrir le formulaire de nouvelle séance pré-rempli |
| **Calendrier** | Afficher le calendrier à la date du RDV |
| **Patient** | Ouvrir la fiche du patient |

### Rappels et alertes

- 🔵 **Section bleue** — Rappels email J-1 : patients ayant un RDV demain
- 🟠 **Section ambre** — Alertes factures non payées depuis plus de 30 jours
- Séances récentes des 7 derniers jours

---

## 4. 👥 Gestion des patients

### Créer un patient

Cliquez sur **"Nouveau patient"** depuis la liste des patients. Les champs disponibles sont :

| Champ | Obligatoire |
|---|---|
| Nom, Prénom | Oui |
| Date de naissance | Non |
| Téléphone, Email | Non |
| Adresse | Non |
| Profession | Non |
| Médecin traitant | Non |
| Médicaments en cours | Non |
| Antécédents médicaux | Non |
| Alertes (allergies, précautions) | Non |
| Notes générales | Non |
| Consentement RGPD | Non (mais recommandé) |

> 💡 **Conseil :** Le champ **Alertes** apparaît en rouge en haut de chaque séance. Utilisez-le pour les contre-indications importantes.

### Modifier, archiver, supprimer

- **Modifier** : cliquez sur le crayon ✏️ depuis la fiche patient
- **Archiver** : désactive le patient (n'apparaît plus dans la liste par défaut, données conservées)
- **Supprimer** : suppression définitive avec confirmation — irréversible

### Consentement RGPD

Cochez **"Consentement donné"** et la date de consentement dans la fiche patient pour être conforme au RGPD. Le suivi est visible dans **RGPD → Consentements**.

---

## 5. 📅 Calendrier

### Vues disponibles

Le calendrier propose une vue mensuelle (gauche) et une vue planning horaire par jour (droite), avec des créneaux de 30 minutes de **08h00 à 19h30**.

### Créer un rendez-vous

Cliquez sur un créneau libre dans la vue journée, ou sur un jour dans la vue mensuelle. Vous pouvez créer :

- Un RDV pour un **patient existant** (sélection dans la liste)
- Un RDV pour un **invité externe** (nom, prénom, téléphone — sans créer de fiche patient)

### Légende des couleurs

| Couleur | Signification |
|---|---|
| 🔵 Bleu | RDV planifié |
| 🟠 Ambre | RDV en attente de confirmation |
| 🟢 Vert | RDV réalisé |
| 🟣 Violet | Bloc personnel / indisponibilité |

### Blocs personnels

Créez des blocs pour marquer vos indisponibilités (formation, congés, pause déjeuner) sans associer de patient. Ces blocs peuvent couvrir une journée entière ou un créneau horaire précis.

### Synchronisation Google Calendar

Synoria peut se synchroniser avec Google Calendar pour afficher vos RDV dans votre agenda Google et vice-versa.

> 💡 **Conseil :** Consultez le **Manuel Google Calendar** (fichier `03_google_calendar.md`) pour la procédure complète de configuration.

---

## 6. 🩺 Nouvelle séance

### Démarrer une séance

Depuis le calendrier (bouton **"Créer la séance"**) ou depuis **Nouvelle séance** dans le menu. Sélectionnez le patient et la date.

### Sections toujours visibles

1. **Identification** — patient, date, praticien, numéro de séance
2. **Info patient** — rappel des alertes et antécédents
3. **Motif** — raison de la consultation
4. **Évolution** — évolution depuis la dernière séance (tags + texte libre)

### Mode simple (sans plugin)

7 sections de texte libre :
- Anamnèse
- Contexte de vie
- Traitements en cours
- Objectifs de la séance
- Observations cliniques
- Traitement effectué
- Notes de suivi

### Mode MTC Jean-Pierre

Formulaire complet avec :
- Prise de notes (anamnèse, langue, pouls avec position)
- **Questionnaire des systèmes** (questionnaire structuré par organe)
- Observation MTC (constitution, teint, type de corps)
- **Tests énergétiques** (entonnoir de l'énergie)
- Analyse clinique (diagnostic MTC, 5 éléments, causes, analyse, principes)
- Traitement (points d'acupuncture, points d'oreille, techniques, plantes)
- Barrage homéopathique (4 niveaux)

### Mode plugin tiers

Le formulaire correspond aux sections définies par le plugin actif (Kinésiologie, Ostéopathie, etc.).

### Plan de suivi / Prochain RDV

En bas de chaque séance, définissez le prochain rendez-vous. La date et l'heure sont **automatiquement synchronisées** avec le calendrier.

### Clôture de séance

À l'enregistrement, Synoria vous propose optionnellement de :
- Marquer le RDV comme **réalisé** dans le calendrier
- Enregistrer l'acte en **comptabilité**

> ⚠️ **Attention :** L'enregistrement est définitif. Vous pouvez toutefois modifier la séance ultérieurement depuis l'historique.

---

## 7. 📋 Historique des séances

- Filtrez par patient pour voir toutes ses séances dans l'ordre chronologique
- Chaque séance peut être **développée** (accordion) pour lire le contenu complet
- Depuis chaque séance, vous pouvez :

| Action | Description |
|---|---|
| **Exporter JSON** | Fichier structuré pour archivage |
| **Exporter Excel** | Tableau mis en forme pour impression |
| **Imprimer** | Mise en page imprimable dans le navigateur |
| **Export Dossier PDF** | Toutes les séances d'un patient en un seul document |
| **Dupliquer** | Créer une nouvelle séance pré-remplie depuis une séance existante |

---

## 8. 💰 Comptabilité

- Tableau mensuel par **type de consultation** (tarif × nombre de séances)
- Vue CA mensuelle, trimestrielle et annuelle
- Section **Dépenses variables** (achats de matériel, formations, etc.)
- Calcul automatique de la base **URSSAF**
- **Export Excel** professionnel sur 6 onglets (récap annuel, mensuel détaillé, dépenses, URSSAF, factures, TVA)

> 💡 **Conseil :** Configurez vos types de consultation dans **Paramètres → Comptabilité** avant de commencer à saisir vos revenus.

---

## 9. 🧾 Facturation

- Générez une **facture PDF** numérotée depuis la fiche patient ou depuis une séance
- Le **journal des factures** liste tous les documents émis avec leur statut
- Marquez une facture comme **payée** ou **non payée**
- Une **alerte** s'affiche sur le tableau de bord pour les factures en attente depuis plus de 30 jours

---

## 10. ⚙️ Paramètres

| Section | Description |
|---|---|
| **Sauvegarde** | Dossier de sauvegarde, fréquence, nombre de copies conservées |
| **Import sauvegarde** | Restaurer depuis un fichier `.json.enc` |
| **Mot de passe** | Modifier le mot de passe de chiffrement |
| **Google Calendar** | Connexion et synchronisation de l'agenda |
| **Plugin** | Importer, activer ou désactiver un plugin |
| **RGPD** | Nom du praticien, adresse email, notice Art.13, durée de conservation |
| **Mise à jour** | Vérifier et installer une nouvelle version |

---

## 11. 💾 Sauvegardes

### Quand sauvegarder ?

- Après chaque session de travail importante
- Avant une mise à jour du logiciel
- Régulièrement (hebdomadaire minimum recommandé)

### Sauvegarde manuelle

**Paramètres → Sauvegarde → Exporter maintenant**. Le fichier `.json.enc` est chiffré avec une clé distincte de votre mot de passe.

### Sauvegarde automatique

Activez l'option **"Sauvegarder automatiquement à la fermeture"** pour générer une sauvegarde à chaque fermeture de l'application.

### Importer une sauvegarde

**Paramètres → Importer une sauvegarde** → sélectionnez le fichier `.json.enc`. Synoria vous demande la clé de chiffrement correspondante.

> ⚠️ **Attention :** L'import d'une sauvegarde **remplace** toutes les données actuelles. Faites une sauvegarde préalable avant d'importer.

### Clé de chiffrement des sauvegardes

La clé est stockée dans `userData/encryption.key`. Exportez-la séparément (sur une clé USB sécurisée) pour pouvoir restaurer vos sauvegardes sur un autre ordinateur.

---

## 12. ⌨️ Raccourcis et astuces

### Barre de mise en forme du texte

Synoria affiche une barre de formatage (gras, italique, listes) automatiquement lorsque vous cliquez dans un champ de texte enrichi. Elle disparaît lorsque vous quittez le champ.

| Bouton | Raccourci | Effet |
|---|---|---|
| **G** | Ctrl+B | Gras |
| *I* | Ctrl+I | Italique |
| U̲ | Ctrl+U | Souligné |
| ≡ | — | Liste à puces |
| 1. | — | Liste numérotée |

### Verrouiller manuellement

Cliquez sur l'icône 🔒 dans la barre de navigation pour verrouiller immédiatement l'application.

### Navigation rapide

- Utilisez la barre de navigation latérale pour changer de section
- Depuis n'importe quelle page patient, le bouton **"Retour"** conserve votre position dans la liste

> 💡 **Conseil :** Utilisez le champ de recherche en haut de la liste des patients pour trouver rapidement un dossier par nom ou prénom.
