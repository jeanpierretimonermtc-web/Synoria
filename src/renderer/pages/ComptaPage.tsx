import React, { useEffect, useState, useContext, useCallback, useRef } from 'react'
import type { ComptaYearData, ConsultationType } from '../../shared/types'
import { ToastContext } from '../App'
import { useRestriction } from '../hooks/useRestriction'

const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const VAR_CATS = [
  { key: 'publicite', label: 'Publicité' },
  { key: 'logiciel',  label: 'Logiciel' },
  { key: 'dasri',     label: 'DASRI' },
]

const euro = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const pct = (r: number) => (r * 100).toFixed(1) + ' %'

// ── Cellule éditable légère ────────────────────────────────────────

function EditCell({ value, onChange, isRate = false, isCurrency = false, readonly = false }: {
  value: number
  onChange: (v: number) => void
  isRate?: boolean
  isCurrency?: boolean
  readonly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw]         = useState('')
  const inputRef              = useRef<HTMLInputElement>(null)

  // Force le focus dès que l'input apparaît (autoFocus peu fiable dans Electron)
  useEffect(() => {
    if (editing) {
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [editing])

  const commit = () => {
    const cleaned = raw.replace(/\s/g, '').replace(',', '.').replace('%', '')
    const v = parseFloat(cleaned)
    onChange(isRate ? (isNaN(v) ? 0 : v / 100) : (isNaN(v) ? 0 : v))
    setEditing(false)
  }

  const display = isRate ? pct(value) : isCurrency ? euro(value) : String(value || '')

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={isRate ? 0.1 : 1}
        value={raw}
        className="compta-cell-input"
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Tab')   { e.preventDefault(); commit() }
          if (e.key === 'Escape') setEditing(false)
          e.stopPropagation()   // évite les raccourcis Ctrl+chiffre de la sidebar
        }}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <div
      className={`compta-cell-val${isRate ? ' compta-cell-rate' : ''}${isCurrency ? ' compta-cell-eur' : ''}`}
      onClick={readonly ? undefined : () => {
        setRaw(isRate ? String((value * 100).toFixed(1)) : (value > 0 ? String(value) : ''))
        setEditing(true)
      }}
      onKeyDown={readonly ? undefined : e => {
        if (e.key === 'Enter' || e.key === ' ') {
          setRaw(isRate ? String((value * 100).toFixed(1)) : (value > 0 ? String(value) : ''))
          setEditing(true)
        }
      }}
      tabIndex={readonly ? -1 : 0}
      title={readonly ? 'Mode restreint — abonnement requis' : 'Cliquer pour modifier'}
      role={readonly ? undefined : 'button'}
      style={readonly ? { cursor: 'not-allowed', opacity: 0.55 } : undefined}
    >
      {value ? display : <span className="compta-cell-zero">—</span>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function ComptaPage() {
  const showToast   = useContext(ToastContext)
  const restriction = useRestriction()
  const ro          = restriction.mode === 'restricted'
  const [year,    setYear]    = useState(new Date().getFullYear())
  const [data,    setData]    = useState<ComptaYearData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (y: number) => {
    setLoading(true)
    try { setData(await window.mtcApi.getComptaYearData(y)) }
    catch { showToast('Erreur chargement comptabilité', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load(year) }, [year])

  if (loading || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', flexDirection: 'column', gap: 12 }}>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )

  const types = data.consultationTypes.filter(t => t.is_active)

  // ── Getters ─────────────────────────────────────────────────────

  const getNb = (m: number, tid: string) =>
    data.monthlyRevenue.find(r => r.month === m && r.type_id === tid)?.nb_seances ?? 0

  const getRate = (m: number) =>
    data.ursafRates.find(u => u.month === m)?.rate ?? 0.256

  const fixedTotal = data.expenseConfig.reduce(
    (s, e) => s + (e.is_shared ? e.monthly_amount / 2 : e.monthly_amount), 0
  )

  const getVar = (m: number, cat: string) =>
    data.monthlyVarExpenses.find(v => v.month === m && v.category === cat)?.amount ?? 0

  const monthRev  = (m: number) => types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
  const monthDep  = (m: number) => fixedTotal + VAR_CATS.reduce((s, c) => s + getVar(m, c.key), 0)
  const monthUrs  = (m: number) => monthRev(m) * getRate(m)
  const monthNet1 = (m: number) => monthRev(m) - monthDep(m)
  const monthNet2 = (m: number) => monthNet1(m) - monthUrs(m)

  const annualRev  = Array.from({length:12}, (_,i) => monthRev(i+1)).reduce((a,b)=>a+b,0)
  const annualDep  = Array.from({length:12}, (_,i) => monthDep(i+1)).reduce((a,b)=>a+b,0)
  const annualUrs  = Array.from({length:12}, (_,i) => monthUrs(i+1)).reduce((a,b)=>a+b,0)
  const annualNet1 = annualRev - annualDep
  const annualNet2 = annualNet1 - annualUrs

  // ── Handlers ────────────────────────────────────────────────────

  const setNb = async (m: number, tid: string, nb: number) => {
    await window.mtcApi.setMonthlyRevenue(year, m, tid, nb)
    setData(d => {
      if (!d) return d
      const rev = d.monthlyRevenue.filter(r => !(r.month === m && r.type_id === tid))
      return { ...d, monthlyRevenue: [...rev, { year, month: m, type_id: tid, nb_seances: nb }] }
    })
  }

  const setRate = async (m: number, rate: number) => {
    await window.mtcApi.setUrsafRate(year, m, rate)
    setData(d => {
      if (!d) return d
      const rates = d.ursafRates.filter(r => r.month !== m)
      return { ...d, ursafRates: [...rates, { year, month: m, rate }] }
    })
  }

  const setVarExp = async (m: number, cat: string, label: string, amount: number) => {
    await window.mtcApi.setMonthlyVarExpense(year, m, cat, label, amount)
    setData(d => {
      if (!d) return d
      const ve = d.monthlyVarExpenses.filter(v => !(v.month === m && v.category === cat))
      return { ...d, monthlyVarExpenses: [...ve, { year, month: m, category: cat, label, amount }] }
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const path = await window.mtcApi.exportComptaExcel(year)
      showToast(`Export Excel ${year} créé ✓`, 'success')
      await window.mtcApi.openPath(path)
    } catch (e: any) { showToast(`Erreur export : ${e?.message || e}`, 'error') }
    setExporting(false)
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="compta-page">

      {/* ── KPI annuels ── */}
      <div className="compta-kpi-bar">
        <div className="compta-kpi compta-kpi-green">
          <div className="compta-kpi-icon">💰</div>
          <div>
            <div className="compta-kpi-label">CA Annuel Brut</div>
            <div className="compta-kpi-value">{euro(annualRev)}</div>
          </div>
        </div>
        <div className="compta-kpi compta-kpi-amber">
          <div className="compta-kpi-icon">📉</div>
          <div>
            <div className="compta-kpi-label">Total Charges</div>
            <div className="compta-kpi-value">{euro(annualDep + annualUrs)}</div>
          </div>
        </div>
        <div className="compta-kpi compta-kpi-teal">
          <div className="compta-kpi-icon">🏛</div>
          <div>
            <div className="compta-kpi-label">URSAF annuel</div>
            <div className="compta-kpi-value">{euro(annualUrs)}</div>
          </div>
        </div>
        <div className={`compta-kpi ${annualNet2 >= 0 ? 'compta-kpi-blue' : 'compta-kpi-red'}`}>
          <div className="compta-kpi-icon">📊</div>
          <div>
            <div className="compta-kpi-label">Net après URSAF</div>
            <div className="compta-kpi-value" style={{ color: annualNet2 < 0 ? 'var(--red)' : undefined }}>
              {euro(annualNet2)}
            </div>
          </div>
        </div>
      </div>

      {/* Barre de navigation année */}
      <div className="compta-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}>◀</button>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--blue)', minWidth: 60, textAlign: 'center' }}>{year}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}>▶</button>
          {data.years.length > 0 && (
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 90 }}>
              {data.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting}>
          {exporting ? '⏳' : '📥'} Export Excel
        </button>
        <button
          className="btn btn-secondary btn-sm"
          title="Rapport annuel — CA par trimestre + cotisations Urssaf estimées"
          onClick={async () => {
            try {
              const path = await window.mtcApi.exportUrssafReport(year)
              await window.mtcApi.openPath(path)
            } catch (e: any) { alert(`Erreur : ${e?.message || e}`) }
          }}
        >
          📊 Rapport Urssaf {year}
        </button>
      </div>

      <div className="compta-table-wrap">
        <table className="compta-table">
          <colgroup>
            <col style={{ width: 180 }} />
            <col style={{ width: 60 }} />
            {MONTHS_SHORT.map(m => <col key={m} style={{ width: 58 }} />)}
            <col style={{ width: 70 }} />
          </colgroup>

          {/* ── En-tête mois ── */}
          <thead>
            <tr>
              <th className="compta-th compta-th-label">Type</th>
              <th className="compta-th">Tarif</th>
              {MONTHS_SHORT.map(m => <th key={m} className="compta-th">{m}</th>)}
              <th className="compta-th compta-th-total">Total</th>
            </tr>
          </thead>

          <tbody>
            {/* ── Section revenus ── */}
            <tr><td colSpan={15} className="compta-section-hdr compta-section-green">💰 REVENUS</td></tr>

            {types.map(t => (
              <tr key={t.id} className="compta-row">
                <td className="compta-td-label">{t.name}</td>
                <td className="compta-td-tarif">{t.price} €</td>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => {
                  const nb  = getNb(m, t.id)
                  const rev = nb * t.price
                  return (
                    <td key={m} className="compta-td">
                      <EditCell value={nb} onChange={v => setNb(m, t.id, Math.round(v))} readonly={ro} />
                      {nb > 0 && <div className="compta-sub-rev">{rev.toFixed(0)} €</div>}
                    </td>
                  )
                })}
                <td className="compta-td-annual">
                  <div>{Array.from({length:12},(_,i)=>getNb(i+1,t.id)).reduce((a,b)=>a+b,0)}</div>
                  <div className="compta-sub-rev">{(Array.from({length:12},(_,i)=>getNb(i+1,t.id)*t.price).reduce((a,b)=>a+b,0)).toFixed(0)} €</div>
                </td>
              </tr>
            ))}

            {/* Total revenus */}
            <tr className="compta-row-total compta-total-green">
              <td className="compta-td-label" style={{ fontWeight: 700 }}>TOTAL REVENUS</td>
              <td />
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <td key={m} className="compta-td compta-td-total-val">{euro(monthRev(m))}</td>
              ))}
              <td className="compta-td-annual compta-td-total-val">{euro(annualRev)}</td>
            </tr>

            {/* ── Section dépenses ── */}
            <tr><td colSpan={15} className="compta-section-hdr compta-section-amber">📉 DÉPENSES</td></tr>

            {/* Charges fixes */}
            <tr className="compta-row">
              <td className="compta-td-label">
                Loyer + Assurance
                <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>{euro(fixedTotal)}/mois</div>
              </td>
              <td />
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <td key={m} className="compta-td">
                  <div className="compta-cell-val compta-cell-eur">{euro(fixedTotal)}</div>
                </td>
              ))}
              <td className="compta-td-annual">{euro(fixedTotal * 12)}</td>
            </tr>

            {/* Dépenses variables */}
            {VAR_CATS.map(vc => (
              <tr key={vc.key} className="compta-row">
                <td className="compta-td-label">{vc.label}</td>
                <td />
                {Array.from({length:12},(_,i)=>i+1).map(m => (
                  <td key={m} className="compta-td">
                    <EditCell
                      value={getVar(m, vc.key)}
                      onChange={v => setVarExp(m, vc.key, vc.label, v)}
                      isCurrency
                      readonly={ro}
                    />
                  </td>
                ))}
                <td className="compta-td-annual">
                  {euro(Array.from({length:12},(_,i)=>getVar(i+1,vc.key)).reduce((a,b)=>a+b,0))}
                </td>
              </tr>
            ))}

            {/* Total dépenses */}
            <tr className="compta-row-total compta-total-amber">
              <td className="compta-td-label" style={{ fontWeight: 700 }}>TOTAL DÉPENSES</td>
              <td />
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <td key={m} className="compta-td compta-td-total-val">{euro(monthDep(m))}</td>
              ))}
              <td className="compta-td-annual compta-td-total-val">{euro(annualDep)}</td>
            </tr>

            {/* ── Section URSAF ── */}
            <tr><td colSpan={15} className="compta-section-hdr compta-section-teal">🏛 URSAF</td></tr>

            <tr className="compta-row">
              <td className="compta-td-label">Taux URSAF</td>
              <td />
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <td key={m} className="compta-td">
                  <EditCell value={getRate(m)} onChange={v => setRate(m, v)} isRate readonly={ro} />
                </td>
              ))}
              <td />
            </tr>

            <tr className="compta-row">
              <td className="compta-td-label">Coût URSAF</td>
              <td />
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <td key={m} className="compta-td">
                  <div className="compta-cell-val compta-cell-eur">{euro(monthUrs(m))}</div>
                </td>
              ))}
              <td className="compta-td-annual">{euro(annualUrs)}</td>
            </tr>

            {/* ── Section résultats ── */}
            <tr><td colSpan={15} className="compta-section-hdr compta-section-blue">📊 RÉSULTATS</td></tr>

            {[
              { label: 'CA Brut',                  fn: monthRev,  annual: annualRev,  cls: '' },
              { label: 'CA Net (hors URSAF)',       fn: monthNet1, annual: annualNet1, cls: '' },
              { label: 'CA Net (après URSAF)',      fn: monthNet2, annual: annualNet2, cls: 'compta-result-final' },
            ].map(({ label, fn, annual, cls }) => (
              <tr key={label} className={`compta-row-total compta-total-blue ${cls}`}>
                <td className="compta-td-label" style={{ fontWeight: 700 }}>{label}</td>
                <td />
                {Array.from({length:12},(_,i)=>i+1).map(m => (
                  <td key={m} className="compta-td compta-td-result"
                    style={{ color: fn(m) < 0 ? 'var(--red)' : undefined }}>
                    {euro(fn(m))}
                  </td>
                ))}
                <td className="compta-td-annual compta-td-result"
                  style={{ color: annual < 0 ? 'var(--red)' : undefined }}>
                  {euro(annual)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
