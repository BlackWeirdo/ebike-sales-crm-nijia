import type {
  Product,
  ProductWithStock,
  InventoryUnit,
  Customer,
  SaleDetail,
  SaleListItem,
  CreateSaleInput,
  DebtWithBalance,
  DebtPayment,
  DashboardSummary,
  RevenuePoint,
  CustomerAnalytics,
  ProductAnalytics,
  ImportPayload,
  ImportResult,
} from '@shared/types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface ProductInput {
  sku: string
  name: string
  type: 'SERIALIZED' | 'QUANTITY'
  category: 'bike' | 'accessory'
  color: string | null
  costVnd: number
  sellingPriceVnd: number
  qtyOnHand: number
  lowStockThreshold: number
  active: number
}

export interface CustomerInput {
  type: 'individual' | 'dealer'
  name: string
  contactPerson: string | null
  taxCode: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export type CustomerDetail = Customer & {
  stats: { purchaseCount: number; totalSpentVnd: number; outstandingDebtVnd: number }
}

export type DebtDetail = DebtWithBalance & { payments: DebtPayment[] }

export interface PaymentInput {
  paidAt: string // 'YYYY-MM-DDTHH:MM'
  amountVnd: number
  method: 'cash' | 'transfer'
  notes: string | null
}

export const api = {
  // auth (single-password gate; no-op when server runs without APP_PASSWORD)
  auth: {
    me: () => req<{ authed: boolean; authEnabled: boolean }>('/auth/me'),
    login: (password: string) =>
      req<{ ok: true }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
    logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  },
  // products / inventory
  products: {
    list: () => req<ProductWithStock[]>('/products'),
    get: (id: number) => req<Product>(`/products/${id}`),
    create: (data: ProductInput) => req<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: ProductInput) =>
      req<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => req<void>(`/products/${id}`, { method: 'DELETE' }),
    units: (id: number) => req<InventoryUnit[]>(`/products/${id}/units`),
    availableUnits: (id: number) => req<InventoryUnit[]>(`/products/${id}/units/available`),
    addUnit: (id: number, data: { serialNumber: string; costVnd: number; acquiredDate: string }) =>
      req<InventoryUnit>(`/products/${id}/units`, { method: 'POST', body: JSON.stringify(data) }),
    removeUnit: (unitId: number) => req<void>(`/products/units/${unitId}`, { method: 'DELETE' }),
    // 422 = validation failed but body still holds the ImportResult (errors list) — don't throw on it.
    import: async (payload: ImportPayload): Promise<ImportResult> => {
      const res = await fetch(BASE + '/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (res.status === 201 || res.status === 422) return body as ImportResult
      throw new Error(body?.error ?? `Lỗi ${res.status}`)
    },
  },
  // customers
  customers: {
    list: (search?: string, type?: 'individual' | 'dealer') => {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (type) qs.set('type', type)
      const s = qs.toString()
      return req<Customer[]>(`/customers${s ? `?${s}` : ''}`)
    },
    get: (id: number) => req<CustomerDetail>(`/customers/${id}`),
    orders: (id: number) => req<SaleDetail[]>(`/customers/${id}/orders`),
    create: (data: CustomerInput) => req<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: CustomerInput) =>
      req<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => req<void>(`/customers/${id}`, { method: 'DELETE' }),
  },
  // sales
  sales: {
    list: () => req<SaleListItem[]>('/sales'),
    get: (id: number) => req<SaleDetail>(`/sales/${id}`),
    create: (data: CreateSaleInput) => req<SaleDetail>('/sales', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: CreateSaleInput) =>
      req<SaleDetail>(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => req<void>(`/sales/${id}`, { method: 'DELETE' }),
  },
  // debts
  debts: {
    list: (filter: 'all' | 'open' | 'paid' = 'all') => req<DebtWithBalance[]>(`/debts?filter=${filter}`),
    get: (id: number) => req<DebtDetail>(`/debts/${id}`),
    aging: () =>
      req<{
        buckets: Record<string, { count: number; totalVnd: number }>
        totalOutstandingVnd: number
        openCount: number
      }>('/debts/aging'),
    addPayment: (id: number, data: PaymentInput) =>
      req<DebtDetail>(`/debts/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
    updatePayment: (id: number, paymentId: number, data: PaymentInput) =>
      req<DebtDetail>(`/debts/${id}/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePayment: (id: number, paymentId: number) =>
      req<void>(`/debts/${id}/payments/${paymentId}`, { method: 'DELETE' }),
  },
  // dashboard
  dashboard: {
    summary: (from?: string, to?: string) =>
      req<DashboardSummary>(`/dashboard/summary${from && to ? `?from=${from}&to=${to}` : ''}`),
    revenueSeries: (from?: string, to?: string) =>
      req<RevenuePoint[]>(`/dashboard/revenue-series${from && to ? `?from=${from}&to=${to}` : ''}`),
    customerAnalytics: (from?: string, to?: string) =>
      req<CustomerAnalytics>(`/dashboard/customer-analytics${from && to ? `?from=${from}&to=${to}` : ''}`),
    productAnalytics: (from?: string, to?: string) =>
      req<ProductAnalytics>(`/dashboard/product-analytics${from && to ? `?from=${from}&to=${to}` : ''}`),
  },
}
