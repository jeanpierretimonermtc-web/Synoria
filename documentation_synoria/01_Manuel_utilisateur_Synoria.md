# Manuel d'utilisation - Synoria

Version : 1.5.0  
Public : utilisateur praticien

## Presentation

Synoria est un logiciel de gestion de cabinet et de dossiers patients pour praticiens independants : MTC, kinesiologie, naturopathie, osteopathie, therapies manuelles et accompagnement individuel.

Synoria permet de centraliser :

- les fiches patients ;
- l'historique des seances ;
- les anamneses personnalisees par specialite ;
- l'agenda ;
- les exports et sauvegardes ;
- la facturation ;
- la comptabilite simplifiee ;
- les elements de suivi RGPD.

Le logiciel fonctionne en local sur l'ordinateur du praticien ou en version portable sur cle USB. Les donnees ne sont pas envoyees dans un cloud Synoria par defaut.

## Premiere ouverture

Au premier lancement, l'utilisateur doit creer ou saisir son mot de passe. Ce mot de passe protege l'acces aux donnees. Il doit etre conserve avec soin.

Apres connexion, l'utilisateur accede au tableau de bord. Celui-ci donne une vue rapide sur les patients, les seances recentes, les prochains rendez-vous et les informations importantes.

## Tableau de bord

Le tableau de bord sert de point d'entree quotidien.

Il permet de visualiser :

- le nombre total de patients ;
- les patients actifs ;
- les seances recentes ;
- les rendez-vous a venir ;
- les alertes ou actions importantes.

Utilisation recommandee :

1. Ouvrir Synoria en debut de journee.
2. Verifier les rendez-vous.
3. Acceder directement a la fiche patient ou a l'agenda.
4. Creer une seance apres ou pendant la consultation.

## Gestion des patients

La page Patients permet de creer, consulter, modifier, rechercher et archiver les fiches patients.

Une fiche patient peut contenir :

- civilite, nom, prenom ;
- date de naissance ;
- telephone ;
- email ;
- adresse ;
- profession ;
- medecin traitant ;
- antecedents ;
- traitements en cours ;
- alertes importantes ;
- notes generales ;
- statut actif ou archive ;
- consentement RGPD et date de consentement.

### Creer un patient

1. Aller dans `Patients`.
2. Cliquer sur le bouton de creation.
3. Remplir les informations utiles.
4. Enregistrer.

Les champs administratifs peuvent etre completes progressivement. Pour un usage propre, renseigner au minimum le nom, le prenom et un moyen de contact.

### Rechercher un patient

La recherche permet de retrouver rapidement une fiche par nom, prenom ou information disponible dans le dossier.

### Archiver un patient

L'archivage sert a retirer un patient du suivi courant sans supprimer son historique. Il est preferable a la suppression lorsque le dossier doit rester conservable pour des raisons de suivi ou d'obligations professionnelles.

## Gestion des seances

Une seance rattache les notes et observations a un patient et a une date.

Selon le plugin actif, la seance peut contenir :

- motif de consultation ;
- evolution depuis la precedente seance ;
- anamnese ;
- observations ;
- diagnostic ou analyse ;
- traitement effectue ;
- conseils donnes ;
- points a surveiller ;
- prochain rendez-vous ;
- champs specialises selon la discipline.

### Creer une seance

1. Ouvrir la fiche du patient.
2. Cliquer sur nouvelle seance.
3. Renseigner la date et les champs utiles.
4. Completer le formulaire metier.
5. Enregistrer.

### Consulter l'historique

L'historique permet de suivre l'evolution du patient dans le temps. Il est recommande de noter les changements importants entre deux rendez-vous : douleur, sommeil, humeur, traitements, incidents, objectifs, reactions apres seance.

### Exporter une seance

Depuis une seance ou son resume, Synoria peut generer un export Excel. Cet export sert a l'archivage, au partage avec le patient si necessaire, ou a une conservation externe.

## Plugins d'anamnese

Un plugin Synoria adapte le formulaire de seance a une specialite.

Exemples de plugins :

- MTC ;
- MTC JP ;
- kinesiologie ;
- naturopathie ;
- osteopathie.

Un plugin peut ajouter :

- des sections d'anamnese ;
- des champs texte ;
- des zones de texte enrichi ;
- des listes deroulantes ;
- des cases a cocher ;
- des groupes de cases ;
- des tags ;
- des echelles de notation ;
- des schemas corporels ;
- des champs obligatoires.

Le plugin ne remplace pas les donnees patients. Il modifie la presentation du formulaire de seance. Les donnees deja saisies restent conservees.

## Agenda

L'agenda permet de gerer les rendez-vous et les indisponibilites.

Fonctions principales :

- affichage mois, semaine ou jour ;
- creation de rendez-vous ;
- association d'un rendez-vous a un patient ;
- creation d'un rendez-vous sans fiche patient ;
- horaires de debut et de fin ;
- notes ;
- statut realise ;
- statut annule ;
- blocs d'indisponibilite ;
- synchronisation Google Calendar si configuree.

Bonne pratique : creer le rendez-vous dans l'agenda, puis rattacher ou creer la seance apres la consultation.

## Google Calendar

Si Google Calendar est configure, Synoria peut synchroniser les rendez-vous avec un calendrier Google.

Principe de confidentialite : les evenements envoyes vers Google doivent rester neutres. L'application indique une consultation sans exposer les informations medicales ou sensibles du patient.

La configuration complete se trouve dans `03_Procedure_Google_Calendar.md`.

## Facturation

Synoria permet de generer une facture depuis une fiche patient.

Avant la premiere facture, completer le profil praticien :

- nom et prenom ;
- activite ;
- adresse ;
- email ;
- telephone ;
- SIRET si applicable ;
- informations de facturation.

Pour generer une facture :

1. Ouvrir la fiche patient.
2. Choisir l'action de facturation.
3. Renseigner la date, la designation et le montant.
4. Generer le PDF.
5. Verifier le document avant envoi au patient.

## Comptabilite simplifiee

Le module comptable aide au pilotage de l'activite. Il ne remplace pas un expert-comptable.

Il peut inclure :

- types de consultations ;
- tarifs ;
- depenses ;
- charges fixes ;
- charges variables ;
- estimation URSSAF ;
- export Excel annuel.

## Sauvegardes

Les sauvegardes sont essentielles. Une perte d'ordinateur ou de cle USB peut rendre les dossiers indisponibles si aucune copie externe n'existe.

Synoria propose :

- sauvegarde generale chiffree ;
- sauvegarde patient ;
- verification de sauvegarde ;
- import de sauvegarde ;
- export de cle de chiffrement selon les versions.

Routine conseillee :

- sauvegarde quotidienne ou hebdomadaire selon activite ;
- copie sur support externe ;
- test de restauration regulier ;
- conservation de la cle ou du mot de passe dans un endroit securise.

## RGPD

La page RGPD permet de suivre :

- les consentements patients ;
- les patients sans consentement documente ;
- le journal d'acces ;
- les alertes de conservation ;
- la notice patient ;
- l'export du registre des traitements article 30.

Synoria aide le praticien, mais ne remplace pas sa responsabilite. Le praticien reste responsable du traitement des donnees qu'il saisit.

Le manuel RGPD complet se trouve dans `06_Manuel_RGPD_utilisateur.md`.

## Import Excel client

L'import Excel client est une fonction a prevoir ou a activer selon la version distribuee. Elle permettrait d'importer une liste de patients provenant d'un tableur.

La procedure cible est decrite dans `07_Procedure_import_Excel_clients.md`.

