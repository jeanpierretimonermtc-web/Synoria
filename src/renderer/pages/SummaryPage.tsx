import React, { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Session, Patient } from '../../shared/types'
import type { PluginDefinition, PluginSection, PluginField } from '../../shared/pluginTypes'
import { ToastContext } from '../App'
import { fmtDate, calcAge } from '../utils/format'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
type AnyRec = Record<string, any>

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
        ? <div className="detail-value" dangerouslySetInnerHTML={{ __html: value }} />
        : <div className="detail-value">{value}</div>
      }
    </div>
  )
}

function SummaryBlock({ title, icon, color, children }: { title: string; icon?: string; color?: string; children: React.ReactNode }) {
  const hasContent = React.Children.toArray(children).some(c => c !== null && c !== undefined && c !== false)
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

/* ─── PAGE ───────────────────────────────────────────────────────────────── */

export default function SummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession]       = useState<Session | null>(null)
  const [patient, setPatient]       = useState<Patient | null>(null)
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [loading, setLoading]       = useState(true)
  const [activePlugin, setActivePlugin] = useState<PluginDefinition | null>(null)
  const showToast = useContext(ToastContext)
  const navigate  = useNavigate()

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
    window.mtcApi.pluginGet().then(p => setActivePlugin(p || null)).catch(() => {})
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
          </div>
        )}
      </div>

      {!session
        ? <div className="empty">Sélectionnez un patient et une séance pour afficher le résumé.</div>
        : <SummaryContent session={session} patient={patient} activePlugin={activePlugin} />
      }
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
  let fd: AnyRec = {}
  try { if (s.full_data_json) fd = JSON.parse(s.full_data_json) } catch {}

  /* ── Données plugin ── */
  const pluginData: AnyRec      = (fd.pluginData  as AnyRec)          || {}
  const pluginId:   string      = (fd.pluginId    as string)           || ''
  const pluginSchema             = (fd.pluginSchema as PluginDefinition) || null
  // Définition à utiliser : schéma sauvegardé (priorité) ou plugin actif si ID correspond
  const pluginDef: PluginDefinition | null =
    pluginSchema
    ?? (activePlugin && !activePlugin.useBuiltinForm && activePlugin.id === pluginId ? activePlugin : null)
  const hasPluginData = !!(pluginDef && Object.values(pluginData).some(v =>
    v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  ))

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
        <HtmlRow label="Prise de notes (interrogatoire)" value={fd.anamnese} />
        <Row label="Évolution (tag)" value={s.evolution_tags} />
        <HtmlRow label="Évolution (détail)" value={s.evolution} />
      </SummaryBlock>

      {/* ─── SECTIONS PLUGIN ─────────────────────────────────────── */}
      {hasPluginData && pluginDef && pluginDef.sections.map(section => (
        <PluginSummarySection key={section.id} section={section} data={pluginData} />
      ))}

      {/* ─── 2. OBSERVATION MTC ──────────────────────────────────── */}
      {(s.langue || langueNote || s.pouls || hasPoulsPos || poulsNote ||
        s.constitution || s.type_corps || s.teint || s.observation) && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--teal)' }}>👀 Observation MTC</h3>

          {/* Langue */}
          {(s.langue || langueNote) && (
            <div className="obs-block">
              <div className="detail-label">Langue</div>
              {s.langue && <Chips values={s.langue.split(', ').filter(Boolean)} color="teal" />}
              {langueNote && <div className="detail-note">{langueNote}</div>}
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
              {poulsNote && <div className="detail-note">{poulsNote}</div>}
            </div>
          )}

          {/* Autres observations */}
          <div className="summary-grid" style={{ marginTop: 10 }}>
            <Row label="Constitution"      value={s.constitution} />
            <Row label="Type de corps"     value={s.type_corps} />
            <Row label="Teint"             value={s.teint} />
            <Row label="Observation générale" value={s.observation} />
          </div>
        </div>
      )}

      {/* ─── 3. QUESTIONNAIRE PAR SYSTÈMES ──────────────────────── */}
      {hasSysData && (
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
      <SummaryBlock title="Diagnostic MTC" icon="🔵" color="var(--purple)">
        <Row label="Diagnostic MTC principal" value={s.diagnostic_mtc} />
        <Row label="5 Éléments"               value={s.cinq_elements} />
        <Row label="Causes"                   value={s.causes} />
        <Row label="Mécanisme / terrain"       value={s.analyse} />
        <Row label="Principes de traitement"   value={s.principes} />
      </SummaryBlock>

      {/* ─── 5. TESTS ÉNERGÉTIQUES ───────────────────────────────── */}
      {hasEnergy && (
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
      <SummaryBlock title="Traitement du jour" icon="🌿" color="var(--accent)">
        <Row label="Points d'acupuncture"          value={s.points} />
        <Row label="Points d'oreille"              value={s.pts_oreille} />
        <Row label="Techniques utilisées"          value={s.techniques} />
        <Row label="Plantes / Formule"             value={s.plantes} />
        <Row label="Réactions / observations"      value={s.reactions} />
        <Row label="Notes traitement"              value={s.traitement_notes} />
      </SummaryBlock>

      {/* ─── 7. BARRAGE HOMÉOPATHIQUE ────────────────────────────── */}
      {hasBarrage && (
        <div className="summary-section">
          <h3 style={{ color: 'var(--amber)' }}>💊 Barrage homéopathique</h3>
          <div className="barrage-summary-grid">
            {barrageNiv1 && (
              <div className="barrage-summary-block">
                <div className="detail-label">Niveau 1</div>
                <div className="detail-value">{barrageNiv1}</div>
              </div>
            )}
            {barrageNiv2 && (
              <div className="barrage-summary-block">
                <div className="detail-label">Niveau 2</div>
                <div className="detail-value">{barrageNiv2}</div>
              </div>
            )}
            {barrageNiv3 && (
              <div className="barrage-summary-block">
                <div className="detail-label">Niveau 3</div>
                <div className="detail-value">{barrageNiv3}</div>
              </div>
            )}
            {barrageNiv4 && (
              <div className="barrage-summary-block">
                <div className="detail-label">Niveau 4</div>
                <div className="detail-value">{barrageNiv4}</div>
              </div>
            )}
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
          <Row label="Médecin régulier"             value={p.regular_doctor} />
          <Row label="Médicaments / compléments"    value={p.medications} />
          <Row label="Antécédents"                  value={p.antecedents} />
          <Row label="Notes générales"              value={p.notes_general} />
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
        {fields.map(field => (
          <PluginFieldSummary key={field.id} field={field} value={data[field.id]} />
        ))}
      </div>
    </div>
  )
}

function PluginFieldSummary({ field, value }: { field: PluginField; value: any }) {
  if (value === null || value === undefined || value === '') return null

  switch (field.type) {

    case 'richtext':
    case 'textarea': {
      const str = String(value || '').trim()
      if (!str) return null
      const hasHtml = /<[a-z][\s\S]*>/i.test(str)
      return (
        <div>
          <div className="detail-label">{field.label}</div>
          {hasHtml
            ? <div className="detail-value" dangerouslySetInnerHTML={{ __html: str }} />
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
          <div className="detail-label">{field.label}</div>
          <div className="detail-value">{str}</div>
        </div>
      )
    }

    case 'checkbox':
      return value ? (
        <div>
          <div className="detail-value" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ✓ {field.label}
          </div>
        </div>
      ) : null

    case 'checkboxgroup':
    case 'tags': {
      const arr: string[] = Array.isArray(value) ? value : []
      if (!arr.length) return null
      return (
        <div>
          <div className="detail-label">{field.label}</div>
          <Chips values={arr} color="blue" />
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
          <div className="detail-label">{field.label}</div>
          <span className="score-badge" style={{ borderColor: col, color: col }}>
            <strong>{num}</strong> / {max}
          </span>
        </div>
      )
    }

    default:
      return null
  }
}
