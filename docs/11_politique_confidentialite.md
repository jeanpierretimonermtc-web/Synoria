# Politique de confidentialité — Synoria

*Dernière mise à jour : juin 2026*

---

## 1. Éditeur

**Jean-Pierre Timoner**
Développeur indépendant — praticien en médecine traditionnelle chinoise
Email : jeanpierre.timoner.mtc@gmail.com

---

## 2. Principe fondamental : local first

**Synoria est une application de bureau fonctionnant exclusivement en local.**

Toutes les données que vous saisissez dans Synoria — patients, séances, rendez-vous, comptabilité — sont stockées uniquement sur votre machine, dans un dossier chiffré. Aucune donnée n'est transmise à l'éditeur, à des serveurs distants, ou à des tiers.

| Principe | Statut |
|---|---|
| Données stockées localement | ✅ Oui, toujours |
| Données transmises à l'éditeur | ❌ Jamais |
| Données transmises à des tiers | ❌ Jamais |
| Serveur Synoria | ❌ N'existe pas |
| Accès à distance possible | ❌ Impossible |

---

## 3. Données collectées par Synoria

### Données que vous saisissez (stockées localement, chiffrées)

| Catégorie | Données | Stockage |
|---|---|---|
| Données patients | Coordonnées, date de naissance, antécédents, médicaments, notes | Local, chiffré AES-256 |
| Données de séances | Diagnostics, traitements, évolution, formulaires | Local, chiffré AES-256 |
| Rendez-vous | Dates, horaires, notes, coordonnées invités | Local, chiffré AES-256 |
| Comptabilité | Revenus, dépenses, factures | Local, chiffré AES-256 |
| Paramètres | Configuration de l'application | Local, non chiffré |
| Journal d'accès | Historique des ouvertures de fiches (RGPD) | Local, chiffré AES-256 |

### Données que Synoria NE collecte PAS

| Pratique | Synoria |
|---|---|
| Analytics d'utilisation | ❌ Aucun |
| Rapports de plantage (crash reports) | ❌ Aucun |
| Télémétrie (durée d'utilisation, fonctions utilisées) | ❌ Aucune |
| Statistiques d'usage anonymisées | ❌ Aucune |
| Identifiant machine ou utilisateur | ❌ Aucun |

---

## 4. Chiffrement des données

La base de données Synoria est chiffrée à l'aide de l'algorithme **AES-256-GCM**, standard utilisé par les institutions bancaires et gouvernementales.

| Composant | Détail technique |
|---|---|
| Algorithme | AES-256-GCM |
| Dérivation de clé | PBKDF2-SHA256, 600 000 itérations |
| Sel | 32 octets aléatoires, unique par installation |
| Vecteur d'initialisation | Aléatoire à chaque chiffrement |
| Clé de sauvegarde | Distincte du mot de passe, stockée dans `encryption.key` |

> ⚠️ **Attention :** La sécurité du chiffrement repose sur votre mot de passe. Un mot de passe faible (moins de 8 caractères, mot du dictionnaire) réduit considérablement la protection. Utilisez un mot de passe d'au moins 12 caractères.

La base de données est déchiffrée uniquement pendant votre session de travail. À la fermeture de l'application, elle est rechiffrée et le fichier de travail est supprimé.

---

## 5. Google Calendar (fonctionnalité optionnelle)

Si vous choisissez d'activer la synchronisation avec **Google Calendar**, les données suivantes sont transmises à Google :

| Données transmises | Données NON transmises |
|---|---|
| Titre générique : "Consultation" | Nom du patient |
| Date et heure du rendez-vous | Informations médicales |
| Durée du rendez-vous | Motif de consultation |
| Note du rendez-vous (si vous en ajoutez une) | Antécédents, traitements |

La synchronisation Google Calendar est **optionnelle et révocable à tout moment** depuis `Paramètres → Google Calendar → Déconnecter`.

L'authentification Google utilise le protocole OAuth 2.0 standard. Synoria ne conserve pas votre mot de passe Google.

> ⚠️ **Attention :** Si vous saisissez le nom d'un patient dans le champ "Note" d'un rendez-vous synchronisé avec Google, cette information apparaîtra dans votre compte Google Calendar. Privilégiez des notes génériques.

---

## 6. Mises à jour

Synoria vérifie périodiquement la disponibilité de nouvelles versions en contactant le dépôt public sur **GitHub** (github.com). Cette vérification :

- Lit uniquement le numéro de la dernière version disponible
- Ne transmet aucune donnée depuis votre machine (ni identifiant, ni statistiques)
- N'effectue pas de téléchargement automatique sans votre accord explicite

Le téléchargement de la mise à jour, lorsque vous l'acceptez, se fait directement depuis GitHub. Aucun serveur de l'éditeur n'est impliqué.

---

## 7. Vos droits sur vos données

Toutes vos données étant stockées localement sur votre machine, **vous en avez le contrôle total** à tout moment.

| Action | Comment faire |
|---|---|
| Accéder à vos données | Toutes les données sont accessibles dans l'application |
| Exporter vos données | `Paramètres → Sauvegarde → Exporter` |
| Supprimer vos données | Désinstaller Synoria + supprimer le dossier de données |
| Transférer vos données | Export de sauvegarde + import sur le nouveau PC |

### Supprimer toutes les données

Pour supprimer définitivement toutes les données Synoria de votre machine :

1. Désinstallez Synoria via `Panneau de configuration → Programmes`
2. Supprimez le dossier : `C:\Users\[votre nom]\AppData\Roaming\Dossier Patient MTC\`

> ⚠️ **Attention :** Cette suppression est irréversible. Effectuez une sauvegarde si vous souhaitez conserver vos données avant de désinstaller.

---

## 8. Modifications de cette politique

En cas de modification substantielle de cette politique (notamment si une fonctionnalité impliquant des données externes était ajoutée), une notification sera affichée dans l'application lors de la mise à jour concernée.

L'historique des modifications est consultable dans le [Changelog](09_changelog.md).

---

## 9. Contact

Pour toute question relative à la confidentialité ou au traitement des données :

**Jean-Pierre Timoner**
jeanpierre.timoner.mtc@gmail.com
