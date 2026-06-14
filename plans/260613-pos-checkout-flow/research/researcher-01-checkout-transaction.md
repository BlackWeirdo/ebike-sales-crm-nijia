# POS Checkout Flow: Transaction, Discount & Payment Research
**Date:** 2026-06-13 | **Scope:** Electron + better-sqlite3 + Drizzle atomicity, discount math, partial payment, receipt printing, deferred installment

---

## Executive Summary

**Atomic checkout** uses `db.transaction()` (better-sqlite3 sync) or `db.transaction()` (Drizzle async wrapper). Wrap entire checkout: insert sale → insert sales_items → decrement inventory → mark serialized units sold → insert warranty rows → create debt if partial payment. Rollback on any error. **Discount** stored sale-level only (simpler, POS standard); math: `(line_subtotal_sum - discount_vnd) = total` or `(line_subtotal_sum * (1 - discount_pct)) = total`, all integer VND, truncate remainder. **Partial payment** auto-creates debt row for `(total - paid)` if `paid < total`. **Receipt/invoice** via `webContents.printToPDF()` with HTML template, A4 for invoice/A5 landscape for slip, no dialog needed (silent save). **Installment (trả góp)** deferred: stub payment_method enum with `INSTALLMENT_DEFERRED` (visibly disabled in UI), no schema table yet, seam ready for v2.

---

## 1. Atomic Multi-Table Checkout Transaction

### Pattern: better-sqlite3 Synchronous `db.transaction()`

**better-sqlite3** provides synchronous transactions ideal for single-threaded desktop:
```typescript
const checkout = db.transaction((saleData) => {
  // Insert sale record
  const saleStmt = db.prepare(`
    INSERT INTO sales (customer_id, sale_date, total_vnd, discount_vnd, 
                       payment_method, paid_amount_vnd, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const saleResult = saleStmt.run(
    saleData.customerId,
    new Date().toISOString(),
    saleData.totalVnd,
    saleData.discountVnd,
    saleData.paymentMethod,
    saleData.paidAmountVnd,
    saleData.notes || null
  )
  const saleId = saleResult.lastInsertRowid

  // Insert each sale_item, handle serialized vs quantity
  const itemStmt = db.prepare(`
    INSERT INTO sales_items (sale_id, product_id, inventory_unit_id, qty, 
                             unit_price_vnd, line_discount_vnd)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  for (const item of saleData.items) {
    itemStmt.run(
      saleId,
      item.productId,
      item.inventoryUnitId || null,  // null for quantity-tracked
      item.qty,
      item.unitPriceVnd,
      item.lineDiscountVnd || 0
    )

    // If serialized: mark inventory_unit sold
    if (item.inventoryUnitId) {
      db.prepare(`
        UPDATE inventory_units 
        SET status = 'sold', sold_on_date = ?
        WHERE id = ?
      `).run(new Date().toISOString(), item.inventoryUnitId)
    } else {
      // Quantity-tracked: decrement stock
      db.prepare(`
        UPDATE product_quantities 
        SET qty_on_hand = qty_on_hand - ?
        WHERE product_id = ?
      `).run(item.qty, item.productId)
    }
  }

  // Insert warranty records (for serialized units only)
  const warrantyStmt = db.prepare(`
    INSERT INTO warranty_records (inventory_unit_id, component_type, 
                                  start_date, months, terms_vnd, excludes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  for (const item of saleData.items) {
    if (item.inventoryUnitId) {  // Bike sale
      const product = db.prepare('SELECT * FROM products WHERE id = ?')
        .get(item.productId)
      
      // Frame warranty
      warrantyStmt.run(
        item.inventoryUnitId,
        'frame',
        new Date().toISOString(),
        product.warranty_frame_months,
        product.warranty_frame_terms_vnd,
        null
      )
      
      // Battery warranty (if applicable)
      if (product.warranty_battery_months > 0) {
        warrantyStmt.run(
          item.inventoryUnitId,
          'battery',
          new Date().toISOString(),
          product.warranty_battery_months,
          product.warranty_battery_terms_vnd,
          null
        )
      }
    }
  }

  // Create debt if partial payment
  if (saleData.paidAmountVnd < saleData.totalVnd) {
    const remainingVnd = saleData.totalVnd - saleData.paidAmountVnd
    db.prepare(`
      INSERT INTO debts (customer_id, sale_id, issued_date, due_date, 
                         amount_vnd, status, notes)
      VALUES (?, ?, ?, ?, ?, 'open', ?)
    `).run(
      saleData.customerId,
      saleId,
      new Date().toISOString(),
      saleData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      remainingVnd,
      null
    )
  }

  return saleId  // Return for invoice printing
})

// Call transaction (sync, auto-rollback on throw)
try {
  const saleId = checkout(checkoutPayload)
  console.log(`Sale committed: ${saleId}`)
} catch (err) {
  // Transaction auto-rolled back; db still consistent
  console.error(`Checkout failed (rolled back): ${err.message}`)
  throw err
}
```

### Drizzle ORM Wrapper (Async Alternative)

If using Drizzle ORM with better-sqlite3:
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3'

const db = drizzle(sqliteDb)

await db.transaction(async (tx) => {
  const newSale = await tx.insert(sales).values({
    customerId: checkoutData.customerId,
    saleDate: new Date(),
    totalVnd: checkoutData.totalVnd,
    discountVnd: checkoutData.discountVnd,
    paymentMethod: checkoutData.paymentMethod,
    paidAmountVnd: checkoutData.paidAmountVnd,
  }).returning()

  for (const item of checkoutData.items) {
    await tx.insert(salesItems).values({
      saleId: newSale[0].id,
      productId: item.productId,
      inventoryUnitId: item.inventoryUnitId || null,
      qty: item.qty,
      unitPriceVnd: item.unitPriceVnd,
      lineDiscountVnd: item.lineDiscountVnd || 0,
    })

    if (item.inventoryUnitId) {
      await tx.update(inventoryUnits)
        .set({ status: 'sold', soldOnDate: new Date() })
        .where(eq(inventoryUnits.id, item.inventoryUnitId))
    } else {
      await tx.update(productQuantities)
        .set({ qtyOnHand: sql`${productQuantities.qtyOnHand} - ${item.qty}` })
        .where(eq(productQuantities.productId, item.productId))
    }
  }

  // Warranty + debt logic same as above
  return newSale[0].id
})
```

### Key Points
- **Synchronous** (`db.transaction()`) in better-sqlite3 runs entire block atomically; on throw, auto-rollback
- **Deferred vs Immediate**: Use `.deferred()` for read-heavy; `.exclusive()` for write-heavy conflicts (rare for single-user)
- **Savepoints**: Nested transactions become savepoints; inner rollback doesn't affect outer
- **No double-submit**: Add `UNIQUE(customer_id, sale_date, total_vnd)` constraint or idempotency key (UUID per session) to detect duplicate POST requests

---

## 2. Discount Calculation & Storage

### Recommended: Sale-Level Discount Only

**POS standard** stores discount at sale level, not per-item:
- Simpler schema (1 field: `sales.discount_vnd`)
- Matches operator workflow (enter total, apply % or fixed discount, confirm)
- Recalculation risk eliminated (line discounts compound complexity)

### Math & Rounding (Integer VND)

**Order of operations:**
1. Calculate line subtotals: `qty × unit_price_vnd`
2. Sum all lines: `Σ line_subtotal_vnd`
3. Apply discount:
   - **Fixed VND:** `total = line_sum - discount_vnd` (e.g., 500k - 50k = 450k)
   - **Percent:** `total = floor(line_sum × (1 - discount_pct / 100))` (e.g., 500k × 0.9 = 450k)
4. No rounding of intermediate steps; truncate only at final total

**Example (percent discount):**
```typescript
const lineSumVnd = items.reduce((sum, item) => sum + (item.qty * item.unitPriceVnd), 0)
const discountPercentage = 10  // 10%
const totalVnd = Math.floor(lineSumVnd * (1 - discountPercentage / 100))
// 500,000 × 0.9 = 450,000 (exact, no rounding error)

const discountVnd = lineSumVnd - totalVnd  // 50,000 (derived, not input)
```

**Example (fixed VND):**
```typescript
const discountVnd = 50000  // Hard input
const totalVnd = lineSumVnd - discountVnd  // 500k - 50k = 450k
```

### Schema
```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  sale_date TEXT NOT NULL,
  total_vnd INTEGER NOT NULL,      -- After discount
  discount_vnd INTEGER DEFAULT 0,  -- Discount amount (fixed or % calc)
  payment_method TEXT NOT NULL,    -- 'cash', 'bank_transfer'
  paid_amount_vnd INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
)
```

**No `sales_items.line_discount_vnd`** (avoid per-item discount complexity unless explicitly required by v2)

### Validation
- `discount_vnd < total_vnd` (can't exceed total)
- `discount_vnd >= 0` (non-negative)
- `paid_amount_vnd >= 0` (non-negative)

---

## 3. Partial Payment & Debt Creation

### Logic: Auto-Create Debt if `paid_amount < total`

**In checkout transaction:**
```typescript
if (paidAmountVnd < totalVnd) {
  const remainingVnd = totalVnd - paidAmountVnd
  db.prepare(`
    INSERT INTO debts (customer_id, sale_id, issued_date, due_date, 
                       amount_vnd, status, notes)
    VALUES (?, ?, ?, ?, ?, 'open', ?)
  `).run(
    customerId,
    saleId,
    new Date().toISOString(),
    dueDate,  // Default 30 days from sale_date or custom
    remainingVnd,
    null
  )
  // Record payment method for debt reminder
  db.prepare(`
    INSERT INTO debt_payments (debt_id, payment_date, amount_vnd, method)
    VALUES (?, ?, ?, ?)
  `).run(
    debtId,
    new Date().toISOString(),
    paidAmountVnd,
    paymentMethod  // 'cash' or 'bank_transfer'
  )
}
```

### Schema
```sql
CREATE TABLE debts (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  sale_id INTEGER,
  issued_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL,  -- Original debt amount
  status TEXT DEFAULT 'open',   -- 'open', 'partial', 'paid'
  notes TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  UNIQUE(sale_id)  -- One debt per sale (or allow multiple for installment v2)
)

CREATE TABLE debt_payments (
  id INTEGER PRIMARY KEY,
  debt_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL,
  method TEXT,  -- 'cash', 'bank_transfer', etc.
  notes TEXT,
  FOREIGN KEY (debt_id) REFERENCES debts(id)
)
```

### Status Computation (Not Stored)
```sql
SELECT 
  d.id, d.amount_vnd,
  COALESCE(SUM(dp.amount_vnd), 0) as paid_vnd,
  d.amount_vnd - COALESCE(SUM(dp.amount_vnd), 0) as remaining_vnd,
  CASE 
    WHEN COALESCE(SUM(dp.amount_vnd), 0) = 0 THEN 'open'
    WHEN COALESCE(SUM(dp.amount_vnd), 0) < d.amount_vnd THEN 'partial'
    ELSE 'paid'
  END as computed_status
FROM debts d
LEFT JOIN debt_payments dp ON d.id = dp.debt_id
GROUP BY d.id
```

---

## 4. Invoice/Receipt Printing: `webContents.printToPDF()`

### Recommended: `printToPDF()` + HTML Template (Simplest)

**Why NOT `window.print()`:**
- Opens native print dialog (user must confirm)
- Less control over PDF output
- Can't silently save PDF without user action

**Why `printToPDF()`:**
- Headless, automated; no dialog
- Full control over page size, margins, output path
- Async; doesn't block UI
- Built-in Electron API (no external PDF lib needed)

### Pattern: Render HTML Template → Save PDF

**Main Process (IPC Handler):**
```typescript
import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

ipcMain.handle('print:invoice', async (event, saleData) => {
  // 1. Create hidden BrowserWindow for rendering
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false }
  })

  // 2. Load HTML template with injected data
  const invoiceHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { size: A4; margin: 1cm; }
          body { font-family: Arial; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .total { font-size: 18px; font-weight: bold; margin-top: 30px; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>eBike Shop Invoice</h1>
          <p>Invoice #${saleData.saleId} | ${new Date(saleData.saleDate).toLocaleDateString()}</p>
        </div>
        <div class="customer">
          <p><strong>${saleData.customerName}</strong></p>
          <p>${saleData.customerPhone}</p>
        </div>
        <table style="width: 100%; margin-top: 20px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th>Item</th><th>Qty</th><th>Price (VND)</th><th>Total (VND)</th>
            </tr>
          </thead>
          <tbody>
            ${saleData.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${item.unitPriceVnd.toLocaleString('vi-VN')}</td>
                <td>${(item.qty * item.unitPriceVnd).toLocaleString('vi-VN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">
          Subtotal: ${saleData.subtotalVnd.toLocaleString('vi-VN')} VND<br>
          Discount: -${saleData.discountVnd.toLocaleString('vi-VN')} VND<br>
          <strong>Total: ${saleData.totalVnd.toLocaleString('vi-VN')} VND</strong><br>
          Paid: ${saleData.paidAmountVnd.toLocaleString('vi-VN')} VND<br>
          ${saleData.paidAmountVnd < saleData.totalVnd ? 
            `Remaining Debt: ${(saleData.totalVnd - saleData.paidAmountVnd).toLocaleString('vi-VN')} VND` : ''}
        </div>
      </body>
    </html>
  `

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(invoiceHtml)}`)

  // 3. Generate PDF
  const pdfPath = path.join(
    app.getPath('userData'),
    'invoices',
    `invoice-${saleData.saleId}-${Date.now()}.pdf`
  )
  
  // Create invoices dir if missing
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true })

  const pdfData = await printWindow.webContents.printToPDF({
    pageSize: 'A4',
    landscape: false,
    margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },  // cm
    printBackground: true
  })

  await fs.promises.writeFile(pdfPath, pdfData)
  printWindow.close()

  return { success: true, pdfPath }
})
```

**Renderer (React Component):**
```typescript
const handlePrintInvoice = async () => {
  const result = await window.ipc.invoke('print:invoice', {
    saleId: sale.id,
    saleDate: sale.sale_date,
    customerName: customer.name,
    customerPhone: customer.phone,
    items: saleItems,
    subtotalVnd: lineSumVnd,
    discountVnd: sale.discount_vnd,
    totalVnd: sale.total_vnd,
    paidAmountVnd: sale.paid_amount_vnd
  })

  if (result.success) {
    alert(`Invoice saved to ${result.pdfPath}`)
    // Optionally: open file explorer or default PDF viewer
  }
}
```

### A5 Landscape (Warranty Slip / Thermal Label Alternative)
```typescript
const pdfData = await printWindow.webContents.printToPDF({
  pageSize: 'A5',
  landscape: true,
  margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 },
  printBackground: true
})
```

### Key Points
- No `window.print()` dialog; fully automated
- Save PDFs to `app.getPath('userData')/invoices/` for archival
- Use `data:` URL or file path to load HTML into BrowserWindow
- Hide window (`show: false`) to avoid flicker
- Call `.close()` after PDF generation to clean up

---

## 5. Cleanly Deferring Installment (Trả Góp) Without Dead Code

### Problem
- v1 doesn't support installment
- UI should visibly disable installment option
- Schema must not have premature tables (YAGNI)
- Code must not have dead conditional branches

### Solution: Enum + UI Stub + Seam

**Schema (v1):**
```sql
CREATE TABLE sales (
  ...
  payment_method TEXT NOT NULL,  -- 'cash', 'bank_transfer', 'installment_deferred'
  ...
)
```

**Enum definition (TypeScript):**
```typescript
export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  INSTALLMENT_DEFERRED = 'installment_deferred',  // Visibly disabled in UI
}

export const ACTIVE_PAYMENT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
]

export const DEFERRED_PAYMENT_METHODS = [
  PaymentMethod.INSTALLMENT_DEFERRED,
]
```

**UI (React):**
```typescript
const paymentOptions = [
  { label: 'Cash', value: 'cash', enabled: true },
  { label: 'Bank Transfer', value: 'bank_transfer', enabled: true },
  { label: 'Installment (v2)', value: 'installment_deferred', enabled: false, tooltip: 'Coming in v2' },
]

<fieldset>
  {paymentOptions.map(option => (
    <label key={option.value} style={{ opacity: option.enabled ? 1 : 0.5 }}>
      <input 
        type="radio" 
        name="payment_method" 
        value={option.value}
        disabled={!option.enabled}
      />
      {option.label}
      {!option.enabled && <span title={option.tooltip}> (v2)</span>}
    </label>
  ))}
</fieldset>
```

**Checkout Validation:**
```typescript
if (!ACTIVE_PAYMENT_METHODS.includes(selectedPaymentMethod)) {
  throw new Error(`Payment method ${selectedPaymentMethod} not available in v1`)
}
```

### For v2
Simply:
1. Move `INSTALLMENT_DEFERRED` from `DEFERRED_PAYMENT_METHODS` to `ACTIVE_PAYMENT_METHODS`
2. Add `installment_schedules` table (deferred allocation)
3. Implement installment validation in checkout
4. No schema migration needed (already stored as enum string)

### No Dead Code
- Installment logic not written; enum visibility handles deferral
- Checkout doesn't check for installment (would be empty branch)
- UI declaratively shows disabled state; no conditional rendering needed

---

## Implementation Order (Atomic POS Flow)

1. **Schema:** Create `sales`, `sales_items`, `inventory_units` (if serialized), `warranty_records`, `debts`, `debt_payments`
2. **Checkout transaction:** Wrap multi-table insert + inventory updates + warranty creation + debt row
3. **Discount UI:** Render % or fixed VND input, validate < total
4. **Partial payment:** Check `paid < total` in checkout, auto-create debt row
5. **Receipt printing:** IPC handler + hidden BrowserWindow + `printToPDF()` → save to `~/userData/invoices/`
6. **Payment method UI:** Enum-driven, `INSTALLMENT_DEFERRED` disabled with tooltip

---

## Unresolved Questions

1. **Idempotency key**: Should checkout endpoint store request UUID + sale_id in a dedup table to prevent double-submit on network retry?
2. **Installment v2 schema**: Will installment_schedules table need separate debts rows per schedule, or single debt with child schedule records?
3. **Warranty claim approval**: Auto-approve claims within terms_vnd, or require manual review? (Affects warranty_claims.status enum)
4. **Tax (VAT)**: Is v1 tax-free, or should sales_items.line_tax_vnd be reserved for v2?
5. **Printer integration**: Should receipt support direct thermal printer (ESC/POS) via serial port, or just PDF save? (Outside scope but relevant for future)

---

## References

- **better-sqlite3 Transactions**: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfn
- **Drizzle ORM Transactions**: https://orm.drizzle.team/docs/transactions
- **Electron webContents.printToPDF()**: https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdf
- **SQLite SAVEPOINT**: https://www.sqlite.org/lang_savepoint.html
- **POS Discount Patterns**: https://www.shopify.dev/docs/api/admin-rest/2024-07/resources/order#resource-object (reference for discount storage)
- **VND Currency Handling**: https://cardinalby.github.io/blog/post/best-practices/storing-currency-values-data-types/
