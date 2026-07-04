/**
 * stripe-webhook — Edge Function Synoria
 *
 * Reçoit les événements Stripe Billing et synchronise les tables
 * subscriptions + licenses dans Supabase.
 *
 * Règles absolues :
 *   • Vérifier la signature STRIPE_WEBHOOK_SECRET avant tout traitement.
 *   • Toujours répondre 200 (erreurs loguées, jamais retransmises à Stripe).
 *   • Ne jamais écrire dans patients / séances / rendez-vous / factures cabinet.
 *   • Toutes les clés sensibles restent dans les secrets Supabase — jamais dans Electron.
 *
 * Variables d'environnement (secrets Supabase) :
 *   STRIPE_SECRET_KEY          — clé secrète Stripe
 *   STRIPE_WEBHOOK_SECRET      — secret de validation signature webhook
 *   SUPABASE_URL               — injecté automatiquement
 *   SUPABASE_ANON_KEY          — injecté automatiquement
 *   SUPABASE_SERVICE_ROLE_KEY  — injecté automatiquement (contourne RLS)
 */

import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { stripe } from '../_shared/stripe.ts'
import Stripe from 'npm:stripe@17'

// ── Enums exacts du schéma SQL ─────────────────────────────────────────────
// Toute valeur hors enum lève une erreur PostgreSQL → on valide ici en amont.

type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'past_due_grace'
  | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused'

// Note : 'cancelled' (double-l) dans licenses vs 'canceled' (simple-l) de Stripe
type LicenseStatus =
  | 'trialing' | 'active' | 'offline_grace' | 'past_due_grace'
  | 'restricted' | 'expired' | 'cancelled' | 'revoked'

// Note : noms en français pour la contrainte CHECK de subscriptions.plan_name
type PlanName = 'synoria_annuel' | 'synoria_6mois' | 'synoria_cabinet'

// ── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return text('Method not allowed', 405)
  }

  // 1. Vérification de la signature Stripe (lecture du body brut obligatoire)
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return text('Missing stripe-signature header', 400)
  }

  const rawBody = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook] ✗ Signature invalide :', msg)
    return text(`Webhook Error: ${msg}`, 400)
  }

  console.log(`[stripe-webhook] ✓ ${event.type}  id=${event.id}`)

  // 2. Dispatch des événements
  try {
    switch (event.type) {

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.paused':
        await handleSubscriptionPaused(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.resumed':
        await handleSubscriptionResumed(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'invoice.finalization_failed':
        await handleInvoiceFinalizationFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`[stripe-webhook] Événement non géré : ${event.type}`)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // On logue mais on répond 200 : Stripe ne doit pas re-livrer les erreurs
    // liées à des données inattendues (org inconnue, etc.)
    console.error(`[stripe-webhook] ✗ Erreur sur ${event.type} :`, msg)
  }

  // 3. Répondre rapidement 200 dans tous les cas
  return json({ received: true, event: event.type })
})

// ── Handlers d'événements ──────────────────────────────────────────────────

/**
 * checkout.session.completed
 *
 * Premier événement reçu après un paiement (ou début d'essai avec carte).
 * Provisionne l'abonnement complet et active la licence.
 * L'organisation doit déjà exister (créée par le trigger handle_new_user
 * à l'inscription ou par create-checkout-session.ensureOrganization).
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const organizationId = session.metadata?.organization_id
  const planCode       = session.metadata?.plan_code

  if (!organizationId) {
    console.error('[checkout.completed] organization_id absent des metadata', { session_id: session.id })
    return
  }
  if (!session.subscription) {
    // Mode one-time — ne concerne pas les abonnements Synoria
    console.warn('[checkout.completed] Session sans subscription (mode one-time ?)', { session_id: session.id })
    return
  }

  const customerId  = session.customer as string
  const stripeSubId = session.subscription as string

  // Récupérer l'abonnement Stripe complet pour avoir les dates de période
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)
  const priceId   = stripeSub.items.data[0]?.price.id ?? null

  const subStatus     = stripeStatusToSubStatus(stripeSub.status)
  const licenseStatus = stripeStatusToLicenseStatus(stripeSub.status)
  const planName      = planCodeToPlanName(planCode)

  // Upsert subscription — la ligne peut déjà exister si create-checkout-session
  // l'a pré-créée avec stripe_customer_id uniquement
  const { data: subRow, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      organization_id:        organizationId,
      stripe_customer_id:     customerId,
      stripe_subscription_id: stripeSubId,
      stripe_price_id:        priceId,
      plan_name:              planName,
      status:                 subStatus,
      trial_end: stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000).toISOString()
        : null,
      current_period_end:   new Date(stripeSub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSub.cancel_at_period_end,
    }, { onConflict: 'organization_id' })
    .select('id')
    .single()

  if (subError) {
    console.error('[checkout.completed] Upsert subscription :', subError.message)
    throw new Error(subError.message)
  }

  // Activer la licence et la relier à la subscription
  await updateLicense(organizationId, licenseStatus, null, subRow?.id ?? null)

  console.log(
    `[checkout.completed] ✓ org=${organizationId} plan=${planName ?? planCode ?? '?'} ` +
    `sub_status=${subStatus} lic=${licenseStatus}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.created
 *
 * Peut arriver avant checkout.session.completed selon l'ordre de livraison
 * des webhooks. Idempotent grâce au upsert.
 */
async function handleSubscriptionCreated(sub: Stripe.Subscription): Promise<void> {
  const organizationId = await resolveOrgFromSubscription(sub)
  if (!organizationId) {
    console.warn('[sub.created] Organisation non trouvée pour sub', sub.id)
    return
  }

  const priceId   = sub.items.data[0]?.price.id ?? null
  const subStatus = stripeStatusToSubStatus(sub.status)
  const licStatus = stripeStatusToLicenseStatus(sub.status)

  await upsertSubscriptionRow(organizationId, sub, priceId, subStatus)
  await updateLicense(organizationId, licStatus, null, null)

  console.log(`[sub.created] ✓ org=${organizationId} sub=${subStatus} lic=${licStatus}`)
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.updated
 *
 * Synchronise le statut, le prix, les dates, et cancel_at_period_end.
 *
 * Règle métier clé :
 *   Si cancel_at_period_end=true, l'accès N'EST PAS coupé immédiatement.
 *   La licence reste active/trialing jusqu'à customer.subscription.deleted
 *   qui arrivera à la fin de la période payée.
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const organizationId = await resolveOrgFromSubscription(sub)
  if (!organizationId) {
    console.warn('[sub.updated] Organisation non trouvée pour sub', sub.id)
    return
  }

  const priceId   = sub.items.data[0]?.price.id ?? null
  const subStatus = stripeStatusToSubStatus(sub.status)
  const licStatus = stripeStatusToLicenseStatus(sub.status)

  // Mise à jour de la subscription (toutes les colonnes synchronisées)
  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .update({
      stripe_price_id:      priceId,
      plan_name:            planCodeToPlanName(sub.metadata?.plan_code),
      status:               subStatus,
      trial_end: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
      current_period_end:   new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq('stripe_subscription_id', sub.id)

  if (subError) {
    console.error('[sub.updated] Update subscription :', subError.message)
    throw new Error(subError.message)
  }

  // Licence : pas de restriction anticipée si cancel_at_period_end=true
  // (la restriction viendra avec subscription.deleted à la fin de période)
  const graceUntil = sub.status === 'past_due' ? gracePlus7d() : null
  await updateLicense(organizationId, licStatus, graceUntil, null)

  console.log(
    `[sub.updated] ✓ org=${organizationId} sub=${subStatus} lic=${licStatus} ` +
    `cancel_at_end=${sub.cancel_at_period_end}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.deleted
 *
 * L'abonnement est terminé (immédiatement ou à la fin de la période payée
 * selon cancel_at_period_end).
 *
 * Règle : si current_period_end est encore dans le futur (annulation
 * immédiate d'un abonnement payé), la licence passe à 'cancelled'
 * (verify-license peut encore émettre un jeton valide jusqu'à cette date).
 * Sinon : 'restricted' (accès coupé).
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const organizationId = await resolveOrgFromSubscription(sub)
  if (!organizationId) {
    console.warn('[sub.deleted] Organisation non trouvée pour sub', sub.id)
    return
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', sub.id)

  // 'cancelled' (access window still open) vs 'restricted' (access terminated)
  const periodEndMs = sub.current_period_end * 1000
  const licStatus: LicenseStatus = periodEndMs > Date.now() ? 'cancelled' : 'restricted'

  await updateLicense(organizationId, licStatus, null, null)

  console.log(
    `[sub.deleted] ✓ org=${organizationId} → sub=canceled lic=${licStatus} ` +
    `(period_end=${new Date(periodEndMs).toISOString()})`,
  )
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.paused
 *
 * Stripe a mis l'abonnement en pause (fonctionnalité Stripe Billing).
 * L'accès est coupé immédiatement.
 */
async function handleSubscriptionPaused(sub: Stripe.Subscription): Promise<void> {
  const organizationId = await resolveOrgFromSubscription(sub)
  if (!organizationId) return

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'paused' })
    .eq('stripe_subscription_id', sub.id)

  await updateLicense(organizationId, 'restricted', null, null)

  console.log(`[sub.paused] ✓ org=${organizationId} → lic=restricted`)
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.resumed
 *
 * L'abonnement reprend après une pause.
 */
async function handleSubscriptionResumed(sub: Stripe.Subscription): Promise<void> {
  const organizationId = await resolveOrgFromSubscription(sub)
  if (!organizationId) return

  const priceId   = sub.items.data[0]?.price.id ?? null
  const subStatus = stripeStatusToSubStatus(sub.status)
  const licStatus = stripeStatusToLicenseStatus(sub.status)

  await upsertSubscriptionRow(organizationId, sub, priceId, subStatus)
  await updateLicense(organizationId, licStatus, null, null)

  console.log(`[sub.resumed] ✓ org=${organizationId} → sub=${subStatus} lic=${licStatus}`)
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.trial_will_end
 *
 * Notification préventive : l'essai se termine dans 3 jours (envoyé par Stripe).
 * Ne pas bloquer l'accès — l'essai est encore actif.
 * Journalisé uniquement ; une notification in-app peut être ajoutée en v2.
 */
async function handleTrialWillEnd(sub: Stripe.Subscription): Promise<void> {
  const organizationId = await resolveOrgFromSubscription(sub)
  const trialEndStr = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : 'inconnu'

  console.log(
    `[trial.will_end] ℹ org=${organizationId ?? '?'} sub=${sub.id} ` +
    `trial_end=${trialEndStr} — accès maintenu, aucune action DB`,
  )
  // TODO v2 : stocker un flag "trial_ending_soon" pour notification in-app
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * invoice.paid
 *
 * Paiement réussi (renouvellement mensuel/annuel, conversion essai→payant).
 * Remet la licence à 'active' et efface la grâce éventuelle.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const { organizationId, stripeSubId } = await resolveOrgFromInvoice(invoice)
  if (!organizationId) {
    console.warn('[invoice.paid] Organisation non trouvée pour invoice', invoice.id)
    return
  }

  if (stripeSubId) {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status:             'active',
        current_period_end: new Date(invoice.period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubId)
  }

  // Sortie de grâce : grace_until = null, licence active
  await updateLicense(organizationId, 'active', null, null)

  console.log(`[invoice.paid] ✓ org=${organizationId} → lic=active`)
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * invoice.payment_failed
 *
 * Échec de paiement. Stripe retentera automatiquement.
 * Règles :
 *   • subscriptions.status = 'past_due_grace'
 *   • licenses.status = 'past_due_grace', grace_until = maintenant + 7 jours
 *   • Ne pas restreindre immédiatement
 *   • grace_until n'est pas repoussé si déjà défini (idempotence multi-tentatives)
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const { organizationId, stripeSubId } = await resolveOrgFromInvoice(invoice)
  if (!organizationId) {
    console.warn('[invoice.payment_failed] Organisation non trouvée pour invoice', invoice.id)
    return
  }

  if (stripeSubId) {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'past_due_grace' })
      .eq('stripe_subscription_id', stripeSubId)
  }

  // Idempotence : ne pas repousser grace_until à chaque tentative Stripe
  const { data: lic } = await supabaseAdmin
    .from('licenses')
    .select('grace_until, status')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!lic?.grace_until) {
    const newGrace = gracePlus7d()
    await updateLicense(organizationId, 'past_due_grace', newGrace, null)
    console.log(`[invoice.payment_failed] ✓ org=${organizationId} → past_due_grace jusqu'au ${newGrace}`)
  } else {
    console.log(
      `[invoice.payment_failed] org=${organizationId} déjà en grâce jusqu'au ${lic.grace_until} ` +
      '(grace_until non repoussé)',
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * invoice.finalization_failed
 *
 * Stripe ne peut pas finaliser la facture (erreur fiscale, adresse invalide…).
 * Traité comme un avertissement préventif : si la licence était active,
 * on passe en grâce 7 jours le temps que l'utilisateur corrige ses infos.
 */
async function handleInvoiceFinalizationFailed(invoice: Stripe.Invoice): Promise<void> {
  const { organizationId, stripeSubId } = await resolveOrgFromInvoice(invoice)
  if (!organizationId) {
    console.warn('[invoice.finalization_failed] Organisation non trouvée pour invoice', invoice.id)
    return
  }

  const { data: lic } = await supabaseAdmin
    .from('licenses')
    .select('grace_until, status')
    .eq('organization_id', organizationId)
    .maybeSingle()

  const currentStatus = lic?.status as LicenseStatus | undefined

  // N'escalader que si l'accès était actif (éviter de repasser un état déjà restreint)
  if (currentStatus === 'active' || currentStatus === 'trialing') {
    if (!lic?.grace_until) {
      const newGrace = gracePlus7d()
      await updateLicense(organizationId, 'past_due_grace', newGrace, null)
      if (stripeSubId) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'past_due_grace' })
          .eq('stripe_subscription_id', stripeSubId)
      }
      console.log(`[invoice.finalization_failed] ✓ org=${organizationId} → past_due_grace +7j`)
    } else {
      console.log(`[invoice.finalization_failed] org=${organizationId} déjà en grâce — inchangé`)
    }
  } else {
    console.log(
      `[invoice.finalization_failed] org=${organizationId} statut=${currentStatus ?? '?'} ` +
      '— aucune escalade nécessaire',
    )
  }
}

// ── Helpers base de données ────────────────────────────────────────────────

/**
 * Upsert d'une ligne subscriptions à partir d'un objet Stripe.Subscription.
 * Utilise organization_id comme clé de conflit (1 subscription par org en V1).
 */
async function upsertSubscriptionRow(
  organizationId: string,
  sub: Stripe.Subscription,
  priceId: string | null,
  status: SubscriptionStatus,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      organization_id:        organizationId,
      stripe_customer_id:     sub.customer as string,
      stripe_subscription_id: sub.id,
      stripe_price_id:        priceId,
      plan_name:              planCodeToPlanName(sub.metadata?.plan_code),
      status,
      trial_end: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
      current_period_end:   new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    }, { onConflict: 'organization_id' })

  if (error) throw new Error(`upsertSubscriptionRow: ${error.message}`)
}

/**
 * Met à jour la ligne licenses d'une organisation.
 *
 * @param organizationId  UUID de l'organisation
 * @param status          Nouveau statut de licence (enum licenses.status)
 * @param graceUntil      Date limite de grâce ISO ou null (efface la grâce si null)
 * @param subscriptionId  UUID interne de la subscription (seulement au checkout) ou null
 */
async function updateLicense(
  organizationId: string,
  status: LicenseStatus,
  graceUntil: string | null,
  subscriptionId: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = { status, grace_until: graceUntil }
  if (subscriptionId !== null) patch.subscription_id = subscriptionId

  const { error } = await supabaseAdmin
    .from('licenses')
    .update(patch)
    .eq('organization_id', organizationId)

  if (error) throw new Error(`updateLicense: ${error.message}`)
}

// ── Résolution d'organisation ──────────────────────────────────────────────

/**
 * Trouve l'organization_id à partir d'un objet Stripe.Subscription.
 * Stratégie en cascade :
 *   1. sub.metadata.organization_id (défini par create-checkout-session)
 *   2. lookup par stripe_subscription_id dans notre table
 *   3. lookup par stripe_customer_id (fallback moins précis)
 */
async function resolveOrgFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.organization_id) {
    return sub.metadata.organization_id
  }

  const { data: bySubId } = await supabaseAdmin
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()

  if (bySubId?.organization_id) return bySubId.organization_id

  const { data: byCustomerId } = await supabaseAdmin
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', sub.customer as string)
    .maybeSingle()

  return byCustomerId?.organization_id ?? null
}

/**
 * Trouve l'organization_id à partir d'un objet Stripe.Invoice.
 * Lookup via stripe_subscription_id, qui est toujours connu pour les
 * factures d'abonnement Synoria.
 */
async function resolveOrgFromInvoice(
  invoice: Stripe.Invoice,
): Promise<{ organizationId: string | null; stripeSubId: string | null }> {
  // invoice.subscription peut être string | Stripe.Subscription | null selon expansion
  const stripeSubId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : (invoice.subscription as Stripe.Subscription | null)?.id ?? null

  if (!stripeSubId) {
    return { organizationId: null, stripeSubId: null }
  }

  const { data: row } = await supabaseAdmin
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle()

  return { organizationId: row?.organization_id ?? null, stripeSubId }
}

// ── Mapping statuts Stripe → enums Supabase ────────────────────────────────

/**
 * Stripe subscription status → subscriptions.status (enum SQL)
 */
function stripeStatusToSubStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'trialing':           return 'trialing'
    case 'active':             return 'active'
    case 'past_due':           return 'past_due'
    case 'canceled':           return 'canceled'
    case 'unpaid':             return 'unpaid'
    case 'incomplete':         return 'incomplete'
    case 'incomplete_expired': return 'incomplete_expired'
    case 'paused':             return 'paused'
    default:
      console.warn(`[stripe-webhook] Statut Stripe inconnu : "${status}" → 'incomplete'`)
      return 'incomplete'
  }
}

/**
 * Stripe subscription status → licenses.status (enum SQL)
 *
 * Correspondances :
 *   trialing         → trialing         (essai en cours, accès complet)
 *   active           → active           (abonnement payé, accès complet)
 *   past_due         → past_due_grace   (échec paiement, 7j de grâce)
 *   canceled/paused  → cancelled        (accès conditionnel à current_period_end)
 *   unpaid/autres    → restricted       (accès bloqué)
 */
function stripeStatusToLicenseStatus(status: string): LicenseStatus {
  switch (status) {
    case 'trialing':  return 'trialing'
    case 'active':    return 'active'
    case 'past_due':  return 'past_due_grace'
    case 'canceled':  return 'cancelled'
    case 'paused':    return 'restricted'
    case 'unpaid':    return 'restricted'
    default:          return 'restricted'
  }
}

/**
 * price_code Synoria (depuis metadata Stripe) → plan_name SQL
 *
 * price_code (anglais, envoyé par Electron) → plan_name (français, enum SQL)
 *   'synoria_annual'   → 'synoria_annuel'
 *   'synoria_6_months' → 'synoria_6mois'
 */
function planCodeToPlanName(code: string | undefined | null): PlanName | null {
  switch (code) {
    case 'synoria_annual':   return 'synoria_annuel'
    case 'synoria_6_months': return 'synoria_6mois'
    default:                 return null
  }
}

// ── Utilitaires ────────────────────────────────────────────────────────────

/** Retourne l'ISO de maintenant + 7 jours (délai de grâce standard). */
function gracePlus7d(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function text(msg: string, status: number): Response {
  return new Response(msg, { status })
}
