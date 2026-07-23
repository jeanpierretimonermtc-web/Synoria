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
  civility?: string      // 'M' | 'Mme' | ''
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
  reminder_sent?: number            // 0 = pas encore envoyé, 1 = rappel envoyé (v16)
  created_at: string
  updated_at: string
}

// ─── CALENDAR BLOCK (créneau/journée bloqué) ─────────────────────────────────
export interface CalendarBlock {
  id: string
  date: string         // YYYY-MM-DD
  is_day: number       // 0 = créneau horaire, 1 = journée entière
  heure_debut?: string // HH:MM — null si is_day = 1
  heure_fin?: string   // HH:MM — optionnel
  motif?: string
  created_at: string
  updated_at: string
}

// ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────────
export interface GoogleCalendarInfo {
  connected:    boolean
  email?:       string
  calendarId?:  string
  calendarName?: string
  importCalendars?: GCalCalendar[]
}

export interface GCalCalendar {
  id:       string
  summary:  string
  primary?: boolean
  color?:   string
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

// ─── SESSION FULL DATA (contenu de la colonne full_data_json) ────────────────
export interface SessionFullData {
  sessionNum?: number
  patientId?: string
  date?: string
  practitioner?: string
  motif?: string
  evolutionTags?: string
  evolution?: string
  problematiques?: string
  // Interrogatoire
  anamnese?: string
  langueNote?: string
  poulsNote?: string
  poulsPos?: Record<string, string>
  // Observation MTC
  constitution?: string
  typeCorps?: string
  teint?: string
  observation?: string
  // Analyse MTC
  diagnostic?: string
  cinqElements?: string
  causes?: string
  analyse?: string
  principes?: string
  // Traitement MTC
  points?: string
  ptsOreille?: string
  techniques?: string
  plantes?: string
  reactions?: string
  traitementNotes?: string
  // Barrage homéopathique
  barrageNiv1?: string
  barrageNiv2?: string
  barrageNiv3?: string
  barrageNiv4?: string
  // Suivi
  conseils?: string
  plan?: string
  surveiller?: string
  // Mode simple (aucun plugin)
  simpleContextVie?: string
  simpleTraitementsEnCours?: string
  simpleObjectifs?: string
  simpleNotesEntretien?: string
  // Plugin spécialité
  pluginData?: Record<string, unknown>
  pluginId?: string
  pluginSchema?: import('./pluginTypes').PluginDefinition
  pluginIsBuiltin?: boolean
  // RDV suivant (sync avec calendrier)
  nextSession?: string
  nextSessionHeure?: string
  nextSessionFin?: string
  nextSessionNote?: string
  nextSessionApptId?: string
  // Comptabilité (clôture automatique)
  comptaTypeId?: string
  comptaMois?: string
  // Métadonnée interne
  _savedAt?: number
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
  is_paid?: number    // 0 = en attente, 1 = payée (v16)
  paid_date?: string  // date du paiement (v16)
}

export interface PendingReminder {
  appointment_id: string
  patient_id: string
  patient_email: string
  patient_name: string
  appt_date: string
  appt_heure: string
  appt_note?: string
  reminder_sent: number
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
  invoiceOverdueDays:    number  // seuil alerte retard paiement (défaut 30 j)
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
  theme?:     'light' | 'dark'
  themeMode?: 'light' | 'dark' | 'system'
}

// ─── RECHERCHE GLOBALE ────────────────────────────────────────────────────────
export interface SearchResult {
  type:      'patient' | 'session'
  id:        string
  patientId?: string
  title:     string
  subtitle:  string
  date?:     string
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

// ─── LICENCE & COMPTE ─────────────────────────────────────────────────────────

export type LicenseStatus = 'active' | 'trialing' | 'past_due_grace' | 'restricted' | 'unknown'
export type LicenseMode   = 'full' | 'restricted'
export type LicensePlanCode = 'synoria_annual' | 'synoria_6_months'
export type DeviceDeactivationReason = DeactivationReason   // alias nominal

export interface LicenseState {
  status:         LicenseStatus
  mode:           'full' | 'restricted'
  organizationId: string | null
  licenseId:      string | null
  deviceId:       string | null   // devices.id UUID (pour identifier l'appareil courant)
  planCode:       string | null
  features:       string[]
  maxDevices:     number
  graceUntil:     string | null   // ISO date
  tokenExpiry:    string | null   // ISO date
  isOffline:      boolean
}

export interface AccountInfo {
  userId:    string
  email:     string
  createdAt: string
}

export interface SubscriptionInfo {
  status:            string
  currentPeriodEnd:  string | null
  cancelAtPeriodEnd: boolean
  trialEnd:          string | null
  priceId:           string | null
}

export interface FullAccountState {
  isLoggedIn:    boolean
  account:       AccountInfo | null
  subscription:  SubscriptionInfo | null
  licenseStatus: string
}

export interface DeviceInfo {
  id:           string
  label:        string        // nom affiché (ex: "PC Bureau (Windows 11)")
  platform:     string
  app_version:  string
  is_active:    boolean
  last_seen_at: string
  first_seen_at: string
}

export type DeactivationReason =
  | 'changement_ordinateur'
  | 'ancien_appareil'
  | 'erreur_activation'
  | 'autre'

// LicenseDevice est un alias de DeviceInfo pour la clarté du spec
export type LicenseDevice = DeviceInfo

export interface DeactivateDeviceResult {
  activeDevices:              DeviceInfo[]
  deactivationsRemaining30d:  number
}

export interface LicenseCheckResponse {
  state:    LicenseState
  isOnline: boolean
}

export interface CheckoutSessionResponse {
  url: string
}

export interface CustomerPortalResponse {
  url: string
}

export interface UpdateCheckResponse {
  result:    ReleaseCheckResult | null
  checkedAt: string
}

export interface ReleaseCheckResult {
  update_available:      boolean
  latest_version:        string
  is_required:           boolean
  min_supported_version: string | null
  title:                 string | null
  release_notes:         string | null
  download_url:          string | null
}

export interface RestrictionState {
  mode:                   'full' | 'restricted'
  status:                 LicenseStatus
  canReadData:            boolean
  canExportData:          boolean
  canBackupData:          boolean
  canCreatePatient:       boolean
  canModifyPatient:       boolean
  canCreateSession:       boolean
  canModifySession:       boolean
  canCreateInvoice:       boolean
  canCreateAppointment:   boolean
  canUsePremiumFeatures:  boolean
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
  sendAppointmentReminder: (appointmentId: string) => Promise<void>
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
  importBackupJson:             (filePath: string)                   => Promise<{ patientsUpserted: number; sessionsUpserted: number; sessionsSkipped: number; errors: string[] } | { __needsPassword: true; filePath: string } | { __needsKey: true; filePath: string }>
  importBackupJsonWithPassword: (filePath: string, password: string) => Promise<{ patientsUpserted: number; sessionsUpserted: number; sessionsSkipped: number; errors: string[] }>
  importBackupJsonWithKey:      (filePath: string)                   => Promise<{ patientsUpserted: number; sessionsUpserted: number; sessionsSkipped: number; errors: string[] }>
  exportEncryptionKey:          ()                                   => Promise<string | null>
  exportSessionJson: (sessionId: string) => Promise<string>
  exportSessionExcel: (sessionId: string) => Promise<string>
  exportSessionPdf: (sessionId: string) => Promise<string>
  // Exports canoniques (Phase 2)
  exportSessionInteropJson: (sessionId: string) => Promise<string>
  exportSessionBackupJson:  (sessionId: string) => Promise<string>
  exportSessionReportHtml:  (sessionId: string) => Promise<string>
  exportSessionExcelV2:     (sessionId: string) => Promise<string>
  // File dialogs
  showSaveDialog: (opts: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  showOpenDialog: (opts: { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[]; defaultPath?: string; title?: string }) => Promise<string | null>
  openPath:     (path: string) => Promise<void>
  openExternal: (url: string)  => Promise<void>
  getAppVersion: () => Promise<string>
  relaunchApp:   () => Promise<void>
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
  pluginGet:           () => Promise<import('./pluginTypes').PluginDefinition | null>
  pluginSet:           (def: import('./pluginTypes').PluginDefinition) => Promise<void>
  pluginRemove:        () => Promise<void>
  pluginImport:        (filePath: string) => Promise<import('./pluginTypes').PluginDefinition>
  pluginLibraryGet:        () => Promise<{ plugin: import('./pluginTypes').PluginDefinition; savedAt: string; isNative?: boolean }[]>
  pluginLibrarySave:       (plugin: import('./pluginTypes').PluginDefinition) => Promise<void>
  pluginLibrarySaveNative: (plugin: import('./pluginTypes').PluginDefinition) => Promise<void>
  pluginLibraryDelete:     (id: string) => Promise<void>
  pluginLibraryExport:     (destPath: string) => Promise<void>
  pluginLibraryImport:     (srcPath: string) => Promise<{ added: number; updated: number }>
  pluginListAvailable:     () => Promise<import('./pluginTypes').PluginDefinition[]>
  // ── Profils de séance (Phase 3) ──────────────────────────────────────────
  profilesGetAll:     () => Promise<import('./sessionProfileTypes').SessionFormProfile[]>
  profilesGetDefault: () => Promise<import('./sessionProfileTypes').SessionFormProfile | null>
  profilesCreate:     (data: Omit<import('./sessionProfileTypes').SessionFormProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<import('./sessionProfileTypes').SessionFormProfile>
  profilesUpdate:     (id: string, data: Partial<import('./sessionProfileTypes').SessionFormProfile>) => Promise<import('./sessionProfileTypes').SessionFormProfile>
  profilesDuplicate:  (id: string, name: string) => Promise<import('./sessionProfileTypes').SessionFormProfile>
  profilesArchive:    (id: string) => Promise<void>
  profilesSetDefault: (id: string) => Promise<void>
  profilesMigrate:    () => Promise<{ migrated: boolean; profile?: import('./sessionProfileTypes').SessionFormProfile; reason?: string }>
  getDataPath: () => Promise<string>
  openDocumentation: () => Promise<void>
  openInstallGuide:  () => Promise<void>
  openRgpdGuide:     () => Promise<void>
  setMenuBarVisible: (visible: boolean) => Promise<void>
  onFormatPopup: (cb: (pos: { x: number; y: number }) => void) => void
  searchGlobal: (query: string) => Promise<SearchResult[]>
  verifyBackup: (filePath: string) => Promise<{ patients: number; sessions: number; exportedAt: string }>
  // Settings
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  // Lecture fichier local → data URL base64 (aperçu logos)
  readFileDataUrl: (path: string) => Promise<string | null>
  // Factures
  generateInvoice:      (data: InvoiceData) => Promise<InvoiceResult>
  regenerateInvoicePdf: (id: string, invoiceNum: string, data: InvoiceData) => Promise<InvoiceResult>
  updateInvoiceLog:   (id: string, data: Partial<Omit<InvoiceLog, 'id' | 'created_at'>>) => Promise<void>
  deleteInvoiceLog:   (id: string) => Promise<void>
  markInvoicePaid:    (id: string, paid: boolean) => Promise<void>
  getInvoiceEmailData:    (id: string) => Promise<{ to: string | null; subject: string | null; body: string | null; pdfPath: string | null; fileName: string | null }>
  openInvoiceEmailClient: (to: string, subject: string, body: string, pdfPath?: string | null) => Promise<void>
  // Rappels RDV
  getPendingReminders:   () => Promise<PendingReminder[]>
  markReminderSent:      (appointmentId: string) => Promise<void>
  // Alertes factures
  getOverdueInvoices:    (thresholdDays: number) => Promise<InvoiceLog[]>
  // Comptabilité
  getComptaYearData: (year: number) => Promise<ComptaYearData>
  setMonthlyRevenue:       (year: number, month: number, typeId: string, nbSeances: number) => Promise<void>
  incrementMonthlyRevenue: (year: number, month: number, typeId: string) => Promise<void>
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
  exportPatientExcel:  (patientId: string, sessionId: string) => Promise<string>
  exportPatientReport: (patientId: string)                    => Promise<string>
  exportConsentForm:   (patientId?: string)                   => Promise<string>
  exportUrssafReport:  (year: number)                         => Promise<string>
  openBackupFolder: (type: 'general' | 'patient') => Promise<void>
  // ── Google Calendar ──
  gcalStatus:        () => Promise<GoogleCalendarInfo>
  gcalConnect:       () => Promise<void>
  gcalDisconnect:    () => Promise<void>
  gcalListCalendars: () => Promise<GCalCalendar[]>
  gcalSetCalendar:   (calendarId: string, calendarName: string) => Promise<void>
  gcalSetImportCalendars: (calendars: GCalCalendar[]) => Promise<void>
  gcalCleanupOldImportedAppointments: () => Promise<{ deleted: number }>
  gcalCleanupDuplicates:              () => Promise<{ deletedSynoria: number; deletedGCal: number }>
  gcalSync:                         (startDate: string, endDate: string) => Promise<{ imported: number; updated: number; exported: number; sessionsExported: number; sessionsUpdated: number; total: number }>
  appointmentsBackfillFromSessions: () => Promise<{ created: number }>
  // Diagnostic
  generateDiagnosticReport: () => Promise<string>
  generateSupportDoc: () => Promise<string>
  generateRecoveryDoc: () => Promise<string>
  // Admin
  // ── Blocs calendrier ──
  getCalendarBlocks:       ()                                                                          => Promise<CalendarBlock[]>
  getCalendarBlocksByMonth:(year: number, month: number)                                              => Promise<CalendarBlock[]>
  createCalendarBlock:     (data: Omit<CalendarBlock, 'id' | 'created_at' | 'updated_at'>)           => Promise<CalendarBlock>
  updateCalendarBlock:     (id: string, data: Partial<Omit<CalendarBlock, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>
  deleteCalendarBlock:     (id: string)                                                               => Promise<void>
  adminVerify:        (password: string) => Promise<boolean>
  adminGetLogs:       (n?: number) => Promise<string[]>
  adminClearLogs:     () => Promise<void>
  adminGetSystemInfo: () => Promise<{ version: string; userData: string; platform: string; arch: string; nodeVersion: string; electronVersion: string; dbOpen: boolean; memoryUsedMB: number; memoryTotalMB: number; uptimeSeconds: number; hostname: string }>
  adminDbIntegrity:   () => Promise<string>
  adminWalCheckpoint: () => Promise<string>
  adminDbStats:       () => Promise<Record<string, number>>
  adminGetSettings:   () => Promise<string>
  adminForceBackup:   () => Promise<string>
  // ── Compte & Licence ──
  accountSignUp:              (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  accountSignIn:              (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  accountSignOut:             () => Promise<void>
  accountResetPassword:       (email: string) => Promise<{ ok: boolean; error?: string }>
  accountResendConfirmation:  (email: string) => Promise<{ ok: boolean; error?: string }>
  accountGetState:       () => Promise<FullAccountState>
  accountCreateCheckout: (priceId: string) => Promise<string>
  accountBillingPortal:  () => Promise<string>
  licenseGetState:            () => Promise<LicenseState>
  licenseVerifyOnline:        () => Promise<LicenseState>
  licenseGetDeviceId:         () => Promise<string>
  licenseGetDevices:          () => Promise<DeviceInfo[]>
  licenseDeactivateDevice:    (deviceId: string, reason: DeactivationReason) => Promise<DeactivateDeviceResult>
  licenseGetRestrictionState:     () => Promise<RestrictionState>
  licenseGetLastCheck:            () => Promise<{ checkedAt: string; status: string } | null>
  licenseDetectClockRollback:     () => Promise<boolean>
  licenseRefresh:                 () => Promise<LicenseState>
  licenseDeactivateCurrentDevice: () => Promise<DeactivateDeviceResult>
  releaseCheck:                   (currentVersion: string) => Promise<ReleaseCheckResult | null>
  checkForUpdates:                () => Promise<ReleaseCheckResult | null>
  dismissUpdateNotification:      (version: string) => Promise<void>
  getLastUpdateNotification:      () => Promise<{ version: string; dismissedAt: string } | null>
  onUpdateAvailable:              (cb: (result: ReleaseCheckResult) => void) => void
  ownerCheck: () => Promise<boolean>
  speechStart:     () => Promise<void>
  speechStop:      () => Promise<void>
  onSpeechResult:  (cb: (text: string) => void) => void
  onSpeechStarted: (cb: () => void) => void
  onSpeechError:   (cb: (msg: string) => void) => void
  onSpeechStopped: (cb: () => void) => void
}

declare global {
  interface Window {
    mtcApi: IpcApi
  }
}
