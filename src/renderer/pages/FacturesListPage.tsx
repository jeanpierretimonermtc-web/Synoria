import React, { useEffect, useState, useContext } from 'react'
import type { InvoiceLog } from '../../shared/types'
import { ToastContext } from '../App'
import { useRestriction } from '../hooks/useRestriction'
import { EditIcon, TrashIcon } from '../components/common/Icon'
import { showConfirm } from '../components/common/ConfirmDialog'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ── Modal édition ────────────────────────────────────────────────────────────

function EditModal({ inv, onClose, onSaved }: {
  inv: InvoiceLog
  onClose: () => void
  onSaved: () => void
}) {
  const showToast = useContext(ToastContext)
  const [saving, setSaving] = useState(false)

  const [invoiceDate,  setInvoiceDate]  = useState(inv.invoice_date  || '')
  const [sessionDate,  setSessionDate]  = useState(inv.session_date  || '')
  const [firstName,    setFirstName]    = useState(inv.patient_first_name || '')
  const [lastName,     setLastName]     = useState(inv.patient_last_name  || '')
  const [address,      setAddress]      = useState(inv.patient_address   || '')
  const [email,        setEmail]        = useState(inv.email             || '')
  const [phone,        setPhone]        = useState(inv.phone             || '')
  const [description,  setDescription]  = useState(inv.description       || '')
  const [montantStr,   setMontantStr]   = useState(String(inv.montant).replace('.', ','))

  const handleSave = async () => {
    const montant = parseFloat(montantStr.replace(',', '.'))
    if (isNaN(montant) || montant <= 0) {
      showToast('Montant invalide', 'error')
      return
    }
    setSaving(true)
    try {
      await window.mtcApi.updateInvoiceLog(inv.id, {
        invoice_date:       invoiceDate,
        session_date:       sessionDate || undefined,
        patient_first_name: firstName,
        patient_last_name:  lastName,
        patient_address:    address || undefined,
        email:              email   || undefined,
        phone:              phone   || undefined,
        description:        description || undefined,
        montant,
      })
      showToast('Facture mise à jour ✓', 'success')
      onSaved()
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>✏️</span>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Modifier la facture</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              N° {inv.invoice_number}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Date d'émission</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Date de séance</label>
            <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
          </div>
        </div>

        {/* Patient */}
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Prénom patient</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label>Nom patient</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Adresse</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
        </div>

        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Désignation</label>
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="field" style={{ marginBottom: 20 }}>
          <label>Montant (€)</label>
          <input
            type="text" inputMode="decimal"
            value={montantStr}
            onChange={e => setMontantStr(e.target.value)}
            style={{ fontSize: 20, fontWeight: 800, textAlign: 'right', color: 'var(--blue)' }}
          />
        </div>

        <div style={{
          background: 'var(--amber-light)',
          border: '1px solid rgba(193,123,42,.2)',
          borderRadius: 8, padding: '8px 12px',
          fontSize: 11, color: 'var(--amber)', marginBottom: 20,
        }}>
          ⚠️ Cette modification met à jour uniquement l'enregistrement dans le journal. Le fichier PDF sur disque n'est pas modifié.
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Enregistrement…' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal suppression ────────────────────────────────────────────────────────

function DeleteModal({ inv, onClose, onDeleted }: {
  inv: InvoiceLog
  onClose: () => void
  onDeleted: () => void
}) {
  const showToast = useContext(ToastContext)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await window.mtcApi.deleteInvoiceLog(inv.id)
      showToast('Facture supprimée ✓', 'success')
      onDeleted()
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
    }
    setDeleting(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div style={{ textAlign: 'center', padding: '8px 0 8px' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🗑️</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Supprimer la facture ?</h2>

          <div style={{
            background: 'var(--blue-light)',
            border: '1px solid rgba(42,90,138,.2)',
            borderRadius: 10, padding: '10px 16px',
            marginBottom: 16, textAlign: 'left',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 14 }}>
              N° {inv.invoice_number}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {inv.patient_first_name} {inv.patient_last_name.toUpperCase()} · {inv.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
          </div>

          <div style={{
            background: 'var(--red-light)',
            border: '1px solid rgba(168,50,50,.2)',
            borderRadius: 8, padding: '8px 12px',
            fontSize: 11, color: 'var(--red)', marginBottom: 24, textAlign: 'left',
          }}>
            ⚠️ L'enregistrement sera supprimé du journal. Le fichier PDF sur disque ne sera pas effacé.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: 'var(--red)', color: '#fff', borderColor: 'var(--red)',
                padding: '9px 22px', fontWeight: 600,
              }}
            >
              {deleting ? '⏳ Suppression…' : '🗑️ Confirmer la suppression'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function FacturesListPage() {
  const showToast   = useContext(ToastContext)
  const restriction = useRestriction()
  const [year,     setYear]     = useState(new Date().getFullYear())
  const [invoices, setInvoices] = useState<InvoiceLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filterMo, setFilterMo] = useState(0)

  const [editInv,   setEditInv]   = useState<InvoiceLog | null>(null)
  const [deleteInv, setDeleteInv] = useState<InvoiceLog | null>(null)

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
  const euro  = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
  }

  const handleSaved = () => { setEditInv(null);   load(year) }
  const handleDeleted = () => { setDeleteInv(null); load(year) }

  const handleSendEmail = async (inv: InvoiceLog) => {
    try {
      const { pdfAttached } = await window.mtcApi.sendInvoiceByEmail(inv.id)
      if (pdfAttached) {
        showToast('Email préparé dans Outlook avec la facture en pièce jointe. Vérifiez et envoyez.')
      } else {
        showToast("Email préparé dans votre client mail. La facture PDF a été mise en évidence dans l'Explorateur — glissez-la dans l'email si nécessaire.", 'success')
      }
    } catch (e: any) {
      showToast(`Impossible d'ouvrir le client mail : ${e?.message || e}`, 'error')
    }
  }

  return (
    <div>
      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}>◀</button>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--blue)', minWidth: 50, textAlign: 'center' }}>
            {year}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}>▶</button>
        </div>
        <select value={filterMo} onChange={e => setFilterMo(Number(e.target.value))} style={{ width: 140 }}>
          <option value={0}>Tous les mois</option>
          {MONTHS_FR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <div className="factures-kpi">
          <span className="factures-kpi-count">{filtered.length} facture{filtered.length > 1 ? 's' : ''}</span>
          <span className="factures-kpi-total">{euro(total)}</span>
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">Aucune facture pour cette période.</div>
      ) : (
        <div className="factures-table-wrap">
          <table className="factures-table">
            <thead>
              <tr className="factures-thead-row">
                {['N° Facture','Date','Patient','Description','Montant','Statut','Actions'].map(h => (
                  <th key={h} className={`factures-th${h === 'Montant' ? ' factures-th-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr key={inv.id} className={`factures-row${idx % 2 === 0 ? '' : ' factures-row-alt'}${inv.is_paid ? ' factures-row-paid' : ''}`}>
                  <td className="factures-td factures-num">
                    {inv.invoice_number}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(inv.invoice_date)}</td>
                  <td className="factures-td">
                    <div style={{ fontWeight: 700 }}>{inv.patient_last_name.toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.patient_first_name}</div>
                  </td>
                  <td className="factures-td factures-desc">
                    {inv.description || <span style={{ color: 'var(--text-hint)' }}>—</span>}
                  </td>
                  <td className="factures-td factures-montant">{euro(inv.montant)}</td>
                  {/* Badge statut paiement */}
                  <td className="factures-td" style={{ whiteSpace: 'nowrap' }}>
                    {inv.is_paid
                      ? <span className="badge badge-green" title={inv.paid_date ? `Payé le ${fmtDate(inv.paid_date)}` : 'Payé'}>✓ Payée</span>
                      : <span className="badge badge-amber">En attente</span>
                    }
                  </td>
                  <td className="factures-td">
                    {inv.file_path
                      ? <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.mtcApi.openPath(inv.file_path!)}>📄 PDF</button>
                      : <span style={{ color: 'var(--text-hint)' }}>—</span>
                    }
                  </td>
                  <td className="factures-td-actions">
                    <div style={{ display: 'flex', gap: 5 }}>
                      {/* Bouton paiement */}
                      <button
                        className="btn btn-secondary btn-sm factures-action-btn"
                        style={{ color: inv.is_paid ? 'var(--amber)' : 'var(--accent)', borderColor: inv.is_paid ? 'var(--amber)' : 'var(--accent-mid)' }}
                        title={!restriction.canCreateInvoice ? 'Mode restreint — abonnement requis' : inv.is_paid ? 'Marquer comme non payée' : 'Marquer comme payée'}
                        disabled={!restriction.canCreateInvoice}
                        onClick={async () => {
                          await window.mtcApi.markInvoicePaid(inv.id, !inv.is_paid)
                          load(year)
                        }}>
                        {inv.is_paid ? '↩ Non payée' : '✓ Payée'}
                      </button>
                      {inv.email && (
                        <button className="btn btn-secondary btn-sm factures-action-btn factures-action-teal"
                          title={`Email à ${inv.email}`} onClick={() => handleSendEmail(inv)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" />
                          </svg>
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm factures-action-btn factures-action-blue"
                        title={!restriction.canCreateInvoice ? 'Mode restreint — abonnement requis' : 'Modifier'}
                        disabled={!restriction.canCreateInvoice}
                        onClick={() => setEditInv(inv)}>
                        <EditIcon size={12} />
                      </button>
                      <button className="btn btn-secondary btn-sm factures-action-btn factures-action-red"
                        title={!restriction.canCreateInvoice ? 'Mode restreint — abonnement requis' : 'Supprimer'}
                        disabled={!restriction.canCreateInvoice}
                        onClick={() => setDeleteInv(inv)}>
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="factures-tfoot">
                <td colSpan={4} className="factures-td" style={{ fontWeight: 700, color: 'var(--blue)' }}>TOTAL {filtered.length} facture{filtered.length > 1 ? 's' : ''}</td>
                <td className="factures-montant-total">{euro(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {editInv   && <EditModal   inv={editInv}   onClose={() => setEditInv(null)}   onSaved={handleSaved}   />}
      {deleteInv && <DeleteModal inv={deleteInv} onClose={() => setDeleteInv(null)} onDeleted={handleDeleted} />}
    </div>
  )
}
