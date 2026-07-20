import React, { useState, useEffect } from 'react'
import type { PluginCondition, PluginDefinition, PluginSection, PluginField } from '../../../shared/pluginTypes'
import RichTextArea from '../common/RichTextArea'
import MtcSystemesModule     from './modules/MtcSystemesModule'
import MtcFiveElementsModule  from './modules/MtcFiveElementsModule'
import MtcTonguePulseModule   from './modules/MtcTonguePulseModule'
import OsteoOrthoTestsModule  from './modules/OsteoOrthoTestsModule'
import OsteoPostureModule     from './modules/OsteoPostureModule'
import { getAnatomyImages } from '../../assets/bodycharts/bodychartImages.generated'

function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  )
  useEffect(() => {
    const handler = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    window.addEventListener('synoria-theme-change', handler)
    return () => window.removeEventListener('synoria-theme-change', handler)
  }, [])
  return dark
}

function evaluateCondition(condition: PluginCondition, data: Record<string, any>): boolean {
  const currentValue = data[condition.fieldId]
  const operator = condition.operator || 'truthy'

  switch (operator) {
    case 'eq':
      return currentValue === condition.value
    case 'neq':
      return currentValue !== condition.value
    case 'includes':
      if (Array.isArray(currentValue)) return currentValue.includes(condition.value)
      if (typeof currentValue === 'string' && typeof condition.value === 'string') return currentValue.includes(condition.value)
      return false
    case 'excludes':
      if (Array.isArray(currentValue)) return !currentValue.includes(condition.value)
      if (typeof currentValue === 'string' && typeof condition.value === 'string') return !currentValue.includes(condition.value)
      return false
    case 'falsy':
      return !currentValue
    case 'truthy':
    default:
      return !!currentValue
  }
}

function isVisible(conditions: PluginCondition[] | undefined, data: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(condition => evaluateCondition(condition, data))
}

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

interface RendererProps {
  plugin: PluginDefinition
  data: Record<string, any>
  onChange: (id: string, value: any) => void
  /** Si fourni, rend uniquement ces sections (sans en-tête plugin). */
  sections?: import('../../../shared/pluginTypes').PluginSection[]
  /** Si true, rend chaque section comme un bloc core (card + card-title) au lieu du style plugin gradient. */
  asCard?: boolean
  /** Numéro de bloc affiché devant le titre de la première section (uniquement avec asCard). */
  sectionNumber?: number
  /** Si true, rend les sections en sous-section inline (sans carte enveloppante — à utiliser à l'intérieur d'une card parente). */
  inline?: boolean
}

export default function PluginFormRenderer({ plugin, data, onChange, sections: sectionsOverride, asCard, sectionNumber, inline }: RendererProps) {
  const sectionsToRender = sectionsOverride ?? plugin.sections
  const showHeader = !sectionsOverride

  const fieldCount = sectionsToRender.reduce(
    (total, section) => total + section.fields.filter(field => field.type !== 'separator').length,
    0
  )
  const accent = plugin.accentColor || 'var(--accent)'

  return (
    <div
      className="plugin-form"
      style={{ '--plugin-accent': accent } as React.CSSProperties}
    >
      {showHeader && (
        <div className="plugin-form-overview">
          <div className="plugin-form-badge">{plugin.icon || 'Plugin'}</div>
          <div className="plugin-form-copy">
            <div className="plugin-form-kicker">{plugin.specialty}</div>
            <h3>{plugin.name}</h3>
            {plugin.description && <p>{plugin.description}</p>}
          </div>
          <div className="plugin-form-meta">
            <span>{plugin.sections.length} sections</span>
            <span>{fieldCount} champs</span>
            <span>v{plugin.version}</span>
          </div>
        </div>
      )}

      {sectionsToRender
        .filter(section => isVisible(section.visibleWhen, data))
        .map((section, idx) => (
          <PluginSectionCard
            key={section.id}
            section={section}
            data={data}
            onChange={onChange}
            asCard={asCard}
            inline={inline}
            sectionNumber={asCard && idx === 0 ? sectionNumber : undefined}
          />
        ))}
    </div>
  )
}

// ── SECTION ────────────────────────────────────────────────────────────────

function PluginSectionCard({ section, data, onChange, asCard, inline, sectionNumber }: {
  section: PluginSection
  data: Record<string, any>
  onChange: (id: string, value: any) => void
  asCard?: boolean
  inline?: boolean
  sectionNumber?: number
}) {
  const accent = section.accentColor || 'var(--accent)'

  if (inline) {
    return (
      <div
        className="plugin-section-inline"
        style={{ '--ps-inline-color': accent } as React.CSSProperties}
      >
        <div className="plugin-section-inline-title">
          {section.icon && (
            <span className="plugin-section-inline-icon">{section.icon}</span>
          )}
          {section.title}
        </div>
        <FieldsGrid fields={section.fields} data={data} onChange={onChange} />
      </div>
    )
  }

  if (asCard) {
    return (
      <div className="card" id={`sec-plugin-${section.id}`} style={{ borderLeft: `4px solid ${accent}` }}>
        <div className="card-title">
          {section.icon && (
            <span
              className="card-title-icon plugin-section-icon"
              style={{ '--psi-color': accent } as React.CSSProperties}
            >
              {section.icon}
            </span>
          )}
          <span>{sectionNumber != null ? `${sectionNumber}. ${section.title}` : section.title}</span>
        </div>
        <FieldsGrid fields={section.fields} data={data} onChange={onChange} />
      </div>
    )
  }

  return (
    <div className="card plugin-card" id={`sec-plugin-${section.id}`} style={{ borderLeft: `4px solid ${accent}` }}>
      <div
        className="plugin-section-header"
        style={{ '--ph-accent': accent } as React.CSSProperties}
      >
        {section.icon && (
          <span className="sec-icon-wrap">{section.icon}</span>
        )}
        <span className="sec-label">{section.title}</span>
      </div>
      <div className="plugin-section-body">
        <FieldsGrid fields={section.fields} data={data} onChange={onChange} />
      </div>
    </div>
  )
}

// ── GRILLE DE CHAMPS ───────────────────────────────────────────────────────
// Regroupe les champs en lignes selon leur width (third/half/full).
// Règle : 3 colonnes de base. "third" = 1 col, "half" = 1.5 col (on arrondit
// à 2 col avec grid2), "full"/undefined = 3 col (pleine largeur).

function FieldsGrid({ fields, data, onChange }: {
  fields: PluginField[]
  data: Record<string, any>
  onChange: (id: string, value: any) => void
}) {
  const visibleFields = fields.filter(field => isVisible(field.visibleWhen, data))

  // ── Regroupement ─────────────────────────────────────────────────────────
  // Règles :
  //   "full" (défaut)  → rangée seule, largeur 100 %
  //   "half"           → jusqu'à 2 par rangée (grid2), sinon seul = 100 %
  //   "third"          → jusqu'à 3 par rangée (grid3), sinon seul = 100 %
  //   Mélanger half+third dans la même rangée n'est pas supporté → chacun seul

  const rows: PluginField[][] = []
  let currentRow: PluginField[] = []
  let currentWidth: 'half' | 'third' | null = null

  const flush = () => {
    if (currentRow.length) { rows.push(currentRow); currentRow = []; currentWidth = null }
  }

  for (const field of visibleFields) {
    if (field.type === 'separator') { flush(); rows.push([field]); continue }

    const w = field.width || 'full'

    if (w === 'full') {
      flush()
      rows.push([field])
      continue
    }

    // Changement de largeur dans la rangée → nouvelle rangée
    if (currentWidth !== null && currentWidth !== w) flush()

    currentWidth = w as 'half' | 'third'
    currentRow.push(field)

    // Rangée complète : 2 halves ou 3 thirds
    if ((w === 'half' && currentRow.length >= 2) || (w === 'third' && currentRow.length >= 3)) flush()
  }
  flush()

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <>
      {rows.map((r, i) => {
        // Séparateur
        if (r.length === 1 && r[0].type === 'separator') {
          return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0' }} />
        }

        // Champ seul (quelle que soit sa largeur déclarée) → pleine largeur
        if (r.length === 1) {
          return (
            <div key={i} className="field">
              <FieldWrapper field={r[0]} data={data} onChange={onChange} />
            </div>
          )
        }

        // Multi-colonnes : grid2 pour les halves, grid3 pour les thirds
        const gridClass = (r[0].width === 'third') ? 'grid3' : 'grid2'
        return (
          <div key={i} className={gridClass}>
            {r.map(f => (
              f.type === 'mtc_aide_interrogatoire' ? (
                <FieldWrapper key={f.id} field={f} data={data} onChange={onChange} />
              ) : (
                <div key={f.id} className="field">
                  <FieldWrapper field={f} data={data} onChange={onChange} />
                </div>
              )
            ))}
          </div>
        )
      })}
    </>
  )
}

// ── WRAPPER CHAMP (label + hint) ───────────────────────────────────────────

function FieldWrapper({ field, data, onChange }: {
  field: PluginField
  data: Record<string, any>
  onChange: (id: string, value: any) => void
}) {
  // Aide-mémoire : display-only, pas de label, pas de wrapper field
  if (field.type === 'mtc_aide_interrogatoire') {
    return <DynamicField field={field} value={undefined} onChange={() => {}} />
  }

  // Checkbox inline (le label fait partie du composant)
  if (field.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginTop: 4 }}>
        <input
          type="checkbox"
          checked={!!data[field.id]}
          onChange={e => onChange(field.id, e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }}
        />
        <span style={{ fontWeight: 500 }}>
          {field.label}
          {field.required && <span style={{ color: 'var(--red)' }}> *</span>}
        </span>
        {field.hint && <span style={{ fontSize: 11, color: 'var(--text-hint)', fontStyle: 'italic' }}>— {field.hint}</span>}
      </label>
    )
  }

  return (
    <>
      <label>
        {field.label}
        {field.required && <span style={{ color: 'var(--red)' }}> *</span>}
      </label>
      {field.hint && <div className="hint">{field.hint}</div>}
      <DynamicField field={field} value={data[field.id]} onChange={v => onChange(field.id, v)} />
    </>
  )
}

// ── PENSE-BÊTE INTERROGATOIRE MTC ─────────────────────────────────────────

const MTC_AIDE_ITEMS = [
  { icon: '🌡',  label: 'Froid / Chaleur',  hint: 'Sensation générale, préférence thermique, membres froids' },
  { icon: '🚽',  label: 'Selles / Urine',   hint: 'Fréquence, consistance, couleur, brûlures' },
  { icon: '💧',  label: 'Soif / Boisson',   hint: 'Quantité, préférence chaud/froid, bouche sèche' },
  { icon: '😴',  label: 'Sommeil',           hint: 'Durée, endormissement, réveils, rêves' },
  { icon: '🗡',  label: 'Tête',              hint: 'Maux de tête, vertiges, acouphènes, vision' },
  { icon: '💦',  label: 'Transpiration',     hint: 'Diurne, nocturne, localisée, spontanée' },
  { icon: '🦴',  label: 'Membres',           hint: 'Douleurs, engourdissements, lourdeurs, tremblements' },
  { icon: '🫙',  label: 'Digestif',          hint: 'Appétit, ballonnements, nausées, reflux' },
]

function MtcAideInterrogatoire({ label }: { label?: string }) {
  return (
    <div className="anamnese-pensebete" style={{ position: 'static', margin: 0 }}>
      <div className="pensebete-title">{label || '📌 Questions à poser'}</div>
      {MTC_AIDE_ITEMS.map(({ icon, label: l, hint }) => (
        <div key={l} className="pensebete-item">
          <div className="pensebete-item-header">
            <span className="pensebete-icon">{icon}</span>
            <span className="pensebete-label">{l}</span>
          </div>
          <div className="pensebete-hint">{hint}</div>
        </div>
      ))}
    </div>
  )
}

// ── RENDU D'UN CHAMP PAR TYPE ──────────────────────────────────────────────

function DynamicField({ field, value, onChange }: {
  field: PluginField
  value: any
  onChange: (v: any) => void
}) {
  switch (field.type) {

    case 'text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )

    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={{ minHeight: field.minHeight || 80, resize: 'vertical' }}
        />
      )

    case 'richtext':
      return (
        <RichTextArea
          value={value || ''}
          onChange={onChange}
          placeholder={field.placeholder}
          minHeight={field.minHeight || 80}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'select':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">— Choisir —</option>
          {(field.options || []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )

    case 'radio':
      return (
        <div className="plugin-radio-group">
          {(field.options || []).map(o => (
            <button
              key={o}
              type="button"
              className={`plugin-radio-option${value === o ? ' active' : ''}`}
              onClick={() => onChange(value === o ? '' : o)}
              aria-pressed={value === o}
            >
              {o}
            </button>
          ))}
        </div>
      )

    case 'checkboxgroup': {
      const sel: string[] = Array.isArray(value) ? value : []
      return (
        <div className="plugin-checkbox-group">
          {(field.options || []).map(o => {
            const checked = sel.includes(o)
            return (
              <button
                key={o}
                type="button"
                className={`plugin-checkbox-option${checked ? ' active' : ''}`}
                onClick={() => onChange(checked ? sel.filter(s => s !== o) : [...sel, o])}
                aria-pressed={checked}
              >
                {o}
              </button>
            )
          })}
        </div>
      )
    }

    case 'tags':
      return <TagsField value={Array.isArray(value) ? value : []} onChange={onChange} placeholder={field.placeholder} />

    case 'rating':
      return <RatingField value={value} onChange={onChange} min={field.min ?? 0} max={field.max ?? 10} />

    case 'slider':
      return <SliderField value={value} onChange={onChange} min={field.min ?? 0} max={field.max ?? 10} step={field.step ?? 1} />

    case 'before_after':
      return <BeforeAfterField value={value} onChange={onChange} min={field.min ?? 0} max={field.max ?? 10} step={field.step ?? 1} />

    case 'repeatable':
      return <RepeatableField value={value} onChange={onChange} />

    case 'bodychart':
      return <BodyChartField value={value} onChange={onChange} />

    // ── Aide-mémoire MTC ──────────────────────────────────────────────────────
    case 'mtc_aide_interrogatoire':
      return <MtcAideInterrogatoire label={field.label} />

    // ── Modules MTC ──────────────────────────────────────────────────────────
    case 'mtc_systemes':
      return <MtcSystemesModule value={value} onChange={onChange} />

    case 'mtc_five_elements':
      return <MtcFiveElementsModule value={value} onChange={onChange} />

    case 'mtc_tongue_pulse':
      return <MtcTonguePulseModule value={value} onChange={onChange} />

    // ── Modules Ostéo ─────────────────────────────────────────────────────────
    case 'osteo_ortho_tests':
      return <OsteoOrthoTestsModule value={value} onChange={onChange} />

    case 'osteo_posture':
      return <OsteoPostureModule value={value} onChange={onChange} />

    default:
      return null
  }
}

type BodyChartSide = 'front' | 'back' | 'left' | 'right'

interface BodyChartValue {
  front?: string[]
  back?: string[]
  left?: string[]
  right?: string[]
  notes?: string
  details?: Record<string, BodyChartZoneDetail>
}

interface BodyChartZoneDetail {
  intensity?: number
  symptom?: string
  laterality?: string
  note?: string
}

const BODY_CHART_SIDES: BodyChartSide[] = ['front', 'back', 'left', 'right']

const BODY_CHART_VIEW_META: Record<BodyChartSide, { label: string; shortLabel: string; panelLabel: string; anatomy: string }> = {
  front: { label: 'Vue anterieure', shortLabel: 'ANT', panelLabel: 'Zones anterieures', anatomy: 'Plan frontal' },
  back: { label: 'Vue posterieure', shortLabel: 'POST', panelLabel: 'Zones posterieures', anatomy: 'Rachis et ceinture scapulaire' },
  left: { label: 'Profil gauche', shortLabel: 'GAU', panelLabel: 'Zones laterales gauches', anatomy: 'Profil gauche' },
  right: { label: 'Profil droit', shortLabel: 'DRO', panelLabel: 'Zones laterales droites', anatomy: 'Profil droit' },
}

const BODY_CHART_ZONES: Record<BodyChartSide, string[]> = {
  front: [
    'Tête / visage', 'Cervical antérieur', 'Thorax', 'Abdomen',
    'Épaule droite', 'Épaule gauche', 'Coude droit', 'Coude gauche',
    'Poignet / main droite', 'Poignet / main gauche', 'Bassin / pubis',
    'Hanche droite', 'Hanche gauche', 'Genou droit', 'Genou gauche',
    'Cheville / pied droit', 'Cheville / pied gauche',
  ],
  back: [
    'Crâne / occiput', 'Cervical postérieur', 'Dorsal haut', 'Dorsal bas',
    'Lombaire', 'Sacrum / coccyx', 'Omoplate droite', 'Omoplate gauche',
    'Épaule droite postérieure', 'Épaule gauche postérieure',
    'Membre supérieur droit', 'Membre supérieur gauche',
    'Fesse / SI droite', 'Fesse / SI gauche', 'Ischio-jambiers droits',
    'Ischio-jambiers gauches', 'Mollet / pied droit', 'Mollet / pied gauche',
  ],
  left: [
    'Temporal / ATM gauche', 'Cervical gauche', 'Epaule gauche laterale', 'Thorax gauche',
    'Coude gauche lateral', 'Poignet / main gauche', 'Bassin gauche', 'Hanche gauche',
    'Genou gauche lateral', 'Cheville / pied gauche', 'Chaine posterieure gauche',
    'Chaine anterieure gauche',
  ],
  right: [
    'Temporal / ATM droit', 'Cervical droit', 'Epaule droite laterale', 'Thorax droit',
    'Coude droit lateral', 'Poignet / main droit', 'Bassin droit', 'Hanche droite',
    'Genou droit lateral', 'Cheville / pied droit', 'Chaine posterieure droite',
    'Chaine anterieure droite',
  ],
}

const BODY_CHART_ZONE_POSITIONS: Record<BodyChartSide, { x: number; y: number }[]> = {
  front: [
    { x: 50, y: 9 }, { x: 50, y: 18 }, { x: 50, y: 27 }, { x: 50, y: 36 },
    { x: 33, y: 22 }, { x: 67, y: 22 }, { x: 24, y: 35 }, { x: 76, y: 35 },
    { x: 12, y: 49 }, { x: 88, y: 49 }, { x: 50, y: 49 },
    { x: 39, y: 52 }, { x: 61, y: 52 }, { x: 38, y: 69 }, { x: 62, y: 69 },
    { x: 37, y: 92 }, { x: 63, y: 92 },
  ],
  back: [
    { x: 50, y: 8 }, { x: 50, y: 16 }, { x: 50, y: 27 }, { x: 50, y: 36 },
    { x: 50, y: 45 }, { x: 50, y: 51 }, { x: 35, y: 24 }, { x: 65, y: 24 },
    { x: 25, y: 25 }, { x: 75, y: 25 }, { x: 15, y: 45 }, { x: 85, y: 45 },
    { x: 42, y: 52 }, { x: 58, y: 52 }, { x: 40, y: 66 }, { x: 60, y: 66 },
    { x: 38, y: 91 }, { x: 62, y: 91 },
  ],
  left: [
    // figure facing LEFT : low-x = antérieur, high-x = postérieur
    { x: 53, y: 7  }, // 1  Temporal / ATM gauche
    { x: 52, y: 15 }, // 2  Cervical gauche
    { x: 56, y: 21 }, // 3  Épaule (articulation gléno-humérale, postérieure)
    { x: 46, y: 29 }, // 4  Thorax latéral (centré sur la cage thoracique visible)
    { x: 58, y: 40 }, // 5  Coude (olécrane postérieur)
    { x: 46, y: 52 }, // 6  Poignet (main en avant de la hanche, antérieur)
    { x: 41, y: 49 }, // 7  Bassin (crête iliaque, plus en avant)
    { x: 60, y: 51 }, // 8  Hanche (grand trochanter, postérieur)
    { x: 49, y: 70 }, // 9  Genou latéral (centré)
    { x: 48, y: 90 }, // 10 Cheville / pied (légèrement antérieur)
    { x: 72, y: 49 }, // 11 Chaîne postérieure (plus loin du corps)
    { x: 28, y: 49 }, // 12 Chaîne antérieure (plus loin du corps)
  ],
  right: [
    // miroir exact du profil gauche : x_droit = 100 - x_gauche, même y
    { x: 47, y: 7  }, // 1
    { x: 48, y: 15 }, // 2
    { x: 44, y: 21 }, // 3
    { x: 54, y: 29 }, // 4
    { x: 42, y: 40 }, // 5
    { x: 54, y: 52 }, // 6
    { x: 59, y: 49 }, // 7
    { x: 40, y: 51 }, // 8
    { x: 51, y: 70 }, // 9
    { x: 52, y: 90 }, // 10
    { x: 28, y: 49 }, // 11
    { x: 72, y: 49 }, // 12
  ],
}

const BODY_CHART_SYMPTOMS = ['Douleur', 'Tension', 'Blocage', 'Irradiation', 'Fourmillement', 'Engourdissement', 'Brulure', 'Faiblesse']

function zoneLaterality(side: BodyChartSide, zone: string): string {
  if (side === 'right') return 'Droit'
  if (side === 'left') return 'Gauche'
  const lower = zone.toLowerCase()
  if (/\bdroit[es]?\b/.test(lower)) return 'Droit'
  if (/\bgauche[s]?\b/.test(lower)) return 'Gauche'
  return 'Non precise'
}

function lateralityOptions(side: BodyChartSide, zone: string): string[] {
  if (side === 'right') return ['Non precise', 'Droit']
  if (side === 'left') return ['Non precise', 'Gauche']
  const lower = zone.toLowerCase()
  if (/\bdroit[es]?\b/.test(lower)) return ['Non precise', 'Droit']
  if (/\bgauche[s]?\b/.test(lower)) return ['Non precise', 'Gauche']
  return ['Non precise', 'Droit', 'Gauche', 'Bilateral', 'Central']
}

function bodyChartKey(side: BodyChartSide, zone: string): string {
  return `${side}:${zone}`
}

function defaultBodyChartDetail(laterality = 'Non precise'): BodyChartZoneDetail {
  return { intensity: 5, symptom: 'Douleur', laterality, note: '' }
}

function bodyChartIntensityColor(intensity: number | undefined): string {
  const value = typeof intensity === 'number' ? intensity : 5
  if (value <= 2) return '#D5A51C'
  if (value <= 5) return '#D97706'
  if (value <= 7) return '#DC2626'
  return '#8F1D1D'
}

function BodyChartField({ value, onChange }: {
  value: BodyChartValue | null | undefined
  onChange: (v: BodyChartValue) => void
}) {
  const isDark = useIsDark()
  const chartImages = getAnatomyImages(isDark)
  const [activeSide, setActiveSide] = useState<BodyChartSide>('front')
  const current: BodyChartValue = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}

  const toggle = (side: BodyChartSide, zone: string) => {
    const selected = current[side] || []
    const key = bodyChartKey(side, zone)
    const next = selected.includes(zone)
      ? selected.filter(z => z !== zone)
      : [...selected, zone]
    const details = { ...(current.details || {}) }
    if (selected.includes(zone)) {
      delete details[key]
    } else if (!details[key]) {
      details[key] = defaultBodyChartDetail(zoneLaterality(side, zone))
    }
    onChange({ ...current, [side]: next, details })
  }

  const updateNotes = (notes: string) => {
    onChange({ ...current, notes })
  }

  const updateZoneDetail = (side: BodyChartSide, zone: string, patch: Partial<BodyChartZoneDetail>) => {
    const key = bodyChartKey(side, zone)
    onChange({
      ...current,
      details: {
        ...(current.details || {}),
        [key]: {
          ...defaultBodyChartDetail(),
          ...(current.details || {})[key],
          ...patch,
        },
      },
    })
  }

  const selectedZones = current[activeSide] || []
  const activeMeta = BODY_CHART_VIEW_META[activeSide]
  const totalSelected = BODY_CHART_SIDES.reduce((total, side) => total + (current[side] || []).length, 0)
  const selectedTrace = BODY_CHART_ZONES[activeSide]
    .map((zone, index) => ({
      zone,
      pos: BODY_CHART_ZONE_POSITIONS[activeSide][index] || { x: 50, y: 50 },
    }))
    .filter(item => selectedZones.includes(item.zone))
    .map(item => `${item.pos.x},${item.pos.y}`)
    .join(' ')

  const renderClinicalMap = () => (
    <div
      className={`bodychart-clinical-map ${activeSide}`}
      aria-label={activeMeta.label}
      style={{ '--bodychart-image': `url("${chartImages[activeSide]}")` } as React.CSSProperties}
    >
      <img
        className="bodychart-asset"
        src={chartImages[activeSide]}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <svg className="bodychart-overlay" viewBox="0 0 100 100" role="img" aria-hidden="true" preserveAspectRatio="none">
        {BODY_CHART_ZONES[activeSide].map((zone, index) => {
          if (!selectedZones.includes(zone)) return null
          const pos = BODY_CHART_ZONE_POSITIONS[activeSide][index] || { x: 50, y: 50 }
          const detail = (current.details || {})[bodyChartKey(activeSide, zone)]
          const intensity = typeof detail?.intensity === 'number' ? detail.intensity : 5
          return (
            <g key={`heat-${zone}`} className={`bodychart-heat heat-${Math.min(10, Math.max(0, intensity))}`}>
              <circle cx={pos.x} cy={pos.y} r={3.2 + intensity * .42} />
              <circle cx={pos.x} cy={pos.y} r={1.4 + intensity * .2} />
            </g>
          )
        })}
        {selectedTrace && (
          <polyline className="bodychart-trace" points={selectedTrace} />
        )}
      </svg>

      {BODY_CHART_ZONES[activeSide].map((zone, index) => {
        const active = selectedZones.includes(zone)
        const pos = BODY_CHART_ZONE_POSITIONS[activeSide][index] || { x: 50, y: 50 }
        const detail = (current.details || {})[bodyChartKey(activeSide, zone)]
        const markerColor = bodyChartIntensityColor(detail?.intensity)
        return (
          <button
            key={zone}
            type="button"
            className={`bodychart-marker${active ? ' active' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, '--zone-color': markerColor } as React.CSSProperties}
            onClick={() => toggle(activeSide, zone)}
            aria-pressed={active}
            title={zone}
          >
            <span>{index + 1}</span>
          </button>
        )
      })}
    </div>
  )

  const renderClinicalCards = () => (
    <div className="bodychart-zone-panel">
      <div className="bodychart-zone-panel-head">
        <strong>{activeMeta.panelLabel}</strong>
        <span>{selectedZones.length} selectionnee(s)</span>
      </div>
      <div className="bodychart-zones">
        {BODY_CHART_ZONES[activeSide].map((zone, index) => {
          const active = selectedZones.includes(zone)
          const detail = (current.details || {})[bodyChartKey(activeSide, zone)]
          const markerColor = bodyChartIntensityColor(detail?.intensity)
          return (
            <button
              key={zone}
              type="button"
              className={`bodychart-zone-card${active ? ' active' : ''}`}
              onClick={() => toggle(activeSide, zone)}
              aria-pressed={active}
              style={{ '--zone-color': markerColor } as React.CSSProperties}
            >
              <span className="bodychart-zone-index">{index + 1}</span>
              <span>{zone}</span>
            </button>
          )
        })}
      </div>
      <div className="bodychart-selected-panel">
        <div className="bodychart-selected-title">Details des zones selectionnees</div>
        {selectedZones.length === 0 ? (
          <div className="bodychart-empty-detail">Selectionner une zone sur le corps pour renseigner le symptome.</div>
        ) : selectedZones.map(zone => {
          const key = bodyChartKey(activeSide, zone)
          const detail = { ...defaultBodyChartDetail(), ...(current.details || {})[key] }
          const markerColor = bodyChartIntensityColor(detail.intensity)
          return (
            <div key={zone} className="bodychart-detail-card" style={{ '--zone-color': markerColor } as React.CSSProperties}>
              <div className="bodychart-detail-head">
                <span>{zone}</span>
                <strong>{detail.intensity ?? 5}/10</strong>
              </div>
              <div className="bodychart-detail-grid">
                <label>
                  Type
                  <select
                    value={detail.symptom || 'Douleur'}
                    onChange={e => updateZoneDetail(activeSide, zone, { symptom: e.target.value })}
                  >
                    {BODY_CHART_SYMPTOMS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Cote
                  <select
                    value={detail.laterality || 'Non precise'}
                    onChange={e => updateZoneDetail(activeSide, zone, { laterality: e.target.value })}
                  >
                    {lateralityOptions(activeSide, zone).map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <label className="bodychart-intensity-row">
                <span>Intensite</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={detail.intensity ?? 5}
                  onChange={e => updateZoneDetail(activeSide, zone, { intensity: Number(e.target.value) })}
                />
              </label>
              <textarea
                value={detail.note || ''}
                onChange={e => updateZoneDetail(activeSide, zone, { note: e.target.value })}
                placeholder="Trajet, irradiation, restriction, circonstance, test positif..."
              />
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="bodychart-field">
      <div className="bodychart-command">
        <div>
          <span className="bodychart-command-kicker">Carte anatomique osteopathie</span>
          <strong>Localisation clinique des zones symptomatiques</strong>
        </div>
        <div className="bodychart-command-stats">
          <span>{totalSelected} zone(s)</span>
          <span>{activeMeta.anatomy}</span>
        </div>
      </div>
      <div className="bodychart-workspace">
        <div className="bodychart-view-rail" aria-label="Choix de la vue anatomique">
          {BODY_CHART_SIDES.map(side => {
            const meta = BODY_CHART_VIEW_META[side]
            const count = (current[side] || []).length
            return (
              <button
                key={side}
                type="button"
                className={activeSide === side ? 'active' : ''}
                onClick={() => setActiveSide(side)}
                aria-pressed={activeSide === side}
              >
                <span>{meta.shortLabel}</span>
                <strong>{meta.label}</strong>
                {count > 0 && <em>{count}</em>}
              </button>
            )
          })}
        </div>
        <div className="bodychart-map-card">
          <div className="bodychart-map-head">
            <div>
              <span>{activeMeta.shortLabel}</span>
              <strong>{activeMeta.label}</strong>
            </div>
            <small>{selectedZones.length} selectionnee(s)</small>
          </div>
          {renderClinicalMap()}
          <div className="bodychart-map-legend">
            <span>Point discret</span>
            <span>Halo = intensite</span>
            <span>Trait = trajet</span>
          </div>
        </div>
        {renderClinicalCards()}
      </div>
      <textarea
        value={current.notes || ''}
        onChange={e => updateNotes(e.target.value)}
        placeholder="Annotations : trajet de douleur, intensité par zone, irradiation, paresthésies, restrictions, cicatrices, zones à surveiller..."
        style={{ minHeight: 72, resize: 'vertical', marginTop: 10 }}
      />
    </div>
  )
}

// ── SLIDER ─────────────────────────────────────────────────────────────────

function SliderField({ value, onChange, min, max, step }: {
  value: any; onChange: (v: number) => void; min: number; max: number; step: number
}) {
  const current = typeof value === 'number' ? value : min
  const pct = max > min ? ((current - min) / (max - min)) * 100 : 0
  const col = pct <= 30 ? 'var(--accent)' : pct <= 60 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range" min={min} max={max} step={step}
        value={current}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: col, height: 4 }}
      />
      <span style={{
        minWidth: 52, textAlign: 'center', fontWeight: 700, fontSize: 14,
        color: col, background: col + '18', borderRadius: 6, padding: '3px 8px',
        border: `1.5px solid ${col}44`, flexShrink: 0,
      }}>
        {current}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}> / {max}</span>
      </span>
    </div>
  )
}

// ── BEFORE / AFTER ─────────────────────────────────────────────────────────

interface BeforeAfterValue { before?: number; after?: number }

function BeforeAfterField({ value, onChange, min, max, step }: {
  value: any; onChange: (v: BeforeAfterValue) => void; min: number; max: number; step: number
}) {
  const current: BeforeAfterValue = value && typeof value === 'object' && !Array.isArray(value)
    ? value as BeforeAfterValue
    : {}
  const hasBefore = typeof current.before === 'number'
  const hasAfter  = typeof current.after  === 'number'
  const before = hasBefore ? current.before! : min
  const after  = hasAfter  ? current.after!  : min
  const diff = hasBefore && hasAfter ? after - before : null

  const sliderRow = (
    label: string,
    hasVal: boolean,
    curVal: number,
    accentColor: string,
    bgColor: string,
    onInit: () => void,
    onSlide: (v: number) => void,
    onClear: () => void,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ minWidth: 44, fontSize: 12, fontWeight: 600, color: accentColor, flexShrink: 0 }}>{label}</span>
      {hasVal ? (
        <>
          <input type="range" min={min} max={max} step={step} value={curVal}
            onChange={e => onSlide(Number(e.target.value))}
            style={{ flex: 1, accentColor }} />
          <span style={{ minWidth: 52, textAlign: 'center', fontWeight: 700, fontSize: 13,
            color: accentColor, background: bgColor, border: `1px solid ${accentColor}44`,
            borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
            {curVal}<span style={{ fontSize: 10, fontWeight: 400 }}> / {max}</span>
          </span>
          <button type="button" onClick={onClear}
            title="Effacer cette valeur"
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>✕</button>
        </>
      ) : (
        <button type="button" onClick={onInit}
          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1.5px dashed ${accentColor}66`,
            background: 'transparent', color: accentColor, cursor: 'pointer', flex: 1, textAlign: 'left' }}>
          + Définir la valeur
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sliderRow(
        'Avant', hasBefore, before, 'var(--text-muted)', 'var(--surface)',
        () => onChange({ ...current, before: min }),
        v  => onChange({ ...current, before: v }),
        () => onChange({ ...current, before: undefined }),
      )}
      {sliderRow(
        'Après', hasAfter, after, 'var(--accent)', 'var(--accent-light)',
        () => onChange({ ...current, after: min }),
        v  => onChange({ ...current, after: v }),
        () => onChange({ ...current, after: undefined }),
      )}
      {diff !== null && (
        <div style={{
          textAlign: 'center', fontSize: 12, fontWeight: 600, padding: '4px 0',
          color: diff < 0 ? 'var(--accent)' : diff > 0 ? 'var(--red)' : 'var(--text-muted)',
        }}>
          Variation : {diff > 0 ? '+' : ''}{diff}
        </div>
      )}
    </div>
  )
}

// ── REPEATABLE ─────────────────────────────────────────────────────────────

interface RepeatableRow { nom: string; note: string }

function RepeatableField({ value, onChange }: {
  value: any; onChange: (v: RepeatableRow[]) => void
}) {
  const rows: RepeatableRow[] = Array.isArray(value) ? value as RepeatableRow[] : []
  const addRow    = () => onChange([...rows, { nom: '', note: '' }])
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<RepeatableRow>) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="text" value={row.nom} placeholder="Nom…"
            onChange={e => updateRow(i, { nom: e.target.value })}
            style={{ flex: '0 0 160px', minWidth: 0 }} />
          <input type="text" value={row.note} placeholder="Note…"
            onChange={e => updateRow(i, { note: e.target.value })}
            style={{ flex: 1, minWidth: 0 }} />
          <button type="button" onClick={() => removeRow(i)}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--red)',
              background: 'transparent', color: 'var(--red)', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="btn btn-secondary btn-sm"
        style={{ alignSelf: 'flex-start' }}>
        + Ajouter une ligne
      </button>
    </div>
  )
}

// ── TAGS ───────────────────────────────────────────────────────────────────

function TagsField({ value, onChange, placeholder }: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const t = input.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="plugin-tags-list" style={{ marginBottom: 6 }}>
          {value.map(t => (
            <span key={t} className="plugin-tag">
              {t}
              <button
                type="button"
                className="plugin-tag-remove"
                onClick={() => onChange(value.filter(x => x !== t))}
                title="Supprimer"
              >×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder || 'Écrire puis Entrée…'}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>+</button>
      </div>
    </div>
  )
}

// ── RATING ─────────────────────────────────────────────────────────────────

function RatingField({ value, onChange, min, max }: {
  value: any
  onChange: (v: number | null) => void
  min: number
  max: number
}) {
  const current: number | null = typeof value === 'number' ? value : null
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <div className="plugin-rating-field">
      <div className="plugin-rating-scale">
        {steps.map(n => (
          <button
            key={n}
            type="button"
            className={`plugin-rating-btn${current === n ? ' active' : ''}`}
            onClick={() => onChange(current === n ? null : n)}
            title={String(n)}
          >
            {n}
          </button>
        ))}
      </div>
      {current !== null && (
        <span className="plugin-rating-value">{current} / {max}</span>
      )}
    </div>
  )
}
