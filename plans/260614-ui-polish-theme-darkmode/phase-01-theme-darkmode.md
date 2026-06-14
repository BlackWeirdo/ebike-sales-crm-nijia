# Phase 01 — Theme & Dark mode · status: done

**Date:** 2026-06-14 · Priority: High

## Đã làm
- [main.tsx](../../client/src/main.tsx): theme tokens (primary teal, primaryShade light6/dark5, autoContrast, focusRing auto, cursorType pointer, component defaults) + `localStorageColorSchemeManager(key=crm-color-scheme)` + `defaultColorScheme="auto"` + `ModalsProvider` + Notifications autoClose.
- [index.html](../../client/index.html): script chống nháy (đặt data-mantine-color-scheme trước paint).
- [ColorSchemeToggle.tsx](../../client/src/components/ColorSchemeToggle.tsx): nút sun/moon, nhớ lựa chọn.
- [App.tsx](../../client/src/App.tsx): AppShell.Header (brand + burger + toggle), navbar thu gọn mobile; Main nền `light-dark()`.
- Bỏ `bg="gray.0"` cứng ở ListTable, CustomerDetailModal → `light-dark()`; bỏ inline `var(--mantine-color-teal-7)` ở DebtPaymentsManager.
- [styles.css](../../client/src/styles.css): transition hover/active mượt + reduced-motion.
- [docs/design-guidelines.md](../../docs/design-guidelines.md): tài liệu palette/token.

## Verify — ĐẠT
typecheck sạch · build OK · render Light/Dark/mobile · toggle persist sau reload · 0 lỗi console.
