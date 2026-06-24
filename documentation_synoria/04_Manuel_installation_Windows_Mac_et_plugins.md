# Manuel d'installation - Synoria Windows, Mac et plugins

Version : 1.5.0  
Public : utilisateur, installateur, support

## Avant de commencer

Verifier :

- que l'ordinateur est a jour ;
- que l'utilisateur dispose du fichier d'installation Synoria ;
- que le mot de passe sera conserve dans un endroit securise ;
- qu'une sauvegarde existe en cas de mise a jour ;
- que les plugins fournis correspondent a la specialite du praticien.

## Installation Windows

### Version installee

1. Recuperer l'installateur Synoria pour Windows, generalement un fichier `.exe`.
2. Double-cliquer sur le fichier.
3. Si Windows Defender affiche une alerte, verifier l'origine du fichier avant de poursuivre.
4. Suivre les instructions.
5. Lancer Synoria depuis le raccourci bureau ou le menu Demarrer.
6. Creer ou saisir le mot de passe.

### Version portable Windows

La version portable ne necessite pas d'installation classique.

1. Ouvrir le dossier fourni.
2. Lancer l'executable Synoria.
3. Garder le dossier `data` avec l'application.
4. Ne pas deplacer l'executable seul.

Pour une cle USB, utiliser le manuel `05_Manuel_utilisation_cle_USB.md`.

## Installation Mac

### Installation depuis DMG

1. Recuperer le fichier `.dmg`.
2. Double-cliquer sur le fichier.
3. Glisser Synoria dans le dossier `Applications`.
4. Ouvrir Synoria depuis `Applications`.

### Alerte de securite macOS

Si macOS bloque l'ouverture :

1. Ouvrir `Reglages Systeme`.
2. Aller dans `Confidentialite et securite`.
3. Autoriser l'ouverture de Synoria si l'origine est fiable.
4. Relancer l'application.

Si l'application n'est pas signee ou notarisee, macOS peut afficher des messages plus stricts. Pour une diffusion commerciale, une signature developpeur Apple et une notarisation sont recommandees.

## Premiere configuration

Au premier lancement :

1. Definir le mot de passe utilisateur.
2. Completer le profil praticien.
3. Verifier les chemins de sauvegarde.
4. Configurer la facturation si besoin.
5. Configurer le RGPD.
6. Installer le plugin de specialite si fourni.
7. Creer une fiche patient test.
8. Creer une seance test.
9. Generer une sauvegarde.

## Installation d'un plugin

Un plugin Synoria est un fichier `.json` qui adapte le formulaire de seance a une specialite.

### Installer

1. Ouvrir Synoria.
2. Aller dans `Parametres`.
3. Ouvrir `Plugin`.
4. Cliquer sur `Importer un plugin (.json)`.
5. Selectionner le fichier plugin.
6. Verifier le nom, la version et la specialite.
7. Creer une seance test pour verifier le formulaire.

### Remplacer

1. Aller dans `Parametres > Plugin`.
2. Cliquer sur `Remplacer le plugin`.
3. Selectionner le nouveau fichier.
4. Verifier que les anciennes seances restent consultables.

### Supprimer

1. Aller dans `Parametres > Plugin`.
2. Cliquer sur `Supprimer le plugin`.
3. Confirmer.

Synoria revient alors au formulaire integre ou au comportement par defaut. La suppression du plugin ne doit pas supprimer les donnees deja saisies.

## Mise a jour de Synoria

Avant toute mise a jour :

1. Ouvrir Synoria.
2. Faire une sauvegarde generale.
3. Verifier la sauvegarde si l'option existe.
4. Fermer Synoria.
5. Lancer le nouvel installateur.
6. Ouvrir Synoria.
7. Verifier version, patients, agenda, seances, plugin et sauvegarde.

## Changement d'ordinateur

Procedure recommandee :

1. Sur l'ancien ordinateur, creer une sauvegarde generale.
2. Sauvegarder la cle de chiffrement si la version l'utilise.
3. Copier la sauvegarde sur support externe.
4. Installer Synoria sur le nouvel ordinateur.
5. Importer la sauvegarde.
6. Verifier les patients et les seances.
7. Reconfigurer Google Calendar si necessaire.
8. Verifier les chemins de sauvegarde.

## Desinstallation

Avant desinstallation :

1. Creer une sauvegarde.
2. Exporter la cle si necessaire.
3. Conserver les documents factures et exports utiles.

Sur Windows, la desinstallation peut laisser les donnees utilisateur dans le dossier applicatif pour eviter les pertes accidentelles. Supprimer les donnees uniquement si une sauvegarde valide existe et si l'utilisateur le confirme.

Sur Mac, supprimer l'application ne supprime pas toujours les donnees stockees dans le dossier utilisateur.

## Controle final apres installation

Verifier :

- ouverture de l'application ;
- connexion avec mot de passe ;
- creation d'un patient test ;
- creation d'une seance test ;
- affichage du plugin ;
- export Excel ou PDF ;
- creation d'une sauvegarde ;
- ouverture du dossier de sauvegarde ;
- configuration RGPD ;
- agenda ;
- Google Calendar si active.

