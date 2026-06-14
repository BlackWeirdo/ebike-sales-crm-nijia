// VND is zero-decimal; format integers with thousands separators.
const vnd = new Intl.NumberFormat('vi-VN')

export function formatVnd(amount: number): string {
  return vnd.format(amount) + ' ₫'
}

export function formatNumber(n: number): string {
  return vnd.format(n)
}

// Parse a user-typed money string ("1.500.000" / "1500000") back to integer VND.
export function parseVnd(input: string | number): number {
  if (typeof input === 'number') return Math.round(input)
  const digits = input.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const datePart = iso.slice(0, 10)
  const [y, m, d] = datePart.split('-')
  return `${d}/${m}/${y}`
}

// Display a payment timestamp: 'YYYY-MM-DDTHH:MM' → 'DD/MM/YYYY HH:MM'; date-only → 'DD/MM/YYYY'.
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = formatDate(iso)
  const t = iso.includes('T') ? iso.split('T')[1]?.slice(0, 5) : ''
  return t ? `${date} ${t}` : date
}

// Current local datetime as 'YYYY-MM-DDTHH:MM' for <input type="datetime-local">.
export function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
