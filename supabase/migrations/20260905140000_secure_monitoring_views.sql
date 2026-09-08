-- ============================================================================
-- SEC-2 — Verrouillage des vues de monitoring licence
-- ============================================================================
--
-- Ces vues (v_anomaly_checks, v_suspicious_devices, v_license_dashboard) sont
-- internes au monitoring/licensing Synoria : elles joignent auth.users pour
-- resoudre l'email des utilisateurs et n'ont jamais eu vocation a etre lues
-- par un client de l'application.
--
-- anon et authenticated ne doivent jamais pouvoir les lire, quelle que soit
-- l'evolution future des privileges par defaut du schema public.
--
-- v_anomaly_checks et v_suspicious_devices sont utilisees par l'Edge Function
-- anomaly-alert (cron quotidien), exclusivement via le client service_role
-- (supabaseAdmin) -- voir supabase/functions/anomaly-alert/index.ts et
-- supabase/functions/_shared/supabase-admin.ts.
--
-- v_license_dashboard n'est appelee par aucun code programmatique (usage
-- manuel via le SQL Editor Supabase uniquement) : elle ne recoit donc aucun
-- GRANT service_role ici, conformement a la portee validee de SEC-2.
--
-- Correction correspondant a SEC-2, deja executee et validee manuellement en
-- production le 2026-09-05 (Security Advisor : 0 erreur, anomaly-alert
-- testee avec succes). Cette migration enregistre cette correction dans le
-- depot Git ; elle n'a pas ete reappliquee ni redeployee depuis ce commit.
-- ============================================================================

REVOKE ALL PRIVILEGES
ON TABLE
    public.v_anomaly_checks,
    public.v_suspicious_devices,
    public.v_license_dashboard
FROM PUBLIC;

REVOKE ALL PRIVILEGES
ON TABLE
    public.v_anomaly_checks,
    public.v_suspicious_devices,
    public.v_license_dashboard
FROM anon, authenticated;

GRANT SELECT
ON TABLE
    public.v_anomaly_checks,
    public.v_suspicious_devices
TO service_role;
