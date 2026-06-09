# Dossier Patient MTC — Documentation projet Claude

## Vue d'ensemble

Application desktop **Electron + React + TypeScript** de gestion de dossiers patients pour praticiens de santé (MTC, Kinésiologie, Ostéopathie, etc.).

- **Version actuelle :** 1.3.0
- **Plateforme :** Windows 10/11 (64 bits). Mac possible mais non buildé.
- **Distribution :** installateur NSIS (.exe Setup) + version portable (.exe sans installation) + version clé USB.
- **Auteur :** Jean-Pierre Timoner — jeanpierre.timoner.mtc@gmail.com

---

## Stack technique

| Couche | Technologie |
|---|---|
| Desktop | Electron 28 |
| UI | React 18 + TypeScript |
| Base de données | SQLite via better-sqlite3 (sync, pas async) |
| Chiffrement | Node.js `crypto` — AES-256-GCM + PBKDF2 |
| Build | Vite + electron-builder |
| Styles | CSS vanilla (`src/renderer/styles/global.css`) — PAS de Tailwind |
| Bundler electron | vite-plugin-electron |

---

## Structure des fichiers source

```
src/
├── main/                          ← Process Electron principal (Node.js)
│   ├── index.ts                   ← Point d'entrée, cycle de vie app, auto-save chiffré
│   ├── preload.ts                 ← Pont IPC sécurisé exposé comme window.mtcApi
│   ├── database/
│   │   ├── connection.ts          ← initDatabase(), closeDatabase(), isDatabaseOpen(), getDb()
│   │   ├── migrations.ts          ← Migrations v1→v7 (SQLite schema versioning)
│   │   └── repositories/
│   │       ├── patientRepository.ts
│   │       ├── sessionRepository.ts
│   │       ├── appointmentRepository.ts
│   │       ├── comptaRepository.ts
│   │       └── accessLogRepository.ts   ← Journal RGPD
│   ├── ipc/
│   │   └── handlers.ts            ← Tous les ipcMain.handle(...) — ~60 canaux
│   └── services/
│       ├── authService.ts         ← Mot de passe + chiffrement BDD (PBKDF2 + AES-256)
│       ├── encryptionService.ts   ← Chiffrement sauvegardes (clé fichier)
│       ├── backupService.ts       ← Export/Import sauvegardes .json.enc
│       ├── exportService.ts       ← Export Excel séances (xlsx-js-style)
│       ├── invoiceService.ts      ← Génération factures PDF
│       ├── comptaExportService.ts ← Export comptabilité Excel
│       ├── settingsService.ts     ← Lecture/écriture userData/settings.json
│       ├── pluginService.ts       ← Gestion plugin actif (userData/active.plugin.json)
│       └── rgpdService.ts         ← Alertes conservation + registre Art.30 HTML
│
├── renderer/                      ← Interface React (Vite bundle)
│   ├── App.tsx                    ← Routeur, flux auth (splash→lock→app), nav, FormattingToolbar
│   ├── index.tsx                  ← Point d'entrée React
│   ├── pages/
│   │   ├── LockScreen.tsx         ← Écran mot de passe (setup ou login)
│   │   ├── DashboardPage.tsx      ← Stats, prochains RDV, séances récentes
│   │   ├── PatientsPage.tsx       ← Liste + CRUD patients, consentement RGPD
│   │   ├── NewSessionPage.tsx     ← Formulaire séance (1237 lignes) — mode simple/MTC/plugin
│   │   ├── HistoryPage.tsx        ← Historique toutes séances
│   │   ├── SummaryPage.tsx        ← Résumé séance + export JSON/Excel/Print
│   │   ├── CalendarPage.tsx       ← Calendrier RDV mensuel + planning horaire
│   │   ├── ComptaPage.tsx         ← Comptabilité mensuelle + URSAF
│   │   ├── DepensesPage.tsx       ← Dépenses variables
│   │   ├── FacturesListPage.tsx   ← Journal factures
│   │   ├── SettingsPage.tsx       ← Paramètres (sauvegarde, RGPD, plugin, MAJ, mot de passe)
│   │   └── RgpdPage.tsx           ← Page RGPD (consentements, journal, alertes, notice, registre)
│   ├── components/
│   │   ├── common/
│   │   │   ├── RichTextArea.tsx   ← Zone texte enrichi (contenteditable, pas de toolbar interne)
│   │   │   ├── SplashScreen.tsx
│   │   │   └── Toast.tsx
│   │   ├── forms/
│   │   │   └── SystemesForm.tsx   ← Questionnaire systèmes MTC (composant complexe)
│   │   └── plugin/
│   │       └── PluginFormRenderer.tsx  ← Moteur rendu dynamique plugins JSON
│   ├── hooks/
│   │   ├── useInactivityLock.ts   ← Verrou auto après 20 min inactivité
│   │   └── useToast.ts
│   ├── styles/
│   │   └── global.css             ← Tous les styles (variables CSS, composants, plugin, RGPD)
│   └── utils/
│       ├── format.ts              ← fmtDate, calcAge, getInitials
│       └── sessionData.ts
│
└── shared/
    ├── types.ts                   ← Toutes les interfaces TypeScript + interface IpcApi
    └── pluginTypes.ts             ← Types du système de plugins (PluginDefinition, PluginField, etc.)

public/
└── plugins/
    ├── mtc_jp.plugin.json         ← Plugin MTC JP (useBuiltinForm: true → formulaire intégré)
    └── kinesio.plugin.json        ← Plugin Kinésiologie Charlotte DECAENS

release/
├── V1.0.0/, V1.1.0/, V1.2.0/    ← Installateurs par version
├── Plugins/                       ← Fichiers plugins distribués
└── CleUSB_DossierPatientMTC/      ← Version portable clé USB (exe + data/)
```

---

## Base de données SQLite

**Chemin :** `userData/database/mtc.sqlite` (déchiffré au login, rechiffré à la fermeture)

### Migrations (version actuelle : v7)

| Version | Contenu |
|---|---|
| v1 | Tables `patients`, `sessions`, `exports` + index |
| v2 | `patients.is_active` |
| v3 | `sessions.next_session_date` |
| v4 | Comptabilité : `consultation_types`, `monthly_revenue`, `ursaf_rates`, `expense_config`, `monthly_var_expenses`, `invoices_log` |
| v5 | `patients.profession` + table `appointments` |
| v6 | `appointments.guest_last_name/first_name/phone` |
| v7 | `patients.consent_given/consent_date` + table `access_log` |

### Table `patients`
```sql
id TEXT PK, first_name, last_name, birth_date, phone, email, address,
profession, notes_general, alerts, regular_doctor, medications, antecedents,
is_active INTEGER DEFAULT 1,
consent_given INTEGER DEFAULT 0,   -- RGPD v7
consent_date TEXT,                  -- RGPD v7
created_at, updated_at
```

### Table `sessions`
```sql
id TEXT PK, patient_id FK→patients,
date, practitioner, motif, evolution_tags, evolution,
problematiques, langue, pouls, constitution, type_corps, teint, observation,
diagnostic_mtc, cinq_elements, causes, analyse, principes,
points, pts_oreille, techniques, plantes, reactions, traitement_notes,
next_session_date,
energy_tests_json TEXT,   -- EnergyTests serialisé
systemes_json TEXT,       -- SystemesQuestionnaire serialisé
full_data_json TEXT,      -- TOUT le reste (barrage, pluginData, pluginSchema, etc.)
created_at, updated_at
```

> **Important :** `full_data_json` est un blob JSON flexible. Il contient tous les champs non-colonnes :
> `anamnese`, `langueNote`, `poulsNote`, `poulsPos`, `barrageNiv1-4`, `nextSessionHeure/Fin/Note/ApptId`,
> `pluginData`, `pluginId`, `pluginSchema` (schéma complet du plugin au moment de la séance).

### Table `appointments`
```sql
id TEXT PK, patient_id FK (nullable),
date TEXT, heure_debut TEXT, heure_fin TEXT, note TEXT,
is_done INTEGER DEFAULT 0,
guest_last_name TEXT, guest_first_name TEXT, guest_phone TEXT,
created_at, updated_at
```

### Table `access_log` (RGPD)
```sql
id TEXT PK, patient_id FK (nullable),
action TEXT,   -- 'fiche_ouverte' | 'séance_consultée' | 'séance_créée' | 'données_exportées'
detail TEXT, timestamp TEXT
```

---

## Architecture IPC (window.mtcApi)

Tous les appels base de données passent par l'IPC. Le renderer n'accède jamais directement à SQLite.

```
Renderer → window.mtcApi.xxx() → ipcRenderer.invoke() → ipcMain.handle() → repository/service
```

### Patients
- `getPatients()` · `getPatientById(id)` · `createPatient(data)` · `updatePatient(id, data)` · `deletePatient(id)`

### Sessions
- `getSessions(patientId?)` · `getSessionById(id)` · `createSession(data)` · `updateSession(id, data)` · `deleteSession(id)` · `duplicateSession(id)` · `getSessionsByMonth(year, month)` · `getDashboardStats()` · `getUpcomingSessions()`

### Appointments
- `getAppointments()` · `getAppointmentsByDate(date)` · `getAppointmentsByMonth(year, month)` · `getAppointmentsByPatient(patientId)` · `createAppointment(data)` · `updateAppointment(id, data)` · `deleteAppointment(id)`

### Exports
- `exportSessionJson(id)` → path · `exportSessionExcel(id)` → path · `exportBackupJson()` · `importBackupJson(path)` · `exportGeneralBackup()` · `exportPatientBackup(patientId)` · `getBackupInfo()`

### Comptabilité
- `getComptaYearData(year)` · `setMonthlyRevenue(y,m,tid,nb)` · `setUrsafRate(y,m,rate)` · `setMonthlyVarExpense(y,m,cat,lbl,amt)` · `getConsultationTypes()` · `saveConsultationTypes(types)` · `getExpenseConfig()` · `saveExpenseConfig(configs)` · `getInvoicesLog(year)` · `exportComptaExcel(year)` · `generateInvoice(data)`

### Auth
- `authStatus()` → `{hasPassword, isUnlocked}` · `authSetup(pwd)` · `authLogin(pwd)` · `authLock()` · `authChangePassword(old, new)`

### RGPD
- `logAccess(patientId, action, detail?)` · `getAccessLog(patientId?, limit?)` · `getRgpdAlerts()` → `{nearRetention, overRetention}` · `exportTraitementRegister()` → path

### Plugin
- `pluginGet()` · `pluginSet(def)` · `pluginRemove()` · `pluginImport(filePath)`

### Settings & Divers
- `getSettings()` · `saveSettings(partial)` · `showOpenDialog(opts)` · `showSaveDialog(opts)` · `openPath(path)` · `openBackupFolder(type)` · `getAppVersion()` · `launchInstaller(exePath)` · `getDataPath()`

---

## Sécurité & Authentification

### Flux de démarrage
```
app.whenReady()
  → if (!hasPassword) initDatabase()   ← pas de mot de passe : DB ouvre directement
  → registerAllHandlers()
  → createWindow()

Renderer :
  SplashScreen (2s)
  → authStatus()
    → 'setup'   : LockScreen (créer mot de passe) → authSetup() → chiffre DB → ouvre
    → 'locked'  : LockScreen (login) → authLogin() → déchiffre DB → ouvre
    → 'unlocked': Application normale
```

### Chiffrement
- **Algorithme :** AES-256-GCM
- **Clé :** dérivée du mot de passe via PBKDF2 (600 000 itérations, SHA-256, sel aléatoire 32 octets)
- **Vérification :** un "verifier" chiffré dans `userData/auth.json` (AES du texte `dossier-patient-mtc-auth-v1`)
- **Base de données :** `mtc.sqlite.enc` au repos, `mtc.sqlite` pendant la session
- **Auto-save :** rechiffrement toutes les 3 min + WAL checkpoint
- **À la fermeture :** `closeDatabase()` → `encryptDb()` → `deleteWorkingDb()`

### Fichiers de sécurité
- `userData/auth.json` — `{salt: hex, verifier: "IV\nTAG\nCT"}`
- `userData/database/mtc.sqlite` — base de travail (présente uniquement en session)
- `userData/database/mtc.sqlite.enc` — base chiffrée (permanente)
- `userData/encryption.key` — clé hex 32 octets pour les sauvegardes (distincte du mot de passe)

---

## Système de Plugins

### Concept
Un fichier `active.plugin.json` dans `userData/` définit le formulaire d'anamnèse.

### Format plugin
```typescript
interface PluginDefinition {
  id: string
  name: string
  specialty: string
  version: string
  useBuiltinForm?: boolean  // true = utilise le formulaire MTC intégré complet
  icon?: string
  accentColor?: string
  sections: PluginSection[]
}

interface PluginSection {
  id: string; title: string; icon?: string; accentColor?: string
  fields: PluginField[]
}

interface PluginField {
  id: string; type: PluginFieldType; label: string
  width?: 'full' | 'half' | 'third'
  placeholder?: string; hint?: string; required?: boolean
  options?: string[]        // select / radio / checkboxgroup
  min?: number; max?: number // number / rating
  minHeight?: number         // textarea / richtext
}

type PluginFieldType =
  'text' | 'textarea' | 'richtext' | 'number' | 'date' |
  'select' | 'radio' | 'checkbox' | 'checkboxgroup' | 'tags' | 'rating' | 'separator'
```

### Comportement dans NewSessionPage
```
!activePlugin               → SimpleAnamneseSection (formulaire générique)
activePlugin.useBuiltinForm → Formulaire MTC intégré complet (barrage, systèmes, énergie)
activePlugin (normal)       → PluginFormRenderer (moteur dynamique)
```

### Migration automatique
Si `active.plugin.json` a `id === 'mtc_jp'` sans `useBuiltinForm`, `pluginService` l'ajoute automatiquement au chargement.

### Données plugin dans les séances
Les données saisies via PluginFormRenderer sont stockées dans `full_data_json` :
```json
{
  "pluginData":   { "fieldId": "valeur", ... },
  "pluginId":     "kinesio_charlotte",
  "pluginSchema": { /* copie complète du PluginDefinition au moment de la séance */ }
}
```
`pluginSchema` est sauvegardé pour que les résumés futurs restent lisibles même si le plugin change.

---

## Page Nouvelle Séance (NewSessionPage.tsx — 1300+ lignes)

### Structure des sections
```
0. Identification      (patient, date, praticien) ← toujours visible
ℹ️ Info patient                                   ← toujours visible
1. Motif               (RichTextArea)              ← toujours visible
2. Évolution           (tags + richtext)           ← toujours visible

── Mode simple (aucun plugin) ──
3. Anamnèse           (richtext + richtext)
4. Traitement effectué (richtext + tags techniques)
5. Réactions          (richtext)

── Mode MTC intégré (plugin MTC JP) ──
3. Prise de notes      (anamnese + langue + pouls)
4. Questionnaire       (SystemesForm)
5. Observation MTC     (constitution, teint, obs.)
6. Tests énergétiques  (EnergySection — entonnoir)
7. Analyse clinique    (diagnostic, 5 éléments, causes)
8. Traitement          (points, oreille, techniques, plantes)
9. Barrage             (4 niveaux textarea)

── Mode plugin tiers ──
[Sections définies par le plugin JSON]

10. Plan de suivi     ← toujours visible
    └── NextRdvSection (sync bidirectionnelle avec CalendarPage)
```

### Variables d'état principales
- `patientId`, `date`, `practitioner`, `sessionNum`
- `motif`, `evolution`, `evolutionTags`
- `anamnese`, `observation`, `traitementNotes`, `reactions`, `techniques`
- `langue`, `langueNote`, `pouls`, `poulsNote`, `poulsPos`
- `constitution`, `typeCorps`, `teint`
- `diagnostic`, `cinqElements`, `causes`, `analyse`, `principes`
- `points`, `ptsOreille`, `plantes`
- `barrageNiv1-4`
- `systemes` (SystemesQuestionnaire), `energy` (EnergyTests)
- `nextSession`, `nextSessionHeure`, `nextSessionFin`, `nextSessionNote`, `nextSessionApptId`
- `activePlugin` (PluginDefinition | null), `pluginData` (Record<string, any>)
- `patientAppts` (Appointment[]) — RDV existants du patient

### Synchronisation RDV ↔ Calendrier
À l'enregistrement, si `nextSession` est renseigné :
1. Cherche un RDV existant pour ce patient à cette date
2. Si trouvé → met à jour le RDV existant
3. Si non trouvé → crée un nouveau RDV dans `appointments`
4. Stocke l'ID dans `nextSessionApptId` pour éviter les doublons

---

## Calendrier (CalendarPage.tsx)

- Vue mensuelle (left) + vue planning horaire par jour (right)
- Créneaux visuels 30 min de 08h00 à 19h30
- Sélecteurs heure dans la modal : **5 minutes** de 07h00 à 20h00
- RDV pour patients existants (FK `patient_id`) ou invités (`guest_*` fields)
- Couleurs : bleu = planifié, vert = réalisé, orange = en attente
- Bouton "Créer la séance" depuis un RDV → navigue vers `/nouvelle/:patientId?motif=...&date=...`

---

## Barre de formatage globale

Placée dans `App.tsx` entre la navigation et le contenu. Utilise `document.execCommand()`.
- `onMouseDown` + `e.preventDefault()` → garde le focus dans la zone de texte
- Active uniquement quand un `contenteditable` est focalisé (détection via `focusin`/`focusout`)
- Les `RichTextArea` sont des `contenteditable div` sans toolbar propre

---

## RGPD

### Consentement (patients)
- Champ `consent_given` (0/1) + `consent_date` sur chaque patient
- Géré dans `PatientsPage.tsx` (modal modification)
- Visible dans `RgpdPage.tsx` onglet "Consentements" avec taux et barre de progression

### Journal d'accès
- Enregistré automatiquement dans `access_log` quand :
  - Une fiche patient est ouverte (`PatientsPage.openEdit`)
  - Un résumé de séance est consulté (`SummaryPage.useEffect`)
- Actions possibles : `'fiche_ouverte'` · `'séance_consultée'` · `'séance_créée'` · `'données_exportées'`

### Alertes de conservation
- `dataRetentionYears` dans settings (défaut 10 ans)
- `rgpdService.getRgpdAlerts()` compare la date de dernière séance vs now
- Retourne `{nearRetention, overRetention}` (lists de Patient)

### Registre Art. 30
- Généré par `rgpdService.exportTraitementRegister()` → fichier HTML dans `userData/exports/`
- Inclut : responsable, finalité, base légale Art.9(2)(h), catégories données, mesures sécurité, stats

---

## Paramètres (AppSettings)

Stockés dans `userData/settings.json` via `settingsService.ts`.

```typescript
{
  backupPatientPath, backupGeneralPath,
  autoBackupOnClose, autoBackupDaily, backupRetentionDays,
  lastGeneralBackup, lastAutoBackup,
  invoicePath, invoiceTvaRate, lastInvoiceNumber, lastInvoiceYear,
  // RGPD
  rgpdPractitionerName, rgpdPractitionerEmail,
  rgpdNotice,           // texte notice Art.13, modifiable
  dataRetentionYears    // durée conservation, défaut 10
}
```

---

## Conventions de code

### TypeScript
- Strict : pas de `any` sauf cas contraints (casts explicites avec `as any`)
- Tous les types dans `src/shared/types.ts` (partagé main + renderer)
- Pas de classes — fonctions et interfaces uniquement

### React
- Composants fonctionnels uniquement + hooks
- Pas de librairie de composants (tout custom CSS)
- `useCallback` pour les fonctions passées en props quand pertinent
- Les pages sont dans `pages/`, les composants réutilisables dans `components/`

### CSS
- Un seul fichier global : `src/renderer/styles/global.css`
- Variables CSS custom : `--accent`, `--blue`, `--teal`, `--amber`, `--red`, `--purple`
- Classes utilitaires : `card`, `card-title`, `field`, `grid2`, `grid3`, `btn`, `btn-primary`, `btn-secondary`, `btn-sm`
- Pas de CSS Modules, pas de styled-components

### Base de données
- `better-sqlite3` est **synchrone** — pas de `.then()` dans les repositories
- Toutes les opérations DB dans le main process uniquement
- Les repositories retournent des types TypeScript (cast avec `as Type`)

### IPC
- Tous les appels renderer→main passent par `window.mtcApi` (contextBridge)
- Les handlers dans `handlers.ts` doivent être courts — la logique est dans les services/repos
- Nommage des canaux : `domaine:action` (ex: `patients:getAll`, `auth:login`)

### Erreurs
- Les repos lancent des erreurs JavaScript standards
- Le renderer catch avec `try/catch` et appelle `showToast(..., 'error')`
- Les opérations de sync (RDV, log) échouent silencieusement (`catch(() => {})`)

---

## Chemins importants à l'exécution

| Chemin | Contenu |
|---|---|
| `userData/` | Données app (settings, plugins, DB, exports) |
| `userData/database/mtc.sqlite` | BDD de travail (présente en session) |
| `userData/database/mtc.sqlite.enc` | BDD chiffrée (permanente) |
| `userData/auth.json` | Vérificateur mot de passe + sel |
| `userData/encryption.key` | Clé sauvegardes (hex 32 octets) |
| `userData/active.plugin.json` | Plugin actif |
| `userData/settings.json` | Paramètres app |
| `userData/exports/` | Exports Excel, JSON, registre RGPD |

**Portable (clé USB) :** `PORTABLE_EXECUTABLE_DIR/data/` remplace `userData/`  
**Développement :** `%APPDATA%/Dossier Patient MTC/`

---

## Scripts disponibles

```bash
npm run electron:dev      # Lancer en développement (Vite + Electron)
npm run electron:build    # Build production (NSIS + Portable)
npm run build:portable    # Build portable uniquement
npx vite build            # Build renderer + electron sans packager
```

---

## Points d'attention / pièges connus

1. **better-sqlite3 est synchrone** — ne jamais appeler `getDb()` dans le renderer directement.
2. **La DB n'est pas ouverte au démarrage si un mot de passe est configuré** — les IPC DB échoueront jusqu'à l'auth.
3. **`full_data_json` est la source de vérité pour les données de séance** — les colonnes sessions ne contiennent que les champs les plus utilisés pour les requêtes.
4. **Le formulaire MTC intégré n'est accessible que via le plugin MTC JP** (`useBuiltinForm: true`). Sans plugin = formulaire simple.
5. **Les sauvegardes utilisent une clé différente du mot de passe** (`encryption.key` fichier, pas PBKDF2).
6. **WAL checkpoint obligatoire avant de lire `mtc.sqlite`** pour l'encryptage — fait dans `closeDatabase()`.
7. **Les migrations sont cumulatives** — ne jamais modifier une migration existante, toujours ajouter une nouvelle version.
8. **`patientRepository.updatePatient`** — liste explicite de colonnes dans le SQL UPDATE. Tout nouveau champ sur `patients` doit y être ajouté manuellement.
9. **La barre de formatage** utilise `document.execCommand` (déprécié mais fonctionnel dans Electron/Chromium).
10. **Electron ne peut pas être buildé pour Mac depuis Windows** — nécessite une machine ou CI Mac.
