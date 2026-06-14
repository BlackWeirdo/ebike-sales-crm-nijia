# E-Bike Shop CRM: Domain Model & Feature Research
**Date:** 2026-06-13 | **Scope:** v1 POS/Inventory/Warranty/Debt patterns for single-user SQLite (Drizzle ORM)

---

## 1. Serialized vs. Quantity Inventory Pattern

**Key Finding:** Dual-mode tracking required.

### Bikes (Serialized)
- **Pattern:** `products` table with `type_flag='SERIALIZED'` + separate `inventory_units` table
- **One row per physical unit:** serial_number (unique), status (in_stock/sold/reserved/returned), cost, acquired_date
- **POS Sale:** References specific unit ID, moves status to sold_on_date; auditable trail
- **Schema example:**
  ```
  products: id, sku, name, type (SERIALIZED/QUANTITY), cost_vnd, warranty_frame_months, warranty_battery_months
  inventory_units: id, product_id, serial_number (unique), status, cost_vnd, acquired_date, sold_on_date
  sales_items: sale_id, inventory_unit_id (for serialized) OR product_id + qty (for quantity)
  ```
- **Industry:** Lightspeed/MicroBiz handle this with serial tracking on per-bike basis; reduces stock discrepancies ~30%

### Accessories/Chargers (Quantity-Tracked)
- **Pattern:** `products` type_flag='QUANTITY' + decrement qty on sale
- **No inventory_units row;** `product_quantities` table tracks current_qty, reserved_qty
- **POS Sale:** Decrements qty_on_hand; no unit reference
- **Benefit:** Simpler math for consumables, headset spacers, batteries (if not serialized separately)

### Recommendation
Two inventory modes avoid bloat. Flag on products.type; sales logic branches accordingly.

---

## 2. Warranty Model: Multi-Record by Component

**Key Finding:** Frame ≠ Battery (different terms, service windows).

### Pattern
- **One sold bike → Multiple warranty records**
  ```
  warranty_records:
    id, inventory_unit_id, component_type (frame/battery/drivetrain), 
    start_date, end_date (or months + start → computed end), 
    terms_vnd (coverage amount), excludes (json/text notes), 
    next_service_date (derived from usage or fixed schedule)
  ```
- **Frame warranty:** Typically 2–5 years, structural defects
- **Battery warranty:** 1–3 years, separate prorated coverage (typical auto EV pattern: full replacement 1yr, pro-rata after)
- **Drivetrain (optional):** 6–12 months, wear items

### Maintenance Reminder Tracking
- `next_service_date` per warranty_record (or per unit if shared schedule)
- Computed at sale: `start_date + interval_months`, not pre-bucketed
- Report query: `WHERE next_service_date BETWEEN today AND today+30` → upcoming maintenance list
- **Pattern:** Single query, no stored buckets

### Warranty Claim Flow
- `warranty_claims` table: claim_id, warranty_record_id, claim_date, issue_description, resolution, cost_approved_vnd
- Claim references warranty_record (component), checks if claim_date <= end_date, verifies coverage terms

### Recommendation
Separate rows per component. Calculated dates keep schema flexible for custom terms. Avoid warranty_status enums; use `end_date >= today` logic.

---

## 3. Debt (Công Nợ) / Receivables Model

**Key Finding:** Compute aging from transaction dates; no pre-bucketed columns.

### Pattern
```
debts:
  id, customer_id, sale_id (or invoice_id), issued_date, due_date, amount_vnd, 
  status (open/partial/paid), notes

debt_payments:
  id, debt_id, payment_date, amount_vnd, method (cash/transfer/credit), notes
```

### Aging Report (Computed, Not Stored)
- **Query logic** (SQL pseudocode):
  ```
  CASE
    WHEN DATE_DIFF(days, due_date, TODAY) <= 0 THEN 'Current'
    WHEN DATE_DIFF(days, due_date, TODAY) BETWEEN 1 AND 30 THEN '1-30'
    WHEN DATE_DIFF(days, due_date, TODAY) BETWEEN 31 AND 60 THEN '31-60'
    WHEN DATE_DIFF(days, due_date, TODAY) BETWEEN 61 AND 90 THEN '61-90'
    ELSE '90+'
  END AS age_bucket
  ```
- **No stored aging_bucket column** → Always current, no reconciliation required
- **Outstanding balance:** `SUM(debts.amount) - SUM(debt_payments.amount) GROUP BY customer_id`
- **Source:** Victoria Yudin pattern (Oracle Receivables) replicable in SQLite

### Partial Payment Handling
- Each debt_payment row is a transaction; sum per debt to get balance
- Status = 'partial' if `sum(payments) > 0 AND sum(payments) < debt_amount`
- No overpayment tracking needed (v1 scope)

### Report Deliverable
- Aging report: group by age_bucket, sum amount_vnd, count debts, show customer name
- Single query execution; always reflects current date

### Recommendation
Date arithmetic in queries. Avoids bucket maintenance headaches. Drizzle ORM can template the CASE logic.

---

## 4. Money Handling: INTEGER VND (Zero-Decimal)

**Key Finding:** Store as plain integers; no conversion factor.

### Why Not Float
- Base-2 floating-point ≠ base-10 human math: `0.1 + 0.2 ≠ 0.3` in IEEE 754
- Financial systems require exact arithmetic; even tiny rounding errors cascade

### SQLite INTEGER Pattern for VND
- VND has **no decimal places** (unlike USD cents)
- Store 1,000,000 VND as integer `1000000`; no conversion factor needed
- Query: `SELECT amount_vnd / 1.0` for display formatting in app layer
- **Type:** `INTEGER` in schema, `number` in app (JavaScript handles cleanly)

### Where Money Appears (Schema)
```
inventory_units.cost_vnd
products.selling_price_vnd
sales_items.line_total_vnd (qty or 1 × unit_price - discount)
sales.total_vnd, discount_vnd, tax_vnd (if applicable)
debt.amount_vnd
warranty_records.terms_vnd (max coverage)
warranty_claims.cost_approved_vnd
```

### Line Item Math
- `line_total_vnd = unit_price_vnd × quantity - line_discount_vnd + line_tax_vnd`
- All integers; no rounding until display
- Sale totals: sum line totals, apply bulk discounts, apply payment method markup

### Recommendation
Treat money as integers throughout schema. Format for display in Electron app only. Avoids 99% of accounting headaches.

---

## 5. Warranty Slip Printing: Electron HTML → PDF

**Key Finding:** `webContents.printToPDF()` + HTML template sufficient; no heavy lib needed.

### Pattern: HTML Template in Electron
```html
<!-- warranty-slip.html -->
<html>
  <head>
    <style media="print">
      @page { size: A5 landscape; margin: 0.5cm; }
      .qr-code { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <div class="warranty-header">
      <h2>WARRANTY CERTIFICATE</h2>
      <p>Serial: {{serial_number}}</p>
      <p>Customer: {{customer_name}}</p>
    </div>
    <table>
      <tr><td>Frame:</td><td>{{frame_end_date}}</td></tr>
      <tr><td>Battery:</td><td>{{battery_end_date}}</td></tr>
    </table>
    <div class="qr-code">{{qr_code_svg}}</div>
  </body>
</html>
```

### Electron API
- Load HTML template (or render in React/Vue, send DOM to process)
- `webContents.printToPDF(options)` → Buffer → save/print
- Options:
  ```javascript
  {
    pageSize: 'A5',  // or 'A4', or custom { width, height } in microns
    margins: { top: 500, bottom: 500, left: 500, right: 500 },
    printBackground: true,
    headerTemplate: '',  // can add page numbers if needed
    footerTemplate: ''
  }
  ```

### Recommended Approach (No External PDF Lib)
- **Render warranty HTML in main process or pass to BrowserWindow**
- **Call printToPDF()** on success, save to `~/Downloads/warranty-{serial}.pdf`
- **Optional:** Use native `dialog.showSaveDialog()` for user file path
- **Print:** `webContents.print()` for direct printer output (A5 roll labels, A4 slips)

### Why Not PDF Library
- electron-pdf, jsreport-electron-pdf add complexity, sandbox issues
- printToPDF() is built-in, simpler, fewer deps
- For warranty slip (simple layout), HTML/CSS sufficient
- QR code: generate as SVG or use `qrcode.js` lib (lightweight), embed as <img>

### Recommendation
Template HTML + printToPDF(). Keep Electron deps minimal. A5 landscape for roll labels, A4 for customer slips.

---

## Proposed v1 Table List (with key columns & relationships)

| Table | Key Columns | Relationships | Notes |
|-------|---|---|---|
| **products** | id, sku, name, type (SERIALIZED\|QUANTITY), cost_vnd, selling_price_vnd, warranty_frame_months, warranty_battery_months | ← inventory_units, → sales_items | Bikes + accessories |
| **inventory_units** | id, product_id, serial_number (unique), status, cost_vnd, acquired_date, sold_on_date | ← warranty_records, ← sales_items, → sales | Only for type=SERIALIZED |
| **customers** | id, name, phone, email, address, debt_limit_vnd | ← sales, ← warranty_records | Single-user view |
| **sales** | id, customer_id, sale_date, total_vnd, discount_vnd, payment_method, notes | ← sales_items, ← debts | POS transaction |
| **sales_items** | id, sale_id, product_id (nullable), inventory_unit_id (nullable), qty, unit_price_vnd, line_discount_vnd | product_id OR inventory_unit_id (not both) | Qty or serial per line |
| **warranty_records** | id, inventory_unit_id, component_type, start_date, months, terms_vnd, excludes | ← warranty_claims | Per bike component |
| **warranty_claims** | id, warranty_record_id, claim_date, issue_description, resolution, cost_approved_vnd, status | → warranty_records | Claim lifecycle |
| **debts** | id, customer_id, sale_id (optional), issued_date, due_date, amount_vnd, status, notes | ← debt_payments | Receivables |
| **debt_payments** | id, debt_id, payment_date, amount_vnd, method, notes | → debts | Partial payment trail |

---

## Implementation Priorities (v1)

1. **Inventory:** products + inventory_units, POS logic branching on type
2. **Sales:** sales + sales_items with dual-mode references
3. **Warranty:** warranty_records per component, no aging buckets
4. **Debt:** debts + debt_payments, aging computed in SQL
5. **Money:** Integer VND throughout; format in UI only
6. **Printing:** HTML template + Electron printToPDF, skip PDF libs

---

## Sources Cited

- [ConnectPOS: Bike Shop POS System](https://www.connectpos.com/bike-shop-point-of-sale-system-for-your-business/)
- [Lightspeed Commerce: Bike Shop POS](https://www.lightspeedhq.com/pos/retail/bike-shop/)
- [MicroBiz: Bicycle Store POS](https://www.microbiz.com/bicycle-store-pos/)
- [Victoria Yudin: Receivables SQL Patterns](https://victoriayudin.com/gp-reports/receivables-sql-views/)
- [SQLBi: Account Receivable Aging in Power BI](https://www.sqlbi.com/articles/account-receivable-aging-in-power-bi/)
- [DataCamp: SQLite Data Types](https://www.datacamp.com/tutorial/sqlite-data-types)
- [Storing Currency Values Best Practices](https://cardinalby.github.io/blog/post/best-practices/storing-currency-values-data-types/)
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents)

---

## Unresolved Questions

1. **QR code payload:** Should warranty slip QR encode unit ID, serial number, or customer contact? (Affects HTML template data)
2. **Tax handling:** Is VAT applied in v1 or defer to v2? (Affects sales_items schema)
3. **Bike customization options:** Should product_variants table track colors/sizes, or hardcode per SKU? (Inventory granularity)
4. **Warranty claim approval workflow:** Auto-approve, manual, or two-tier (staff/manager)? (Warranty_claims status enum)
5. **Debt grace period:** Is due_date absolute or does terms allow X-day grace? (Affects aging bucket cutoffs)
