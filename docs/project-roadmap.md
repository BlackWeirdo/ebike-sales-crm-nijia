# DevPocket CRM — Project Roadmap

**Project:** Ứng dụng quản lý cửa hàng xe đạp điện (CRM) · **Updated:** 2026-06-24 · **Version:** 0.3.1

## Tóm tắt trạng thái hiện tại

Stack: React+Vite+TS+Mantine (client) · Node+Express+TS+SQLite (server) · shared types · Web full-stack 1 người dùng, chạy local port 3001.

**Overall Progress:** 90% (16/16 MVP module xong + 2 post-MVP feature)

---

## Phase 1: DONE — Core Business Logic & UI Foundation + Post-MVP Feature Work (100%)

### Completed Modules

| Module | Status | Ngày hoàn | Chi tiết |
|--------|--------|----------|---------|
| **01. Tồn kho (Inventory)** | ✅ Done | 2026-06-13 | CRUD sản phẩm, serial tracking (mua/bán/hỏng), tình trạng stock, giá vốn. ListTable, search, sort, phân trang. |
| **02. Bán hàng (POS Sales)** | ✅ Done | 2026-06-13 | Tạo hóa đơn, chọn SP từ kho, nhập khách/số lượng, tính tổng & CK, lưu DB. Print hóa đơn định dạng. |
| **03. Khách hàng (Customers)** | ✅ Done | 2026-06-13 | CRUD khách (Cá nhân/Đại lý), số điện thoại, địa chỉ, ghi chú. Lịch sử giao dịch, modal chi tiết, link sang công nợ. |
| **04. Công nợ (Debt Management)** | ✅ Done | 2026-06-13 | Theo dõi công nợ theo khách, tạo phiếu ghi nợ, thay đổi trạng thái (chờ/thanh toán), xuất phiếu. |
| **05. Hóa đơn in (Invoice Print)** | ✅ Done | 2026-06-13 | Template hóa đơn A4, hiển thị hàng hóa, tính tiền, in qua trình duyệt. |
| **06. Dashboard — Tổng quan + 8 biểu đồ** | ✅ Done | 2026-06-14 | 2 endpoint `/dashboard/customer-analytics` + `/product-analytics` (backend) · 8 biểu đồ Recharts (KH donut/bar, khách mới series, công nợ donut, SP loại donut, top SP composite, tồn kho donut, giá trị tồn bar). Tôn trọng bộ lọc Từ/Đến (trừ tồn kho/công nợ = point-in-time). |
| **07. Dark Mode & Theme** | ✅ Done | 2026-06-14 | Bộ màu thống nhất (primary teal, auto contrast). Auto-theo-OS + nhớ qua localStorage. ColorSchemeToggle ở Header. Anti-FOUC script. |
| **08. UX Polish** | ✅ Done | 2026-06-14 | Confirm/loading modal @mantine/modals + toast có icon. LoadingBlock + skeleton. Responsive AppShell + burger. A11y (aria-label, tabIndex+Enter). Transitions mượt + reduced-motion. |
| **09. Invoice Finance Fix** | ✅ Done | 2026-06-24 | Invoice shows discount (line + order level) + uses collectedVnd/remainingVnd. Paid orders no longer mislabeled as owing. |
| **10. Sửa đơn bán (Edit Sale)** | ✅ Done | 2026-06-24 | Full edit mode via SaleForm + `salesRepo.update()` atomic txn (reverse inventory → drop old debt/items → reapply → rebuild debt) + PUT /sales/:id. Money-loss guard: new paidVnd must cover already-collected; warns on installment consolidation/overpay post-discount. Use case: apply retroactive discount to old orders. |
| **11. Danh mục SP Xe/Phụ kiện** | ✅ Done | 2026-06-24 | New `category` field on products (independent of storage `type` serial/quantity). Schema column + migration (existing rows default 'bike'). Wired through types/repo/routes/labels/charts/ProductsPage/Excel import. Dashboard groups revenue by category. Fixes "Doanh thu theo loại SP" mislabeling bulk-sold bikes (QUANTITY) as accessories. |

### Refactor & Code Quality

| Hạng mục | Chi tiết |
|----------|---------|
| **Tách component dài** | SalesPage 577→82, ProductsPage 500→216, CustomersPage 434→213, DashboardPage 384→151 lines. DRY module: lib/notify.ts, components/ListTable.tsx, server/lib/http.ts (middleware). |
| **Test Suite** | 53 test / 6+ file (vitest + supertest). DB test in-memory cô lập. Scripts `npm test` / `npm run test:watch`. |
| **Bundle Optimization** | main 1060KB→320KB (gzip 306→101KB). Lazy-load Dashboard/xlsx chunk riêng (React.lazy+Suspense). |
| **Routes cleanup** | Xóa `/products/low-stock` dead route. Đổi tên rõ nghĩa, config rõ ràng. |

---

## Phase 2: PROPOSED — Future Roadmap

### High Priority (Nên làm)

#### 🔷 CI/CD & Quality Gate
- [ ] **GitHub Actions / GitLab CI** — npm test + npm run build trên mỗi PR
- [ ] **Test client components** — vitest + @testing-library/react cho components (Modal, ListTable, Chart, etc.)
- [ ] **E2E test** — Playwright hoặc Cypress cho 1-2 flow chính (tạo hóa đơn, thanh toán)
- **Impact:** Tự động hóa QA, phát hiện regression sớm. **Est. effort:** 8-12h

#### 🔷 Data Backup & Restore
- [ ] **Export/Import SQLite** — UI button tại dashboard, download `.db` file, upload restore
- [ ] **Scheduled backup** — Node cron job hoặc manual trigger, lưu drive/USB
- **Impact:** An toàn dữ liệu, khôi phục sau sự cố. **Est. effort:** 6-8h

#### 🔷 Report & Export (Excel/PDF)
- [ ] **Excel export** — Doanh số, khách hàng, công nợ theo khoảng ngày (dùng `xlsx` library)
- [ ] **PDF report** — Template báo cáo tháng (tổng doanh thu, top sản phẩm, khách mất, etc.) qua `pdfkit`
- [ ] **Scheduled report** — Email/download hàng tháng tự động
- **Impact:** Hỗ trợ báo cáo quản lý, quyết định. **Est. effort:** 12-16h

#### 🔷 Mobile Optimization (Deep)
- [ ] **Responsive chart** — Recharts mobile-friendly (không quá rộng)
- [ ] **Touch-friendly UI** — Button/tap target ≥48px, gesture support
- [ ] **Offline sync** — IndexedDB cache + sync khi online
- **Impact:** Dùng trên điện thoại/tablet thực tế. **Est. effort:** 10-14h

### Medium Priority (Sau này)

#### 🔶 Multi-User & Authentication
- [ ] **User login** — JWT/session, role (Admin/Staff/View)
- [ ] **Permission** — Tạo hóa đơn/xóa/duyệt theo role
- [ ] **Audit log** — Ghi ai làm gì khi
- **Impact:** Dùng nhân viên nhiều, bảo mật. **Est. effort:** 20-24h

#### 🔶 Advanced Features
- [ ] **Supplier intake & payable** — Nhập hàng, theo dõi nợ nhà cung cấp
- [ ] **Warranty & Maintenance** — Bảo hành sản phẩm, dịch vụ bảo trì
- [ ] **Automatic re-order** — Alert tồn kho thấp, tạo đơn nhập tự động
- **Impact:** Quản lý toàn chuỗi supply, khách hàng hài lòng. **Est. effort:** 24-32h

#### 🔶 Analytics & Insights
- [ ] **Trend analysis** — Doanh thu/KH theo tháng, so sánh năm nay vs năm ngoái
- [ ] **Customer lifetime value (CLV)** — Tính giá trị dài hạn KH
- [ ] **Inventory forecast** — Dự đoán nhu cầu SP (simple moving average)
- **Impact:** Hỗ trợ chiến lược kinh doanh. **Est. effort:** 16-20h

---

## Technical Debt & Improvements

| Item | Priority | Est. effort |
|------|----------|-------------|
| Migrate to Drizzle ORM (từ hand-written SQL) | Low | 16h |
| E2E test coverage (Playwright 5+ scenarios) | Medium | 12h |
| React Query / TanStack Query (server state) | Medium | 8h |
| Zod validation schemas (shared client+server) | Low | 6h |
| Docker + docker-compose (dev environment) | Low | 4h |

---

## Constraints & Assumptions

1. **Single user local** — Chạy trên 1 máy, 1 người dùng (hiện tại). Nếu mở rộng → thêm auth.
2. **SQLite** — Đủ cho ~10k khách, ~50k hóa đơn. Nếu scale lớn → PostgreSQL/MySQL.
3. **No cloud** — Chạy local, không cloud sync (nếu cần → thêm backend server + replication).
4. **Browser-based** — Không Electron/Tauri hiện tại. Nếu desktop → thêm package.
5. **Mobile responsive** — UI thích ứng, nhưng chưa progressive web app (PWA).

---

## Success Metrics

✅ **Delivered (hiện tại):**
- 8 biểu đồ dashboard chạy ổn định (0 lỗi console, typecheck sạch)
- 53 unit test pass, DB test cô lập
- Bundle < 320KB gzip (lazy-load OK)
- Dark mode, responsive, a11y pass
- Tất cả 5 trang chính (Tồn kho, Bán hàng, Khách hàng, Công nợ, Tổng quan) hoạt động trọn vẹn
- Invoice tài chính chính xác (discount line + order level, collectedVnd/remainingVnd, no false "owing" on paid orders)
- Edit sale full workflow (atomic reverse/reapply inventory, debt consistency, retroactive discount + money-loss guard)
- Product category system (separate from storage type, category-based revenue reporting, dashboard groups by category)

📈 **Next milestones:**
- 50+ test (client components + E2E)
- CI/CD xanh trên GitHub Actions
- Backup/restore tự động
- Excel/PDF export
- Mobile-first cải thiện

---

## Timeline

| Phase | Thời gian | Status |
|-------|----------|--------|
| **Phase 1: MVP + Post-MVP Features** | 2026-06-13 ～ 2026-06-24 | ✅ Done |
| **Phase 2: Quality & Export** | Est. 2026-06-25 ～ 2026-07-05 | ⏳ Proposed |
| **Phase 3: Multi-user & Advanced** | Est. 2026-07-06 onwards | 🔄 Future scope |

---

## Notes for Stakeholders

**Tình trạng:** Ứng dụng CRM hoàn chức năng + post-MVP order edit & category features. 53 test pass, typecheck sạch, build clean. Sẵn sàng dùng hằng ngày.  
**Chất lượng:** typecheck sạch, build OK, 53 test pass, 0 lỗi console, responsive, dark mode, a11y cơ bản, tài chính chính xác.  
**Vừa thêm (2026-06-24):** Sửa đơn bán (atomic, money-loss guard), danh mục SP Xe/Phụ kiện (category-based revenue), hóa đơn tài chính fix.  
**Tiếp theo:** Ưu tiên CI/CD tự động hóa test, backup dữ liệu, rồi báo cáo Excel/PDF.

---

*Document generated: 2026-06-24 · Next review: 2026-07-05*
