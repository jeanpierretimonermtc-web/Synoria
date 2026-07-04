/**
 * device-deactivate — Edge Function Synoria
 *
 * Désactive logiquement un appareil lié à la licence de l'utilisateur.
 * L'appareil n'est jamais supprimé — uniquement marqué is_active = false.
 *
 * Entrée  : POST { "device_id": "uuid", "reason": DeactivationReason }
 * Sortie  : { "success": true, "active_devices": [...], "deactivations_remaining_30_days": N }
 *           ou { "success": false, "reason": "...", "message": "..." }
 *
 * Contraintes :
 *   • Utilisateur authentifié Supabase Auth obligatoire.
 *   • L'appareil doit appartenir à la licence de l'organisation de l'utilisateur.
 *   • Limite : 3 désactivations par license_id sur 30 jours glissants.
 *   • Interdit de désactiver un appareil déjà inactif.
 *   • Aucune donnée patient ne transite ici.
 *
 * Prérequis SQL :
 *   Appliquer supabase/migrations/20260703130000_device_deactivation_columns.sql
 *   avant de déployer cette fonction.
 *
 * Variables d'environnement : auto-injectées par Supabase
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Constantes ──────────────────────────────────────────────────────────────

const MAX_DEACTIVATIONS   = 3
const WINDOW_DAYS         = 30

const VALID_REASONS = [
  'changement_ordinateur',
  'ancien_appareil',
  'erreur_activation',
  'autre',
] as const

type DeactivationReason = typeof VALID_REASONS[number]

// ── Handler ────────────────────────────────────────────────────────────────

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

  // 2. Valider le body
  let deviceId: string
  let reason: DeactivationReason

  try {
    const body = await req.json() as Record<string, unknown>

    if (!body?.device_id || typeof body.device_id !== 'string') {
      return json({ error: 'Missing device_id', message: 'device_id (UUID) est requis.' }, 400)
    }
    // Validation UUID basique
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(body.device_id)) {
      return json({ error: 'Invalid device_id', message: 'device_id doit être un UUID valide.' }, 400)
    }

    deviceId = body.device_id

    if (!body?.reason || !VALID_REASONS.includes(body.reason as DeactivationReason)) {
      return json({
        error:        'Invalid reason',
        message:      `reason doit être l'une des valeurs : ${VALID_REASONS.join(', ')}`,
        valid_values: VALID_REASONS,
      }, 400)
    }
    reason = body.reason as DeactivationReason

  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // 3. Récupérer l'organisation via le profil
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[device-deactivate] Lecture profil :', profileError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire le profil utilisateur.' }, 500)
  }
  if (!profile?.organization_id) {
    return json({
      error:   'Profile not found',
      message: 'Aucune organisation associée à ce compte.',
    }, 404)
  }

  const organizationId = profile.organization_id

  // 4. Récupérer la licence
  const { data: license, error: licError } = await supabaseAdmin
    .from('licenses')
    .select('id, max_devices')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (licError) {
    console.error('[device-deactivate] Lecture licence :', licError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire la licence.' }, 500)
  }
  if (!license) {
    return json({
      error:   'License not found',
      message: 'Aucune licence trouvée pour cette organisation.',
    }, 404)
  }

  // 5. Vérifier que l'appareil appartient à cette licence (contrôle propriété)
  const { data: device, error: deviceError } = await supabaseAdmin
    .from('devices')
    .select('id, is_active, label, platform, app_version, device_id_hash')
    .eq('id', deviceId)
    .eq('license_id', license.id)   // ← sécurité : l'appareil doit appartenir à cette licence
    .maybeSingle()

  if (deviceError) {
    console.error('[device-deactivate] Lecture device :', deviceError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire l\'appareil.' }, 500)
  }
  if (!device) {
    return json({
      error:   'Device not found',
      message: 'Appareil introuvable ou non rattaché à votre licence.',
    }, 404)
  }

  // 6. Vérifier que l'appareil est encore actif
  if (!device.is_active) {
    return json({
      success: false,
      reason:  'already_inactive',
      message: 'Cet appareil est déjà désactivé.',
    }, 400)
  }

  // 7. Vérifier la limite de désactivations sur 30 jours glissants
  //
  //    Requête SQL équivalente :
  //    SELECT COUNT(*) FROM device_deactivation_events
  //    WHERE license_id = $1
  //      AND deactivated_at > NOW() - INTERVAL '30 days'
  //
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { count: recentCount, error: countError } = await supabaseAdmin
    .from('device_deactivation_events')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id)
    .gte('deactivated_at', windowStart)

  if (countError) {
    console.error('[device-deactivate] Count désactivations :', countError.message)
    return json({ error: 'Internal error', message: 'Impossible de vérifier la limite de désactivations.' }, 500)
  }

  const usedDeactivations = recentCount ?? 0

  if (usedDeactivations >= MAX_DEACTIVATIONS) {
    return json({
      success: false,
      reason:  'deactivation_limit_reached',
      message:
        `Vous avez atteint la limite de ${MAX_DEACTIVATIONS} désactivations d'appareils sur ` +
        `${WINDOW_DAYS} jours. Contactez le support Synoria pour obtenir de l'aide.`,
      deactivations_remaining_30_days: 0,
    }, 429)
  }

  // 8. Désactivation logique de l'appareil
  const now = new Date().toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('devices')
    .update({
      is_active:            false,
      deactivated_at:       now,
      deactivated_by:       user.id,
      deactivation_reason:  reason,
    })
    .eq('id', deviceId)

  if (updateError) {
    console.error('[device-deactivate] Update device :', updateError.message)
    return json({ error: 'Internal error', message: 'Impossible de désactiver l\'appareil.' }, 500)
  }

  // 9. Journaliser l'événement de désactivation
  const { error: eventError } = await supabaseAdmin
    .from('device_deactivation_events')
    .insert({
      license_id:     license.id,
      device_id_hash: device.device_id_hash,
      deactivated_at: now,
      reason,
      deactivated_by: user.id,
    })

  if (eventError) {
    // Non bloquant — l'appareil est déjà désactivé, le log est secondaire
    console.error('[device-deactivate] Insert event :', eventError.message)
  }

  // 10. Récupérer la liste des appareils actifs restants
  const { data: activeDevices } = await supabaseAdmin
    .from('devices')
    .select('id, label, platform, app_version, last_seen_at, is_active, first_seen_at')
    .eq('license_id', license.id)
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })

  // 11. Calculer les désactivations restantes (la nouvelle count inclut celle qu'on vient de faire)
  const deactivationsRemaining = Math.max(0, MAX_DEACTIVATIONS - (usedDeactivations + 1))

  console.log(
    `[device-deactivate] ✓ user=${user.id} org=${organizationId} ` +
    `device=${device.label ?? deviceId} reason=${reason} ` +
    `remaining_deactivations=${deactivationsRemaining}`,
  )

  return json({
    success:                         true,
    active_devices:                  activeDevices ?? [],
    deactivations_remaining_30_days: deactivationsRemaining,
  })
})

// ── Utilitaires ────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
