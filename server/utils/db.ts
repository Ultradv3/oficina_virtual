import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  adapter_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_connected_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mode TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  status_reason TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(connection_id, external_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  session_id TEXT,
  error TEXT,
  cancel_requested_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id TEXT,
  session_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at INTEGER,
  resolved_by TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, external_id)
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  connection_id TEXT,
  agent_id TEXT,
  task_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subtasks_agent ON subtasks(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`

type DbGlobal = typeof globalThis & {
  __agentOfficeDb?: Database.Database
  __agentOfficeSchemaReady?: boolean
}

export function getDb(): Database.Database {
  const g = globalThis as DbGlobal
  if (!g.__agentOfficeDb) {
    const file = process.env.AGENT_OFFICE_DB || resolve(process.cwd(), 'data/agent-office.db')
    mkdirSync(dirname(file), { recursive: true })
    const db = new Database(file)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
    g.__agentOfficeDb = db
  }
  if (!g.__agentOfficeSchemaReady) {
    // Se ejecuta también sobre bases existentes para aplicar tablas nuevas
    // (por ejemplo `subtasks`) sin exigir un borrado manual del archivo.
    g.__agentOfficeDb.exec(SCHEMA)
    g.__agentOfficeSchemaReady = true
  }
  return g.__agentOfficeDb
}

export function now(): number {
  return Date.now()
}
