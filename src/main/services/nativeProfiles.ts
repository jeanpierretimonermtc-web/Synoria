/**
 * Profils de séance natifs Synoria (Phase 3).
 *
 * Ces profils sont livrés avec l'application (`isNative: true`) et ne peuvent
 * pas être modifiés ni supprimés — seulement dupliqués. Ils fournissent une
 * base immédiate : générique (première consultation / suivi), MTC et kinésiologie.
 *
 * Les `pluginId` référencés correspondent aux fichiers .plugin.json distribués :
 *   - 'mtc_jp'            (formulaire MTC intégré, useBuiltinForm)
 *   - 'kinesio_charlotte' (plugin kinésiologie)
 */

import {
  CORE_VERSION,
  type SessionFormProfile,
  type CoreProfileConfiguration,
} from '../../shared/sessionProfileTypes'

const NATIVE_TIMESTAMP = '2026-01-01T00:00:00.000Z'

/** Configuration Core "tout activé" par défaut. */
function fullCoreConfig(): CoreProfileConfiguration {
  return { disabledSections: [], customTitles: {}, sectionOrder: [] }
}

function nativeBase(
  partial: Omit<
    SessionFormProfile,
    'version' | 'coreVersion' | 'coreConfiguration' | 'enabledModules'
    | 'isNative' | 'isDefault' | 'createdAt' | 'updatedAt'
  > & Partial<Pick<SessionFormProfile, 'coreConfiguration' | 'enabledModules' | 'isDefault'>>,
): SessionFormProfile {
  return {
    version: '1.0.0',
    coreVersion: CORE_VERSION,
    coreConfiguration: partial.coreConfiguration ?? fullCoreConfig(),
    enabledModules: partial.enabledModules ?? [],
    isNative: true,
    isDefault: partial.isDefault ?? false,
    createdAt: NATIVE_TIMESTAMP,
    updatedAt: NATIVE_TIMESTAMP,
    ...partial,
  }
}

export const NATIVE_PROFILES: SessionFormProfile[] = [
  // ── Générique ─────────────────────────────────────────────────────────────
  nativeBase({
    id: 'synoria.profile.generic.initial',
    name: 'Générique — Première consultation',
    description: 'Formulaire générique pour une première consultation (Core Synoria complet).',
    specialty: 'Générique',
    consultationType: 'initial',
    isDefault: true,
  }),
  nativeBase({
    id: 'synoria.profile.generic.followup',
    name: 'Générique — Suivi',
    description: 'Formulaire générique pour une séance de suivi (avec section évolution).',
    specialty: 'Générique',
    consultationType: 'follow_up',
  }),

  // ── MTC (formulaire intégré) ───────────────────────────────────────────────
  nativeBase({
    id: 'synoria.profile.mtc.initial',
    name: 'MTC — Première consultation',
    description: 'Médecine Traditionnelle Chinoise, première consultation (formulaire intégré).',
    specialty: 'Médecine Traditionnelle Chinoise',
    consultationType: 'initial',
    pluginId: 'mtc_jp',
    pluginVersion: '1.2.0',
    useBuiltinForm: true,
    legacySource: 'builtin_form',
  }),
  nativeBase({
    id: 'synoria.profile.mtc.followup',
    name: 'MTC — Suivi',
    description: 'Médecine Traditionnelle Chinoise, séance de suivi (formulaire intégré).',
    specialty: 'Médecine Traditionnelle Chinoise',
    consultationType: 'follow_up',
    pluginId: 'mtc_jp',
    pluginVersion: '1.2.0',
    useBuiltinForm: true,
    legacySource: 'builtin_form',
  }),

  // ── Kinésiologie ────────────────────────────────────────────────────────────
  nativeBase({
    id: 'synoria.profile.kinesio.standard',
    name: 'Kinésiologie — Séance standard',
    description: 'Kinésiologie : contexte, état psycho-émotionnel, équilibrage.',
    specialty: 'Kinésiologie',
    consultationType: 'custom',
    pluginId: 'kinesio_charlotte',
    pluginVersion: '1.1.0',
  }),
]

/** Retourne une COPIE profonde des profils natifs (jamais les références mutables). */
export function getNativeProfiles(): SessionFormProfile[] {
  return JSON.parse(JSON.stringify(NATIVE_PROFILES)) as SessionFormProfile[]
}
