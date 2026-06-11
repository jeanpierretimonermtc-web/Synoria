// ─── PATIENT ──────────────────────────────────────────────────────────────────
export interface AccessLog {
  id: string
  patient_id?: string
  action: string    // 'fiche_ouverte' | 'séance_consultée' | 'séance_créée' | 'données_exportées'
  detail?: string
  timestamp: string
}

export interface Patient {
  id: string
  first_name: string
  last_name: string
  birth_date?: string
  phone?: string
  email?: string
  address?: string
  profession?: string
  notes_general?: string
  alerts?: string
  regular_doctor?: string
  medications?: string
  antecedents?: string
  is_active?: number     // 1 = actif (défaut), 0 = archivé
  consent_given?: number // 1 = consentement donné, 0 = non
  consent_date?: string  // date ISO du consentement
  created_at: string
  updated_at: string
}

// ─── APPOINTMENT (RDV) ────────────────────────────────────────────────────────
export interface Appointment {
  id: string
  patient_id?: string
  date: string            // YYYY-MM-DD
  heure_debut: string     // HH:MM
  heure_fin?: string      // HH:MM
  note?: string           // motif de visite
  is_done: number         // 0 = planifié, 1 = réalisé
  is_cancelled?: number   // 1 = annulé
  guest_last_name?: string   // nom si nouveau patient non encore dans la base
  guest_first_name?: string  // prénom
  guest_phone?: string       // téléphone
  google_event_id?: string | null  // ID événement Google Calendar (v9)
  created_at: string
  updated_at: string
}

// ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────────
export interface GoogleCalendarInfo {
  connected:    boolean
  email?:       string
  calendarId?:  string
  calendarName?: string
}

export interface GCalCalendar {
  id:       string
  summary:  string
  primary?: boolean
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
export interface Session {
  id: string
  patient_id: string
  date: string
  practitioner?: string
  // Motif
  motif?: string
  // Évolution
  evolution_tags?: string
  evolution?: string
  // Problématiques
  problematiques?: string
  // Observation MTC
  langue?: string
  pouls?: string
  constitution?: string
  type_corps?: string
  teint?: string
  observation?: string
  // Analyse
  diagnostic_mtc?: string
  cinq_elements?: string
  causes?: string
  analyse?: string
  principes?: string
  // Traitement
  points?: string
  pts_oreille?: string
  techniques?: string
  plantes?: string
  reactions?: string
  traitement_notes?: string
  // Suivi
  conseils?: string
  plan?: string
  surveiller?: string
  // Tests énergétiques JSON blob
  energy_tests_json?: string
  // Questionnaire systèmes JSON blob
  systemes_json?: string
  // Full data blob
  full_data_json?: string
  // Prochain rendez-vous
  next_session_date?: string
  created_at: string
  updated_at: string
}

// ─── ENERGY TESTS ─────────────────────────────────────────────────────────────
export interface EnergyTests {
  rechauffeurs: RechauffeurData[]
  foyers: FoyerData[]
  merveilleuxVaisseaux: MVData[]
  pointsMu: string[]
  empereur: string
  empereurPolarite: '+' | '-' | ''
  syndrome: string[]
  syndromeClimat: string[]
  energieComp: EnergieCompData
  penetrationEmp: string[]
  penetrationComp: string[]
  testsNotes: string
}

export interface RechauffeurData {
  key: 'RS' | 'RM' | 'RI'
  label: string
  active: boolean
  polarite: '+' | '-' | ''
}

export interface FoyerData {
  key: 'FS' | 'FM' | 'FI'
  label: string
  point: string
  active: boolean
  subs: string[]
}

export interface MVData {
  name: string
  pt: string
  couple: string
  oppose: string
  glande: string
  fonctionExterne: boolean
  axeDistribution: boolean
  fonctionInterne: boolean
  note: string
}

export interface EnergieCompData {
  biaoli: string
  midiMinuit: string
  gmMeridien: string
  gmType: string[]
  gmNotes: string
  cinqMouvements: string[]
  element: string
  notes: string
}

// ─── SYSTÈMES ─────────────────────────────────────────────────────────────────
export interface SystemeData {
  checked: string[]
  note: string
}

export interface SystemesQuestionnaire {
  cardio:       SystemeData
  pulmo:        SystemeData
  mental:       SystemeData & { stress: number; anxiete: number }
  vision:       SystemeData
  reins:        SystemeData
  rate:         SystemeData & { energie: number; regimeAlimentaire: string }
  estomac:      SystemeData
  grosIntestin: SystemeData
  peau:         SystemeData & { emplacementAcne: string; emplacementEczema: string }
  tete:         SystemeData
  temp:         SystemeData
  musculo:      SystemeData & { douleur: number; localisation: string }
  feminin: SystemeData & {
    ageMenarche: string; jourCycle: string; longueurCycle: string
    dureeMin: string; dureeMax: string; couleurSang: string; ecoulement: string
    caillots: string[]; crampes: string[]; spm: string[]
  }
  fertilite: SystemeData & {
    essaiConception: string; testsSanguins: string; resultatTests: string
    diagnosticFertilite: string[]; debutMenopause: string
    enceinte: boolean; nbSemaines: string; cesarienne: boolean; datePrevue: string; enfants: boolean
  }
  masculin: SystemeData
}

// ─── FOLLOW-UP ────────────────────────────────────────────────────────────────
export interface FollowUpPatient {
  patient: Patient
  lastSessionDate: string | null
  daysSince: number | null
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  total_patients: number
  total_sessions: number
  sessions_this_month: number
  active_patients: number
  recent_sessions: RecentSession[]
}

export interface UpcomingSession {
  session_id: string
  patient_id: string
  first_name: string
  last_name: string
  next_session_date: string
  motif?: string
}

export interface RecentSession {
  id: string
  patient_id: string
  first_name: string
  last_name: string
  date: string
  motif?: string
  diagnostic_mtc?: string
  evolution_tags?: string
}

// ─── COMPTABILITÉ ─────────────────────────────────────────────────────────────
export interface ConsultationType {
  id: string
  name: string
  price: number
  is_active: number
  sort_order: number
}

export interface MonthlyRevenue {
  year: number
  month: number
  type_id: string
  nb_seances: number
}

export interface UrsafRate {
  year: number
  month: number
  rate: number
}

export interface ExpenseConfig {
  id: string
  category: string
  label: string
  monthly_amount: number
  is_shared: number
  sort_order: number
  months?: string | null  // "1,2,3,4" = jan-avr uniquement · null = tous les mois
}

export interface MonthlyVarExpense {
  year: number
  month: number
  category: string
  label: string
  amount: number
}

export interface InvoiceLog {
  id: string
  invoice_number: string
  invoice_date: string
  patient_first_name: string
  patient_last_name: string
  patient_address?: string
  email?: string
  phone?: string
  session_date?: string
  description?: string
  montant: number
  file_path?: string
  created_at: string
}

export interface ComptaYearData {
  consultationTypes: ConsultationType[]
  monthlyRevenue: MonthlyRevenue[]
  ursafRates: UrsafRate[]
  expenseConfig: ExpenseConfig[]
  monthlyVarExpenses: MonthlyVarExpense[]
  years: number[]
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export interface AppSettings {
  backupPatientPath: string
  backupGeneralPath: string
  autoBackupOnClose: boolean
  autoBackupDaily: boolean
  backupRetentionDays: number
  lastGeneralBackup: string | null
  lastAutoBackup: string | null
  // Facturation
  invoicePath:       string
  invoiceTvaRate:    number
  lastInvoiceNumber: number
  lastInvoiceYear:   string
  // RGPD
  rgpdPractitionerName:  string
  rgpdPractitionerEmail: string
  rgpdNotice:            string
  dataRetentionYears:    number  // durée de conservation (défaut 10 ans)
  // Profil praticien (affiché sur les factures)
  practitionerFirstName:    string
  practitionerLastName:     string
  practitionerActivity:     string
  practitionerAddress:      string
  practitionerSiret:        string
  practitionerEmail:        string
  practitionerApe:          string
  practitionerPaymentTerms: string
  practitionerLogoPath:     string
}

export interface InvoiceData {
  patientFirstName: string
  patientLastName:  string
  patientAddress?:  string
  email?:           string
  phone?:           string
  sessionDate:      string
  description:      string
  invoiceDate:      string
  montant:          number
}

export interface InvoiceResult {
  filePath:      string
  invoiceNumber: string
  montant:       number
}

export interface BackupFolderInfo {
  path: string
  accessible: boolean
  lastBackup: string | null
  fileCount: number
  sizeFormatted: string
}

export interface BackupInfo {
  general: BackupFolderInfo
  patient: BackupFolderInfo & { patientFolderCount: number }
}

// ─── IPC API ──────────────────────────────────────────────────────────────────
export interface IpcApi {
  // Appointments (RDV)
  getAppointments: () => Promise<Appointment[]>
  getAppointmentsByDate: (date: string) => Promise<Appointment[]>
  getAppointmentsByMonth: (year: number, month: number) => Promise<Appointment[]>
  getAppointmentsByPatient: (patientId: string) => Promise<Appointment[]>
  createAppointment: (data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => Promise<Appointment>
  updateAppointment: (id: string, data: Partial<Appointment>) => Promise<Appointment>
  deleteAppointment: (id: string) => Promise<void>
  // Patients
  getPatients: () => Promise<Patient[]>
  getPatientsToFollowUp: (daysSince: number) => Promise<FollowUpPatient[]>
  getPatientById: (id: string) => Promise<Patient | null>
  createPatient: (data: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => Promise<Patient>
  updatePatient: (id: string, data: Partial<Patient>) => Promise<Patient>
  deletePatient: (id: string) => Promise<void>
  // Sessions
  getSessions: (patientId?: string) => Promise<Session[]>
  getSessionById: (id: string) => Promise<Session | null>
  createSession: (data: Omit<Session, 'id' | 'created_at' | 'updated_at'>) => Promise<Session>
  updateSession: (id: string, data: Partial<Session>) => Promise<Session>
  deleteSession: (id: string) => Promise<void>
  duplicateSession: (id: string) => Promise<Session>
  getSessionsByMonth: (year: number, month: number) => Promise<Session[]>
  getDashboardStats: () => Promise<DashboardStats>
  getUpcomingSessions: () => Promise<UpcomingSession[]>
  // Exports & Backup
  exportBackupJson: () => Promise<string>
  importBackupJson: (filePath: string) => Promise<{ patientsUpserted: number; sessionsUpserted: number; errors: string[] }>
  exportSessionJson: (sessionId: string) => Promise<string>
  exportSessionExcel: (sessionId: string) => Promise<string>
  exportSessionPdf: (sessionId: string) => Promise<string>
  // File dialogs
  showSaveDialog: (opts: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  showOpenDialog: (opts: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  openPath: (path: string) => Promise<void>
  getAppVersion: () => Promise<string>
  launchInstaller: (exePath: string) => Promise<void>
  // ── Authentification & chiffrement BDD ──
  authStatus: () => Promise<{ hasPassword: boolean; isUnlocked: boolean }>
  authSetup: (password: string) => Promise<{ ok: boolean; error?: string }>
  authLogin: (password: string) => Promise<boolean>
  authLock: () => Promise<void>
  authChangePassword: (oldPwd: string, newPwd: string) => Promise<{ ok: boolean; error?: string }>
  // ── RGPD ──
  logAccess:              (patientId: string | undefined, action: string, detail?: string) => Promise<void>
  getAccessLog:           (patientId?: string, limit?: number) => Promise<AccessLog[]>
  getRgpdAlerts:          () => Promise<{ nearRetention: Patient[]; overRetention: Patient[] }>
  exportTraitementRegister: () => Promise<string>
  // ── Plugin spécialité ──
  pluginGet:    () => Promise<import('./pluginTypes').PluginDefinition | null>
  pluginSet:    (def: import('./pluginTypes').PluginDefinition) => Promise<void>
  pluginRemove: () => Promise<void>
  pluginImport: (filePath: string) => Promise<import('./pluginTypes').PluginDefinition>
  getDataPath: () => Promise<string>
  // Settings
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  // Lecture fichier local → data URL base64 (aperçu logos)
  readFileDataUrl: (path: string) => Promise<string | null>
  // Factures
  generateInvoice:  (data: InvoiceData) => Promise<InvoiceResult>
  updateInvoiceLog: (id: string, data: Partial<Omit<InvoiceLog, 'id' | 'created_at'>>) => Promise<void>
  deleteInvoiceLog: (id: string) => Promise<void>
  // Comptabilité
  getComptaYearData: (year: number) => Promise<ComptaYearData>
  setMonthlyRevenue: (year: number, month: number, typeId: string, nbSeances: number) => Promise<void>
  setUrsafRate: (year: number, month: number, rate: number) => Promise<void>
  setMonthlyVarExpense: (year: number, month: number, category: string, label: string, amount: number) => Promise<void>
  getConsultationTypes: () => Promise<ConsultationType[]>
  saveConsultationTypes: (types: ConsultationType[]) => Promise<void>
  getExpenseConfig: () => Promise<ExpenseConfig[]>
  saveExpenseConfig: (configs: ExpenseConfig[]) => Promise<void>
  getInvoicesLog: (year?: number) => Promise<InvoiceLog[]>
  exportComptaExcel: (year: number) => Promise<string>
  // Backup
  getBackupInfo: () => Promise<BackupInfo>
  exportGeneralBackup: () => Promise<string>
  exportPatientBackup: (patientId: string) => Promise<string>
  exportPatientExcel: (patientId: string, sessionId: string) => Promise<string>
  openBackupFolder: (type: 'general' | 'patient') => Promise<void>
  // ── Google Calendar ──
  gcalStatus:        () => Promise<GoogleCalendarInfo>
  gcalConnect:       (clientId: string, clientSecret: string) => Promise<void>
  gcalDisconnect:    () => Promise<void>
  gcalListCalendars: () => Promise<GCalCalendar[]>
  gcalSetCalendar:   (calendarId: string, calendarName: string) => Promise<void>
}

declare global {
  interface Window {
    mtcApi: IpcApi
  }
}
