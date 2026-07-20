import React, { useState } from 'react'

// ── Qualités de pouls (29 qualités classiques) ────────────────────────────────

interface PulseQuality { id: string; label: string; pinyin: string; base?: boolean }

const PULSE_QUALITIES: PulseQuality[] = [
  { id: 'flottant',     label: 'Flottant',          pinyin: 'Fu',     base: true },
  { id: 'profond',      label: 'Profond',            pinyin: 'Chen',   base: true },
  { id: 'lent',         label: 'Lent',               pinyin: 'Chi',    base: true },
  { id: 'rapide',       label: 'Rapide',             pinyin: 'Shu',    base: true },
  { id: 'vide',         label: 'Vide',               pinyin: 'Xu',     base: true },
  { id: 'plein',        label: 'Plein',              pinyin: 'Shi',    base: true },
  { id: 'glissant',     label: 'Glissant',           pinyin: 'Hua',    base: true },
  { id: 'rugueux',      label: 'Rugueux',            pinyin: 'Se',     base: true },
  { id: 'faible',       label: 'Faible',             pinyin: 'Ruo'    },
  { id: 'fin',          label: 'Fin',                pinyin: 'Xi'     },
  { id: 'tenu',         label: 'Ténu',               pinyin: 'Wei'    },
  { id: 'mou',          label: 'Mou',                pinyin: 'Ru'     },
  { id: 'court',        label: 'Court',              pinyin: 'Duan'   },
  { id: 'creux',        label: 'Creux',              pinyin: 'Kou'    },
  { id: 'peau_tambour', label: 'En Peau de tambour', pinyin: 'Ge'     },
  { id: 'cache',        label: 'Caché',              pinyin: 'Fu'     },
  { id: 'disperse',     label: 'Dispersé',           pinyin: 'San'    },
  { id: 'corde',        label: 'En Corde',           pinyin: 'Xian'   },
  { id: 'serre',        label: 'Serré',              pinyin: 'Jin'    },
  { id: 'vaste',        label: 'Vaste',              pinyin: 'Hong'   },
  { id: 'grand',        label: 'Grand',              pinyin: 'Da'     },
  { id: 'ferme',        label: 'Ferme',              pinyin: 'Lao'    },
  { id: 'long',         label: 'Long',               pinyin: 'Chang'  },
  { id: 'remuant',      label: 'Remuant',            pinyin: 'Dong'   },
  { id: 'noue',         label: 'Noué',               pinyin: 'Jie'    },
  { id: 'precipite',    label: 'Précipité',          pinyin: 'Cu'     },
  { id: 'accelere',     label: 'Accéléré',           pinyin: 'Ji'     },
  { id: 'periodique',   label: 'Périodique',         pinyin: 'Dai'    },
  { id: 'ralenti',      label: 'Ralenti',            pinyin: 'Huan'   },
]

const BASE_QUALITIES     = PULSE_QUALITIES.filter(q => q.base)
const EXTENDED_QUALITIES = PULSE_QUALITIES.filter(q => !q.base)

// ── Positions de pouls (6 positions) ─────────────────────────────────────────

interface PulsePosition {
  id: string
  side: 'gauche' | 'droite'
  level: 'Cun' | 'Guan' | 'Chi'
  organ: string
}

const POSITIONS: PulsePosition[] = [
  { id: 'cun_g',  side: 'gauche', level: 'Cun',  organ: 'Cœur / Péricarde'         },
  { id: 'guan_g', side: 'gauche', level: 'Guan', organ: 'Foie / Vésicule Biliaire' },
  { id: 'chi_g',  side: 'gauche', level: 'Chi',  organ: 'Reins Yin'                },
  { id: 'cun_d',  side: 'droite', level: 'Cun',  organ: 'Poumon'                   },
  { id: 'guan_d', side: 'droite', level: 'Guan', organ: 'Rate / Estomac'           },
  { id: 'chi_d',  side: 'droite', level: 'Chi',  organ: 'Reins Yang / Ming Men'    },
]

// ── Langue — référentiel ──────────────────────────────────────────────────────

const TONGUE_COLORS = [
  { id: 'pale',      label: 'Pâle',      color: '#d4a78c' },
  { id: 'rose',      label: 'Rose',      color: '#d48090' },
  { id: 'rouge',     label: 'Rouge',     color: '#c94040' },
  { id: 'rouge_vif', label: 'Rouge vif', color: '#e52020' },
  { id: 'violace',   label: 'Violacée',  color: '#8b4a8b' },
  { id: 'bleue',     label: 'Bleue',     color: '#4a6a9b' },
]

const TONGUE_COAT_COLORS = [
  { id: 'blanc', label: 'Blanc' },
  { id: 'jaune', label: 'Jaune' },
  { id: 'gris',  label: 'Gris'  },
  { id: 'noir',  label: 'Noir'  },
]

const TONGUE_COAT_TEXTURES = [
  { id: 'fin',      label: 'Fin'              },
  { id: 'epais',    label: 'Épais'            },
  { id: 'glissant', label: 'Glissant'         },
  { id: 'sec',      label: 'Sec'              },
  { id: 'absent',   label: 'Absent (miroir)'  },
]

const TONGUE_MOISTURE = [
  { id: 'tres_seche',  label: 'Très sèche'  },
  { id: 'seche',       label: 'Sèche'       },
  { id: 'normale',     label: 'Normale'     },
  { id: 'humide',      label: 'Humide'      },
  { id: 'tres_humide', label: 'Très humide' },
]

const TONGUE_SHAPES = [
  { id: 'normale',    label: 'Normale'    },
  { id: 'gonflee',    label: 'Gonflée'    },
  { id: 'fine',       label: 'Fine'       },
  { id: 'rigide',     label: 'Rigide'     },
  { id: 'tremblante', label: 'Tremblante' },
  { id: 'deviee',     label: 'Déviée'     },
  { id: 'fissuree',   label: 'Fissurée'   },
  { id: 'dentee',     label: 'Dentée'     },
]

// ── Types de valeur ────────────────────────────────────────────────────────────

interface PositionData {
  qualities: string[]
  note: string
}

interface TongueData {
  color: string
  coatColor: string
  coatTextures: string[]
  moisture: string
  shapes: string[]
  note: string
}

export interface TonguePulseValue {
  tongue: TongueData
  pulse: {
    positions: Record<string, PositionData>
    globalNote: string
  }
}

function emptyPosition(): PositionData { return { qualities: [], note: '' } }

export function emptyTonguePulse(): TonguePulseValue {
  const positions: Record<string, PositionData> = {}
  POSITIONS.forEach(p => { positions[p.id] = emptyPosition() })
  return {
    tongue: { color: '', coatColor: '', coatTextures: [], moisture: '', shapes: [], note: '' },
    pulse:  { positions, globalNote: '' },
  }
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>
      {children}
    </div>
  )
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: active ? 700 : 400,
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all .1s', whiteSpace: 'nowrap',
      }}
    >{label}</button>
  )
}

function PositionCard({
  pos, data, expanded, onToggle, onQualityToggle, onNoteChange,
}: {
  pos: PulsePosition
  data: PositionData
  expanded: boolean
  onToggle: () => void
  onQualityToggle: (qualId: string) => void
  onNoteChange: (note: string) => void
}) {
  const hasSelected = data.qualities.length > 0
  return (
    <div style={{
      border: `1.5px solid ${hasSelected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10, overflow: 'hidden',
      background: hasSelected ? 'var(--accent-light)' : 'var(--surface)',
      transition: 'all .12s',
    }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{
          minWidth: 34, height: 34, borderRadius: 7,
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, flexShrink: 0,
        }}>{pos.level}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{pos.organ}</div>
          {hasSelected ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
              {data.qualities.map(qid => {
                const q = PULSE_QUALITIES.find(x => x.id === qid)
                return q ? (
                  <span key={qid} style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                    background: 'var(--accent)', color: '#fff',
                  }}>{q.label}</span>
                ) : null
              })}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Cliquer pour saisir</div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <FieldLabel>8 qualités de base</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {BASE_QUALITIES.map(q => (
                <Chip key={q.id} active={data.qualities.includes(q.id)}
                  label={`${q.label} (${q.pinyin})`}
                  onClick={() => onQualityToggle(q.id)}
                />
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Autres qualités</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {EXTENDED_QUALITIES.map(q => (
                <Chip key={q.id} active={data.qualities.includes(q.id)}
                  label={`${q.label} (${q.pinyin})`}
                  onClick={() => onQualityToggle(q.id)}
                />
              ))}
            </div>
          </div>
          <textarea
            value={data.note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder={`Note ${pos.level} ${pos.side}…`}
            style={{ width: '100%', minHeight: 38, fontSize: 11, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      )}
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function MtcTonguePulseModule({ value, onChange }: {
  value: TonguePulseValue | null | undefined
  onChange: (v: TonguePulseValue) => void
}) {
  const current: TonguePulseValue = (value && typeof value === 'object')
    ? value : emptyTonguePulse()

  const [expandedPos, setExpandedPos] = useState<string | null>(null)

  const patchTongue = (patch: Partial<TongueData>) =>
    onChange({ ...current, tongue: { ...current.tongue, ...patch } })

  const toggleTongueMulti = (field: 'coatTextures' | 'shapes', id: string) => {
    const arr = current.tongue[field]
    patchTongue({ [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] })
  }

  const getPos = (id: string): PositionData =>
    current.pulse.positions[id] ?? emptyPosition()

  const patchPos = (id: string, patch: Partial<PositionData>) =>
    onChange({
      ...current,
      pulse: {
        ...current.pulse,
        positions: { ...current.pulse.positions, [id]: { ...getPos(id), ...patch } },
      },
    })

  const toggleQuality = (posId: string, qualId: string) => {
    const pos = getPos(posId)
    patchPos(posId, {
      qualities: pos.qualities.includes(qualId)
        ? pos.qualities.filter(q => q !== qualId)
        : [...pos.qualities, qualId],
    })
  }

  const leftPositions  = POSITIONS.filter(p => p.side === 'gauche')
  const rightPositions = POSITIONS.filter(p => p.side === 'droite')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ══════════ LANGUE ══════════ */}
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>👅</span> Langue
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Couleur */}
          <div>
            <FieldLabel>Couleur</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {TONGUE_COLORS.map(c => {
                const active = current.tongue.color === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => patchTongue({ color: active ? '' : c.id })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 6, fontSize: 11,
                      fontWeight: active ? 700 : 400,
                      border: `1.5px solid ${active ? c.color : 'var(--border)'}`,
                      background: active ? c.color + '28' : 'transparent',
                      color: active ? c.color : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all .1s',
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Enduit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <FieldLabel>Enduit — Couleur</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {TONGUE_COAT_COLORS.map(c => (
                  <Chip key={c.id}
                    active={current.tongue.coatColor === c.id}
                    label={c.label}
                    onClick={() => patchTongue({ coatColor: current.tongue.coatColor === c.id ? '' : c.id })}
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Enduit — Aspect</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {TONGUE_COAT_TEXTURES.map(c => (
                  <Chip key={c.id}
                    active={current.tongue.coatTextures.includes(c.id)}
                    label={c.label}
                    onClick={() => toggleTongueMulti('coatTextures', c.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Humidité */}
          <div>
            <FieldLabel>Humidité</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {TONGUE_MOISTURE.map(c => (
                <Chip key={c.id}
                  active={current.tongue.moisture === c.id}
                  label={c.label}
                  onClick={() => patchTongue({ moisture: current.tongue.moisture === c.id ? '' : c.id })}
                />
              ))}
            </div>
          </div>

          {/* Forme */}
          <div>
            <FieldLabel>Forme</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {TONGUE_SHAPES.map(c => (
                <Chip key={c.id}
                  active={current.tongue.shapes.includes(c.id)}
                  label={c.label}
                  onClick={() => toggleTongueMulti('shapes', c.id)}
                />
              ))}
            </div>
          </div>

          <textarea
            value={current.tongue.note}
            onChange={e => patchTongue({ note: e.target.value })}
            placeholder="Observations complémentaires sur la langue…"
            style={{ width: '100%', minHeight: 52, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* ══════════ POULS ══════════ */}
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>💓</span> Pouls
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', paddingBottom: 4 }}>
              ◀ Main gauche
            </div>
            {leftPositions.map(pos => (
              <PositionCard
                key={pos.id}
                pos={pos}
                data={getPos(pos.id)}
                expanded={expandedPos === pos.id}
                onToggle={() => setExpandedPos(expandedPos === pos.id ? null : pos.id)}
                onQualityToggle={qualId => toggleQuality(pos.id, qualId)}
                onNoteChange={note => patchPos(pos.id, { note })}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', paddingBottom: 4 }}>
              Main droite ▶
            </div>
            {rightPositions.map(pos => (
              <PositionCard
                key={pos.id}
                pos={pos}
                data={getPos(pos.id)}
                expanded={expandedPos === pos.id}
                onToggle={() => setExpandedPos(expandedPos === pos.id ? null : pos.id)}
                onQualityToggle={qualId => toggleQuality(pos.id, qualId)}
                onNoteChange={note => patchPos(pos.id, { note })}
              />
            ))}
          </div>
        </div>

        <textarea
          value={current.pulse.globalNote}
          onChange={e => onChange({ ...current, pulse: { ...current.pulse, globalNote: e.target.value } })}
          placeholder="Note globale — rythme général, observations bilatérales, synthèse…"
          style={{ width: '100%', minHeight: 56, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  )
}
