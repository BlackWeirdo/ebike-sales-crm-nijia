# Phase 01 — Project Setup & App Shell

## Context Links
- Overview: [plan.md](./plan.md)
- Stack research: [../research/260613-electron-stack-research.md](./research/260613-electron-stack-research.md)
- Brainstorm: [../reports/00-brainstorm-summary.md](./reports/00-brainstorm-summary.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Scaffold electron-vite + React + TS + Mantine. Establish main/preload/renderer separation, typed IPC scaffold, SQLite DB init in userData, Drizzle setup + startup migration runner, daily auto-backup, native-module rebuild config. Foundation for all phases.
- **Priority:** Critical (blocks everything)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- better-sqlite3 is a NATIVE module → only main process, never renderer. Rebuild against Electron ABI is the #1 beginner pitfall.
- npm 11.4.1+ disables install scripts → add `.npmrc` `enable-scripts=true` BEFORE `npm install`, else postinstall rebuild silently skips.
- Pin Electron to 33/34 (stable). Electron 42+ has reported better-sqlite3 build failures (research #1474).
- DB file → `app.getPath('userData')/data/app.db`. NOT userData root (Chromium clutters it).
- Use WAL pragma for safe reads.
- Security defaults must stay ON: contextIsolation true, nodeIntegration false, sandbox true.

## Requirements
### Functional
- App launches to empty Mantine-themed window with left nav (placeholder routes for 5 modules + Dashboard).
- On startup: DB created if missing, migrations applied, daily backup attempted.
- One working sample IPC round-trip (renderer calls `window.api.ping()` → main returns value).

### Non-Functional
- Strict TS (`strict: true`). No `any` in IPC contracts.
- All DB/file/native access in main only.
- No secrets; offline only.

## Architecture
```
Renderer (React/Mantine)  --window.api.*-->  Preload (contextBridge)
   no Node, no DB                                  |
                                            ipcRenderer.invoke
                                                   v
                                   Main (Node): ipcMain.handle
                                     ├─ better-sqlite3 (db handle)
                                     ├─ Drizzle (typed queries)
                                     ├─ migrate() at startup
                                     └─ autoBackup() daily
```
Data flow: UI event → `window.api.fn(args)` → preload invoke(channel) → main handler → repo/Drizzle → SQLite → return JSON-serializable result back up.

## Related Code Files
**Create:**
- `package.json`, `.npmrc` (`enable-scripts=true`), `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `drizzle.config.ts`
- `src/main/index.ts` — app lifecycle, window, register IPC, init DB, run migrations, schedule backup
- `src/main/db/connection.ts` — better-sqlite3 + Drizzle handle, WAL pragma
- `src/main/db/migrate.ts` — run migrations at startup
- `src/main/db/backup.ts` — daily `.backup()` to cloud folder
- `src/main/ipc/index.ts` — register all handlers (just `ping` for now)
- `src/preload/index.ts` — contextBridge `window.api`
- `src/preload/index.d.ts` — type for `window.api`
- `src/shared/ipc-contract.ts` — shared channel names + arg/return types (single source of truth, imported by both main + preload)
- `src/renderer/src/main.tsx`, `App.tsx`, `theme.ts`, `routes.tsx`, `components/AppShell.tsx`
- `migrations/` (generated later, Phase 02 creates first set)
- `electron-builder.yml` (stub; finalized Phase 09)
- `.gitignore`

**Modify:** none (greenfield)
**Delete:** electron-vite boilerplate sample files not needed.

## Implementation Steps
1. Install Node LTS (20+). Create `.npmrc` with `enable-scripts=true` FIRST.
2. Scaffold: `npm create @quick-start/electron@latest ebike-crm -- --template react-ts`. Pick React+TS.
3. In `package.json`, pin `"electron": "^33.0.0"` (avoid 42+). Add deps:
   `npm i better-sqlite3 drizzle-orm @mantine/core @mantine/hooks @mantine/dates @mantine/notifications @mantine/form recharts dayjs`
   Dev: `npm i -D drizzle-kit @electron/rebuild @types/better-sqlite3`
4. Add scripts to `package.json`:
   ```json
   "postinstall": "electron-rebuild -f -w better-sqlite3",
   "db:generate": "drizzle-kit generate",
   "dev": "electron-vite dev",
   "build": "electron-vite build"
   ```
   Run `npm run postinstall` once (or `npx electron-rebuild -f -w better-sqlite3`). If it fails on Electron 42+, downgrade Electron.
5. Configure `electron.vite.config.ts`: externalize `better-sqlite3` in main build (`build.rollupOptions.external: ['better-sqlite3']`) so native binary isn't bundled by Vite.
6. Define IPC contract `src/shared/ipc-contract.ts`:
   ```ts
   export const IPC = { ping: 'app:ping' } as const
   export interface ApiSchema { ping(): Promise<string> }
   ```
7. Preload `src/preload/index.ts`:
   ```ts
   import { contextBridge, ipcRenderer } from 'electron'
   import { IPC } from '../shared/ipc-contract'
   const api = { ping: () => ipcRenderer.invoke(IPC.ping) }
   contextBridge.exposeInMainWorld('api', api)
   ```
   `index.d.ts`: `declare global { interface Window { api: import('../shared/ipc-contract').ApiSchema } }`
8. DB connection `src/main/db/connection.ts`:
   ```ts
   import Database from 'better-sqlite3'
   import { drizzle } from 'drizzle-orm/better-sqlite3'
   import { app } from 'electron'
   import path from 'node:path'; import fs from 'node:fs'
   let sqlite: Database.Database
   export let db: ReturnType<typeof drizzle>
   export function initDB() {
     const dir = path.join(app.getPath('userData'), 'data')
     fs.mkdirSync(dir, { recursive: true })
     sqlite = new Database(path.join(dir, 'app.db'))
     sqlite.pragma('journal_mode = WAL')
     sqlite.pragma('foreign_keys = ON')
     db = drizzle(sqlite)
   }
   export function getSqlite() { return sqlite }
   ```
9. Migration runner `src/main/db/migrate.ts`: `migrate(db, { migrationsFolder: path.join(__dirname, '../../migrations') })`. Wrap in try/catch, log on fail. (No migrations exist yet → no-op until Phase 02.)
10. Backup `src/main/db/backup.ts`: daily-once `.backup()` to cloud folder (see snippet research §6). Guard: skip if today's file exists. Backup dir resolution: try `%USERPROFILE%/OneDrive/Documents/eBike-CRM-Backups`, fallback `%USERPROFILE%/Documents/eBike-CRM-Backups`. Wrap try/catch — backup failure must NOT crash app.
11. `src/main/index.ts` order in `app.whenReady()`: `initDB()` → `runMigrations()` → `autoBackup()` → register IPC → create window. Register `ipcMain.handle(IPC.ping, () => 'pong')`.
12. Renderer: wrap App in `<MantineProvider>` + `<Notifications>`. Build `AppShell` with left `NavLink`s (Dashboard, Inventory, POS, Customers, Warranty, Debt). Use simple state-based view switch (no router lib needed v1 — KISS) OR react-router if comfortable.
13. Smoke test: button calls `window.api.ping()`, shows result in a Mantine notification.

## Todo List
- [ ] `.npmrc` enable-scripts=true (before install)
- [ ] Scaffold electron-vite react-ts
- [ ] Pin Electron 33, install deps
- [ ] postinstall electron-rebuild works (better-sqlite3 loads in main)
- [ ] Vite externalizes better-sqlite3
- [ ] IPC contract + preload + window.api typed
- [ ] initDB in userData/data + WAL + FK pragma
- [ ] migrate runner (no-op ok)
- [ ] autoBackup daily, fail-safe
- [ ] Mantine AppShell + nav placeholders
- [ ] ping round-trip verified

## Success Criteria
- `npm run dev` opens window, no console errors.
- `require('better-sqlite3')` works in main (rebuild OK).
- `app.db` created under `%APPDATA%/ebike-crm/data/`.
- Ping button → "pong" notification (IPC proven).
- Backup file appears in cloud folder on first run.

## Risk Assessment
- **Native rebuild fails (HIGH):** wrong ABI/Electron 42+. Mitigate: pin Electron 33, `.npmrc` first, `electron-rebuild -f`. If stuck, try prebuilt or downgrade.
- **Vite bundles native .node (MED):** breaks at runtime. Mitigate: mark external in main rollup config.
- **Backup dir not cloud-synced (LOW):** wrong path. Mitigate: detect OneDrive, fallback Documents, log chosen path.

## Security Considerations
- Keep contextIsolation/sandbox ON, nodeIntegration OFF. No `remote` module.
- Renderer never touches fs/db directly — only `window.api`.
- IPC handlers validate inputs (cheap typeof checks) even though single-user.

## Next Steps
- Unblocks Phase 02 (define real schema + first migration via `db:generate`).
