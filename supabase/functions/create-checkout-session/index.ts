import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { stripe } from '../_shared/stripe.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Variables d'environnement nécessaires ──────────────────────────────────
// STRIPE_SECRET_KEY          → clé secrète Stripe (injectée via supabase secrets set)
// STRIPE_PRICE_SYNORIA_ANNUAL   → price_1... de l'offre annuelle
// STRIPE_PRICE_SYNORIA_6_MONTHS → price_1... de l'offre 6 mois
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY → auto-injectés

const VALID_PRICE_CODES = ['synoria_annual', 'synoria_6_months'] as const
type PriceCode = typeof VALID_PRICE_CODES[number]

const PRICE_MAP: Record<PriceCode, string | undefined> = {
  synoria_annual:   Deno.env.get('STRIPE_PRICE_SYNORIA_ANNUAL'),
  synoria_6_months: Deno.env.get('STRIPE_PRICE_SYNORIA_6_MONTHS'),
}

// ── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // 1. Authentifier l'utilisateur via son JWT Supabase
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
    return json({ error: 'Unauthorized' }, 401)
  }

  // 2. Valider le body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { price_code, success_url, cancel_url } = body as {
    price_code?: string
    success_url?: string
    cancel_url?: string
  }

  // Valider price_code
  if (!price_code) {
    return json({
      error: 'Missing price_code',
      message: 'price_code est requis',
      valid_values: VALID_PRICE_CODES,
    }, 400)
  }

  if (!VALID_PRICE_CODES.includes(price_code as PriceCode)) {
    return json({
      error: 'Invalid price_code',
      message: `"${price_code}" n'est pas un code valide`,
      valid_values: VALID_PRICE_CODES,
      received: price_code,
    }, 400)
  }

  const priceId = PRICE_MAP[price_code as PriceCode]
  if (!priceId) {
    const envKey = `STRIPE_PRICE_${price_code.toUpperCase()}`
    console.error(`[create-checkout-session] Secret manquant : ${envKey}`)
    return json({
      error: 'Price not configured',
      message: `Le secret Supabase "${envKey}" n'est pas défini`,
    }, 500)
  }

  // Valider les URLs (optionnelles — fallback vers SITE_URL si absent)
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://logiciel-synoria.fr'
  const resolvedSuccessUrl = validateUrl(success_url)
    ?? `${siteUrl}/merci?session_id={CHECKOUT_SESSION_ID}`
  const resolvedCancelUrl  = validateUrl(cancel_url)
    ?? `${siteUrl}/paiement-annule`

  // 3. Créer (ou récupérer) l'organisation de l'utilisateur
  const orgResult = await ensureOrganization(user.id, user.email ?? '')
  if (orgResult.error) {
    console.error('[create-checkout-session] Organisation :', orgResult.error)
    return json({ error: 'Failed to provision organization', detail: orgResult.error }, 500)
  }
  const organizationId = orgResult.organizationId

  // 4. Vérifier qu'il n'existe pas déjà un abonnement actif ou en essai
  //    → protège contre les doubles paiements accidentels
  const { data: existingActiveSub } = await supabaseAdmin
    .from('subscriptions')
    .select('status, stripe_subscription_id')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle()

  if (existingActiveSub) {
    console.log(`[create-checkout-session] Abonnement déjà actif (${existingActiveSub.status}) pour org ${organizationId}`)
    return json({
      error:  'ALREADY_SUBSCRIBED',
      status: existingActiveSub.status,
      message: 'Vous avez déjà un abonnement actif. Cliquez sur "J\'ai finalisé mon abonnement" pour accéder à Synoria.',
    }, 409)
  }

  // 5. Créer (ou récupérer) le customer Stripe
  const customerResult = await ensureStripeCustomer(organizationId, user.id, user.email ?? '')
  if (customerResult.error) {
    console.error('[create-checkout-session] Customer Stripe :', customerResult.error)
    return json({ error: 'Failed to create Stripe customer', detail: customerResult.error }, 500)
  }
  const customerId = customerResult.customerId

  // 6. Créer la session Stripe Checkout
  let session
  try {
    session = await stripe.checkout.sessions.create({
      customer: customerId,

      // Mode abonnement avec essai 14 jours
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],

      subscription_data: {
        trial_period_days: 14,
        // Métadonnées sur l'abonnement lui-même (accessibles depuis le webhook)
        metadata: {
          user_id:         user.id,
          organization_id: organizationId,
          plan_code:       price_code,
        },
      },

      // Carte obligatoire immédiatement, même en période d'essai
      payment_method_types: ['card'],
      payment_method_collection: 'always',

      // Métadonnées sur la session (pour checkout.session.completed)
      metadata: {
        user_id:         user.id,
        organization_id: organizationId,
        plan_code:       price_code,
      },

      success_url: resolvedSuccessUrl,
      cancel_url:  resolvedCancelUrl,
      locale: 'fr',
      allow_promotion_codes: true,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[create-checkout-session] Stripe error :', msg)
    return json({ error: 'Stripe error', message: msg }, 500)
  }

  console.log(`[create-checkout-session] Session créée : ${session.id} — org=${organizationId} plan=${price_code}`)

  return json({
    url:        session.url,
    session_id: session.id,
  })
})

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Récupère l'organisation de l'utilisateur.
 * Si elle n'existe pas, la crée avec un membre "owner".
 */
async function ensureOrganization(
  userId: string,
  email: string,
): Promise<{ organizationId: string; error?: string }> {
  // Chercher une organisation existante
  const { data: existingMember } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingMember?.organization_id) {
    return { organizationId: existingMember.organization_id }
  }

  // Créer l'organisation
  const orgName = email.split('@')[0] ?? 'Cabinet Synoria'
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({ name: orgName, owner_user_id: userId })
    .select('id')
    .single()

  if (orgError || !org) {
    return { organizationId: '', error: orgError?.message ?? 'Insert organization failed' }
  }

  // Créer le lien organization_member avec le rôle owner
  const { error: memberError } = await supabaseAdmin
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id:         userId,
      role:            'owner',
    })

  if (memberError) {
    return { organizationId: '', error: `Insert organization_member: ${memberError.message}` }
  }

  // S'assurer qu'une licence existe (le trigger la crée normalement, mais en défense)
  const { data: existingLic } = await supabaseAdmin
    .from('licenses')
    .select('id')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!existingLic) {
    await supabaseAdmin.from('licenses').insert({
      organization_id: org.id,
      status:          'restricted',
      max_devices:     2,
    })
  }

  console.log(`[ensureOrganization] Créée : ${org.id} pour user ${userId}`)
  return { organizationId: org.id }
}

/**
 * Récupère le stripe_customer_id depuis la table subscriptions.
 * Si absent, crée un nouveau customer Stripe et pré-remplit la ligne subscriptions.
 */
async function ensureStripeCustomer(
  organizationId: string,
  userId: string,
  email: string,
): Promise<{ customerId: string; error?: string }> {
  const { data: existingSub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (existingSub?.stripe_customer_id) {
    return { customerId: existingSub.stripe_customer_id }
  }

  // Créer le customer dans Stripe
  let customer
  try {
    customer = await stripe.customers.create({
      email,
      metadata: {
        user_id:         userId,
        organization_id: organizationId,
        source:          'synoria',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { customerId: '', error: `Stripe customer create: ${msg}` }
  }

  // Pré-créer la ligne subscriptions pour que le webhook stripe-webhook puisse l'updater
  const { error: upsertError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      organization_id:   organizationId,
      stripe_customer_id: customer.id,
      status:            'incomplete',
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'organization_id' })

  if (upsertError) {
    console.warn('[ensureStripeCustomer] Upsert subscriptions :', upsertError.message)
    // Non bloquant — le webhook le créera de toute façon
  }

  return { customerId: customer.id }
}

/**
 * Valide une URL : doit être http(s). Retourne null si invalide.
 */
function validateUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
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
