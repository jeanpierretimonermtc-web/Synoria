import React, { useState, useEffect } from 'react'
import { getAnatomyImages } from '../../../assets/bodycharts/bodychartImages.generated'

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

type PostureView = 'anterieure' | 'posterieure' | 'laterale_gauche' | 'laterale_droite'

interface PostureViewData {
  findings: string[]
  note: string
}

export interface PostureValue {
  anterieure:     PostureViewData
  posterieure:    PostureViewData
  laterale_gauche: PostureViewData
  laterale_droite: PostureViewData
}

const POSTURE_IMAGE_KEY: Record<PostureView, 'front' | 'back' | 'left' | 'right'> = {
  anterieure:      'front',
  posterieure:     'back',
  laterale_gauche: 'left',
  laterale_droite: 'right',
}

const VIEW_META: Record<PostureView, { label: string; short: string; findings: string[] }> = {
  anterieure: {
    label: 'Vue antérieure', short: 'ANT',
    findings: [
      'Tête inclinée droite',       'Tête inclinée gauche',
      'Épaule droite plus haute',   'Épaule gauche plus haute',
      'Bassin incliné droite',      'Bassin incliné gauche',
      'Genou valgum droit',         'Genou valgum gauche',
      'Genou varum droit',          'Genou varum gauche',
      'Pied en valgus droit',       'Pied en valgus gauche',
      'Pied en varus droit',        'Pied en varus gauche',
    ],
  },
  posterieure: {
    label: 'Vue postérieure', short: 'POST',
    findings: [
      'Scoliose dorsale droite',    'Scoliose dorsale gauche',
      'Scoliose lombaire droite',   'Scoliose lombaire gauche',
      'Gibbosité droite',           'Gibbosité gauche',
      'Déséquilibre du bassin',
      'Asymétrie des épaules',
      'Ligne des épines iliaques asymétrique',
      'Pied plat droit',            'Pied plat gauche',
      'Pied creux droit',           'Pied creux gauche',
    ],
  },
  laterale_gauche: {
    label: 'Profil gauche', short: 'GAU',
    findings: [
      'Hypercyphose dorsale',
      'Hyperlordose lombaire',
      'Rectitude rachidienne',
      'Antépulsion de la tête',
      'Projection antérieure des épaules',
      'Antéversion du bassin',
      'Rétroversion du bassin',
      'Genou en hyperextension (recurvatum)',
      'Flexum de genou',
    ],
  },
  laterale_droite: {
    label: 'Profil droit', short: 'DRO',
    findings: [
      'Hypercyphose dorsale',
      'Hyperlordose lombaire',
      'Rectitude rachidienne',
      'Antépulsion de la tête',
      'Projection antérieure des épaules',
      'Antéversion du bassin',
      'Rétroversion du bassin',
      'Genou en hyperextension (recurvatum)',
      'Flexum de genou',
    ],
  },
}

const VIEWS: PostureView[] = ['anterieure', 'posterieure', 'laterale_gauche', 'laterale_droite']

function emptyView(): PostureViewData { return { findings: [], note: '' } }

export function emptyPosture(): PostureValue {
  return {
    anterieure:      emptyView(),
    posterieure:     emptyView(),
    laterale_gauche: emptyView(),
    laterale_droite: emptyView(),
  }
}

export default function OsteoPostureModule({ value, onChange }: {
  value: PostureValue | null | undefined
  onChange: (v: PostureValue) => void
}) {
  const isDark = useIsDark()
  const anatomyImages = getAnatomyImages(isDark)
  const current: PostureValue =
    value && typeof value === 'object' ? value : emptyPosture()

  const [activeView, setActiveView] = useState<PostureView>('anterieure')

  const viewData = current[activeView]
  const meta     = VIEW_META[activeView]
  const viewImage = anatomyImages[POSTURE_IMAGE_KEY[activeView]]

  const toggleFinding = (finding: string) => {
    const findings = viewData.findings.includes(finding)
      ? viewData.findings.filter(f => f !== finding)
      : [...viewData.findings, finding]
    onChange({ ...current, [activeView]: { ...viewData, findings } })
  }

  const setNote = (note: string) =>
    onChange({ ...current, [activeView]: { ...viewData, note } })

  const totalFindings = VIEWS.reduce((n, v) => n + current[v].findings.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Tabs + stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {totalFindings > 0
            ? `${totalFindings} observation${totalFindings > 1 ? 's' : ''} au total`
            : 'Aucune observation'}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {VIEWS.map(v => {
            const m     = VIEW_META[v]
            const count = current[v].findings.length
            const active = activeView === v
            return (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                style={{
                  padding: '5px 10px', borderRadius: 7,
                  fontSize: 11, fontWeight: 700,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', position: 'relative', transition: 'all .12s',
                }}
              >
                {m.short}
                {count > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -5,
                    minWidth: 16, height: 16, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px',
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Vue label */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        {meta.label}
        {viewData.findings.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--accent)' }}>
            {viewData.findings.length} sélection{viewData.findings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Image + findings côte à côte */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* Image anatomique */}
        <div className="osteo-posture-img-wrap">
          <img
            src={viewImage}
            alt={meta.label}
            draggable={false}
            style={{ width: '100%', display: 'block' }}
          />
        </div>

        {/* Grille findings */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', alignContent: 'start' }}>
          {meta.findings.map(finding => {
            const active = viewData.findings.includes(finding)
            return (
              <label
                key={finding}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  fontSize: 12, transition: 'all .12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleFinding(finding)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14, flexShrink: 0 }}
                />
                <span style={{
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400,
                  lineHeight: 1.3,
                }}>
                  {finding}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Note de la vue active */}
      <textarea
        value={viewData.note}
        onChange={e => setNote(e.target.value)}
        placeholder={`Notes — ${meta.label.toLowerCase()}…`}
        style={{ width: '100%', minHeight: 56, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
      />
    </div>
  )
}
