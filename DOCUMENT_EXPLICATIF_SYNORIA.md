# Document explicatif - Synoria

Document de contexte a transmettre a Claude, ChatGPT ou tout autre assistant IA avant de travailler sur le projet Synoria.

Derniere mise a jour : 2026-06-29  
Version projet : 1.5.0  
Nom package : `synoria`  
Application : Electron + React + TypeScript + SQLite

---

## 1. Resume court

Synoria est une application de bureau de gestion de cabinet et de dossiers patients pour praticiens independants : Medecine Traditionnelle Chinoise, osteopathie, kinesiologie, naturopathie, therapies manuelles et pratiques d'accompagnement.

Le logiciel centralise :

- les fiches patients ;
- les seances et leur historique ;
- l'agenda et les rendez-vous ;
- les exports, rapports et sauvegardes ;
- la facturation ;
- une comptabilite simplifiee ;
- les obligations RGPD ;
- les plugins metier par specialite.

Son positionnement principal : un dossier patient local, securise, personnalisable et adapte aux praticiens qui ne veulent pas dependre d'un cloud obligatoire.

---

## 2. Positionnement produit

Synoria n'est pas un logiciel medical hospitalier. C'est un outil de cabinet pour praticiens independants qui ont besoin d'un suivi patient riche, narratif et personnalise.

Promesse principale :

> Synoria, le dossier patient local et personnalisable pour les praticiens independants.

Arguments forts :

- donnees stockees localement ;
- fonctionnement possible sans cloud ;
- application desktop Windows, avec cibles Mac et Linux prevues dans la configuration ;
- chiffrement et mot de passe ;
- sauvegardes chiffrees ;
- plugins par specialite ;
- agenda, factures, comptabilite et RGPD dans le meme outil ;
- version installee ou portable possible.

---

## 3. Public cible

Synoria s'adresse principalement aux praticiens qui veulent suivre leurs patients dans le temps sans utiliser un logiciel lourd, trop medicalise ou trop administratif.

Publics cibles :

- praticiens en Medecine Traditionnelle Chinoise ;
- osteopathes ;
- kinesiologues ;
- naturopathes ;
- therapeutes manuels ;
- praticiens bien-etre ;
- professionnels independants ayant besoin d'un dossier patient structure.

Besoin principal du public :

- retrouver rapidement l'historique patient ;
- structurer les seances ;
- personnaliser les formulaires selon la pratique ;
- generer factures et exports ;
- respecter une logique RGPD ;
- conserver la maitrise des donnees sensibles.

---

## 4. Fonctionnalites principales

### Patients

Synoria permet de creer, modifier, consulter, archiver et supprimer des fiches patients.

Champs principaux :

- civilite ;
- nom, prenom ;
- date de naissance ;
- telephone, email, adresse ;
- profession ;
- medecin traitant ;
- antecedents ;
- traitements en cours ;
- alertes importantes ;
- notes generales ;
- statut actif ou archive ;
- consentement RGPD et date de consentement.

La page patient sert de point d'entree vers :

- l'historique des seances ;
- la creation d'une seance ;
- la generation d'une facture ;
- les exports patient ;
- le rapport patient.

### Seances

Synoria permet de creer, modifier, consulter, dupliquer et supprimer des seances.

Les seances contiennent :

- patient, date, praticien ;
- motif ;
- evolution depuis la precedente seance ;
- problematiques ;
- observations ;
- diagnostic ou analyse ;
- traitement effectue ;
- conseils, plan et points a surveiller ;
- prochain rendez-vous ;
- donnees specifiques au plugin actif ;
- donnees MTC avancees si le plugin MTC integre est actif.

La route `/modifier/:sessionId` permet l'edition d'une seance existante.

### Formulaire MTC integre

Le formulaire MTC complet est active via le plugin MTC JP avec `useBuiltinForm: true`.

Il inclut notamment :

- anamnese ;
- observation de la langue ;
- observation du pouls ;
- questionnaire par systemes ;
- constitution, type de corps, teint ;
- tests energetiques ;
- trois rechauffeurs ;
- trois foyers ;
- merveilleux vaisseaux ;
- points Mu ;
- empereur ;
- vide / plenitude ;
- syndromes ;
- energie compensatrice ;
- niveaux de penetration ;
- diagnostic MTC ;
- cinq elements ;
- causes ;
- analyse ;
- principes de traitement ;
- points d'acupuncture ;
- points d'oreille ;
- techniques ;
- plantes ou formules ;
- reactions ;
- barrage homeopathique ;
- plan de suivi.

### Plugins par specialite

Synoria dispose d'un moteur de plugins JSON.

Un plugin decrit les sections et champs d'un formulaire d'anamnese. Il permet d'adapter Synoria a une specialite sans recoder toute l'application.

Plugins presents dans `public/plugins/` :

- `mtc.plugin.json` ;
- `mtc_jp.plugin.json` ;
- `kinesio.plugin.json` ;
- `kinesiologie_pro.plugin.json` ;
- `naturopathie.plugin.json` ;
- `naturopathie_pro.plugin.json` ;
- `osteopathie.plugin.json` ;
- `osteopathie_pro.plugin.json`.

Types de champs supportes :

- texte court ;
- textarea ;
- texte riche ;
- nombre ;
- date ;
- select ;
- radio ;
- checkbox ;
- groupe de checkbox ;
- tags ;
- rating ;
- bodychart ;
- separateur.

Le plugin osteopathie utilise notamment le type `bodychart`, avec cartes anatomiques et zones cliquables.

### Agenda et rendez-vous

Synoria integre un agenda avec :

- vue calendrier ;
- rendez-vous patients existants ;
- rendez-vous pour nouveaux contacts ;
- heure de debut et de fin ;
- note de rendez-vous ;
- statut realise ;
- statut annule ;
- liaison rendez-vous / seance ;
- blocage de creneaux ou de journees ;
- synchronisation Google Calendar ;
- import de calendriers Google selectionnes ;
- nettoyage des doublons Google Calendar ;
- rappels de rendez-vous J-1.

La creation d'un prochain rendez-vous depuis une seance peut alimenter automatiquement l'agenda.

### Tableau de bord

Le tableau de bord donne une vue rapide :

- total patients ;
- patients actifs ;
- total seances ;
- seances du mois ;
- seances recentes ;
- prochains rendez-vous ;
- patients a relancer ;
- rappels de rendez-vous en attente ;
- alertes importantes.

### Recherche globale

La recherche globale permet de retrouver :

- un patient ;
- une seance ;
- un motif ;
- une information contenue dans les notes ;
- une donnee stockee dans `full_data_json`.

Raccourci : `Ctrl+K`.

### Exports et rapports

Exports disponibles :

- seance JSON chiffree ;
- seance Excel ;
- export patient Excel ;
- rapport patient HTML ;
- impression / PDF systeme ;
- sauvegarde generale chiffree ;
- sauvegarde par patient ;
- export comptabilite Excel ;
- registre RGPD HTML.

Le fichier `patientReportService.ts` genere un rapport patient lisible avec historique et donnees importantes.

### Facturation

Synoria integre un module de facturation :

- generation de facture ;
- journal des factures ;
- numero de facture ;
- logo praticien ;
- informations de profil ;
- SIRET, APE, activite, adresse, email ;
- TVA configurable ;
- envoi par email via client mail local ;
- statut paye / non paye ;
- date de paiement ;
- alertes de factures en retard.

### Comptabilite simplifiee

Le module comptable permet :

- types de consultation configurables ;
- tarifs par type ;
- nombre de seances par mois ;
- taux URSSAF configurable ;
- charges fixes ;
- charges variables ;
- categories de depenses ;
- depenses reparties par mois ;
- export Excel annuel.

Ce n'est pas un logiciel comptable complet, mais un outil de pilotage pour independants.

### RGPD

Synoria aide le praticien a documenter ses obligations RGPD :

- consentement patient ;
- date de consentement ;
- journal d'acces aux dossiers ;
- alertes de duree de conservation ;
- registre des traitements Article 30 ;
- notice RGPD modifiable ;
- responsable de traitement ;
- duree de conservation configurable ;
- export du registre ;
- sauvegardes chiffrees.

Synoria aide a structurer la conformite, mais ne remplace pas un conseil juridique.

### Securite

Points principaux :

- application de bureau ;
- stockage local ;
- mot de passe au lancement ;
- verrouillage automatique apres inactivite ;
- changement de mot de passe ;
- chiffrement AES-256-GCM ;
- derivation de cle par PBKDF2 ;
- base chiffree au repos ;
- sauvegardes chiffrees ;
- export de cle de chiffrement ;
- verification de sauvegarde ;
- aucun serveur cloud obligatoire.

### Administration et diagnostic

Synoria contient des outils de support :

- panneau administrateur ;
- verification mot de passe admin ;
- logs ;
- informations systeme ;
- verification d'integrite SQLite ;
- WAL checkpoint ;
- statistiques base de donnees ;
- consultation settings ;
- sauvegarde forcee ;
- rapport diagnostic ;
- document support ;
- document de recuperation.

Raccourci panneau admin : `Ctrl+Shift+Alt+A`.

---

## 5. Stack technique

| Couche | Technologie |
|---|---|
| Desktop | Electron 28 |
| UI | React 18 + TypeScript |
| Routing | react-router-dom 6 |
| Build | Vite 5 + electron-builder |
| Base de donnees | SQLite via better-sqlite3 |
| Chiffrement | Node.js crypto, AES-256-GCM, PBKDF2 |
| Exports Excel | xlsx + xlsx-js-style |
| Styles | CSS global vanilla |
| Package | npm |

Commandes importantes :

```powershell
npm run electron:dev
npm run build
npm run electron:build
npm run build:portable
npx vite build
```

---

## 6. Architecture du projet

Structure principale :

```text
src/
  main/
    index.ts
    preload.ts
    database/
      connection.ts
      migrations.ts
      repositories/
    ipc/
      handlers.ts
    services/
  renderer/
    App.tsx
    pages/
    components/
    hooks/
    styles/
    utils/
    assets/
  shared/
    types.ts
    pluginTypes.ts

public/
  plugins/
  assets/

documentation_synoria/
documentation_synoria_html/
documentation_synoria_pdf/
release/
```

Principe architectural :

```text
React renderer
  -> window.mtcApi
  -> preload.ts
  -> ipcMain.handle dans handlers.ts
  -> services / repositories
  -> SQLite et fichiers locaux
```

Le renderer ne doit jamais acceder directement a SQLite ou aux API Node.

---

## 7. Pages principales

Routes principales dans `src/renderer/App.tsx` :

- `/` : tableau de bord ;
- `/patients` : gestion patients ;
- `/nouvelle` : creation de seance ;
- `/nouvelle/:patientId` : creation de seance pour un patient ;
- `/modifier/:sessionId` : edition de seance ;
- `/seances` : liste et consultation des seances ;
- `/seances/:sessionId` : consultation d'une seance ;
- `/calendrier` : agenda ;
- `/comptabilite` : comptabilite ;
- `/depenses` : depenses ;
- `/factures-liste` : journal factures ;
- `/rgpd` : espace RGPD ;
- `/parametres` : parametres ;
- `/profil` : profil praticien.

---

## 8. Base de donnees

La base SQLite est geree dans le process main avec `better-sqlite3`.

Schema actuel : migrations jusqu'a v16.

Tables ou ensembles importants :

- `patients` ;
- `sessions` ;
- `appointments` ;
- `calendar_blocks` ;
- `access_log` ;
- `consultation_types` ;
- `monthly_revenue` ;
- `ursaf_rates` ;
- `expense_config` ;
- `monthly_var_expenses` ;
- `invoices_log` ;
- `session_templates` ;
- `exports` ;
- `schema_version`.

Champs recents importants :

- `patients.civility` ;
- `appointments.google_event_id` ;
- `appointments.is_cancelled` ;
- `appointments.reminder_sent` ;
- `invoices_log.is_paid` ;
- `invoices_log.paid_date` ;
- `expense_config.months`.

Point critique :

`sessions.full_data_json` stocke tous les champs qui ne sont pas dans les colonnes SQL principales : donnees plugin, schema plugin, donnees de formulaire avancees, informations de prochain rendez-vous, etc.

---

## 9. Fichiers importants pour Claude / ChatGPT

Quand une IA doit modifier le projet, lui donner ce document puis lui demander de lire les fichiers concernes.

Fichiers souvent utiles :

| Besoin | Fichiers |
|---|---|
| Types et IPC | `src/shared/types.ts`, `src/main/preload.ts`, `src/main/ipc/handlers.ts` |
| Base de donnees | `src/main/database/migrations.ts`, `src/main/database/repositories/*` |
| Patients | `src/renderer/pages/PatientsPage.tsx`, `patientRepository.ts` |
| Seances | `src/renderer/pages/NewSessionPage.tsx`, `SeancesPage.tsx`, `sessionRepository.ts` |
| Plugins | `src/shared/pluginTypes.ts`, `PluginFormRenderer.tsx`, `public/plugins/*.plugin.json` |
| Agenda | `CalendarPage.tsx`, `appointmentRepository.ts`, `calendarBlockRepository.ts` |
| Google Calendar | `googleCalendarService.ts`, `CalendarPage.tsx`, `handlers.ts` |
| Factures | `invoiceService.ts`, `FacturesListPage.tsx`, `comptaRepository.ts` |
| Comptabilite | `ComptaPage.tsx`, `DepensesPage.tsx`, `comptaExportService.ts` |
| RGPD | `RgpdPage.tsx`, `rgpdService.ts`, `accessLogRepository.ts` |
| Sauvegardes | `backupService.ts`, `encryptionService.ts`, `settingsService.ts` |
| Diagnostic/Admin | `diagnosticService.ts`, `adminService.ts`, `AdminPanel.tsx` |
| Styles | `src/renderer/styles/global.css` |

---

## 10. Regles de modification importantes

### Avant de coder

- Lire les fichiers concernes.
- Respecter l'architecture Electron : renderer -> preload -> IPC -> main.
- Ne pas contourner `window.mtcApi`.
- Verifier si la fonctionnalite touche une table SQLite, un type TypeScript ou un canal IPC.

### Ajouter un champ patient

1. Ajouter une migration dans `migrations.ts`.
2. Ajouter le champ dans `Patient` dans `types.ts`.
3. Mettre a jour `patientRepository.ts`, notamment INSERT et UPDATE.
4. Mettre a jour `PatientsPage.tsx`.
5. Verifier les exports si le champ doit apparaitre dans les rapports.

### Ajouter un canal IPC

1. Ajouter la methode dans `IpcApi` (`src/shared/types.ts`).
2. L'exposer dans `preload.ts`.
3. Ajouter `ipcMain.handle(...)` dans `handlers.ts`.
4. Appeler via `window.mtcApi.xxx()` cote renderer.

### Ajouter une page

1. Creer le composant dans `src/renderer/pages/`.
2. Importer dans `App.tsx`.
3. Ajouter une route.
4. Ajouter un lien dans la sidebar si necessaire.
5. Ajouter le CSS dans `global.css`.

### Modifier les seances

`NewSessionPage.tsx` est central et volumineux. Il faut faire des modifications ciblees.

Modes existants :

- aucun plugin : formulaire simple ;
- plugin MTC avec `useBuiltinForm: true` : formulaire MTC integre ;
- plugin tiers : rendu dynamique avec `PluginFormRenderer`.

Les champs non SQL doivent etre conserves dans `full_data_json`.

### Modifier les plugins

Un plugin JSON doit respecter `PluginDefinition` dans `src/shared/pluginTypes.ts`.

Si on ajoute un nouveau type de champ plugin :

1. Ajouter le type dans `pluginTypes.ts`.
2. Ajouter la validation dans `pluginService.ts`.
3. Ajouter le rendu dans `PluginFormRenderer.tsx`.
4. Ajouter le resume dans `SummaryPage.tsx` ou `SeancesPage.tsx` si necessaire.
5. Ajouter les styles dans `global.css`.

### Base de donnees

- `better-sqlite3` est synchrone.
- Ne pas utiliser `.then()` sur les appels DB.
- Ne jamais modifier une migration deja publiee si des utilisateurs ont pu l'executer.
- Ajouter une nouvelle migration.
- Faire attention a l'ordre des migrations existantes.

---

## 11. Points d'attention connus

- Le projet contient encore des noms historiques lies a "Dossier Patient MTC" dans certains fichiers, mais le produit actuel est Synoria.
- Le formulaire de seance est un gros fichier : modifier prudemment.
- `full_data_json` est indispensable pour ne pas perdre les donnees plugin.
- Les sauvegardes utilisent une cle de chiffrement distincte du mot de passe utilisateur.
- Google Calendar peut creer des doublons si les identifiants d'evenements ne sont pas bien geres.
- Les exports PDF natifs restent limites : l'application s'appuie surtout sur impression / HTML / systeme selon les cas.
- La signature officielle de l'installateur reste un sujet commercial important.
- Le build Mac ne doit pas etre considere acquis depuis Windows.

---

## 12. Differenciation commerciale

Synoria peut se differencier autour de cinq idees :

### 1. Donnees locales

"Vos donnees patients restent chez vous."

C'est l'argument cle face aux solutions SaaS.

### 2. Plugins metier

Chaque specialite peut avoir son anamnese :

- MTC ;
- osteopathie ;
- kinesiologie ;
- naturopathie ;
- autres pratiques a venir.

### 3. Outil tout-en-un

Synoria regroupe :

- dossier patient ;
- seances ;
- agenda ;
- factures ;
- comptabilite ;
- exports ;
- RGPD ;
- sauvegardes.

### 4. Simplicite pour independants

Le logiciel vise des praticiens non techniciens. Les workflows doivent rester clairs, concrets et rapides.

### 5. Relation humaine

Un petit editeur peut proposer :

- support direct ;
- adaptation metier ;
- creation de plugins sur demande ;
- ecoute des praticiens.

---

## 13. Limites et axes d'amelioration

Axes encore utiles :

- signature numerique officielle de l'installateur ;
- site commercial professionnel ;
- video de demonstration ;
- systeme de licence ;
- mise a jour automatique complete ;
- essai gratuit limite dans le temps ;
- meilleure documentation commerciale ;
- graphiques d'evolution patient ;
- statistiques plus visuelles ;
- export PDF natif plus direct ;
- meilleure mise en avant des plugins ;
- tests automatises ;
- CI/CD pour builds Windows/Mac/Linux.

---

## 14. Formulations commerciales

### Version courte

Synoria est un logiciel de gestion de cabinet pour praticiens independants. Il permet de gerer les patients, les seances, l'agenda, les factures, les sauvegardes et les obligations RGPD dans une application locale securisee. Sa force principale est son systeme de plugins, qui adapte l'anamnese a chaque specialite.

### Version humaine

Synoria est concu pour les praticiens qui veulent un outil simple, securise et vraiment adapte a leur facon de travailler. Les donnees patients restent en local, les seances sont structurees, les rendez-vous et factures sont geres dans le meme espace, et chaque specialite peut avoir son propre formulaire grace aux plugins.

### Version technique

Synoria est une application desktop Electron/React/TypeScript avec base SQLite locale, IPC securise via preload, chiffrement AES-256-GCM, sauvegardes chiffrees, moteur de plugins JSON et modules metier pour agenda, facturation, comptabilite et RGPD.

---

## 15. Prompt de depart pour Claude ou ChatGPT

Copier-coller possible :

```text
Tu travailles sur Synoria, une application desktop Electron + React + TypeScript + SQLite de gestion de dossiers patients pour praticiens independants.

Avant de proposer du code, lis le document DOCUMENT_EXPLICATIF_SYNORIA.md puis les fichiers concernes par ma demande.

Contraintes importantes :
- ne pas casser l'existant ;
- respecter l'architecture renderer -> preload -> IPC -> main ;
- ne jamais acceder a SQLite depuis le renderer ;
- utiliser window.mtcApi cote React ;
- ajouter les types dans src/shared/types.ts si necessaire ;
- ajouter les handlers IPC dans src/main/ipc/handlers.ts si necessaire ;
- ajouter une migration SQLite pour tout changement de schema ;
- conserver les donnees complexes de seance dans full_data_json ;
- apres une modification code, verifier avec npx vite build quand c'est pertinent.

Reponds de facon directe, avec les fichiers modifies et les points a verifier.
```

---

## 16. Conclusion

Synoria est aujourd'hui une base solide de logiciel de cabinet : dossier patient, seances, plugins, agenda, Google Calendar, facturation, comptabilite, RGPD, sauvegardes chiffrees, diagnostic et administration.

Les meilleurs arguments restent :

- controle local des donnees ;
- securite integree ;
- plugins par specialite ;
- suivi patient structure ;
- fonctions cabinet tout-en-un ;
- adaptation aux praticiens independants.

Ce document doit servir de contexte commun pour Claude, ChatGPT et toute personne qui intervient sur le projet.
