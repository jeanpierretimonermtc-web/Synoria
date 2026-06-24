# Manuel administrateur - Synoria

Version : 1.5.0  
Public : administrateur, support technique, editeur

## Objectif

Ce manuel decrit les fonctions qui ne doivent pas etre exposees a l'utilisateur standard. Ces fonctions peuvent aider au diagnostic, a la maintenance, a la verification de la base de donnees, a l'analyse des logs et a la configuration avancee.

Un utilisateur praticien ne doit pas avoir acces libre a ces fonctions, car elles peuvent reveler des informations techniques, faciliter une mauvaise manipulation ou modifier des parametres sensibles.

## Acces administrateur

L'acces administrateur est protege par un mot de passe dedie.

Il donne acces a :

- informations systeme ;
- statistiques base de donnees ;
- journaux techniques ;
- operations de maintenance base ;
- sauvegarde forcee ;
- configuration brute.

Le mot de passe administrateur ne doit pas etre communique aux utilisateurs finaux.

## Informations systeme

L'onglet systeme sert au support.

Il peut afficher :

- version de Synoria ;
- environnement Electron ;
- systeme d'exploitation ;
- chemins de donnees ;
- etat de la base ;
- nombre de patients ;
- nombre de seances ;
- nombre de rendez-vous.

Utilisation :

1. Ouvrir le panneau administrateur.
2. Verifier la version.
3. Relever les chemins utiles.
4. Comparer avec la version attendue avant une intervention.

## Logs techniques

Les logs servent a comprendre une erreur.

Ils peuvent contenir :

- erreurs d'import ;
- erreurs Google Calendar ;
- erreurs de sauvegarde ;
- erreurs de base ;
- traces de diagnostic.

Regles :

- ne jamais publier les logs sans verification ;
- masquer les donnees personnelles si elles apparaissent ;
- transmettre uniquement au support autorise ;
- supprimer les logs uniquement apres sauvegarde ou diagnostic si necessaire.

## Maintenance base de donnees

Les fonctions de base peuvent inclure :

- controle d'integrite ;
- checkpoint WAL ;
- statistiques ;
- sauvegarde forcee.

### Controle d'integrite

Lancer ce controle si :

- l'application se ferme brutalement ;
- une restauration a ete faite ;
- des erreurs de lecture apparaissent ;
- l'utilisateur signale des dossiers manquants.

### Checkpoint WAL

Le checkpoint WAL permet de consolider les donnees SQLite lorsque le mode journal WAL est utilise. Il doit etre reserve au support.

### Sauvegarde forcee

La sauvegarde forcee peut etre utilisee avant :

- mise a jour ;
- intervention technique ;
- migration ;
- analyse d'un probleme ;
- changement de poste.

## Configuration brute

La configuration brute ne doit pas etre modifiee par un utilisateur final.

Elle peut contenir :

- chemins de sauvegarde ;
- parametres RGPD ;
- parametres de facturation ;
- configuration Google Calendar ;
- options de securite ;
- chemins internes.

Une mauvaise modification peut casser l'application ou rendre une sauvegarde introuvable.

## Google Calendar cote admin

Les identifiants Google Calendar doivent etre traites comme secrets :

- Client ID ;
- Client Secret ;
- jetons d'acces ;
- jeton de rafraichissement ;
- identifiant de calendrier.

Regles :

- ne pas stocker ces valeurs dans un document client ;
- ne pas les envoyer par email non securise ;
- ne pas reutiliser un projet Google personnel pour plusieurs clients sans strategie claire ;
- revoquer l'acces en cas de doute.

## Plugins cote admin

Un plugin Synoria est un fichier JSON. Il doit etre valide avant livraison.

Champs requis :

- `id` ;
- `name` ;
- `specialty` ;
- `version` ;
- `sections` sauf si `useBuiltinForm` est actif.

Types de champs acceptes :

- `text` ;
- `textarea` ;
- `richtext` ;
- `number` ;
- `date` ;
- `select` ;
- `radio` ;
- `checkbox` ;
- `checkboxgroup` ;
- `tags` ;
- `rating` ;
- `bodychart` ;
- `separator`.

Controle avant livraison :

1. Valider que le JSON est lisible.
2. Importer le plugin dans Synoria.
3. Creer une seance test.
4. Enregistrer.
5. Reouvrir le resume.
6. Exporter si necessaire.
7. Supprimer ou remplacer le plugin pour verifier que les donnees restent accessibles.

## Ce que l'utilisateur standard ne doit pas avoir

L'utilisateur ne doit pas recevoir :

- le mot de passe administrateur ;
- les chemins internes de diagnostic avances s'ils ne sont pas necessaires ;
- les jetons Google OAuth ;
- les fichiers de configuration bruts ;
- les commandes de maintenance base ;
- les procedures de modification directe de SQLite ;
- les scripts de build ;
- les cles de signature ;
- les secrets de publication ;
- les mots de passe de test ou comptes internes ;
- les informations de contournement de securite.

## Procedure support recommandee

1. Demander la version Synoria.
2. Demander le systeme : Windows ou Mac.
3. Demander si la version est installee ou portable USB.
4. Demander une sauvegarde recente.
5. Generer un diagnostic depuis l'application si disponible.
6. Lire les logs.
7. Faire une sauvegarde avant toute correction.
8. Appliquer la correction.
9. Verifier ouverture, recherche patient, creation seance, export et sauvegarde.

