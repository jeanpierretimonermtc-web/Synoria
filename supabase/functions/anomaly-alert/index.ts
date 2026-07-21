/**
 * anomaly-alert — Edge Function Synoria
 *
 * Vérifie les anomalies de licence des dernières 24h et envoie un email
 * récapitulatif via Resend si des événements suspects sont détectés.
 *
 * Déclenchement : cron quotidien configuré dans le dashboard Supabase
 *   Edge Functions → anomaly-alert → Schedules → "0 8 * * *" (8h UTC)
 *
 * Variables d'environnement (secrets Supabase) :
 *   RESEND_API_KEY  — clé API Resend (resend.com, compte gratuit suffisant)
 *   ALERT_EMAIL     — adresse de réception des alertes (défaut : gmail JP)
 */

import { supabaseAdmin }          from '../_shared/supabase-admin.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const ALERT_TO       = Deno.env.get('ALERT_EMAIL')   ?? 'jeanpierre.timoner.mtc@gmail.com'
const FROM           = 'Synoria Alertes <onboarding@resend.dev>'

const EVENT_LABELS: Record<string, string> = {
  device_limit_reached: '⚠️ Limite appareils dépassée',
  invalid_signature:    '🔴 Signature JWT falsifiée',
  revoked:              '🔴 Licence révoquée utilisée',
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  // 1. Récupérer les anomalies via les vues de monitoring
  const [{ data: anomalies }, { data: suspicious }] = await Promise.all([
    supabaseAdmin.from('v_anomaly_checks').select('*'),
    supabaseAdmin.from('v_suspicious_devices').select('*'),
  ])

  const totalAnomalies = (anomalies?.length ?? 0) + (suspicious?.length ?? 0)

  if (totalAnomalies === 0) {
    console.log('[anomaly-alert] ✓ Aucune anomalie détectée.')
    return json({ ok: true, anomalies: 0, message: 'Aucune anomalie détectée.' })
  }

  console.log(`[anomaly-alert] ${totalAnomalies} anomalie(s) — envoi email vers ${ALERT_TO}`)

  if (!RESEND_API_KEY) {
    console.error('[anomaly-alert] RESEND_API_KEY non configurée dans les secrets Supabase.')
    return json({ ok: false, error: 'RESEND_API_KEY manquante' }, 500)
  }

  // 2. Construire l'email HTML
  const reportDate = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  let html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <div style="background:#ef4444;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">🚨 Synoria — Anomalies licence détectées</h2>
        <p style="color:#fecaca;margin:4px 0 0;font-size:13px">Rapport du ${reportDate}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
  `

  // Section : vérifications suspectes
  if ((anomalies?.length ?? 0) > 0) {
    html += `
      <h3 style="font-size:15px;margin:0 0 12px">
        Vérifications suspectes — ${anomalies!.length} événement(s) sur 24h
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Date</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Événement</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Utilisateur</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Version</th>
          </tr>
        </thead>
        <tbody>
    `
    for (const row of anomalies!) {
      const d = new Date(row.verified_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
      const label = EVENT_LABELS[row.result] ?? row.result
      html += `
        <tr>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;color:#6b7280">${d}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:500">${label}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb">${row.user_email}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;color:#6b7280">${row.app_version ?? '—'}</td>
        </tr>
      `
    }
    html += `</tbody></table>`
  }

  // Section : appareils suspects
  if ((suspicious?.length ?? 0) > 0) {
    html += `
      <h3 style="font-size:15px;margin:0 0 12px">
        Activité appareils suspecte — ${suspicious!.length} licence(s) concernée(s)
      </h3>
      <p style="font-size:13px;color:#6b7280;margin:0 0 10px">
        ≥ 3 nouveaux appareils enregistrés en 24h sur la même licence (partage de compte potentiel).
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Organisation</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Utilisateur</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;font-weight:600">Nouveaux appareils (24h)</th>
          </tr>
        </thead>
        <tbody>
    `
    for (const row of suspicious!) {
      html += `
        <tr>
          <td style="padding:7px 10px;border:1px solid #e5e7eb">${row.org_name}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb">${row.user_email}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:700;color:#ef4444">${row.new_devices_24h}</td>
        </tr>
      `
    }
    html += `</tbody></table>`
  }

  html += `
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0 16px">
        <p style="font-size:12px;color:#9ca3af;margin:0">
          Rapport automatique Synoria ·
          <a href="https://supabase.com/dashboard/project/nicyxynczjvoyxaernbr/editor" style="color:#3b82f6;text-decoration:none">
            Ouvrir Supabase SQL Editor
          </a>
        </p>
      </div>
    </div>
  `

  // 3. Envoyer via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    FROM,
      to:      ALERT_TO,
      subject: `🚨 Synoria — ${totalAnomalies} anomalie(s) licence (${reportDate})`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.text()
    console.error('[anomaly-alert] Resend error:', err)
    return json({ ok: false, error: err }, 500)
  }

  return json({ ok: true, anomalies: totalAnomalies, sent_to: ALERT_TO })
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
