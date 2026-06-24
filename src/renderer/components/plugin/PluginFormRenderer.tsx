import React, { useState } from 'react'
import type { PluginDefinition, PluginSection, PluginField } from '../../../shared/pluginTypes'
import RichTextArea from '../common/RichTextArea'

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

interface RendererProps {
  plugin: PluginDefinition
  data: Record<string, any>
  onChange: (id: string, value: any) => void
}

export default function PluginFormRenderer({ plugin, data, onChange }: RendererProps) {
  return (
    <>
      {plugin.sections.map(section => (
        <PluginSectionCard
          key={section.id}
          section={section}
          data={data}
          onChange={onChange}
        />
      ))}
    </>
  )
}

// ── SECTION ────────────────────────────────────────────────────────────────

function PluginSectionCard({ section, data, onChange }: {
  section: PluginSection
  data: Record<string, any>
  onChange: (id: string, value: any) => void
}) {
  const accent = section.accentColor || 'var(--accent)'
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

  for (const field of fields) {
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
              <div key={f.id} className="field">
                <FieldWrapper field={f} data={data} onChange={onChange} />
              </div>
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

    case 'bodychart':
      return <BodyChartField value={value} onChange={onChange} />

    default:
      return null
  }
}

type BodyChartSide = 'front' | 'back'

interface BodyChartValue {
  front?: string[]
  back?: string[]
  notes?: string
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
}

function BodyChartField({ value, onChange }: {
  value: BodyChartValue | null | undefined
  onChange: (v: BodyChartValue) => void
}) {
  const current: BodyChartValue = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}

  const toggle = (side: BodyChartSide, zone: string) => {
    const selected = current[side] || []
    const next = selected.includes(zone)
      ? selected.filter(z => z !== zone)
      : [...selected, zone]
    onChange({ ...current, [side]: next })
  }

  const updateNotes = (notes: string) => {
    onChange({ ...current, notes })
  }

  const renderSide = (side: BodyChartSide, label: string) => (
    <div className="bodychart-side">
      <div className="bodychart-title">{label}</div>
      <div className="bodychart-silhouette" aria-hidden="true">
        <span className="bodychart-head" />
        <span className="bodychart-neck" />
        <span className="bodychart-torso" />
        <span className="bodychart-arm bodychart-arm-left" />
        <span className="bodychart-arm bodychart-arm-right" />
        <span className="bodychart-leg bodychart-leg-left" />
        <span className="bodychart-leg bodychart-leg-right" />
      </div>
      <div className="bodychart-zones">
        {BODY_CHART_ZONES[side].map(zone => {
          const active = (current[side] || []).includes(zone)
          return (
            <button
              key={zone}
              type="button"
              className={`bodychart-zone${active ? ' active' : ''}`}
              onClick={() => toggle(side, zone)}
              aria-pressed={active}
            >
              {zone}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="bodychart-field">
      <div className="bodychart-grid">
        {renderSide('front', 'Vue antérieure')}
        {renderSide('back', 'Vue postérieure')}
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
