# Créer son propre plugin d'anamnèse — Synoria

> 💡 **Pas besoin de programmer.** Un plugin Synoria est un simple fichier texte au format JSON. Si vous savez ouvrir un fichier avec le Bloc-notes, vous pouvez créer votre propre formulaire.

---

## 1. Qu'est-ce qu'un plugin ?

Un plugin Synoria est un fichier `.plugin.json` qui décrit le formulaire d'anamnèse de votre spécialité. Il remplace le formulaire générique par des sections et des champs adaptés à votre pratique.

**Ce que vous pouvez faire avec un plugin :**
- Créer des sections nommées selon votre vocabulaire (Bilan initial, Hygiène de vie, Plan de traitement...)
- Choisir le type de chaque champ (texte libre, liste déroulante, cases à cocher, note de 1 à 5...)
- Organiser les champs sur une, deux ou trois colonnes
- Personnaliser les couleurs de votre formulaire

**Ce qu'un plugin ne fait pas :**
- Un plugin ne modifie pas les autres parties de Synoria (patients, calendrier, comptabilité)
- Les données saisies via un plugin sont stockées de façon permanente — elles restent lisibles même si vous changez de plugin ultérieurement (le schéma est sauvegardé avec chaque séance)

> ⚠️ **Attention :** Un seul plugin peut être actif à la fois. Changer de plugin ne supprime pas les données des séances antérieures, mais le nouveau formulaire s'applique aux nouvelles séances uniquement.

---

## 2. Structure du fichier plugin

Voici le squelette d'un plugin avec tous les champs expliqués :

```json
{
  "id": "naturo_nom_prenom",
  "name": "Naturopathie — Marie Martin",
  "specialty": "Naturopathie",
  "version": "1.0",
  "icon": "🌿",
  "accentColor": "#2d7a4f",
  "sections": [
    {
      "id": "section_bilan",
      "title": "Bilan initial",
      "icon": "📋",
      "accentColor": "#2d7a4f",
      "fields": [
        ...
      ]
    }
  ]
}
```

| Propriété | Obligatoire | Description |
|---|---|---|
| `id` | Oui | Identifiant unique, sans espaces ni accents (ex: `naturo_marie`) |
| `name` | Oui | Nom affiché dans Synoria |
| `specialty` | Oui | Votre spécialité (affichée dans les résumés) |
| `version` | Oui | Numéro de version de votre plugin (ex: `"1.0"`) |
| `icon` | Non | Emoji affiché avec le nom du plugin |
| `accentColor` | Non | Couleur principale en hexadécimal (ex: `"#2d7a4f"`) |
| `sections` | Oui | Liste des sections du formulaire (au moins une) |

---

## 3. Types de champs disponibles

| Type | Rendu | Options utiles |
|---|---|---|
| `text` | Champ texte sur une ligne | `placeholder`, `required` |
| `textarea` | Zone texte multi-lignes | `placeholder`, `minHeight`, `required` |
| `richtext` | Texte enrichi avec mise en forme (gras, listes...) | `minHeight` |
| `number` | Champ numérique | `min`, `max`, `placeholder` |
| `date` | Sélecteur de date | `required` |
| `select` | Liste déroulante (un seul choix) | `options` (liste des choix) |
| `radio` | Boutons radio (un seul choix, visible) | `options` |
| `checkbox` | Case à cocher unique (oui/non) | — |
| `checkboxgroup` | Plusieurs cases à cocher indépendantes | `options` |
| `tags` | Saisie de mots-clés libres | `placeholder` |
| `rating` | Note de 1 à N étoiles | `min` (défaut 1), `max` (défaut 5) |
| `separator` | Ligne de séparation visuelle (pas de saisie) | `label` (texte optionnel) |

### Propriétés communes à tous les champs

| Propriété | Description | Valeurs |
|---|---|---|
| `id` | Identifiant unique dans le plugin | Texte sans espaces (ex: `motif_principal`) |
| `type` | Type de champ | Voir tableau ci-dessus |
| `label` | Libellé affiché | Texte libre |
| `width` | Largeur du champ | `"full"` (défaut), `"half"`, `"third"` |
| `placeholder` | Texte indicatif grisé | Texte libre |
| `hint` | Aide contextuelle sous le champ | Texte libre |
| `required` | Champ obligatoire | `true` ou `false` |

---

## 4. Exemple complet : plugin Naturopathie

```json
{
  "id": "naturo_exemple",
  "name": "Naturopathie",
  "specialty": "Naturopathie",
  "version": "1.0",
  "icon": "🌿",
  "accentColor": "#2d7a4f",
  "sections": [
    {
      "id": "bilan_initial",
      "title": "Bilan initial",
      "icon": "📋",
      "fields": [
        {
          "id": "motif_consultation",
          "type": "richtext",
          "label": "Motif de consultation",
          "placeholder": "Décrivez la plainte principale...",
          "minHeight": 100,
          "width": "full"
        },
        {
          "id": "anciennete",
          "type": "select",
          "label": "Ancienneté de la plainte",
          "options": ["Moins d'un mois", "1 à 6 mois", "6 mois à 2 ans", "Plus de 2 ans"],
          "width": "half"
        },
        {
          "id": "intensite_douleur",
          "type": "rating",
          "label": "Intensité de la gêne (1 = légère, 5 = sévère)",
          "min": 1,
          "max": 5,
          "width": "half"
        },
        {
          "id": "sep_1",
          "type": "separator",
          "label": "Antécédents"
        },
        {
          "id": "antecedents_medicaux",
          "type": "textarea",
          "label": "Antécédents médicaux",
          "placeholder": "Maladies, chirurgies, hospitalisations...",
          "minHeight": 80,
          "width": "full"
        },
        {
          "id": "medicaments_actuels",
          "type": "textarea",
          "label": "Médicaments et compléments actuels",
          "placeholder": "Nom, posologie...",
          "minHeight": 60,
          "width": "full"
        }
      ]
    },
    {
      "id": "hygiene_vie",
      "title": "Hygiène de vie",
      "icon": "🥗",
      "fields": [
        {
          "id": "alimentation",
          "type": "checkboxgroup",
          "label": "Régimes alimentaires",
          "options": ["Omnivore", "Végétarien", "Végétalien", "Sans gluten", "Sans lactose", "Autre"],
          "width": "half"
        },
        {
          "id": "repas_par_jour",
          "type": "number",
          "label": "Nombre de repas par jour",
          "min": 1,
          "max": 6,
          "width": "half"
        },
        {
          "id": "qualite_sommeil",
          "type": "radio",
          "label": "Qualité du sommeil",
          "options": ["Très bon", "Bon", "Moyen", "Mauvais", "Très mauvais"],
          "width": "half"
        },
        {
          "id": "heures_sommeil",
          "type": "number",
          "label": "Heures de sommeil en moyenne",
          "min": 3,
          "max": 12,
          "width": "half"
        },
        {
          "id": "activite_physique",
          "type": "select",
          "label": "Activité physique",
          "options": ["Sédentaire", "Légère (marche)", "Modérée (2-3h/sem.)", "Intense (4h+/sem.)"],
          "width": "half"
        },
        {
          "id": "niveau_stress",
          "type": "rating",
          "label": "Niveau de stress ressenti",
          "min": 1,
          "max": 5,
          "width": "half"
        },
        {
          "id": "notes_hygiene",
          "type": "richtext",
          "label": "Observations complémentaires",
          "minHeight": 80,
          "width": "full"
        }
      ]
    },
    {
      "id": "plan_naturo",
      "title": "Plan naturopathique",
      "icon": "🎯",
      "fields": [
        {
          "id": "objectifs",
          "type": "tags",
          "label": "Objectifs de la prise en charge",
          "placeholder": "Ajouter un objectif...",
          "width": "full"
        },
        {
          "id": "conseils_alimentaires",
          "type": "richtext",
          "label": "Conseils alimentaires",
          "minHeight": 100,
          "width": "full"
        },
        {
          "id": "complements",
          "type": "richtext",
          "label": "Compléments alimentaires recommandés",
          "placeholder": "Nom, dosage, durée...",
          "minHeight": 80,
          "width": "half"
        },
        {
          "id": "plantes",
          "type": "richtext",
          "label": "Phytothérapie / huiles essentielles",
          "placeholder": "Plante, forme, dosage...",
          "minHeight": 80,
          "width": "half"
        },
        {
          "id": "techniques",
          "type": "checkboxgroup",
          "label": "Techniques utilisées",
          "options": ["Hydrologie", "Thermologie", "Massage", "Réflexologie", "Iridologie", "Chromothérapie", "Autre"],
          "width": "full"
        }
      ]
    }
  ]
}
```

---

## 5. Installer et tester son plugin

### Installation

1. Sauvegardez votre fichier sous le nom `monplugin.plugin.json`
2. Dans Synoria : `Paramètres → Plugin → Importer un plugin`
3. Sélectionnez votre fichier
4. Le plugin est activé immédiatement

### Test

1. Allez sur `Nouvelle séance` avec n'importe quel patient
2. Vérifiez que votre formulaire s'affiche correctement
3. Saisissez des données de test et enregistrez
4. Consultez le résumé de la séance pour vérifier que tout est bien conservé

### Modifier et réimporter

Si vous souhaitez ajuster votre plugin après le premier test :
1. Modifiez le fichier `.plugin.json` avec le Bloc-notes ou un éditeur de texte
2. Réimportez-le via `Paramètres → Plugin → Importer`
3. Le plugin mis à jour remplace l'ancien

> ⚠️ **Attention :** Les séances déjà enregistrées avec l'ancienne version du plugin restent lisibles (le schéma est sauvegardé avec chaque séance). Seules les nouvelles séances utilisent le plugin mis à jour.

> 💡 **Conseil :** Utilisez un éditeur de texte avec coloration syntaxique JSON (comme Notepad++, gratuit) pour éviter les erreurs de syntaxe. Une virgule manquante ou un guillemet mal fermé peut empêcher l'import du plugin.

---

## 6. Partager son plugin

Un plugin Synoria est un simple fichier `.plugin.json`. Vous pouvez le partager librement avec d'autres praticiens de votre spécialité :

- Par email (joignez le fichier `.plugin.json`)
- Via une clé USB
- Sur un espace de partage (Drive, Dropbox, etc.)

Le praticien destinataire n'a qu'à l'importer via `Paramètres → Plugin → Importer`.

> 💡 **Conseil :** Si vous développez un plugin pour une association ou un réseau de praticiens, pensez à incrémenter la version (`"version": "1.1"`, `"1.2"`...) à chaque modification pour que chacun sache s'il est à jour.

Pour soumettre votre plugin à l'éditeur de Synoria afin qu'il soit distribué officiellement : **jeanpierre.timoner.mtc@gmail.com**
