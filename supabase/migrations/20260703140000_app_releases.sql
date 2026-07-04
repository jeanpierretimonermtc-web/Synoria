-- Migration : extension de app_releases pour le système release-check
-- La table app_releases existe déjà (migration 20260703120000) avec un schéma
-- simplifié. On l'étend pour supporter les canaux, les plateformes, et les
-- notes de version structurées.
-- Date : 2026-07-03

-- ── 1. Ajout des nouvelles colonnes ───────────────────────────────────────

ALTER TABLE public.app_releases
  ADD COLUMN IF NOT EXISTS channel               text NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS platform              text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS min_supported_version text,
  ADD COLUMN IF NOT EXISTS release_notes         text;

-- ── 2. Renommer les colonnes legacy ───────────────────────────────────────
-- is_mandatory → is_required  /  active → is_active
-- Idempotent via DO block (RENAME échoue si la colonne cible existe déjà).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'app_releases'
      AND column_name  = 'is_mandatory'
  ) THEN
    ALTER TABLE public.app_releases RENAME COLUMN is_mandatory TO is_required;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'app_releases'
      AND column_name  = 'active'
  ) THEN
    ALTER TABLE public.app_releases RENAME COLUMN active TO is_active;
  END IF;
END $$;

-- ── 3. Copier message → release_notes pour les lignes existantes ──────────

UPDATE public.app_releases
  SET release_notes = message
  WHERE release_notes IS NULL AND message IS NOT NULL;

-- ── 4. Supprimer l'ancien index mono-colonne (suit le renommage active → is_active) ──

DROP INDEX IF EXISTS idx_app_releases_active;

-- ── 5. Index de recherche optimisé pour release-check ─────────────────────

CREATE INDEX IF NOT EXISTS idx_app_releases_lookup
  ON public.app_releases (channel, platform, is_active, published_at DESC);

-- ── 6. Politique RLS mise à jour (l'ancienne référençait 'active') ─────────

DROP POLICY IF EXISTS "select active releases" ON public.app_releases;

CREATE POLICY "app_releases_read_active"
  ON public.app_releases
  FOR SELECT
  TO authenticated
  USING (is_active = true);
