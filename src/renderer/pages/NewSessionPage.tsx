import React, { useEffect, useState, useContext, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import type { Patient, Session, ConsultationType, SystemesQuestionnaire, EnergyTests, Appointment, SessionFullData } from '../../shared/types'
import type { PluginDefinition } from '../../shared/pluginTypes'
import PluginFormRenderer from '../components/plugin/PluginFormRenderer'
import { showConfirm } from '../components/common/ConfirmDialog'
import { ToastContext } from '../App'
import { useRestriction } from '../hooks/useRestriction'
import RichTextArea from '../components/common/RichTextArea'
import { defaultSystemes, defaultEnergyTests, migrateSystemes, MV_LIST, RECHAUFFEURS, FOYERS, POINTS_MU, SYNDROMES_BASE, SYNDROMES_CLIMAT, PENETRATION_LEVELS } from '../utils/sessionData'
import { sanitizeRichTextHtml } from '../utils/sanitizeHtml'
import SystemesForm from '../components/forms/SystemesForm'

const OFFICIAL_FORM_IDS = ['basique', 'mtc_jp', 'osteopathie', 'kinesio_charlotte', 'naturopathie', 'douleur_evolution'] as const

/* ─── SCORE BUTTON COMPONENT ─────────────────────────────────── */
function ScoreButtons({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="score-btns">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} className={`score-btn${value === n ? ' active' : ''}`} onClick={() => onChange(value === n ? 0 : n)}>{n}</button>
      ))}
    </div>
  )
}

/* ─── TAG BUTTON ─────────────────────────────────────────────── */
function TagBtn({ label, active, colorClass, onClick }: { label: string; active: boolean; colorClass?: string; onClick: () => void }) {
  return (
    <span className={`tag${active ? ' active' : ''}${colorClass ? ' ' + colorClass : ''}`} onClick={onClick}>{label}</span>
  )
}

/* ─── ACCORDÉON SÉANCE PRÉCÉDENTE ───────────────────────────── */

function PrevField({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  const hasHtml = /<[a-z][\s\S]*>/i.test(value)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      {hasHtml
        ? <div className="detail-value" style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(value) }} />
        : <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{value}</div>
      }
    </div>
  )
}

function PrevSessionAccordion({ session: s, open, onToggle }: {
  session: Session
  open: boolean
  onToggle: () => void
}) {
  const fd: SessionFullData = (() => { try { return s.full_data_json ? JSON.parse(s.full_data_json) as SessionFullData : {} } catch { return {} } })()

  const anamnese    = fd.anamnese    || ''
  const barrageNiv1 = fd.barrageNiv1 || ''
  const barrageNiv2 = fd.barrageNiv2 || ''
  const barrageNiv3 = fd.barrageNiv3 || ''
  const barrageNiv4 = fd.barrageNiv4 || ''
  const nextNote              = fd.nextSessionNote          || ''
  const prevSimpleContextVie  = fd.simpleContextVie         || ''
  const prevSimpleTraitements = fd.simpleTraitementsEnCours || ''
  const prevSimpleObjectifs   = fd.simpleObjectifs          || ''
  const prevSimpleNotes       = fd.simpleNotesEntretien     || ''
  const pluginId              = fd.pluginId  || ''
  const pluginData  = (fd.pluginData as Record<string, unknown>) || {}
  const pluginSchema = fd.pluginSchema || null
  const isMtcBuiltin = !!(fd.pluginIsBuiltin) || pluginId === 'mtc_jp'
  const hasPlugin    = !!pluginId && !isMtcBuiltin && !!pluginSchema
  const pluginSchemaMissing = !!pluginId && !isMtcBuiltin && !pluginSchema

  // Aperçu tronqué du motif pour le header
  const motifPreview = s.motif
    ? s.motif.replace(/<[^>]+>/g, '').slice(0, 60) + (s.motif.replace(/<[^>]+>/g, '').length > 60 ? '…' : '')
    : ''

  // Helper pour afficher une valeur de champ plugin
  const renderPluginVal = (type: string, val: unknown, max?: number): string | null => {
    if (val === null || val === undefined || val === '') return null
    if (type === 'before_after' && typeof val === 'object' && !Array.isArray(val)) {
      const ba = val as { before?: number; after?: number }
      const m = max ?? 10
      const parts = [
        typeof ba.before === 'number' ? `Avant : ${ba.before}/${m}` : '',
        typeof ba.after  === 'number' ? `Après : ${ba.after}/${m}` : '',
      ].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }
    if (type === 'repeatable' && Array.isArray(val)) {
      const rows = (val as Array<{ nom?: string; note?: string }>).filter(r => r?.nom?.trim())
      return rows.length ? rows.map(r => r.nom).join(', ') : null
    }
    if (Array.isArray(val)) return val.length ? (val as string[]).join(', ') : null
    if (type === 'checkbox') return val ? '✓' : null
    if (type === 'rating' || type === 'slider') return `${val} / ${max ?? 10}`
    if (type === 'bodychart' && typeof val === 'object') {
      const chart = val as { front?: string[]; back?: string[]; left?: string[]; right?: string[]; notes?: string }
      const parts = [
        chart.front?.length  ? `Antérieur : ${chart.front.join(', ')}`       : '',
        chart.back?.length   ? `Postérieur : ${chart.back.join(', ')}`        : '',
        chart.left?.length   ? `Profil G : ${chart.left.join(', ')}`          : '',
        chart.right?.length  ? `Profil D : ${chart.right.join(', ')}`         : '',
        chart.notes?.trim()  ? `Notes : ${chart.notes.trim()}`                : '',
      ].filter(Boolean)
      return parts.length ? parts.join(' | ') : null
    }
    // Modules complexes (mtc_systemes, osteo_posture, etc.) : trop riches pour ce contexte
    if (typeof val === 'object') return null
    const str = String(val).replace(/<[^>]+>/g, '').trim()
    return str || null
  }

  return (
    <div style={{
      borderRadius: 'var(--radius)',
      border: '1.5px solid var(--border-soft)',
      background: 'var(--surface)',
      marginBottom: 0,
      overflow: 'hidden',
    }}>
      {/* ── Header cliquable ── */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid var(--border-soft)' : 'none',
        }}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Séance précédente — </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.date}</span>
          {motifPreview && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>· {motifPreview}</span>}
          {pluginId && <span style={{ fontSize: 10, marginLeft: 8, padding: '1px 6px', borderRadius: 10, background: 'var(--blue-light)', color: 'var(--blue)', fontWeight: 700 }}>{pluginId}</span>}
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
      </button>

      {/* ── Contenu déplié ── */}
      {open && (
        <div style={{ padding: '14px 16px', maxHeight: 480, overflowY: 'auto' }}>

          {/* ── Champs communs à tous les modes ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', marginBottom: 8 }}>
            <div>
              <PrevField label="Motif" value={s.motif} />
              <PrevField label="Problématiques / Terrain" value={s.problematiques} />
              <PrevField label="Évolution" value={s.evolution} />
              {s.evolution_tags && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Évolution (tag)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.evolution_tags.split(', ').filter(Boolean).map(t => (
                      <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <PrevField label="Conseils donnés" value={s.conseils} />
              <PrevField label="À surveiller" value={s.surveiller} />
              {nextNote && <PrevField label="Note pour cette séance" value={nextNote} />}
            </div>
          </div>

          {/* ── MODE MTC INTÉGRÉ ── */}
          {(isMtcBuiltin || !pluginId) && (
            <>
              {(anamnese || s.problematiques) && (
                <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10, marginBottom: 8 }}>
                  <PrevField label="Prise de notes / Anamnèse" value={anamnese} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                <div>
                  <PrevField label="Diagnostic MTC" value={s.diagnostic_mtc} />
                  <PrevField label="5 Éléments"     value={s.cinq_elements} />
                  <PrevField label="Causes"          value={s.causes} />
                  <PrevField label="Analyse / Mécanisme" value={s.analyse} />
                  <PrevField label="Principes"       value={s.principes} />
                </div>
                <div>
                  <PrevField label="Points d'acupuncture" value={s.points} />
                  <PrevField label="Points d'oreille"     value={s.pts_oreille} />
                  <PrevField label="Techniques"           value={s.techniques} />
                  <PrevField label="Plantes / Formule"    value={s.plantes} />
                  <PrevField label="Réactions"            value={s.reactions} />
                  <PrevField label="Notes traitement"     value={s.traitement_notes} />
                  {(barrageNiv1 || barrageNiv2 || barrageNiv3 || barrageNiv4) && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Barrage</div>
                      {[barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4].map((v, i) => v ? (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>N{i + 1} : {v}</div>
                      ) : null)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── MODE SIMPLE (aucun plugin) ── */}
          {!pluginId && (prevSimpleContextVie || prevSimpleTraitements || prevSimpleObjectifs || s.observation) && (
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Interrogatoire & Bilan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
                <PrevField label="Contexte & vie"          value={prevSimpleContextVie} />
                <PrevField label="Objectifs"               value={prevSimpleObjectifs} />
                <PrevField label="Traitements en cours"    value={prevSimpleTraitements} />
                <PrevField label="Observations cliniques"  value={s.observation} />
              </div>
            </div>
          )}
          {!pluginId && prevSimpleNotes && (
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Notes d'entretien</div>
              <PrevField label="" value={prevSimpleNotes} />
            </div>
          )}
          {!pluginId && (s.traitement_notes || s.reactions) && (
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
              <PrevField label="Traitement effectué" value={s.traitement_notes} />
              <PrevField label="Réactions"           value={s.reactions} />
            </div>
          )}

          {/* ── MODE PLUGIN TIERS ── */}
          {hasPlugin && pluginSchema && (
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
              {pluginSchema.sections?.map(section => {
                const sectionFields = section.fields.filter(f => f.type !== 'separator')
                const hasData = sectionFields.some(f => {
                  const v = pluginData[f.id]
                  const rendered = renderPluginVal(f.type, v, f.max)
                  return rendered !== null
                })
                if (!hasData) return null
                return (
                  <div key={section.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                      {section.icon && <span style={{ marginRight: 4 }}>{section.icon}</span>}{section.title}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
                      {sectionFields.map(f => {
                        const val = pluginData[f.id]
                        if (f.type === 'checkbox') {
                          return val ? (
                            <div key={f.id} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>✓ {f.label}</div>
                          ) : null
                        }
                        if (f.type === 'checkboxgroup' || f.type === 'tags') {
                          const arr = Array.isArray(val) ? val as string[] : []
                          if (!arr.length) return null
                          return (
                            <div key={f.id} style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 3 }}>{f.label}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {arr.map(t => <span key={t} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--blue-light)', color: 'var(--blue)' }}>{t}</span>)}
                              </div>
                            </div>
                          )
                        }
                        const str = renderPluginVal(f.type, val, f.max)
                        return str ? <PrevField key={f.id} label={f.label} value={str} /> : null
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {pluginSchemaMissing && (
        <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
            Formulaire [{pluginId}] — schéma non disponible (séance ancienne, données conservées en base).
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export default function NewSessionPage() {
  const { patientId: routePatientId, sessionId: editSessionId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const showToast = useContext(ToastContext)
  const isEditing = !!editSessionId
  const restriction = useRestriction()
  const canSave = isEditing ? restriction.canModifySession : restriction.canCreateSession
  const R_TIP = 'Mode restreint — abonnement requis'

  const urlApptId = searchParams.get('apptId') || ''

  const [patients, setPatients] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState(routePatientId || '')
  const [currentApptId, setCurrentApptId] = useState(urlApptId)
  const [sessionNum, setSessionNum] = useState(1)
  const [date, setDate] = useState(() => searchParams.get('date') || new Date().toISOString().slice(0, 10))
  const [practitioner, setPractitioner] = useState('')
  const [motif, setMotif] = useState(() => searchParams.get('motif') || '')
  const [evolutionTags, setEvolutionTags] = useState<string[]>([])
  const [evolution, setEvolution] = useState('')
  const [problematiques, setProblematiques] = useState('')   // gardé pour rétrocompat
  // Observation MTC
  const [langue, setLangue] = useState<string[]>([])
  const [langueNote, setLangueNote] = useState('')
  const [pouls, setPouls] = useState<string[]>([])
  const [poulsNote, setPoulsNote] = useState('')
  const [poulsPos, setPoulsPos] = useState({
    droitAvant: '', droitMilieu: '', droitArriere: '',
    gaucheAvant: '', gaucheMilieu: '', gaucheArriere: '',
  })
  const [constitution, setConstitution] = useState('')
  const [typeCorps, setTypeCorps] = useState('')
  const [teint, setTeint] = useState('')
  const [observation, setObservation] = useState('')
  // Analyse
  const [diagnostic, setDiagnostic] = useState('')
  const [cinqElements, setCinqElements] = useState('')
  const [causes, setCauses] = useState('')
  const [analyse, setAnalyse] = useState('')
  const [principes, setPrincipes] = useState('')
  // Traitement
  const [points, setPoints] = useState('')
  const [ptsOreille, setPtsOreille] = useState('')
  const [techniques, setTechniques] = useState<string[]>([])
  const [plantes, setPlantes] = useState('')
  const [reactions, setReactions] = useState('')
  const [traitementNotes, setTraitementNotes] = useState('')
  // Suivi
  const [conseils, setConseils] = useState('')
  const [plan, setPlan] = useState('')
  const [surveiller, setSurveiller] = useState('')
  // Barrage homéopathique
  const [barrageNiv1, setBarrageNiv1] = useState('')
  const [barrageNiv2, setBarrageNiv2] = useState('')
  const [barrageNiv3, setBarrageNiv3] = useState('')
  const [barrageNiv4, setBarrageNiv4] = useState('')
  // Profils de séance (Phase 3) — sélecteur additif
  const [profiles,          setProfiles]          = useState<import('../../shared/sessionProfileTypes').SessionFormProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  // Plugin spécialité
  const [activePlugin,     setActivePlugin]     = useState<PluginDefinition | null>(null)
  const [availablePlugins, setAvailablePlugins] = useState<PluginDefinition[]>([])
  const [pluginData,       setPluginData]       = useState<Record<string, any>>({})
  const pluginLoadedIdRef = useRef<string | null>(null)
  const [isOwner,          setIsOwner]          = useState(false)

  // Prochain rendez-vous (synchronisé avec le calendrier)
  const [nextSession,       setNextSession]       = useState('')
  const [nextSessionHeure,  setNextSessionHeure]  = useState('09:00')
  const [nextSessionFin,    setNextSessionFin]    = useState('')
  const [nextSessionNote,   setNextSessionNote]   = useState('')
  const [nextSessionApptId, setNextSessionApptId] = useState('') // ID du RDV lié dans le calendrier
  const [patientAppts,      setPatientAppts]      = useState<Appointment[]>([])
  // Séance précédente (accordéon de référence)
  const [prevSession,      setPrevSession]      = useState<Session | null>(null)
  const [prevSessionOpen,  setPrevSessionOpen]  = useState(false)
  // Prise de notes libre (interrogatoire / anamnèse)
  const [anamnese, setAnamnese] = useState('')
  // Mode simple — champs enrichis (stockés dans full_data_json)
  const [simpleContextVie,         setSimpleContextVie]         = useState('')
  const [simpleTraitementsEnCours, setSimpleTraitementsEnCours] = useState('')
  const [simpleObjectifs,          setSimpleObjectifs]          = useState('')
  const [simpleNotesEntretien,     setSimpleNotesEntretien]     = useState('')
  const [techInput, setTechInput] = useState('')
  const addTech = () => {
    const t = techInput.trim()
    if (t && !techniques.includes(t)) setTechniques(prev => [...prev, t])
    setTechInput('')
  }
  // Clôture séance : marquer RDV réalisé + comptabilité
  const [markRdvDone,      setMarkRdvDone]      = useState(false)
  const [enableCompta,     setEnableCompta]     = useState(false)
  const [clotureTypeId,    setClotureTypeId]    = useState('')
  const [clotureTypes,     setClotureTypes]     = useState<ConsultationType[]>([])
  const [currentMonthNb,   setCurrentMonthNb]   = useState<number | null>(null)
  // Brouillon auto-sauvegardé
  const [draftInfo, setDraftInfo] = useState<{ patientName: string; date: string; autoRestored?: boolean } | null>(null)
  // Systèmes
  const [systemes, setSystemes] = useState<SystemesQuestionnaire>(defaultSystemes())
  // Tests énergétiques
  const [energy, setEnergy] = useState<EnergyTests>(defaultEnergyTests())
  // Informations patient (synchronisées avec la fiche patient)
  const [patientInfo, setPatientInfo] = useState<Record<string, string>>({})

  useEffect(() => {
    window.mtcApi.getPatients().then(setPatients)
  }, [])

  // Charge les infos patient quand le patient change
  useEffect(() => {
    if (!patientId) { setPatientInfo({}); return }
    window.mtcApi.getPatientById(patientId).then(p => {
      if (!p) return
      setPatientInfo({
        first_name:    p.first_name      || '',
        last_name:     p.last_name       || '',
        birth_date:    p.birth_date      || '',
        phone:         p.phone           || '',
        email:         p.email           || '',
        address:       p.address         || '',
        profession:    p.profession      || '',
        antecedents:   p.antecedents     || '',
        medications:   p.medications     || '',
        alerts:        p.alerts          || '',
        notes_general: p.notes_general   || '',
      })
    })
  }, [patientId])

  useEffect(() => {
    // Profils de séance (Phase 3) — chargement additif, ne change pas le formulaire actif
    Promise.all([window.mtcApi.profilesGetAll(), window.mtcApi.profilesGetDefault()])
      .then(([list, def]) => {
        setProfiles((list || []).filter(p => !p.isArchived))
        if (def) setSelectedProfileId(def.id)
      })
      .catch(() => {})

    window.mtcApi.ownerCheck().then(setIsOwner).catch(() => {})

    Promise.all([
      window.mtcApi.pluginGet(),
      window.mtcApi.pluginListAvailable(),
    ]).then(([p, all]) => {
      setAvailablePlugins(all)
      if (!isEditing) {
        // En création : utiliser le plugin actif (rafraîchi depuis le bundle si disponible,
        // sinon conserver la version stockée dans userData pour les plugins payants).
        // Fallback sur basique si aucun plugin actif.
        const effective = p
          ? (all.find(f => f.id === p.id) ?? p)
          : (all.find(f => f.id === 'basique') ?? null)
        setActivePlugin(effective)
        pluginLoadedIdRef.current = effective?.id ?? null
      } else {
        setActivePlugin(p || null)
        pluginLoadedIdRef.current = p?.id ?? null
      }
    }).catch(() => {})
    window.mtcApi.getConsultationTypes().then(all => {
      const active = all.filter(t => t.is_active)
      setClotureTypes(active)
      // Ne pas pré-sélectionner : l'utilisateur doit cocher la case explicitement
    }).catch(() => {})
  }, [])


  // Charge le décompte déjà enregistré pour ce type/mois dans la compta
  useEffect(() => {
    if (!clotureTypeId || !date) { setCurrentMonthNb(null); return }
    const [y, m] = date.split('-').map(Number)
    if (!y || !m) return
    window.mtcApi.getComptaYearData(y).then(data => {
      const rev = (data as any).monthlyRevenue?.find(
        (r: any) => r.month === m && r.type_id === clotureTypeId
      )
      setCurrentMonthNb(rev?.nb_seances ?? 0)
    }).catch(() => setCurrentMonthNb(null))
  }, [clotureTypeId, date])

  useEffect(() => {
    if (routePatientId) setPatientId(routePatientId)
  }, [routePatientId])

  // Si on arrive depuis un RDV (Dashboard ou Calendrier), charger le RDV pour
  // remplir le patient et pré-cocher "Marquer comme réalisé"
  useEffect(() => {
    if (!urlApptId || isEditing) return
    window.mtcApi.getAppointments().then(all => {
      const appt = all.find(a => a.id === urlApptId)
      if (!appt) return
      setCurrentApptId(appt.id)
      setMarkRdvDone(true)
      // Remplir le patient si l'URL ne le contenait pas
      if (!routePatientId && appt.patient_id) {
        setPatientId(appt.patient_id)
      }
    }).catch(() => {})
  }, [urlApptId, isEditing, routePatientId])

  // Charge les RDV calendrier du patient (non réalisés, à venir)
  useEffect(() => {
    if (!patientId) { setPatientAppts([]); return }
    const todayStr = new Date().toISOString().slice(0, 10)
    window.mtcApi.getAppointmentsByPatient(patientId).then(appts => {
      setPatientAppts(appts.filter(a => !a.is_done && a.date >= todayStr))
    })
  }, [patientId])

  // Calcul du numéro de séance + chargement de la séance précédente
  useEffect(() => {
    if (!patientId) { setPrevSession(null); return }
    window.mtcApi.getSessions(patientId).then(sessions => {
      const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
      if (isEditing && editSessionId) {
        const idx = sorted.findIndex(s => s.id === editSessionId)
        setSessionNum(idx >= 0 ? idx + 1 : sorted.length)
        // séance précédente = celle juste avant dans la liste
        setPrevSession(idx > 0 ? sorted[idx - 1] : null)
      } else {
        setSessionNum(sorted.length + 1)
        // séance précédente = la plus récente
        setPrevSession(sorted.length > 0 ? sorted[sorted.length - 1] : null)
      }
    })
  }, [patientId, isEditing, editSessionId])

  // ─── AUTO-SAUVEGARDE ──────────────────────────────────────────
  const DRAFT_KEY = 'mtc_session_draft'

  // Ref toujours à jour — évite les stale closures dans blur/unmount
  const draftRef = useRef<Record<string, unknown>>({})
  useEffect(() => {
    if (isEditing) return
    draftRef.current = {
      patientId, date, practitioner, motif, evolutionTags, evolution, problematiques,
      anamnese, simpleContextVie, simpleTraitementsEnCours, simpleObjectifs, simpleNotesEntretien,
      langue, langueNote, pouls, poulsNote, poulsPos, constitution, typeCorps, teint, observation,
      diagnostic, cinqElements, causes, analyse, principes,
      points, ptsOreille, techniques, plantes, reactions, traitementNotes,
      conseils, plan, surveiller,
      nextSession, nextSessionHeure, nextSessionFin, nextSessionNote, nextSessionApptId,
      barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4,
      systemes, energy, pluginData,
      activePluginSnapshot: activePlugin && !activePlugin.useBuiltinForm ? activePlugin : null,
      _savedAt: Date.now(),
    }
  }, [isEditing, patientId, date, practitioner, motif, evolutionTags, evolution, problematiques,
      anamnese, simpleContextVie, simpleTraitementsEnCours, simpleObjectifs, simpleNotesEntretien,
      langue, langueNote, pouls, poulsNote, poulsPos, constitution, typeCorps, teint, observation,
      diagnostic, cinqElements, causes, analyse, principes,
      points, ptsOreille, techniques, plantes, reactions, traitementNotes,
      conseils, plan, surveiller,
      nextSession, nextSessionHeure, nextSessionFin, nextSessionNote, nextSessionApptId,
      barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4,
      systemes, energy, pluginData, activePlugin])

  const saveDraftNow = useCallback(() => {
    const d = draftRef.current
    if (!d?.patientId) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch {}
  }, [])

  // 1. Sauvegarde synchrone au DÉMONTAGE du composant
  //    C'est la seule garantie pour le verrou inactif (pas de blur OS, pas de visibilitychange)
  //    isEditing est stable pendant le cycle de vie → safe dans un [] cleanup
  useEffect(() => {
    return () => {
      if (isEditing) return
      const d = draftRef.current
      if (!d?.patientId) return
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // [] → cleanup uniquement au démontage final

  // 2. Debounce 4 s après chaque changement (frappe normale sans lock)
  useEffect(() => {
    if (isEditing || !patientId) return
    const t = setTimeout(saveDraftNow, 4_000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, patientId, date, practitioner, motif, evolutionTags, evolution, problematiques,
      anamnese, simpleContextVie, simpleTraitementsEnCours, simpleObjectifs, simpleNotesEntretien,
      langue, langueNote, pouls, poulsNote, poulsPos, constitution, typeCorps, teint, observation,
      diagnostic, cinqElements, causes, analyse, principes,
      points, ptsOreille, techniques, plantes, reactions, traitementNotes,
      conseils, plan, surveiller,
      nextSession, nextSessionHeure, nextSessionFin, nextSessionNote, nextSessionApptId,
      barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4,
      systemes, energy, pluginData, activePlugin, saveDraftNow])

  // 3. Perte de focus OS (alt-tab, minimiser) → sauvegarde immédiate
  useEffect(() => {
    if (isEditing) return
    const onHide = () => saveDraftNow()
    window.addEventListener('blur', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('blur', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [isEditing, saveDraftNow])

  // 4. Filet de sécurité : intervalle toutes les 30 s
  useEffect(() => {
    if (isEditing) return
    const id = setInterval(saveDraftNow, 30_000)
    return () => clearInterval(id)
  }, [isEditing, saveDraftNow])

  // ─── DÉTECTION DU BROUILLON AU DÉMARRAGE ──────────────────────
  useEffect(() => {
    if (isEditing) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (!d.patientId) return
      const savedAt = d._savedAt ? Date.now() - d._savedAt : Infinity
      const isRecent = savedAt < 4 * 60 * 60 * 1000 // moins de 4 heures
      // Auto-restaure si : même patient que l'URL, ou retour après verrou (pas de patient dans l'URL)
      const samePatient = d.patientId === routePatientId
      const freshStart  = !routePatientId && !urlApptId
      if (isRecent && (samePatient || freshStart)) {
        // Restauration silencieuse — pas de bannière, pas de question
        setPatientId(d.patientId || '')
        setDate(d.date || new Date().toISOString().slice(0, 10))
        setPractitioner(d.practitioner || '')
        setMotif(d.motif || '')
        setEvolutionTags(d.evolutionTags || [])
        setEvolution(d.evolution || '')
        setLangue(d.langue || [])
        setLangueNote(d.langueNote || '')
        setPouls(d.pouls || [])
        setPoulsNote(d.poulsNote || '')
        if (d.poulsPos) setPoulsPos(prev => ({ ...prev, ...d.poulsPos }))
        setConstitution(d.constitution || '')
        setTypeCorps(d.typeCorps || '')
        setTeint(d.teint || '')
        setObservation(d.observation || '')
        setDiagnostic(d.diagnostic || '')
        setCinqElements(d.cinqElements || '')
        setCauses(d.causes || '')
        setAnalyse(d.analyse || '')
        setPrincipes(d.principes || '')
        setPoints(d.points || '')
        setPtsOreille(d.ptsOreille || '')
        setTechniques(d.techniques || [])
        setPlantes(d.plantes || '')
        setReactions(d.reactions || '')
        setTraitementNotes(d.traitementNotes || '')
        setConseils(d.conseils || '')
        setPlan(d.plan || '')
        setSurveiller(d.surveiller || '')
        setNextSession(d.nextSession || '')
        setNextSessionHeure(d.nextSessionHeure || '09:00')
        setNextSessionFin(d.nextSessionFin || '')
        setNextSessionNote(d.nextSessionNote || '')
        setNextSessionApptId(d.nextSessionApptId || '')
        setPluginData(d.pluginData || {})
        if (d.activePluginSnapshot && typeof d.activePluginSnapshot === 'object') {
          setActivePlugin(d.activePluginSnapshot as PluginDefinition)
        }
        setAnamnese(d.anamnese || '')
        setSimpleContextVie(d.simpleContextVie || '')
        setSimpleTraitementsEnCours(d.simpleTraitementsEnCours || '')
        setSimpleObjectifs(d.simpleObjectifs || '')
        setSimpleNotesEntretien(d.simpleNotesEntretien || '')
        setBarrageNiv1(d.barrageNiv1 || '')
        setBarrageNiv2(d.barrageNiv2 || '')
        setBarrageNiv3(d.barrageNiv3 || '')
        setBarrageNiv4(d.barrageNiv4 || '')
        if (d.systemes) setSystemes(migrateSystemes(d.systemes))
        if (d.energy)   setEnergy({ ...defaultEnergyTests(), ...d.energy })
        setDraftInfo({ patientName: d.patientId, date: d.date || '', autoRestored: true })
      } else if (d.patientId) {
        // Brouillon d'un autre patient ou trop ancien → bannière manuelle
        setDraftInfo({ patientName: d.patientId, date: d.date || '' })
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── CHARGEMENT SÉANCE EXISTANTE (mode édition) ────────────────
  useEffect(() => {
    if (!editSessionId) return
    window.mtcApi.getSessionById(editSessionId).then(session => {
      if (!session) { showToast('Séance introuvable', 'error'); return }

      // Priorité : full_data_json qui contient l'état complet du formulaire
      if (session.full_data_json) {
        try {
          const d = JSON.parse(session.full_data_json)
          setPatientId(d.patientId || session.patient_id)
          setDate(d.date || session.date)
          setPractitioner(d.practitioner || '')
          setMotif(d.motif || '')
          setEvolutionTags(d.evolutionTags || [])
          setEvolution(d.evolution || '')
          setProblematiques(d.problematiques || '')
          setLangue(d.langue || [])
          setLangueNote(d.langueNote || '')
          setPouls(d.pouls || [])
          setPoulsNote(d.poulsNote || '')
          if (d.poulsPos) setPoulsPos(prev => ({ ...prev, ...d.poulsPos }))
          setConstitution(d.constitution || '')
          setTypeCorps(d.typeCorps || '')
          setTeint(d.teint || '')
          setObservation(d.observation || '')
          setDiagnostic(d.diagnostic || '')
          setCinqElements(d.cinqElements || '')
          setCauses(d.causes || '')
          setAnalyse(d.analyse || '')
          setPrincipes(d.principes || '')
          setPoints(d.points || '')
          setPtsOreille(d.ptsOreille || '')
          setTechniques(d.techniques || [])
          setPlantes(d.plantes || '')
          setReactions(d.reactions || '')
          setTraitementNotes(d.traitementNotes || '')
          setConseils(d.conseils || '')
          setPlan(d.plan || '')
          setSurveiller(d.surveiller || '')
          setBarrageNiv1(d.barrageNiv1 || '')
          setBarrageNiv2(d.barrageNiv2 || '')
          setBarrageNiv3(d.barrageNiv3 || '')
          setBarrageNiv4(d.barrageNiv4 || '')
          setNextSession(d.nextSession || '')
          setNextSessionHeure(d.nextSessionHeure  || '09:00')
          setNextSessionFin(d.nextSessionFin      || '')
          setNextSessionNote(d.nextSessionNote    || '')
          setNextSessionApptId(d.nextSessionApptId || '')
          setPluginData(d.pluginData || {})
          // Édition : restaurer le formulaire utilisé lors de la séance, pas le formulaire actif global
          if (d.pluginSchema && typeof d.pluginSchema === 'object' && !d.pluginIsBuiltin) {
            setActivePlugin(d.pluginSchema as PluginDefinition)
          }
          // Clôture — restaurer l'état existant pour idempotence
          if (d.comptaTypeId) {
            setClotureTypeId(d.comptaTypeId)
            setEnableCompta(true)
          }
          setAnamnese(d.anamnese || '')
          setSimpleContextVie(d.simpleContextVie || '')
          setSimpleTraitementsEnCours(d.simpleTraitementsEnCours || '')
          setSimpleObjectifs(d.simpleObjectifs || '')
          setSimpleNotesEntretien(d.simpleNotesEntretien || '')
          if (d.systemes) setSystemes(migrateSystemes(d.systemes))
          if (d.energy) {
            // Migration rétrocompatible : les anciens enregistrements ont penetrationEmp/Comp en string
            const e: EnergyTests = { ...defaultEnergyTests(), ...d.energy }
            if (typeof e.penetrationEmp === 'string') e.penetrationEmp = e.penetrationEmp ? [e.penetrationEmp as unknown as string] : []
            if (typeof e.penetrationComp === 'string') e.penetrationComp = e.penetrationComp ? [e.penetrationComp as unknown as string] : []
            setEnergy(e)
          }
          return
        } catch {}
      }

      // Fallback sur les colonnes individuelles
      setPatientId(session.patient_id)
      setDate(session.date)
      setPractitioner(session.practitioner || '')
      setMotif(session.motif || '')
      setEvolutionTags(session.evolution_tags ? session.evolution_tags.split(', ').filter(Boolean) : [])
      setEvolution(session.evolution || '')
      setProblematiques(session.problematiques || '')
      setLangue(session.langue ? session.langue.split(', ').filter(Boolean) : [])
      setPouls(session.pouls ? session.pouls.split(', ').filter(Boolean) : [])
      setConstitution(session.constitution || '')
      setTypeCorps(session.type_corps || '')
      setTeint(session.teint || '')
      setObservation(session.observation || '')
      setDiagnostic(session.diagnostic_mtc || '')
      setCinqElements(session.cinq_elements || '')
      setCauses(session.causes || '')
      setAnalyse(session.analyse || '')
      setPrincipes(session.principes || '')
      setPoints(session.points || '')
      setPtsOreille(session.pts_oreille || '')
      setTechniques(session.techniques ? session.techniques.split(', ').filter(Boolean) : [])
      setPlantes(session.plantes || '')
      setReactions(session.reactions || '')
      setTraitementNotes(session.traitement_notes || '')
      setConseils(session.conseils || '')
      setPlan(session.plan || '')
      setSurveiller(session.surveiller || '')
      if (session.systemes_json) { try { setSystemes(migrateSystemes(JSON.parse(session.systemes_json))) } catch {} }
      if (session.energy_tests_json) {
        try {
          const e: EnergyTests = { ...defaultEnergyTests(), ...JSON.parse(session.energy_tests_json) }
          if (typeof e.penetrationEmp === 'string') e.penetrationEmp = e.penetrationEmp ? [e.penetrationEmp as unknown as string] : []
          if (typeof e.penetrationComp === 'string') e.penetrationComp = e.penetrationComp ? [e.penetrationComp as unknown as string] : []
          setEnergy(e)
        } catch {}
      }
    })
  }, [editSessionId])

  const progress = Math.round(([patientId, date, motif, diagnostic, points].filter(Boolean).length / 5) * 100)

  // ─── HELPERS ──────────────────────────────────────────────────
  const toggleArr = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  const updateEnergy = (updates: Partial<EnergyTests>) => setEnergy(prev => ({ ...prev, ...updates }))

  // ─── MISE À JOUR FICHE PATIENT (depuis la section info patient) ──
  const savePatientField = async (field: string, value: string) => {
    if (!patientId) return
    try {
      await window.mtcApi.updatePatient(patientId, { [field]: value } as any)
      window.mtcApi.getPatients().then(setPatients)
    } catch { showToast('Erreur mise à jour patient', 'error') }
  }

  // ─── SAVE ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!patientId) { showToast('Sélectionnez un patient', 'error'); return }
    if (!date) { showToast('Indiquez la date', 'error'); return }

    // ── Validation des champs requis du plugin ────────────────────────────────
    if (activePlugin && !activePlugin.useBuiltinForm) {
      const MODULE_TYPES_SET = new Set([
        'mtc_systemes', 'mtc_five_elements', 'mtc_tongue_pulse',
        'osteo_ortho_tests', 'osteo_posture',
      ])
      const missing: string[] = []
      for (const section of activePlugin.sections) {
        for (const field of section.fields) {
          if (!field.required || field.type === 'separator' || MODULE_TYPES_SET.has(field.type)) continue
          const val = pluginData[field.id]
          let empty = val === null || val === undefined || val === ''
          if (!empty && Array.isArray(val)) empty = val.length === 0
          if (empty) missing.push(field.label || field.id)
        }
      }
      if (missing.length > 0) {
        showToast(`Champs requis manquants : ${missing.join(', ')}`, 'error')
        return
      }
    }

    try {
      // ── 1. Synchronisation calendrier EN PREMIER ─────────────────
      // On résout l'ID du RDV avant de construire le payload pour que
      // full_data_json contienne toujours le bon nextSessionApptId en DB.
      let resolvedApptId = nextSessionApptId
      if (nextSession && patientId) {
        try {
          if (resolvedApptId) {
            await window.mtcApi.updateAppointment(resolvedApptId, {
              patient_id:  patientId,
              date:        nextSession,
              heure_debut: nextSessionHeure || '09:00',
              heure_fin:   nextSessionFin   || undefined,
              note:        nextSessionNote  || undefined,
              is_done:     0,
            })
          } else {
            const existing = patientAppts.find(a => a.date === nextSession && !a.is_done)
            if (existing) {
              await window.mtcApi.updateAppointment(existing.id, {
                patient_id:  patientId,
                date:        nextSession,
                heure_debut: nextSessionHeure || existing.heure_debut,
                heure_fin:   nextSessionFin   || existing.heure_fin,
                note:        nextSessionNote  || existing.note,
                is_done:     0,
              })
              resolvedApptId = existing.id
            } else {
              const newAppt = await window.mtcApi.createAppointment({
                patient_id:  patientId,
                date:        nextSession,
                heure_debut: nextSessionHeure || '09:00',
                heure_fin:   nextSessionFin   || undefined,
                note:        nextSessionNote  || undefined,
                is_done:     0,
              })
              resolvedApptId = newAppt.id
            }
          }
          setNextSessionApptId(resolvedApptId)
        } catch {
          showToast('Le prochain RDV n\'a pas pu être synchronisé dans le calendrier', 'error')
        }
      }

      // ── 2. Sauvegarde de la séance avec l'ID résolu ──────────────
      const payload = {
        patient_id: patientId, date, practitioner,
        motif, evolution_tags: evolutionTags.join(', '), evolution, problematiques,
        langue: langue.join(', '), pouls: pouls.join(', '), constitution, type_corps: typeCorps, teint, observation,
        diagnostic_mtc: diagnostic, cinq_elements: cinqElements, causes, analyse, principes,
        points, pts_oreille: ptsOreille, techniques: techniques.join(', '), plantes, reactions, traitement_notes: traitementNotes,
        conseils, plan, surveiller,
        next_session_date: nextSession || undefined,
        energy_tests_json: JSON.stringify(energy),
        systemes_json: JSON.stringify(systemes),
        full_data_json: JSON.stringify({
          sessionNum, patientId, date, practitioner, motif, evolutionTags, evolution,
          problematiques, anamnese, langue, langueNote, pouls, poulsNote, poulsPos,
          constitution, typeCorps, teint, observation, diagnostic, cinqElements, causes,
          analyse, principes, points, ptsOreille, techniques, plantes, reactions,
          traitementNotes, conseils, plan, surveiller, nextSession, nextSessionHeure,
          nextSessionFin, nextSessionNote,
          nextSessionApptId: resolvedApptId,
          simpleContextVie, simpleTraitementsEnCours, simpleObjectifs, simpleNotesEntretien,
          barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4, systemes, energy,
          pluginData,
          pluginId:        activePlugin?.id,
          pluginIsBuiltin: !!(activePlugin?.useBuiltinForm),
          pluginSchema:    (activePlugin && !activePlugin.useBuiltinForm) ? activePlugin : undefined,
          // Traçabilité comptabilité (uniquement si la case est cochée)
          comptaTypeId: (enableCompta && clotureTypeId) ? clotureTypeId : undefined,
          comptaMois:   (enableCompta && clotureTypeId) ? date.slice(0, 7) : undefined,
        }),
      }
      if (isEditing && editSessionId) {
        await window.mtcApi.updateSession(editSessionId, payload)
        showToast('Séance mise à jour ✓')
      } else {
        await window.mtcApi.createSession(payload)
        showToast('Séance enregistrée ✓')
      }

      // ── Clôture séance : marquer RDV réalisé + comptabilité ───────
      if (markRdvDone) {
        // Priorité : RDV venant du Dashboard/Calendrier (currentApptId),
        // sinon RDV du patient à la même date, sinon le RDV du nextSession
        const rdvToClose =
          (currentApptId ? patientAppts.find(a => a.id === currentApptId) : null) ??
          patientAppts.find(a => a.date === date && !a.is_done) ??
          patientAppts.find(a => a.id === resolvedApptId)
        if (rdvToClose) {
          try { await window.mtcApi.updateAppointment(rdvToClose.id, { is_done: 1 }) }
          catch { /* silencieux */ }
        }
      }
      if (enableCompta && clotureTypeId && !isEditing) {
        try {
          const [y, m] = date.split('-').map(Number)
          await window.mtcApi.incrementMonthlyRevenue(y, m, clotureTypeId)
        } catch { /* silencieux */ }
      }
      // ────────────────────────────────────────────────────────────────

      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      draftRef.current = {}
      setDraftInfo(null)

      // Si un prochain RDV a été créé/lié, ouvrir le calendrier sur cette date
      if (resolvedApptId && nextSession) {
        navigate('/calendrier', { state: { focusDate: nextSession } })
      } else {
        navigate('/seances')
      }
    } catch (e) { showToast('Erreur lors de l\'enregistrement', 'error') }
  }

  const resetAllFields = useCallback(() => {
    setPatientId(''); setDate(new Date().toISOString().slice(0, 10)); setPractitioner('')
    setMotif(''); setEvolutionTags([]); setEvolution(''); setProblematiques(''); setAnamnese('')
    setSimpleContextVie(''); setSimpleTraitementsEnCours(''); setSimpleObjectifs(''); setSimpleNotesEntretien('')
    setLangue([]); setLangueNote(''); setPouls([]); setPoulsNote('')
    setPoulsPos({ droitAvant: '', droitMilieu: '', droitArriere: '', gaucheAvant: '', gaucheMilieu: '', gaucheArriere: '' })
    setConstitution(''); setTypeCorps(''); setTeint(''); setObservation('')
    setDiagnostic(''); setCinqElements(''); setCauses(''); setAnalyse(''); setPrincipes('')
    setPoints(''); setPtsOreille(''); setTechniques([]); setPlantes(''); setReactions(''); setTraitementNotes('')
    setConseils(''); setPlan(''); setSurveiller('')
    setNextSession(''); setNextSessionHeure('09:00'); setNextSessionFin(''); setNextSessionNote(''); setNextSessionApptId('')
    setPluginData({})
    setBarrageNiv1(''); setBarrageNiv2(''); setBarrageNiv3(''); setBarrageNiv4('')
    setSystemes(defaultSystemes()); setEnergy(defaultEnergyTests())
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    draftRef.current = {}
    setDraftInfo(null)
  }, [])

  const handleClear = async () => {
    if (!await showConfirm({ message: 'Vider tous les champs du formulaire ?', title: 'Réinitialiser', confirmLabel: 'Vider' })) return
    resetAllFields()
    showToast('Formulaire vidé')
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      setPatientId(d.patientId || '')
      setDate(d.date || new Date().toISOString().slice(0, 10))
      setPractitioner(d.practitioner || '')
      setMotif(d.motif || '')
      setEvolutionTags(d.evolutionTags || [])
      setEvolution(d.evolution || '')
      setLangue(d.langue || [])
      setLangueNote(d.langueNote || '')
      setPouls(d.pouls || [])
      setPoulsNote(d.poulsNote || '')
      if (d.poulsPos) setPoulsPos(prev => ({ ...prev, ...d.poulsPos }))
      setConstitution(d.constitution || '')
      setTypeCorps(d.typeCorps || '')
      setTeint(d.teint || '')
      setObservation(d.observation || '')
      setDiagnostic(d.diagnostic || '')
      setCinqElements(d.cinqElements || '')
      setCauses(d.causes || '')
      setAnalyse(d.analyse || '')
      setPrincipes(d.principes || '')
      setPoints(d.points || '')
      setPtsOreille(d.ptsOreille || '')
      setTechniques(d.techniques || [])
      setPlantes(d.plantes || '')
      setReactions(d.reactions || '')
      setTraitementNotes(d.traitementNotes || '')
      setConseils(d.conseils || '')
      setPlan(d.plan || '')
      setSurveiller(d.surveiller || '')
      setNextSession(d.nextSession || '')
      setNextSessionHeure(d.nextSessionHeure   || '09:00')
      setNextSessionFin(d.nextSessionFin       || '')
      setNextSessionNote(d.nextSessionNote     || '')
      setNextSessionApptId(d.nextSessionApptId || '')
      setPluginData(d.pluginData || {})
      setAnamnese(d.anamnese || '')
      setSimpleContextVie(d.simpleContextVie || '')
      setSimpleTraitementsEnCours(d.simpleTraitementsEnCours || '')
      setSimpleObjectifs(d.simpleObjectifs || '')
      setSimpleNotesEntretien(d.simpleNotesEntretien || '')
      setBarrageNiv1(d.barrageNiv1 || '')
      setBarrageNiv2(d.barrageNiv2 || '')
      setBarrageNiv3(d.barrageNiv3 || '')
      setBarrageNiv4(d.barrageNiv4 || '')
      if (d.systemes) setSystemes(migrateSystemes(d.systemes))
      if (d.energy) setEnergy({ ...defaultEnergyTests(), ...d.energy })
      setDraftInfo(null)
      showToast('Brouillon restauré ✓')
    } catch { showToast('Impossible de restaurer le brouillon', 'error') }
  }

  return (
    <div className="session-layout">
      {/* ─── TABLE DES MATIÈRES ─────────────────────────────── */}
      <aside className="session-toc">
        <div className="session-toc-title">Sommaire séance</div>
        {(
          // ── Plugin spécialisé (ostéo, kinesio, naturo, douleur…)
          activePlugin && !activePlugin.useBuiltinForm && activePlugin.id !== 'basique'
            ? (() => {
                const pre   = activePlugin.sections.filter(s => s.placement === 'pre-motif')
                const mots  = activePlugin.sections.filter(s => s.placement === 'motif')
                const notes = activePlugin.sections.filter(s => !s.placement || s.placement === 'notes')
                const trait = activePlugin.sections.filter(s => s.placement === 'traitement')
                const showR = trait.length === 0 || !!activePlugin.showGlobalReactions
                const items: [string, string][] = [
                  ['sec-identification', '0. Identification'],
                  ['sec-info-patient',   'ℹ️ Info patient'],
                ]
                let n = 1
                pre.forEach(s => items.push([`sec-pre-${s.id}`, `${n++}. ${s.title}`]))
                items.push(['sec-motif', mots.length > 0 ? `${n++}. ${mots[0].title}` : `${n++}. Motif`])
                items.push(['sec-evolution', `${n++}. Évolution`])
                if (notes.length > 0) {
                  notes.forEach((s, idx) => {
                    const id = idx === 0 ? 'sec-anamnese' : `sec-notes-${s.id}`
                    items.push([id, `${n++}. ${s.title}`])
                  })
                } else {
                  items.push(['sec-anamnese', `${n++}. Notes de séance`])
                }
                if (trait.length > 0) {
                  items.push(['sec-traitement', `${n++}. ${trait[0].title}`])
                } else {
                  items.push(['sec-traitement', `${n++}. Traitement effectué`])
                }
                if (showR) items.push(['sec-reactions', `${n++}. Résultats & Réactions`])
                items.push(['sec-suivi',      `${n++}. Plan de suivi`])
                return items
              })()
          // ── MTC builtin
          : activePlugin?.useBuiltinForm
            ? [
                ['sec-identification',   '0. Identification'],
                ['sec-info-patient',     'ℹ️ Info patient'],
                ['sec-motif',            '1. Motif'],
                ['sec-evolution',        '2. Évolution'],
                ['sec-anamnese',         '3. Notes de séance'],
                ['sec-observation-mtc',  '4. Observation MTC'],
                ['sec-diagnostic-mtc',   '5. Analyse & Diagnostic'],
                ['sec-traitement',       '6. Traitement effectué'],
                ['sec-suivi',            '7. Plan de suivi'],
              ]
          // ── Basique ou Sans plugin
            : [
                ['sec-identification', '0. Identification'],
                ['sec-info-patient',   'ℹ️ Info patient'],
                ['sec-motif',          '1. Motif'],
                ['sec-evolution',      '2. Évolution'],
                ['sec-anamnese',       '3. Notes de séance'],
                ['sec-traitement',     '4. Traitement effectué'],
                ['sec-reactions',      '5. Résultats & Réactions'],
                ['sec-suivi',          '6. Plan de suivi'],
              ]
        ).map(([id, label]) => (
          <a key={id} href="#" onClick={e => { e.preventDefault(); scrollTo(id) }}>{label}</a>
        ))}
        <hr />
        <div style={{ padding: '6px 8px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Progression</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: progress + '%' }} /></div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4, textAlign: 'right' }}>{progress}%</div>
        </div>
        <div style={{ padding: '8px 4px 2px' }}>
          <button className="session-toc-save-btn" onClick={handleSave}
            disabled={!canSave} title={!canSave ? R_TIP : undefined}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {isEditing ? 'Mettre à jour la séance' : 'Enregistrer la séance'}
          </button>
        </div>
      </aside>

      {/* ─── CONTENU PRINCIPAL ──────────────────────────────── */}
      <section className="session-main">
        {/* BANDEAU BROUILLON */}
        {draftInfo && !isEditing && (
          <div className="draft-banner">
            {draftInfo.autoRestored ? (
              <>
                <span>✅ Brouillon restauré automatiquement — séance du {draftInfo.date || '?'}</span>
                <button className="btn btn-secondary btn-sm" onClick={resetAllFields}>Ignorer</button>
              </>
            ) : (
              <>
                <span>💾 Brouillon trouvé — séance du {draftInfo.date || '?'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={restoreDraft}>Restaurer</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    try { localStorage.removeItem(DRAFT_KEY) } catch {}
                    setDraftInfo(null)
                  }}>Ignorer</button>
                </div>
              </>
            )}
          </div>
        )}
        {/* TOP ACTIONS */}
        <div className="top-actions">
          <div className="top-actions-left">
            {isEditing && (
              <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600, padding: '4px 10px', background: 'var(--amber-light)', borderRadius: 20 }}>
                ✏️ Mode modification
              </span>
            )}
            <button className="btn btn-primary" onClick={handleSave}
              disabled={!canSave} title={!canSave ? R_TIP : undefined}>
              {isEditing ? '💾 Mettre à jour la séance' : '💾 Enregistrer la séance'}
            </button>
            {!isEditing && <button className="btn btn-secondary" onClick={handleClear}>↺ Vider le formulaire</button>}
            {isEditing && <button className="btn btn-secondary" onClick={() => navigate('/seances')}>✕ Annuler</button>}

          </div>
        </div>

        {/* 0. IDENTIFICATION */}
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }} id="sec-identification">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span><span className="card-title-icon icon-green">👤</span>Identification</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(() => {
                // Le propriétaire voit tous les formulaires ; les autres : Basique + plugin acheté actif.
                const basiqueDef = availablePlugins.find(p => p.id === 'basique')
                const formsForSwitcher: PluginDefinition[] = isOwner
                  ? availablePlugins
                  : [
                      ...(basiqueDef ? [basiqueDef] : []),
                      ...(activePlugin && activePlugin.id !== 'basique' ? [activePlugin] : []),
                    ]
                return !isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, opacity: 0.65, whiteSpace: 'nowrap', margin: 0 }}>Formulaire :</label>
                    <select
                      value={activePlugin?.id || ''}
                      onChange={async e => {
                        const id = e.target.value
                        const hasData = Object.values(pluginData).some(v => v !== null && v !== undefined && v !== '')
                        if (hasData && !await showConfirm({ message: 'Changer de formulaire effacera les données saisies. Continuer ?', title: 'Changer de formulaire', confirmLabel: 'Continuer' })) return
                        setPluginData({})
                        setActivePlugin(formsForSwitcher.find(p => p.id === id) ?? null)
                      }}
                      style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6 }}
                    >
                      {formsForSwitcher.map(p => (
                        <option key={p.id} value={p.id}>{p.icon ? p.icon + ' ' : ''}{p.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span
                    className="plugin-session-badge"
                    style={{ '--plugin-accent': (activePlugin?.accentColor || 'var(--accent)') } as React.CSSProperties}
                    title={`Formulaire de la séance : ${activePlugin?.name || 'Basique'}${activePlugin?.version ? ' v' + activePlugin.version : ''}`}
                  >
                    {activePlugin?.icon && <span>{activePlugin.icon}</span>}
                    <span>{activePlugin?.specialty || activePlugin?.name || 'Basique'}</span>
                  </span>
                )
              })()}
              {patientId && (
                <span className="session-num-badge">
                  {sessionNum === 1 ? '1ère séance' : `${sessionNum}ème séance`}
                </span>
              )}
            </div>
          </div>
          <div className="grid3">
            <div className="field">
              <label>Patient *</label>
              <select value={patientId} onChange={e => setPatientId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {patients.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Date *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="field"><label>Praticien</label><input type="text" value={practitioner} onChange={e => setPractitioner(e.target.value)} placeholder="Votre nom" /></div>
          </div>
        </div>


        {/* ── SÉANCE PRÉCÉDENTE (accordéon de référence) ──────────── */}
        {prevSession && (
          <PrevSessionAccordion
            session={prevSession}
            open={prevSessionOpen}
            onToggle={() => setPrevSessionOpen(o => !o)}
          />
        )}

        {/* ── GROUPES DE SECTIONS PAR PLACEMENT (plugins spécialisés) ─────────── */}
        {(() => {
          const isSpecialty = activePlugin && activePlugin.id !== 'basique' && !activePlugin.useBuiltinForm
          const preMotiSections    = isSpecialty ? activePlugin!.sections.filter(s => s.placement === 'pre-motif') : []
          const motifSections      = isSpecialty ? activePlugin!.sections.filter(s => s.placement === 'motif') : []
          const notesSections      = isSpecialty ? activePlugin!.sections.filter(s => !s.placement || s.placement === 'notes') : []
          const traitSections      = isSpecialty ? activePlugin!.sections.filter(s => s.placement === 'traitement') : []
          const traitInnerSections = isSpecialty ? activePlugin!.sections.filter(s => s.placement === 'traitement-inner') : []
          const planSections       = isSpecialty ? activePlugin!.sections.filter(s => s.placement === 'plan') : []
          const pluginOnChange     = (id: string, val: unknown) => setPluginData(prev => ({ ...prev, [id]: val }))

          const showCoreMotif = !isSpecialty
            ? true  // simple, basique, MTC : afficher le motif dans tous les cas
            : motifSections.length === 0 && !activePlugin!.hideGlobalMotif

          // Numérotation des blocs — suit exactement l'ordre du sommaire TOC
          let _n = 1
          const preMotifNums   = preMotiSections.map(() => _n++)
          const motifN         = _n++
          const evolutionN     = _n++
          const notesNums      = isSpecialty && notesSections.length > 0
            ? notesSections.map(() => _n++)
            : [_n++]
          const notesN         = notesNums[0]
          const observationN   = activePlugin?.useBuiltinForm ? _n++ : null
          const diagnosticN    = activePlugin?.useBuiltinForm ? _n++ : null
          const traitN         = _n++
          // Pour MTC builtin : réactions intégrées dans le bloc traitement → pas de bloc séparé
          const showReactions  = activePlugin?.useBuiltinForm
            ? false
            : (!isSpecialty || traitSections.length === 0 || !!activePlugin?.showGlobalReactions)
          const reactionsN     = showReactions ? _n++ : null
          const planN          = _n++

          return (
            <>
              {/* PRE-MOTIF : ex. antécédents traumatiques ostéo */}
              {preMotiSections.map((section, idx) => (
                <div key={section.id} id={`sec-pre-${section.id}`}>
                  <PluginFormRenderer
                    plugin={activePlugin!}
                    sections={[section]}
                    data={pluginData}
                    onChange={pluginOnChange}
                    asCard
                    sectionNumber={preMotifNums[idx]}
                  />
                </div>
              ))}

              {/* MOTIF */}
              {isSpecialty && motifSections.length > 0 ? (
                <div id="sec-motif">
                  <PluginFormRenderer
                    plugin={activePlugin!}
                    sections={motifSections}
                    data={pluginData}
                    onChange={pluginOnChange}
                    asCard
                    sectionNumber={motifN}
                  />
                </div>
              ) : showCoreMotif && (
                <div className="card" id="sec-motif" style={{ borderLeft: '4px solid var(--amber)' }}>
                  <div className="card-title"><span className="card-title-icon icon-amber">🎯</span>{motifN}. Motif de consultation</div>
                  <RichTextArea value={motif} onChange={setMotif} placeholder="Demande du patient, attentes, priorité du jour…" minHeight={80} />
                </div>
              )}

              {/* ÉVOLUTION */}
              <div className="card" id="sec-evolution" style={{ borderLeft: '4px solid var(--teal)' }}>
                <div className="card-title"><span className="card-title-icon icon-teal">📈</span>{evolutionN}. Évolution depuis la dernière séance</div>
                <label>Évolution globale</label>
                <div className="tag-group">
                  {['✅ Amélioration nette','↗ Légère amélioration','→ Stable','↕ Fluctuant','↘ Aggravation','🌱 1ère consultation'].map(v => (
                    <TagBtn key={v} label={v} active={evolutionTags.includes(v)} onClick={() => setEvolutionTags(toggleArr(evolutionTags, v))} />
                  ))}
                </div>
                <div className="field" style={{ marginTop: 10 }}>
                  <RichTextArea value={evolution} onChange={setEvolution} placeholder="Détail de l'évolution, retours du patient…" minHeight={80} />
                </div>
              </div>

              {/* NOTES DE SÉANCE */}
              {isSpecialty && notesSections.length > 0 ? (
                notesSections.map((section, idx) => (
                  <div key={section.id} id={idx === 0 ? 'sec-anamnese' : `sec-notes-${section.id}`}>
                    <PluginFormRenderer
                      plugin={activePlugin!}
                      sections={[section]}
                      data={pluginData}
                      onChange={pluginOnChange}
                      asCard
                      sectionNumber={notesNums[idx]}
                    />
                  </div>
                ))
              ) : (
                <div className="card" id="sec-anamnese" style={{ borderLeft: '4px solid var(--amber)' }}>
                  <div className="card-title"><span className="card-title-icon icon-amber">📝</span>{notesN}. Notes de séance</div>
                  {activePlugin?.useBuiltinForm ? (
                    /* MTC JP : notes libres + pense-bête côte à côte */
                    <div className="anamnese-layout">
                      <div className="anamnese-notes">
                        <RichTextArea
                          value={anamnese}
                          onChange={setAnamnese}
                          placeholder="Réponses du patient aux questions de l'interrogatoire…"
                          minHeight={300}
                        />
                      </div>
                      <div className="anamnese-pensebete">
                        <div className="pensebete-title">📌 Questions à poser</div>
                        {[
                          { icon: '🌡', label: 'Froid / Chaleur',   hint: 'Sensation générale, préférence thermique, membres froids' },
                          { icon: '🚽', label: 'Selles / Urine',    hint: 'Fréquence, consistance, couleur, brûlures' },
                          { icon: '💧', label: 'Soif / Boisson',    hint: 'Quantité, préférence chaud/froid, bouche sèche' },
                          { icon: '😴', label: 'Sommeil',            hint: 'Durée, endormissement, réveils, rêves' },
                          { icon: '🗡', label: 'Tête',               hint: 'Maux de tête, vertiges, acouphènes, vision' },
                          { icon: '💦', label: 'Transpiration',      hint: 'Diurne, nocturne, localisée, spontanée' },
                          { icon: '🦴', label: 'Membres',            hint: 'Douleurs, engourdissements, lourdeurs, tremblements' },
                          { icon: '🫙', label: 'Digestif',           hint: 'Appétit, ballonnements, nausées, reflux' },
                        ].map(({ icon, label, hint }) => (
                          <div key={label} className="pensebete-item">
                            <div className="pensebete-item-header">
                              <span className="pensebete-icon">{icon}</span>
                              <span className="pensebete-label">{label}</span>
                            </div>
                            <div className="pensebete-hint">{hint}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Basique / mode sans plugin : grande zone de notes libres */
                    <RichTextArea
                      value={anamnese}
                      onChange={setAnamnese}
                      placeholder="Notes de séance — interrogatoire, observations, hypothèses, ressentis…"
                      minHeight={300}
                    />
                  )}
                </div>
              )}

              {/* OBSERVATION MTC — uniquement pour le formulaire MTC intégré */}
              {activePlugin?.useBuiltinForm && (
                <div className="card" id="sec-observation-mtc" style={{ borderLeft: '4px solid var(--teal)' }}>
                  <div className="card-title">
                    <span className="card-title-icon icon-teal">👁</span>
                    {observationN}. Observation MTC
                  </div>

                  {/* Langue */}
                  <div className="field">
                    <label>Langue</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                      {['Pâle','Rouge','Violacée','Enduit blanc','Enduit jaune','Sans enduit','Fissures','Gonflée','Tremblante'].map(opt => (
                        <TagBtn key={opt} label={opt} active={langue.includes(opt)}
                          onClick={() => setLangue(toggleArr(langue, opt))} />
                      ))}
                    </div>
                    <textarea
                      value={langueNote}
                      onChange={e => setLangueNote(e.target.value)}
                      placeholder="Notes complémentaires sur la langue…"
                      rows={2}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  {/* Pouls qualités globales */}
                  <div className="field">
                    <label>Pouls — qualités globales</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                      {['Superficiel','Profond','Lent','Rapide','Fort','Faible','Glissant','Tendu','En corde','Irrégulier','Sans racine'].map(opt => (
                        <TagBtn key={opt} label={opt} active={pouls.includes(opt)}
                          onClick={() => setPouls(toggleArr(pouls, opt))} />
                      ))}
                    </div>

                    {/* Table positions Cun / Guan / Chi */}
                    {(() => {
                      const cols = [
                        { label: 'Cun (avant)',   hBg: 'var(--amber)', hText: '#fff', cellBg: 'var(--amber-light)', border: '#C17B2A'          },
                        { label: 'Guan (milieu)', hBg: 'var(--teal)',  hText: '#fff', cellBg: 'var(--teal-light)',  border: 'var(--teal-mid)'   },
                        { label: 'Chi (arrière)', hBg: 'var(--blue)',  hText: '#fff', cellBg: 'var(--blue-light)',  border: 'var(--blue-mid)'   },
                      ]
                      const rows = [
                        { side: 'Droite', fields: ['droitAvant','droitMilieu','droitArriere'] as const,   placeholders: ['P / Gros int.','Rate / Estomac','Mingmen / RMC'] },
                        { side: 'Gauche', fields: ['gaucheAvant','gaucheMilieu','gaucheArriere'] as const, placeholders: ['C / IG','Foie / VB','Reins / V'] },
                      ]
                      return (
                        <div style={{ overflowX: 'auto', marginBottom: 8, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '7px 10px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', width: '13%' }} />
                                {cols.map(c => (
                                  <th key={c.label} style={{ padding: '8px 10px', textAlign: 'center', borderBottom: `2px solid ${c.border}`, background: c.hBg, color: c.hText, fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                                    {c.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ side, fields, placeholders }, ri) => (
                                <tr key={side} style={{ background: ri % 2 === 1 ? 'var(--bg)' : 'transparent' }}>
                                  <td style={{ padding: '6px 10px', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)' }}>{side}</td>
                                  {fields.map((f, i) => (
                                    <td key={f} style={{ padding: '5px 7px', borderRight: i < 2 ? `1px solid ${cols[i].border}` : undefined, background: cols[i].cellBg }}>
                                      <input
                                        type="text"
                                        value={poulsPos[f]}
                                        onChange={e => setPoulsPos(prev => ({ ...prev, [f]: e.target.value }))}
                                        placeholder={placeholders[i]}
                                        style={{ width: '100%', fontSize: 12, background: 'var(--surface)', border: `1px solid ${cols[i].border}`, borderRadius: 5, padding: '3px 7px' }}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}

                    <textarea
                      value={poulsNote}
                      onChange={e => setPoulsNote(e.target.value)}
                      placeholder="Notes complémentaires sur le pouls…"
                      rows={2}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  {/* Constitution / Type de corps / Teint */}
                  <div className="grid3">
                    <div className="field">
                      <label>Constitution</label>
                      <select value={constitution} onChange={e => setConstitution(e.target.value)}>
                        <option value="">—</option>
                        {['Bois 🌿','Feu 🔥','Terre 🌍','Métal ⚙️','Eau 💧'].map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Type de corps</label>
                      <input type="text" value={typeCorps} onChange={e => setTypeCorps(e.target.value)} placeholder="Ex : longiligne, massif…" />
                    </div>
                    <div className="field">
                      <label>Teint</label>
                      <input type="text" value={teint} onChange={e => setTeint(e.target.value)} placeholder="Ex : pâle, jaunâtre, rouge…" />
                    </div>
                  </div>

                  {/* Notes d'observation générales */}
                  <div className="field">
                    <label>Notes d'observation générales</label>
                    <RichTextArea
                      value={observation}
                      onChange={setObservation}
                      placeholder="Cartographie du visage, cheveux, ongles, palpation, humidité…"
                      minHeight={100}
                    />
                  </div>
                </div>
              )}

              {/* ANALYSE & DIAGNOSTIC MTC */}
              {activePlugin?.useBuiltinForm && (
                <div className="card" id="sec-diagnostic-mtc" style={{ borderLeft: '4px solid var(--purple)' }}>
                  <div className="card-title">
                    <span className="card-title-icon icon-purple">🔵</span>
                    {diagnosticN}. Analyse &amp; Diagnostic
                  </div>

                  <div className="field">
                    <label>Diagnostic MTC principal</label>
                    <textarea
                      value={diagnostic}
                      onChange={e => setDiagnostic(e.target.value)}
                      placeholder="Ex : Vide de Yin du Rein, Stagnation du Qi du Foie…"
                      rows={2}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div className="grid2">
                    <div className="field">
                      <label>5 Éléments</label>
                      <input
                        type="text"
                        value={cinqElements}
                        onChange={e => setCinqElements(e.target.value)}
                        placeholder="Ex : Bois++, Eau–…"
                      />
                    </div>
                    <div className="field">
                      <label>Causes</label>
                      <input
                        type="text"
                        value={causes}
                        onChange={e => setCauses(e.target.value)}
                        placeholder="Ex : émotions, alimentation, fatigue…"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Mécanisme / Terrain</label>
                    <RichTextArea
                      value={analyse}
                      onChange={setAnalyse}
                      placeholder="Analyse du mécanisme pathologique, terrain du patient…"
                      minHeight={90}
                    />
                  </div>

                  <div className="field">
                    <label>Principes de traitement</label>
                    <textarea
                      value={principes}
                      onChange={e => setPrincipes(e.target.value)}
                      placeholder="Ex : Tonifier le Yin du Rein, disperser la chaleur du Foie…"
                      rows={2}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* TRAITEMENT — plugin standalone OU bloc core (avec sections inner) */}
              {isSpecialty && traitSections.length > 0 ? (
                /* Plugin couvre entièrement le traitement (ostéo, kinesio) */
                <div id="sec-traitement">
                  <PluginFormRenderer
                    plugin={activePlugin!}
                    sections={traitSections}
                    data={pluginData}
                    onChange={pluginOnChange}
                    asCard
                    sectionNumber={traitN}
                  />
                </div>
              ) : (
                /* Bloc core traitement */
                <div className="card" id="sec-traitement" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <div className="card-title"><span className="card-title-icon icon-green">🌿</span>{traitN}. Traitement effectué</div>

                  {activePlugin?.useBuiltinForm ? (
                    /* ── Version MTC intégrée ── */
                    <>
                      <div className="field">
                        <label>Points d'acupuncture</label>
                        <textarea
                          value={points}
                          onChange={e => setPoints(e.target.value)}
                          placeholder="Ex : P7, MC6, E36, Rte6, V23…"
                          rows={2}
                          style={{ width: '100%', resize: 'vertical', minHeight: 44 }}
                        />
                      </div>
                      <div className="field">
                        <label>Points d'oreille</label>
                        <textarea
                          value={ptsOreille}
                          onChange={e => setPtsOreille(e.target.value)}
                          placeholder="Ex : Shen Men, Rein, Foie…"
                          rows={2}
                          style={{ width: '100%', resize: 'vertical', minHeight: 44 }}
                        />
                      </div>
                      <div className="field">
                        <label>Techniques utilisées</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {['Acupuncture','Moxibustion','Ventouses','Tuina','Gua sha','Auriculothérapie','Diététique','Plantes'].map(opt => (
                            <TagBtn key={opt} label={opt} active={techniques.includes(opt)}
                              onClick={() => setTechniques(toggleArr(techniques, opt))} />
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Formule à base de plantes / dosage</label>
                        <textarea
                          value={plantes}
                          onChange={e => setPlantes(e.target.value)}
                          placeholder="Nom de la formule, ingrédients, dosage, fréquence de prise, durée du traitement…"
                          rows={3}
                          style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                        />
                      </div>
                      <div className="field">
                        <label>Réactions / observations pendant le soin</label>
                        <textarea
                          value={reactions}
                          onChange={e => setReactions(e.target.value)}
                          placeholder="Réactions du patient, sensations, observations…"
                          rows={3}
                          style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                        />
                      </div>
                      <div className="field">
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📝</span> Notes libres – Traitement
                        </div>
                        <textarea
                          value={traitementNotes}
                          onChange={e => setTraitementNotes(e.target.value)}
                          placeholder="Notes libres sur le traitement…"
                          rows={3}
                          style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                        />
                      </div>
                    </>
                  ) : (
                    /* ── Version générique (basique / simple) ── */
                    <>
                      <div className="field">
                        <RichTextArea
                          value={traitementNotes}
                          onChange={setTraitementNotes}
                          placeholder="Techniques appliquées, zones traitées, protocole suivi, dosages, formules…"
                          minHeight={140}
                        />
                      </div>
                      <div className="field">
                        <label>Techniques utilisées</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          {techniques.map(t => (
                            <span key={t} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', background: 'var(--accent-light)',
                              border: '1.5px solid var(--accent-mid)', borderRadius: 12,
                              fontSize: 12, color: 'var(--accent)', fontWeight: 500,
                            }}>
                              {t}
                              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: 0, lineHeight: 1 }}
                                onClick={() => setTechniques(techniques.filter(x => x !== t))}>×</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={techInput}
                            onChange={e => setTechInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTech() } }}
                            placeholder="Ex : acupuncture, massage, mobilisation… (Entrée pour ajouter)"
                            style={{ flex: 1 }}
                          />
                          <button type="button" className="btn btn-secondary btn-sm" onClick={addTech}>+</button>
                        </div>
                      </div>
                      {/* Sections traitement-inner (naturo : protocole, douleur : séance) */}
                      {traitInnerSections.length > 0 && (
                        <PluginFormRenderer
                          plugin={activePlugin!}
                          sections={traitInnerSections}
                          data={pluginData}
                          onChange={pluginOnChange}
                          inline
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* RÉSULTATS & RÉACTIONS */}
              {showReactions && (
                <div className="card" id="sec-reactions" style={{ borderLeft: '4px solid var(--teal-mid)' }}>
                  <div className="card-title"><span className="card-title-icon icon-teal">💬</span>{reactionsN}. Résultats &amp; Réactions</div>
                  <RichTextArea
                    value={reactions}
                    onChange={setReactions}
                    placeholder="Ressenti du patient, évolution pendant la séance, résultats observés, effets immédiats…"
                    minHeight={120}
                  />
                </div>
              )}

              {/* PLAN DE SUIVI */}
              <div className="card" id="sec-suivi" style={{ borderLeft: '4px solid var(--teal-mid)' }}>
                <div className="card-title"><span className="card-title-icon icon-teal">📅</span>{planN}. Plan de suivi</div>
                {/* Sections plan (kinesio : suivi_anamnese, douleur : plan_suivi) */}
                {planSections.length > 0 && (
                  <PluginFormRenderer
                    plugin={activePlugin!}
                    sections={planSections}
                    data={pluginData}
                    onChange={pluginOnChange}
                    inline
                  />
                )}
                <div className="field"><label>Conseils donnés</label><RichTextArea value={conseils} onChange={setConseils} placeholder="Conseils hygiéno-diététiques, exercices, recommandations…" minHeight={80} /></div>
                <div className="field"><label>Plan à long terme / recommandations</label><RichTextArea value={plan} onChange={setPlan} placeholder="Fréquence des séances, objectif thérapeutique…" minHeight={80} /></div>
                <div className="field"><label>À surveiller</label><input type="text" value={surveiller} onChange={e => setSurveiller(e.target.value)} placeholder="Signes d'alerte, évolution à observer…" /></div>
                {/* ─── PROCHAIN RDV synchronisé avec le calendrier ─── */}
                <NextRdvSection
                  patientId={patientId}
                  nextSession={nextSession}        setNextSession={setNextSession}
                  nextSessionHeure={nextSessionHeure}  setNextSessionHeure={setNextSessionHeure}
                  nextSessionFin={nextSessionFin}      setNextSessionFin={setNextSessionFin}
                  nextSessionNote={nextSessionNote}    setNextSessionNote={setNextSessionNote}
                  nextSessionApptId={nextSessionApptId} setNextSessionApptId={setNextSessionApptId}
                  patientAppts={patientAppts}
                  onApptDeleted={id => setPatientAppts(prev => prev.filter(a => a.id !== id))}
                />

                {/* ── Clôture séance : RDV réalisé + Comptabilité ─── */}
                {patientId && (
                  <div style={{ marginTop: 14, background: 'var(--purple-light)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--purple-mid)' }}>

                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✅</span> Clôture de séance
                    </div>

                    {/* RDV réalisé */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', marginBottom: clotureTypes.length > 0 ? 12 : 0 }}>
                      <input
                        type="checkbox"
                        checked={markRdvDone}
                        onChange={e => setMarkRdvDone(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: 'var(--purple)', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span>
                        <strong>Marquer le RDV comme réalisé</strong>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          Met à jour le calendrier et le tableau de bord
                        </span>
                      </span>
                    </label>

                    {/* Comptabilité — case à cocher simple */}
                    {clotureTypes.length > 0 && (
                      <div>
                        <div style={{ height: 1, background: 'var(--purple-mid)', opacity: .3, marginBottom: 12 }} />

                        {/* Case principale */}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={enableCompta}
                            onChange={e => {
                              const checked = e.target.checked
                              setEnableCompta(checked)
                              if (checked && clotureTypes.length === 1) {
                                setClotureTypeId(clotureTypes[0].id)
                              } else if (!checked) {
                                setClotureTypeId('')
                              }
                            }}
                            style={{ width: 16, height: 16, accentColor: 'var(--purple)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                          />
                          <span>
                            <strong>Enregistrer cette séance en comptabilité</strong>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                              Ajoute +1 au tableau mensuel de revenus
                            </span>
                          </span>
                        </label>

                        {/* Select type uniquement si plusieurs types et case cochée */}
                        {enableCompta && clotureTypes.length > 1 && (
                          <div className="field" style={{ margin: '10px 0 0 26px' }}>
                            <select
                              value={clotureTypeId}
                              onChange={e => setClotureTypeId(e.target.value)}
                              style={{ fontSize: 13, borderColor: 'var(--purple-mid)', background: '#fff' }}
                            >
                              <option value="">— Choisir le type —</option>
                              {clotureTypes.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name}{t.price > 0 ? ` — ${t.price.toFixed(2)} €` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {enableCompta && clotureTypeId && (() => {
                          const type = clotureTypes.find(t => t.id === clotureTypeId)
                          const [y, m] = date.split('-')
                          const alreadyNb = currentMonthNb ?? null
                          const afterNb   = alreadyNb !== null ? alreadyNb + 1 : null
                          return (
                            <div style={{ marginTop: 10, marginLeft: 26 }}>
                              {/* Résumé du mois actuel */}
                              {alreadyNb !== null && (
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '7px 10px',
                                  borderRadius: 7,
                                  background: alreadyNb > 0 ? 'rgba(245,158,11,.1)' : 'rgba(74,103,65,.07)',
                                  border: `1px solid ${alreadyNb > 0 ? 'rgba(245,158,11,.35)' : 'rgba(74,103,65,.2)'}`,
                                  fontSize: 12,
                                }}>
                                  <span style={{ fontSize: 15 }}>{alreadyNb > 0 ? '⚠️' : '✅'}</span>
                                  <div>
                                    <div style={{ fontWeight: 700, color: alreadyNb > 0 ? 'var(--amber)' : 'var(--accent)' }}>
                                      {alreadyNb > 0
                                        ? `Déjà ${alreadyNb} séance${alreadyNb > 1 ? 's' : ''} enregistrée${alreadyNb > 1 ? 's' : ''} ce mois`
                                        : 'Aucune séance enregistrée ce mois'
                                      }
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>
                                      "{type?.name}" · {m}/{y}
                                      {afterNb !== null && !isEditing && (
                                        <span style={{ marginLeft: 6, color: 'var(--purple)', fontWeight: 600 }}>
                                          → passera à {afterNb} après enregistrement
                                        </span>
                                      )}
                                      {isEditing && (
                                        <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                          — pas de modification en mode édition
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* Résumé de ce qui sera ajouté — masqué en mode édition (pas d'incrémentation) */}
                              {!isEditing && (
                                <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span>+1</span>
                                  <strong>"{type?.name}"</strong>
                                  {type?.price ? <span>({type.price.toFixed(2)} €)</span> : null}
                                  <span>· sera ajouté à la comptabilité {m}/{y}</span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* BOUTONS BAS */}
        <div className="row-btns" style={{ marginBottom: '3rem' }}>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={!canSave} title={!canSave ? R_TIP : undefined}>
            {isEditing ? '💾 Mettre à jour la séance' : '💾 Enregistrer la séance'}
          </button>
          {!isEditing && <button className="btn btn-secondary" onClick={handleClear}>↺ Vider le formulaire</button>}
          {isEditing && <button className="btn btn-secondary" onClick={() => navigate('/seances')}>✕ Annuler</button>}

        </div>
      </section>

    </div>
  )
}

/* ─── FORMULAIRE SIMPLE (sans plugin) ───────────────────────── */

interface SimpleProps {
  anamnese: string;                   setAnamnese: (v: string) => void
  observation: string;                setObservation: (v: string) => void
  traitementNotes: string;            setTraitementNotes: (v: string) => void
  reactions: string;                  setReactions: (v: string) => void
  techniques: string[];               setTechniques: (v: string[]) => void
  simpleContextVie: string;           setSimpleContextVie: (v: string) => void
  simpleTraitementsEnCours: string;   setSimpleTraitementsEnCours: (v: string) => void
  simpleObjectifs: string;            setSimpleObjectifs: (v: string) => void
  simpleNotesEntretien: string;       setSimpleNotesEntretien: (v: string) => void
}

function SimpleAnamneseSection({
  anamnese, setAnamnese,
  observation, setObservation,
  traitementNotes, setTraitementNotes,
  reactions, setReactions,
  techniques, setTechniques,
  simpleContextVie, setSimpleContextVie,
  simpleTraitementsEnCours, setSimpleTraitementsEnCours,
  simpleObjectifs, setSimpleObjectifs,
  simpleNotesEntretien, setSimpleNotesEntretien,
}: SimpleProps) {

  const [techInput, setTechInput] = React.useState('')
  const addTech = () => {
    const t = techInput.trim()
    if (t && !techniques.includes(t)) setTechniques([...techniques, t])
    setTechInput('')
  }

  return (
    <>
      {/* 3. HISTOIRE & INTERROGATOIRE */}
      <div className="card" id="sec-histoire-simple" style={{ borderLeft: '4px solid var(--amber)' }}>
        <div className="card-title">
          <span className="card-title-icon icon-amber">🗣</span>3. Histoire &amp; Interrogatoire
        </div>

        {/* Histoire de la plainte */}
        <div className="field">
          <label style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 12 }}>
            Histoire de la plainte actuelle
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Depuis quand ? Déclencheur ? Localisation ? Aggravé/amélioré par quoi ?
          </div>
          <RichTextArea
            value={anamnese}
            onChange={setAnamnese}
            placeholder="Ex : Douleurs lombaires depuis 3 semaines suite à un faux mouvement. Aggravées par la position assise prolongée, soulagées par la chaleur…"
            minHeight={110}
          />
        </div>

        {/* Contexte & habitudes de vie */}
        <div className="field">
          <label style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 12 }}>
            Contexte &amp; habitudes de vie
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Stress, sommeil, alimentation, activité physique, situation professionnelle, vie personnelle…
          </div>
          <RichTextArea
            value={simpleContextVie}
            onChange={setSimpleContextVie}
            placeholder="Ex : Très stressé au travail, dort mal depuis un mois, sédentaire, télétravail 5j/7, relation difficile avec son manager…"
            minHeight={90}
          />
        </div>

        {/* Traitements en cours */}
        <div className="field">
          <label style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 12 }}>
            Traitements en cours &amp; autres thérapeutes
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Médicaments actuels, compléments alimentaires, autres soins reçus en parallèle…
          </div>
          <RichTextArea
            value={simpleTraitementsEnCours}
            onChange={setSimpleTraitementsEnCours}
            placeholder="Ex : Ibuprofène 400mg si besoin, suivi kiné 1×/sem, pas de médecin traitant consulté…"
            minHeight={70}
          />
        </div>
      </div>

      {/* 4. BILAN & OBSERVATIONS */}
      <div className="card" id="sec-examen-simple" style={{ borderLeft: '4px solid var(--teal)' }}>
        <div className="card-title">
          <span className="card-title-icon icon-teal">🔍</span>4. Bilan &amp; Observations
        </div>

        {/* Objectifs du patient */}
        <div className="field">
          <label style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 12 }}>
            Objectifs &amp; attentes du patient
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Ce qu'il veut atteindre, sa vision du succès, ses craintes…
          </div>
          <RichTextArea
            value={simpleObjectifs}
            onChange={setSimpleObjectifs}
            placeholder="Ex : Retrouver un dos sans douleur pour reprendre la randonnée, avoir un sommeil réparateur, réduire le stress avant les vacances…"
            minHeight={80}
          />
        </div>

        {/* Observations cliniques */}
        <div className="field">
          <label style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 12 }}>
            Observations cliniques &amp; bilan
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Examen, posture, comportement, palpation, tests, signes observés…
          </div>
          <RichTextArea
            value={observation}
            onChange={setObservation}
            placeholder="Ex : Posture en antéflexion, tension myofasciale L3-L5 côté droit, mobilité lombaire réduite en flexion, test de Lasègue négatif…"
            minHeight={100}
          />
        </div>
      </div>

      {/* 5. NOTES D'ENTRETIEN LIBRES */}
      <div className="card" id="sec-notes-simple" style={{ borderLeft: '4px solid var(--purple)' }}>
        <div className="card-title">
          <span className="card-title-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>✏️</span>
          5. Notes d'entretien libres
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Espace libre pour noter tout ce que vous souhaitez en rapport à vos questions,
          observations, ressentis, hypothèses…
        </div>
        <RichTextArea
          value={simpleNotesEntretien}
          onChange={setSimpleNotesEntretien}
          placeholder="Ex : Patient semble anxieux quand on aborde son travail. Tension dans les épaules droites très marquée. Lien possible avec la prise de poids récente ? À explorer la prochaine fois : son rapport à l'alimentation lors du stress…"
          minHeight={160}
        />
      </div>

      {/* 6. TRAITEMENT */}
      <div className="card" id="sec-traitement-simple" style={{ borderLeft: '4px solid var(--accent)' }}>
        <div className="card-title">
          <span className="card-title-icon icon-green">🌿</span>6. Traitement effectué
        </div>
        <div className="field">
          <label>Description du traitement</label>
          <RichTextArea
            value={traitementNotes}
            onChange={setTraitementNotes}
            placeholder="Techniques appliquées, zones traitées, protocole suivi…"
            minHeight={110}
          />
        </div>
        <div className="field">
          <label>Techniques utilisées</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {techniques.map(t => (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', background: 'var(--accent-light)',
                border: '1.5px solid var(--accent-mid)', borderRadius: 12,
                fontSize: 12, color: 'var(--accent)', fontWeight: 500,
              }}>
                {t}
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: 0, lineHeight: 1 }}
                  onClick={() => setTechniques(techniques.filter(x => x !== t))}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={techInput}
              onChange={e => setTechInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTech() } }}
              placeholder="Ex : massage, mobilisation, drainage… (Entrée pour ajouter)"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={addTech}>+</button>
          </div>
        </div>
      </div>

      {/* 7. RÉSULTATS */}
      <div className="card" id="sec-reactions-simple" style={{ borderLeft: '4px solid var(--teal-mid)' }}>
        <div className="card-title">
          <span className="card-title-icon icon-teal">💬</span>7. Résultats &amp; Réactions
        </div>
        <div className="field">
          <RichTextArea
            value={reactions}
            onChange={setReactions}
            placeholder="Ressenti du patient, évolution pendant la séance, résultats observés, effets immédiats…"
            minHeight={110}
          />
        </div>
      </div>
    </>
  )
}

/* ─── NEXT RDV SECTION ───────────────────────────────────────── */

const RDV_TIMES: string[] = []
for (let h = 7; h <= 20; h++) {
  for (let m = 0; m < 60; m += 5) {
    if (h === 20 && m > 0) break
    RDV_TIMES.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
}

interface NextRdvProps {
  patientId: string
  nextSession: string;        setNextSession: (v: string) => void
  nextSessionHeure: string;   setNextSessionHeure: (v: string) => void
  nextSessionFin: string;     setNextSessionFin: (v: string) => void
  nextSessionNote: string;    setNextSessionNote: (v: string) => void
  nextSessionApptId: string;  setNextSessionApptId: (v: string) => void
  patientAppts: Appointment[]
  onApptDeleted: (id: string) => void
}

function NextRdvSection({
  patientId, nextSession, setNextSession,
  nextSessionHeure, setNextSessionHeure,
  nextSessionFin, setNextSessionFin,
  nextSessionNote, setNextSessionNote,
  nextSessionApptId, setNextSessionApptId,
  patientAppts, onApptDeleted,
}: NextRdvProps) {

  const fmtApptDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return d }
  }

  // Sélectionner un RDV existant pour le lier
  const selectAppt = (appt: Appointment) => {
    setNextSession(appt.date)
    setNextSessionHeure(appt.heure_debut)
    setNextSessionFin(appt.heure_fin || '')
    setNextSessionNote(appt.note || '')
    setNextSessionApptId(appt.id)
  }

  // Supprimer un RDV depuis cette section
  const deleteAppt = async (id: string) => {
    if (!await showConfirm({ message: 'Supprimer ce rendez-vous du calendrier ?', title: 'Supprimer le RDV', confirmLabel: 'Supprimer', danger: true })) return
    try {
      await window.mtcApi.deleteAppointment(id)
      onApptDeleted(id)
      if (nextSessionApptId === id) {
        setNextSessionApptId('')
      }
    } catch { /* silencieux */ }
  }

  const isLinked = !!nextSessionApptId

  return (
    <div style={{ marginTop: 8, background: 'var(--teal-light)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid rgba(42,122,106,.2)' }}>
      <label style={{ color: 'var(--teal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        📅 Prochain rendez-vous
        {isLinked && (
          <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--teal)', color: 'white', borderRadius: 10, padding: '2px 8px' }}>
            Synchronisé avec le calendrier
          </span>
        )}
      </label>

      {/* Champs date + heure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', gap: 8, marginBottom: 8 }}>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Date</label>
          <input type="date" value={nextSession} onChange={e => { setNextSession(e.target.value); if (nextSessionApptId) setNextSessionApptId('') }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Heure début</label>
          <select value={nextSessionHeure} onChange={e => setNextSessionHeure(e.target.value)}>
            {RDV_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Heure fin</label>
          <select value={nextSessionFin} onChange={e => setNextSessionFin(e.target.value)}>
            <option value="">—</option>
            {RDV_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="field" style={{ margin: 0, marginBottom: 8 }}>
        <label style={{ fontSize: 11 }}>Note pour ce RDV (motif, rappels…)</label>
        <input
          type="text"
          value={nextSessionNote}
          onChange={e => setNextSessionNote(e.target.value)}
          placeholder="Ex : Suivi acupuncture, bilan mensuel…"
        />
      </div>

      {nextSession && (
        <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
          {isLinked
            ? '✓ Ce RDV sera mis à jour dans le calendrier à l\'enregistrement'
            : '✓ Ce RDV sera créé dans le calendrier à l\'enregistrement'}
        </div>
      )}

      {/* RDV existants pour ce patient */}
      {patientAppts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            RDV planifiés pour ce patient :
          </div>
          {patientAppts.map(appt => {
            const isSelected = nextSessionApptId === appt.id
            return (
              <div
                key={appt.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                  background: isSelected ? 'var(--teal)' : 'rgba(42,122,106,.08)',
                  border: `1px solid ${isSelected ? 'var(--teal)' : 'rgba(42,122,106,.25)'}`,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onClick={() => selectAppt(appt)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'white' : 'var(--teal)' }}>
                    {fmtApptDate(appt.date)} à {appt.heure_debut}
                    {appt.heure_fin && ` – ${appt.heure_fin}`}
                  </div>
                  {appt.note && (
                    <div style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,.85)' : 'var(--text-muted)' }}>
                      {appt.note}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.9)', fontWeight: 600 }}>Lié ✓</span>
                )}
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11, padding: '2px 7px', color: isSelected ? 'white' : 'var(--red)', background: 'transparent', border: `1px solid ${isSelected ? 'rgba(255,255,255,.4)' : 'rgba(168,50,50,.3)'}`, flexShrink: 0 }}
                  onClick={e => { e.stopPropagation(); deleteAppt(appt.id) }}
                  title="Supprimer ce RDV du calendrier"
                >✕</button>
              </div>
            )
          })}
          <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
            Cliquez sur un RDV pour le lier au prochain rendez-vous
          </div>
        </div>
      )}

      {!patientId && (
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
          Sélectionnez un patient pour voir ses RDV existants
        </div>
      )}
    </div>
  )
}

/* ─── ENERGY SECTION ─────────────────────────────────────────── */
function EnergySection({ energy, updateEnergy }: { energy: EnergyTests; updateEnergy: (u: Partial<EnergyTests>) => void }) {
  const toggleArr = (arr: string[], val: string) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  // Correspondance abréviation → organe complet pour Points Mu
  const POINT_MU_ORGANE: Record<string, string> = {
    'V': 'Vessie', 'IG': 'Intestin Grêle', 'TR': 'Triple Réchauffeur',
    'GI': 'Gros Intestin', 'Esto': 'Estomac', 'C': 'Cœur',
    'MC': 'Maître Cœur', 'P': 'Poumon', 'F': 'Foie',
    'Vb': 'Vésicule Biliaire', 'Rte': 'Rate', 'Rn': 'Reins',
  }
  const ptMuToOrgane = (pt: string): string => {
    const m = pt.match(/\(([^)]+)\)/)
    return m ? (POINT_MU_ORGANE[m[1]] || m[1]) : pt
  }

  return (
    <div className="card" id="sec-tests" style={{ borderLeft: '4px solid var(--purple)' }}>
      <div className="card-title"><span className="card-title-icon icon-purple">⚡</span>6. Tests énergétiques — Protocole de l'entonnoir</div>

      {/* Réchauffeurs */}
      <div className="energy-block">
        <h4>Étage 1 — 3 Réchauffeurs (bilatéral)</h4>
        <p style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 10 }}>Si énergie lésionnelle non bilatérale → pas un Réchauffeur</p>
        {energy.rechauffeurs.map((r, i) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.4rem 0', borderBottom: '1px solid rgba(155,142,191,.2)' }}>
            <input type="checkbox" checked={r.active} onChange={() => {
              const rech = energy.rechauffeurs.map((x, j) => j === i ? { ...x, active: !x.active, polarite: !x.active ? x.polarite : '' as const } : x)
              updateEnergy({ rechauffeurs: rech })
            }} style={{ width: 16, height: 16, accentColor: 'var(--purple)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)', minWidth: 120 }}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* Foyers */}
      <div className="energy-block">
        <h4>Étage 1 — 3 Foyers</h4>
        <div className="grid3">
          {energy.foyers.map((foyer, i) => {
            const fDef = FOYERS[i]
            return (
              <div key={foyer.key} style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '.75rem', border: '1px solid var(--purple-mid)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)', marginBottom: 4 }}>{foyer.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{fDef.desc}</div>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={foyer.active} onChange={() => {
                    const foyers = energy.foyers.map((f, j) => j === i ? { ...f, active: !f.active, subs: !f.active ? f.subs : [] } : f)
                    updateEnergy({ foyers })
                  }} style={{ width: 15, height: 15, accentColor: 'var(--purple)' }} />
                </label>
                {foyer.active && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Partie lésionnelle :</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {fDef.subs.map(sub => (
                        <button key={sub.key} className={`foyer-sub-btn${foyer.subs.includes(sub.key) ? ' active' : ''}`} onClick={() => {
                          const foyers = energy.foyers.map((f, j) => j === i ? { ...f, subs: f.subs.includes(sub.key) ? f.subs.filter(s => s !== sub.key) : [...f.subs, sub.key] } : f)
                          updateEnergy({ foyers })
                        }}>{sub.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Merveilleux Vaisseaux */}
      <div className="energy-block">
        <h4>Étage 2 — 8 Merveilleux Vaisseaux</h4>
        <p style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 8 }}>Vérifier le muscle associé : adducteurs → puis affiner les fonctions</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="mv-table">
            <thead>
              <tr>
                <th>Vaisseau</th><th>Pt Maître</th>
                <th>Fonction externe<br /><small style={{ fontWeight: 400 }}>(pt couplé)</small></th>
                <th>Axe distribution<br /><small style={{ fontWeight: 400 }}>(pt opposé)</small></th>
                <th>Fonction interne<br /><small style={{ fontWeight: 400 }}>(glande)</small></th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {energy.merveilleuxVaisseaux.map((mv, i) => (
                <tr key={mv.name}>
                  <td style={{ fontWeight: 600 }}>{mv.name}</td>
                  <td style={{ color: 'var(--purple)', fontWeight: 600 }}>{mv.pt}</td>
                  <td><label className="mv-check"><input type="checkbox" checked={mv.fonctionExterne} onChange={() => { const mvx = energy.merveilleuxVaisseaux.map((m, j) => j === i ? { ...m, fonctionExterne: !m.fonctionExterne } : m); updateEnergy({ merveilleuxVaisseaux: mvx }) }} /> {mv.couple}</label></td>
                  <td><label className="mv-check"><input type="checkbox" checked={mv.axeDistribution} onChange={() => { const mvx = energy.merveilleuxVaisseaux.map((m, j) => j === i ? { ...m, axeDistribution: !m.axeDistribution } : m); updateEnergy({ merveilleuxVaisseaux: mvx }) }} /> {mv.oppose}</label></td>
                  <td><label className="mv-check"><input type="checkbox" checked={mv.fonctionInterne} onChange={() => { const mvx = energy.merveilleuxVaisseaux.map((m, j) => j === i ? { ...m, fonctionInterne: !m.fonctionInterne } : m); updateEnergy({ merveilleuxVaisseaux: mvx }) }} /> {mv.glande}</label></td>
                  <td><input type="text" value={mv.note} onChange={e => { const mvx = energy.merveilleuxVaisseaux.map((m, j) => j === i ? { ...m, note: e.target.value } : m); updateEnergy({ merveilleuxVaisseaux: mvx }) }} placeholder="Notes…" style={{ fontSize: 11 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Points Mu */}
      <div className="energy-block">
        <h4>Points Mu — Déterminer l'Empereur</h4>
        <p style={{ fontSize: 12, color: 'var(--purple)', marginBottom: 8 }}>Palpation / kinésiologie → chercher résistance ou dureté à l'appui</p>
        <div className="check-group">
          {POINTS_MU.map(pt => (
            <label key={pt} className="check-item">
              <input type="checkbox" checked={energy.pointsMu.includes(pt)}
                onChange={() => {
                  const alreadyChecked = energy.pointsMu.includes(pt)
                  const newPointsMu = alreadyChecked
                    ? energy.pointsMu.filter(x => x !== pt)
                    : [...energy.pointsMu, pt]
                  const organe = ptMuToOrgane(pt)
                  // Auto-remplir l'Empereur au coche, effacer si décoche et correspond
                  const newEmpereur = !alreadyChecked
                    ? organe
                    : (energy.empereur === organe ? '' : energy.empereur)
                  updateEnergy({ pointsMu: newPointsMu, empereur: newEmpereur })
                }}
                style={{ accentColor: 'var(--purple)' }} /> {pt}
            </label>
          ))}
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Empereur sélectionné</label><input type="text" value={energy.empereur} onChange={e => updateEnergy({ empereur: e.target.value })} placeholder="Ex : Foie, Rein…" /></div>
          <div className="field">
            <label>Vide / Plénitude</label>
            <div className="polarity-btns" style={{ marginTop: 6 }}>
              <button className={`pol-btn${energy.empereurPolarite === '+' ? ' active-plus' : ''}`} onClick={() => updateEnergy({ empereurPolarite: energy.empereurPolarite === '+' ? '' : '+' })}>+ Plénitude</button>
              <button className={`pol-btn${energy.empereurPolarite === '-' ? ' active-minus' : ''}`} onClick={() => updateEnergy({ empereurPolarite: energy.empereurPolarite === '-' ? '' : '-' })}>− Vide</button>
            </div>
          </div>
        </div>
      </div>

      {/* Syndrome */}
      <div className="energy-block">
        <h4>Syndrome</h4>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Yang · Qi · Sang · Liquides · Yin</div>
        <div className="tag-group" style={{ marginBottom: 14 }}>
          {SYNDROMES_BASE.map(v => (
            <TagBtn key={v} label={v} active={energy.syndrome.includes(v)} colorClass="tag-purple"
              onClick={() => updateEnergy({ syndrome: energy.syndrome.includes(v) ? energy.syndrome.filter(x => x !== v) : [...energy.syndrome, v] })} />
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Froid / Chaleur interne (Wu Shu Xue antiques)</div>
        <div className="tag-group">
          {SYNDROMES_CLIMAT.map((v, i) => (
            <TagBtn key={v} label={v} active={energy.syndromeClimat.includes(v)}
              colorClass={['tag-blue','tag-red','tag-amber','tag-teal','tag-blue'][i]}
              onClick={() => updateEnergy({ syndromeClimat: energy.syndromeClimat.includes(v) ? energy.syndromeClimat.filter(x => x !== v) : [...energy.syndromeClimat, v] })} />
          ))}
        </div>
      </div>

      {/* Énergie compensatrice */}
      <div className="energy-block">
        <h4>Énergie compensatrice de l'Empereur</h4>
        <p style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 10 }}>Les 2 polarités sont possibles (MD ou BP)</p>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div style={{ background: '#fff', border: '1px solid var(--purple-mid)', borderRadius: 'var(--radius)', padding: '.75rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', marginBottom: 6 }}>Biao Li</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Relation Yin/Yang couplé</div>
            <input type="text" value={energy.energieComp.biaoli} onChange={e => updateEnergy({ energieComp: { ...energy.energieComp, biaoli: e.target.value } })} placeholder="Ex : Foie → Vésicule Biliaire…" style={{ fontSize: 12 }} />
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--purple-mid)', borderRadius: 'var(--radius)', padding: '.75rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', marginBottom: 6 }}>Midi / Minuit</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Relation horloge circadienne</div>
            <input type="text" value={energy.energieComp.midiMinuit} onChange={e => updateEnergy({ energieComp: { ...energy.energieComp, midiMinuit: e.target.value } })} placeholder="Ex : Foie (1h-3h) → IG (13h-15h)…" style={{ fontSize: 12 }} />
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--purple-mid)', borderRadius: 'var(--radius)', padding: '.75rem', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', marginBottom: 8 }}>Grands Méridiens</div>
          <div className="grid3">
            <div className="field"><label style={{ fontSize: 11 }}>Méridien</label><input type="text" value={energy.energieComp.gmMeridien} onChange={e => updateEnergy({ energieComp: { ...energy.energieComp, gmMeridien: e.target.value } })} placeholder="Ex : Foie…" style={{ fontSize: 12 }} /></div>
            <div className="field">
              <label style={{ fontSize: 11 }}>Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {['Attaque climatique','Phase de maladie','Yanagiya Sorei'].map(t => (
                  <button key={t} className={`foyer-sub-btn${energy.energieComp.gmType.includes(t) ? ' active' : ''}`}
                    onClick={() => updateEnergy({ energieComp: { ...energy.energieComp, gmType: energy.energieComp.gmType.includes(t) ? energy.energieComp.gmType.filter(x => x !== t) : [...energy.energieComp.gmType, t] } })}>{t}</button>
                ))}
              </div>
            </div>
            <div className="field"><label style={{ fontSize: 11 }}>Notes</label><input type="text" value={energy.energieComp.gmNotes} onChange={e => updateEnergy({ energieComp: { ...energy.energieComp, gmNotes: e.target.value } })} placeholder="Précisions…" style={{ fontSize: 12 }} /></div>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--purple-mid)', borderRadius: 'var(--radius)', padding: '.75rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', marginBottom: 8 }}>5 Mouvements (polarité opposée)</div>
          <div className="grid3">
            <div className="field">
              <label style={{ fontSize: 11 }}>Relation</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {['Mère','Fils','Conseiller','Ennemi','2e Feu (MC/TR)'].map(t => (
                  <button key={t} className={`foyer-sub-btn${energy.energieComp.cinqMouvements.includes(t) ? ' active' : ''}`}
                    onClick={() => updateEnergy({ energieComp: { ...energy.energieComp, cinqMouvements: energy.energieComp.cinqMouvements.includes(t) ? energy.energieComp.cinqMouvements.filter(x => x !== t) : [...energy.energieComp.cinqMouvements, t] } })}>{t}</button>
                ))}
              </div>
            </div>
            <div className="field"><label style={{ fontSize: 11 }}>Élément compensateur</label><input type="text" value={energy.energieComp.element} onChange={e => updateEnergy({ energieComp: { ...energy.energieComp, element: e.target.value } })} placeholder="Ex : Eau, Métal…" style={{ fontSize: 12 }} /></div>
            <div className="field"><label style={{ fontSize: 11 }}>Notes</label><input type="text" value={energy.energieComp.notes} onChange={e => updateEnergy({ energieComp: { ...energy.energieComp, notes: e.target.value } })} placeholder="Précisions…" style={{ fontSize: 12 }} /></div>
          </div>
        </div>
      </div>

      {/* Niveau de pénétration */}
      <div className="energy-block">
        <h4>Niveau de pénétration</h4>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.65rem .75rem', marginBottom: '.75rem', fontSize: 12, color: 'var(--text-muted)' }}>
          <strong>Rappel :</strong> noter séparément le niveau de l'Empereur et celui de l'énergie compensatrice.
          <span style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--pen-mtm-bg)', color: 'var(--pen-mtm-text)', fontSize: 11, fontWeight: 600 }}>MTM = Vert</span>
            <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--pen-mp-bg)', color: 'var(--pen-mp-text)', fontSize: 11, fontWeight: 600 }}>MP = Bleu</span>
            <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--pen-md-bg)', color: 'var(--pen-md-text)', fontSize: 11, fontWeight: 600 }}>MD = Ambre</span>
            <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--pen-bp-bg)', color: 'var(--pen-bp-text)', fontSize: 11, fontWeight: 600 }}>BP = Rose</span>
          </span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Empereur – inscription : {energy.empereur || '(non défini)'}</div>
          <div className="tag-group">
            {PENETRATION_LEVELS.map(p => (
              <TagBtn key={p.key} label={p.label} active={energy.penetrationEmp.includes(p.val)} colorClass={`pen-${p.key.toLowerCase()}`}
                onClick={() => updateEnergy({ penetrationEmp: energy.penetrationEmp.includes(p.val) ? energy.penetrationEmp.filter(x => x !== p.val) : [...energy.penetrationEmp, p.val] })} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Énergie compensatrice</div>
          <div className="tag-group">
            {PENETRATION_LEVELS.map(p => {
              const val = p.val + ' (comp)'
              return (
                <TagBtn key={p.key} label={p.label} active={energy.penetrationComp.includes(val)} colorClass={`pen-${p.key.toLowerCase()}`}
                  onClick={() => updateEnergy({ penetrationComp: energy.penetrationComp.includes(val) ? energy.penetrationComp.filter(x => x !== val) : [...energy.penetrationComp, val] })} />
              )
            })}
          </div>
        </div>
        <div className="field"><label>Notes tests énergétiques</label><RichTextArea value={energy.testsNotes} onChange={html => updateEnergy({ testsNotes: html })} placeholder="Résultats kinésiologie, palpations, observations complémentaires…" minHeight={60} /></div>
      </div>
    </div>
  )
}
