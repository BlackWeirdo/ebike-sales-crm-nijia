-- E-Bike Shop CRM schema. Money = INTEGER VND. Dates = TEXT 'YYYY-MM-DD'.
-- Idempotent: safe to run on every boot.

CREATE TABLE IF NOT EXISTS products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sku                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('SERIALIZED','QUANTITY')),
  color               TEXT,
  cost_vnd            INTEGER NOT NULL DEFAULT 0,
  selling_price_vnd   INTEGER NOT NULL DEFAULT 0,
  qty_on_hand         INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_units (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  serial_number TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','reserved','returned')),
  cost_vnd      INTEGER NOT NULL DEFAULT 0,
  acquired_date TEXT NOT NULL,
  sold_on_date  TEXT
);
CREATE INDEX IF NOT EXISTS idx_units_product ON inventory_units(product_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON inventory_units(status);

CREATE TABLE IF NOT EXISTS customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  type           TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual','dealer')),
  name           TEXT NOT NULL,            -- individual: tên khách; dealer: tên công ty/đại lý
  contact_person TEXT,                     -- dealer only
  tax_code       TEXT,                     -- dealer only
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER REFERENCES customers(id),
  sale_date      TEXT NOT NULL,
  subtotal_vnd   INTEGER NOT NULL DEFAULT 0,
  discount_vnd   INTEGER NOT NULL DEFAULT 0,
  total_vnd      INTEGER NOT NULL DEFAULT 0,
  paid_vnd       INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer','mixed')),
  notes          TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id           INTEGER NOT NULL REFERENCES sales(id),
  product_id        INTEGER REFERENCES products(id),
  inventory_unit_id INTEGER REFERENCES inventory_units(id),
  qty               INTEGER NOT NULL DEFAULT 1,
  unit_price_vnd    INTEGER NOT NULL,
  line_discount_vnd INTEGER NOT NULL DEFAULT 0,
  line_total_vnd    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saleitems_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_saleitems_product ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS debts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  sale_id     INTEGER REFERENCES sales(id),
  issued_date TEXT NOT NULL,
  due_date    TEXT NOT NULL,
  amount_vnd  INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid')),
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);

CREATE TABLE IF NOT EXISTS debt_payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id      INTEGER NOT NULL REFERENCES debts(id),
  payment_date TEXT NOT NULL,            -- YYYY-MM-DD, used for aging/dashboard range
  paid_at      TEXT,                     -- full local datetime 'YYYY-MM-DDTHH:MM' for display
  amount_vnd   INTEGER NOT NULL,
  method       TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','transfer')),
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_debtpay_debt ON debt_payments(debt_id);
