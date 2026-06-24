import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
  const currentVersion = row?.v ?? 0

  if (currentVersion < 1) {
    console.log('[DB] Running migration v1...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id          TEXT PRIMARY KEY,
        first_name  TEXT NOT NULL,
        last_name   TEXT NOT NULL,
        birth_date  TEXT,
        phone       TEXT,
        email       TEXT,
        address     TEXT,
        notes_general TEXT,
        alerts      TEXT,
        regular_doctor TEXT,
        medications TEXT,
        antecedents TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id              TEXT PRIMARY KEY,
        patient_id      TEXT NOT NULL,
        date            TEXT NOT NULL,
        practitioner    TEXT,
        motif           TEXT,
        evolution_tags  TEXT,
        evolution       TEXT,
        problematiques  TEXT,
        langue          TEXT,
        pouls           TEXT,
        constitution    TEXT,
        type_corps      TEXT,
        teint           TEXT,
        observation     TEXT,
        diagnostic_mtc  TEXT,
        cinq_elements   TEXT,
        causes          TEXT,
        analyse         TEXT,
        principes       TEXT,
        points          TEXT,
        pts_oreille     TEXT,
        techniques      TEXT,
        plantes         TEXT,
        reactions       TEXT,
        traitement_notes TEXT,
        conseils        TEXT,
        plan            TEXT,
        surveiller      TEXT,
        energy_tests_json TEXT,
        systemes_json   TEXT,
        full_data_json  TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS exports (
        id          TEXT PRIMARY KEY,
        patient_id  TEXT,
        session_id  TEXT,
        type        TEXT NOT NULL,
        file_path   TEXT,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

      INSERT INTO schema_version(version) VALUES(1);
    `)
    console.log('[DB] Migration v1 done')
  }

  if (currentVersion < 2) {
    console.log('[DB] Running migration v2...')
    db.exec(`
      ALTER TABLE patients ADD COLUMN is_active INTEGER DEFAULT 1;
      INSERT INTO schema_version(version) VALUES(2);
    `)
    console.log('[DB] Migration v2 done')
  }

  if (currentVersion < 3) {
    console.log('[DB] Running migration v3...')
    db.exec(`
      ALTER TABLE sessions ADD COLUMN next_session_date TEXT;
      CREATE INDEX IF NOT EXISTS idx_sessions_next_date ON sessions(next_session_date);
      INSERT INTO schema_version(version) VALUES(3);
    `)
    console.log('[DB] Migration v3 done')
  }

  if (currentVersion < 4) {
    console.log('[DB] Running migration v4 (comptabilité)...')
    db.exec(`
      -- Types de consultation configurables
      CREATE TABLE IF NOT EXISTS consultation_types (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        price       REAL NOT NULL DEFAULT 0,
        is_active   INTEGER NOT NULL DEFAULT 1,
        sort_order  INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO consultation_types VALUES
        ('standard', 'Consultation standard', 0, 1, 0);

      -- Nb séances saisi manuellement par mois/type/année
      CREATE TABLE IF NOT EXISTS monthly_revenue (
        year        INTEGER NOT NULL,
        month       INTEGER NOT NULL,
        type_id     TEXT NOT NULL,
        nb_seances  INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (year, month, type_id)
      );

      -- Taux URSAF par mois/année
      CREATE TABLE IF NOT EXISTS ursaf_rates (
        year  INTEGER NOT NULL,
        month INTEGER NOT NULL,
        rate  REAL NOT NULL DEFAULT 0.256,
        PRIMARY KEY (year, month)
      );

      -- Configuration des charges fixes (loyer, assurance…)
      CREATE TABLE IF NOT EXISTS expense_config (
        id              TEXT PRIMARY KEY,
        category        TEXT NOT NULL,
        label           TEXT NOT NULL,
        monthly_amount  REAL NOT NULL DEFAULT 0,
        is_shared       INTEGER NOT NULL DEFAULT 0,
        sort_order      INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO expense_config VALUES
        ('loyer',     'loyer_assurance', 'Loyer',     0, 1, 0),
        ('assurance', 'loyer_assurance', 'Assurance', 0, 1, 1);

      -- Dépenses variables par mois (publicité, logiciel, DASRI, autres)
      CREATE TABLE IF NOT EXISTS monthly_var_expenses (
        year      INTEGER NOT NULL,
        month     INTEGER NOT NULL,
        category  TEXT NOT NULL,
        label     TEXT NOT NULL DEFAULT '',
        amount    REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (year, month, category)
      );

      -- Journal des factures générées
      CREATE TABLE IF NOT EXISTS invoices_log (
        id                  TEXT PRIMARY KEY,
        invoice_number      TEXT NOT NULL UNIQUE,
        invoice_date        TEXT NOT NULL,
        patient_first_name  TEXT NOT NULL DEFAULT '',
        patient_last_name   TEXT NOT NULL DEFAULT '',
        patient_address     TEXT,
        email               TEXT,
        phone               TEXT,
        session_date        TEXT,
        description         TEXT,
        montant             REAL NOT NULL,
        file_path           TEXT,
        created_at          TEXT NOT NULL
      );

      INSERT INTO schema_version(version) VALUES(4);
    `)
    console.log('[DB] Migration v4 done')
  }

  if (currentVersion < 5) {
    console.log('[DB] Running migration v5 (profession + appointments)...')
    db.exec(`
      ALTER TABLE patients ADD COLUMN profession TEXT;

      CREATE TABLE IF NOT EXISTS appointments (
        id           TEXT PRIMARY KEY,
        patient_id   TEXT,
        date         TEXT NOT NULL,
        heure_debut  TEXT NOT NULL,
        heure_fin    TEXT,
        note         TEXT,
        is_done      INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

      INSERT INTO schema_version(version) VALUES(5);
    `)
    console.log('[DB] Migration v5 done')
  }

  if (currentVersion < 6) {
    console.log('[DB] Running migration v6 (guest contact on appointments)...')
    db.exec(`
      ALTER TABLE appointments ADD COLUMN guest_last_name  TEXT;
      ALTER TABLE appointments ADD COLUMN guest_first_name TEXT;
      ALTER TABLE appointments ADD COLUMN guest_phone      TEXT;
      INSERT INTO schema_version(version) VALUES(6);
    `)
    console.log('[DB] Migration v6 done')
  }

  if (currentVersion < 7) {
    console.log('[DB] Running migration v7 (RGPD : consentement + journal accès)...')
    db.exec(`
      ALTER TABLE patients ADD COLUMN consent_given INTEGER DEFAULT 0;
      ALTER TABLE patients ADD COLUMN consent_date  TEXT;

      CREATE TABLE IF NOT EXISTS access_log (
        id         TEXT PRIMARY KEY,
        patient_id TEXT,
        action     TEXT NOT NULL,
        detail     TEXT,
        timestamp  TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_access_log_patient ON access_log(patient_id);
      CREATE INDEX IF NOT EXISTS idx_access_log_ts      ON access_log(timestamp);

      INSERT INTO schema_version(version) VALUES(7);
    `)
    console.log('[DB] Migration v7 done')
  }

  if (currentVersion < 8) {
    console.log('[DB] Running migration v8 (expense_config.months — mois actifs par charge)...')
    db.exec(`
      ALTER TABLE expense_config ADD COLUMN months TEXT;
      INSERT INTO schema_version(version) VALUES(8);
    `)
    console.log('[DB] Migration v8 done')
  }

  if (currentVersion < 9) {
    console.log('[DB] Running migration v9 (appointments.google_event_id)...')
    db.exec(`
      ALTER TABLE appointments ADD COLUMN google_event_id TEXT DEFAULT NULL;
      INSERT INTO schema_version(version) VALUES(9);
    `)
    console.log('[DB] Migration v9 done')
  }

  if (currentVersion < 10) {
    console.log('[DB] Running migration v10...')
    // Note: les opérations DELETE/UPDATE qui écrasaient les données comptabilité
    // ont été retirées — elles supprimaient les types de consultation et les charges
    // configurés par l'utilisateur lors de chaque mise à jour.
    db.exec(`INSERT INTO schema_version(version) VALUES(10);`)
    console.log('[DB] Migration v10 done')
  }

  if (currentVersion < 12) {
    console.log('[DB] Running migration v12 (appointments.is_cancelled)...')
    db.exec(`
      ALTER TABLE appointments ADD COLUMN is_cancelled INTEGER DEFAULT 0;
      INSERT INTO schema_version(version) VALUES(12);
    `)
    console.log('[DB] Migration v12 done')
  }

  if (currentVersion < 13) {
    console.log('[DB] Running migration v13 (patients.civility)...')
    db.exec(`
      ALTER TABLE patients ADD COLUMN civility TEXT DEFAULT '';
      INSERT INTO schema_version(version) VALUES(13);
    `)
    console.log('[DB] Migration v13 done')
  }

  if (currentVersion < 11) {
    console.log('[DB] Running migration v11 (taux URSAF 21,2 %)...')
    db.exec(`
      UPDATE ursaf_rates SET rate = 0.256 WHERE rate = 0.246;
      INSERT INTO schema_version(version) VALUES(11);
    `)
    console.log('[DB] Migration v11 done')
  }

  if (currentVersion < 14) {
    console.log('[DB] Running migration v14 (session_templates)...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT DEFAULT '',
        data_json   TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      INSERT INTO schema_version(version) VALUES(14);
    `)
    console.log('[DB] Migration v14 done')
  }

  if (currentVersion < 15) {
    console.log('[DB] Running migration v15 (calendar_blocks)...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_blocks (
        id          TEXT PRIMARY KEY,
        date        TEXT NOT NULL,
        is_day      INTEGER NOT NULL DEFAULT 0,
        heure_debut TEXT,
        heure_fin   TEXT,
        motif       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_blocks_date ON calendar_blocks(date);
      INSERT INTO schema_version(version) VALUES(15);
    `)
    console.log('[DB] Migration v15 done')
  }

  if (currentVersion < 16) {
    console.log('[DB] Running migration v16 (reminder_sent + invoice paid status)...')
    db.exec(`
      ALTER TABLE appointments   ADD COLUMN reminder_sent INTEGER DEFAULT 0;
      ALTER TABLE invoices_log   ADD COLUMN is_paid       INTEGER DEFAULT 0;
      ALTER TABLE invoices_log   ADD COLUMN paid_date     TEXT;
      INSERT INTO schema_version(version) VALUES(16);
    `)
    console.log('[DB] Migration v16 done')
  }
}
