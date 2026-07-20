import React, { useEffect, useState, useContext } from 'react'
import { useLocation } from 'react-router-dom'
import type { InvoiceLog } from '../../shared/types'
import { ToastContext } from '../App'
import { useRestriction } from '../hooks/useRestriction'
import { EditIcon, TrashIcon } from '../components/common/Icon'
import { showConfirm } from '../components/common/ConfirmDialog'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ── Modal email ─────────────────────────────────────────────────────────────

function EmailModal({ inv, onClose, onEditInv }: {
  inv: InvoiceLog
  onClose: () => void
  onEditInv: () => void
}) {
  const showToast              = useContext(ToastContext)
  const [loading,  setLoading] = useState(true)
  const [noEmail,  setNoEmail] = useState(false)
  const [to,       setTo]      = useState('')
  const [subject,  setSubject] = useState('')
  const [body,     setBody]    = useState('')
  const [pdfPath,  setPdfPath] = useState<string | null>(null)
  const [fileName, setFileName]= useState<string | null>(null)
  const [opening,  setOpening] = useState(false)

  useEffect(() => {
    window.mtcApi.getInvoiceEmailData(inv.id)
      .then(data => {
        if (!data.to) {
          setNoEmail(true)
        } else {
          setTo(data.to)
          setSubject(data.subject ?? '')
          setBody(data.body ?? '')
          setPdfPath(data.pdfPath)
          setFileName(data.fileName)
        }
        setLoading(false)
      })
      .catch((e: any) => {
        showToast(`Erreur : ${e?.message || e}`, 'error')
        onClose()
      })
  }, [])

  const handleOpen = async () => {
    setOpening(true)
    try {
      await window.mtcApi.openInvoiceEmailClient(to, subject, body, pdfPath)
      showToast(
        pdfPath
          ? '✓ Messagerie ouverte — la facture PDF est jointe automatiquement.'
          : '✓ Messagerie ouverte.',
        'success'
      )
      onClose()
    } catch (e: any) {
      showToast(`Impossible d'ouvrir le client mail : ${e?.message || e}`, 'error')
    }
    setOpening(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>📧</span>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Envoyer la facture par email</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>N° {inv.invoice_number}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="loading-dots"><span /><span /><span /></div>
          </div>
        ) : noEmail ? (
          <>
            <div style={{
              background: 'var(--amber-light, #fffbeb)',
              border: '1px solid rgba(180,120,0,.2)',
              borderRadius: 8, padding: '14px 16px', marginBottom: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Aucun email sur cette facture</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Pour envoyer cette facture par email, ajoutez d'abord<br />
                l'adresse email du patient via le bouton <strong>Modifier</strong>.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { onClose(); onEditInv() }}>
                ✏️ Modifier la facture
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Destinataire</label>
              <input value={to} readOnly style={{ opacity: 0.7 }} />
            </div>

            <div className="field" style={{ marginBottom: 10 }}>
              <label>Objet</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>
                Message{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(modifiable)</span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                style={{ resize: 'vertical', fontSize: 12, lineHeight: 1.6 }}
              />
            </div>

            {pdfPath && fileName ? (
              <div style={{
                background: 'var(--accent-light)', border: '1px solid var(--accent-mid)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>📎</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>Pièce jointe automatique</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>📄 {fileName}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => window.mtcApi.openPath(pdfPath!)}>Ouvrir</button>
              </div>
            ) : (
              <div style={{
                background: 'rgba(180,120,0,.08)', border: '1px solid rgba(180,120,0,.2)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--amber)',
              }}>
                ⚠️ Aucun PDF disponible — générez d'abord le PDF via le bouton 🔄 dans le tableau.
              </div>
            )}

            <div style={{
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8,
              marginBottom: 20, padding: '8px 12px',
              background: 'var(--surface-alt)', borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <strong style={{ color: 'var(--text)' }}>Comment procéder :</strong><br />
              1. Vérifiez et modifiez l'objet et le message si besoin<br />
              2. Cliquez sur <strong>"Ouvrir ma messagerie"</strong><br />
              3. {pdfPath ? <>Outlook s'ouvre avec <strong>la facture PDF déjà jointe</strong> — il ne reste qu'à envoyer</> : <>Votre messagerie s'ouvre avec l'adresse et l'objet déjà remplis</>}<br />
              4. Vérifiez et envoyez
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" onClick={handleOpen} disabled={opening}>
                {opening ? '⏳…' : '📧 Ouvrir ma messagerie →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

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

      const wantsPdf = await showConfirm({
        message: 'Voulez-vous régénérer le PDF avec les modifications ?',
        title: 'Régénérer le PDF',
        confirmLabel: 'Oui, régénérer',
        cancelLabel: 'Non',
      })
      if (wantsPdf) {
        try {
          await window.mtcApi.regenerateInvoicePdf(inv.id, inv.invoice_number, {
            patientFirstName: firstName,
            patientLastName:  lastName,
            patientAddress:   address   || undefined,
            email:            email     || undefined,
            phone:            phone     || undefined,
            sessionDate:      sessionDate || invoiceDate,
            description:      description || '',
            invoiceDate,
            montant,
          })
          showToast('PDF régénéré ✓', 'success')
        } catch (e: any) {
          showToast(`Erreur génération PDF : ${e?.message || e}`, 'error')
        }
      }

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
          background: 'var(--blue-light)',
          border: '1px solid rgba(42,90,138,.15)',
          borderRadius: 8, padding: '8px 12px',
          fontSize: 11, color: 'var(--blue)', marginBottom: 20,
        }}>
          💡 Après enregistrement, il vous sera proposé de régénérer le PDF.
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
  const location    = useLocation()
  const [year,          setYear]         = useState(new Date().getFullYear())
  const [invoices,      setInvoices]     = useState<InvoiceLog[]>([])
  const [loading,       setLoading]      = useState(true)
  const [filterMo,      setFilterMo]     = useState(0)
  const [patientFilter, setPatientFilter] = useState('')

  const [editInv,   setEditInv]   = useState<InvoiceLog | null>(null)
  const [deleteInv, setDeleteInv] = useState<InvoiceLog | null>(null)
  const [emailInv,  setEmailInv]  = useState<InvoiceLog | null>(null)

  useEffect(() => {
    const state = location.state as { patientName?: string } | null
    if (state?.patientName) setPatientFilter(state.patientName)
  }, [])

  const load = async (y: number) => {
    setLoading(true)
    try { setInvoices(await window.mtcApi.getInvoicesLog(y)) }
    catch { showToast('Erreur chargement factures', 'error') }
    setLoading(false)
  }

  useEffect(() => { load(year) }, [year])

  const filtered = invoices.filter(inv => {
    if (filterMo !== 0) {
      const d = new Date(inv.invoice_date)
      if (isNaN(d.getTime()) || d.getMonth() + 1 !== filterMo) return false
    }
    if (patientFilter) {
      const full = `${inv.patient_first_name} ${inv.patient_last_name}`.toLowerCase()
      if (!full.includes(patientFilter.toLowerCase())) return false
    }
    return true
  })

  const total = filtered.reduce((s, i) => s + i.montant, 0)
  const euro  = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
  }

  const handleSaved = () => { setEditInv(null);   load(year) }
  const handleDeleted = () => { setDeleteInv(null); load(year) }

  const handleRegenPdf = async (inv: InvoiceLog) => {
    const confirmed = await showConfirm({
      message: `Régénérer le PDF pour la facture N° ${inv.invoice_number} ?\n\nLe fichier sera recréé à partir des données du journal.`,
      title: 'Générer le PDF',
      confirmLabel: 'Générer',
    })
    if (!confirmed) return
    try {
      await window.mtcApi.regenerateInvoicePdf(inv.id, inv.invoice_number, {
        patientFirstName: inv.patient_first_name,
        patientLastName:  inv.patient_last_name,
        patientAddress:   inv.patient_address || undefined,
        email:            inv.email           || undefined,
        phone:            inv.phone           || undefined,
        sessionDate:      inv.session_date    || inv.invoice_date,
        description:      inv.description     || '',
        invoiceDate:      inv.invoice_date,
        montant:          inv.montant,
      })
      showToast('PDF généré ✓', 'success')
      load(year)
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
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
        {patientFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--amber-light)', borderRadius: 20, border: '1px solid rgba(180,120,0,.2)', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
            🧾 {patientFilter}
            <button onClick={() => setPatientFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontWeight: 800, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
          </div>
        )}
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
                {['N° Facture','Date','Patient','Description','Montant','Statut','PDF','Actions'].map(h => (
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
                  <td className="factures-td" style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {inv.file_path && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11 }}
                          title="Ouvrir le PDF"
                          onClick={() => window.mtcApi.openPath(inv.file_path!)}
                        >
                          📄 Ouvrir
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, color: 'var(--teal)' }}
                        title={inv.file_path ? 'Régénérer le PDF' : 'Générer le PDF'}
                        disabled={!restriction.canCreateInvoice}
                        onClick={() => handleRegenPdf(inv)}
                      >
                        {inv.file_path ? '🔄' : '➕ PDF'}
                      </button>
                    </div>
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
                        {inv.is_paid ? '↩ Marquer non payée' : '✓ Marquer payée'}
                      </button>
                      <button className="btn btn-secondary btn-sm factures-action-btn factures-action-teal"
                        title={inv.email ? `Envoyer par email à ${inv.email}` : 'Envoyer par email'}
                        onClick={() => setEmailInv(inv)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" />
                        </svg>
                      </button>
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
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {emailInv  && <EmailModal  inv={emailInv}  onClose={() => setEmailInv(null)} onEditInv={() => setEditInv(emailInv)} />}
      {editInv   && <EditModal   inv={editInv}   onClose={() => setEditInv(null)}   onSaved={handleSaved}   />}
      {deleteInv && <DeleteModal inv={deleteInv} onClose={() => setDeleteInv(null)} onDeleted={handleDeleted} />}
    </div>
  )
}
