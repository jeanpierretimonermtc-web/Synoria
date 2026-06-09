import React, { useEffect, useState, useContext } from 'react'
import type { InvoiceLog } from '../../shared/types'
import { ToastContext } from '../App'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function FacturesListPage() {
  const showToast = useContext(ToastContext)
  const [year,      setYear]     = useState(new Date().getFullYear())
  const [invoices,  setInvoices] = useState<InvoiceLog[]>([])
  const [loading,   setLoading]  = useState(true)
  const [filterMo,  setFilterMo] = useState(0)   // 0 = tous

  const load = async (y: number) => {
    setLoading(true)
    try { setInvoices(await window.mtcApi.getInvoicesLog(y)) }
    catch { showToast('Erreur chargement factures', 'error') }
    setLoading(false)
  }

  useEffect(() => { load(year) }, [year])

  const filtered = filterMo === 0
    ? invoices
    : invoices.filter(inv => {
        const d = new Date(inv.invoice_date)
        return !isNaN(d.getTime()) && d.getMonth() + 1 === filterMo
      })

  const total = filtered.reduce((s, i) => s + i.montant, 0)
  const euro  = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
  }

  return (
    <div>
      {/* Barre de filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}>◀</button>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--blue)', minWidth: 50, textAlign: 'center' }}>{year}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}>▶</button>
        </div>
        <select value={filterMo} onChange={e => setFilterMo(Number(e.target.value))} style={{ width: 140 }}>
          <option value={0}>Tous les mois</option>
          {MONTHS_FR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
          {filtered.length} facture{filtered.length > 1 ? 's' : ''} · {euro(total)}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">Aucune facture pour cette période.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--blue)', color: '#fff' }}>
                {['N° Facture','Date','Nom','Prénom','Adresse','Email','Téléphone','Montant','Fichier'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr key={inv.id} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap' }}>{inv.invoice_number}</td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(inv.invoice_date)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{inv.patient_last_name.toUpperCase()}</td>
                  <td style={{ padding: '8px 12px' }}>{inv.patient_first_name}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{inv.patient_address || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{inv.email || '—'}</td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{inv.phone || '—'}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{euro(inv.montant)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {inv.file_path ? (
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                        onClick={() => window.mtcApi.openPath(inv.file_path!)}>
                        📄 Ouvrir
                      </button>
                    ) : <span style={{ color: 'var(--text-hint)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--blue)', color: '#fff' }}>
                <td colSpan={7} style={{ padding: '9px 12px', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>{euro(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
