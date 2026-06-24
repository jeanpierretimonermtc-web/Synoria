# Procedure Google Calendar - Synoria

Version : 1.5.0  
Public : utilisateur avance, administrateur, support

## Objectif

Cette procedure explique comment connecter Synoria a Google Calendar.

Synoria utilise l'API Google Calendar avec OAuth. La connexion permet de synchroniser les rendez-vous avec un calendrier Google et, selon configuration, d'importer certains calendriers Google dans l'agenda Synoria.

## Principe de confidentialite

Les rendez-vous synchronises vers Google doivent rester neutres. Le libelle recommande est `Consultation`, sans nom de patient, motif, note clinique ou information sensible.

Google Calendar ne doit pas devenir un dossier patient. Les donnees medicales ou d'accompagnement doivent rester dans Synoria.

## Pre-requis

- Un compte Google.
- Un acces a Google Cloud Console.
- Google Calendar actif sur le compte.
- Synoria installe et fonctionnel.
- Une connexion internet pendant la configuration.

## Configuration Google Cloud

### 1. Creer ou choisir un projet Google Cloud

1. Ouvrir Google Cloud Console.
2. Creer un nouveau projet ou selectionner un projet existant.
3. Donner un nom clair, par exemple `Synoria Calendar`.

### 2. Activer l'API Google Calendar

1. Aller dans `APIs & Services`.
2. Chercher `Google Calendar API`.
3. Cliquer sur `Enable` ou `Activer`.

### 3. Configurer l'ecran de consentement OAuth

1. Aller dans `Google Auth Platform` ou `OAuth consent screen`.
2. Renseigner le nom de l'application.
3. Renseigner l'email de support.
4. Choisir le type d'audience selon le contexte :
   - `Internal` si l'application est limitee a une organisation Google Workspace.
   - `External` si l'utilisateur utilise un compte Google classique.
5. Renseigner l'email de contact developpeur.
6. Enregistrer.

### 4. Declarer les scopes

Synoria peut demander :

- acces Calendar pour creer, lire et synchroniser les evenements ;
- acces a l'email utilisateur pour afficher le compte connecte.

Limiter les scopes au strict necessaire.

### 5. Creer les identifiants OAuth

1. Aller dans `Credentials` ou `Clients`.
2. Creer un client OAuth.
3. Choisir un type compatible avec l'application Synoria.
4. Recuperer :
   - Client ID ;
   - Client Secret.

Selon la configuration OAuth, l'URI de redirection locale utilisee par Synoria est :

```text
http://127.0.0.1:<port>/oauth2callback
```

Le port peut etre ouvert temporairement par l'application pendant la connexion. Si Google demande une URI exacte, il faudra aligner la configuration avec l'implementation distribuee.

## Connexion dans Synoria

1. Ouvrir Synoria.
2. Aller dans `Parametres`.
3. Ouvrir l'onglet `Google Calendar`.
4. Saisir le Client ID.
5. Saisir le Client Secret.
6. Cliquer sur `Connecter Google Calendar`.
7. Le navigateur s'ouvre.
8. Selectionner le compte Google.
9. Accepter les droits demandes.
10. Revenir a Synoria.

Synoria cree ou utilise un calendrier nomme `Synoria`.

## Choisir le calendrier de sortie

Apres connexion :

1. Charger les calendriers Google.
2. Choisir le calendrier a utiliser pour les rendez-vous Synoria.
3. Enregistrer.

Recommandation : utiliser un calendrier dedie `Synoria`, pas le calendrier personnel principal.

## Importer des calendriers Google

Synoria peut importer des evenements provenant de calendriers selectionnes.

Utilisation :

1. Aller dans `Parametres > Google Calendar`.
2. Charger les calendriers Google.
3. Cocher les calendriers a importer.
4. Choisir une couleur si l'interface le permet.
5. Enregistrer.

Ces evenements apparaissent dans l'agenda Synoria comme informations de planning. Ils ne doivent pas etre confondus avec les dossiers patients.

## Synchronisation

La synchronisation peut :

- exporter les rendez-vous Synoria vers Google ;
- mettre a jour les evenements existants ;
- importer les evenements Google selectionnes ;
- eviter de dupliquer certains evenements deja lies.

Bonne pratique :

- verifier l'agenda apres la premiere synchronisation ;
- faire un test avec un rendez-vous fictif ;
- eviter d'inscrire des donnees sensibles dans les titres Google.

## Deconnexion

Pour deconnecter :

1. Aller dans `Parametres > Google Calendar`.
2. Cliquer sur `Deconnecter`.
3. Confirmer.

La deconnexion arrete les futures synchronisations. Les evenements deja presents dans Google peuvent rester dans Google selon le comportement de la version.

## Depannage

### Autorisation insuffisante

Cause probable : les scopes ont change ou le compte n'a pas accepte les nouveaux droits.

Action :

1. Deconnecter Google Calendar dans Synoria.
2. Reconnecter.
3. Accepter les droits.

### Calendrier Synoria absent

Action :

1. Recharger les calendriers.
2. Relancer une synchronisation.
3. Verifier dans Google Calendar si le calendrier `Synoria` existe.

### Evenements en double

Action :

1. Identifier si l'evenement vient de Synoria ou d'un calendrier importe.
2. Verifier les calendriers selectionnes pour l'import.
3. Eviter d'importer le calendrier Synoria lui-meme si cela cree une boucle.

### Donnees patients visibles dans Google

Action :

1. Modifier le modele de titre d'evenement si configurable.
2. Remplacer les titres par `Consultation`.
3. Supprimer les notes sensibles de Google.
4. Sensibiliser l'utilisateur : Google Calendar n'est pas le dossier patient.

## References officielles

- Google Calendar API - Quickstart JavaScript : https://developers.google.com/workspace/calendar/api/quickstart/js
- Google Workspace - Configuration OAuth : https://developers.google.com/workspace/guides/configure-oauth-consent
- Aide Google Agenda - Parametres de partage : https://support.google.com/calendar/answer/37083?hl=fr

