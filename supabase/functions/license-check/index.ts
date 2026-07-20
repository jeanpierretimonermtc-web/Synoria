/**
 * license-check — Edge Function Synoria
 *
 * Vérifie la licence d'un utilisateur authentifié, enregistre/met à jour
 * l'appareil, et retourne un jeton offline signé Ed25519 valable 7 jours.
 *
 * Entrée  : POST { device_id_hash, device_name, platform, os_version, app_version }
 * Sortie  : { allowed, mode, license_token?, valid_until?, warning?, license? }
 *           ou { allowed: false, mode: 'restricted', reason, message }
 *
 * Contraintes absolues :
 *   • Utilisateur authentifié Supabase Auth obligatoire.
 *   • LICENSE_PRIVATE_KEY reste dans les secrets Supabase — jamais dans Electron.
 *   • Aucune donnée patient ne transite ici.
 *   • Limite max_devices appareils actifs simultanés.
 *   • Un appareil désactivé ne peut pas se réactiver sans support.
 *
 * Variables d'environnement (secrets Supabase) :
 *   LICENSE_PRIVATE_KEY        — clé privée Ed25519 PEM PKCS#8
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — auto-injectés
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Constantes ─────────────────────────────────────────────────────────────

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60          // 7 jours (vérifié toutes les 24h)
const MAX_DEACTIVATIONS_PER_30_DAYS = 3

const FEATURES_FULL       = ['read', 'write', 'export', 'backup', 'calendar', 'billing']
const FEATURES_RESTRICTED = ['read', 'export']

// Comptes propriétaire — accès illimité permanent, bypass de toute vérification Stripe/licence.
const OWNER_EMAILS = [
  'jeanpierre.timoner.mtc@gmail.com',
  'jean-pierre.timoner@wanadoo.fr',
  'charlotte.therapie09@gmail.com',
]

// ── Types ──────────────────────────────────────────────────────────────────

type Platform = 'windows' | 'macos' | 'linux' | 'unknown'

// Valeurs exactes de l'enum license_checks.result dans le schéma SQL
type LicenseCheckResult =
  | 'ok'
  | 'offline_grace'
  | 'past_due_grace'
  | 'restricted'
  | 'expired'
  | 'revoked'
  | 'device_limit_reached'
  | 'invalid_signature'

interface DeviceInput {
  device_id_hash: string
  device_name:    string
  platform:       Platform
  os_version:     string       // stocké dans le label — pas de colonne os_version dans devices
  app_version:    string
}

interface LicenseEvaluation {
  allowed:      boolean
  mode:         'full' | 'restricted'
  reason?:      string
  message?:     string
  warning?:     string
  checkResult:  LicenseCheckResult
}

type TokenSignResult =
  | { ok: true;  token: string }
  | { ok: false; error: string }

// ── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // 1. Authentification Supabase
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization header' }, 401)
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized', message: 'Session expirée ou invalide.' }, 401)
  }

  // 2. Lire le body une seule fois (avant le bypass propriétaire pour récupérer device_id_hash)
  let parsedBody: Record<string, unknown>
  try {
    parsedBody = await req.json() as Record<string, unknown>
  } catch {
    parsedBody = {}
  }

  // ── Bypass propriétaire ────────────────────────────────────────────────────
  // Les comptes listés dans OWNER_EMAILS ont un accès illimité permanent,
  // indépendamment de tout abonnement Stripe ou statut de licence.
  if (OWNER_EMAILS.includes(user.email ?? '')) {
    const privateKeyPem = Deno.env.get('LICENSE_PRIVATE_KEY')
    if (!privateKeyPem) {
      return json({ error: 'Server configuration error', message: 'Clé de licence non configurée.' }, 500)
    }
    const nowSec = Math.floor(Date.now() / 1000)
    // Utiliser le vrai device_id_hash si fourni (pour que la validation locale du client réussisse)
    const ownerDeviceHash = typeof parsedBody.device_id_hash === 'string' && parsedBody.device_id_hash.length >= 8
      ? parsedBody.device_id_hash
      : 'owner'
    const ownerToken = await signLicenseToken({
      userId:         user.id,
      organizationId: 'owner',
      licenseId:      'owner',
      deviceId:       'owner',
      deviceIdHash:   ownerDeviceHash,
      planCode:       'synoria_owner',
      status:         'active',
      mode:           'full',
      features:       FEATURES_FULL,
      maxDevices:     99,
      graceUntil:     null,
      iat:            nowSec,
      exp:            nowSec + TOKEN_TTL_SECONDS,
    }, privateKeyPem)
    if (!ownerToken.ok) {
      return json({ error: 'Token signing failed' }, 500)
    }
    console.log(`[license-check] ✓ OWNER bypass — user=${user.email}`)
    return json({
      allowed:       true,
      mode:          'full',
      license_token: ownerToken.token,
      valid_until:   new Date((nowSec + TOKEN_TTL_SECONDS) * 1000).toISOString(),
      license: {
        status:                          'active',
        plan_code:                       'synoria_owner',
        max_active_devices:              99,
        active_devices:                  1,
        deactivations_remaining_30_days: 99,
      },
    })
  }
  // ── Fin bypass propriétaire ────────────────────────────────────────────────

  // 3. Valider et normaliser le body (déjà parsé, pas de second req.json())
  let input: DeviceInput
  try {
    const body = parsedBody
    if (!body?.device_id_hash || typeof body.device_id_hash !== 'string') {
      return json({ error: 'Missing device_id_hash', message: 'device_id_hash est requis.' }, 400)
    }
    if (body.device_id_hash.length < 8) {
      return json({ error: 'Invalid device_id_hash', message: 'device_id_hash trop court.' }, 400)
    }

    const validPlatforms: Platform[] = ['windows', 'macos', 'linux']
    input = {
      device_id_hash: body.device_id_hash,
      device_name:    typeof body.device_name === 'string' ? body.device_name : 'Appareil inconnu',
      platform:       validPlatforms.includes(body.platform as Platform)
        ? body.platform as Platform
        : 'unknown',
      os_version:     typeof body.os_version   === 'string' ? body.os_version   : '',
      app_version:    typeof body.app_version  === 'string' ? body.app_version  : '',
    }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // 4. Récupérer l'organization_id
  //    Source principale : profiles (mis à jour par le trigger handle_new_user).
  //    Fallback : organization_members (toujours en cascade avec organizations).
  //    La divergence peut arriver si l'org originale a été supprimée manuellement
  //    (profiles.organization_id passe à null via ON DELETE SET NULL).
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[license-check] Lecture profil :', profileError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire le profil utilisateur.' }, 500)
  }

  let organizationId: string | null = profile?.organization_id ?? null

  if (!organizationId) {
    const { data: members } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
    organizationId = members?.[0]?.organization_id ?? null
    if (organizationId) {
      console.warn(`[license-check] org résolu via organization_members (profiles.organization_id était null) user=${user.id}`)
    }
  }

  if (!organizationId) {
    return json({
      error:   'Profile not found',
      message: 'Aucune organisation associée à ce compte. Contactez le support.',
    }, 404)
  }

  // 5. Récupérer la licence (source de vérité pour l'accès)
  const { data: license, error: licError } = await supabaseAdmin
    .from('licenses')
    .select('id, status, max_devices, grace_until, subscription_id')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (licError) {
    console.error('[license-check] Lecture licence :', licError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire la licence.' }, 500)
  }
  if (!license) {
    return json({
      error:   'License not found',
      message: 'Aucune licence trouvée pour cette organisation.',
    }, 404)
  }

  // 6. Récupérer l'abonnement Stripe (pour trial_end et plan_name)
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('plan_name, trial_end, status')
    .eq('organization_id', organizationId)
    .maybeSingle()

  // 7. Évaluer le statut de la licence (règles métier)
  const evaluation = evaluateLicense(license, subscription)

  const now = new Date()

  // 8. Vérifier et gérer l'appareil
  const { data: existingDevice } = await supabaseAdmin
    .from('devices')
    .select('id, is_active, label')
    .eq('license_id', license.id)
    .eq('device_id_hash', input.device_id_hash)
    .maybeSingle()

  let deviceId: string | null = null

  if (existingDevice) {
    // Appareil connu
    if (!existingDevice.is_active) {
      // Appareil explicitement désactivé — refus sans réactivation automatique
      await logCheck(license.id, input, 'restricted', null)
      return json({
        allowed: false,
        mode:    'restricted',
        reason:  'device_deactivated',
        message: 'Cet appareil a été désactivé. Contactez le support Synoria pour le réactiver.',
      })
    }

    // Mise à jour des métadonnées (heartbeat)
    // Note : os_version inclus dans le label pour traçabilité (pas de colonne dédiée dans le schéma V1)
    const label = input.os_version
      ? `${input.device_name} (${input.os_version})`
      : input.device_name

    await supabaseAdmin
      .from('devices')
      .update({
        last_seen_at: now.toISOString(),
        label,
        platform:    input.platform,
        app_version: input.app_version,
      })
      .eq('id', existingDevice.id)

    deviceId = existingDevice.id

  } else {
    // Nouvel appareil — vérifier la limite active
    const { count: activeCount, error: countError } = await supabaseAdmin
      .from('devices')
      .select('id', { count: 'exact', head: true })
      .eq('license_id', license.id)
      .eq('is_active', true)

    if (countError) {
      console.error('[license-check] Count devices :', countError.message)
      return json({ error: 'Internal error', message: 'Impossible de vérifier les appareils actifs.' }, 500)
    }

    if ((activeCount ?? 0) >= license.max_devices) {
      await logCheck(license.id, input, 'device_limit_reached', null)
      return json({
        allowed:            false,
        mode:               'restricted',
        reason:             'device_limit_exceeded',
        message:
          `Vous avez atteint la limite de ${license.max_devices} appareil(s) actif(s). ` +
          'Désactivez un appareil existant depuis Licence & Compte → Appareils, puis réessayez.',
        max_active_devices: license.max_devices,
      }, 403)
    }

    // Enregistrer le nouvel appareil
    const label = input.os_version
      ? `${input.device_name} (${input.os_version})`
      : input.device_name

    const { data: newDevice, error: insertError } = await supabaseAdmin
      .from('devices')
      .insert({
        license_id:     license.id,
        device_id_hash: input.device_id_hash,
        label,
        platform:       input.platform,
        app_version:    input.app_version,
        is_active:      true,
        first_seen_at:  now.toISOString(),
        last_seen_at:   now.toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      // Conflit race-condition : l'appareil a été inséré entre le SELECT et l'INSERT
      // → re-lire et continuer (idempotent)
      console.warn('[license-check] Insert device conflict :', insertError.message)
      const { data: retryDevice } = await supabaseAdmin
        .from('devices')
        .select('id')
        .eq('license_id', license.id)
        .eq('device_id_hash', input.device_id_hash)
        .maybeSingle()
      deviceId = retryDevice?.id ?? null
    } else {
      deviceId = newDevice?.id ?? null
      console.log(
        `[license-check] ✓ Nouvel appareil : ${input.device_name} (${input.platform}) ` +
        `org=${organizationId}`,
      )
    }
  }

  // 9. Compter les appareils actifs et les désactivations restantes (pour la réponse)
  const { count: activeDevices } = await supabaseAdmin
    .from('devices')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id)
    .eq('is_active', true)

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentDeactivations } = await supabaseAdmin
    .from('device_deactivation_events')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id)
    .gte('deactivated_at', since30d)

  const deactivationsRemaining = Math.max(0, MAX_DEACTIVATIONS_PER_30_DAYS - (recentDeactivations ?? 0))

  // 10. Journaliser la vérification
  await logCheck(license.id, input, evaluation.checkResult, deviceId)

  // 10. Réponse restriction (pas de jeton généré)
  if (!evaluation.allowed) {
    console.log(
      `[license-check] ✗ Accès refusé — org=${organizationId} lic=${license.status} ` +
      `reason=${evaluation.reason}`,
    )
    return json({
      allowed: false,
      mode:    'restricted',
      reason:  evaluation.reason,
      message: evaluation.message,
    })
  }

  // 11. Générer le jeton offline signé
  const privateKeyPem = Deno.env.get('LICENSE_PRIVATE_KEY')
  if (!privateKeyPem) {
    console.error('[license-check] LICENSE_PRIVATE_KEY non définie !')
    return json({
      error:   'Server configuration error',
      message: 'Clé de licence non configurée côté serveur. Contactez le support.',
    }, 500)
  }

  const planCode = planNameToPlanCode(subscription?.plan_name)
  const features = FEATURES_FULL  // mode='full' garanti ici (sinon déjà retourné plus haut)
  const nowSec   = Math.floor(Date.now() / 1000)

  const tokenResult: TokenSignResult = await signLicenseToken({
    userId:         user.id,
    organizationId,
    licenseId:      license.id,
    deviceId:       deviceId ?? 'unknown',
    deviceIdHash:   input.device_id_hash,
    planCode,
    status:         license.status,
    mode:           evaluation.mode,
    features,
    maxDevices:     license.max_devices,
    graceUntil:     license.grace_until ?? null,
    iat:            nowSec,
    exp:            nowSec + TOKEN_TTL_SECONDS,
  }, privateKeyPem)

  if (!tokenResult.ok) {
    console.error('[license-check] Signature échouée :', tokenResult.error)
    return json({
      error:   'Token signing failed',
      message: 'Impossible de générer le jeton de licence. Réessayez dans quelques instants.',
    }, 500)
  }

  console.log(
    `[license-check] ✓ user=${user.id} org=${organizationId} lic=${license.status} ` +
    `plan=${planCode} device=${input.device_name} mode=${evaluation.mode}`,
  )

  const validUntil = new Date((nowSec + TOKEN_TTL_SECONDS) * 1000).toISOString()

  return json({
    allowed:       true,
    mode:          evaluation.mode,
    license_token: tokenResult.token,
    valid_until:   validUntil,
    ...(evaluation.warning ? { warning: evaluation.warning } : {}),
    license: {
      status:                          license.status,
      plan_code:                       planCode,
      max_active_devices:              license.max_devices,
      active_devices:                  activeDevices ?? 0,
      deactivations_remaining_30_days: deactivationsRemaining,
    },
  })
})

// ── Règles métier ──────────────────────────────────────────────────────────

/**
 * Évalue l'accès à partir du statut de la licence et de l'abonnement Stripe.
 * Source de vérité : licenses.status (dérivé de Stripe par stripe-webhook).
 */
function evaluateLicense(
  license: {
    status:     string
    grace_until: string | null
  },
  subscription: {
    trial_end:   string | null
    status?:     string
    plan_name?:  string | null
  } | null,
): LicenseEvaluation {
  const now = new Date()

  switch (license.status) {

    // ── Accès plein ────────────────────────────────────────────────────────

    case 'active':
      return {
        allowed:     true,
        mode:        'full',
        checkResult: 'ok',
      }

    case 'trialing': {
      const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null

      if (trialEnd && trialEnd > now) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000)
        return {
          allowed:     true,
          mode:        'full',
          checkResult: 'ok',
          ...(daysLeft <= 3 ? { warning: `Votre essai se termine dans ${daysLeft} jour(s).` } : {}),
        }
      }

      // trial_end dépassé ou absent
      return {
        allowed:     false,
        mode:        'restricted',
        reason:      'trial_expired',
        message:     'La période d\'essai Synoria est terminée. ' +
                     'Souscrivez à un abonnement pour continuer à utiliser toutes les fonctionnalités.',
        checkResult: 'restricted',
      }
    }

    // ── Grâce paiement : 7 jours après le premier échec ───────────────────

    case 'past_due_grace': {
      const graceUntil = license.grace_until ? new Date(license.grace_until) : null

      if (graceUntil && graceUntil > now) {
        const daysLeft = Math.ceil((graceUntil.getTime() - now.getTime()) / 86_400_000)
        return {
          allowed:     true,
          mode:        'full',
          warning:     `Échec de paiement — accès maintenu encore ${daysLeft} jour(s). ` +
                       'Mettez à jour votre moyen de paiement dans Licence & Compte.',
          checkResult: 'past_due_grace',
        }
      }

      // Grâce expirée : 7 jours écoulés sans régularisation
      return {
        allowed:     false,
        mode:        'restricted',
        reason:      'payment_failed_grace_expired',
        message:     'Le délai de grâce (7 jours) est expiré suite à un échec de paiement. ' +
                     'Mettez à jour votre moyen de paiement dans Licence & Compte pour restaurer l\'accès.',
        checkResult: 'restricted',
      }
    }

    // ── Accès refusé ───────────────────────────────────────────────────────

    case 'cancelled':
      return {
        allowed:     false,
        mode:        'restricted',
        reason:      'subscription_cancelled',
        message:     'Votre abonnement Synoria a été annulé. ' +
                     'Souscrivez un nouvel abonnement pour accéder à toutes les fonctionnalités.',
        checkResult: 'restricted',
      }

    case 'revoked':
      return {
        allowed:     false,
        mode:        'restricted',
        reason:      'license_revoked',
        message:     'Cette licence a été révoquée. Contactez le support Synoria.',
        checkResult: 'revoked',
      }

    case 'expired':
      return {
        allowed:     false,
        mode:        'restricted',
        reason:      'license_expired',
        message:     'Votre licence Synoria a expiré. ' +
                     'Souscrivez un abonnement pour continuer à utiliser toutes les fonctionnalités.',
        checkResult: 'expired',
      }

    case 'offline_grace':
      // État dérivé côté Electron (jeton local encore valide mais app hors-ligne > 7j)
      // Si on arrive ici c'est que l'app vient de se reconnecter — statut non-standard côté Supabase.
      // Traiter comme accès maintenu (le stripe-webhook va normaliser le statut)
      return {
        allowed:     true,
        mode:        'full',
        warning:     'Mode hors-ligne expiré — connexion rétablie. Licence vérifiée.',
        checkResult: 'ok',
      }

    case 'restricted':
    default:
      return {
        allowed:     false,
        mode:        'restricted',
        reason:      'no_active_subscription',
        message:     'Aucun abonnement actif. Souscrivez à Synoria pour accéder à toutes les fonctionnalités.',
        checkResult: 'restricted',
      }
  }
}

// ── Signature Ed25519 ──────────────────────────────────────────────────────

interface TokenPayload {
  userId:         string
  organizationId: string
  licenseId:      string
  deviceId:       string        // UUID de la ligne devices
  deviceIdHash:   string        // hash HMAC — utilisé par Electron pour vérifier l'appareil
  planCode:       string
  status:         string
  mode:           string
  features:       string[]
  maxDevices:     number
  graceUntil:     string | null
  iat:            number
  exp:            number
}

/**
 * Signe un JWT EdDSA (Ed25519) avec la clé privée PKCS#8 PEM.
 *
 * Format du jeton : header.payload.signature (base64url, compatible vérification
 * côté Electron avec crypto.verify('Ed25519', ...) natif Node.js 18+).
 *
 * Claims :
 *   iss  — 'synoria'
 *   sub  — organization_id   (standard JWT subject)
 *   uid  — user_id
 *   oid  — organization_id   (redondant avec sub, mais explicite)
 *   lid  — license_id
 *   duid — device UUID (devices.id)
 *   did  — device_id_hash    (pour vérification locale côté Electron)
 *   pln  — plan_code         (synoria_annual | synoria_6_months)
 *   sta  — license status
 *   mod  — mode              (full | restricted)
 *   fts  — features          (string[])
 *   mxd  — max_active_devices
 *   grc  — grace_until ISO   (null si non applicable)
 *   iat  — issued_at unix seconds
 *   exp  — expires_at unix seconds
 */
async function signLicenseToken(
  payload: TokenPayload,
  privateKeyPem: string,
): Promise<TokenSignResult> {
  try {
    const header = base64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))
    const claims = base64url(JSON.stringify({
      iss:  'synoria',
      sub:  payload.organizationId,
      uid:  payload.userId,
      oid:  payload.organizationId,
      lid:  payload.licenseId,
      duid: payload.deviceId,
      did:  payload.deviceIdHash,
      pln:  payload.planCode,
      sta:  payload.status,
      mod:  payload.mode,
      fts:  payload.features,
      mxd:  payload.maxDevices,
      grc:  payload.graceUntil,
      iat:  payload.iat,
      exp:  payload.exp,
    }))

    const signingInput = `${header}.${claims}`

    // Importer la clé privée Ed25519 PKCS#8 PEM
    const pemBody = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s+/g, '')

    const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBytes,
      { name: 'Ed25519' },
      false,
      ['sign'],
    )

    const signatureBytes = await crypto.subtle.sign(
      'Ed25519',
      cryptoKey,
      new TextEncoder().encode(signingInput),
    )

    const signature = base64urlBytes(new Uint8Array(signatureBytes))
    return { ok: true, token: `${signingInput}.${signature}` }

  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Journal license_checks ─────────────────────────────────────────────────

async function logCheck(
  licenseId: string,
  input: DeviceInput,
  result: LicenseCheckResult,
  deviceId: string | null,
): Promise<void> {
  try {
    await supabaseAdmin.from('license_checks').insert({
      license_id:     licenseId,
      device_id_hash: input.device_id_hash,
      app_version:    input.app_version || null,
      result,
      verified_at:    new Date().toISOString(),
    })
  } catch (err: unknown) {
    // Non-bloquant — l'échec du log ne doit pas bloquer la réponse
    console.error('[license-check] Insert license_checks :', err instanceof Error ? err.message : err)
  }
}

// ── Mapping plan_name SQL → plan_code API ──────────────────────────────────

/**
 * subscriptions.plan_name (French enum SQL) → plan_code Synoria (English API)
 *   'synoria_annuel'  → 'synoria_annual'
 *   'synoria_6mois'   → 'synoria_6_months'
 *   'synoria_cabinet' → 'synoria_cabinet'
 */
function planNameToPlanCode(planName: string | null | undefined): string {
  switch (planName) {
    case 'synoria_annuel':   return 'synoria_annual'
    case 'synoria_6mois':    return 'synoria_6_months'
    case 'synoria_cabinet':  return 'synoria_cabinet'
    default:                 return 'unknown'
  }
}

// ── Utilitaires base64url ──────────────────────────────────────────────────

function base64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
