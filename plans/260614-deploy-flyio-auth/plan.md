# Plan: Deploy Fly.io 24/7 + đăng nhập mật khẩu

**Date:** 2026-06-14 · **Status:** In progress
Mục tiêu: truy cập app mọi nơi/mọi thiết bị, chạy 24/7 (PC tắt vẫn dùng), bảo vệ bằng 1 mật khẩu.

## Phases
- [Phase 01 — Đăng nhập mật khẩu](phase-01-password-auth.md) — `in progress`
- [Phase 02 — Containerize + Fly.io deploy](phase-02-flyio-deploy.md) — `in progress`

## Quyết định
- Host: **Fly.io** (Docker + volume cho SQLite, máy nhỏ ~0-3$/th, region sin/Singapore).
- Auth: 1 mật khẩu (`APP_PASSWORD`) → cookie HMAC httpOnly. Tắt PC vẫn chạy nên BẮT BUỘC có gate.
- DB: SQLite trên persistent volume `/data/crm.db` (qua `CRM_DB_PATH` đã có sẵn).
- Auth tự tắt khi không set `APP_PASSWORD` (dev/test vẫn chạy không cần login).

## Verify
typecheck · build · vitest (33 + auth test) · chạy prod local có APP_PASSWORD (401 khi chưa login, 200 sau login) · hướng dẫn deploy flyctl.
