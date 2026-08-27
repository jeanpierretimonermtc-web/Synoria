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
    name: 'Kinésiologie',
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

  // Vérifie si chaque patient de test est présent individuellement
  const existsMartin = db.prepare("SELECT id FROM patients WHERE last_name = 'MARTIN' AND first_name = 'Jean-Paul'").get()
  const existsDupont = db.prepare("SELECT id FROM patients WHERE last_name = 'DUPONT' AND first_name = 'Sophie'").get()
  const existsLeblanc = db.prepare("SELECT id FROM patients WHERE last_name = 'LEBLANC' AND first_name = 'Marc'").get()

  if (existsMartin && existsDupont && existsLeblanc) return // Tous présents

  console.log('[DEV] Création des données de test manquantes...')
  const now = new Date().toISOString()

  // ── Types de consultation ─────────────────────────────────────────
  let typeId: string
  try {
    const types = comptaRepo.getConsultationTypes()
    typeId = types[0]?.id
    if (!typeId) {
      db.prepare(`INSERT OR IGNORE INTO consultation_types VALUES (?,?,?,?,?)`).run('consult_std', 'Consultation standard', 70, 1, 0)
      db.prepare(`INSERT OR IGNORE INTO consultation_types VALUES (?,?,?,?,?)`).run('consult_ini', 'Première consultation', 90, 1, 1)
      typeId = 'consult_std'
    }
  } catch { typeId = 'consult_std' }

  const annee1 = TODAY.getFullYear()
  const mois1  = TODAY.getMonth() + 1

  // ── PATIENT 1 — MTC JP ────────────────────────────────────────────
  if (!existsMartin) {
    try {
      const p1 = patientRepo.createPatient({
        first_name: 'Jean-Paul', last_name: 'MARTIN',
        birth_date: '1979-03-15', phone: '06 12 34 56 78', email: 'jp.martin@email.fr',
        address: '12 rue des Érables, 75015 Paris', profession: 'Cadre dirigeant',
        notes_general: 'Patient ponctuel. Préfère les rendez-vous du matin.',
        alerts: 'Allergie aspirine', medications: 'Paracétamol occasionnel',
        antecedents: 'Lombalgie chronique depuis 2018. Hernie discale L4-L5 diagnostiquée 2020.',
        regular_doctor: 'Dr Lefebvre - Médecin généraliste Paris 15e',
        is_active: 1, consent_given: 1, consent_date: D(-30), civility: 'M',
        created_at: now, updated_at: now,
      } as any)

      sessionRepo.createSession({
        patient_id: p1.id, date: D(-30), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Lombalgies chroniques — bilan initial</p>',
        evolution_tags: '🌱 1ère consultation',
        evolution: '<p>Première séance. Patient très douloureux, mobilité réduite.</p>',
        diagnostic_mtc: 'Vide de Rein Yang, stagnation Qi et Xue',
        cinq_elements: 'Eau/Bois', causes: 'Surmenage professionnel, stress chronique',
        points: 'BL23, BL40, GV4, KD3, SP6', techniques: 'Acupuncture, moxibustion',
        next_session_date: D(-14),
        full_data_json: JSON.stringify({ sessionNum: 1, pluginId: MTC_PLUGIN_ID, pluginIsBuiltin: true }),
        created_at: now, updated_at: now,
      } as any)

      sessionRepo.createSession({
        patient_id: p1.id, date: D(-14), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Lombalgies — suivi séance 2</p>',
        evolution_tags: '↗ Légère amélioration',
        evolution: '<p>Le patient signale une diminution de 30% de la douleur. Sommeil amélioré.</p>',
        diagnostic_mtc: 'Vide de Rein Yang persistant, amélioration de la stagnation',
        points: 'BL23, BL25, GV4, KD7, ST36', plantes: 'You Gui Wan - 8 pilules 2x/jour',
        reactions: '<p>Légère somnolence post-séance. Bon signe.</p>',
        next_session_date: D(14), full_data_json: SESSION_MTC_FD,
        systemes_json: JSON.stringify({
          reins: { checked: ['Polyurie nocturne', 'Douleurs lombaires'], note: '' },
          musculo: { checked: ['Raideur matinale'], douleur: 6, localisation: 'Lombaire bas' },
        }),
        created_at: now, updated_at: now,
      } as any)

      appointmentRepo.createAppointment({ patient_id: p1.id, date: D(14), heure_debut: '10:00', heure_fin: '11:00', note: 'Séance 3 — réévaluation mobilité lombaire', is_done: 0 })
      appointmentRepo.createAppointment({ patient_id: p1.id, date: D(1),  heure_debut: '09:00', heure_fin: '10:00', note: 'Séance urgente — recrudescence douleurs', is_done: 0 })
      try { comptaRepo.setMonthlyRevenue(annee1, mois1, typeId, 2) } catch {}
      console.log('[DEV] ✓ MARTIN Jean-Paul créé')
    } catch (e) { console.error('[DEV] Erreur patient 1:', e) }
  }

  // ── PATIENT 2 — Kinésiologie ─────────────────────────────────────
  if (!existsDupont) {
    try {
      const p2 = patientRepo.createPatient({
        first_name: 'Sophie', last_name: 'DUPONT',
        birth_date: '1988-07-22', phone: '07 23 45 67 89', email: 'sophie.dupont@gmail.com',
        address: '4 avenue Beaumont, 69003 Lyon', profession: 'Responsable RH',
        notes_general: 'Patiente très communicative. Souhaite des explications détaillées.',
        alerts: '', antecedents: 'Burnout professionnel 2024. Suivi psychologique en cours.',
        regular_doctor: 'Dr Moreau - Médecin généraliste Lyon 3e',
        is_active: 1, consent_given: 1, consent_date: D(-7), civility: 'Mme',
        created_at: now, updated_at: now,
      } as any)

      sessionRepo.createSession({
        patient_id: p2.id, date: D(-7), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Gestion du stress — première séance kinésiologie</p>',
        evolution_tags: '🌱 1ère consultation',
        evolution: '<p>Bonne mise en confiance. Patiente réceptive aux techniques proposées.</p>',
        full_data_json: SESSION_KINESIO_FD, next_session_date: D(7),
        created_at: now, updated_at: now,
      } as any)

      appointmentRepo.createAppointment({ patient_id: p2.id, date: D(7), heure_debut: '14:30', heure_fin: '15:30', note: 'Bilan post-1ère séance kinésiologie', is_done: 0 })

      db.prepare(`INSERT INTO invoices_log (id, invoice_number, invoice_date, patient_first_name, patient_last_name, email, phone, description, montant, is_paid, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(uuid(), `${annee1}-001`, D(-7), 'Sophie', 'DUPONT', 'sophie.dupont@gmail.com', '07 23 45 67 89', 'Séance kinésiologie — première consultation', 90, 0, now)
      console.log('[DEV] ✓ DUPONT Sophie créée')
    } catch (e) { console.error('[DEV] Erreur patient 2:', e) }
  }

  // ── PATIENT 3 — Mode simple ───────────────────────────────────────
  if (!existsLeblanc) {
    try {
      const p3 = patientRepo.createPatient({
        first_name: 'Marc', last_name: 'LEBLANC',
        birth_date: '1963-11-08', phone: '06 34 56 78 90', email: '',
        address: '8 impasse des Lilas, 13008 Marseille', profession: 'Retraité (ancien comptable)',
        notes_general: "Patient fidèle depuis 5 ans. Ponctuel. Pas d'adresse email.",
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
        traitement_notes: '<p>Massage profond quadriceps et ischio-jambiers. Mobilisation passive.</p>',
        reactions: '<p>Bien supporté. Légère courbature post-séance habituelle.</p>',
        full_data_json: JSON.stringify({ sessionNum: 2 }),
        next_session_date: D(-30), created_at: now, updated_at: now,
      } as any)

      sessionRepo.createSession({
        patient_id: p3.id, date: D(-30), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Arthrose genoux — suivi mensuel</p>',
        evolution_tags: '↗ Légère amélioration',
        evolution: '<p>Marche 20 min sans douleur depuis 10 jours. Excellent progrès.</p>',
        traitement_notes: '<p>Massage, mobilisation. Exercices proprioceptifs doux. Conseils natation.</p>',
        reactions: '<p>Aucune réaction particulière. Patient enthousiaste.</p>',
        full_data_json: SESSION_SIMPLE_FD, next_session_date: D(21),
        created_at: now, updated_at: now,
      } as any)

      appointmentRepo.createAppointment({ patient_id: p3.id, date: D(21), heure_debut: '09:00', heure_fin: '10:00', note: 'Suivi mensuel arthrose genoux', is_done: 0 })

      db.prepare(`INSERT INTO invoices_log (id, invoice_number, invoice_date, patient_first_name, patient_last_name, phone, description, montant, is_paid, paid_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(uuid(), `${annee1}-002`, D(-30), 'Marc', 'LEBLANC', '06 34 56 78 90', 'Séance — suivi mensuel arthrose', 70, 1, D(-25), now)

      try { comptaRepo.setMonthlyRevenue(annee1, mois1, typeId, 3) } catch {}
      console.log('[DEV] ✓ LEBLANC Marc créé')
    } catch (e) { console.error('[DEV] Erreur patient 3:', e) }
  }

  // ── PATIENTS MARKETING (captures d'écran / vidéos de présentation) ─
  // 3 profils fictifs, un par formulaire, chaque section entièrement remplie.
  await seedMarketingProfilesIfMissing()

  console.log('[DEV] ✓ Données de test à jour')
}

async function seedMarketingProfilesIfMissing(): Promise<void> {
  const db = getDb()

  const existsRoux     = db.prepare("SELECT id FROM patients WHERE last_name = 'ROUX' AND first_name = 'Isabelle'").get()
  const existsBernard  = db.prepare("SELECT id FROM patients WHERE last_name = 'BERNARD' AND first_name = 'Thomas'").get()
  const existsFontaine = db.prepare("SELECT id FROM patients WHERE last_name = 'FONTAINE' AND first_name = 'Nadia'").get()

  if (existsRoux && existsBernard && existsFontaine) return

  console.log('[DEV] Création des profils marketing manquants...')
  const now = new Date().toISOString()

  // Lit les schémas de plugins réels pour un pluginSchema fidèle (captures cohérentes
  // avec l'app telle qu'elle sera présentée). Chemin relatif à la racine du projet (dev only).
  const { readFileSync } = require('fs')
  const { join: pathJoin } = require('path')
  const loadPlugin = (file: string) => {
    try { return JSON.parse(readFileSync(pathJoin(process.cwd(), 'public', 'plugins', file), 'utf8')) }
    catch { return null }
  }
  const kinesioSchema = loadPlugin('kinesio.plugin.json')
  const douleurSchema = loadPlugin('douleur_evolution.plugin.json')

  // ── PATIENT MARKETING 1 — MTC intégré : Isabelle ROUX ──────────────
  if (!existsRoux) {
    try {
      const p = patientRepo.createPatient({
        first_name: 'Isabelle', last_name: 'ROUX',
        birth_date: '1985-04-12', phone: '06 45 12 78 33', email: 'isabelle.roux@email.fr',
        address: '22 rue du Faubourg Saint-Antoine, 75011 Paris', profession: 'Architecte',
        notes_general: 'Patiente rigoureuse, prend des notes pendant les séances.',
        alerts: 'Aucune allergie connue', medications: 'Contraception orale',
        antecedents: 'Troubles digestifs chroniques depuis 2021. Cycles menstruels irréguliers.',
        regular_doctor: 'Dr Chevalier — Médecin généraliste Paris 11e',
        is_active: 1, consent_given: 1, consent_date: D(-90), civility: 'Mme',
        created_at: now, updated_at: now,
      } as any)

      const apptDate = D(21)
      const appt = appointmentRepo.createAppointment({
        patient_id: p.id, date: apptDate, heure_debut: '10:00', heure_fin: '11:00',
        note: 'Bilan digestif, réévaluer le pouls', is_done: 0,
      })

      const langue = ['Pâle', 'Enduit blanc', 'Gonflée']
      const pouls  = ['Faible', 'Glissant']
      const techniques = ['Acupuncture', 'Moxibustion', 'Diététique']
      const poulsPos = { droitAvant: 'Faible', droitMilieu: 'Glissant', droitArriere: 'Profond', gaucheAvant: 'Normal', gaucheMilieu: 'Faible', gaucheArriere: 'Faible' }

      sessionRepo.createSession({
        patient_id: p.id, date: D(0), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Suivi mensuel — troubles digestifs et fatigue chronique</p>',
        evolution_tags: '↗ Légère amélioration',
        evolution: "<p>Transit plus régulier depuis la dernière séance. Moins de ballonnements après les repas. Fatigue en fin de journée persistante.</p>",
        problematiques: 'Troubles digestifs, fatigue chronique, cycles irréguliers',
        langue: langue.join(', '), pouls: pouls.join(', '),
        constitution: 'Terre 🌍', type_corps: 'Longiligne, tonus musculaire moyen', teint: 'Légèrement jaunâtre',
        observation: 'Cernes marqués, ongles cassants, ventre légèrement distendu à la palpation',
        diagnostic_mtc: 'Vide de Rate-Estomac avec accumulation d\'Humidité',
        cinq_elements: 'Terre déficiente, légère stagnation du Bois',
        causes: 'Alimentation irrégulière, surmenage professionnel, rythme de vie déséquilibré',
        analyse: 'Le Qi de Rate ne transforme plus efficacement les aliments, d\'où les ballonnements et la fatigue post-prandiale. Le stress professionnel entretient une légère stagnation du Foie qui envahit la Rate.',
        principes: 'Tonifier la Rate et l\'Estomac, drainer l\'Humidité, harmoniser Foie-Rate',
        points: 'Rte6, E36, Rte9, F3, VC12', pts_oreille: 'Shen Men, Estomac, Rate',
        techniques: techniques.join(', '),
        plantes: 'Si Jun Zi Tang — 6 comprimés 2x/jour pendant 3 semaines, à distance des repas',
        reactions: '<p>Légère somnolence en fin de séance, sensation de chaleur dans l\'abdomen. Bon signe de mobilisation du Qi.</p>',
        traitement_notes: '<p>Insister sur la régularité des repas, éviter le froid et le cru.</p>',
        conseils: 'Manger à heures régulières, privilégier les aliments cuits et tièdes, réduire les crudités et le froid.',
        plan: 'Objectif : stabiliser le transit et retrouver l\'énergie de fin de journée d\'ici 2 mois, à raison d\'une séance toutes les 3 semaines.',
        surveiller: 'Réapparition des ballonnements en période de stress professionnel intense.',
        next_session_date: apptDate,
        full_data_json: JSON.stringify({
          sessionNum: 4, patientId: p.id, date: D(0), practitioner: 'Jean-Pierre TIMONER',
          motif: '<p>Suivi mensuel — troubles digestifs et fatigue chronique</p>',
          evolutionTags: ['↗ Légère amélioration'],
          evolution: "<p>Transit plus régulier depuis la dernière séance. Moins de ballonnements après les repas. Fatigue en fin de journée persistante.</p>",
          problematiques: 'Troubles digestifs, fatigue chronique, cycles irréguliers',
          anamnese: "<p>Patiente <strong>architecte</strong>, rythme de travail soutenu. Alimentation irrégulière en semaine. Se plaint de ballonnements post-prandiaux et de fatigue en fin d'après-midi. Sommeil correct mais réveils nocturnes occasionnels.</p>",
          langue, langueNote: 'Empreintes dentaires sur les bords, enduit légèrement épais au centre',
          pouls, poulsNote: 'Pouls un peu faible aux deux Guan, légèrement glissant', poulsPos,
          constitution: 'Terre 🌍', typeCorps: 'Longiligne, tonus musculaire moyen', teint: 'Légèrement jaunâtre',
          observation: 'Cernes marqués, ongles cassants, ventre légèrement distendu à la palpation',
          diagnostic: 'Vide de Rate-Estomac avec accumulation d\'Humidité',
          cinqElements: 'Terre déficiente, légère stagnation du Bois',
          causes: 'Alimentation irrégulière, surmenage professionnel, rythme de vie déséquilibré',
          analyse: 'Le Qi de Rate ne transforme plus efficacement les aliments, d\'où les ballonnements et la fatigue post-prandiale. Le stress professionnel entretient une légère stagnation du Foie qui envahit la Rate.',
          principes: 'Tonifier la Rate et l\'Estomac, drainer l\'Humidité, harmoniser Foie-Rate',
          points: 'Rte6, E36, Rte9, F3, VC12', ptsOreille: 'Shen Men, Estomac, Rate',
          techniques,
          plantes: 'Si Jun Zi Tang — 6 comprimés 2x/jour pendant 3 semaines, à distance des repas',
          reactions: '<p>Légère somnolence en fin de séance, sensation de chaleur dans l\'abdomen. Bon signe de mobilisation du Qi.</p>',
          traitementNotes: '<p>Insister sur la régularité des repas, éviter le froid et le cru.</p>',
          conseils: 'Manger à heures régulières, privilégier les aliments cuits et tièdes, réduire les crudités et le froid.',
          plan: 'Objectif : stabiliser le transit et retrouver l\'énergie de fin de journée d\'ici 2 mois, à raison d\'une séance toutes les 3 semaines.',
          surveiller: 'Réapparition des ballonnements en période de stress professionnel intense.',
          nextSession: apptDate, nextSessionHeure: '10:00', nextSessionNote: 'Bilan digestif, réévaluer le pouls',
          nextSessionApptId: appt.id,
          pluginId: MTC_PLUGIN_ID, pluginIsBuiltin: true,
        }),
        created_at: now, updated_at: now,
      } as any)

      console.log('[DEV] ✓ Profil marketing MTC — ROUX Isabelle créé')
    } catch (e) { console.error('[DEV] Erreur profil marketing MTC:', e) }
  }

  // ── PATIENT MARKETING 2 — Kinésiologie : Thomas BERNARD ────────────
  if (!existsBernard) {
    try {
      const p = patientRepo.createPatient({
        first_name: 'Thomas', last_name: 'BERNARD',
        birth_date: '1990-09-03', phone: '06 78 90 12 34', email: 'thomas.bernard@email.fr',
        address: '15 rue de la République, 33000 Bordeaux', profession: 'Développeur informatique',
        notes_general: 'Client réservé au début, se livre davantage après la 2e séance.',
        alerts: '', antecedents: 'Anxiété généralisée diagnostiquée en 2023. Aucun traitement médicamenteux actuellement.',
        regular_doctor: 'Dr Lambert — Médecin généraliste Bordeaux',
        is_active: 1, consent_given: 1, consent_date: D(-14), civility: 'M',
        created_at: now, updated_at: now,
      } as any)

      const apptDate = D(7)
      const appt = appointmentRepo.createAppointment({
        patient_id: p.id, date: apptDate, heure_debut: '11:00', heure_fin: '12:00',
        note: 'Suivi respiration et gestion du stress', is_done: 0,
      })

      const pluginData = {
        objetRdv: "<p>Client en reconversion professionnelle, ressent une <strong>anxiété importante</strong> face au changement de carrière. Recherche un accompagnement pour gérer le stress et clarifier ses objectifs.</p>",
        contexteFamilial: 'En couple depuis 6 ans, pas d\'enfants. Compagne très soutenante mais le client culpabilise de son mal-être.',
        contexteProfessionnel: 'Développeur depuis 8 ans, envisage une reconversion vers l\'enseignement. Démission prévue dans 3 mois, forte pression financière ressentie.',
        suiviMedical: 'Aucun traitement en cours. A consulté un psychologue pendant 6 mois en 2023.',
        stressScore: 4,
        qualiteSommeil: 'Perturbée',
        sommeil: 'Endormissement difficile (30-45 min), réveil vers 4h du matin avec ruminations sur l\'avenir professionnel.',
        emotions: 'Anxiété, peur de l\'échec, culpabilité, par moments soulagement à l\'idée du changement.',
        visionAvenir: 'Envie sincère de se reconvertir mais peur de ne pas y arriver financièrement et de décevoir son entourage.',
        motivationAide: 'Le déclic est venu après une crise d\'angoisse au travail il y a 3 semaines. Veut apprendre à gérer le stress avant la transition.',
        objectifsPrincipaux: 'Se sentir en confiance dans sa décision de reconversion, retrouver un sommeil réparateur, aborder la transition sereinement.',
        indicateursReussite: 'Dormir une nuit complète sans réveil, pouvoir parler de sa reconversion sans anxiété, sentiment de calme intérieur.',
        techniquesEquilibrage: ['Test musculaire', 'Respiration consciente', 'Ancrage / enracinement', 'Visualisation', 'Affirmation positive'],
        derouléSeance: '<p>Test musculaire initial révélant un stress marqué autour du thème "sécurité financière". Travail sur l\'ancrage et la respiration. Visualisation guidée de la nouvelle carrière. Le client a exprimé un fort soulagement après l\'exercice de respiration.</p>',
        resultatPercu: 'Positif',
        stressApres: 3,
        bilanSeance: 'Bonne réceptivité aux techniques de respiration et d\'ancrage. Le thème de la sécurité financière reste central à retravailler.',
        conseilsEntreSeances: 'Pratiquer la respiration 4-7-8 chaque soir avant le coucher. Noter les pensées anxieuses dans un carnet plutôt que de les ruminer.',
        axesTravailProchain: 'Approfondir le travail sur la peur de l\'échec et la légitimité professionnelle.',
        frequencePreconisee: '1 fois par semaine',
        anamnèseProchainRdv: 'Faire le point sur la pratique de la respiration, réévaluer le niveau de stress avant la démission.',
      }

      sessionRepo.createSession({
        patient_id: p.id, date: D(0), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Anxiété liée à une reconversion professionnelle</p>',
        evolution_tags: '🌱 1ère consultation',
        evolution: '<p>Première séance d\'anamnèse complète avant le démarrage de l\'accompagnement.</p>',
        next_session_date: apptDate,
        full_data_json: JSON.stringify({
          sessionNum: 1, patientId: p.id, date: D(0), practitioner: 'Jean-Pierre TIMONER',
          motif: '<p>Anxiété liée à une reconversion professionnelle</p>',
          evolutionTags: ['🌱 1ère consultation'],
          evolution: '<p>Première séance d\'anamnèse complète avant le démarrage de l\'accompagnement.</p>',
          nextSession: apptDate, nextSessionHeure: '11:00', nextSessionNote: 'Suivi respiration et gestion du stress',
          nextSessionApptId: appt.id,
          pluginData,
          pluginId: KINESIO_PLUGIN_ID, pluginIsBuiltin: false,
          pluginSchema: kinesioSchema,
        }),
        created_at: now, updated_at: now,
      } as any)

      console.log('[DEV] ✓ Profil marketing Kinésiologie — BERNARD Thomas créé')
    } catch (e) { console.error('[DEV] Erreur profil marketing Kinésiologie:', e) }
  }

  // ── PATIENT MARKETING 3 — Suivi douleur : Nadia FONTAINE ───────────
  if (!existsFontaine) {
    try {
      const p = patientRepo.createPatient({
        first_name: 'Nadia', last_name: 'FONTAINE',
        birth_date: '1978-01-27', phone: '06 56 78 90 12', email: 'nadia.fontaine@email.fr',
        address: '9 boulevard Victor Hugo, 06000 Nice', profession: 'Coiffeuse',
        notes_general: 'Patiente très active, a du mal à respecter les temps de repos prescrits.',
        alerts: '', antecedents: 'Tendinopathie de l\'épaule droite diagnostiquée il y a 8 mois. Pas de chirurgie.',
        regular_doctor: 'Dr Giraud — Médecin du sport, Nice',
        is_active: 1, consent_given: 1, consent_date: D(-45), civility: 'Mme',
        created_at: now, updated_at: now,
      } as any)

      const apptDate = D(7)
      const appt = appointmentRepo.createAppointment({
        patient_id: p.id, date: apptDate, heure_debut: '15:00', heure_fin: '16:00',
        note: 'Réévaluer douleur épaule, ajuster renforcement', is_done: 0,
      })

      const pluginData = {
        motifPrincipal: '<p>Douleur persistante à l\'épaule droite, gênant le travail au quotidien (gestes répétitifs de coiffure). Demande un soulagement rapide avant la haute saison.</p>',
        anciennete: '6 mois à 1 an',
        circonstances: 'Apparition progressive liée aux gestes répétitifs du métier (bras levés toute la journée), sans traumatisme initial identifié.',
        antecedentsLies: 'Tendinopathie de la coiffe des rotateurs diagnostiquée par échographie il y a 8 mois. Pas de chirurgie, kinésithérapie ponctuelle.',
        traitementsEnCours: ['Anti-inflammatoires ponctuels', 'Kinésithérapie 1x/semaine'],
        schemaCorps: {
          front: ['Épaule droite'], back: [], left: [], right: [],
          details: { 'front:Épaule droite': { intensity: 7, symptom: 'Douleur', laterality: 'Droit', note: 'Douleur à l\'abduction et à l\'élévation du bras' } },
        },
        irradiation: 'Irradiation occasionnelle vers le deltoïde et le haut du bras droit, jusqu\'au coude lors des pics douloureux.',
        lateralite: 'Droit',
        notesLocalisation: 'Douleur profonde, localisée sous l\'acromion, reproduite à la palpation du sus-épineux.',
        douleurAvantApres: { before: 7, after: 4 },
        frequence: 'Quotidienne',
        evolutionDepuis: 'Légère amélioration',
        limitationFonctionnelle: ['Travail', 'Sommeil', 'Sport / activité physique'],
        impactSommeil: 6,
        impactActivites: 7,
        facteursAggravants: 'Gestes répétitifs bras levés (coiffure), port de charges, position couchée sur le côté droit la nuit.',
        facteursAmeliorants: 'Repos, chaleur locale, anti-inflammatoires, étirements doux le matin.',
        sensibilitesExterieures: ['Froid', 'Mouvement'],
        momentJournee: ['Le soir', 'À l\'effort', 'Après l\'effort'],
        testsRealises: [
          { nom: 'Test de Jobe', note: 'Positif à droite, douleur reproduite' },
          { nom: 'Test de Neer', note: 'Positif, conflit sous-acromial suspecté' },
        ],
        traitementEffectue: '<p>Massage transverse profond du sus-épineux, mobilisation gléno-humérale douce, étirements de la coiffe des rotateurs, taping de soutien.</p>',
        reactionsSeance: '<p>Diminution immédiate de la douleur après la séance (7→4). Légère sensibilité résiduelle au palper.</p>',
        conseilsDonnes: 'Éviter le port de charges lourdes cette semaine, dormir sur le côté gauche, glace 10 min après le travail si besoin.',
        objectifProchaine: 'Poursuivre le renforcement progressif de la coiffe des rotateurs, réévaluer l\'amplitude articulaire.',
        exercicesRecommandations: 'Étirements pendulaires matin et soir, renforcement isométrique doux 2x/jour, éviter les mouvements au-dessus de la tête pendant 1 semaine.',
        frequenceRecommandee: '1 fois par semaine',
        notesFinSeance: 'Bonne tolérance au traitement manuel. Prévoir un travail sur la posture de travail (hauteur du poste de coiffure).',
      }

      sessionRepo.createSession({
        patient_id: p.id, date: D(0), practitioner: 'Jean-Pierre TIMONER',
        motif: '<p>Douleur chronique épaule droite — coiffeuse</p>',
        evolution_tags: '↗ Légère amélioration',
        evolution: '<p>Douleur passée de 7/10 à 4/10 en fin de séance. Patiente encouragée par le résultat.</p>',
        next_session_date: apptDate,
        full_data_json: JSON.stringify({
          sessionNum: 3, patientId: p.id, date: D(0), practitioner: 'Jean-Pierre TIMONER',
          motif: '<p>Douleur chronique épaule droite — coiffeuse</p>',
          evolutionTags: ['↗ Légère amélioration'],
          evolution: '<p>Douleur passée de 7/10 à 4/10 en fin de séance. Patiente encouragée par le résultat.</p>',
          nextSession: apptDate, nextSessionHeure: '15:00', nextSessionNote: 'Réévaluer douleur épaule, ajuster renforcement',
          nextSessionApptId: appt.id,
          pluginData,
          pluginId: 'douleur_evolution', pluginIsBuiltin: false,
          pluginSchema: douleurSchema,
        }),
        created_at: now, updated_at: now,
      } as any)

      console.log('[DEV] ✓ Profil marketing Suivi douleur — FONTAINE Nadia créé')
    } catch (e) { console.error('[DEV] Erreur profil marketing Suivi douleur:', e) }
  }
}
