import React from 'react'
import type { PluginField } from '../../../shared/pluginTypes'
import { sanitizeRichTextHtml } from '../../utils/sanitizeHtml'

function Chips({ values }: { values: string[] }) {
  if (!values.length) return null
  return (
    <div className="chips-group">
      {values.map(v => <span key={v} className="chip chip-blue">{v}</span>)}
    </div>
  )
}

export function PluginFieldSummary({ field, value }: { field: PluginField; value: any }) {
  if (field.summary?.include === false) return null
  if (value === null || value === undefined || value === '') return null

  const displayLabel = field.summary?.label ?? field.label

  switch (field.type) {

    case 'richtext':
    case 'textarea': {
      const str = String(value || '').trim()
      if (!str) return null
      const hasHtml = /<[a-z][\s\S]*>/i.test(str)
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          {hasHtml
            ? <div className="detail-value" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(str) }} />
            : <div className="detail-value">{str}</div>
          }
        </div>
      )
    }

    case 'text':
    case 'number':
    case 'date':
    case 'select':
    case 'radio': {
      const str = String(value).trim()
      if (!str) return null
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          <div className="detail-value">{str}</div>
        </div>
      )
    }

    case 'checkbox':
      return value ? (
        <div>
          <div className="detail-value" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ✓ {displayLabel}
          </div>
        </div>
      ) : null

    case 'checkboxgroup':
    case 'tags': {
      const arr: string[] = Array.isArray(value) ? value : []
      if (!arr.length) return null
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          <Chips values={arr} />
        </div>
      )
    }

    case 'rating': {
      if (value === null || value === undefined) return null
      const num = Number(value)
      const max = field.max ?? 10
      const pct = (num / max) * 100
      const col = pct <= 30 ? 'var(--accent)' : pct <= 60 ? 'var(--amber)' : 'var(--red)'
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          <span className="score-badge" style={{ borderColor: col, color: col }}>
            <strong>{num}</strong> / {max}
          </span>
        </div>
      )
    }

    case 'slider': {
      if (value === null || value === undefined) return null
      const num = Number(value)
      const max = field.max ?? 10
      const pct = max > 0 ? (num / max) * 100 : 0
      const col = pct <= 30 ? 'var(--accent)' : pct <= 60 ? 'var(--amber)' : 'var(--red)'
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          <span className="score-badge" style={{ borderColor: col, color: col }}>
            <strong>{num}</strong> / {max}
          </span>
        </div>
      )
    }

    case 'before_after': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const ba = value as { before?: number; after?: number }
      const hasBefore = typeof ba.before === 'number'
      const hasAfter  = typeof ba.after  === 'number'
      if (!hasBefore && !hasAfter) return null
      const max  = field.max ?? 10
      const diff = hasBefore && hasAfter ? (ba.after! - ba.before!) : null
      const diffCol = diff === null ? 'var(--text-muted)'
        : diff < 0 ? 'var(--accent)' : diff > 0 ? 'var(--red)' : 'var(--text-muted)'
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            {hasBefore && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Avant : <strong>{ba.before}/{max}</strong>
              </span>
            )}
            {hasAfter && (
              <span style={{ fontSize: 13, color: 'var(--accent)' }}>
                Après : <strong>{ba.after}/{max}</strong>
              </span>
            )}
            {diff !== null && (
              <span className="score-badge" style={{ borderColor: diffCol, color: diffCol }}>
                Δ {diff > 0 ? '+' : ''}{diff}
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'repeatable': {
      if (!Array.isArray(value) || !value.length) return null
      const rows = (value as Array<{ nom?: string; note?: string }>)
        .filter(r => r?.nom?.trim())
      if (!rows.length) return null
      return (
        <div>
          <div className="detail-label">{displayLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {rows.map((row, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, fontSize: 12, padding: '4px 10px',
                borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border-soft)',
                alignItems: 'baseline',
              }}>
                <strong style={{ flexShrink: 0 }}>{row.nom}</strong>
                {row.note?.trim() && <span style={{ color: 'var(--text-muted)' }}>{row.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )
    }

    case 'bodychart': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const front: string[] = Array.isArray(value.front) ? value.front : []
      const back: string[] = Array.isArray(value.back) ? value.back : []
      const left: string[] = Array.isArray(value.left) ? value.left : []
      const right: string[] = Array.isArray(value.right) ? value.right : []
      const details: Record<string, any> = value.details && typeof value.details === 'object' ? value.details : {}
      const rows = [
        ...front.map(zone => ({ side: 'Antérieur',    zone, detail: details[`front:${zone}`] || {} })),
        ...back.map(zone  => ({ side: 'Postérieur',   zone, detail: details[`back:${zone}`]  || {} })),
        ...left.map(zone  => ({ side: 'Profil gauche',zone, detail: details[`left:${zone}`]  || {} })),
        ...right.map(zone => ({ side: 'Profil droit', zone, detail: details[`right:${zone}`] || {} })),
      ]
      const notes = typeof value.notes === 'string' ? value.notes.trim() : ''
      if (!rows.length && !notes) return null
      return (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="detail-label">{displayLabel}</div>
          {rows.length > 0 && (
            <div className="bodychart-summary-list">
              {rows.map(row => (
                <div key={`${row.side}-${row.zone}`} className="bodychart-summary-row">
                  <strong>{row.zone}</strong>
                  <span>{row.side}</span>
                  {row.detail?.symptom && <span>{row.detail.symptom}</span>}
                  {row.detail?.laterality && row.detail.laterality !== 'Non precise' && <span>{row.detail.laterality}</span>}
                  {typeof row.detail?.intensity === 'number' && <span>{row.detail.intensity}/10</span>}
                  {row.detail?.note && <em>{row.detail.note}</em>}
                </div>
              ))}
            </div>
          )}
          {notes && <div className="detail-value" style={{ marginTop: 8 }}>{notes}</div>}
        </div>
      )
    }

    // ── Modules MTC ──────────────────────────────────────────────────────────────

    case 'mtc_systemes': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const sys = value as Record<string, { checked?: string[]; note?: string; [k: string]: any }>
      const SYSTEME_LABELS: Record<string, string> = {
        cardio: 'Cardio-vasculaire', pulmo: 'Respiratoire / Pulmonaire',
        mental: 'Mental / Émotionnel', vision: 'Vision / Yeux',
        reins: 'Reins / Urinaire', rate: 'Rate / Digestion',
        estomac: 'Estomac', grosIntestin: 'Gros Intestin', peau: 'Peau',
        tete: 'Tête / ORL', temp: 'Température / Transpiration',
        musculo: 'Musculo-squelettique', feminin: 'Gynécologique',
        fertilite: 'Fertilité / Grossesse', masculin: 'Masculin',
      }
      const entries = Object.entries(sys).filter(([, data]) => {
        if (!data || typeof data !== 'object') return false
        return (Array.isArray(data.checked) && data.checked.length) || data.note ||
          data.stress || data.anxiete || data.energie || data.douleur
      })
      if (!entries.length) return null
      return (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="detail-label">{displayLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
            {entries.map(([key, data]) => {
              const numerics: string[] = []
              if (typeof data.stress === 'number' && data.stress) numerics.push(`Stress ${data.stress}/10`)
              if (typeof data.anxiete === 'number' && data.anxiete) numerics.push(`Anxiété ${data.anxiete}/10`)
              if (typeof data.energie === 'number' && data.energie) numerics.push(`Énergie ${data.energie}/10`)
              if (typeof data.douleur === 'number' && data.douleur) numerics.push(`Douleur ${data.douleur}/10`)
              if (data.localisation) numerics.push(`Localisation: ${data.localisation}`)
              return (
                <div key={key} style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--accent-light)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                    {SYSTEME_LABELS[key] || key}
                    {numerics.length > 0 && <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--text-muted)' }}>{numerics.join(' · ')}</span>}
                  </div>
                  {Array.isArray(data.checked) && data.checked.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: data.note ? 4 : 0 }}>
                      {(data.checked as string[]).map((c: string) => (
                        <span key={c} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>{c}</span>
                      ))}
                    </div>
                  )}
                  {data.note && <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>{data.note}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'mtc_five_elements': {
      if (!value || typeof value !== 'object') return null
      const fe = value as { selected?: string[]; notes?: Record<string, string>; generalNote?: string }
      const ELEMENT_META: Record<string, { label: string; color: string; emoji: string }> = {
        bois:  { label: 'Bois',  color: '#4e8a5e', emoji: '🌿' },
        feu:   { label: 'Feu',   color: '#c94040', emoji: '🔥' },
        terre: { label: 'Terre', color: '#b8841e', emoji: '🌍' },
        metal: { label: 'Métal', color: '#6a7f94', emoji: '⚙️' },
        eau:   { label: 'Eau',   color: '#2e6ca8', emoji: '💧' },
      }
      const selected = Array.isArray(fe.selected) ? fe.selected : []
      if (!selected.length && !fe.generalNote) return null
      return (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="detail-label">{displayLabel}</div>
          {selected.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 8 }}>
              {selected.map(key => {
                const m = ELEMENT_META[key]
                if (!m) return null
                return (
                  <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: m.color + '15', border: `1.5px solid ${m.color}55`, color: m.color, fontSize: 12, fontWeight: 700 }}>
                    {m.emoji} {m.label}
                  </span>
                )
              })}
            </div>
          )}
          {selected.map(key => {
            const note = (fe.notes || {})[key]
            if (!note) return null
            const m = ELEMENT_META[key]
            return (
              <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{m?.emoji}</span>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m?.color }}>{m?.label} — </span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{note}</span>
                </div>
              </div>
            )
          })}
          {fe.generalNote && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Synthèse</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{fe.generalNote}</div>
            </div>
          )}
        </div>
      )
    }

    case 'mtc_tongue_pulse': {
      if (!value || typeof value !== 'object') return null
      const tp = value as {
        tongue?: { color?: string; coatColor?: string; coatTextures?: string[]; moisture?: string; shapes?: string[]; note?: string }
        pulse?: { positions?: Record<string, { qualities?: string[]; note?: string }>; globalNote?: string }
      }
      const TONGUE_COLOR_LABELS: Record<string, string> = {
        pale: 'Pâle', rose: 'Rose', rouge: 'Rouge', rouge_vif: 'Rouge vif', violace: 'Violacée', bleue: 'Bleue',
      }
      const TONGUE_COAT_COLOR_LABELS: Record<string, string> = { blanc: 'Blanc', jaune: 'Jaune', gris: 'Gris', noir: 'Noir' }
      const TONGUE_MOISTURE_LABELS: Record<string, string> = {
        tres_seche: 'Très sèche', seche: 'Sèche', normale: 'Normale', humide: 'Humide', tres_humide: 'Très humide',
      }
      const POSITION_LABELS: Record<string, string> = {
        cun_g: 'Cun G / Cœur', guan_g: 'Guan G / Foie', chi_g: 'Chi G / Reins Yin',
        cun_d: 'Cun D / Poumon', guan_d: 'Guan D / Rate', chi_d: 'Chi D / Reins Yang',
      }
      const QUALITY_LABELS: Record<string, string> = {
        flottant: 'Flottant', profond: 'Profond', lent: 'Lent', rapide: 'Rapide',
        vide: 'Vide', plein: 'Plein', glissant: 'Glissant', rugueux: 'Rugueux',
        faible: 'Faible', fin: 'Fin', tenu: 'Ténu', mou: 'Mou', court: 'Court', creux: 'Creux',
        peau_tambour: 'En Peau de tambour', cache: 'Caché', disperse: 'Dispersé', corde: 'En Corde',
        serre: 'Serré', vaste: 'Vaste', grand: 'Grand', ferme: 'Ferme', long: 'Long',
        remuant: 'Remuant', noue: 'Noué', precipite: 'Précipité', accelere: 'Accéléré',
        periodique: 'Périodique', ralenti: 'Ralenti',
      }
      const POSITION_ORDER = ['cun_g', 'guan_g', 'chi_g', 'cun_d', 'guan_d', 'chi_d']
      const tongue = tp.tongue || {}
      const hasTongue = tongue.color || tongue.coatColor || tongue.moisture ||
        (tongue.coatTextures && tongue.coatTextures.length) ||
        (tongue.shapes && tongue.shapes.length) || tongue.note
      const positions = tp.pulse?.positions || {}
      const hasPositions = POSITION_ORDER.some(id => {
        const p = positions[id]; return p && ((p.qualities && p.qualities.length) || p.note)
      })
      if (!hasTongue && !hasPositions && !tp.pulse?.globalNote) return null
      return (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="detail-label">{displayLabel}</div>
          {hasTongue && (
            <div style={{ marginTop: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>👅 Langue</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {tongue.color && <span className="detail-chip">{TONGUE_COLOR_LABELS[tongue.color] || tongue.color}</span>}
                {tongue.coatColor && <span className="detail-chip">Enduit {TONGUE_COAT_COLOR_LABELS[tongue.coatColor] || tongue.coatColor}</span>}
                {(tongue.coatTextures || []).map((t: string) => <span key={t} className="detail-chip">{t}</span>)}
                {tongue.moisture && <span className="detail-chip">{TONGUE_MOISTURE_LABELS[tongue.moisture] || tongue.moisture}</span>}
                {(tongue.shapes || []).map((s: string) => <span key={s} className="detail-chip">{s}</span>)}
              </div>
              {tongue.note && <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text)', fontStyle: 'italic' }}>{tongue.note}</div>}
            </div>
          )}
          {hasPositions && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>💓 Pouls</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {POSITION_ORDER.map(id => {
                  const pos = positions[id]
                  if (!pos || (!pos.qualities?.length && !pos.note)) return null
                  return (
                    <div key={id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border-soft)', background: 'var(--accent-light)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{POSITION_LABELS[id]}</div>
                      {pos.qualities && pos.qualities.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: pos.note ? 3 : 0 }}>
                          {pos.qualities.map((q: string) => (
                            <span key={q} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
                              {QUALITY_LABELS[q] || q}
                            </span>
                          ))}
                        </div>
                      )}
                      {pos.note && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{pos.note}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {tp.pulse?.globalNote && (
            <div style={{ fontSize: 11, color: 'var(--text)', borderTop: '1px solid var(--border-soft)', paddingTop: 6, fontStyle: 'italic' }}>
              {tp.pulse.globalNote}
            </div>
          )}
        </div>
      )
    }

    // ── Modules Ostéo ─────────────────────────────────────────────────────────

    case 'osteo_ortho_tests': {
      if (!Array.isArray(value) || !value.length) return null
      const tests = value as Array<{ id?: string; name?: string; result?: string; note?: string }>
      const RESULT_META: Record<string, { label: string; color: string }> = {
        positif:       { label: 'Positif',       color: '#c94040' },
        negatif:       { label: 'Négatif',       color: '#4e8a5e' },
        non_concluant: { label: 'Non concluant', color: '#b8841e' },
      }
      const positifs = tests.filter(t => t.result === 'positif').length
      return (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="detail-label">
            {displayLabel}
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
              {tests.length} test{tests.length > 1 ? 's' : ''}
              {positifs > 0 && <span style={{ color: '#c94040', marginLeft: 6 }}>· {positifs} positif{positifs > 1 ? 's' : ''}</span>}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {tests.map((t, i) => {
              if (!t.name) return null
              const rm = t.result ? RESULT_META[t.result] : null
              return (
                <div key={t.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 10px', borderRadius: 7, border: `1px solid ${rm ? rm.color + '44' : 'var(--border)'}`, background: rm ? rm.color + '08' : 'transparent' }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                  {rm && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 12, background: rm.color + '20', color: rm.color, flexShrink: 0 }}>{rm.label}</span>}
                  {t.note && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.note}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'osteo_posture': {
      if (!value || typeof value !== 'object') return null
      const pv = value as Record<string, { findings?: string[]; note?: string }>
      const VIEW_META_POSTURE: Array<{ key: string; label: string; short: string }> = [
        { key: 'anterieure',      label: 'Vue antérieure',  short: 'ANT'  },
        { key: 'posterieure',     label: 'Vue postérieure', short: 'POST' },
        { key: 'laterale_gauche', label: 'Profil gauche',   short: 'GAU'  },
        { key: 'laterale_droite', label: 'Profil droit',    short: 'DRO'  },
      ]
      const views = VIEW_META_POSTURE.filter(v => {
        const d = pv[v.key]; return d && ((d.findings && d.findings.length) || d.note)
      })
      if (!views.length) return null
      const totalFindings = VIEW_META_POSTURE.reduce((n, v) => n + (pv[v.key]?.findings?.length || 0), 0)
      return (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="detail-label">
            {displayLabel}
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
              {totalFindings} observation{totalFindings > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            {views.map(v => {
              const d = pv[v.key]!
              return (
                <div key={v.key}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 5 }}>
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff', fontSize: 9, marginRight: 6 }}>{v.short}</span>
                    {v.label}
                  </div>
                  {d.findings && d.findings.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: d.note ? 5 : 0 }}>
                      {d.findings.map(f => (
                        <span key={f} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--accent-light)', color: 'var(--text)' }}>
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {d.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{d.note}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'mtc_aide_interrogatoire':
      return null // display-only, pas de données à afficher dans le résumé

    default:
      return null
  }
}
