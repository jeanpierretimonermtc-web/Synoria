import React from 'react'

type ElementKey = 'bois' | 'feu' | 'terre' | 'metal' | 'eau'

interface ElementDef {
  key: ElementKey
  label: string
  emoji: string
  color: string
  zang: string
  fu: string
  tissu: string
  ouverture: string
  emotion: string
  saveur: string
  saison: string
  couleur: string
}

const ELEMENTS: ElementDef[] = [
  {
    key: 'bois', label: 'Bois', emoji: '🌿', color: '#4e8a5e',
    zang: 'Foie', fu: 'Vésicule Biliaire', tissu: 'Tendons / Ligaments',
    ouverture: 'Yeux', emotion: 'Colère', saveur: 'Acide',
    saison: 'Printemps', couleur: 'Vert',
  },
  {
    key: 'feu', label: 'Feu', emoji: '🔥', color: '#c94040',
    zang: 'Cœur', fu: 'Intestin Grêle', tissu: 'Vaisseaux sanguins',
    ouverture: 'Langue', emotion: 'Joie / Agitation', saveur: 'Amer',
    saison: 'Été', couleur: 'Rouge',
  },
  {
    key: 'terre', label: 'Terre', emoji: '🌍', color: '#b8841e',
    zang: 'Rate / Pancréas', fu: 'Estomac', tissu: 'Muscles',
    ouverture: 'Bouche / Lèvres', emotion: 'Réflexion / Soucis', saveur: 'Doux',
    saison: "Fin d'été", couleur: 'Jaune',
  },
  {
    key: 'metal', label: 'Métal', emoji: '⚙️', color: '#6a7f94',
    zang: 'Poumon', fu: 'Gros Intestin', tissu: 'Peau / Poils',
    ouverture: 'Nez', emotion: 'Tristesse / Deuil', saveur: 'Piquant',
    saison: 'Automne', couleur: 'Blanc',
  },
  {
    key: 'eau', label: 'Eau', emoji: '💧', color: '#2e6ca8',
    zang: 'Rein', fu: 'Vessie', tissu: 'Os / Moelle',
    ouverture: 'Oreilles', emotion: 'Peur', saveur: 'Salé',
    saison: 'Hiver', couleur: 'Bleu / Noir',
  },
]

const CORR_ROWS: { key: keyof ElementDef; label: string }[] = [
  { key: 'zang',      label: 'Zang'       },
  { key: 'fu',        label: 'Fu'         },
  { key: 'tissu',     label: 'Tissu'      },
  { key: 'ouverture', label: 'Ouverture'  },
  { key: 'emotion',   label: 'Émotion'    },
  { key: 'saveur',    label: 'Saveur'     },
  { key: 'saison',    label: 'Saison'     },
  { key: 'couleur',   label: 'Couleur'    },
]

export interface FiveElementsValue {
  selected: ElementKey[]
  notes: Partial<Record<ElementKey, string>>
  generalNote: string
}

export function emptyFiveElements(): FiveElementsValue {
  return { selected: [], notes: {}, generalNote: '' }
}

export default function MtcFiveElementsModule({ value, onChange }: {
  value: FiveElementsValue | null | undefined
  onChange: (v: FiveElementsValue) => void
}) {
  const current: FiveElementsValue =
    value && typeof value === 'object' ? value : emptyFiveElements()

  const toggle = (key: ElementKey) => {
    const selected = current.selected.includes(key)
      ? current.selected.filter(k => k !== key)
      : [...current.selected, key]
    onChange({ ...current, selected })
  }

  const setNote = (key: ElementKey, note: string) => {
    onChange({ ...current, notes: { ...current.notes, [key]: note } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Roue — 5 cartes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {ELEMENTS.map(el => {
          const active = current.selected.includes(el.key)
          return (
            <div
              key={el.key}
              onClick={() => toggle(el.key)}
              style={{
                border: `2px solid ${active ? el.color : el.color + '44'}`,
                borderRadius: 12, padding: '12px 8px',
                cursor: 'pointer',
                background: active ? el.color + '12' : 'var(--surface)',
                transition: 'all .15s',
                display: 'flex', flexDirection: 'column', gap: 3,
                position: 'relative',
                userSelect: 'none',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: el.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                }}>✓</div>
              )}

              <div style={{ fontSize: 20, textAlign: 'center', marginBottom: 2 }}>{el.emoji}</div>
              <div style={{
                fontSize: 13, fontWeight: 800, color: el.color,
                textAlign: 'center', marginBottom: 6,
              }}>{el.label}</div>

              <div style={{ borderTop: `1px solid ${el.color}33`, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {CORR_ROWS.map(({ key, label }) => (
                  <div key={key}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: el.color + 'aa',
                      textTransform: 'uppercase', letterSpacing: '.06em',
                      display: 'block',
                    }}>{label}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text)', lineHeight: 1.3 }}>
                      {el[key] as string}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Notes par élément sélectionné ── */}
      {current.selected.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Observations par élément
          </div>
          {ELEMENTS.filter(el => current.selected.includes(el.key)).map(el => (
            <div key={el.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                minWidth: 64, paddingTop: 8, flexShrink: 0,
                fontSize: 11, fontWeight: 700, color: el.color,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 16 }}>{el.emoji}</span>
                <span>{el.label}</span>
              </div>
              <textarea
                value={current.notes[el.key] || ''}
                onChange={e => setNote(el.key, e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder={`Observations ${el.label}…`}
                style={{ flex: 1, minHeight: 52, fontSize: 12, resize: 'vertical' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Note générale ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Synthèse générale
        </div>
        <textarea
          value={current.generalNote || ''}
          onChange={e => onChange({ ...current, generalNote: e.target.value })}
          placeholder="Synthèse des 5 Éléments, correspondances cliniques observées, déséquilibres prioritaires…"
          style={{ width: '100%', minHeight: 64, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  )
}
