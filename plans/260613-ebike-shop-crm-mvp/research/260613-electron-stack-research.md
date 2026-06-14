# Research: Electron + React + Vite + better-sqlite3 Stack Best Practices (2025-2026)

**Date**: 2026-06-13 | **Target**: Single-user Windows desktop CRM with beginner-friendly AI assistant

---

## Executive Summary

For single-user Electron desktop CRM: (1) Use electron-vite's 3-process model (main/preload/renderer) with contextBridge IPC for security; (2) place better-sqlite3 in main process only, use typed IPC channels for DB queries; (3) migrate with drizzle-kit push (no files needed for solo dev) or runtime generation; (4) store .db in `app.getPath('userData')/data/`; (5) pack with electron-builder; (6) auto-backup via better-sqlite3's `.backup()` to OneDrive/Dropbox folder.

---

## 1. PROJECT STRUCTURE & IPC ARCHITECTURE

**electron-vite Scaffold (v6.0.0-beta.1, April 2026)**
```
src/
  main/          ← Node.js env, file I/O, DB access, IPC handlers
    index.ts
  preload/       ← Bridge between main & renderer, use contextBridge only
    index.ts
  renderer/      ← React UI, reads/writes ONLY via typed IPC channels
    App.tsx
    components/

electron.vite.config.ts
package.json
```

**Key Separation Principle**: No Node imports in renderer. All DB, file, native module access → main process via `ipcMain.handle()`.

**IPC Security (Electron v20+, defaults)**
- `contextIsolation: true` (default) — isolate preload from renderer globals
- `nodeIntegration: false` (default) — renderer can't require() native modules
- `sandbox: true` (default v20+) — max process isolation

**Preload Pattern (contextBridge-only)**
```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('db', {
  // Typed channel for queries
  query: (sql: string, params: unknown[]) =>
    ipcRenderer.invoke('db:query', { sql, params }),
  
  // Add customers, update, delete via typed channels
  addCustomer: (data: {name: string; email: string}) =>
    ipcRenderer.invoke('db:add-customer', data),
})
```

**Renderer Usage**
```typescript
// src/renderer/App.tsx
const result = await window.db.query('SELECT * FROM customers')
const newCustomer = await window.db.addCustomer({name: 'John', email: 'john@...'})
```

---

## 2. BETTER-SQLITE3 IN MAIN PROCESS

**Problem**: better-sqlite3 is a native module (C++ bindings). Won't work in renderer.

**Setup**
```bash
npm install better-sqlite3
npm install -D @electron/rebuild
```

**Post-install script** in `package.json`
```json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  }
}
```

**2025-2026 Gotchas**
- **Electron 42.0.1+**: Reported build failures (#1474) — may need `electron-rebuild --force`
- **npm 11.4.1+**: Install scripts deprecated by default; add to `.npmrc`: `enable-scripts=true`
- **WSL**: Locking issues; avoid WSL for dev builds

**Main Process DB Initialization**
```typescript
// src/main/index.ts
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDB() {
  const dbDir = path.join(app.getPath('userData'), 'data')
  // Create dir if missing
  require('fs').mkdirSync(dbDir, { recursive: true })
  
  db = new Database(path.join(dbDir, 'app.db'))
  db.pragma('journal_mode = WAL')  // Enable WAL for concurrent reads
}
```

**IPC Handler for Queries**
```typescript
import { ipcMain } from 'electron'

ipcMain.handle('db:query', (event, { sql, params }) => {
  try {
    const stmt = db.prepare(sql)
    return stmt.all(...params)
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('db:add-customer', (event, data) => {
  const stmt = db.prepare(
    'INSERT INTO customers (name, email) VALUES (?, ?)'
  )
  return stmt.run(data.name, data.email)
})
```

---

## 3. DRIZZLE ORM + MIGRATIONS IN PACKAGED APP

**Setup**
```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit
```

**Schema** (`src/main/schema.ts`)
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
})
```

**For Solo Dev: Use `push` (no SQL files)**
```bash
drizzle-kit push
```
No migrations folder needed. Schema syncs on CLI run.

**For Packaged App: Runtime Generation + Migration**

Option A (Simplest): Generate SQL, then execute at app startup
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
})
```

```bash
drizzle-kit generate
```

At app startup, apply pending migrations:
```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import fs from 'fs'
import path from 'path'

export function runMigrations() {
  const migrationsFolder = path.join(__dirname, '../../migrations')
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder })
  }
}
```

**Important**: Keep `migrations/` folder in asar (electron-builder bundles it by default).

---

## 4. DATABASE FILE STORAGE & PATHS

**Recommended**: `app.getPath('userData')/data/app.db`

**Why this path?**
- Windows: `%APPDATA%\YourApp\data\app.db` (user-accessible, backed up by Windows)
- Persists across app updates
- User can manually copy for backup

**Avoid**: Storing directly in userData root (Chromium creates `Cache/`, `Local Storage/` there; adds clutter).

---

## 5. WINDOWS PACKAGING (electron-builder)

**electron-builder v25+**

```json
{
  "build": {
    "appId": "com.ebike-crm.app",
    "productName": "eBike Shop CRM",
    "win": {
      "target": ["nsis", "portable"],
      "certificateFile": null,
      "certificatePassword": null
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "directories": {
      "output": "dist",
      "buildResources": "assets"
    }
  }
}
```

**Build**
```bash
npm run build
electron-builder
```

**Output**: `dist/eBike Shop CRM Setup.exe` + portable `.exe`

**Native Module Bundling**: electron-builder auto-detects `node_modules/better-sqlite3/build/Release/*.node` and includes in asar. No extra config needed if postinstall hook ran.

---

## 6. AUTO-BACKUP STRATEGY

**better-sqlite3.Database.backup() API**

```typescript
import fs from 'fs'

export function autoBackup() {
  const backupDir = path.join(
    process.env.USERPROFILE,
    'OneDrive/Documents/eBike-CRM-Backups'  // or Dropbox
  )
  
  // Create if missing
  require('fs').mkdirSync(backupDir, { recursive: true })
  
  const timestamp = new Date().toISOString().slice(0, 10)
  const backupPath = path.join(backupDir, `app-${timestamp}.db`)
  
  if (!fs.existsSync(backupPath)) {
    // Backup only once per day
    const backup = db.backup(backupPath)
    backup.step(-1) // Copy all
    backup.finish()
  }
}
```

**Trigger**: Call on app startup or daily timer.

**Gotchas**
- `.backup()` is synchronous; runs in main process (acceptable for small DB)
- OneDrive/Dropbox sync may lock file; use separate backup location

---

## 7. KEY VERSIONS & COMPATIBILITY

| Tool | Version | Notes |
|------|---------|-------|
| electron | 32+ | v33+ stable; v42+ has build issues with better-sqlite3 |
| electron-vite | 6.0.0-beta.1 (April 2026) | Vite 6.x integrated |
| better-sqlite3 | 11.x | Known issue #1474 with Electron 42.0.1+ |
| drizzle-orm | 1.x | Stable for SQLite |
| drizzle-kit | 1.x | Migrations stable |
| @electron/rebuild | 3.x | Auto-rebuild native modules |

---

## UNRESOLVED QUESTIONS

1. **Electron 42+ better-sqlite3 compatibility**: Will the build failure (#1474) be fixed by April 2026? Monitor `electron-rebuild` releases.
2. **npm install script deprecation**: Will default enable-scripts=true workaround persist, or does npm.org mandate opt-in?
3. **IPC error transparency**: Should main process DB errors be caught & mapped to user-friendly messages, or pass raw errors? (Currently only `.message` leaks to renderer.)
4. **Multi-window concurrency**: If app opens multiple windows, does shared DB handle via `ipcMain.handle()` cause contention? (WAL mode helps, but untested at scale.)

---

## REFERENCES

- electron-vite: https://electron-vite.org/guide/
- Electron Security: https://www.electronjs.org/docs/tutorial/security
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- Drizzle ORM: https://orm.drizzle.team/docs/migrations
- electron-builder: https://www.electron.build/
- Electron IPC: https://www.electronjs.org/docs/api/ipc-main
