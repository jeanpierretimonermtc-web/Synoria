import React, { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../shared/types'
import { ToastContext } from '../App'
import { fmtDate, getInitials, calcAge } from '../utils/format'

/* ─── Modal de facturation ─────────────────────────────────────── */
function InvoiceModal({ patient, onClose, showToast }: {
  patient: Patient
  onClose: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [sessionDate, setSessionDate] = useState(today)
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [description, setDescription] = useState('Médecine traditionnelle chinoise (acupuncture)')
  const [montantStr,  setMontantStr]  = useState('')
  const [generating,  setGenerating]  = useState(false)

  const montant = parseFloat(montantStr.replace(',', '.')) || 0
  const euro = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

  const handleGenerate = async () => {
    if (!montantStr || montant <= 0) { showToast('Veuillez saisir un montant', 'error'); return }
    setGenerating(true)
    try {
      const result = await window.mtcApi.generateInvoice({
        patientFirstName: patient.first_name,
        patientLastName:  patient.last_name,
        patientAddress:   patient.address || '',
        email:            patient.email || '',
        phone:            patient.phone || '',
        sessionDate, description, invoiceDate, montant,
      })
      showToast(`Facture ${result.invoiceNumber} créée ✓`, 'success')
      await window.mtcApi.openPath(result.filePath)
      onClose()
    } catch (e: any) {
      showToast(`Erreur génération facture : ${e?.message || e}`, 'error')
    }
    setGenerating(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span>🧾</span><span>Générer une facture</span>
        </h2>

        {/* Destinataire */}
        <div style={{ background: 'var(--blue-light)', border: '1px solid rgba(42,90,138,.2)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 14 }}>
            {patient.first_name} {patient.last_name}
          </div>
          {patient.address && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{patient.address}</div>}
        </div>

        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Date de la séance *</label>
            <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Date d'émission</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label>Désignation</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label>Montant * (€)</label>
          <input
            type="text" inputMode="decimal"
            value={montantStr}
            onChange={e => setMontantStr(e.target.value)}
            placeholder="Ex : 70,00"
            style={{ fontSize: 22, fontWeight: 800, textAlign: 'right', color: 'var(--blue)' }}
          />
        </div>

        {/* Aperçu montant */}
        {montant > 0 && (
          <div className="invoice-recap">
            <div className="invoice-recap-ttc" style={{ justifyContent: 'space-between', display: 'flex' }}>
              <span>TOTAL À PAYER</span>
              <span>{euro(montant)}</span>
            </div>
          </div>
        )}

        <div className="row-btns" style={{ marginTop: 20 }}>
          <button
            className="btn btn-primary" onClick={handleGenerate} disabled={generating}
            style={{ flex: 1, justifyContent: 'center', background: '#1A3A6B', borderColor: '#1A3A6B' }}
          >
            {generating ? '⏳ Génération…' : '🧾 Générer le PDF'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

type FilterTab = 'active' | 'all' | 'archived'

const EMPTY_PATIENT = {
  first_name: '', last_name: '', birth_date: '', phone: '', email: '',
  address: '', profession: '', notes_general: '', alerts: '', regular_doctor: '',
  medications: '', antecedents: '', consent_given: 0, consent_date: '',
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('active')
  const [alphFilter, setAlphFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [form, setForm] = useState({ ...EMPTY_PATIENT })
  const [backingUp, setBackingUp] = useState<string | null>(null)
  const [invoicePatient, setInvoicePatient] = useState<Patient | null>(null)
  const showToast = useContext(ToastContext)
  const navigate = useNavigate()

  const load = async () => {
    try { setPatients(await window.mtcApi.getPatients()) }
    catch { showToast('Erreur chargement patients', 'error') }
  }

  useEffect(() => { load() }, [])

  const byFilter = patients.filter(p => {
    if (filter === 'active')   return p.is_active !== 0
    if (filter === 'archived') return p.is_active === 0
    return true
  })

  const filtered = byFilter.filter(p => {
    const txt = `${p.first_name} ${p.last_name} ${p.email || ''} ${p.phone || ''}`.toLowerCase()
    if (search && !txt.includes(search.toLowerCase())) return false
    if (alphFilter && !p.last_name.toUpperCase().startsWith(alphFilter)) return false
    return true
  })

  // Lettres présentes dans la liste filtrée par tab
  const presentLetters = new Set(byFilter.map(p => p.last_name[0]?.toUpperCase()).filter(Boolean))

  const counts = {
    active:   patients.filter(p => p.is_active !== 0).length,
    all:      patients.length,
    archived: patients.filter(p => p.is_active === 0).length,
  }

  const openCreate = () => { setEditPatient(null); setForm({ ...EMPTY_PATIENT }); setShowModal(true) }
  const openEdit = (p: Patient) => {
    setEditPatient(p)
    setForm({
      first_name: p.first_name, last_name: p.last_name, birth_date: p.birth_date || '',
      phone: p.phone || '', email: p.email || '', address: p.address || '',
      profession: p.profession || '',
      notes_general: p.notes_general || '', alerts: p.alerts || '',
      regular_doctor: p.regular_doctor || '', medications: p.medications || '',
      antecedents: p.antecedents || '',
      consent_given: p.consent_given ?? 0,
      consent_date:  p.consent_date  || '',
    })
    // Log l'accès à la fiche
    window.mtcApi.logAccess(p.id, 'fiche_ouverte', `${p.first_name} ${p.last_name}`).catch(() => {})
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast('Nom et prénom requis', 'error'); return
    }
    try {
      if (editPatient) {
        await window.mtcApi.updatePatient(editPatient.id, form)
        showToast('Patient mis à jour ✓', 'success')
      } else {
        await window.mtcApi.createPatient(form)
        showToast('Patient créé ✓', 'success')
      }
      setShowModal(false); load()
    } catch { showToast('Erreur lors de l\'enregistrement', 'error') }
  }

  const handleDelete = async (p: Patient) => {
    if (!confirm(`Supprimer ${p.first_name} ${p.last_name} et toutes ses séances ?`)) return
    try { await window.mtcApi.deletePatient(p.id); showToast('Patient supprimé'); load() }
    catch { showToast('Erreur lors de la suppression', 'error') }
  }

  const handleToggleActive = async (p: Patient) => {
    const newVal = p.is_active === 0 ? 1 : 0
    try {
      await window.mtcApi.updatePatient(p.id, { is_active: newVal } as Partial<Patient>)
      showToast(newVal ? 'Patient réactivé ✓' : 'Patient archivé ✓', 'success')
      load()
    } catch { showToast('Erreur lors de la mise à jour', 'error') }
  }

  const handlePatientBackup = async (patientId: string) => {
    setBackingUp(patientId)
    try {
      const folder = await window.mtcApi.exportPatientBackup(patientId)
      showToast('Backup patient créé ✓', 'success')
      await window.mtcApi.openPath(folder)
    } catch (e: any) {
      showToast(`Erreur backup : ${e?.message || e}`, 'error')
    }
    setBackingUp(null)
  }

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const FILTER_LABELS: Record<FilterTab, string> = {
    active:   'Actifs',
    all:      'Tous',
    archived: 'Archivés',
  }

  return (
    <div>
      {/* Barre de recherche + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 12 }}>
        <div className="search-wrap" style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Rechercher un patient…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nouveau patient</button>
      </div>

      {/* Index alphabétique */}
      <div className="alpha-filter">
        <button
          className={`alpha-btn${alphFilter === '' ? ' active' : ''}`}
          onClick={() => setAlphFilter('')}
        >Tous</button>
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => (
          <button
            key={l}
            className={`alpha-btn${alphFilter === l ? ' active' : ''}${!presentLetters.has(l) ? ' disabled' : ''}`}
            onClick={() => presentLetters.has(l) && setAlphFilter(alphFilter === l ? '' : l)}
            title={presentLetters.has(l) ? `Patients dont le nom commence par ${l}` : 'Aucun patient'}
          >{l}</button>
        ))}
      </div>

      {/* Onglets de filtre */}
      <div className="patient-filter-tabs">
        {(['active', 'all', 'archived'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            className={`patient-filter-tab ${filter === tab ? 'active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {FILTER_LABELS[tab]}
            <span className="patient-filter-count">{counts[tab]}</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="empty" style={{ padding: '2rem 0' }}>
          {filter === 'archived'
            ? 'Aucun patient archivé.'
            : alphFilter
              ? `Aucun patient dont le nom commence par "${alphFilter}".`
              : `Aucun patient${search ? ' trouvé' : ''}.`}
        </div>
      ) : filtered
        .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
        .map(p => (
          <PatientCard
            key={p.id}
            patient={p}
            onEdit={openEdit}
            onDelete={handleDelete}
            onNewSession={id => navigate(`/nouvelle/${id}`)}
            onViewSessions={id => navigate('/seances', { state: { patientId: id } })}
            onToggleActive={handleToggleActive}
            onBackup={handlePatientBackup}
            onInvoice={setInvoicePatient}
          />
        ))}

      {/* Modal facturation */}
      {invoicePatient && (
        <InvoiceModal
          patient={invoicePatient}
          onClose={() => setInvoicePatient(null)}
          showToast={showToast}
        />
      )}

      {/* Modal création / modification */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>{editPatient ? 'Modifier le patient' : 'Nouveau patient'}</h2>
            <div className="grid2" style={{ marginBottom: 12 }}>
              <div className="field"><label>Nom *</label><input type="text" value={form.last_name} onChange={f('last_name')} placeholder="Dupont" /></div>
              <div className="field"><label>Prénom *</label><input type="text" value={form.first_name} onChange={f('first_name')} placeholder="Marie" /></div>
            </div>
            <div className="grid3" style={{ marginBottom: 12 }}>
              <div className="field"><label>Date de naissance</label><input type="date" value={form.birth_date} onChange={f('birth_date')} /></div>
              <div className="field"><label>Téléphone</label><input type="tel" value={form.phone} onChange={f('phone')} placeholder="06 00 00 00 00" /></div>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={f('email')} placeholder="email@exemple.com" /></div>
            </div>
            <div className="grid2" style={{ marginBottom: 12 }}>
              <div className="field"><label>Adresse</label><input type="text" value={form.address} onChange={f('address')} /></div>
              <div className="field"><label>Profession</label><input type="text" value={form.profession} onChange={f('profession')} placeholder="Infirmier·ère, enseignant·e…" /></div>
            </div>
            <div className="field"><label>Médecin régulier</label><input type="text" value={form.regular_doctor} onChange={f('regular_doctor')} placeholder="Dr. Nom, téléphone…" /></div>
            <div className="field"><label>Médicaments / compléments en cours</label><textarea value={form.medications} onChange={f('medications')} placeholder="Médicaments sur ordonnance, compléments alimentaires…" style={{ minHeight: 55 }} /></div>
            <div className="field"><label>Antécédents / opérations / allergies</label><textarea value={form.antecedents} onChange={f('antecedents')} placeholder="Antécédents médicaux, opérations chirurgicales avec dates, allergies…" style={{ minHeight: 55 }} /></div>
            <div className="field"><label>⚠️ Alertes importantes</label><textarea value={form.alerts} onChange={f('alerts')} placeholder="Contre-indications, précautions particulières…" style={{ minHeight: 40 }} /></div>
            <div className="field"><label>Notes générales</label><textarea value={form.notes_general} onChange={f('notes_general')} style={{ minHeight: 40 }} /></div>

            {/* ── Consentement RGPD ── */}
            <div style={{ background: 'var(--teal-light)', border: '1px solid rgba(42,122,106,.2)', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                🔒 Consentement RGPD
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={!!(form as any).consent_given}
                  onChange={e => {
                    const checked = e.target.checked
                    setForm(prev => ({
                      ...prev,
                      consent_given: checked ? 1 : 0,
                      consent_date: checked && !(prev as any).consent_date
                        ? new Date().toISOString().slice(0, 10)
                        : (prev as any).consent_date || '',
                    } as any))
                  }}
                  style={{ width: 16, height: 16, accentColor: 'var(--teal)', flexShrink: 0 }}
                />
                <span style={{ fontWeight: 600 }}>
                  Le patient a été informé et a donné son consentement pour le traitement de ses données
                </span>
              </label>
              {!!(form as any).consent_given && (
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Date du consentement</label>
                  <input
                    type="date"
                    value={(form as any).consent_date || ''}
                    onChange={e => setForm(prev => ({ ...prev, consent_date: e.target.value } as any))}
                  />
                </div>
              )}
            </div>

            <div className="row-btns" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PatientCard({ patient, onEdit, onDelete, onNewSession, onViewSessions, onToggleActive, onBackup, onInvoice }: {
  patient: Patient
  onEdit: (p: Patient) => void
  onDelete: (p: Patient) => void
  onNewSession: (id: string) => void
  onViewSessions: (id: string) => void
  onToggleActive: (p: Patient) => void
  onBackup: (id: string) => void
  onInvoice: (p: Patient) => void
}) {
  const isArchived = patient.is_active === 0

  return (
    <div className={`patient-card ${isArchived ? 'patient-card-archived' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="initials" style={{ opacity: isArchived ? 0.5 : 1 }}>
          {getInitials(patient.first_name, patient.last_name)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            {patient.first_name} {patient.last_name}
            {isArchived && <span className="badge badge-muted">Archivé</span>}
            {patient.birth_date && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                · {calcAge(patient.birth_date)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {[patient.profession, patient.phone, patient.email].filter(Boolean).join(' · ')}
          </div>
          {patient.regular_doctor && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Dr : {patient.regular_doctor}</div>
          )}
        </div>
        {patient.alerts && (
          <span className="badge badge-red" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠️ {patient.alerts}
          </span>
        )}
        <div className="row-btns" style={{ flexShrink: 0 }}>
          {!isArchived && (
            <button className="btn btn-primary btn-sm" onClick={() => onNewSession(patient.id)}>+ Séance</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => onViewSessions(patient.id)}>📋 Séances</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onBackup(patient.id)} title="Sauvegarder toutes les séances du patient">💾 Backup</button>
          <button className="btn btn-amber btn-sm" onClick={() => onInvoice(patient)} title="Générer une facture PDF">🧾 Facture</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(patient)}>Modifier</button>
          <button
            className={`btn btn-sm ${isArchived ? 'btn-primary' : 'btn-secondary'}`}
            title={isArchived ? 'Réactiver le patient' : 'Archiver le patient'}
            onClick={() => onToggleActive(patient)}
          >
            {isArchived ? '🔄 Réactiver' : '📁 Archiver'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(patient)}>Suppr.</button>
        </div>
      </div>
      {(patient.medications || patient.antecedents) && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-muted)' }}>
          {patient.medications && <><strong>Médicaments :</strong> {patient.medications}<br /></>}
          {patient.antecedents && <><strong>Antécédents :</strong> {patient.antecedents}</>}
        </div>
      )}
    </div>
  )
}
