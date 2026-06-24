/**
 * Données de test pour l'environnement de développement (synoria_test).
 * Appelé automatiquement au démarrage en mode dev si la base est vide.
 *
 * 3 patients créés :
 *  1. MARTIN Jean-Paul  — plugin MTC JP (formulaire MTC intégré)
 *  2. DUPONT Sophie     — plugin Kinésiologie
 *  3. LEBLANC Marc      — mode simple (sans plugin)
 */

import { getDb }          from './connection'
import * as patientRepo   from './repositories/patientRepository'
import * as sessionRepo   from './repositories/sessionRepository'
import * as appointmentRepo from './repositories/appointmentRepository'
import * as comptaRepo    from './repositories/comptaRepository'
import { v4 as uuid }     from 'uuid'

const TODAY    = new Date()
const FMT_DATE = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const D = (delta: number) => {
  const d = new Date(TODAY); d.setDate(d.getDate() + delta); return FMT_DATE(d)
}

// ── MTC JP plugin schema (résumé) ──────────────────────────────────
const MTC_PLUGIN_ID = 'mtc_jp'
const KINESIO_PLUGIN_ID = 'kinesio_charlotte'

const SESSION_MTC_FD = JSON.stringify({
  sessionNum: 2,
  anamnese: '<p>Patient en suivi depuis 3 mois pour <strong>lombalgies chroniques</strong>. Amélioration notable de la mobilité. Dort mieux depuis 2 semaines. Stress professionnel toujours présent.</p>',
  problematiques: 'Lombalgies L4-L5, stress professionnel, fatigue chronique',
  langueNote: 'Enduit blanc épais à la racine',
  poulsNote: 'Pouls profond, lent',
  poulsPos: { droitAvant: 'Faible', droitMilieu: 'Normal', droitArriere: 'Profond', gaucheAvant: 'Tendu', gaucheMilieu: 'Normal', gaucheArriere: 'Faible' },
  barrageNiv1: 'Arnica 9CH - 5 granules 3x/jour',
  barrageNiv2: 'Rhus tox 15CH',
  nextSession: D(14),
  nextSessionHeure: '10:00',
  nextSessionNote: 'Réévaluer mobilité lombaire',
  pluginId: MTC_PLUGIN_ID,
  pluginIsBuiltin: true,
})

const SESSION_KINESIO_FD = JSON.stringify({
  sessionNum: 1,
  pluginId: KINESIO_PLUGIN_ID,
  pluginIsBuiltin: false,
  pluginData: {
    objetRdv: '<p>Première séance. Patiente consultant pour <strong>gestion du stress</strong> et manque de confiance en soi suite à un burnout professionnel.</p>',
    contexteFamilial: 'Séparée, 2 enfants. Relations familiales apaisées.',
    contexteProfessionnel: 'Retour progressif au travail après arrêt maladie 3 mois. Environnement de travail sous tension.',
    stressScore: 4,
    qualiteSommeil: 'Perturbée',
    emotions: 'Anxiété, sentiment d\'échec, découragement',
    motivationAide: 'Retrouver la confiance et l\'énergie pour reprendre sa vie en main.',
    objectifsPrincipaux: 'Réduire le stress, retrouver un sommeil réparateur, reprendre le sport.',
    ressenti_global: 'Bien',
  },
  pluginSchema: {
    id: KINESIO_PLUGIN_ID,
    name: 'Kinésiologie — Charlotte DECAENS',
    specialty: 'Kinésiologie',
    sections: [],
  },
  nextSession: D(7),
  nextSessionHeure: '14:30',
  nextSessionNote: 'Bilan post-1ère séance',
})

const SESSION_SIMPLE_FD = JSON.stringify({
  sessionNum: 3,
  anamnese: '<p>Suivi régulier pour <strong>arthrose genoux</strong>. Légère amélioration après les infiltrations. Marche 20 min sans douleur depuis 10 jours.</p>',
  simpleContextVie: 'Retraité actif. Jardinage, pétanque. Épouse en bonne santé. Bien entouré.',
  simpleTraitementsEnCours: 'Paracétamol 1g si besoin, gel anti-inflammatoire local. Kiné 2x/sem.',
  simpleObjectifs: 'Reprendre la randonnée courte distance. Éviter la prothèse le plus longtemps possible.',
  simpleNotesEntretien: 'Patient très motivé. Bonne observance. Demande si la natation peut aider → OUI, recommander piscine.',
  nextSession: D(21),
  nextSessionHeure: '09:00',
})

export async function seedDevDataIfEmpty(): Promise<void> {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as n FROM patients').get() as { n: number }).n
  if (count > 0) return // Déjà peuplé, on ne touche à rien

  console.log('[DEV] Base vide — création des données de test...')
  const now = new Date().toISOString()

  // ── Types de consultation ─────────────────────────────────────────
  const types = comptaRepo.getConsultationTypes()
  let typeId = types[0]?.id
  if (!typeId) {
    db.prepare(`INSERT INTO consultation_types VALUES (?,?,?,?,?)`).run('consult_std', 'Consultation standard', 70, 1, 0)
    db.prepare(`INSERT INTO consultation_types VALUES (?,?,?,?,?)`).run('consult_ini', 'Première consultation', 90, 1, 1)
    typeId = 'consult_std'
  }

  // ── PATIENT 1 — MTC JP ────────────────────────────────────────────
  const p1 = patientRepo.createPatient({
    first_name: 'Jean-Paul', last_name: 'MARTIN',
    birth_date: '1979-03-15', phone: '06 12 34 56 78', email: 'jp.martin@email.fr',
    address: '12 rue des Érables, 75015 Paris', profession: 'Cadre dirigeant',
    notes_general: 'Patient ponctuel. Préfère les rendez-vous du matin.',
    alerts: 'Allergie aspirine',
    medications: 'Paracétamol occasionnel',
    antecedents: 'Lombalgie chronique depuis 2018. Hernie discale L4-L5 diagnostiquée 2020.',
    regular_doctor: 'Dr Lefebvre - Médecin généraliste Paris 15e',
    is_active: 1, consent_given: 1, consent_date: D(-30), civility: 'M',
    created_at: now, updated_at: now,
  } as any)

  // Sessions MTC
  const s1a = sessionRepo.createSession({
    patient_id: p1.id, date: D(-30), practitioner: 'Jean-Pierre TIMONER',
    motif: '<p>Lombalgies chroniques — bilan initial</p>',
    evolution_tags: '🌱 1ère consultation',
    evolution: '<p>Première séance. Patient très douloureux, mobilité réduite.</p>',
    diagnostic_mtc: 'Vide de Rein Yang, stagnation Qi et Xue',
    cinq_elements: 'Eau/Bois',
    causes: 'Surmenage professionnel, stress chronique, mauvaise hygiène de vie',
    points: 'BL23, BL40, GV4, KD3, SP6',
    techniques: 'Acupuncture, moxibustion',
    next_session_date: D(-14),
    full_data_json: JSON.stringify({ sessionNum: 1, pluginId: MTC_PLUGIN_ID, pluginIsBuiltin: true }),
    created_at: now, updated_at: now,
  } as any)

  const apptId1 = uuid()
  const s1b = sessionRepo.createSession({
    patient_id: p1.id, date: D(-14), practitioner: 'Jean-Pierre TIMONER',
    motif: '<p>Lombalgies — suivi séance 2</p>',
    evolution_tags: '↗ Légère amélioration',
    evolution: '<p>Le patient signale une diminution de 30% de la douleur. Sommeil amélioré.</p>',
    diagnostic_mtc: 'Vide de Rein Yang persistant, amélioration de la stagnation',
    points: 'BL23, BL25, GV4, KD7, ST36',
    plantes: 'You Gui Wan - 8 pilules 2x/jour',
    reactions: '<p>Légère somnolence post-séance. Bon signe.</p>',
    next_session_date: D(14),
    full_data_json: SESSION_MTC_FD,
    systemes_json: JSON.stringify({
      reins: { checked: ['Polyurie nocturne', 'Douleurs lombaires'], note: '' },
      musculo: { checked: ['Raideur matinale'], douleur: 6, localisation: 'Lombaire bas' },
    }),
    created_at: now, updated_at: now,
  } as any)

  appointmentRepo.createAppointment({
    patient_id: p1.id, date: D(14), heure_debut: '10:00', heure_fin: '11:00',
    note: 'Séance 3 — réévaluation mobilité lombaire',
    is_done: 0,
  })
  // RDV DEMAIN pour tester la section rappels du dashboard
  appointmentRepo.createAppointment({
    patient_id: p1.id, date: D(1), heure_debut: '09:00', heure_fin: '10:00',
    note: 'Séance urgente — recrudescence douleurs',
    is_done: 0,
  })

  // Compta
  const mois1 = TODAY.getMonth() + 1
  const annee1 = TODAY.getFullYear()
  comptaRepo.setMonthlyRevenue(annee1, mois1, typeId, 2)

  // ── PATIENT 2 — Kinésiologie ─────────────────────────────────────
  const p2 = patientRepo.createPatient({
    first_name: 'Sophie', last_name: 'DUPONT',
    birth_date: '1988-07-22', phone: '07 23 45 67 89', email: 'sophie.dupont@gmail.com',
    address: '4 avenue Beaumont, 69003 Lyon', profession: 'Responsable RH',
    notes_general: 'Patiente très communicative. Souhaite des explications détaillées.',
    alerts: '',
    antecedents: 'Burnout professionnel 2024. Suivi psychologique en cours.',
    regular_doctor: 'Dr Moreau - Médecin généraliste Lyon 3e',
    is_active: 1, consent_given: 1, consent_date: D(-7), civility: 'Mme',
    created_at: now, updated_at: now,
  } as any)

  sessionRepo.createSession({
    patient_id: p2.id, date: D(-7), practitioner: 'Jean-Pierre TIMONER',
    motif: '<p>Gestion du stress — première séance kinésiologie</p>',
    evolution_tags: '🌱 1ère consultation',
    evolution: '<p>Bonne mise en confiance. Patiente réceptive aux techniques proposées.</p>',
    full_data_json: SESSION_KINESIO_FD,
    next_session_date: D(7),
    created_at: now, updated_at: now,
  } as any)

  appointmentRepo.createAppointment({
    patient_id: p2.id, date: D(7), heure_debut: '14:30', heure_fin: '15:30',
    note: 'Bilan post-1ère séance kinésiologie',
    is_done: 0,
  })

  // Facture
  const invId2 = uuid()
  db.prepare(`
    INSERT INTO invoices_log (id, invoice_number, invoice_date, patient_first_name, patient_last_name,
      email, phone, description, montant, is_paid, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(invId2, `${annee1}-001`, D(-7), 'Sophie', 'DUPONT',
    'sophie.dupont@gmail.com', '07 23 45 67 89',
    'Séance kinésiologie — première consultation', 90, 0, now)

  // ── PATIENT 3 — Mode simple ───────────────────────────────────────
  const p3 = patientRepo.createPatient({
    first_name: 'Marc', last_name: 'LEBLANC',
    birth_date: '1963-11-08', phone: '06 34 56 78 90', email: '',
    address: '8 impasse des Lilas, 13008 Marseille', profession: 'Retraité (ancien comptable)',
    notes_general: 'Patient fidèle depuis 5 ans. Ponctuel. Pas d\'adresse email.',
    alerts: 'Pacemaker — éviter électrostimulation',
    medications: 'Bisoprolol 5mg, Amlodipine 5mg (hypertension)',
    antecedents: 'Hypertension traitée, arthrose genoux bilatérale (grade II), infarctus 2019',
    regular_doctor: 'Dr Fabre - Cardiologue Marseille',
    is_active: 1, consent_given: 1, consent_date: D(-180), civility: 'M',
    created_at: now, updated_at: now,
  } as any)

  sessionRepo.createSession({
    patient_id: p3.id, date: D(-60), practitioner: 'Jean-Pierre TIMONER',
    motif: '<p>Arthrose genoux — douleurs à la montée des escaliers</p>',
    evolution_tags: '→ Stable',
    evolution: '<p>Stabilisation. Pas de progression. Patient satisfait des séances.</p>',
    traitement_notes: '<p>Massage profond quadriceps et ischio-jambiers. Mobilisation passive du genou. Techniques myofasciales.</p>',
    reactions: '<p>Bien supporté. Légère courbature post-séance habituelle.</p>',
    full_data_json: JSON.stringify({ sessionNum: 2 }),
    next_session_date: D(-30),
    created_at: now, updated_at: now,
  } as any)

  sessionRepo.createSession({
    patient_id: p3.id, date: D(-30), practitioner: 'Jean-Pierre TIMONER',
    motif: '<p>Arthrose genoux — suivi mensuel</p>',
    evolution_tags: '↗ Légère amélioration',
    evolution: '<p>Marche 20 min sans douleur depuis 10 jours. Excellent progrès.</p>',
    traitement_notes: '<p>Massage, mobilisation. Exercices proprioceptifs doux. Conseils natation.</p>',
    reactions: '<p>Aucune réaction particulière. Patient enthousiaste.</p>',
    full_data_json: SESSION_SIMPLE_FD,
    next_session_date: D(21),
    created_at: now, updated_at: now,
  } as any)

  appointmentRepo.createAppointment({
    patient_id: p3.id, date: D(21), heure_debut: '09:00', heure_fin: '10:00',
    note: 'Suivi mensuel arthrose genoux',
    is_done: 0,
  })

  const invId3 = uuid()
  db.prepare(`
    INSERT INTO invoices_log (id, invoice_number, invoice_date, patient_first_name, patient_last_name,
      phone, description, montant, is_paid, paid_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(invId3, `${annee1}-002`, D(-30), 'Marc', 'LEBLANC',
    '06 34 56 78 90', 'Séance — suivi mensuel arthrose', 70, 1, D(-25), now)

  // Compta mois en cours : 3 séances
  comptaRepo.setMonthlyRevenue(annee1, mois1, typeId, 3)

  console.log('[DEV] ✓ 3 patients de test créés avec séances, RDV et comptabilité')
}
