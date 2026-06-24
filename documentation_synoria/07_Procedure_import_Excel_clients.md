# Procedure cible - Import Excel clients dans Synoria

Version : document de cadrage  
Public : produit, support, utilisateur avance

## Statut

Cette procedure decrit la fonction d'import Excel client a prevoir ou activer. Elle ne doit pas etre presentee comme disponible tant que l'interface d'import, la validation et les tests ne sont pas finalises dans Synoria.

## Objectif

Permettre a un praticien d'importer une liste de patients depuis un fichier Excel ou CSV provenant :

- d'un ancien logiciel ;
- d'un tableur personnel ;
- d'un export administratif ;
- d'une liste de contacts cabinet.

## Formats acceptes

Formats recommandes :

- `.xlsx` ;
- `.csv`.

Le fichier doit contenir une ligne d'en-tete avec des colonnes nommees.

## Colonnes possibles

Colonnes patient :

- civilite ;
- nom ;
- prenom ;
- date de naissance ;
- telephone ;
- email ;
- adresse ;
- profession ;
- medecin traitant ;
- antecedents ;
- traitements en cours ;
- alertes ;
- notes ;
- date de consentement ;
- consentement oui/non.

Colonnes techniques :

- identifiant externe ;
- date de creation ;
- statut actif/archive.

## Procedure utilisateur

1. Aller dans `Parametres` ou `Patients`.
2. Cliquer sur `Importer des patients`.
3. Selectionner un fichier `.xlsx` ou `.csv`.
4. Afficher l'aperçu des premieres lignes.
5. Associer les colonnes du fichier aux champs Synoria.
6. Corriger les erreurs signalees.
7. Lancer un import test si l'option existe.
8. Confirmer l'import final.
9. Consulter le rapport d'import.

## Mapping des colonnes

L'utilisateur doit pouvoir mapper :

| Colonne fichier | Champ Synoria |
|---|---|
| Nom client | Nom |
| Prenom client | Prenom |
| Tel | Telephone |
| Mail | Email |
| Naissance | Date de naissance |
| Adresse complete | Adresse |
| Notes | Notes generales |

Le mapping automatique peut proposer des correspondances, mais l'utilisateur doit valider.

## Validation

Synoria doit verifier :

- nom obligatoire ;
- prenom recommande ;
- email valide si present ;
- telephone normalise si possible ;
- date de naissance lisible ;
- consentement interpretable ;
- lignes vides ignorees ;
- caracteres dangereux neutralises ;
- taille de fichier raisonnable.

## Doublons

Detection proposee :

- meme nom + prenom + date de naissance ;
- meme email ;
- meme telephone ;
- identifiant externe identique si fourni.

Options utilisateur :

- ignorer le doublon ;
- mettre a jour la fiche existante ;
- creer une nouvelle fiche ;
- decider ligne par ligne.

## Rapport d'import

Le rapport doit indiquer :

- nombre de lignes lues ;
- patients crees ;
- patients mis a jour ;
- lignes ignorees ;
- erreurs ;
- doublons detectes ;
- fichier source ;
- date de l'import.

Le rapport doit etre exportable ou consultable apres import.

## Securite

Avant import :

1. Faire une sauvegarde generale.
2. Verifier l'origine du fichier.
3. Ne pas importer un fichier inconnu.
4. Ne pas ouvrir de macros.
5. Ne jamais executer de script contenu dans un fichier client.

Apres import :

1. Verifier un echantillon de fiches.
2. Corriger les champs mal reconnus.
3. Supprimer le fichier source s'il n'est plus necessaire.

## RGPD

L'import Excel est un traitement de donnees personnelles.

Le praticien doit s'assurer :

- qu'il a le droit d'importer ces donnees ;
- que les patients sont informes ;
- que les donnees sont utiles et proportionnees ;
- que les fichiers sources sont securises ;
- que les donnees obsoletes ne sont pas importees inutilement.

## Tests d'acceptation

Avant livraison, tester :

- fichier `.xlsx` simple ;
- fichier `.csv` avec point-virgule ;
- accents ;
- dates francaises ;
- lignes vides ;
- colonnes inconnues ;
- email invalide ;
- doublons ;
- fichier trop volumineux ;
- annulation avant import ;
- sauvegarde avant import ;
- restauration apres import.

