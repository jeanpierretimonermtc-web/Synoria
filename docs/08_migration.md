# Guide de migration des données — Synoria

> 💡 **Avant de commencer :** Effectuez toujours une sauvegarde de vos données actuelles avant toute opération de migration. Même si vous migrez depuis un autre logiciel, gardez l'ancien système opérationnel jusqu'à avoir validé la migration dans Synoria.

---

## 1. Depuis une autre version de Synoria

C'est la méthode la plus simple et la plus fiable. Elle convient pour :
- Passer à un nouveau PC
- Réinstaller Synoria après un problème
- Restaurer une sauvegarde antérieure

### Prérequis

- Un fichier de sauvegarde Synoria au format `.json.enc`
- Le **mot de passe de la sauvegarde** (distinct du mot de passe Synoria, choisi lors de l'export)

### Procédure

1. Installez Synoria sur le nouveau poste et créez un mot de passe d'application
2. Allez dans `Paramètres → Sauvegarde → Importer une sauvegarde`
3. Sélectionnez votre fichier `.json.enc`
4. Saisissez le mot de passe de la sauvegarde quand il est demandé
5. Attendez la fin de l'import (quelques secondes)
6. Redémarrez Synoria — toutes vos données sont restaurées

> ⚠️ **Attention :** L'import remplace toutes les données existantes. Si vous avez déjà des patients ou des séances dans la nouvelle installation, elles seront écrasées.

> 💡 **Conseil :** Vérifiez après l'import que le nombre de patients et les dernières séances correspondent bien à ce que vous attendez avant de continuer à travailler.

---

## 2. Depuis Excel ou Numbers

Synoria ne dispose pas d'un import automatique depuis Excel pour l'instant. La saisie est manuelle mais peut être organisée efficacement.

### Préparer votre fichier Excel source

Identifiez et triez les colonnes de votre fichier existant selon ce mapping :

| Colonne source | Champ Synoria | Emplacement dans Synoria |
|---|---|---|
| Nom | Nom | Fiche patient |
| Prénom | Prénom | Fiche patient |
| Date de naissance | Date de naissance | Fiche patient |
| Téléphone | Téléphone | Fiche patient |
| Email | Email | Fiche patient |
| Adresse | Adresse | Fiche patient |
| Profession | Profession | Fiche patient |
| Antécédents | Antécédents | Fiche patient |
| Médicaments | Médicaments | Fiche patient |
| Notes diverses | Notes générales | Fiche patient |
| Alertes | Alertes | Fiche patient |
| Médecin traitant | Médecin traitant | Fiche patient |

### Stratégie de saisie recommandée

1. **Triez vos patients par activité récente** (ceux vus dans les 6 derniers mois en premier)
2. Ouvrez Synoria et votre Excel côte à côte
3. Créez chaque fiche patient en copiant-collant les informations
4. Pour chaque patient, créez au moins la **dernière séance** avec la date réelle et les informations essentielles

> 💡 **Conseil :** Commencez par les **10 patients les plus actifs**. Vous pouvez utiliser Synoria immédiatement pour vos consultations en cours, et compléter le reste progressivement.

---

## 3. Depuis des fiches papier

La migration depuis des fiches papier est l'occasion de numériser et structurer vos données.

### Ordre de priorité pour la saisie

| Priorité | Patients | Justification |
|---|---|---|
| 1 | Patients avec RDV à venir | Indispensable immédiatement |
| 2 | Patients vus dans les 3 derniers mois | Suivi en cours |
| 3 | Patients actifs de l'année | Historique utile |
| 4 | Anciens patients | À saisir quand vous avez du temps |

### Ce qu'il est essentiel de saisir

Pour chaque patient, concentrez-vous sur ces informations dans l'ordre :

1. **Coordonnées complètes** (nom, prénom, téléphone, date de naissance)
2. **Antécédents médicaux importants** et médicaments en cours
3. **Alertes** (allergies, contre-indications)
4. **Dernière séance** avec date, motif et traitement effectué

### Utiliser la duplication de séance

Si un patient a des séances très similaires (même problématique, même traitement), créez la première séance en détail puis utilisez le bouton **"Dupliquer"** depuis la page Historique. Modifiez uniquement les éléments qui changent (date, évolution).

> 💡 **Conseil :** Prévoyez des plages horaires dédiées à la saisie (30 min le matin avant les consultations, ou en fin de journée). Évitez de saisir entre deux patients.

---

## 4. Depuis un autre logiciel

### Étape 1 — Exporter depuis l'ancien logiciel

La plupart des logiciels de santé permettent un export vers Excel ou CSV. Cherchez dans le menu "Export", "Extraction" ou "Sauvegarde".

Données à exporter en priorité :
- Liste des patients (avec coordonnées et informations médicales)
- Historique des consultations (date + notes)
- Agenda / rendez-vous futurs

### Étape 2 — Identifier les correspondances de champs

Comparez les champs de l'ancien logiciel avec ceux de Synoria (voir tableau section 2). Certains champs n'auront pas d'équivalent exact — priorisez les informations cliniques importantes.

### Étape 3 — Saisir dans Synoria

Reprenez les données manuellement en suivant la stratégie décrite en section 3. Pour les notes longues (anamnèse, antécédents), copiez-collez directement depuis Excel dans les zones de texte de Synoria.

> ⚠️ **Attention :** Ne supprimez pas l'ancien logiciel avant d'avoir validé que toutes les données importantes ont bien été transférées et sont lisibles dans Synoria.

---

## 5. Conseils pour une migration réussie

### Timing

- **Migrez en dehors des heures de consultation** pour ne pas être interrompu
- Prévoyez un **week-end ou une semaine calme** pour la migration initiale
- Gardez l'ancien système accessible pendant **au moins 1 mois** après la migration

### Validation

Après avoir saisi les premiers patients, vérifiez :
- [ ] Les coordonnées sont correctes (téléphone, email, date de naissance)
- [ ] Les antécédents importants sont bien présents
- [ ] Les alertes médicales sont visibles sur la fiche
- [ ] Au moins une séance par patient actif est saisie

### Données historiques

Les séances historiques peuvent être saisies avec leur **date réelle**. Le champ date dans le formulaire de nouvelle séance accepte n'importe quelle date passée. Cela préserve la chronologie de l'historique clinique.

### En cas de volume important

Si vous avez plus de 100 patients actifs, envisagez une migration progressive :
- Semaine 1 : les 20 patients avec RDV à venir
- Semaine 2-4 : les patients vus dans les 3 derniers mois
- Mois 2-3 : compléter les dossiers au fur et à mesure des consultations

> 💡 **Conseil :** La migration d'un cabinet est un projet en soi. Ne cherchez pas à tout saisir d'un coup. Une fois les patients actifs dans Synoria, vous pouvez travailler normalement et compléter l'historique progressivement.
