import React, { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Session, Patient, SessionFullData } from '../../shared/types'
import { useRestriction } from '../hooks/useRestriction'
import type { PluginDefinition, PluginSection } from '../../shared/pluginTypes'
import { PluginFieldSummary } from '../components/plugin/PluginFieldSummary'
import { ToastContext } from '../App'
import { fmtDate, calcAge } from '../utils/format'
import { sanitizeRichTextHtml } from '../utils/sanitizeHtml'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
type AnyRec = Record<string, any>

function parseFullData(raw?: string): SessionFullData {
  if (!raw) return {}
  try { return JSON.parse(raw) as SessionFullData } catch { return {} }
}

/* ─── HELPERS UI ─────────────────────────────────────────────────────────── */

function Chips({ values, color = 'blue' }: { values: string[]; color?: 'blue' | 'teal' | 'green' | 'amber' | 'purple' | 'rose' }) {
  if (!values.length) return null
  return (
    <div className="chips-group">
      {values.map(v => <span key={v} className={`chip chip-${color}`}>{v}</span>)}
    </div>
  )
}

function ScoreBadge({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  if (!value) return null
  const pct = (value / max) * 100
  const col = pct <= 30 ? 'var(--accent)' : pct <= 60 ? 'var(--amber)' : 'var(--red)'
  return (
    <span className="score-badge" style={{ borderColor: col, color: col }}>
      {label} : <strong>{value}/{max}</strong>
    </span>
  )
}

function FieldLine({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <span className="summary-field-line">
      <em>{label} :</em> {value}
    </span>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  )
}

function HtmlRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  // Retire les balises si la valeur est du texte brut (rétrocompatibilité)
  const hasHtml = /<[a-z][\s\S]*>/i.test(value)
  return (
    <div>
      <div className="detail-label">{label}</div>
      {hasHtml
        ? <div className="detail-value" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(value) }} />
        : <div className="detail-value">{value}</div>
      }
    </div>
  )
}

function SummaryBlock({ title, icon, color, children }: { title: string; icon?: string; color?: string; children: React.ReactNode }) {
  const hasContent = React.Children.count(children) > 0
  if (!hasContent) return null
  return (
    <div className="summary-section">
      <h3 style={{ color: color || 'var(--accent)' }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{title}
      </h3>
      <div className="summary-grid">
        {children}
      </div>
    </div>
  )
}

/* ─── Modal facturation (depuis séance) ─────────────────────────────────── */

export function InvoiceModal({ patient, sessionDate: initSessionDate, description: initDesc, onClose, showToast, onGenerated }: {
  patient: Patient
  sessionDate: string
  description: string
  onClose: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
  onGenerated?: (invoiceNumber: string) => void
}) {
  const navigate = useNavigate()
  const today    = new Date().toISOString().slice(0, 10)

  const [profileEmpty, setProfileEmpty] = useState<boolean | null>(null)
  const [sessionDate,  setSessionDate]  = useState(initSessionDate)
  const [invoiceDate,  setInvoiceDate]  = useState(today)
  const [description,  setDescription]  = useState(initDesc)
  const [montantStr,   setMontantStr]   = useState('')
  const [generating,   setGenerating]   = useState(false)

  useEffect(() => {
    window.mtcApi.getSettings().then(s => {
      const hasName = !!(s.practitionerFirstName?.trim() || s.practitionerLastName?.trim())
      setProfileEmpty(!hasName)
      if (hasName && !initDesc) setDescription(s.practitionerActivity?.trim() || '')
    })
  }, [])

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
        email:            patient.email   || '',
        phone:            patient.phone   || '',
        sessionDate, description, invoiceDate, montant,
      })
      showToast(`Facture ${result.invoiceNumber} créée ✓`, 'success')
      onGenerated?.(result.invoiceNumber)
      await window.mtcApi.openPath(result.filePath)
      onClose()
    } catch (e: any) {
      showToast(`Erreur génération facture : ${e?.message || e}`, 'error')
    }
    setGenerating(false)
  }

  if (profileEmpty === null) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      </div>
    )
  }

  if (profileEmpty) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 440 }}>
          <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Profil praticien requis</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.75, marginBottom: 20 }}>
              Renseignez votre <strong>profil praticien</strong> (nom, activité, SIRET…) avant de générer une facture.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { onClose(); navigate('/profil') }}>
                Compléter mon profil →
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span>🧾</span><span>Générer une facture</span>
        </h2>

        <div style={{ background: 'var(--blue-light)', border: '1px solid rgba(42,90,138,.2)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 14 }}>{patient.first_name} {patient.last_name}</div>
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
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Prestation de soin" />
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

        {montant > 0 && (
          <div className="invoice-recap">
            <div className="invoice-recap-ttc" style={{ justifyContent: 'space-between', display: 'flex' }}>
              <span>TOTAL À PAYER</span><span>{euro(montant)}</span>
            </div>
          </div>
        )}

        <div className="row-btns" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}
            style={{ flex: 1, justifyContent: 'center', background: '#1A3A6B', borderColor: '#1A3A6B' }}>
            {generating ? '⏳ Génération…' : '🧾 Générer le PDF'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

/* ─── PAGE ───────────────────────────────────────────────────────────────── */

export default function SummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession]       = useState<Session | null>(null)
  const [patient, setPatient]       = useState<Patient | null>(null)
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [loading, setLoading]       = useState(true)
  const [activePlugin, setActivePlugin] = useState<PluginDefinition | null>(null)
  const [showInvoice, setShowInvoice]   = useState(false)
  const showToast = useContext(ToastContext)
  const navigate  = useNavigate()
  const restriction = useRestriction()

  const load = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([window.mtcApi.getSessions(), window.mtcApi.getPatients()])
      setAllSessions(s); setAllPatients(p)
      if (sessionId) {
        const found = s.find(x => x.id === sessionId)
        setSession(found || null)
        if (found) setPatient(p.find(x => x.id === found.patient_id) || null)
      }
    } catch { showToast('Erreur chargement', 'error') }
    setLoading(false)
  }

  useEffect(() => {
    load()
    window.mtcApi.pluginGet().then(p => setActivePlugin(p || null)).catch(() => { showToast('Impossible de charger le plugin actif', 'error') })
  }, [sessionId])

  // Log accès à la séance (après chargement des données)
  useEffect(() => {
    if (session && patient) {
      window.mtcApi.logAccess(
        session.patient_id,
        'séance_consultée',
        `${patient.first_name} ${patient.last_name} — ${session.date}`,
      ).catch(() => {})
    }
  }, [session?.id])

  if (loading) return <div className="empty">Chargement…</div>

  return (
    <div>
      {/* ─── SÉLECTEURS ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ width: 220 }} value={patient?.id || ''}
          onChange={e => {
            const pid = e.target.value
            const first = allSessions.filter(s => s.patient_id === pid).sort((a,b) => b.date.localeCompare(a.date))[0]
            if (first) navigate(`/resume/${first.id}`)
          }}>
          <option value="">— Choisir un patient —</option>
          {allPatients.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>

        <select style={{ width: 260 }} value={session?.id || ''}
          onChange={e => navigate(`/resume/${e.target.value}`)}>
          <option value="">— Choisir une séance —</option>
          {allSessions
            .filter(s => !patient || s.patient_id === patient.id)
            .sort((a,b) => b.date.localeCompare(a.date))
            .map(s => {
              const pat = allPatients.find(x => x.id === s.patient_id)
              return <option key={s.id} value={s.id}>{fmtDate(s.date)} — {pat?.first_name} {pat?.last_name}</option>
            })}
        </select>

        {session && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              try { const f = await window.mtcApi.exportSessionJson(session.id); showToast('Export JSON créé ✓'); await window.mtcApi.openPath(f) }
              catch { showToast('Erreur export JSON', 'error') }
            }}>⬇ JSON</button>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              try { const f = await window.mtcApi.exportSessionExcel(session.id); showToast('Export Excel créé ✓'); await window.mtcApi.openPath(f) }
              catch { showToast('Erreur export Excel', 'error') }
            }}>⬇ Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Imprimer</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/historique')}>📋 Historique</button>
            <button
              className="btn btn-amber btn-sm"
              onClick={() => setShowInvoice(true)}
              disabled={!restriction.canCreateInvoice}
              title={!restriction.canCreateInvoice ? 'Fonctionnalité non disponible dans votre abonnement' : 'Générer une facture pour cette séance'}
            >🧾 Facture</button>
          </div>
        )}
      </div>

      {!session
        ? <div className="empty">Sélectionnez un patient et une séance pour afficher le résumé.</div>
        : <SummaryContent session={session} patient={patient} activePlugin={activePlugin} />
      }

      {showInvoice && patient && session && (
        <InvoiceModal
          patient={patient}
          sessionDate={session.date}
          description={(() => {
            const tmp = document.createElement('div')
            tmp.innerHTML = session.motif || ''
            return tmp.textContent?.trim() || ''
          })()}
          onClose={() => setShowInvoice(false)}
          showToast={showToast}
        />
      )}
    </div>
  )
}

/* ─── CONTENU DU RÉSUMÉ ──────────────────────────────────────────────────── */

export function SummaryContent({ session: s, patient: p, activePlugin }: {
  session: Session
  patient: Patient | null
  activePlugin: PluginDefinition | null
}) {

  /* ── Données étendues depuis full_data_json ── */
  const fd: SessionFullData = parseFullData(s.full_data_json)

  /* ── Données plugin ── */
  const pluginData: AnyRec      = (fd.pluginData  as AnyRec) || {}
  const pluginId:   string      = fd.pluginId                || ''
  const pluginSchema             = fd.pluginSchema            || null

  // Définition à utiliser pour rendre les sections plugin (plugins tiers seulement)
  const pluginDef: PluginDefinition | null =
    pluginSchema
    ?? (activePlugin && !activePlugin.useBuiltinForm && activePlugin.id === pluginId ? activePlugin : null)

  const hasPluginData = !!(pluginDef && Object.values(pluginData).some(v =>
    v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  ))

  // Le plugin MTC JP utilise useBuiltinForm — pluginSchema n'est pas sauvegardé.
  // On détecte ce cas via :
  //  1. fd.pluginIsBuiltin (sauvegardé depuis la v1.4.4+)
  //  2. le plugin actif correspond et est useBuiltinForm (session ouverte avec le bon plugin)
  //  3. fallback : pluginId === 'mtc_jp' (rétrocompatibilité séances anciennes)
  const pluginIsBuiltin =
    !!(fd.pluginIsBuiltin)
    || (!!activePlugin && activePlugin.id === pluginId && !!activePlugin.useBuiltinForm)
    || pluginId === 'mtc_jp'

  // showMtcSections : vrai si aucun plugin (mode simple) OU plugin MTC intégré
  const showMtcSections = !pluginId || pluginIsBuiltin

  // pluginId présent, mode non intégré, mais schéma absent (séance créée avant v1.4.4)
  const pluginSchemaMissing = !!pluginId && !pluginIsBuiltin && !pluginSchema && !pluginDef

  const sessionNum: number        = fd.sessionNum   || 0
  const langueNote: string        = fd.langueNote   || ''
  const poulsNote: string         = fd.poulsNote    || ''
  const poulsPos: AnyRec          = fd.poulsPos     || {}
  const barrageNiv1: string       = fd.barrageNiv1  || ''
  const barrageNiv2: string       = fd.barrageNiv2  || ''
  const barrageNiv3: string       = fd.barrageNiv3  || ''
  const barrageNiv4: string       = fd.barrageNiv4  || ''

  let systemes: AnyRec     = {}
  let energy: AnyRec       = {}
  try { if (s.systemes_json)     systemes = JSON.parse(s.systemes_json) }     catch {}
  try { if (s.energy_tests_json) energy   = JSON.parse(s.energy_tests_json) } catch {}

  /* ── Flags ── */
  const hasPoulsPos = [poulsPos.droitAvant, poulsPos.droitMilieu, poulsPos.droitArriere,
                       poulsPos.gaucheAvant, poulsPos.gaucheMilieu, poulsPos.gaucheArriere].some(Boolean)

  const hasBarrage  = barrageNiv1 || barrageNiv2 || barrageNiv3 || barrageNiv4

  const hasSysData  = Object.values(systemes).some((v: any) => {
    if (!v || typeof v !== 'object') return false
    return v.checked?.length || v.note || v.stress || v.anxiete || v.energie || v.douleur ||
      v.ageMenarche || v.jourCycle || v.longueurCycle || v.couleurSang || v.ecoulement ||
      v.localisation || v.regimeAlimentaire || v.caillots?.length || v.crampes?.length ||
      v.spm?.length || v.diagnosticFertilite?.length || v.essaiConception || v.debutMenopause ||
      v.enceinte || v.emplacementAcne || v.emplacementEczema
  })

  const activeRech  = (energy.rechauffeurs || []).filter((r: any) => r.active)
  const activeFoyers= (energy.foyers || []).filter((f: any) => f.active)
  const activeMV    = (energy.merveilleuxVaisseaux || []).filter((mv: any) =>
    mv.fonctionExterne || mv.axeDistribution || mv.fonctionInterne || mv.note)
  const penEmp = Array.isArray(energy.penetrationEmp)  ? energy.penetrationEmp.join(', ')  : (energy.penetrationEmp  || '')
  const penComp= Array.isArray(energy.penetrationComp) ? energy.penetrationComp.join(', ') : (energy.penetrationComp || '')
  const ec     = energy.energieComp || {}
  const hasEnergy = activeRech.length || activeFoyers.length || energy.pointsMu?.length ||
    energy.empereur || energy.syndrome?.length || energy.syndromeClimat?.length ||
    penEmp || penComp || activeMV.length || ec.biaoli || ec.midiMinuit || ec.gmMeridien ||
    ec.cinqMouvements?.length || ec.element || ec.notes || energy.testsNotes

  const SYS_META: Record<string, { icon: string; label: string }> = {
    cardio:       { icon: '🫀', label: 'Cardiaque / Sommeil' },
    pulmo:        { icon: '🫁', label: 'Pulmonaire' },
    mental:       { icon: '🧠', label: 'Santé Mentale' },
    vision:       { icon: '👁',  label: 'Vision & Audition' },
    reins:        { icon: '💧', label: 'Reins / Vessie' },
    rate:         { icon: '🌿', label: 'Système de la Rate' },
    estomac:      { icon: '🫙', label: "Système de l'Estomac" },
    grosIntestin: { icon: '🔄', label: 'Gros Intestin' },
    peau:         { icon: '✨', label: 'Santé de la Peau' },
    tete:         { icon: '🗡', label: 'Maux de tête' },
    temp:         { icon: '🌡', label: 'Température' },
    musculo:      { icon: '🦴', label: 'Musculo-squelettique' },
    feminin:      { icon: '♀', label: 'Santé Féminine' },
    fertilite:    { icon: '🌱', label: 'Fertilité' },
    masculin:     { icon: '♂', label: 'Santé Masculine' },
    digestif:     { icon: '🌿', label: 'Digestif (ancien)' },
  }

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div>

      {/* ─── EN-TÊTE ─────────────────────────────────────────────── */}
      <div className="summary-section" style={{ background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>
              {p ? `${p.first_name} ${p.last_name}` : '—'}
            </div>
            {p?.birth_date && <div style={{ opacity: .85, fontSize: 13 }}>{calcAge(p.birth_date)} · né(e) le {fmtDate(p.birth_date)}</div>}
            {p?.phone && <div style={{ opacity: .8, fontSize: 12 }}>{p.phone}{p.email ? ` · ${p.email}` : ''}</div>}
            {p?.profession && <div style={{ opacity: .75, fontSize: 12 }}>Profession : {p.profession}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtDate(s.date)}</div>
            {sessionNum > 0 && (
              <span className="session-num-badge" style={{ marginTop: 6, display: 'inline-block', background: 'rgba(255,255,255,.2)', borderColor: 'rgba(255,255,255,.4)', color: '#fff' }}>
                {sessionNum === 1 ? '1ère séance' : `${sessionNum}ème séance`}
              </span>
            )}
            {s.practitioner && <div style={{ opacity: .85, fontSize: 13, marginTop: 4 }}>Praticien : {s.practitioner}</div>}
          </div>
        </div>
        {p?.alerts && (
          <div style={{ marginTop: 10, padding: '6px 12px', background: 'rgba(255,255,255,.15)', borderRadius: 6, fontSize: 13 }}>
            ⚠️ <strong>Alertes :</strong> {p.alerts}
          </div>
        )}
      </div>

      {/* ─── 1. MOTIF & ÉVOLUTION ────────────────────────────────── */}
      <SummaryBlock title="Motif de consultation & Évolution" icon="🎯" color="var(--amber)">
        <HtmlRow label="Motif" value={s.motif} />
        {fd.anamnese && (!pluginId || pluginIsBuiltin) && (
          <HtmlRow label={pluginIsBuiltin ? "Prise de notes (interrogatoire)" : "Histoire de la plainte"} value={fd.anamnese} />
        )}
        <HtmlRow label="Problématiques / Terrain" value={s.problematiques} />
        <Row label="Évolution (tag)" value={s.evolution_tags} />
        <HtmlRow label="Évolution (détail)" value={s.evolution} />
      </SummaryBlock>

      {/* ─── MODE SIMPLE — sections enrichies ───────────────────────── */}
      {!pluginId && (fd.simpleContextVie || fd.simpleTraitementsEnCours || fd.simpleObjectifs || s.observation) && (
        <SummaryBlock title="Interrogatoire & Bilan" icon="🔍" color="var(--teal)">
          <HtmlRow label="Contexte & habitudes de vie"               value={fd.simpleContextVie as string} />
          <HtmlRow label="Traitements en cours / autres thérapeutes" value={fd.simpleTraitementsEnCours as string} />
          <HtmlRow label="Objectifs & attentes du patient"           value={fd.simpleObjectifs as string} />
          <HtmlRow label="Observations cliniques"                    value={s.observation} />
        </SummaryBlock>
      )}
      {!pluginId && fd.simpleNotesEntretien && (
        <SummaryBlock title="Notes d'entretien libres" icon="✏️" color="var(--purple)">
          <HtmlRow label="Notes" value={fd.simpleNotesEntretien as string} />
        </SummaryBlock>
      )}

      {/* ─── SECTIONS PLUGIN ─────────────────────────────────────── */}
      {hasPluginData && pluginDef && pluginDef.sections.map(section => (
        <PluginSummarySection key={section.id} section={section} data={pluginData} />
      ))}

      {pluginSchemaMissing && (
        <div className="summary-section" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--text-muted)', fontSize: 13 }}>
          <strong>Formulaire [{pluginId}]</strong> — données présentes mais schéma non disponible (séance créée avant v1.4.4).
        </div>
      )}

      {/* ─── 2. OBSERVATION MTC ──────────────────────────────────── */}
      {showMtcSections && (s.langue || langueNote || s.pouls || hasPoulsPos || poulsNote ||
        s.constitution || s.type_corps || s.teint || (pluginIsBuiltin && s.observation)) && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--teal)' }}>👀 Observation MTC</h3>

          {/* Langue */}
          {(s.langue || langueNote) && (
            <div className="obs-block">
              <div className="detail-label">Langue</div>
              {s.langue && <Chips values={s.langue.split(', ').filter(Boolean)} color="teal" />}
              {langueNote && (/<[a-z][\s\S]*>/i.test(langueNote)
                ? <div className="detail-note" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(langueNote) }} />
                : <div className="detail-note">{langueNote}</div>
              )}
            </div>
          )}

          {/* Pouls */}
          {(s.pouls || hasPoulsPos || poulsNote) && (
            <div className="obs-block">
              <div className="detail-label">Pouls</div>
              {s.pouls && <Chips values={s.pouls.split(', ').filter(Boolean)} color="teal" />}
              {hasPoulsPos && (
                <div className="pouls-summary-grid">
                  <div className="pouls-summary-header">
                    <span />
                    <span>Cun (avant)</span>
                    <span>Guan (milieu)</span>
                    <span>Chi (arrière)</span>
                  </div>
                  <div className="pouls-summary-row">
                    <span className="pouls-summary-hand" style={{ color: 'var(--teal-dark, #1a5a4a)' }}>Droite</span>
                    <span className="pouls-summary-pos">{poulsPos.droitAvant  || <em style={{ color: 'var(--text-hint)' }}>—</em>}</span>
                    <span className="pouls-summary-pos">{poulsPos.droitMilieu || <em style={{ color: 'var(--text-hint)' }}>—</em>}</span>
                    <span className="pouls-summary-pos">{poulsPos.droitArriere|| <em style={{ color: 'var(--text-hint)' }}>—</em>}</span>
                  </div>
                  <div className="pouls-summary-row">
                    <span className="pouls-summary-hand" style={{ color: 'var(--accent)' }}>Gauche</span>
                    <span className="pouls-summary-pos">{poulsPos.gaucheAvant  || <em style={{ color: 'var(--text-hint)' }}>—</em>}</span>
                    <span className="pouls-summary-pos">{poulsPos.gaucheMilieu || <em style={{ color: 'var(--text-hint)' }}>—</em>}</span>
                    <span className="pouls-summary-pos">{poulsPos.gaucheArriere|| <em style={{ color: 'var(--text-hint)' }}>—</em>}</span>
                  </div>
                </div>
              )}
              {poulsNote && (/<[a-z][\s\S]*>/i.test(poulsNote)
                ? <div className="detail-note" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(poulsNote) }} />
                : <div className="detail-note">{poulsNote}</div>
              )}
            </div>
          )}

          {/* Autres observations */}
          <div className="summary-grid" style={{ marginTop: 10 }}>
            <Row     label="Constitution"        value={s.constitution} />
            <Row     label="Type de corps"       value={s.type_corps} />
            <Row     label="Teint"               value={s.teint} />
            <HtmlRow label="Observation générale" value={s.observation} />
          </div>
        </div>
      )}

      {/* ─── 3. QUESTIONNAIRE PAR SYSTÈMES ──────────────────────── */}
      {showMtcSections && hasSysData && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--blue)' }}>📋 Questionnaire par systèmes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(systemes).map(([key, val]: [string, any]) => {
              if (!val || typeof val !== 'object') return null
              const meta = SYS_META[key] || { icon: '•', label: key }

              const hasData = val.checked?.length || val.note || val.stress || val.anxiete ||
                val.energie || val.douleur || val.localisation || val.ageMenarche || val.jourCycle ||
                val.longueurCycle || val.dureeMin || val.couleurSang || val.ecoulement ||
                val.regimeAlimentaire || val.caillots?.length || val.crampes?.length || val.spm?.length ||
                val.diagnosticFertilite?.length || val.essaiConception || val.testsSanguins ||
                val.resultatTests || val.debutMenopause || val.enceinte || val.cesarienne ||
                val.datePrevue || val.enfants || val.emplacementAcne || val.emplacementEczema
              if (!hasData) return null

              return (
                <div key={key} className="sys-summary-entry">
                  <div className="sys-summary-label">{meta.icon} {meta.label}</div>

                  {/* Éléments cochés */}
                  {val.checked?.length > 0 && (
                    <Chips values={val.checked} color="blue" />
                  )}

                  {/* Scores */}
                  {(key === 'mental') && (
                    <div className="scores-row">
                      <ScoreBadge label="Stress"   value={val.stress}  />
                      <ScoreBadge label="Anxiété" value={val.anxiete} />
                    </div>
                  )}
                  {(key === 'rate' || key === 'digestif') && (
                    <div className="scores-row">
                      <ScoreBadge label="Énergie" value={val.energie} />
                    </div>
                  )}
                  {key === 'musculo' && (
                    <div className="scores-row">
                      <ScoreBadge label="Douleur" value={val.douleur} />
                    </div>
                  )}

                  {/* Champs spécifiques */}
                  {(key === 'rate' || key === 'digestif') && val.regimeAlimentaire && (
                    <div className="fields-row">
                      <FieldLine label="Régime alimentaire" value={val.regimeAlimentaire} />
                    </div>
                  )}

                  {key === 'musculo' && val.localisation && (
                    <div className="fields-row">
                      <FieldLine label="Localisation douleur" value={val.localisation} />
                    </div>
                  )}

                  {key === 'peau' && (val.emplacementAcne || val.emplacementEczema) && (
                    <div className="fields-row">
                      <FieldLine label="Emplacement acné"   value={val.emplacementAcne} />
                      <FieldLine label="Emplacement eczéma" value={val.emplacementEczema} />
                    </div>
                  )}

                  {key === 'feminin' && (
                    <>
                      {(val.ageMenarche || val.jourCycle || val.longueurCycle || val.dureeMin || val.dureeMax || val.couleurSang || val.ecoulement) && (
                        <div className="fields-row">
                          <FieldLine label="Ménarche"          value={val.ageMenarche ? `${val.ageMenarche} ans` : null} />
                          <FieldLine label="Jour du cycle"     value={val.jourCycle} />
                          <FieldLine label="Longueur cycle"    value={val.longueurCycle} />
                          <FieldLine label="Durée menstruations" value={(val.dureeMin || val.dureeMax) ? `${val.dureeMin || '?'}–${val.dureeMax || '?'} j` : null} />
                          <FieldLine label="Couleur sang"      value={val.couleurSang} />
                          <FieldLine label="Écoulement"        value={val.ecoulement} />
                        </div>
                      )}
                      {(val.caillots?.length || val.crampes?.length || val.spm?.length) && (
                        <div className="fields-row">
                          {val.caillots?.length > 0 && <FieldLine label="Caillots" value={val.caillots.join(', ')} />}
                          {val.crampes?.length  > 0 && <FieldLine label="Crampes"  value={val.crampes.join(', ')} />}
                          {val.spm?.length      > 0 && <FieldLine label="SPM"      value={val.spm.join(', ')} />}
                        </div>
                      )}
                    </>
                  )}

                  {key === 'fertilite' && (
                    <div className="fields-row">
                      <FieldLine label="Essai conception"    value={val.essaiConception} />
                      <FieldLine label="Tests sanguins"      value={val.testsSanguins} />
                      <FieldLine label="Résultats"           value={val.resultatTests} />
                      {val.diagnosticFertilite?.length > 0 && <FieldLine label="Diagnostic" value={val.diagnosticFertilite.join(', ')} />}
                      <FieldLine label="Début ménopause"     value={val.debutMenopause ? `${val.debutMenopause} ans` : null} />
                      {val.enceinte   && <FieldLine label="Enceinte"   value={val.nbSemaines ? `${val.nbSemaines} sem.` : 'oui'} />}
                      {val.cesarienne && <FieldLine label="Césarienne" value="oui" />}
                      <FieldLine label="Date prévue accouchement" value={val.datePrevue} />
                      {val.enfants && <FieldLine label="Enfants" value="oui" />}
                    </div>
                  )}

                  {/* Note */}
                  {val.note && <div className="detail-note">{val.note}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── 4. DIAGNOSTIC MTC ───────────────────────────────────── */}
      {showMtcSections && (s.diagnostic_mtc || s.cinq_elements || s.causes || s.analyse || s.principes) && (
        <SummaryBlock title="Diagnostic MTC" icon="🔵" color="var(--purple)">
          <Row     label="Diagnostic MTC principal" value={s.diagnostic_mtc} />
          <Row     label="5 Éléments"               value={s.cinq_elements} />
          <Row     label="Causes"                   value={s.causes} />
          <HtmlRow label="Mécanisme / terrain"       value={s.analyse} />
          <Row     label="Principes de traitement"   value={s.principes} />
        </SummaryBlock>
      )}

      {/* ─── 5. TESTS ÉNERGÉTIQUES ───────────────────────────────── */}
      {showMtcSections && hasEnergy && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--purple)' }}>⚡ Tests énergétiques — Protocole de l'entonnoir</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Réchauffeurs */}
            {activeRech.length > 0 && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Réchauffeurs actifs</span>
                <Chips values={activeRech.map((r: any) => `${r.key} (${r.polarite || '?'})`)} color="purple" />
              </div>
            )}

            {/* Foyers */}
            {activeFoyers.length > 0 && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Foyers actifs</span>
                <div className="chips-group">
                  {activeFoyers.map((f: any) => (
                    <span key={f.key} className="chip chip-purple">
                      {f.key}{f.subs?.length ? ` — ${f.subs.join(', ')}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Merveilleux Vaisseaux */}
            {activeMV.length > 0 && (
              <div>
                <div className="detail-label" style={{ marginBottom: 6 }}>Merveilleux Vaisseaux</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeMV.map((mv: any) => {
                    const flags: string[] = []
                    if (mv.fonctionExterne) flags.push('Ext.')
                    if (mv.axeDistribution) flags.push('Axe')
                    if (mv.fonctionInterne) flags.push('Int.')
                    return (
                      <span key={mv.name} className="chip chip-purple" style={{ fontSize: 11 }}>
                        {mv.name}{flags.length ? ` [${flags.join('+')}]` : ''}{mv.note ? ` – ${mv.note}` : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Points Mu */}
            {energy.pointsMu?.length > 0 && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Points Mu</span>
                <Chips values={energy.pointsMu} color="purple" />
              </div>
            )}

            {/* Empereur */}
            {energy.empereur && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Empereur</span>
                <Chips values={[`${energy.empereur} (${energy.empereurPolarite || '?'})`]} color="purple" />
              </div>
            )}

            {/* Pénétration */}
            {penEmp && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Pénétration Emp.</span>
                <Chips values={penEmp.split(', ').filter(Boolean)} color="purple" />
              </div>
            )}
            {penComp && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Pénétration Comp.</span>
                <Chips values={penComp.split(', ').filter(Boolean)} color="purple" />
              </div>
            )}

            {/* Syndrome */}
            {energy.syndrome?.length > 0 && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Syndrome</span>
                <Chips values={energy.syndrome} color="purple" />
              </div>
            )}
            {energy.syndromeClimat?.length > 0 && (
              <div className="energy-summary-row">
                <span className="detail-label" style={{ width: 180, flexShrink: 0 }}>Climat / Wu Shu</span>
                <Chips values={energy.syndromeClimat} color="purple" />
              </div>
            )}

            {/* Énergie compensatrice */}
            {(ec.biaoli || ec.midiMinuit || ec.gmMeridien || ec.cinqMouvements?.length || ec.element || ec.gmNotes || ec.notes) && (
              <div>
                <div className="detail-label" style={{ marginBottom: 6 }}>Énergie compensatrice</div>
                <div className="fields-row">
                  <FieldLine label="Biao Li"       value={ec.biaoli} />
                  <FieldLine label="Midi/Minuit"   value={ec.midiMinuit} />
                  {ec.gmMeridien && (
                    <FieldLine label="Grand Méridien"
                      value={`${ec.gmMeridien}${ec.gmType?.length ? ` — ${ec.gmType.join(', ')}` : ''}${ec.gmNotes ? ` (${ec.gmNotes})` : ''}`} />
                  )}
                  {ec.cinqMouvements?.length > 0 && <FieldLine label="5 Mouvements" value={ec.cinqMouvements.join(', ')} />}
                  <FieldLine label="Élément"       value={ec.element} />
                  <FieldLine label="Notes"         value={ec.notes} />
                </div>
              </div>
            )}

            {/* Notes tests */}
            {energy.testsNotes && <div className="detail-note">{energy.testsNotes}</div>}
          </div>
        </div>
      )}

      {/* ─── 6. TRAITEMENT ───────────────────────────────────────── */}
      {showMtcSections && (s.points || s.pts_oreille || s.techniques || s.plantes || s.reactions || s.traitement_notes) && (
        <SummaryBlock title="Traitement du jour" icon="🌿" color="var(--accent)">
          <Row     label="Points d'acupuncture"     value={s.points} />
          <Row     label="Points d'oreille"         value={s.pts_oreille} />
          <Row     label="Techniques utilisées"     value={s.techniques} />
          <Row     label="Plantes / Formule"        value={s.plantes} />
          <HtmlRow label="Réactions / observations" value={s.reactions} />
          <HtmlRow label="Notes traitement"         value={s.traitement_notes} />
        </SummaryBlock>
      )}

      {/* ─── 7. BARRAGE HOMÉOPATHIQUE ────────────────────────────── */}
      {showMtcSections && hasBarrage && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--amber)' }}>💊 Barrage homéopathique</h3>
          <div className="barrage-summary-grid">
            {[['Niveau 1', barrageNiv1], ['Niveau 2', barrageNiv2], ['Niveau 3', barrageNiv3], ['Niveau 4', barrageNiv4]].map(([lbl, val]) => val ? (
              <div key={lbl as string} className="barrage-summary-block">
                <div className="detail-label">{lbl}</div>
                {/<[a-z][\s\S]*>/i.test(val as string)
                  ? <div className="detail-value" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(val as string) }} />
                  : <div className="detail-value">{val}</div>
                }
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* ─── 8. SUIVI & CONSEILS ─────────────────────────────────── */}
      {(s.conseils || s.plan || s.surveiller || s.next_session_date) && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--teal)' }}>📅 Plan de suivi &amp; Conseils</h3>
          <div className="summary-grid">
            <HtmlRow label="Conseils au patient" value={s.conseils} />
            <HtmlRow label="Plan à long terme"   value={s.plan} />
            <Row label="À surveiller"        value={s.surveiller} />
          </div>
          {s.next_session_date && (
            <div style={{ marginTop: 12, background: 'var(--teal-light)', border: '1px solid rgba(42,122,106,.25)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>📅</span>
              <div>
                <div className="detail-label" style={{ color: 'var(--teal)', marginBottom: 2 }}>Prochain rendez-vous prévu</div>
                <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 15 }}>{fmtDate(s.next_session_date)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── DOSSIER PATIENT ─────────────────────────────────────── */}
      {p && (p.medications || p.antecedents || p.regular_doctor || p.notes_general) && (
        <SummaryBlock title="Dossier patient" icon="📁" color="var(--text-muted)">
          <Row     label="Médecin régulier"          value={p.regular_doctor} />
          <HtmlRow label="Médicaments / compléments" value={p.medications} />
          <HtmlRow label="Antécédents"               value={p.antecedents} />
          <HtmlRow label="Notes générales"           value={p.notes_general} />
        </SummaryBlock>
      )}

    </div>
  )
}

/* ─── COMPOSANTS RENDU PLUGIN ────────────────────────────────────────────── */

function PluginSummarySection({ section, data }: { section: PluginSection; data: AnyRec }) {
  const fields = section.fields.filter(f => f.type !== 'separator')
  const hasData = fields.some(f => {
    const v = data[f.id]
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v)) return v.length > 0
    return true
  })
  if (!hasData) return null

  const accent = section.accentColor || 'var(--accent)'
  return (
    <div className="summary-section">
      <h3 style={{ color: accent }}>
        {section.icon && <span style={{ marginRight: 6 }}>{section.icon}</span>}
        {section.title}
      </h3>
      <div className="summary-grid">
        {[...fields].sort((a, b) => (a.summary?.priority ?? 999) - (b.summary?.priority ?? 999)).map(field => (
          <PluginFieldSummary key={field.id} field={field} value={data[field.id]} />
        ))}
      </div>
    </div>
  )
}

