# Plan: Nâng cấp giao diện chuyên nghiệp

**Date:** 2026-06-14 · **Status:** Done
Primary = Teal (giữ) · Default color scheme = auto (theo hệ thống) + nhớ qua localStorage.

## Phases
- [Phase 01 — Theme & Dark mode](phase-01-theme-darkmode.md) — `done`
- [Phase 02 — Confirm/Loading/Responsive/A11y](phase-02-ux-polish.md) — `done`

## Hạng mục
1. **Bộ màu thống nhất** — theme tokens trong main.tsx; bỏ `bg="gray.0"` cứng → `light-dark()`; tài liệu `docs/design-guidelines.md`.
2. **Dark/Light toggle** — `localStorageColorSchemeManager` + `defaultColorScheme="auto"`; nút sun/moon ở Header; anti-FOUC script index.html.
3. **Thông báo đẹp** — bỏ `confirm()`/`alert()` native → `@mantine/modals` confirm + toast có icon (lib/confirm.ts, nâng cấp notify.ts).
4. **Loading đẹp** — Skeleton rows trong ListTable; Loader/Skeleton trong modal chi tiết.
5. **Hover/click mượt** — theme cursorType pointer + transitions; respect reduced-motion.
6. **Responsive** — AppShell.Header + burger, navbar thu gọn mobile; PageHeader wrap.
7. **Keyboard** — modals accessible; row click có tabIndex+Enter; focus ring auto.

## Verify
typecheck · build · vitest (33 test) · render headless screenshot Light + Dark, 0 lỗi console.
