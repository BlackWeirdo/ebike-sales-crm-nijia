# Supplier Goods-Intake + Accounts-Payable Data Model (v2)
**Date:** 2026-06-13 | **Scope:** Simplified supplier → receipt → stock → payable (NO PO lifecycle)  
**Stack:** Electron + better-sqlite3 + Drizzle | **Money:** INTEGER VND

---

## Executive Summary

**Findings & Recommendations (in order of priority):**

1. **Debt Table Design:** Use **2 separate tables** (`supplier_debts`, keep existing `debts` for customer receivables) — NOT unified w/ direction flag. DRY applies to code (shared payment logic), not schema. Separate semantics (revenue ≠ cost), GL posting, audit rules justify duplication. Oracle Financials pattern.

2. **Suppliers Table:** Minimal schema: `id, name, phone, address, payment_terms_days, tax_id, notes, is_active`. **Add:** `default_payment_method` (impacts payment reconciliation). Keep lightweight—NO discount_percentage (YAGNI).

3. **Goods Receipt Flow:** Separate `goods_receipts` table (NOT intake_type flag). Links supplier → receipt_items (product_id, qty, unit_cost) → auto-creates inventory_units (serialized bikes) OR increments product.qty_on_hand (accessories) → triggers supplier_debts payable. Different domain from general stock intake (distinct GL posting).

4. **Stock Movements Ledger:** **Implement.** Retail shrinkage detection essential ($90B lost in US 2025). For single-location: 1-2 INSERTs/day = negligible overhead. Tracks receipt, sale, adjustment, count as immutable ledger; enables reconciliation ↔ GL. YAGNI does NOT apply.

5. **Payable Auto-Create:** Standard AP workflow. On receipt INSERT: trigger creates supplier_debts row, amount=total_cost, due_date=receipt_date + supplier.payment_terms_days. Partial payments via existing debt_payments pattern.

---

## Schema Changes to Phase-02

### NEW Tables (for v2)

**suppliers**
```
id (INTEGER PK)
name (TEXT NOT NULL)
phone (TEXT)
address (TEXT)
payment_terms_days (INTEGER, default 30)
tax_id (TEXT)
default_payment_method (TEXT: 'transfer'|'check'|'cash')
notes (TEXT)
is_active (INTEGER bool, default 1)
created_at (TEXT ISO8601)
```

**goods_receipts**
```
id (INTEGER PK)
supplier_id (INTEGER FK → suppliers.id)
receipt_date (TEXT ISO8601)
reference_number (TEXT) — supplier invoice #
total_cost_vnd (INTEGER)
received_by (TEXT)
notes (TEXT)
created_at (TEXT ISO8601)
```

**receipt_items**
```
id (INTEGER PK)
goods_receipt_id (INTEGER FK → goods_receipts.id)
product_id (INTEGER FK → products.id)
quantity (INTEGER)
unit_cost_vnd (INTEGER)
```

**supplier_debts** (AP-specific; separate from existing `debts` table)
```
id (INTEGER PK)
supplier_id (INTEGER FK → suppliers.id)
goods_receipt_id (INTEGER FK → goods_receipts.id, nullable for manual invoices)
amount_vnd (INTEGER)
due_date (TEXT ISO8601)
status (TEXT: 'unpaid'|'partial'|'paid', default 'unpaid')
created_at (TEXT ISO8601)
notes (TEXT)
```

**stock_movements** (audit ledger)
```
id (INTEGER PK)
product_id (INTEGER FK → products.id)
inventory_unit_id (INTEGER FK → inventory_units.id, nullable for bulk)
movement_type (TEXT: 'receipt'|'sale'|'adjustment'|'count'|'return')
quantity (INTEGER, signed: +10 in, -5 out)
unit_cost_vnd (INTEGER, nullable)
reference_table (TEXT: 'goods_receipts'|'sales'|'inventory_counts')
reference_id (INTEGER)
notes (TEXT)
created_at (TEXT ISO8601)
```

### MODIFY Existing Tables

**inventory_units** — add column:
```
goods_receipt_id (INTEGER FK → goods_receipts.id, nullable)  
  [tracks provenance of serialized unit; for cost reconciliation]
```

**products** — add column (already exists per Phase-02, but confirm):
```
qty_on_hand (INTEGER, default 0)  [for QUANTITY type only]
```

**debt_payments** (existing) — **no changes** (reuse for supplier payments via supplier_debt_id FK)
```
[existing schema applies; add optional supplier_debt_id column OR]
[create separate supplier_debt_payments table if GL posting differs significantly]
```
**Decision:** Reuse debt_payments; add supplier_debt_id + nullable customer_debt_id. Enforce exclusive constraint at app layer (Drizzle validation).

---

## Key Data-Model Decisions

| Decision | Rationale |
|----------|-----------|
| **2 debt tables** | Oracle Financials pattern; AR ≠ AP tax treatment, GL posting, retention. Schema duplication acceptable. |
| **goods_receipts separate** | AP-domain (GL: Inventory Dr / AP Cr). General intake is inventory-domain (GL: Inventory Dr / Contra Cr). Different workflows. |
| **stock_movements ledger** | Audit trail immutable; reconciliation ↔ GL; shrinkage detection. Single-location overhead: ~50 rows/month. |
| **trigger auto-payable** | Standard NetSuite/Odoo. SQLite trigger on goods_receipts.INSERT creates supplier_debts with due_date = receipt_date + payment_terms_days. |
| **Integer VND** | No decimal places; store as-is. Display formatted in UI layer. |
| **Serialized vs bulk** | inventory_units for bikes (serial_number unique, status-tracked); qty_on_hand for accessories (no serial, decrement on sale). |

---

## Integration with Phase-03 (Intake)

**General stock intake (Phase 03) ≠ goods receipt (AP):**
- **Goods Receipt (v2 AP):** supplier → goods_receipts → supplier_debts. GL: Inventory Dr / AP Cr.
- **General Intake (Phase 03):** manual adjustment, transfer, return. GL: Inventory Dr / Contra Cr.
- **Recommendation:** Separate intake_sources enum if they share UI flow; schema stays separated.

---

## Payments & Aging

**Supplier Debt Aging (computed, not stored):**
```
CASE WHEN (due_date - TODAY) <= 0 THEN 'Overdue'
     WHEN (due_date - TODAY) BETWEEN 1 AND 30 THEN 'Current'
     WHEN (due_date - TODAY) > 30 THEN 'Future'
END
```

**Partial Payments:** debt_payments.supplier_debt_id (or supplier_debt_payments table) logs each payment. supplier_debts.status updates: 'unpaid' → 'partial' (sum(payments) > 0) → 'paid' (sum ≥ amount).

---

## Query Examples (for validation)

**Shrinkage Detection (stock_movements):**
```
SELECT product_id, SUM(quantity) as net, created_at
FROM stock_movements
WHERE movement_type IN ('receipt', 'sale', 'adjustment')
  AND created_at >= datetime('now', '-30 days')
GROUP BY product_id
HAVING ABS(net) > reorder_threshold
```

**Supplier Payment Status:**
```
SELECT s.name, sd.amount_vnd, COALESCE(SUM(dp.amount_vnd), 0) as paid,
       sd.amount_vnd - COALESCE(SUM(dp.amount_vnd), 0) as outstanding
FROM suppliers s
JOIN supplier_debts sd ON s.id = sd.supplier_id
LEFT JOIN debt_payments dp ON sd.id = dp.supplier_debt_id
GROUP BY sd.id
ORDER BY outstanding DESC
```

---

## Unresolved Questions

1. **GL Account Mapping:** Which GL accounts for Inventory, AP, COGS? (Defer to Phase 05 accounting module.)
2. **Multi-Location:** If Phase 04 adds locations, does goods_receipts scope by location? (Likely: add location_id FK.)
3. **Tax/GST:** Should supplier_debts separate tax_amount from total? (Defer to Phase 05 compliance.)
4. **Landed Costs:** Freight, duties included in unit_cost_vnd or separate? (Defer YAGNI.)
5. **Supplier Discounts:** Early-pay (2/10 Net-30) now or later? (Defer unless 3+ vendors offer.)

---

## Sources

- [Oracle Financials AR/AP Schema](https://docs.oracle.com/en/applications/)
- [NetSuite AP Automation Workflow (2026)](https://www.netsuite.com/portal/resource/articles/accounting/ap-automation-workflow.shtml)
- [Real-Time Stock Ledger: Inventory Accuracy (2026)](https://www.islandpacific.com/news/real-time-stock-ledger-accuracy-2026)
- [Retail Shrinkage Report 2025](https://www.islandpacific.com/) (US $90B loss, 18% increase)
- [Lightspeed Bike Shop POS](https://www.lightspeedhq.com/pos/retail/bike-shop/)
- [Odoo Inventory & AP Workflows](https://www.alliancetek.com/blog/odoo-system-design-2026)
