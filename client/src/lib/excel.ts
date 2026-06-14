import type { ImportPayload, ImportProductRow, ImportUnitRow, ProductType } from '@shared/types'

// Template headers (Vietnamese). Users may keep these as-is.
const PRODUCT_HEADERS = ['Tên', 'SKU', 'Loại', 'Màu', 'GiáNhập', 'GiáBán', 'SốLượng', 'NgưỡngTồn']
const UNIT_HEADERS = ['SKU', 'Serial', 'GiáNhập', 'NgàyNhập']

const SHEET_PRODUCTS = 'SanPham'
const SHEET_UNITS = 'SerialXe'

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, '')
}

function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const digits = String(v ?? '').replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

function toType(v: unknown): ProductType | string {
  const n = norm(v)
  if (n.includes('serial') || n.includes('xe')) return 'SERIALIZED'
  if (n.includes('quantity') || n.includes('phukien') || n === 'pk' || n.includes('phu')) return 'QUANTITY'
  return String(v ?? '') // unknown → let server flag it
}

function toDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const tz = new Date(v.getTime() - v.getTimezoneOffset() * 60000)
    return tz.toISOString().slice(0, 10)
  }
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/) // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s // invalid → server flags it
}

/** Build a header-key map from a row of header cells: normalized-header -> column index. */
function headerIndex(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    map[norm(h)] = i
  })
  return map
}

function pick(row: unknown[], idx: Record<string, number>, ...keys: string[]): unknown {
  for (const k of keys) {
    const i = idx[norm(k)]
    if (i !== undefined) return row[i]
  }
  return undefined
}

/** Parse an uploaded .xlsx/.csv into an ImportPayload. Empty rows are skipped. */
export async function parseImportFile(file: File): Promise<ImportPayload> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })

  const products: ImportProductRow[] = []
  const units: ImportUnitRow[] = []

  // products sheet (named SanPham, else first sheet)
  const prodSheet = wb.Sheets[SHEET_PRODUCTS] ?? wb.Sheets[wb.SheetNames[0]]
  if (prodSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(prodSheet, { header: 1, blankrows: false })
    if (rows.length > 1) {
      const idx = headerIndex(rows[0])
      for (const row of rows.slice(1)) {
        if (!row || row.every((c) => c === undefined || c === '')) continue
        const sku = String(pick(row, idx, 'SKU') ?? '').trim()
        const name = String(pick(row, idx, 'Tên', 'Ten', 'Tensanpham') ?? '').trim()
        if (!sku && !name) continue
        products.push({
          sku,
          name,
          type: toType(pick(row, idx, 'Loại', 'Loai', 'Type')) as ProductType,
          color: String(pick(row, idx, 'Màu', 'Mau', 'Color') ?? '').trim() || null,
          costVnd: toInt(pick(row, idx, 'GiáNhập', 'Gianhap', 'Cost')),
          sellingPriceVnd: toInt(pick(row, idx, 'GiáBán', 'Giaban', 'Price')),
          qtyOnHand: toInt(pick(row, idx, 'SốLượng', 'Soluong', 'Qty')),
          lowStockThreshold: toInt(pick(row, idx, 'NgưỡngTồn', 'Nguongton', 'Threshold')),
        })
      }
    }
  }

  // serial units sheet (SerialXe)
  const unitSheet = wb.Sheets[SHEET_UNITS]
  if (unitSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(unitSheet, { header: 1, blankrows: false })
    if (rows.length > 1) {
      const idx = headerIndex(rows[0])
      for (const row of rows.slice(1)) {
        if (!row || row.every((c) => c === undefined || c === '')) continue
        const sku = String(pick(row, idx, 'SKU') ?? '').trim()
        const serial = String(pick(row, idx, 'Serial', 'Serialnumber') ?? '').trim()
        if (!sku && !serial) continue
        units.push({
          sku,
          serialNumber: serial,
          costVnd: toInt(pick(row, idx, 'GiáNhập', 'Gianhap', 'Cost')),
          acquiredDate: toDate(pick(row, idx, 'NgàyNhập', 'Ngaynhap', 'Date')),
        })
      }
    }
  }

  return { products, units }
}

/** Generate & download an .xlsx template with both sheets + example rows. */
export async function downloadTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.aoa_to_sheet([
    PRODUCT_HEADERS,
    ['Xe VinFast Klara S', 'XE-KLARA-S', 'Xe', 'Đỏ', 22000000, 26000000, '', 1],
    ['Mũ bảo hiểm', 'PK-MU-01', 'Phụ kiện', 'Đen', 80000, 150000, 50, 5],
  ])
  ws1['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_PRODUCTS)

  const ws2 = XLSX.utils.aoa_to_sheet([
    UNIT_HEADERS,
    ['XE-KLARA-S', 'SN-KLARA-0001', 22000000, '2026-06-14'],
    ['XE-KLARA-S', 'SN-KLARA-0002', 22000000, '2026-06-14'],
  ])
  ws2['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, SHEET_UNITS)

  XLSX.writeFile(wb, 'mau-nhap-san-pham.xlsx')
}
