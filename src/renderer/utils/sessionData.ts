import type { SystemesQuestionnaire, EnergyTests } from '../../shared/types'

export const MV_LIST = [
  { name: 'Ren Mai (RM)',     pt: '7P',   couple: '6R',    oppose: '3IG',  glande: 'Thymus',       vert: 'L5' },
  { name: 'Yin Qiao (IQM)',  pt: '6R',   couple: '7P',    oppose: '62V',  glande: 'Surrénales',   vert: 'D1' },
  { name: 'Yin Wei (IWM)',   pt: '6MC',  couple: '4Rte',  oppose: '5TR',  glande: 'Gonades',      vert: 'D4' },
  { name: 'Chong Mai (CM)',  pt: '4Rte', couple: '6MC',   oppose: '41Vb', glande: 'Hypothalamus', vert: 'D6-D7' },
  { name: 'Du Mai (DM)',     pt: '3IG',  couple: '62V',   oppose: '7P',   glande: 'Épiphyse',     vert: 'L5' },
  { name: 'Yang Qiao (YQM)',pt: '62V',  couple: '3IG',   oppose: '6R',   glande: 'Hypophyse',    vert: 'C0-C1' },
  { name: 'Yang Wei (YWM)', pt: '5TR',  couple: '41Vb',  oppose: '6MC',  glande: 'Thyroïde',     vert: 'C6' },
  { name: 'Dai Mai (DaM)',  pt: '41Vb', couple: '5TR',   oppose: '4Rte', glande: 'Pancréas',     vert: 'S4' },
]

export const RECHAUFFEURS = [
  { key: 'RS' as const, label: 'RS (26Vb) – Réchauffeur Supérieur' },
  { key: 'RM' as const, label: 'RM (27Vb) – Réchauffeur Moyen' },
  { key: 'RI' as const, label: 'RI (28Vb) – Réchauffeur Inférieur' },
]

export const FOYERS = [
  { key: 'FS' as const, label: 'FS – 17RM', point: '17RM', desc: '4GI · 9P · 7C\nD3-D4-D5 · Grand pectoral', subs: [{ key: 'Wei Qi (7P)', label: 'Wei Qi' }, { key: 'Zhong Qi (17RM)', label: 'Zhong Qi' }] },
  { key: 'FM' as const, label: 'FM – 12RM', point: '12RM', desc: '4E · 19IG · 2V · 23TR · 5Vb\nD9-D12 · SCOM · Diaphragme', subs: [{ key: 'Ying Qi (36E)', label: 'Ying Qi' }] },
  { key: 'FI' as const, label: 'FI – 7RM', point: '7RM', desc: '12Rte · 3F · 4F · 3R\nL2-S2 · Psoas-iliaque', subs: [{ key: 'Élimination (66V+10R)', label: 'Élimination' }, { key: 'Yuan Qi (4TR)', label: 'Yuan Qi' }, { key: 'Mingmen (4DM)', label: 'Mingmen' }, { key: 'Wei Qi FI (1F)', label: 'Wei Qi' }] },
]

export const POINTS_MU = [
  '3RM (V)', '4RM (IG)', '5RM (TR)', '25E (GI)', '12RM (Esto)',
  '14RM (C)', '17RM (MC)', '1P (P)', '14F (F)', '24Vb (Vb)', '13F (Rte)', '25Vb (Rn)',
]

export const SYNDROMES_BASE = ['Yang (20DM)', 'Qi (17RM)', 'Sang (17V)', 'Liquides (30E)', 'Yin (1Rn)']
export const SYNDROMES_CLIMAT = ['Vent', 'Feu / Chaleur', 'Humidité', 'Sécheresse', 'Froid']

export const PENETRATION_LEVELS = [
  { key: 'MTM', val: 'MTM – Tendino-Musculaire (Jing/puit)', cls: 'pen-mtm', label: 'MTM' },
  { key: 'MP',  val: 'Méridien Principal (Ying)',             cls: 'pen-mp',  label: 'Méridien Principal' },
  { key: 'MD',  val: 'Méridien Distinct (Hé +)',              cls: 'pen-md',  label: 'Méridien Distinct' },
  { key: 'BP',  val: 'Branche Profonde (Yuan −)',             cls: 'pen-bp',  label: 'Branche Profonde' },
]

export function defaultSystemes(): SystemesQuestionnaire {
  const base = () => ({ checked: [] as string[], note: '' })
  return {
    cardio:       base(),
    pulmo:        base(),
    mental:       { ...base(), stress: 0, anxiete: 0 },
    vision:       base(),
    reins:        base(),
    rate:         { ...base(), energie: 0, regimeAlimentaire: '' },
    estomac:      base(),
    grosIntestin: base(),
    peau:         { ...base(), emplacementAcne: '', emplacementEczema: '' },
    tete:         base(),
    temp:         base(),
    musculo:      { ...base(), douleur: 0, localisation: '' },
    feminin: {
      ...base(),
      ageMenarche: '', jourCycle: '', longueurCycle: '',
      dureeMin: '', dureeMax: '', couleurSang: '', ecoulement: '',
      caillots: [], crampes: [], spm: [],
    },
    fertilite: {
      ...base(),
      essaiConception: '', testsSanguins: '', resultatTests: '',
      diagnosticFertilite: [], debutMenopause: '',
      enceinte: false, nbSemaines: '', cesarienne: false, datePrevue: '', enfants: false,
    },
    masculin: base(),
  }
}

/** Migration : convertit l'ancien format (digestif, etc.) vers le nouveau */
export function migrateSystemes(raw: any): SystemesQuestionnaire {
  const defaults = defaultSystemes()
  if (!raw || typeof raw !== 'object') return defaults

  const merged: any = { ...defaults }

  // Clés directement compatibles
  const compatKeys: (keyof SystemesQuestionnaire)[] = [
    'cardio', 'pulmo', 'mental', 'vision', 'reins',
    'rate', 'estomac', 'grosIntestin', 'peau', 'tete',
    'temp', 'musculo', 'feminin', 'fertilite', 'masculin',
  ]
  for (const k of compatKeys) {
    if (raw[k]) merged[k] = { ...(defaults[k] as any), ...raw[k] }
  }

  // Ancien clé digestif → rate (on récupère energie + regimeAlimentaire)
  if (raw.digestif && !raw.rate) {
    merged.rate = {
      ...defaults.rate,
      energie: raw.digestif.energie ?? 0,
      regimeAlimentaire: raw.digestif.note ?? '',
      checked: [],
      note: '',
    }
  }

  // Ancien feminin : cycle → jourCycle + longueurCycle
  if (raw.feminin) {
    const f = raw.feminin
    merged.feminin = {
      ...defaults.feminin, ...f,
      jourCycle:    f.jourCycle    ?? f.cycle ?? '',
      longueurCycle: f.longueurCycle ?? '',
      caillots:     Array.isArray(f.caillots) ? f.caillots : [],
      crampes:      Array.isArray(f.crampes)  ? f.crampes  : [],
      spm:          Array.isArray(f.spm)      ? f.spm      : [],
    }
  }

  return merged as SystemesQuestionnaire
}

export function defaultEnergyTests(): EnergyTests {
  return {
    rechauffeurs: RECHAUFFEURS.map(r => ({ key: r.key, label: r.label, active: false, polarite: '' as const })),
    foyers: FOYERS.map(f => ({ key: f.key, label: f.label, point: f.point, active: false, subs: [] })),
    merveilleuxVaisseaux: MV_LIST.map(mv => ({ ...mv, fonctionExterne: false, axeDistribution: false, fonctionInterne: false, note: '' })),
    pointsMu: [],
    empereur: '',
    empereurPolarite: '' as const,
    syndrome: [],
    syndromeClimat: [],
    energieComp: { biaoli: '', midiMinuit: '', gmMeridien: '', gmType: [], gmNotes: '', cinqMouvements: [], element: '', notes: '' },
    penetrationEmp: [],
    penetrationComp: [],
    testsNotes: '',
  }
}
