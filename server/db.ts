import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
// CRM_DB_PATH lets tests point at an isolated DB (e.g. ':memory:'); default = data/crm.db.
const DB_PATH = process.env.CRM_DB_PATH || join(DATA_DIR, 'crm.db')

if (DB_PATH !== ':memory:' && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// Built-in Node SQLite (no native compilation needed). Single-process, single-user app.
export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

// Apply schema (idempotent) on boot.
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
db.exec(schema)

// Lightweight migrations for existing DBs (CREATE TABLE IF NOT EXISTS won't add new columns).
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    console.log(`[db] migrated: added ${table}.${column}`)
  }
}
ensureColumn('products', 'color', 'color TEXT')
ensureColumn('customers', 'type', "type TEXT NOT NULL DEFAULT 'individual'")
ensureColumn('customers', 'contact_person', 'contact_person TEXT')
ensureColumn('customers', 'tax_code', 'tax_code TEXT')
ensureColumn('debt_payments', 'paid_at', 'paid_at TEXT')

/**
 * Run `fn` inside a SQLite transaction. Commits on success, rolls back on throw.
 * node:sqlite has no `.transaction()` helper, so we drive BEGIN/COMMIT/ROLLBACK manually.
 */
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

if (DB_PATH !== ':memory:') console.log(`[db] SQLite ready at ${DB_PATH}`)
