# Phase 09 — Packaging & Backup Hardening

## Context Links
- Overview: [plan.md](./plan.md)
- Stack research (electron-builder, native bundling, backup): [../research/260613-electron-stack-research.md](./research/260613-electron-stack-research.md)
- Depends on: Phases 01-08 (full app working in dev)

## Overview
- **Date:** 2026-06-13
- **Description:** Produce a Windows installer (electron-builder NSIS), correctly bundle the better-sqlite3 native module + migrations folder into the packaged app, and verify auto-backup + manual restore work in the installed (production) build.
- **Priority:** High (ship + data safety)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Native module + migrations are the two things that "work in dev, break in prod." Must verify in the installed exe, not just `electron-vite dev`.
- better-sqlite3 `.node` must be unpacked from asar (or kept external). electron-builder usually handles native deps via `asarUnpack`; set explicitly to be safe.
- `migrations/` folder must ship and resolve at runtime in packaged path (`process.resourcesPath` / `app.getAppPath()`), not the dev relative path. Make migration path resolution build-aware.
- Backup folder is OUTSIDE the app (cloud-synced) → unaffected by packaging, but verify path resolves on a real user profile.
- No code signing v1 (cost/scope) → expect SmartScreen warning; document "More info → Run anyway."

## Requirements
### Functional
- `npm run build` then electron-builder → `Setup.exe` (NSIS, choose install dir, desktop + start-menu shortcut) + optional portable exe.
- Installed app: launches, DB inits in `%APPDATA%`, migrations apply, all modules work.
- Auto-backup writes to cloud folder on first launch of installed build.
- Documented restore procedure (copy backup .db back over app.db while app closed).

### Non-Functional
- Installer < reasonable size; app starts < few seconds.
- Backup never blocks/crashes app (already fail-safe from Phase 01).

## Architecture
- `electron-builder.yml` (finalize Phase-01 stub).
- Build-aware migrations path in `src/main/db/migrate.ts`:
  ```ts
  const folder = app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '../../migrations')
  ```
- electron-builder `extraResources` to copy `migrations/` into `resources/migrations`.

## electron-builder.yml (key parts)
```yaml
appId: com.ebike-crm.app
productName: eBike Shop CRM
directories: { output: release, buildResources: build }
files:
  - 'out/**/*'
asarUnpack:
  - '**/node_modules/better-sqlite3/**'
extraResources:
  - from: 'migrations'
    to: 'migrations'
win:
  target: [nsis, portable]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

## Related Code Files
**Create:**
- `electron-builder.yml` (finalize)
- `build/` icon assets (`icon.ico`)
- `RESTORE.md` (user restore steps) — or section in ONBOARDING
**Modify:**
- `src/main/db/migrate.ts` (build-aware path)
- `src/main/db/backup.ts` (confirm path resolution on real profile)
- `package.json` scripts: add `"dist": "electron-vite build && electron-builder"`

## Implementation Steps
1. Add `icon.ico` to `build/`. Set product metadata in `electron-builder.yml`.
2. Make migration path build-aware (`app.isPackaged`). Add `extraResources` for migrations.
3. Add `asarUnpack` for better-sqlite3.
4. `npm run dist` → produce `release/eBike Shop CRM Setup.exe`.
5. Install on a clean-ish Windows profile (or test machine). Launch.
6. Verify: DB created in `%APPDATA%/ebike-crm/data/app.db`; tables exist (migrations ran in prod path); CRUD works.
7. Verify auto-backup file created in OneDrive/Documents backup folder.
8. Test restore: close app, copy a backup `.db` over `app.db`, relaunch → data restored. Document in `RESTORE.md`.
9. Note SmartScreen behavior; document bypass for unsigned build.

## Todo List
- [ ] electron-builder.yml finalized + icon
- [ ] migration path build-aware
- [ ] migrations shipped via extraResources
- [ ] better-sqlite3 asarUnpack
- [ ] dist → Setup.exe produced
- [ ] installed app: DB + migrations + modules verified in prod
- [ ] backup writes in installed build
- [ ] restore tested + documented
- [ ] SmartScreen note

## Success Criteria
- Setup.exe installs; app runs from installed location (not dev).
- All 5 modules + dashboard function in packaged build.
- better-sqlite3 loads (no native module error in prod).
- Backup file appears; restore brings data back.

## Risk Assessment
- **Native module missing in prod (HIGH):** asar packing. Mitigate: `asarUnpack` better-sqlite3; test installed build, not dev.
- **Migrations not found in prod (HIGH):** path resolves to dev dir. Mitigate: `app.isPackaged` branch + `extraResources`; verify tables exist post-install.
- **Backup folder absent on user machine (MED):** no OneDrive. Mitigate: fallback Documents (Phase 01); log + notify chosen path.
- **SmartScreen blocks (LOW/expected):** unsigned. Mitigate: document bypass; signing = future.

## Security Considerations
- Unsigned installer flagged by SmartScreen — acceptable for single private machine; note clearly.
- DB unencrypted (single private machine, scope). Document that backups contain customer data → keep cloud folder private.

## Next Steps
- Phase 10 runs the manual test checklist against this installed build + adds minimal Vitest unit tests.
