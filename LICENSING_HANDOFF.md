# Passation — Système de licence Synoria (Stripe + Supabase)

Document à lire par Claude en tout début de nouvelle session sur ce dossier
(`synoria_test`), pour reprendre exactement là où la conversation précédente
s'est arrêtée. Une fois le travail terminé et mergé, ce fichier peut être
supprimé.

---

## 0. Contexte important : confusion de dépôts (résolue)

Il existe deux clones locaux du même dépôt GitHub sur cette machine :

- `c:\Users\timjp\development\synoria` — **périmé** (v1.4.4, ~81 commits de
  retard sur `origin/main`). Ne plus y travailler. Une branche
  `feature/stripe-supabase-licensing` y a été poussée sur GitHub par erreur
  avant la découverte de ce problème — laissée de côté pour l'instant,
  contient une première version (obsolète, ancien design) des pages de
  landing ci-dessous.
- `c:\Users\timjp\development\synoria_test` (**ce dossier**) — le bon, à jour
  (v1.5.7, migrations SQLite jusqu'à v16), contient `DOCUMENT_EXPLICATIF_SYNORIA.md`.
  Tout le travail de licence se fait ici, sur la branche
  `feature/synoria-licensing-stripe-supabase` (locale, jamais poussée sur GitHub).

**Important** : la mémoire persistante de Claude Code est associée au chemin
du dossier ouvert. Une session ouverte sur `synoria_test` ne partage pas
automatiquement la mémoire d'une session ouverte sur `synoria`. C'est
pourquoi ce fichier existe.

---

## 1. Objectif du projet

Mettre en place un système de licence commerciale pour Synoria avec
**Stripe Billing + Supabase**, sans jamais envoyer de données patients vers
Supabase. Voir `DOCUMENT_EXPLICATIF_SYNORIA.md` pour le contexte produit
complet (à lire avant tout code, comme demandé par l'utilisateur).

### Décisions produit validées
- Nom commercial : Synoria. Domaine : `logiciel-synoria.fr` (acheté, **pas
  encore pointé vers Vercel**).
- Pas de version portable USB (décision déjà actée pour la landing page).
- Compte utilisateur obligatoire (Supabase Auth).
- Paiement Stripe Billing. Essai gratuit 14 jours, **carte bancaire obligatoire
  dès le début de l'essai**, conversion automatique à J+14 si pas d'annulation.
- Offres Stripe déjà créées : **Synoria Annuel = 123 €/an**, **Synoria 6 mois
  = 63 €/6 mois**. "Synoria Cabinet" prévu plus tard.
- Supabase centralise UNIQUEMENT : utilisateur, organisation/cabinet,
  abonnement Stripe, licence, appareils, logs de vérification licence,
  notifications de mise à jour. **Aucune donnée patient/séance/rdv/facture/
  sauvegarde ne doit jamais y transiter.**
- 2 appareils actifs max par licence. Désactivation par l'utilisateur limitée
  à 3 / 30 jours glissants. Vérification en ligne attendue tous les 7 jours ;
  hors ligne, un jeton local signé (Ed25519) fait foi jusqu'à expiration.
  Détection de recul d'horloge requise.
- Mode restreint (licence expirée/invalide) : lecture/export/sauvegarde des
  données existantes toujours possibles ; bloqué uniquement : création/
  modification patients, séances, factures, rdv, fonctions premium.
- Mise à jour V1 = notification uniquement, pas d'auto-update forcé.
- Architecture "organization" simple (prête pour Synoria Cabinet plus tard).

### Contraintes techniques obligatoires
- Respecter `renderer -> preload -> IPC -> main`. Le renderer n'accède
  jamais directement à SQLite/Node/filesystem/secrets Supabase.
- Tous les appels licence passent par `window.mtcApi`.
- Types dans `src/shared/types.ts`, préload dans `src/main/preload.ts`,
  handlers dans `src/main/ipc/handlers.ts`, services dans `src/main/services/`.
- Jeton de licence stocké localement **chiffré** (réutiliser le pattern
  AES-256-GCM + PBKDF2 déjà présent dans `src/main/services/authService.ts`,
  mais fichier séparé, indépendant du mot de passe applicatif).
- La vérification critique de licence doit se faire côté main, pas seulement
  en React.
- **Ne jamais** mettre `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET` ou `LICENSE_PRIVATE_KEY` dans Electron. Ces
  secrets vivent uniquement dans les Edge Functions Supabase (voir §3).
  Electron ne peut contenir que `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
  `LICENSE_PUBLIC_KEY` (aucune des trois n'est un secret).
- `device_id_hash` = UUID local persistant + infos non identifiantes,
  hashé — jamais un identifiant matériel brut.

---

## 2. Ce qui a déjà été fait (rien n'est encore commité)

`git status` sur la branche `feature/synoria-licensing-stripe-supabase`
montre tout ceci en attente (non commité) :

### a) Schéma Supabase (étape 1 du plan)
- `supabase/config.toml`, `supabase/migrations/20260703120000_licensing_schema.sql`
  — schéma complet : 9 tables (`organizations`, `profiles`,
  `organization_members`, `subscriptions`, `licenses`, `devices`,
  `device_deactivation_events`, `license_checks`, `app_releases`), RLS
  activée partout (lecture seule pour le client, écritures réservées aux
  Edge Functions en `service_role`), trigger d'auto-provisioning à
  l'inscription (organisation + profil + licence `status='restricted'` par
  défaut), triggers `updated_at`, et 2 triggers de garde-fou métier
  (`enforce_device_limit`, `enforce_deactivation_rate_limit`) en plus de ce
  qui était demandé, en défense en profondeur.
  **⚠️ Pas encore appliqué au projet Supabase réel** — à faire via
  Dashboard Supabase → SQL Editor → coller le contenu du fichier → Run
  (je n'ai pas le mot de passe DB ni de Personal Access Token pour le faire
  moi-même via CLI).
- `supabase/.env` (git-ignoré, vérifié) — contient `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (donnés par l'utilisateur
  dans le chat — la service_role key a potentiellement fuité dans
  l'historique de conversation ; l'utilisateur a été informé qu'il peut la
  régénérer depuis Dashboard → Settings → API si besoin).
  Projet Supabase : `https://nicyxynczjvoyxaernbr.supabase.co`.

### b) 9 pages commerciales (`landing/`)
Construites une première fois sur l'ancien dépôt `synoria` avec un design
obsolète (beige/DM Serif), puis **reconstruites ici** pour correspondre au
vrai design actuel du site (Inter + Georgia serif, vert sauge `#4a7b3c`,
classes `.btn`/`.section`/`.feature`/`.footer` déjà existantes dans
`landing/index.html` avant mon intervention) :

- `landing/assets/site.css` (nouveau) — CSS extrait de l'ancien `<style>`
  inline de `index.html`, + composants ajoutés (`.price-card`, `.auth-card`,
  `.account-panel`, `.result-page`, `.prose`, `.faq-item`, etc.)
- `landing/index.html` (modifié) — lien vers le CSS externe au lieu
  d'inline, nav (+Tarifs, +Support, +Mon compte), footer (+colonnes Compte
  et Légal), copyright avec SIRET.
- `landing/tarifs.html` — 2 offres (123 €/an, 63 €/6 mois), bandeau essai
  14 jours, FAQ. **Boutons "Commencer l'essai gratuit" pointent vers un
  `mailto:` provisoire** (marqué `<!-- TODO -->`) en attendant les vrais
  Payment Links Stripe.
- `landing/merci.html` / `landing/paiement-annule.html` — pages de retour
  Stripe (succès/annulation).
- `landing/abonnement.html` — **authentification Supabase réellement
  fonctionnelle** (signup/login/mot de passe oublié, via `@supabase/supabase-js`
  chargé en CDN, clé anon réelle) branchée sur le projet ci-dessus. La
  lecture du statut d'abonnement (`select from licenses`) est déjà écrite
  mais renverra "Bientôt disponible" tant que les Edge Functions n'existent
  pas.
- `landing/telechargement.html`, `landing/confidentialite.html` (adresse
  postale à compléter — `[ADRESSE POSTALE À COMPLÉTER]`), `landing/cgv.html`
  (idem + clause de rétractation marquée "à faire relire par un juriste"),
  `landing/support.html`.
- `vercel.json` (modifié) — **bug corrigé** : le rewrite existant pointait
  vers `/release/landing_synoria.html`, un fichier inexistant (la homepage
  était probablement cassée en prod). Remplacé par des rewrites propres
  vers les 9 pages + un passthrough `/assets/*`.

Toutes les pages ont été vérifiées localement (serveur HTTP statique) :
200 partout, HTML/CSS/JS sans erreur de syntaxe.

---

## 3. Étapes restantes (plan original, non commencées)

2. Configurer Stripe : confirmer produits/prix (123 €/63 €),
   `trial_period_days: 14`, `payment_method_collection: always`, endpoint
   webhook + secret.
3. Edge Function `stripe-webhook` (source de vérité — à tester en premier,
   en mode test Stripe).
4. Edge Functions `create-checkout-session` + `create-billing-portal-session`.
5. Edge Function `verify-license` (paire de clés Ed25519, cap 2 appareils,
   signature du jeton offline).
6. Edge Function `deactivate-device` (limite 3 désactivations / 30 jours
   glissants — déjà doublée par un trigger DB, voir §2a).
7. `src/main/services/licenseService.ts` (Electron) : device_id_hash,
   stockage chiffré local, vérification signature, détection recul
   d'horloge — testé isolément d'abord.
8. `src/main/services/supabaseAuthService.ts` + canaux IPC `account:*`/
   `license:*` + `preload.ts` + `types.ts`.
9. Câblage du flux de démarrage (`src/main/index.ts` + `src/renderer/App.tsx`) :
   compte obligatoire avant l'écran mot de passe existant (`LockScreen.tsx`),
   scheduler de vérification périodique.
10. Garde `assertNotRestricted()` sur les handlers d'écriture ciblés
    (patients/sessions/appointments/invoices create+update, rapports premium).
11. Pages renderer (compte, abonnement, bandeau mode restreint) + boutons
    désactivés côté UI en mode restreint (en plus du blocage main, jamais
    à sa place).
12. Tests de bout en bout en Stripe test mode (essai → conversion J14 →
    échec paiement → résiliation → mode restreint + caps appareils/
    désactivations).

---

## 4. Pour reprendre

Dis simplement "lis LICENSING_HANDOFF.md et continue" (ou pose ta question
normalement, ce fichier donne tout le contexte nécessaire). Rien n'est
commité — un `git status` en début de session montrera l'état exact des
fichiers en cours.
