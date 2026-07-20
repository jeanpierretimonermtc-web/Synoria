# Système de licence Synoria — Documentation technique

> Lire ce fichier avant toute intervention sur la licence, Stripe, Supabase ou les pages d'abonnement.

---

## Architecture générale

```
Client Electron
  └── supabaseAuthService   ← auth Supabase (email/mot de passe)
  └── licenseService        ← vérification offline (JWT signé Ed25519)
  └── localLicenseStore     ← cache JWT chiffré sur disque
  └── restrictedModeGuard   ← bloque les écritures si statut restricted

Edge Function Supabase (license-check)
  └── vérifie l'abonnement Stripe actif
  └── génère un JWT signé avec la clé privée Ed25519
  └── le client le stocke et le vérifie offline

Stripe
  └── gestion des abonnements (annual / 6 mois)
  └── webhook → supabase (mise à jour statut)
```

---

## Statuts de licence

| Status | Comportement |
|---|---|
| `active` | Accès complet en écriture |
| `trialing` | Accès complet (période d'essai) |
| `past_due_grace` | Accès complet pendant la période de grâce |
| `restricted` | Lecture seule, export bloqué |
| `unknown` | Pas de JWT local → mode restreint |

---

## Comptes propriétaire (admin à vie)

Les comptes listés dans `OWNER_EMAILS` (`.env.local`) obtiennent un état de licence `synoria_owner` avec accès illimité permanent. Ce bypass est activé dans deux endroits :

1. **Au démarrage** : `src/main/index.ts` — si l'utilisateur Supabase connecté est owner, `setCachedLicenseState(OWNER_LICENSE_STATE)` est appelé immédiatement.
2. **Sur chaque appel de licence** : `src/main/ipc/handlers.ts` — `getOwnerStateIfApplicable()` court-circuite toute vérification Stripe/JWT.

**Sécurité** : les emails ne sont jamais dans le source. Ils sont injectés depuis `.env.local` au build via `vite.config.ts` → `process.env.OWNER_EMAILS`.

---

## Clés cryptographiques

| Clé | Emplacement | Usage |
|---|---|---|
| Clé privée Ed25519 | Secrets Supabase → `LICENSE_PRIVATE_KEY` | Signature des JWT (Edge Function uniquement) |
| Clé publique Ed25519 | `.env.local` → `LICENSE_PUBLIC_KEY` | Vérification offline dans le client |

La clé privée **ne transit jamais** vers le client. La clé publique est embarquée dans le bundle — c'est intentionnel et sûr (cryptographie asymétrique).

---

## Variables d'environnement requises

Dans `.env.local` (git-ignoré) :

```
LICENSE_PUBLIC_KEY=...    # PEM Ed25519 public key
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
OWNER_EMAILS=...          # virgule-séparés
GCAL_CLIENT_ID=...
GCAL_CLIENT_SECRET=...
```

Voir `env.local.example` pour le template.

---

## Actions manuelles Supabase restantes

- [ ] `supabase db push` pour appliquer les migrations en production si pas encore fait
- [ ] Vérifier que la Edge Function `license-check` est déployée avec la dernière version

---

## Flux d'abonnement

1. Utilisateur clique "S'abonner" → `accountCreateCheckout(priceId)` → URL Stripe Checkout
2. Paiement Stripe → webhook → Supabase (table `subscriptions` mise à jour)
3. Client appelle `license:verifyOnline` → Edge Function génère un JWT → client le stocke
4. Vérifications offline toutes les 24h via le scheduler dans `src/main/index.ts`
