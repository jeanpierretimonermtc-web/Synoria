/**
 * Générateur de séances complètes pour les tests d'export.
 * Crée 3 séances par patient (simple, MTC complet, Kinésiologie).
 *
 * USAGE : npm run seed:test
 * PRÉREQUIS : l'application doit être ouverte et déverrouillée (DB décryptée).
 */

'use strict'

const path   = require('path')
const { existsSync } = require('fs')
const { randomUUID } = require('crypto')

// ── Chemin base de données ─────────────────────────────────────────────────────
const appData = process.env.APPDATA
if (!appData) { console.error('❌ APPDATA introuvable.'); process.exit(1) }

const devPath  = path.join(appData, 'Synoria Dev', 'database', 'mtc.sqlite')
const prodPath = path.join(appData, 'Synoria',     'database', 'mtc.sqlite')
const dbPath   = existsSync(devPath) ? devPath : existsSync(prodPath) ? prodPath : null

if (!dbPath) {
  console.error('❌ Base de données non trouvée.')
  console.error('   → Ouvrez l\'application Synoria et déverrouillez-la avant de lancer ce script.')
  process.exit(1)
}

console.log(`\n📂 Base trouvée : ${dbPath}\n`)

const Database = require('better-sqlite3')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

const now = new Date().toISOString()
const D   = (delta) => {
  const d = new Date(); d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function upsertPatient({ last_name, first_name, ...rest }) {
  const existing = db.prepare('SELECT id FROM patients WHERE last_name = ? AND first_name = ?').get(last_name, first_name)
  if (existing) {
    console.log(`   ↩ Patient trouvé : ${last_name} ${first_name} (${existing.id.slice(0,8)}…)`)
    return existing.id
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO patients (id, last_name, first_name, birth_date, phone, email, address, profession,
      notes_general, alerts, medications, antecedents, regular_doctor,
      is_active, consent_given, consent_date, civility, created_at, updated_at)
    VALUES (@id,@last_name,@first_name,@birth_date,@phone,@email,@address,@profession,
      @notes_general,@alerts,@medications,@antecedents,@regular_doctor,
      @is_active,@consent_given,@consent_date,@civility,@created_at,@updated_at)
  `).run({ id, last_name, first_name, created_at: now, updated_at: now, is_active: 1, ...rest })
  console.log(`   ✅ Patient créé : ${last_name} ${first_name}`)
  return id
}

function sessionCount(patient_id) {
  return db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE patient_id = ?').get(patient_id).n
}

function insertSession(data) {
  const id = randomUUID()
  db.prepare(`
    INSERT INTO sessions (
      id, patient_id, date, practitioner, motif, evolution_tags, evolution, problematiques,
      langue, pouls, constitution, type_corps, teint, observation,
      diagnostic_mtc, cinq_elements, causes, analyse, principes,
      points, pts_oreille, techniques, plantes, reactions, traitement_notes,
      conseils, plan, surveiller,
      energy_tests_json, systemes_json, full_data_json,
      next_session_date, created_at, updated_at
    ) VALUES (
      @id,@patient_id,@date,@practitioner,@motif,@evolution_tags,@evolution,@problematiques,
      @langue,@pouls,@constitution,@type_corps,@teint,@observation,
      @diagnostic_mtc,@cinq_elements,@causes,@analyse,@principes,
      @points,@pts_oreille,@techniques,@plantes,@reactions,@traitement_notes,
      @conseils,@plan,@surveiller,
      @energy_tests_json,@systemes_json,@full_data_json,
      @next_session_date,@created_at,@updated_at
    )
  `).run({
    id,
    practitioner:      data.practitioner      ?? null,
    motif:             data.motif             ?? null,
    evolution_tags:    data.evolution_tags    ?? null,
    evolution:         data.evolution         ?? null,
    problematiques:    data.problematiques    ?? null,
    langue:            data.langue            ?? null,
    pouls:             data.pouls             ?? null,
    constitution:      data.constitution      ?? null,
    type_corps:        data.type_corps        ?? null,
    teint:             data.teint             ?? null,
    observation:       data.observation       ?? null,
    diagnostic_mtc:    data.diagnostic_mtc    ?? null,
    cinq_elements:     data.cinq_elements     ?? null,
    causes:            data.causes            ?? null,
    analyse:           data.analyse           ?? null,
    principes:         data.principes         ?? null,
    points:            data.points            ?? null,
    pts_oreille:       data.pts_oreille       ?? null,
    techniques:        data.techniques        ?? null,
    plantes:           data.plantes           ?? null,
    reactions:         data.reactions         ?? null,
    traitement_notes:  data.traitement_notes  ?? null,
    conseils:          data.conseils          ?? null,
    plan:              data.plan              ?? null,
    surveiller:        data.surveiller        ?? null,
    energy_tests_json: data.energy_tests_json ?? null,
    systemes_json:     data.systemes_json     ?? null,
    full_data_json:    data.full_data_json    ?? null,
    next_session_date: data.next_session_date ?? null,
    created_at:        now,
    updated_at:        now,
    ...data,
  })
  return id
}

// ── Données communes ───────────────────────────────────────────────────────────
const PRATICIEN = 'Jean-Pierre TIMONER'

// ── Energy Tests complets (MTC) ────────────────────────────────────────────────
const ENERGY_TESTS = JSON.stringify({
  rechauffeurs: [
    { key: 'RS', label: 'Réchauffeur Supérieur', active: true,  polarite: '-' },
    { key: 'RM', label: 'Réchauffeur Moyen',     active: false, polarite: '' },
    { key: 'RI', label: 'Réchauffeur Inférieur', active: true,  polarite: '+' },
  ],
  foyers: [
    { key: 'FS', label: 'Foyer Supérieur', point: 'CV17', active: true,  subs: ['Poumon', 'Cœur'] },
    { key: 'FM', label: 'Foyer Moyen',     point: 'CV12', active: false, subs: [] },
    { key: 'FI', label: 'Foyer Inférieur', point: 'CV7',  active: true,  subs: ['Rein', 'Foie'] },
  ],
  merveilleuxVaisseaux: [
    {
      name: 'Du Mai', pt: 'SI3', couple: 'BL62', oppose: 'Ren Mai',
      glande: 'Épiphyse', fonctionExterne: true, axeDistribution: false, fonctionInterne: false,
      note: 'Actif — dos, rachis lombaire, rigidité de nuque',
    },
    {
      name: 'Chong Mai', pt: 'SP4', couple: 'PC6', oppose: 'Dai Mai',
      glande: 'Thymus', fonctionExterne: false, axeDistribution: true, fonctionInterne: false,
      note: 'Vide de Sang — fatigue profonde',
    },
  ],
  pointsMu: ['LU1', 'CV12', 'GB25', 'LR14'],
  empereur: 'Cœur',
  empereurPolarite: '-',
  syndrome: ['Vide de Yang', 'Stagnation de Qi', 'Vide de Sang'],
  syndromeClimat: ['Froid', 'Humidité'],
  energieComp: {
    biaoli: 'Poumon / Gros Intestin',
    midiMinuit: 'Cœur / Vésicule biliaire',
    gmMeridien: 'Rein',
    gmType: ['Vide', 'Froid'],
    gmNotes: 'Déficience Yang du Rein, insuffisance de l\'énergie ancestrale (Jing)',
    cinqMouvements: ['Eau', 'Bois'],
    element: 'Eau',
    notes: 'Traiter en priorité le Rein — soutien Yang, tonification Qi. Surveillance Foie secondaire.',
  },
  penetrationEmp: ['Shao Yin', 'Jue Yin'],
  penetrationComp: ['Tai Yang'],
  testsNotes: 'Tests réalisés en position allongée, ventre dégagé. Réponse franche sur Du Mai et méridien Rein. Test Foie faiblement positif.',
})

// ── Questionnaire systèmes complet (MTC) ──────────────────────────────────────
const SYSTEMES_LEBLANC = JSON.stringify({
  cardio:       { checked: ['Palpitations', 'Hypertension'], note: 'HTA traitée — bisoprolol 5mg. Palpitations nocturnes 1-2x/sem.' },
  pulmo:        { checked: [], note: '' },
  mental:       { checked: ['Insomnie', 'Stress chronique', 'Ruminations'], stress: 6, anxiete: 4, note: 'Endormissement difficile. Réveil 3h-4h du matin. Pensées envahissantes.' },
  vision:       { checked: ['Yeux secs', 'Fatigue oculaire'], note: 'Port de lunettes depuis 20 ans. Sécheresse en fin de journée.' },
  reins:        { checked: ['Polyurie nocturne', 'Douleurs lombaires', 'Frilosité'], note: 'Lève 2x la nuit. Lombalgies L4-L5 chroniques depuis 2018. Toujours froid aux pieds.' },
  rate:         { checked: ['Fatigue', 'Digestion lente', 'Ballonnements post-prandiaux'], energie: 4, regimeAlimentaire: 'Alimentation irrégulière, mange froid souvent, peu de légumes cuits', note: 'Fatigue post-déjeuner systématique.' },
  estomac:      { checked: ['Reflux gastro-œsophagien', 'Nausées matinales'], note: 'Reflux modéré le soir, aggravé par stress.' },
  grosIntestin: { checked: [], note: '' },
  peau:         { checked: [], emplacementAcne: '', emplacementEczema: '', note: '' },
  tete:         { checked: ['Maux de tête tensionnels', 'Acouphènes intermittents'], note: 'Céphalées en fin de journée, hémicrane gauche. Acouphènes depuis 2 ans, intensité légère.' },
  temp:         { checked: ['Extrémités froides', 'Transpiration nocturne'], note: 'Mains et pieds froids même en été. Sueurs nocturnes légères.' },
  musculo:      { checked: ['Raideur matinale', 'Douleurs chroniques', 'Arthrose'], douleur: 6, localisation: 'Lombaire bas L4-L5, irradiation fesse gauche et cuisse', note: 'EVA 6/10 au repos, 8/10 en flexion antérieure. Raideur 30 min au lever.' },
  feminin:      { checked: [], ageMenarche: '', jourCycle: '', longueurCycle: '', dureeMin: '', dureeMax: '', couleurSang: '', ecoulement: '', caillots: [], crampes: [], spm: [], note: '' },
  fertilite:    { checked: [], essaiConception: '', testsSanguins: '', resultatTests: '', diagnosticFertilite: [], debutMenopause: '', enceinte: false, nbSemaines: '', cesarienne: false, datePrevue: '', enfants: false, note: '' },
  masculin:     { checked: ['Baisse libido'], note: 'Signalé par le patient, lié à la fatigue générale selon lui.' },
})

const SYSTEMES_MARTIN = JSON.stringify({
  cardio:       { checked: [], note: '' },
  pulmo:        { checked: ['Essoufflement à l\'effort'], note: 'Monte les escaliers avec difficulté, amélioration depuis reprise sport.' },
  mental:       { checked: ['Stress chronique', 'Anxiété généralisée', 'Difficultés de concentration'], stress: 8, anxiete: 7, note: 'Surmenage professionnel constant. Décisions difficiles à prendre. Mémoire défaillante en soirée.' },
  vision:       { checked: ['Fatigue oculaire'], note: 'Travail sur écran 10h/jour.' },
  reins:        { checked: ['Polyurie nocturne', 'Douleurs lombaires'], note: 'Lève 1x/nuit. Lombalgies L4-L5 hernie discale confirmée IRM 2020.' },
  rate:         { checked: ['Fatigue', 'Appétit variable', 'Selles molles'], energie: 3, regimeAlimentaire: 'Repas pris au bureau, souvent rapides. Peu de cuisson longue.', note: 'Fatigue profonde dès 16h.' },
  estomac:      { checked: ['Brûlures d\'estomac'], note: 'Liées au stress, amélioration avec IPP ponctuel.' },
  grosIntestin: { checked: ['Transit irrégulier'], note: 'Alternance constipation/diarrhée lors des périodes de stress.' },
  peau:         { checked: [], emplacementAcne: '', emplacementEczema: '', note: '' },
  tete:         { checked: ['Maux de tête frontaux', 'Vertiges occasionnels'], note: 'Céphalées frontales en fin de semaine. Vertiges positionnels légers.' },
  temp:         { checked: ['Extrémités froides'], note: 'Mains froides, pieds moins froids depuis acupuncture.' },
  musculo:      { checked: ['Raideur matinale', 'Douleurs chroniques', 'Contractures musculaires'], douleur: 7, localisation: 'Lombaire L4-L5, épaules tendues, nuque rigide', note: 'EVA 7/10 en flexion. Contractures trapèzes +++.' },
  feminin:      { checked: [], ageMenarche: '', jourCycle: '', longueurCycle: '', dureeMin: '', dureeMax: '', couleurSang: '', ecoulement: '', caillots: [], crampes: [], spm: [], note: '' },
  fertilite:    { checked: [], essaiConception: '', testsSanguins: '', resultatTests: '', diagnosticFertilite: [], debutMenopause: '', enceinte: false, nbSemaines: '', cesarienne: false, datePrevue: '', enfants: false, note: '' },
  masculin:     { checked: [], note: '' },
})

// ── Schéma Kinésiologie (pour pluginSchema) ────────────────────────────────────
const KINESIO_SCHEMA = {
  id: 'kinesio_charlotte', name: 'Kinésiologie', specialty: 'Kinésiologie',
  version: '1.1.0', isNative: true, hideGlobalMotif: true,
  sections: [
    { id: 'contexte_rdv', title: 'Contexte du rendez-vous', fields: [
      { id: 'objetRdv', type: 'richtext', label: 'Objet du rendez-vous', width: 'full' },
      { id: 'contexteFamilial', type: 'richtext', label: 'Situation familiale', width: 'half' },
      { id: 'contexteProfessionnel', type: 'richtext', label: 'Situation professionnelle', width: 'half' },
      { id: 'suiviMedical', type: 'richtext', label: 'Suivi médical en cours', width: 'full' },
    ]},
    { id: 'signes_psycho_physiques', title: 'Signes psychologiques et physiques', fields: [
      { id: 'stressScore', type: 'rating', label: 'Stress et anxiété', min: 1, max: 5, width: 'third' },
      { id: 'qualiteSommeil', type: 'radio', label: 'Qualité du sommeil', options: ['Très mauvaise','Mauvaise','Perturbée','Correcte','Bonne'], width: 'half' },
      { id: 'sommeil', type: 'richtext', label: 'Sommeil — détail', width: 'full' },
      { id: 'emotions', type: 'richtext', label: 'Émotions présentes', width: 'half' },
      { id: 'visionAvenir', type: 'richtext', label: 'Vision de l\'avenir', width: 'half' },
    ]},
    { id: 'motivation_objectifs', title: 'Motivation & Objectifs', fields: [
      { id: 'motivationAide', type: 'richtext', label: 'Motivation principale', width: 'full' },
      { id: 'objectifsPrincipaux', type: 'richtext', label: 'Objectifs principaux', width: 'half' },
      { id: 'indicateursReussite', type: 'richtext', label: 'Indicateurs de réussite', width: 'half' },
    ]},
    { id: 'equilibrage_effectue', title: 'Équilibrage effectué', fields: [
      { id: 'techniquesEquilibrage', type: 'checkboxgroup', label: 'Techniques d\'équilibrage', options: ['Test musculaire','Points neuro-lymphatiques','Points neuro-vasculaires','Respiration consciente','Mouvements oculaires','Acupression','Ancrage / enracinement','Visualisation','Affirmation positive','Libération émotionnelle','Mouvement intégrateur','Intégration neurologique','Autre'], width: 'full' },
      { id: 'derouléSeance', type: 'richtext', label: 'Déroulé et observations', width: 'full' },
      { id: 'resultatPercu', type: 'radio', label: 'Ressenti global', options: ['Très positif','Positif','Neutre','Émotionnel(le)','Fatigué(e)','À surveiller'], width: 'half' },
      { id: 'stressApres', type: 'rating', label: 'Niveau de stress en fin de séance', min: 0, max: 10, width: 'third' },
    ]},
    { id: 'suivi_anamnese', title: 'Suivi & Anamnèse', fields: [
      { id: 'bilanSeance', type: 'richtext', label: 'Bilan de la séance', width: 'full' },
      { id: 'conseilsEntreSeances', type: 'richtext', label: 'Conseils entre les séances', width: 'half' },
      { id: 'axesTravailProchain', type: 'richtext', label: 'Axes pour la prochaine séance', width: 'half' },
      { id: 'frequencePreconisee', type: 'select', label: 'Fréquence préconisée', options: ['2 fois par semaine','1 fois par semaine','Toutes les 2 semaines','1 fois par mois','À la demande','Fin de suivi'], width: 'half' },
      { id: 'anamnèseProchainRdv', type: 'richtext', label: 'Points pour le prochain RDV', width: 'half' },
    ]},
  ],
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT 1 — LEBLANC Marc
// ═══════════════════════════════════════════════════════════════════════════════
console.log('👤 LEBLANC Marc...')
const leblancId = upsertPatient({
  last_name: 'LEBLANC', first_name: 'Marc',
  birth_date: '1963-11-08', phone: '06 34 56 78 90', email: '',
  address: '8 impasse des Lilas, 13008 Marseille',
  profession: 'Retraité (ancien comptable)',
  notes_general: 'Patient fidèle depuis 5 ans. Ponctuel. Préfère les rendez-vous du matin. Pas d\'adresse email.',
  alerts: 'Pacemaker — éviter toute électrostimulation',
  medications: 'Bisoprolol 5 mg (matin), Amlodipine 5 mg (matin), Paracétamol 1g si douleur >6/10',
  antecedents: 'Hypertension artérielle traitée depuis 2015. Infarctus du myocarde 2019 — pose stent coronaire. Arthrose genoux bilatérale grade II (radio 2022). Hernie inguinale opérée 2010.',
  regular_doctor: 'Dr Fabre (cardiologue), Dr Renaud (médecin généraliste) — Marseille 8e',
  consent_given: 1, consent_date: D(-180), civility: 'M',
})

const leblancCount = sessionCount(leblancId)
console.log(`   Séances existantes : ${leblancCount}`)
if (leblancCount >= 8) {
  console.log('   ↩ Assez de séances — LEBLANC ignoré')
} else {

  // ── Séance 1 LEBLANC : Mode SIMPLE (formulaire sans plugin) ─────────────────
  insertSession({
    patient_id: leblancId,
    date: D(-90),
    practitioner: PRATICIEN,
    motif: '<p><strong>Arthrose genoux bilatérale</strong> — bilan initial post-infarctus. Douleurs à la montée des escaliers, gêne fonctionnelle importante. Souhaite éviter la prothèse.</p>',
    evolution_tags: '🌱 1ère consultation',
    evolution: '<p>Premier bilan complet. Patient très douloureux, EVA 7/10 à la descente des escaliers. Moral affecté par la limitation fonctionnelle. Cardiologue favorable à la prise en charge si pas d\'électrostimulation.</p>',
    traitement_notes: '<p><strong>Massage profond</strong> quadriceps et ischio-jambiers bilatéraux. Mobilisation passive rotule. Drainer les épanchements péri-articulaires. Étirements doux en fin de séance. Durée : 1h10.</p>',
    reactions: '<p>Bien supporté. Légère rougeur locale après massage profond — normal. Soulagement immédiat EVA 5/10 en fin de séance. Patient surpris de l\'amélioration rapide.</p>',
    techniques: 'massage,mobilisation,étirements,drainage lymphatique',
    conseils: '<p>Natation douce recommandée (éviter brasse pour genoux). Marche quotidienne 20 min terrain plat. Éviter position debout prolongée >30 min. Glace 15 min après effort si inflammation.</p>',
    plan: '<p>Rythme : 1 séance/3 semaines pendant 3 mois. Réévaluation fonctionnelle à 3 mois. Contact cardiologue pour autorisation exercice progressif.</p>',
    surveiller: '<p>TA à chaque séance (patient HTA). Surveiller œdème genoux. Signaler tout essoufflement inhabituel ou douleur thoracique.</p>',
    next_session_date: D(-70),
    full_data_json: JSON.stringify({
      sessionNum: 1,
      anamnese: '<p>Patient de 62 ans, retraité ancien comptable. Arthrose genoux bilatérale diagnostiquée radio 2022 (grade II). Douleur prédominante genou droit. Marche limitée à 500m. Pas de sport depuis infarctus 2019. Poids stable 82 kg. Alimentation correcte. Dort 6-7h. Stress faible depuis retraite.</p>',
      simpleContextVie: 'Retraité actif. Vit avec son épouse. Jardinage et pétanque comme loisirs. Entourage familial présent. Moral globalement bon malgré douleurs.',
      simpleTraitementsEnCours: 'Paracétamol 1g si besoin, gel Voltarène local. Bisoprolol 5mg, Amlodipine 5mg. Pas de kiné en cours.',
      simpleObjectifs: 'Reprendre la randonnée courte distance (3-5 km). Monter/descendre escaliers sans s\'appuyer. Éviter prothèse le plus longtemps possible. Reprendre la pétanque.',
      simpleNotesEntretien: 'Patient très motivé et observant. Lit les notices médicales. Demande beaucoup d\'explications. Peur de l\'opération (traumatisme infarctus). Accepte bien les conseils diététiques.',
    }),
  })
  console.log('   ✅ Séance 1 — Mode SIMPLE')

  // ── Séance 2 LEBLANC : Mode MTC COMPLET ─────────────────────────────────────
  insertSession({
    patient_id: leblancId,
    date: D(-55),
    practitioner: PRATICIEN,
    motif: '<p><strong>Arthrose genoux + lombalgies</strong> — suivi. Nouvelle plainte : insomnies et fatigue chronique. Exploration MTC.</p>',
    evolution_tags: '↗ Légère amélioration',
    evolution: '<p>Amélioration mobilité genou droit : EVA 5/10 (vs 7/10 initial). Monte les escaliers avec appui. Apparition de plaintes plus larges : fatigue profonde, sommeil non réparateur, froid aux extrémités → exploration MTC complète.</p>',
    langue: 'Pâle, légèrement gonflée, bords marqués, enduit blanc épais à la racine',
    pouls: 'Profond, lent (58 bpm), faible en position Rein (arrière)',
    constitution: 'Lymphatique',
    type_corps: 'Yong',
    teint: 'Pâle-terreux, légèrement bouffi sous les yeux',
    observation: '<p>Patient enveloppé, teint terne. Mouvements lents, prudents. Voix faible. Respiration abdominale courte. Froid aux pieds (palpation). Langue pâle induit Vide de Yang.</p>',
    diagnostic_mtc: 'Vide de Yang du Rein, stagnation de Qi du Foie, insuffisance de Sang du Cœur',
    cinq_elements: 'Eau (Rein — déficience Yang) · Bois (Foie — stagnation) · Feu (Cœur — manque Sang)',
    causes: 'Surmenage de longue durée (vie professionnelle intense 30 ans). Choc émotionnel infarctus 2019. Vieillissement naturel Jing. Alimentation froide appauvrissant Yang.',
    analyse: '<p>Le Rein Yang insuffisant ne peut plus réchauffer les membres inférieurs ni assurer l\'ancrage du Qi. La stagnation du Foie génère douleurs lombaires et insomnies (Shen perturbé par Qi bloqué). Le Cœur-Feu s\'affaiblit faute de Sang nourricier.</p>',
    principes: 'Tonifier Yang du Rein · Nourrir Jing · Dénouer Qi du Foie · Pacifier Shen · Réchauffer méridiens Biao-Li',
    points: 'BL23 (Shenshu) · BL52 (Zhishi) · GV4 (Mingmen) · KD3 (Taixi) · KD7 (Fuliu) · SP6 (Sanyinjiao) · ST36 (Zusanli) · LR3 (Taichong) · HT7 (Shenmen) · PC6 (Neiguan)',
    pts_oreille: 'Rein · Shen Men · Colonne lombaire · Cœur · Shen',
    techniques: 'Acupuncture · Moxibustion directe BL23 et GV4 · Ventouses chaudes dos lombaire · Tui Na doux',
    plantes: 'You Gui Wan — 8 pilules 2x/jour (tonifie Yang Rein) · Suan Zao Ren Tang décoction le soir (pacifie Shen, favorise sommeil)',
    reactions: '<p>Sensation de chaleur diffuse dans le bas du dos pendant la moxibustion (bon signe). Légère somnolence post-séance. Patient endormi 10 min pendant traitement. EVA lombaire 4/10 en fin de séance.</p>',
    traitement_notes: '<p>Moxibustion à la règle sur BL23-BL52 bilatéraux (10 min). Aiguilles laissées 25 min. Ventouses chaudes statiques L2-L5 (10 min). Massage Tui Na reins et épaules en fin de séance.</p>',
    conseils: '<p>Continuer You Gui Wan matin et soir avec eau chaude. Ajouter congee riz-gingembre-noix 3x/sem. Éviter aliments froids/crus. Tisane cannelle-gingembre le soir. Coucher avant 23h.</p>',
    plan: '<p>Prochaine séance dans 3 semaines. Réévaluation sommeil et froid extrémités. Si amélioration → continuer protocole. Si stagnation → ajouter moxa point Mingmen quotidien à domicile.</p>',
    surveiller: '<p>TA à chaque séance. Surveiller interaction médicaments/plantes (bisoprolol). Plantes MTC à signaler au cardiologue.</p>',
    next_session_date: D(-35),
    energy_tests_json: ENERGY_TESTS,
    systemes_json: SYSTEMES_LEBLANC,
    full_data_json: JSON.stringify({
      sessionNum: 3,
      anamnese: '<p>Retour sur antécédents complets : cardiopathie ischémique 2019 (stent LAD), HTA depuis 2015 bien contrôlée. Arthrose genoux grade II bilatérale. Nouveau motif : <strong>insomnies 3x/semaine</strong> et fatigue profonde depuis 6 mois. Poids 82 kg stable. Appétit conservé mais digestion lente. Urine nocturne 2x. Selles normales.</p>',
      langueNote: 'Enduit blanc épais à la racine — Froid Humide Rein. Bords dentés — Vide Rate-Foie. Corps pâle — Vide Sang.',
      poulsNote: 'Profond en général → énergie en retrait. Faible en Rein → vide Yang. Légèrement tendu Foie → stagnation Qi. Lent → Froid.',
      poulsPos: {
        droitAvant:   'Faible (Poumon)',
        droitMilieu:  'Normal (Rate)',
        droitArriere: 'Profond/Faible (Rein Yang)',
        gaucheAvant:  'Tendu (Foie)',
        gaucheMilieu: 'Faible (Cœur)',
        gaucheArriere:'Profond (Rein Yin)',
      },
      barrageNiv1: '<p>Arnica montana 9CH — 5 granules 3x/jour (trauma osseux). Rhus toxicodendron 15CH — 5 granules matin/soir (raideur améliorée par mouvement).</p>',
      barrageNiv2: '<p>Calcarea carbonica 30CH — 1 dose unique semaine 1 (terrain lymphatique, froid, surpoids modéré, peur). Phosphoricum acidum 9CH 3x/jour (épuisement mental post-infarctus).</p>',
      barrageNiv3: '<p>Soutien constitutionnel : Natrum muriaticum 200CH (1 dose/mois) pour le deuil du corps d\'avant l\'infarctus. Patient garde beaucoup en lui.</p>',
      barrageNiv4: '<p>Terrain profond : Carcinosinum 1M — évaluation à 2 mois si les niveaux précédents insuffisants. À prescrire par homéopathe si redirection.</p>',
      nextSession: D(-35),
      nextSessionHeure: '09:00',
      nextSessionFin: '10:30',
      nextSessionNote: 'Réévaluer sommeil et froid extrémités. Apporter bilan cardio récent.',
      pluginId: 'mtc_jp',
      pluginIsBuiltin: true,
    }),
  })
  console.log('   ✅ Séance 2 — Mode MTC COMPLET')

  // ── Séance 3 LEBLANC : Mode KINÉSIOLOGIE ────────────────────────────────────
  insertSession({
    patient_id: leblancId,
    date: D(-20),
    practitioner: PRATICIEN,
    motif: null,
    evolution_tags: '✨ Bien',
    evolution: '<p>Amélioration notable du sommeil depuis 2 semaines. EVA lombaire 3/10. Genoux : monte les escaliers sans s\'appuyer. Patient surpris et confiant.</p>',
    next_session_date: D(14),
    full_data_json: JSON.stringify({
      sessionNum: 4,
      pluginId: 'kinesio_charlotte',
      pluginIsBuiltin: false,
      pluginData: {
        objetRdv: '<p>Séance kinésiologie complémentaire. M. LEBLANC souhaite travailler sur la <strong>peur récurrente de mourir</strong> depuis son infarctus 2019. Malgré amélioration physique, ce blocage émotionnel persiste et génère des insomnies.</p>',
        contexteFamilial: '<p>Marié depuis 35 ans, 2 enfants adultes, 3 petits-enfants. Relation épouse solide et soutien fort. Bonne relation enfants. Cercle d\'amis stable (pétanque, anciens collègues). Pas d\'événement familial stressant récent.</p>',
        contexteProfessionnel: '<p>Retraité depuis 4 ans (ex-chef comptable PME). Pas de stress professionnel actuel. Gère les finances de l\'association de pétanque du quartier — source de satisfaction et de lien social. Occupe bien son temps.</p>',
        suiviMedical: '<p>Cardiologue Dr Fabre : suivi semestriel, stable. Bisoprolol 5mg + Amlodipine 5mg bien tolérés. Pas de nouveau traitement. Dermatologue : RAS. Ophtalmo : légère cataracte surveillance annuelle.</p>',
        stressScore: 3,
        qualiteSommeil: 'Perturbée',
        sommeil: '<p>Endormissement facile (22h30). Réveil vers 3h-4h du matin avec pensées autour de la mort et de l\'infarctus. Rendormissement difficile (1h). Fatigue légère au lever mais acceptable. Amélioration depuis acupuncture (avant : 5-6 réveils/semaine → maintenant 2-3).</p>',
        emotions: '<p>Peur de mourir subitement (traumatisme infarctus persistant). Peur de laisser son épouse seule. Culpabilité de ne plus pouvoir "tout faire". Mais aussi : gratitude pour guérison, fierté de ses progrès physiques, joie des petits-enfants.</p>',
        visionAvenir: '<p>Ambivalent : espère vivre encore 20 ans et voir grandir ses petits-enfants, mais doute de son corps. "Mon corps m\'a trahi une fois, il peut le faire encore." Travail thérapeutique à faire sur confiance corporelle.</p>',
        motivationAide: '<p>Sa fille, psychologue, lui a conseillé la kinésiologie pour travailler le trauma émotionnel de l\'infarctus que les médecins ne traitent pas. Première expérience de thérapie non conventionnelle — ouvert mais prudent.</p>',
        objectifsPrincipaux: '<p>Arrêter les réveils nocturnes liés à la peur. Retrouver confiance en son corps. Pouvoir penser à l\'avenir sans anxiété. Reprendre la randonnée sans appréhension cardiaque.</p>',
        indicateursReussite: '<p>Dormir 7h sans réveil 5 nuits/7. Pouvoir planifier des vacances sans panique. Ne plus vérifier son pouls compulsivement. Raconter l\'infarctus sans charge émotionnelle forte.</p>',
        techniquesEquilibrage: ['Test musculaire', 'Points neuro-vasculaires', 'Respiration consciente', 'Ancrage / enracinement', 'Libération émotionnelle', 'Visualisation'],
        derouléSeance: '<p>Test musculaire initial : blocage fort sur "Je fais confiance à mon corps". Travail sur point émotionnel NV frontal (péricarde). Respiration 4-7-8 apprise et pratiquée 3 cycles. Ancrage debout pieds nus (connexion Terre). Visualisation : son cœur fort, battant régulièrement, entouré de lumière verte. Libération émotionnelle sur la peur de la mort : larmes brèves, puis soulagement. Fin de séance : test "Je fais confiance à mon corps" → fort. Résultat excellent.</p>',
        resultatPercu: 'Très positif',
        stressApres: 2,
        bilanSeance: '<p>Très belle séance. Blocage majeur levé sur la confiance corporelle. Patient en larmes brèves lors de la libération — signe d\'intégration réelle. Ressort léger, souriant, dit "je me sens moi-même pour la première fois depuis 2019". À consolider.</p>',
        conseilsEntreSeances: '<p>Pratiquer respiration 4-7-8 au réveil nocturne (au lieu de laisser les pensées s\'emballer). Tenir un mini-journal de gratitude corporelle le soir (3 choses que mon corps a bien fait aujourd\'hui). Continuer balade 20 min mais EN PLEINE CONSCIENCE (sentir ses pieds, sa respiration).</p>',
        axesTravailProchain: '<p>Consolider la nouvelle croyance "je fais confiance à mon corps". Travailler sur la culpabilité (ne plus tout faire). Explorer relation à la vieillesse et aux limites — normaliser.</p>',
        frequencePreconisee: 'Toutes les 2 semaines',
        'anamnèseProchainRdv': '<p>Demander : comment se sont passés les réveils nocturnes cette semaine ? A-t-il pratiqué la respiration 4-7-8 ? Bilan journal de gratitude. Comment se sentait-il lors de la randonnée ?</p>',
      },
      pluginSchema: KINESIO_SCHEMA,
      nextSession: D(14),
      nextSessionHeure: '10:00',
      nextSessionFin: '11:00',
      nextSessionNote: 'Consolider confiance corporelle. Bilan réveils nocturnes.',
    }),
  })
  console.log('   ✅ Séance 3 — Mode KINÉSIOLOGIE')
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT 2 — MARTIN Jean-Paul
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n👤 MARTIN Jean-Paul...')
const martinId = upsertPatient({
  last_name: 'MARTIN', first_name: 'Jean-Paul',
  birth_date: '1979-03-15', phone: '06 12 34 56 78', email: 'jp.martin@email.fr',
  address: '12 rue des Érables, 75015 Paris',
  profession: 'Directeur commercial (cadre supérieur)',
  notes_general: 'Patient ponctuel, exigeant mais ouvert. Préfère les rendez-vous tôt le matin avant 9h. Très informé médicalement — aime comprendre le raisonnement.',
  alerts: 'Allergie à l\'aspirine et aux AINS (asthme à l\'aspirine) — contre-indiqués absolus',
  medications: 'Paracétamol 1g si besoin (max 3g/jour). Oméprazole 20mg (reflux). Pas de traitement chronique.',
  antecedents: 'Hernie discale L4-L5 diagnostiquée IRM 2020 (contact radiculaire S1 droit). Lombalgies chroniques depuis 2018. Asthme à l\'aspirine (découvert 2015). Appendicectomie 2005.',
  regular_doctor: 'Dr Lefebvre (médecin généraliste Paris 15e). Dr Marchand (rhumatologue, suivi lombalgies).',
  consent_given: 1, consent_date: D(-45), civility: 'M',
})

const martinCount = sessionCount(martinId)
console.log(`   Séances existantes : ${martinCount}`)
if (martinCount >= 8) {
  console.log('   ↩ Assez de séances — MARTIN ignoré')
} else {

  // ── Séance 1 MARTIN : Mode MTC COMPLET ──────────────────────────────────────
  insertSession({
    patient_id: martinId,
    date: D(-75),
    practitioner: PRATICIEN,
    motif: '<p><strong>Lombalgies chroniques L4-L5</strong> avec irradiation sciatique S1 droite — bilan MTC initial. Douleur EVA 7/10 en flexion antérieure. Patient sous paracétamol 3g/jour sans effet suffisant.</p>',
    evolution_tags: '🌱 1ère consultation',
    evolution: '<p>Première séance. Patient en hypercontracture lombaire. Antalgique maximal insuffisant. Stress professionnel identifié comme facteur aggravant majeur. Bonne compréhension du modèle MTC.</p>',
    langue: 'Légèrement violacée sur les bords, enduit jaune fin au centre, pointe rouge',
    pouls: 'Rapide (78 bpm), tendu (fil de luth), légèrement glissant en position Rate',
    constitution: 'Nerveuse-biliaire',
    type_corps: 'Jue',
    teint: 'Rougeaud, légèrement tendu, traits tirés',
    observation: '<p>Patient de morphologie nerveuse, musculature développée. Mouvements brusques, parle vite. Contractures trapèzes +++ palpation. Posture antalgique légèrement penchée à droite. Tension visible mâchoires (bruxisme suspecté). Points tendres BL23-BL25 très douloureux.</p>',
    diagnostic_mtc: 'Stagnation de Qi et de Xue au méridien Vessie, Feu du Foie montant, début Vide de Yin du Rein',
    cinq_elements: 'Bois (Foie — excès/stagnation) · Eau (Rein — Yin commençant à se vider) · Métal (Poumon secondaire)',
    causes: 'Stress chronique intense (Foie stagnant → douleur). Surmenage intellectuel (Rein sollicité). Posture professionnelle (sédentarité bureau). Émotion non exprimée (colère rentrée — Foie).',
    analyse: '<p>La stagnation de Qi du Foie par stress chronique empêche la libre circulation dans le Jiao Inférieur. La stagnation génère de la Chaleur (Feu Foie montant → teint rougeaud, pouls tendu-rapide). La sciatique S1 droite suit le trajet du méridien Vessie-Rein. Le Rein commence à se vider (Yin) sous l\'effet de la Chaleur.</p>',
    principes: 'Dénouer Qi du Foie et disperser la Chaleur · Activer circulation Xue méridien Vessie · Tonifier Rein Yin · Détendre les contractures musculaires',
    points: 'BL23 (Shenshu) · BL25 (Dachangshu) · BL40 (Weizhong) · BL57 (Chengshan) · GB30 (Huantiao) · LR3 (Taichong) · KD3 (Taixi) · GV14 (Dazhui) · SP6 (Sanyinjiao)',
    pts_oreille: 'Colonne lombaire · Sciatique · Shen Men · Foie · Rein · Sympathique',
    techniques: 'Acupuncture (dispersion Foie, tonification Rein) · Ventouses glissantes méridien Vessie · Tui Na profond contractures lombaires',
    plantes: 'Du Huo Ji Sheng Wan — 8 pilules 3x/jour (lombalgies/sciatique) · Long Dan Xie Gan Tang 5 jours (Feu Foie)',
    reactions: '<p>Vive réaction sur BL40 — "décharge électrique" dans la jambe (trajet sciatique) = bon signe de débloquage. Détente progressive perceptible après 10 min. Patient endormi 5 min. Douleur EVA 4/10 post-séance. Très satisfait.</p>',
    traitement_notes: '<p>Aiguilles 25 min (dispersion Foie/Chaleur, tonification Rein Yin). Ventouses glissantes (huile chauffante) sur méridien Vessie : BL11→BL50, 3 passages. Tui Na contractures L2-S1 (20 min). Étirements psoas et pyramidal droits. Total : 1h30.</p>',
    conseils: '<p>Commencer Du Huo Ji Sheng Wan ce soir. Long Dan Xie Gan Tang 5 jours uniquement. Marche 15 min/jour. Position assise : coussin lombaire, écran yeux. Bannir position debout prolongée. Réduire café (aggrave Feu Foie). Coucher 23h max.</p>',
    plan: '<p>3 séances rapprochées (J0, J10, J21) puis espacement selon réponse. Objectif : sortir de la phase aiguë en 6 semaines. Maintenir paracétamol si besoin mais viser réduction. Rhumatologue maintenu en parallèle.</p>',
    surveiller: '<p>Allergie aspirine — pas d\'AINS même topiques. Surveiller diarrhée (Long Dan Xie Gan Tang peut acidifier). En cas d\'aggravation sciatique → IRM contrôle avec rhumatologue.</p>',
    next_session_date: D(-65),
    energy_tests_json: ENERGY_TESTS,
    systemes_json: SYSTEMES_MARTIN,
    full_data_json: JSON.stringify({
      sessionNum: 1,
      anamnese: '<p>Bilan complet. Douleur lombaire depuis 2018, aggravation progressive. IRM 2020 : hernie L4-L5 contact radiculaire S1 droit. Douleur irradie cuisse postérieure droite et mollet. Paresthésies pied droit (orteil 1-2 engourdis). <strong>EVA repos 5/10, effort 8/10, flexion 7/10.</strong> Travail bureau 10h/jour, déplacements fréquents. Stress majeur : restructuration entreprise, pression résultats. Sommeil : 6h maxi (endormissement facile, réveils tôt 5h stress). Tabac : arrêt 2020. Alcool : modéré (verre de vin repas).</p>',
      langueNote: 'Bords violets → stagnation Xue-Qi (Foie bloqué). Pointe rouge → Feu montant Cœur-Foie. Enduit jaune → Chaleur Rate-Estomac (digestif perturbé par stress).',
      poulsNote: 'Tendu (fil de luth) → stagnation Foie, douleur, stress. Rapide → Chaleur. Glissant Rate → Humidité naissante (digestion lente). Légèrement en flottement Poumon → Qi déficient.',
      poulsPos: {
        droitAvant:   'Faible/flottant (Poumon-Qi)',
        droitMilieu:  'Glissant (Rate-Humidité)',
        droitArriere: 'Normal-tendu (Rein)',
        gaucheAvant:  'Tendu/rapide (Foie-stagnation)',
        gaucheMilieu: 'Tendu (Cœur-Feu)',
        gaucheArriere:'Normal (Rein Yin conservé)',
      },
      barrageNiv1: '<p>Arnica 15CH — 5 granules 3x/jour (trauma musculaire chronique). Colocynthis 9CH — à la douleur (sciatique, douleur en boule améliorée par pression).</p>',
      barrageNiv2: '<p>Nux vomica 15CH — matin (terrain hypertonique, coléreux, abus intellectuel, café, surmenage). Staphysagria 9CH — si douleur post-frustration/humiliation professionnelle.</p>',
      barrageNiv3: '<p>Lycopodium 200CH — 1 dose fin de mois (doute de soi masqué par arrogance, peur responsabilités, hépatique-digestif). Constitution Lycopodium classique.</p>',
      barrageNiv4: '',
      nextSession: D(-65),
      nextSessionHeure: '07:30',
      nextSessionFin: '09:00',
      nextSessionNote: 'Réévaluer EVA sciatique. Apporter résultats prise sang récente.',
      pluginId: 'mtc_jp',
      pluginIsBuiltin: true,
    }),
  })
  console.log('   ✅ Séance 1 — Mode MTC COMPLET')

  // ── Séance 2 MARTIN : Mode SIMPLE ───────────────────────────────────────────
  insertSession({
    patient_id: martinId,
    date: D(-40),
    practitioner: PRATICIEN,
    motif: '<p><strong>Lombalgies — suivi J+35</strong>. Amélioration sciatique. Nouveau motif : <strong>cervicalgies et céphalées tensionnelles</strong> apparus depuis déménagement de bureau (nouveau poste de travail mal configuré).</p>',
    evolution_tags: '↗ Amélioration',
    evolution: '<p>Nette amélioration lombaire : EVA repos 2/10, effort 5/10. Sciatique : paresthésies orteil 1-2 disparues. Dort mieux (6h30 → 7h). Nouvelle plainte : douleurs cervicales C4-C7, céphalées de tension occipitale, irradiation temporale gauche. Lien ergonomie bureau identifié.</p>',
    traitement_notes: '<p>Massage profond trapèzes, angulaire omoplate, sternocléidomastoïdien. Mobilisation cervicale (techniques NEP). Étirements contractures C4-C7. Reprise points BL23 légers. Ventouses statiques épaules. Durée : 1h.</p>',
    reactions: '<p>Craquement spontané C5-C6 lors mobilisation — soulagé immédiatement. Céphalée diminuée EVA 2/10 → 0 en fin de séance. Patient très soulagé. "Magique !"</p>',
    techniques: 'massage,mobilisation cervicale,ventouses,étirements,acupuncture ponctuelle',
    conseils: '<p>Régler poste de travail : écran yeux ≥ 60cm, sommet écran hauteur yeux, clavier avant-bras à l\'horizontale. Pause 5 min / heure (regarder loin). Exercices rotation cervicale douce matin. Continuer Du Huo Ji Sheng Wan mais réduire à 2x/jour (amélioration lombaire).</p>',
    plan: '<p>Séance dans 3 semaines si pas de rechute. Objectif fin de suivi intensif : EVA lombaire ≤ 2/10 stable, cervicales libres. Transition vers suivi mensuel d\'entretien.</p>',
    surveiller: '<p>Si maux de tête > 3/10 persistants : évaluer tension artérielle. Consulter ophtalmologue si céphalées avec troubles visuels.</p>',
    next_session_date: D(-18),
    full_data_json: JSON.stringify({
      sessionNum: 3,
      anamnese: '<p>Suivi lombalgies : nette amélioration. Arrêt Du Huo Ji Sheng Wan depuis 5 jours (initiative patient — pense qu\'il n\'en a plus besoin). <strong>Nouveau déménagement bureau</strong> il y a 3 semaines : open space, écran surélevé, souris à droite trop loin. Depuis : cervicalgies bilatérales +++, céphalées quotidiennes 16h-20h EVA 4-5/10. Sommeil légèrement perturbé par les douleurs cervicales nocturnes (position).</p>',
      simpleContextVie: 'Contexte professionnel : restructuration terminée, pression redescendue. Vit avec compagne, pas d\'enfants. Week-ends actifs (running 2x/sem, remise en forme).',
      simpleTraitementsEnCours: 'Paracétamol réduit à 1g/jour si besoin. Oméprazole 20mg continu. Du Huo Ji Sheng Wan arrêté (à reprendre selon conseil).',
      simpleObjectifs: 'Libérer les cervicales et arrêter les céphalées tensionnelles. Maintenir l\'amélioration lombaire. Reprendre le running sans douleur (arrêt depuis 2 semaines).',
      simpleNotesEntretien: 'Patient très satisfait de l\'évolution lombaire. Curieux des techniques MTC. Pose des questions précises sur la physiologie des méridiens. Apprécie les explications. Envisage de recommander à sa DRH.',
    }),
  })
  console.log('   ✅ Séance 2 — Mode SIMPLE')

  // ── Séance 3 MARTIN : Mode KINÉSIOLOGIE ─────────────────────────────────────
  insertSession({
    patient_id: martinId,
    date: D(-8),
    practitioner: PRATICIEN,
    motif: null,
    evolution_tags: '✨ Excellent',
    evolution: '<p>Lombaires : EVA 1/10 au repos, 3/10 à l\'effort. Reprend le running (5 km sans douleur). Cervicales : libres. Plus de céphalées depuis 10 jours. Vient pour séance de fond — travail sur le <strong>stress professionnel chronique</strong>.</p>',
    next_session_date: D(21),
    full_data_json: JSON.stringify({
      sessionNum: 4,
      pluginId: 'kinesio_charlotte',
      pluginIsBuiltin: false,
      pluginData: {
        objetRdv: '<p>Séance kinésiologie — travail de fond sur le <strong>stress chronique</strong> et la <strong>pression de performance</strong> qui entretiennent les douleurs musculaires (mécanisme psychosomatique identifié). Patient désormais convaincu du lien corps-esprit après les résultats des séances MTC.</p>',
        contexteFamilial: '<p>En couple depuis 8 ans (compagne enseignante, stable). Pas d\'enfants — sujet "non décidé" selon lui, question parfois source de tensions légères. Famille d\'origine : père chef d\'entreprise exigeant, relation ambivalente. Très peu de contacts. Bonne relation avec sa sœur cadette.</p>',
        contexteProfessionnel: '<p>Directeur commercial 12 ans dans même groupe. Équipe de 25 personnes. Pression résultats trimestriels intense. Restructuration terminée mais culture de performance inchangée. CODIR mensuel stressant. Travaille en moyenne 55h/semaine. Pas de vacances > 5 jours depuis 3 ans.</p>',
        suiviMedical: '<p>Rhumatologue Dr Marchand : bonne évolution, pas de chirurgie envisagée. Médecin généraliste : RAS, tension normale. MTC en cours avec Jean-Pierre TIMONER : amélioration remarquable. Pas de suivi psy/psy ni thérapie antérieure.</p>',
        stressScore: 5,
        qualiteSommeil: 'Correcte',
        sommeil: '<p>Endormissement 23h. Réveil rare (1-2x/semaine). Qualité améliorée depuis 3 semaines. Rêves intenses avant les CODIR (réunions de direction). Se lève à 6h sans réveil. Récupération bonne le week-end (dort 8h).</p>',
        emotions: '<p>Émotions dominantes : pression auto-imposée, perfectionnisme, peur de l\'échec professionnel (intense), fierté des résultats obtenus, colère rentrée face aux décisions d\'entreprise jugées injustes. Rarement en colère ouvertement — digère tout intérieurement.</p>',
        visionAvenir: '<p>Ambitieux mais commence à questionner le "pour quoi". Envisage un poste moins exposé dans 3-5 ans. Rêve de créer une petite structure conseil plus humaine. Peur de "décevoir" en ralentissant. Prend conscience que sa valeur n\'est pas que dans sa performance.</p>',
        motivationAide: '<p>Les douleurs physiques ont été le signal d\'alarme. "Mon corps m\'a forcé à m\'arrêter là où ma tête ne voulait pas." Veut comprendre et traiter la source plutôt que les symptômes. Très motivé par la démarche depuis que les résultats MTC l\'ont convaincu.</p>',
        objectifsPrincipaux: '<p>Déconstruire l\'équation "valeur = performance". Apprendre à décompresser sans l\'alcool (1-2 verres/soir en semaine de stress). Établir des limites professionnelles saines. Réduire temps travail à 45h sans culpabilité. Reprendre les vacances.</p>',
        indicateursReussite: '<p>Quitter le bureau à 18h30 au moins 3 jours/semaine sans se sentir coupable. Prendre 10 jours de vacances cet été. Ne plus vérifier ses emails après 21h. Avoir envie de faire autre chose que travailler le dimanche.</p>',
        techniquesEquilibrage: ['Test musculaire', 'Points neuro-lymphatiques', 'Points neuro-vasculaires', 'Respiration consciente', 'Mouvements oculaires', 'Affirmation positive', 'Libération émotionnelle', 'Intégration neurologique'],
        derouléSeance: '<p>Test musculaire initial : fort blocage sur "Je mérite de me reposer" et "Ma valeur ne dépend pas de mes résultats". Exploration : croyance racine identifiée → "Si je ne performe pas, je ne suis rien" (intégrée très tôt, modèle paternel). Mouvements oculaires (EMDR-like) sur souvenir fondateur : réunion familiale à 12 ans, père le recadrant devant invités après une mauvaise note. Charge émotionnelle libérée → patient ému. Points NV frontaux pour intégration. Ancrage : visualisation de lui-même en vacances, détendu, heureux, SANS ordinateur. Affirmation : "Je suis suffisant tel que je suis." Re-test → fort. Intégration neurologique croisée (8 de l\'infini).</p>',
        resultatPercu: 'Très positif',
        stressApres: 3,
        bilanSeance: '<p>Séance de très haute qualité. Croyance limitante centrale touchée et partiellement libérée. Le travail sur la scène des 12 ans a été intense — intégration en cours. Patient sorti transformé. Dit "je savais pas que je portais ça depuis si longtemps". Travail à poursuivre sur 2-3 séances pour consolider.</p>',
        conseilsEntreSeances: '<p>Écrire dans un carnet 3 moments de la journée où il était "suffisant" sans devoir performer. Pratiquer la cohérence cardiaque 5 min matin. Ce week-end : 1 journée SANS travailler, en pleine conscience (possible ?). Réduire à 1 verre de vin max/soir.</p>',
        axesTravailProchain: '<p>Consolider la nouvelle croyance "je suis suffisant". Travailler sur la relation avec le père (ressentis non exprimés, attente de validation). Explorer la peur de la vulnérabilité. Objectifs concrets : poser 2 semaines de vacances dès cette séance.</p>',
        frequencePreconisee: '1 fois par semaine',
        'anamnèseProchainRdv': '<p>A-t-il posé ses vacances ? Comment s\'est passé le week-end sans travail ? Comment vont les douleurs physiques cette semaine ? A-t-il réduit sa consommation d\'alcool ?</p>',
      },
      pluginSchema: KINESIO_SCHEMA,
      nextSession: D(21),
      nextSessionHeure: '07:30',
      nextSessionFin: '08:30',
      nextSessionNote: 'Suivi croyances. Bilan vacances posées. Lien père.',
    }),
  })
  console.log('   ✅ Séance 3 — Mode KINÉSIOLOGIE')
}

// ── Résumé final ───────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log('✅ Données insérées avec succès !')
console.log()
console.log('📋 Ce qui a été créé :')
console.log('   • LEBLANC Marc  : 3 séances (Simple · MTC complet · Kinésiologie)')
console.log('   • MARTIN Jean-Paul : 3 séances (MTC complet · Simple · Kinésiologie)')
console.log()
console.log('⚡ Rechargez la page dans l\'application pour voir les données.')
console.log('   (Cliquez sur un autre menu puis revenez, ou F5 si la console dev est ouverte.)')
console.log()

db.close()
process.exit(0)
