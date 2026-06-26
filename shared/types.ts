// Shared domain types — single source of truth for server + client.
// Money is INTEGER VND everywhere. Dates are ISO TEXT 'YYYY-MM-DD'.

export type ProductType = 'SERIALIZED' | 'QUANTITY' // storage mode (track by serial vs by quantity)
export type ProductCategory = 'bike' | 'accessory' // business category (xe vs phụ kiện) — independent of storage mode
export type CustomerType = 'individual' | 'dealer'
export type UnitStatus = 'in_stock' | 'sold' | 'reserved' | 'returned'
export type PaymentMethod = 'cash' | 'transfer' | 'mixed'
export type DebtStatus = 'open' | 'partial' | 'paid'
export type DebtPaymentMethod = 'cash' | 'transfer'

export interface Product {
  id: number
  sku: string
  name: string
  type: ProductType
  category: ProductCategory
  color: string | null
  costVnd: number
  sellingPriceVnd: number
  qtyOnHand: number // QUANTITY type only
  lowStockThreshold: number
  active: number // 0 | 1
  createdAt: string
}

export interface InventoryUnit {
  id: number
  productId: number
  serialNumber: string
  status: UnitStatus
  costVnd: number
  acquiredDate: string
  soldOnDate: string | null
}

export interface Customer {
  id: number
  type: CustomerType
  name: string // individual: person name; dealer: company/đại lý name
  contactPerson: string | null // dealer only
  taxCode: string | null // dealer only
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  createdAt: string
}

export interface Sale {
  id: number
  customerId: number | null
  saleDate: string
  subtotalVnd: number
  discountVnd: number
  totalVnd: number
  paidVnd: number
  paymentMethod: PaymentMethod
  notes: string | null
}

// Danh mục tài khoản nhận tiền (CRUD riêng). Xóa = xóa mềm (active=0).
export interface BankAccount {
  id: number
  label: string // tên gợi nhớ, vd "Công ty - VCB", "NV Ngọc - MB"
  bankName: string
  accountNumber: string
  accountHolder: string
  active: number // 0 | 1
  createdAt: string
}

// 1 dòng "tài khoản nhận tiền" trên đơn bán. CHỈ ĐỂ IN (không ảnh hưởng paid/công nợ).
// Là SNAPSHOT của tài khoản tại thời điểm bán → sửa/xóa TK trong danh mục về sau KHÔNG
// làm sai phiếu cũ. accountId có thể null nếu TK nguồn đã bị xóa.
export interface PaymentAccountLine {
  accountId: number | null
  label: string
  bankName: string
  accountNumber: string
  accountHolder: string
  amountVnd: number
}

export interface SaleItem {
  id: number
  saleId: number
  productId: number | null
  inventoryUnitId: number | null
  qty: number
  unitPriceVnd: number
  lineDiscountVnd: number
  lineTotalVnd: number
}

export interface Debt {
  id: number
  customerId: number
  saleId: number | null
  issuedDate: string
  dueDate: string
  amountVnd: number
  status: DebtStatus
  notes: string | null
}

export interface DebtPayment {
  id: number
  debtId: number
  paymentDate: string // YYYY-MM-DD (for aging/dashboard)
  paidAt: string | null // full local datetime 'YYYY-MM-DDTHH:MM' for display
  amountVnd: number
  method: DebtPaymentMethod
  notes: string | null
}

// ----- API view models (joins / computed) -----

export interface ProductWithStock extends Product {
  unitsInStock: number // serialized: count of in_stock units; quantity: qtyOnHand
}

export interface SaleItemInput {
  productId: number
  inventoryUnitId: number | null // serialized only
  qty: number
  unitPriceVnd: number
  lineDiscountVnd: number
}

export interface CreateSaleInput {
  customerId: number | null
  saleDate: string
  discountVnd: number
  paidVnd: number
  paymentMethod: PaymentMethod
  notes: string | null
  dueDate: string | null // for unpaid balance debt; defaults saleDate+30
  items: SaleItemInput[]
  paymentAccounts?: PaymentAccountLine[] // chỉ-để-in; client gửi sẵn snapshot
}

// ----- API write inputs (client → server contracts; shared by repos + api client) -----

export interface ProductInput {
  sku: string
  name: string
  type: ProductType
  category: ProductCategory
  color: string | null
  costVnd: number
  sellingPriceVnd: number
  qtyOnHand: number
  lowStockThreshold: number
  active: number
}

export interface CustomerInput {
  type: CustomerType
  name: string
  contactPerson: string | null
  taxCode: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export interface BankAccountInput {
  label: string
  bankName: string
  accountNumber: string
  accountHolder: string
  active: number
}

export interface PaymentInput {
  paidAt: string // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'
  amountVnd: number
  method: DebtPaymentMethod
  notes: string | null
}

export interface SaleListItem extends Sale {
  customerName: string | null
  collectedVnd: number // paidVnd (at sale) + all debt payments
  remainingVnd: number // totalVnd - collectedVnd
}

export interface SaleDebtInfo {
  id: number
  amountVnd: number
  paidVnd: number // sum of payments on this debt
  balanceVnd: number
  status: DebtStatus
  dueDate: string
  payments: DebtPayment[]
}

export interface SaleDetail extends Sale {
  customerName: string | null
  customer: Customer | null // full customer record (for invoice / VAT details)
  items: (SaleItem & { productName: string; productSku: string | null; serialNumber: string | null })[]
  collectedVnd: number
  remainingVnd: number
  debt: SaleDebtInfo | null
  paymentAccounts: PaymentAccountLine[] // snapshot các tài khoản nhận tiền (để in)
}

export interface DebtWithBalance extends Debt {
  customerName: string
  paidVnd: number // sum of debt_payments
  balanceVnd: number // amountVnd - paidVnd
  agingBucket: 'current' | '1-30' | '31-60' | '61-90' | '90+'
  daysOverdue: number
}

export interface DashboardSummary {
  from: string
  to: string
  revenueVnd: number // sum sales.totalVnd in range
  collectedVnd: number // paid at sale + debt payments in range
  salesCount: number
  newCustomers: number
  outstandingDebtVnd: number // total unpaid balance (all time)
  lowStockCount: number
  topProducts: { name: string; sku: string; qty: number; revenueVnd: number }[]
}

export interface RevenuePoint {
  date: string // YYYY-MM-DD
  revenueVnd: number
}

// ----- Analytics dashboards (customers & products) -----

export interface CustomerAnalytics {
  // Cơ cấu khách + doanh thu theo loại (trong khoảng thời gian)
  byType: { type: CustomerType; count: number; revenueVnd: number }[]
  // Top khách hàng theo doanh thu (trong khoảng)
  topCustomers: { id: number; name: string; type: CustomerType; revenueVnd: number; orders: number }[]
  // Khách mới theo ngày (created_at trong khoảng)
  newCustomersSeries: { date: string; count: number }[]
  // Công nợ: số khách còn nợ / đã sạch nợ + tổng dư nợ (toàn thời gian, point-in-time)
  debt: { withDebtCount: number; clearCount: number; outstandingVnd: number }
}

export interface ProductAnalytics {
  // Doanh thu + số lượng theo danh mục sản phẩm (Xe / Phụ kiện) trong khoảng
  revenueByCategory: { category: ProductCategory; revenueVnd: number; qty: number }[]
  // Top sản phẩm theo số lượng & doanh thu (trong khoảng)
  topProducts: { name: string; sku: string; qty: number; revenueVnd: number }[]
  // Tình trạng tồn kho hiện tại (point-in-time)
  stockStatus: { healthy: number; low: number; out: number }
  // Giá trị tồn kho theo SP = giá vốn × tồn (point-in-time), top theo giá trị
  stockValue: { name: string; valueVnd: number }[]
}

// ----- Bulk Excel import -----

export interface ImportProductRow {
  sku: string
  name: string
  type: ProductType
  category?: ProductCategory // optional in import; defaults to 'bike' when omitted
  color: string | null
  costVnd: number
  sellingPriceVnd: number
  qtyOnHand: number
  lowStockThreshold: number
}

export interface ImportUnitRow {
  sku: string // references a SERIALIZED product
  serialNumber: string
  costVnd: number
  acquiredDate: string
}

export interface ImportPayload {
  products: ImportProductRow[]
  units: ImportUnitRow[]
}

export interface ImportError {
  sheet: 'SanPham' | 'SerialXe'
  row: number // 1-based data row (excluding header)
  message: string
}

export interface ImportResult {
  ok: boolean
  productsCreated: number
  productsUpdated: number
  unitsCreated: number
  errors: ImportError[]
}
