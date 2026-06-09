# Instructions Claude — Dossier Patient MTC

## Qui suis-je ?

Je suis Jean-Pierre Timoner, praticien MTC (Médecine Traditionnelle Chinoise).
Je développe une application desktop de gestion de dossiers patients avec l'aide de Claude.
Mon niveau technique est **non-développeur** — je donne les directions, Claude code.

---

## Ce que fait l'application

- Gestion de fiches patients (identité, antécédents, consentement RGPD)
- Formulaire de séance selon la spécialité (MTC complet, Kinésiologie, ou générique simple)
- Calendrier de rendez-vous avec synchronisation bidirectionnelle
- Comptabilité / facturation
- Exports Excel, JSON, PDF
- Sécurité : chiffrement AES-256, mot de passe, verrou inactivité
- Conformité RGPD : consentements, journal d'accès, registre Art.30

---

## Comment répondre à mes questions

### Pour les demandes de code
1. **Lire les fichiers concernés avant de coder**
2. **Ne pas casser l'existant** — l'app est en production et utilisée
3. **Build de vérification** avec `npx vite build` après chaque modification
4. Proposer le code directement — pas de questions préalables si c'est clair
5. Expliquer brièvement CE QUI CHANGE et POURQUOI, pas comment ça marche en détail

### Pour les questions d'architecture / conseil
- Répondre directement avec une recommandation claire
- Maximum 2-3 options avec leur compromis
- Pas de réponse trop longue ni trop technique

---

## Patterns importants à respecter

### Ajouter un champ à la table `patients`
```
1. Migration v(N+1) dans migrations.ts — ALTER TABLE patients ADD COLUMN ...
2. Ajouter le champ dans l'interface Patient (types.ts)
3. OBLIGATOIRE : ajouter le champ dans updatePatient() SQL et createPatient() SQL (patientRepository.ts) — la liste de colonnes est EXPLICITE
4. Ajouter dans le formulaire (PatientsPage.tsx modal)
```

### Ajouter un canal IPC
```
1. Ajouter dans l'interface IpcApi (types.ts)
2. Ajouter dans preload.ts
3. Ajouter ipcMain.handle() dans handlers.ts
4. Utiliser window.mtcApi.xxx() dans le renderer
```

### Ajouter une page
```
1. Créer src/renderer/pages/NouvellePagePage.tsx
2. Importer dans App.tsx
3. Ajouter <Route path="/chemin" element={<NouvellePagePage />} />
4. Ajouter <NavLink to="/chemin"> dans la nav
```

### Modifier le formulaire de séance (NewSessionPage)
- Les sections MTC sont dans `{activePlugin?.useBuiltinForm && <>...</>}`
- Les sections génériques sont dans `{!activePlugin && <SimpleAnamneseSection>}`
- Les sections plugin sont dans `{activePlugin && !activePlugin.useBuiltinForm && <PluginFormRenderer>}`
- Le `full_data_json` contient TOUT — ajouter les nouveaux champs dans l'objet JSON.stringify(...)

---

## Fichiers les plus souvent modifiés

| Fichier | Quand le toucher |
|---|---|
| `src/shared/types.ts` | Nouveau type, nouveau champ Patient/Session, nouvelle IPC |
| `src/main/database/migrations.ts` | Nouveau champ en base |
| `src/main/database/repositories/patientRepository.ts` | Champ patient manquant dans INSERT/UPDATE |
| `src/main/ipc/handlers.ts` | Nouveau canal IPC |
| `src/main/preload.ts` | Exposer nouveau IPC au renderer |
| `src/renderer/pages/NewSessionPage.tsx` | Formulaire séance (très long, ~1300 lignes) |
| `src/renderer/pages/PatientsPage.tsx` | Fiche patient, consentement |
| `src/renderer/styles/global.css` | Tout nouveau style |
| `src/renderer/App.tsx` | Nouvelle route, nav, FormattingToolbar |

---

## Ce qui NE FONCTIONNE PAS / limitations connues

- **Build Mac depuis Windows** : impossible, nécessite un Mac ou CI/CD macOS
- **SQLite concurrent** : `better-sqlite3` est synchrone et mono-processus — OK pour un seul utilisateur
- **`document.execCommand`** : déprécié mais fonctionnel dans Electron/Chromium (barre de formatage)
- **Offline uniquement** : pas de cloud, pas de sync réseau, pas de multi-utilisateurs réseau

---

## Variables CSS disponibles

```css
--accent      /* vert principal */
--accent-light, --accent-mid
--blue        /* bleu */
--teal        /* teal/sarcelle */
--teal-light, --teal-mid
--amber       /* ambre/orange */
--amber-light
--red         /* rouge erreur */
--purple      /* violet */
--text, --text-muted, --text-hint
--surface, --surface-hover
--border, --border-soft
--font-serif, --font-sans
--radius
```

---

## Classes CSS utilitaires

```
card, card-title, card-title-icon
field, label, input, textarea, select
grid2, grid3
btn, btn-primary, btn-secondary, btn-sm, btn-danger
modal, modal-overlay
row-btns
empty (texte centré pour liste vide)
chip, chip-blue/teal/green/amber/purple/rose
progress-bar, progress-fill
```

---

## Versions et historique

| Version | Points clés |
|---|---|
| v1.0.0 | Application MTC initiale — patients, séances, exports |
| v1.1.0 | Chiffrement AES-256, calendrier RDV, sync RDV↔séance, barre formatage, profession |
| v1.2.0 | Système plugins, formulaire générique simple, plugin MTC JP et Kinésiologie |
| v1.3.0 | RGPD complet (consentement, journal, alertes, notice, registre Art.30), page RGPD |

---

## Contexte commercial

- Logiciel vendu par spécialité (Pack MTC, Pack Kinésiologie, etc.)
- ~150-200€ achat unique + ~80€/an maintenance
- Chaque spécialité = un fichier `.plugin.json`
- Distribué via installateur signé (certificat EV à acquérir)
- Données 100% locales → pas de certification HDS requise
