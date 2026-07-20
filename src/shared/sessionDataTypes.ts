/**
 * Types canoniques des données de séance (Phase 1 — fondations non-destructives).
 *
 * Ces types décrivent une représentation NORMALISÉE d'une séance, indépendante
 * du format de stockage SQLite historique (colonnes + full_data_json + pluginSchema).
 *
 * Objectif : offrir une structure stable et versionnée que les exports, résumés et
 * futures fonctionnalités (Phase 2+) pourront consommer sans dépendre de la forme
 * exacte des blobs JSON legacy.
 *
 * IMPORTANT : rien ici ne remplace le stockage existant. La normalisation est
 * calculée À LA VOLÉE à partir des données brutes. Aucune donnée n'est jamais
 * supprimée : tout champ inconnu est conservé et signalé par un warning.
 */

/** Version du schéma canonique — incrémentée si la structure ci-dessous évolue. */
export const CANONICAL_SCHEMA_VERSION = '1.0.0'

/** Valeur canonique d'un champ unitaire (Core ou plugin). */
export interface CanonicalFieldValue {
  fieldId: string
  dataKey: string         // clé fonctionnelle stable (ex: "core.motif", "custom.kinesio.douleur")
  type: string            // PluginFieldType ou 'unknown'
  labelSnapshot: string   // libellé au moment de la séance
  value: unknown
  deprecated?: boolean
}

/** Données d'un module complexe (systèmes MTC, langue/pouls, posture ostéo…). */
export interface CanonicalModuleData {
  moduleId: string
  version?: string
  schemaVersion?: string
  data: unknown
}

/** Snapshot du formulaire tel qu'il était au moment de la séance. */
export interface FormSnapshot {
  snapshotVersion: string
  coreVersion: string
  profileId?: string
  profileVersion?: string
  consultationType?: string    // 'initial' | 'follow_up' | 'custom' (Phase 3)
  pluginId?: string
  pluginVersion?: string
  pluginDefinition?: unknown   // copie du PluginDefinition complet (si disponible)
  exportSchemaVersion: string
  createdAt: string
  modules?: Array<{ moduleId: string; version?: string; schemaVersion?: string }>
}

/** Structure canonique complète d'une séance normalisée. */
export interface CanonicalSessionData {
  schemaVersion: string       // CANONICAL_SCHEMA_VERSION
  sessionId: string
  patientId: string
  createdAt: string
  updatedAt?: string

  formProfile: {
    id: string
    version: string
    coreVersion: string
    pluginId?: string
    pluginVersion?: string
  }

  // Champs du Core Synoria (motif, evolution, colonnes SQL directes…)
  core: Record<string, CanonicalFieldValue>

  // Champs du plugin / formulaire spécialité
  fields: Record<string, CanonicalFieldValue>

  // Modules complexes (MTC systèmes, langue/pouls, ostéo posture, tests énergétiques…)
  modules: Record<string, CanonicalModuleData>

  // Snapshot du formulaire tel qu'il était lors de la séance
  formSnapshot: FormSnapshot

  // Métadonnées de normalisation
  normalization: {
    normalizedAt: string
    normalizer: string          // ex: 'sessionDataNormalizer@1.0.0'
    warnings: NormalizationWarning[]
    hadUnknownFields: boolean
    hadUnknownModules: boolean
    sourceFormat: 'legacy_v1' | 'canonical_v1' | 'unknown'
  }
}

/** Avertissement produit lors de la normalisation. */
export interface NormalizationWarning {
  severity: 'warning' | 'error'
  code: string
  message: string
  fieldId?: string
  dataKey?: string
  moduleId?: string
}

/** Problème rencontré lors d'un export. */
export interface ExportIssue {
  severity: 'warning' | 'error'
  code: string
  message: string
  fieldId?: string
  dataKey?: string
  moduleId?: string
}

// ── Identité du Core Synoria ────────────────────────────────────────────────
/** Version logique du Core (champs génériques toujours présents : motif, évolution…). */
export const CORE_VERSION = '1.0.0'

/** Identifiant du profil "core seul" (aucun plugin de spécialité actif). */
export const CORE_PROFILE_ID = 'synoria_core'
