/**
 * Génère pour la patiente Sophie DUPONT deux séances complètes avec le
 * NOUVEAU formulaire Kinésiologie (kinesio.plugin.json v2.0.0) :
 *   1. Première consultation — toutes les sections remplies
 *   2. Séance de suivi        — toutes les sections remplies
 *
 * But : disposer de données réalistes et complètes pour faire des
 * captures d'écran (landing page kinésiologie).
 *
 * USAGE : node scripts/seed-kinesio-sophie.cjs
 * PRÉREQUIS : l'application doit être ouverte et déverrouillée (DB décryptée).
 */

'use strict'

const path = require('path')
const fs = require('fs')
const { existsSync } = require('fs')
const { randomUUID } = require('crypto')

// ── Chemin base de données ─────────────────────────────────────────────────
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
const D = (delta) => {
  const d = new Date(); d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Schéma Kinésiologie réel (snapshot exact du plugin actif) ──────────────
const KINESIO_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'plugins', 'kinesio.plugin.json'), 'utf8')
)

// ── Helpers ──────────────────────────────────────────────────────────────
function upsertPatient({ last_name, first_name, ...rest }) {
  const existing = db.prepare('SELECT id FROM patients WHERE last_name = ? AND first_name = ?').get(last_name, first_name)
  if (existing) {
    console.log(`   ↩ Patient trouvé : ${last_name} ${first_name} (${existing.id.slice(0, 8)}…)`)
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
    practitioner: null, motif: null, evolution_tags: null, evolution: null, problematiques: null,
    langue: null, pouls: null, constitution: null, type_corps: null, teint: null, observation: null,
    diagnostic_mtc: null, cinq_elements: null, causes: null, analyse: null, principes: null,
    points: null, pts_oreille: null, techniques: null, plantes: null, reactions: null, traitement_notes: null,
    conseils: null, plan: null, surveiller: null,
    energy_tests_json: null, systemes_json: null, full_data_json: null,
    next_session_date: null,
    created_at: now, updated_at: now,
    ...data,
  })
  return id
}

const PRATICIEN = 'Charlotte DECAENS'

// ═══════════════════════════════════════════════════════════════════════════
// PATIENTE — DUPONT Sophie
// ═══════════════════════════════════════════════════════════════════════════
console.log('👤 DUPONT Sophie...')
const sophieId = upsertPatient({
  last_name: 'DUPONT', first_name: 'Sophie',
  birth_date: '1987-04-12', phone: '06 45 67 89 12', email: 'sophie.dupont87@email.fr',
  address: '24 rue des Tilleuls, 44000 Nantes',
  profession: 'Responsable Ressources Humaines',
  notes_general: 'Patiente ponctuelle, réservée au premier contact puis très ouverte une fois en confiance. Orientée par une collègue déjà suivie en kinésiologie.',
  alerts: '',
  medications: 'Aucun traitement chronique',
  antecedents: 'RAS notable. Gastrite légère traitée ponctuellement. Pas d\'antécédent psychiatrique.',
  regular_doctor: 'Dr Berthier (médecin généraliste, Nantes)',
  consent_given: 1, consent_date: D(-14), civility: 'Mme',
})

const count = sessionCount(sophieId)
console.log(`   Séances existantes : ${count}`)
if (count >= 4) {
  console.log('   ↩ Assez de séances — DUPONT ignorée (déjà seedée)')
} else {

  // ── Séance 1 — PREMIÈRE CONSULTATION ────────────────────────────────────
  insertSession({
    patient_id: sophieId,
    date: D(-14),
    practitioner: PRATICIEN,
    motif: null,
    evolution_tags: '🌱 1ère consultation',
    evolution: '<p>Première rencontre. Sophie se présente épuisée et anxieuse, en recherche de compréhension et d\'apaisement face à une période de surcharge professionnelle et personnelle.</p>',
    next_session_date: D(-7),
    full_data_json: JSON.stringify({
      sessionNum: 1,
      pluginId: 'kinesio_charlotte',
      pluginIsBuiltin: false,
      pluginData: {
        type_seance: 'Première consultation',

        // ── Motif de consultation ──────────────────────────────────────
        problematique_principale: 'Je n\'arrive plus à dormir correctement depuis 3 mois, je suis épuisée et j\'ai perdu confiance en moi au travail. J\'ai l\'impression de ne plus être à la hauteur alors qu\'avant j\'étais quelqu\'un de sûr de moi.',
        anciennete_problematique: 'Environ 3 mois',
        contexte_apparition: 'Depuis sa promotion au poste de responsable RH il y a 3 mois, avec une charge de travail et des responsabilités fortement augmentées sans réelle formation préalable.',
        solutions_deja_tentees: 'Médecin généraliste consulté : proposition de somnifères refusée par la patiente. Essais de méditation via une application mobile, sans résultat durable. Discussion avec une amie coach mais pas de suivi structuré.',
        pourquoi_maintenant: 'Une collègue lui a recommandé la kinésiologie après avoir constaté des résultats similaires. Sophie sent qu\'elle atteint un point de rupture, avec des crises de larmes récentes au travail.',
        attentes_seance: 'Comprendre l\'origine de ce blocage, retrouver un sommeil réparateur et une sérénité au travail.',
        benefice_disparition_probleme: 'Elle pourrait reprendre confiance en ses décisions, profiter de ses soirées en famille sans ruminer, et se sentir légitime dans son nouveau poste.',

        // ── Accueil / Observations initiales ───────────────────────────
        observations_initiales: 'Sophie arrive tendue, épaules relevées, débit de parole rapide. Regard fuyant lorsqu\'elle évoque son poste actuel. Respiration haute et courte. Se détend progressivement au fil de l\'entretien.',

        // ── Contexte personnel et familial ─────────────────────────────
        situation_conjugale: 'Marié(e) / Pacsé(e)',
        enfants_contexte: 'Deux enfants : Léa (9 ans) et Tom (6 ans). Sophie se sent coupable de moins de disponibilité pour eux depuis sa promotion.',
        nombre_freres: 1,
        nombre_soeurs: 0,
        place_fratrie: 'Aîné(e)',
        contexte_familial: 'Vit avec son conjoint et leurs deux enfants. Conjoint compréhensif mais peu présent (déplacements professionnels fréquents). Sophie porte l\'essentiel de la charge mentale familiale.',
        evenements_familiaux: 'Décès de son père il y a 2 ans, dont elle dit ne pas avoir eu le temps de faire vraiment son deuil. Sa mère vit seule et l\'appelle souvent, source de charge mentale supplémentaire.',
        contexte_professionnel: 'Responsable RH depuis 3 mois dans une entreprise de 120 salariés, suite à une promotion rapide. Équipe de 3 personnes à encadrer, dont un collaborateur senior qui conteste régulièrement ses décisions.',

        // ── Historique et hygiène de vie ────────────────────────────────
        antecedents_sante: 'RAS notable hormis une gastrite légère traitée ponctuellement. Pas d\'antécédent psychiatrique ni de traitement au long cours.',
        traitements_suivis: 'Aucun traitement médicamenteux actuel. Suivi ostéopathique ponctuel pour tensions cervicales.',
        qualite_sommeil: 'Mauvais',
        sommeil_details: 'Endormissement difficile (plus d\'une heure), réveils multiples entre 3h et 4h avec ruminations sur le travail, réveil final fatiguée et non reposée.',
        emotions_actuelles: 'Anxiété diffuse, sentiment d\'illégitimité, irritabilité envers ses enfants qu\'elle regrette ensuite, tristesse latente liée au deuil de son père.',
        vision_avenir: 'Peur de ne pas être à la hauteur sur le long terme, envisage parfois de démissionner malgré son attachement à son poste.',
        hygiene_vie: 'Activité physique quasi inexistante depuis la promotion (arrêt du yoga hebdomadaire). Alimentation irrégulière, grignotage sucré en soirée. Pas de véritable temps de récupération le week-end (rattrape le travail en retard).',

        // ── Objectif de la séance ────────────────────────────────────────
        changement_recherche: 'Retrouver un sentiment de légitimité et de calme intérieur face aux responsabilités de son nouveau poste.',
        benefice_attendu: 'Pouvoir prendre des décisions sans se sentir jugée, dormir une nuit complète, profiter de moments avec ses enfants sans culpabilité.',
        objectif_seance_texte: 'Je me sens légitime et posée dans mon rôle de responsable RH, je fais confiance à mes décisions.',
        indicateurs_reussite: 'Dormir au moins 6h consécutives, ne plus ressentir de boule au ventre avant les réunions d\'équipe, retrouver l\'envie de reprendre le yoga.',

        // ── État au début de séance ───────────────────────────────────
        cen_debut: 75,
        cep_debut: 20,

        // ── Équilibrage effectué ─────────────────────────────────────
        techniques_equilibrage: ['Touch for Health', 'Edu-K', 'Transpersonnelle'],
        deroule_seance: '<p>Test musculaire initial sur l\'objectif formulé : blocage net (indicateur faible). Exploration en Touch for Health&nbsp;: déséquilibre sur les méridiens Rate/Pancréas et Rein, cohérent avec le vécu d\'insécurité et de surcharge mentale. Travail Edu-K (mouvements croisés, points de l\'espace) pour restaurer l\'intégration des deux hémisphères et réduire le stress ressenti. Approche transpersonnelle sur la scène associée au décès de son père&nbsp;: mise en lumière d\'une croyance sous-jacente <em>« je dois être forte pour les autres, je n\'ai pas le droit de flancher »</em>, contractée à cette période. Libération émotionnelle progressive, quelques larmes, respiration qui se relâche visiblement. Re-test de l\'objectif&nbsp;: indicateur fort et stable.</p>',

        // ── Fin de séance ──────────────────────────────────────────────
        cen_fin: 25,
        cep_fin: 70,
        ressenti_fin: ['Positif', 'Apaisé', 'Émotionnel'],
        point_vigilance: 'Peut ressentir une fatigue ou une sensibilité émotionnelle accrue dans les 24 à 48h suivant la séance — l\'inviter à se reposer et à boire suffisamment d\'eau.',

        // ── Intégration & suivi ──────────────────────────────────────
        bilan_seance: 'Première séance riche en prises de conscience. Le lien entre la charge mentale actuelle et le deuil non résolu de son père a été identifié comme un axe central de travail. Sophie repart apaisée, avec une meilleure compréhension de ce qui alimente son anxiété.',
        changements_fin_seance: 'Passage d\'une charge émotionnelle négative de 75% à 25%, positive de 20% à 70%. Posture plus détendue, débit de parole ralenti, sourire retrouvé en fin de séance.',
        conseils_interseance: 'Pratiquer 5 minutes de respiration consciente chaque soir avant de dormir. Noter dans un carnet les moments de la journée où elle s\'est sentie légitime, même brièvement.',
        axes_travail: 'Poursuivre le travail sur la croyance « je dois être forte pour les autres ». Explorer la relation avec le collaborateur senior qui conteste ses décisions. Reprendre progressivement une activité physique régulière.',
        points_reevaluer: 'Qualité du sommeil sur les 3 prochaines semaines. Niveau d\'anxiété avant les réunions d\'équipe.',
        suivi_envisage: '1×/semaine',
      },
      pluginSchema: KINESIO_SCHEMA,
      nextSession: D(-7),
      nextSessionHeure: '14:00',
      nextSessionFin: '15:00',
      nextSessionNote: 'Suivi sommeil + travail sur la relation au collaborateur senior.',
    }),
  })
  console.log('   ✅ Séance 1 — PREMIÈRE CONSULTATION (Kinésiologie)')

  // ── Séance 2 — SÉANCE DE SUIVI ──────────────────────────────────────────
  insertSession({
    patient_id: sophieId,
    date: D(-7),
    practitioner: PRATICIEN,
    motif: null,
    evolution_tags: '↗ Amélioration',
    evolution: '<p>Nette amélioration du sommeil et de la sérénité générale depuis la première séance. Reprise d\'une activité physique. Persistance d\'une appréhension forte face à un collaborateur contestataire, travaillée en séance aujourd\'hui.</p>',
    next_session_date: D(0),
    full_data_json: JSON.stringify({
      sessionNum: 2,
      pluginId: 'kinesio_charlotte',
      pluginIsBuiltin: false,
      pluginData: {
        type_seance: 'Séance de suivi',

        // ── Bilan depuis la dernière séance ────────────────────────────
        suivi_periode: 'Bonne semaine dans l\'ensemble. Sophie a réussi à dormir 3 nuits sur 7 sans réveil nocturne, une nette amélioration par rapport à avant. Elle se sent globalement plus posée, même si les réunions d\'équipe restent une source de tension.',
        suivi_ameliorations: 'Sommeil amélioré (3 nuits complètes sur 7). Moins de ruminations en soirée. A repris une séance de yoga cette semaine, ce qu\'elle n\'avait pas fait depuis des mois.',
        suivi_difficultes: 'Toujours une appréhension forte avant les échanges avec son collaborateur senior qui conteste ses décisions. Sentiment de culpabilité persistant envers ses enfants les soirs où elle rentre tard.',
        suivi_evenements: 'Entretien annuel de son collaborateur senior prévu la semaine prochaine — source d\'anxiété anticipée. Sa mère a été brièvement hospitalisée pour un contrôle, sans gravité, mais cela a ravivé son inquiétude.',
        reactions_depuis_derniere_seance: ['Phase salutaire', 'Résistance au changement'],
        reactions_depuis_derniere_seance_details: 'Les 2 jours suivant la première séance, fatigue plus marquée puis sensation de légèreté inhabituelle (phase salutaire). Une résistance perceptible est apparue face à l\'idée de poser des limites avec son collaborateur — peur du conflit.',
        evolution_objectif_precedent: 'Amélioration nette',
        evolution_objectif_commentaire: 'L\'objectif « je me sens légitime et posée » est en bonne voie&nbsp;: Sophie rapporte se sentir plus légitime dans ses décisions au quotidien, sauf face à ce collaborateur en particulier.',
        priorite_du_jour: 'Travailler la confrontation avec le collaborateur senior et l\'entretien annuel à venir, source d\'anxiété anticipatoire importante.',

        // ── Objectif de la séance ────────────────────────────────────────
        changement_recherche: 'Aborder l\'entretien annuel avec son collaborateur avec sérénité et fermeté bienveillante.',
        benefice_attendu: 'Pouvoir poser un cadre clair sans se sentir illégitime ni en conflit intérieur.',
        objectif_seance_texte: 'Je peux affirmer mes décisions avec calme et bienveillance, même face à la contestation.',
        indicateurs_reussite: 'Aborder l\'entretien sans boule au ventre la veille. Se sentir alignée après l\'échange, quel qu\'en soit le résultat.',

        // ── État au début de séance ───────────────────────────────────
        cen_debut: 55,
        cep_debut: 40,

        // ── Équilibrage effectué ─────────────────────────────────────
        techniques_equilibrage: ['Touch for Health', 'Réflexes archaïques', 'Autre'],
        technique_autre: 'Travail sur les postures d\'ancrage (kinésiologie posturale)',
        deroule_seance: '<p>Reprise sur l\'objectif du jour. Le test musculaire révèle un déséquilibre associé à la peur du conflit, en lien avec un souvenir d\'enfance où exprimer un désaccord avec l\'autorité paternelle était mal accueilli. Travail sur les réflexes archaïques (réflexe de Moro) pour apaiser la réponse de sursaut et l\'anxiété anticipatoire. Ancrage postural et respiration pour renforcer la sensation de stabilité corporelle avant une prise de parole difficile. Répétition en visualisation de l\'entretien à venir avec intégration d\'une posture ancrée et d\'une respiration calme. Re-test de l\'objectif du jour&nbsp;: nette amélioration, réponse forte et stable.</p>',

        // ── Fin de séance ──────────────────────────────────────────────
        cen_fin: 15,
        cep_fin: 80,
        ressenti_fin: ['Très positif', 'Apaisé'],
        point_vigilance: 'Veiller à ne pas trop anticiper mentalement l\'entretien dans les jours qui précèdent — proposer un exercice d\'ancrage rapide en cas de montée d\'anxiété.',

        // ── Intégration & suivi ──────────────────────────────────────
        bilan_seance: 'Séance centrée sur la confrontation à venir avec son collaborateur. Travail efficace sur la peur du conflit héritée de l\'enfance. Sophie repart avec des outils concrets (ancrage, respiration) pour aborder son entretien annuel avec plus de sérénité.',
        changements_fin_seance: 'CEN 55% → 15%, CEP 40% → 80%. Posture nettement plus droite et stable en fin de séance, voix plus assurée.',
        conseils_interseance: 'Pratiquer l\'ancrage postural chaque matin de la semaine, en particulier la veille de l\'entretien. Continuer le yoga hebdomadaire repris. Poursuivre le carnet des moments de légitimité.',
        axes_travail: 'Poursuivre le travail sur la posture face à l\'autorité et à la contestation. Aborder la charge mentale familiale et la répartition avec le conjoint. Explorer le deuil du père si le sujet revient naturellement.',
        points_reevaluer: 'Déroulement de l\'entretien annuel avec le collaborateur. Stabilité du sommeil sur la durée. Ressenti de charge mentale familiale.',
        suivi_envisage: '1×/semaine',
      },
      pluginSchema: KINESIO_SCHEMA,
      nextSession: D(0),
      nextSessionHeure: '14:00',
      nextSessionFin: '15:00',
      nextSessionNote: 'Bilan entretien annuel avec le collaborateur. Charge mentale familiale.',
    }),
  })
  console.log('   ✅ Séance 2 — SÉANCE DE SUIVI (Kinésiologie)')
}

console.log('\n' + '─'.repeat(60))
console.log('✅ Données Sophie DUPONT insérées avec succès !')
console.log('⚡ Rechargez la page dans l\'application pour voir les données.')
console.log('   (Cliquez sur un autre menu puis revenez, ou F5 si la console dev est ouverte.)')
console.log()

db.close()
process.exit(0)
