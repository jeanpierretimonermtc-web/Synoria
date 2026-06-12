import React, { useEffect, useState, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Session, Patient } from '../../shared/types'
import { ToastContext } from '../App'
import { showConfirm } from '../components/common/ConfirmDialog'
import { fmtDate, getInitials, getEvolBadgeClass } from '../utils/format'

export default function HistoryPage() {
  const location = useLocation()
  const presetPatient = (location.state as any)?.patientId || ''

  const [sessions, setSessions] = useState<Session[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filterPatient, setFilterPatient] = useState(presetPatient)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const showToast = useContext(ToastContext)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const [s, p] = await Promise.all([window.mtcApi.getSessions(), window.mtcApi.getPatients()])
      setSessions(s); setPatients(p)
    } catch { showToast('Erreur chargement', 'error') }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!await showConfirm({ message: 'Supprimer cette séance ? Cette action est irréversible.', title: 'Supprimer la séance', confirmLabel: 'Supprimer', danger: true })) return
    try { await window.mtcApi.deleteSession(id); showToast('Séance supprimée'); load() }
    catch { showToast('Erreur lors de la suppression', 'error') }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await window.mtcApi.duplicateSession(id)
      showToast('Séance dupliquée ✓'); load()
    } catch { showToast('Erreur lors de la duplication', 'error') }
  }

  const getPatient = (id: string) => patients.find(p => p.id === id)

  const filtered = sessions.filter(s => {
    const p = getPatient(s.patient_id)
    if (filterPatient && s.patient_id !== filterPatient) return false
    if (filterYear && !s.date.startsWith(filterYear)) return false
    if (filterMonth && !s.date.startsWith(`${filterYear || s.date.slice(0,4)}-${filterMonth}`)) return false
    if (search) {
      const txt = `${p?.first_name} ${p?.last_name} ${s.motif || ''} ${s.diagnostic_mtc || ''} ${s.date}`.toLowerCase()
      if (!txt.includes(search.toLowerCase())) return false
    }
    return true
  })

  const years = [...new Set(sessions.map(s => s.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a))
  const months = ['01','02','03','04','05','06','07','08','09','10','11','12']
  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Rechercher dans l'historique…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ width: 200 }} value={filterPatient} onChange={e => setFilterPatient(e.target.value)}>
          <option value="">Tous les patients</option>
          {patients.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        <select style={{ width: 110 }} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }}>
          <option value="">Toutes années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select style={{ width: 140 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={!filterYear}>
          <option value="">Tous mois</option>
          {months.map((m, i) => <option key={m} value={m}>{monthNames[i]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Aucune séance trouvée.</div>
      ) : filtered.map(s => {
        const p = getPatient(s.patient_id)
        const isOpen = openId === s.id
        return (
          <div key={s.id} className="seance-card">
            <div className="seance-header" onClick={() => setOpenId(isOpen ? null : s.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="initials" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {p ? getInitials(p.first_name, p.last_name) : '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p ? `${p.first_name} ${p.last_name}` : '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {fmtDate(s.date)}{s.practitioner ? ` · ${s.practitioner}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {s.diagnostic_mtc && <span className="badge badge-green">{s.diagnostic_mtc.slice(0, 40)}</span>}
                {s.evolution_tags && <span className={`badge ${getEvolBadgeClass(s.evolution_tags)}`}>{s.evolution_tags}</span>}
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); navigate(`/resume/${s.id}`) }}>Résumé</button>
                <button className="btn btn-amber btn-sm" onClick={e => { e.stopPropagation(); navigate(`/modifier/${s.id}`) }}>✏️ Modifier</button>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); handleDuplicate(s.id) }}>Dupliquer</button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(s.id) }}>Supprimer</button>
                <span style={{ fontSize: 18, color: 'var(--text-hint)', transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : '' }}>▾</span>
              </div>
            </div>
            {isOpen && (
              <div className="seance-detail open">
                <SessionDetail session={s} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SessionDetail({ session: s }: { session: Session }) {
  const items: [string, string][] = []
  const add = (k: string, v?: string | null) => { if (v?.trim()) items.push([k, v]) }

  // Données étendues depuis full_data_json
  let fd: Record<string, any> = {}
  try { if (s.full_data_json) fd = JSON.parse(s.full_data_json) } catch {}

  add('Motif', s.motif); add('Évolution', [s.evolution_tags, s.evolution].filter(Boolean).join(' → '))
  add('Langue', [s.langue, fd.langueNote].filter(Boolean).join(' — '))
  add('Pouls', [s.pouls, fd.poulsNote].filter(Boolean).join(' — '))
  if (fd.poulsPos) {
    const pp = fd.poulsPos
    if (pp.droitAvant || pp.droitMilieu || pp.droitArriere || pp.gaucheAvant || pp.gaucheMilieu || pp.gaucheArriere) {
      add('Pouls positions', `D: ${pp.droitAvant||'—'} / ${pp.droitMilieu||'—'} / ${pp.droitArriere||'—'}  |  G: ${pp.gaucheAvant||'—'} / ${pp.gaucheMilieu||'—'} / ${pp.gaucheArriere||'—'}`)
    }
  }
  add('Constitution', s.constitution); add('Teint', s.teint); add('Observation', s.observation)
  add('Diagnostic MTC', s.diagnostic_mtc); add('5 Éléments', s.cinq_elements)
  add('Causes', s.causes); add('Analyse', s.analyse); add('Principes', s.principes)
  add('Points acupuncture', s.points); add('Points oreille', s.pts_oreille)
  add('Techniques', s.techniques); add('Plantes', s.plantes)
  add('Réactions', s.reactions); add('Notes traitement', s.traitement_notes)
  if (fd.barrageNiv1) add('Barrage homéo. Niv.1', fd.barrageNiv1)
  if (fd.barrageNiv2) add('Barrage homéo. Niv.2', fd.barrageNiv2)
  if (fd.barrageNiv3) add('Barrage homéo. Niv.3', fd.barrageNiv3)
  if (fd.barrageNiv4) add('Barrage homéo. Niv.4', fd.barrageNiv4)
  add('Conseils', s.conseils); add('Plan de suivi', s.plan); add('À surveiller', s.surveiller)
  if (s.next_session_date) add('📅 Prochain RDV', s.next_session_date)

  // Systèmes
  if (s.systemes_json) {
    try {
      const sys = JSON.parse(s.systemes_json)
      const labels: Record<string, string> = {
        cardio: 'Cardiaque/Sommeil', pulmo: 'Pulmonaire', mental: 'Mental',
        vision: 'Vision/Audition', reins: 'Reins/Vessie',
        rate: 'Rate', estomac: 'Estomac', grosIntestin: 'Gros Intestin',
        peau: 'Peau', tete: 'Maux de tête', temp: 'Température',
        musculo: 'Musculo-squelettique', feminin: 'Féminin',
        fertilite: 'Fertilité', masculin: 'Masculin',
        digestif: 'Digestif (ancien)',
      }
      for (const [k, v] of Object.entries(sys) as [string, any][]) {
        const lbl = labels[k] || k
        if (v?.checked?.length) add(lbl, v.checked.join(', '))
        if (v?.note) add(`${lbl} – Notes`, v.note)
        if (k === 'mental' && v?.stress) add('Stress', `${v.stress}/10`)
        if (k === 'mental' && v?.anxiete) add('Anxiété', `${v.anxiete}/10`)
        if ((k === 'rate' || k === 'digestif') && v?.energie) add('Énergie', `${v.energie}/10`)
        if ((k === 'rate' || k === 'digestif') && v?.regimeAlimentaire) add('Régime', v.regimeAlimentaire)
        if (k === 'musculo' && v?.douleur) add('Douleur', `${v.douleur}/10`)
        if (k === 'musculo' && v?.localisation) add('Localisation douleur', v.localisation)
        if (k === 'feminin') {
          if (v?.jourCycle) add('Jour du cycle', v.jourCycle)
          if (v?.couleurSang) add('Couleur sang', v.couleurSang)
        }
      }
    } catch {}
  }

  // Tests énergétiques
  if (s.energy_tests_json) {
    try {
      const et = JSON.parse(s.energy_tests_json)
      const rech = et.rechauffeurs?.filter((r: any) => r.active).map((r: any) => `${r.key}(${r.polarite || '?'})`).join(', ')
      if (rech) add('Réchauffeurs', rech)
      const foyers = et.foyers?.filter((f: any) => f.active).map((f: any) => `${f.key}: ${f.subs.join(', ')}`).join(' | ')
      if (foyers) add('Foyers', foyers)
      if (et.pointsMu?.length) add('Points Mu', et.pointsMu.join(', '))
      if (et.empereur) add('Empereur', `${et.empereur} (${et.empereurPolarite || '?'})`)
      if (et.syndrome?.length) add('Syndrome', et.syndrome.join(', '))
      if (et.syndromeClimat?.length) add('Climat / Wu Shu', et.syndromeClimat.join(', '))
      const penEmp = Array.isArray(et.penetrationEmp) ? et.penetrationEmp.join(', ') : (et.penetrationEmp || '')
      const penComp = Array.isArray(et.penetrationComp) ? et.penetrationComp.join(', ') : (et.penetrationComp || '')
      if (penEmp) add('Pénétration Empereur', penEmp)
      if (penComp) add('Pénétration Énergie comp.', penComp)
      const ec = et.energieComp
      if (ec?.biaoli) add('Biao Li', ec.biaoli)
      if (ec?.midiMinuit) add('Midi / Minuit', ec.midiMinuit)
    } catch {}
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', paddingTop: 8 }}>
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="detail-label">{k}</div>
          <div className="detail-value">{v}</div>
        </div>
      ))}
    </div>
  )
}
