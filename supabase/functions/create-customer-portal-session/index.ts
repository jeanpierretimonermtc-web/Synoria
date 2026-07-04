/**
 * create-customer-portal-session — Edge Function Synoria
 *
 * Crée une session Stripe Customer Portal pour permettre à l'utilisateur
 * de gérer sa carte bancaire, ses factures, son abonnement et l'annulation.
 *
 * Entrée  : POST { "return_url"?: string }
 * Sortie  : { "url": "https://billing.stripe.com/..." }
 *
 * Contraintes :
 *   • Utilisateur authentifié Supabase Auth obligatoire.
 *   • stripe_customer_id récupéré via profiles → subscriptions (jamais transmis par Electron).
 *   • STRIPE_SECRET_KEY reste côté Supabase uniquement.
 *   • Aucune donnée patient ne transite ici.
 *
 * Variables d'environnement (secrets Supabase) :
 *   STRIPE_SECRET_KEY         — clé secrète Stripe
 *   SITE_URL                  — URL de base du site (défaut : https://logiciel-synoria.fr)
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — auto-injectés
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { stripe } from '../_shared/stripe.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_RETURN_URL = `${Deno.env.get('SITE_URL') ?? 'https://logiciel-synoria.fr'}/abonnement`

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight CORS (requis pour les appels depuis le renderer Electron/WebView)
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // 1. Vérifier l'authentification Supabase
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
    return json({
      error: 'Unauthorized',
      message: 'Utilisateur non authentifié ou session expirée.',
    }, 401)
  }

  // 2. Lire le return_url depuis le body (optionnel — fallback sur DEFAULT_RETURN_URL)
  let returnUrl = DEFAULT_RETURN_URL
  try {
    const body = await req.json() as { return_url?: string }
    if (body?.return_url) {
      const validated = validateHttpsUrl(body.return_url)
      if (validated) {
        returnUrl = validated
      } else {
        console.warn(
          `[create-customer-portal-session] return_url invalide "${body.return_url}" → fallback défaut`,
        )
      }
    }
  } catch {
    // Body absent ou JSON invalide — on utilise le return_url par défaut
  }

  // 3. Récupérer l'organization_id via le profil de l'utilisateur
  //    profiles.organization_id est la source de vérité (1 utilisateur = 1 organisation en V1)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[create-customer-portal-session] Lecture profil :', profileError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire le profil utilisateur.' }, 500)
  }

  if (!profile?.organization_id) {
    return json({
      error: 'Organization not found',
      message: 'Aucune organisation associée à ce compte. Veuillez contacter le support.',
    }, 404)
  }

  const organizationId = profile.organization_id

  // 4. Récupérer le stripe_customer_id depuis subscriptions
  const { data: subscription, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subError) {
    console.error('[create-customer-portal-session] Lecture subscription :', subError.message)
    return json({ error: 'Internal error', message: 'Impossible de lire les données d\'abonnement.' }, 500)
  }

  if (!subscription?.stripe_customer_id) {
    return json({
      error: 'No Stripe customer',
      message:
        'Aucun compte de facturation trouvé pour cette organisation. ' +
        'Veuillez d\'abord souscrire à un abonnement Synoria.',
    }, 404)
  }

  // 5. Créer la session Stripe Customer Portal
  let portalSession
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer:   subscription.stripe_customer_id,
      return_url: returnUrl,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[create-customer-portal-session] Stripe error :', msg)
    return json({
      error:   'Stripe error',
      message: `Impossible d'ouvrir le portail de facturation : ${msg}`,
    }, 500)
  }

  console.log(
    `[create-customer-portal-session] ✓ user=${user.id} org=${organizationId} ` +
    `customer=${subscription.stripe_customer_id} return_url=${returnUrl}`,
  )

  return json({ url: portalSession.url })
})

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Valide que l'URL est bien https. Retourne null si invalide.
 * Empêche l'injection d'un return_url arbitraire.
 */
function validateHttpsUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
