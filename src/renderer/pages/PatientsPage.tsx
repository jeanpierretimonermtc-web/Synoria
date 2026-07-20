import React, { useEffect, useState, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../shared/types'
import { ToastContext } from '../App'
import { useRestriction } from '../hooks/useRestriction'
import { showConfirm } from '../components/common/ConfirmDialog'
import { fmtDate, getInitials, calcAge } from '../utils/format'
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import { UsersIcon, SearchIcon } from '../components/common/Icon'


type FilterTab = 'active' | 'all' | 'archived'

const EMPTY_PATIENT = {
  civility: '', first_name: '', last_name: '', birth_date: '', phone: '', email: '',
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
  const showToast = useContext(ToastContext)
  const navigate = useNavigate()
  const restriction = useRestriction()
  const R_TIP = 'Mode restreint — abonnement requis'

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
      civility: p.civility || '',
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
    if (!await showConfirm({ message: `Supprimer ${p.first_name} ${p.last_name} et toutes ses séances ?\n\nCette action est irréversible.`, title: 'Supprimer le patient', confirmLabel: 'Supprimer', danger: true })) return
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
      <PageHeader
        title="Patients"
        count={counts.active}
        subtitle={counts.active === 0 ? 'Aucun patient actif' : `${counts.active} patient${counts.active > 1 ? 's' : ''} actif${counts.active > 1 ? 's' : ''}`}
        action={<button className="btn btn-primary" onClick={openCreate} disabled={!restriction.canCreatePatient} title={!restriction.canCreatePatient ? R_TIP : undefined}>+ Nouveau patient</button>}
      />

      {/* Barre de recherche */}
      <div style={{ marginBottom: '1rem' }}>
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Rechercher un patient…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
        patients.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={30} />}
            title="Aucun patient enregistré"
            description="Ajoutez votre premier patient pour commencer à gérer vos dossiers."
            action={<button className="btn btn-primary" onClick={openCreate} disabled={!restriction.canCreatePatient} title={!restriction.canCreatePatient ? R_TIP : undefined}>+ Nouveau patient</button>}
          />
        ) : (
          <EmptyState
            icon={<SearchIcon size={28} />}
            title={
              filter === 'archived' ? 'Aucun patient archivé'
              : alphFilter ? `Aucun patient en "${alphFilter}"`
              : 'Aucun résultat'
            }
            description={
              search
                ? `Aucun patient ne correspond à "${search}".`
                : filter === 'archived' ? 'Vous n\'avez pas encore archivé de patients.'
                : undefined
            }
          />
        )
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
            onInvoice={p => navigate('/factures-liste', { state: { patientName: `${p.first_name} ${p.last_name}` } })}
          />
        ))}

      {/* Modal création / modification */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h2>{editPatient ? 'Modifier le patient' : 'Nouveau patient'}</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Civilité</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['', 'M', 'Mme'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: (form as any).civility === v ? 'var(--accent)' : 'var(--border)', background: (form as any).civility === v ? 'var(--accent-light)' : 'transparent', fontWeight: (form as any).civility === v ? 700 : 400, color: (form as any).civility === v ? 'var(--accent)' : 'var(--text-muted)', transition: 'all .12s' }}>
                    <input type="radio" name="civility" value={v} checked={(form as any).civility === v}
                      onChange={() => setForm(prev => ({ ...prev, civility: v } as any))}
                      style={{ display: 'none' }} />
                    {v === '' ? 'Non précisé' : v === 'M' ? 'M.' : 'Mme'}
                  </label>
                ))}
              </div>
            </div>
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

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={editPatient ? !restriction.canModifyPatient : !restriction.canCreatePatient}
                title={editPatient ? (!restriction.canModifyPatient ? R_TIP : undefined) : (!restriction.canCreatePatient ? R_TIP : undefined)}>Enregistrer</button>
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
  const restriction = useRestriction()
  const R_TIP = 'Mode restreint — abonnement requis'

  return (
    <div className={`patient-card ${isArchived ? 'patient-card-archived' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Avatar + status dot */}
        <div className="patient-avatar-wrap">
          <div className="initials" style={{ opacity: isArchived ? 0.55 : 1 }}>
            {getInitials(patient.first_name, patient.last_name)}
          </div>
          <span className={`patient-status-dot ${isArchived ? 'archived' : 'active'}`} />
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.01em' }}>
              {patient.last_name.toUpperCase()}
            </span>
            <span style={{ fontWeight: 400, fontSize: 15, color: 'var(--text-muted)' }}>
              {patient.first_name}
            </span>
            {patient.birth_date && (
              <span style={{ fontSize: 12, color: 'var(--text-hint)', background: 'var(--bg)', padding: '1px 7px', borderRadius: 10 }}>
                {calcAge(patient.birth_date)}
              </span>
            )}
            {isArchived && <span className="badge badge-muted">Archivé</span>}
            {patient.alerts && (
              <span className="badge badge-red" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ⚠️ {patient.alerts}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {[patient.profession, patient.phone, patient.email].filter(Boolean).map((v, i, arr) => (
              <React.Fragment key={i}>
                {v}{i < arr.length - 1 && <span style={{ margin: '0 5px', opacity: .35 }}>·</span>}
              </React.Fragment>
            ))}
          </div>
          {patient.regular_doctor && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1 }}>
              Dr {patient.regular_doctor}
            </div>
          )}
        </div>

        {/* Actions groupées */}
        <div className="patient-card-actions">
          {/* Primaires — toujours visibles */}
          <div className="patient-card-actions-primary">
            {!isArchived && (
              <button className="btn btn-primary btn-sm" onClick={() => onNewSession(patient.id)}
                disabled={!restriction.canCreateSession} title={!restriction.canCreateSession ? R_TIP : undefined}>+ Séance</button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => onViewSessions(patient.id)}>📋 Séances</button>
            <button className="btn btn-amber btn-sm" onClick={() => onInvoice(patient)}
              title="Voir les factures de ce patient">🧾 Factures</button>
          </div>
          {/* Secondaires — apparaissent au survol */}
          <div className="patient-card-actions-secondary">
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(patient)}
              disabled={!restriction.canModifyPatient} title={!restriction.canModifyPatient ? R_TIP : undefined}>✏️ Modifier</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onBackup(patient.id)} title="Sauvegarder">💾</button>
            <button
              className={`btn btn-sm ${isArchived ? 'btn-primary' : 'btn-secondary'}`}
              title={!restriction.canModifyPatient ? R_TIP : isArchived ? 'Réactiver ce patient' : 'Archiver ce patient'}
              onClick={() => onToggleActive(patient)}
              disabled={!restriction.canModifyPatient}
            >{isArchived ? '🔄 Réactiver' : '📁 Archiver'}</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(patient)}
              disabled={!restriction.canModifyPatient} title={!restriction.canModifyPatient ? R_TIP : 'Supprimer'}>🗑️</button>
          </div>
        </div>

      </div>
      {(patient.medications || patient.antecedents) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
          {patient.medications && (
            <div><strong style={{ color: 'var(--text)', fontWeight: 600 }}>Médicaments</strong><br />{patient.medications}</div>
          )}
          {patient.antecedents && (
            <div><strong style={{ color: 'var(--text)', fontWeight: 600 }}>Antécédents</strong><br />{patient.antecedents}</div>
          )}
        </div>
      )}
    </div>
  )
}
