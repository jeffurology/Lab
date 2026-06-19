'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.LAB_DB_PATH || path.join(DATA_DIR, 'lab.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Schema. All timestamps are ISO-8601 strings (UTC) unless noted.
 * NOTE: patient_ref is intended to be a de-identified accession/order reference,
 * NOT a full MRN or name. See README "PHI & HIPAA" before storing patient data.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  address     TEXT,
  contact     TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS specimens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  accession     TEXT UNIQUE NOT NULL,
  location_id   INTEGER NOT NULL REFERENCES locations(id),
  patient_ref   TEXT,
  test_type     TEXT NOT NULL CHECK (test_type IN ('PSA','IsoPSA','PSA+IsoPSA')),
  priority      TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','stat')),
  collected_at  TEXT,
  received_at   TEXT,
  status        TEXT NOT NULL DEFAULT 'collected'
                  CHECK (status IN ('collected','in_transit','received','in_run','resulted','rejected','cancelled')),
  reject_reason TEXT,
  batch_id      INTEGER REFERENCES batches(id),
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_specimens_status ON specimens(status);
CREATE INDEX IF NOT EXISTS idx_specimens_location ON specimens(location_id);
CREATE INDEX IF NOT EXISTS idx_specimens_received ON specimens(received_at);

CREATE TABLE IF NOT EXISTS batches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_date      TEXT NOT NULL,
  instrument    TEXT NOT NULL DEFAULT 'cobas',
  test_type     TEXT NOT NULL CHECK (test_type IN ('PSA','IsoPSA')),
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','running','complete','qc_fail','cancelled')),
  qc_status     TEXT DEFAULT 'pending' CHECK (qc_status IN ('pending','pass','fail')),
  started_at    TEXT,
  completed_at  TEXT,
  operator      TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  specimen_id   INTEGER NOT NULL REFERENCES specimens(id),
  test_type     TEXT NOT NULL,
  value         REAL,
  unit          TEXT,
  flag          TEXT DEFAULT 'normal' CHECK (flag IN ('normal','high','low','critical','indeterminate')),
  instrument    TEXT,
  resulted_at   TEXT NOT NULL DEFAULT (datetime('now')),
  released_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_results_specimen ON results(specimen_id);

CREATE TABLE IF NOT EXISTS couriers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id   INTEGER NOT NULL REFERENCES locations(id),
  pickup_date   TEXT NOT NULL,
  pickup_time   TEXT,
  received_at   TEXT,
  specimen_count INTEGER DEFAULT 0,
  courier_name  TEXT,
  temp_ok       INTEGER DEFAULT 1,
  temp_c        REAL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qc_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  qc_date       TEXT NOT NULL,
  test_type     TEXT NOT NULL CHECK (test_type IN ('PSA','IsoPSA')),
  level         TEXT NOT NULL,
  instrument    TEXT NOT NULL DEFAULT 'cobas',
  lot           TEXT,
  target        REAL,
  sd            REAL,
  observed      REAL,
  result        TEXT NOT NULL DEFAULT 'pass' CHECK (result IN ('pass','fail','warning')),
  operator      TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qc_date ON qc_log(qc_date);

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','in_progress','blocked','done','na')),
  owner         TEXT,
  due_date      TEXT,
  link          TEXT,
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
