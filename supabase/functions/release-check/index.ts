/**
 * release-check — Edge Function Synoria
 *
 * Vérifie si une nouvelle version de Synoria est disponible pour la plateforme
 * et le canal de l'utilisateur. Ne force aucune mise à jour — notification uniquement.
 *
 * Entrée  : POST { platform, current_version, channel? }
 * Sortie  : { update_available, latest_version, is_required, min_supported_version,
 *             title, release_notes, download_url }
 *
 * Contraintes absolues :
 *   • Utilisateur authentifié Supabase Auth obligatoire.
 *   • Aucune donnée patient ne transite ici.
 *   • Aucune mise à jour forcée sans consentement explicite.
 *   • Lecture seule — aucune écriture en base.
 *
 * Variables d'environnement (auto-injectées par Supabase) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin }           from '../_shared/supabase-admin.ts'
import { createClient }            from 'npm:@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────────────────

type Platform = 'windows' | 'macos' | 'linux'
type Channel  = 'stable' | 'beta' | 'alpha'

interface RequestBody {
  platform:        Platform
  current_version: string
  channel?:        Channel
}

interface AppRelease {
  version:              string
  is_required:          boolean
  min_supported_version: string | null
  title:                string
  release_notes:        string | null
  download_url:         string
}

// ── Utilitaires semver ─────────────────────────────────────────────────────

// Compare deux versions semver. Retourne >0 si a > b, 0 si égales, <0 si a < b.
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function isValidSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v.trim())
}

// ── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  // ── Authentification ───────────────────────────────────────────────────

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser(
    authHeader.slice(7),
  )
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  // ── Validation du corps ────────────────────────────────────────────────

  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const VALID_PLATFORMS: Platform[] = ['windows', 'macos', 'linux']
  const VALID_CHANNELS: Channel[]   = ['stable', 'beta', 'alpha']

  const platform = body.platform
  const channel  = (body.channel ?? 'stable') as Channel
  const currentVersion = (body.current_version ?? '').trim()

  if (!VALID_PLATFORMS.includes(platform)) {
    return Response.json(
      { error: `Plateforme invalide : ${platform}. Valeurs acceptées : ${VALID_PLATFORMS.join(', ')}` },
      { status: 400, headers: corsHeaders },
    )
  }
  if (!VALID_CHANNELS.includes(channel)) {
    return Response.json(
      { error: `Canal invalide : ${channel}. Valeurs acceptées : ${VALID_CHANNELS.join(', ')}` },
      { status: 400, headers: corsHeaders },
    )
  }
  if (!isValidSemver(currentVersion)) {
    return Response.json(
      { error: 'current_version invalide — format attendu : x.y.z (ex: 1.5.0)' },
      { status: 400, headers: corsHeaders },
    )
  }

  // ── Lecture des releases disponibles ──────────────────────────────────
  // On récupère les releases actives pour la plateforme spécifique ET "all".
  // ORDER BY published_at DESC pour prioriser les publications récentes en cas
  // d'ex-aequo de version (rare, mais géré proprement).

  const { data: releases, error: dbError } = await supabaseAdmin
    .from('app_releases')
    .select('version, is_required, min_supported_version, title, release_notes, download_url')
    .eq('channel', channel)
    .eq('is_active', true)
    .in('platform', [platform, 'all'])
    .order('published_at', { ascending: false })
    .limit(20)

  if (dbError) {
    console.error('[release-check] DB error:', dbError.message)
    return Response.json({ error: 'Erreur interne du serveur' }, { status: 500, headers: corsHeaders })
  }

  // Aucune release connue → pas de mise à jour
  if (!releases || releases.length === 0) {
    return Response.json(
      {
        update_available:     false,
        latest_version:       currentVersion,
        is_required:          false,
        min_supported_version: null,
        title:                null,
        release_notes:        null,
        download_url:         null,
      },
      { headers: corsHeaders },
    )
  }

  // Sélectionner la release avec la version la plus haute parmi les résultats
  const latest = (releases as AppRelease[]).reduce((best, r) =>
    compareSemver(r.version, best.version) > 0 ? r : best,
  )

  const updateAvailable = compareSemver(latest.version, currentVersion) > 0

  return Response.json(
    {
      update_available:     updateAvailable,
      latest_version:       latest.version,
      is_required:          updateAvailable ? (latest.is_required ?? false) : false,
      min_supported_version: latest.min_supported_version ?? null,
      title:                updateAvailable ? latest.title                  : null,
      release_notes:        updateAvailable ? (latest.release_notes ?? null) : null,
      download_url:         updateAvailable ? latest.download_url           : null,
    },
    { headers: corsHeaders },
  )
})
