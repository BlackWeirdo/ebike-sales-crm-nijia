// Runs before each test file's imports — force every test to use an isolated in-memory SQLite DB
// so the real data/crm.db is never touched. db.ts reads this at import time.
process.env.CRM_DB_PATH = ':memory:'
process.env.NODE_ENV = 'test'
