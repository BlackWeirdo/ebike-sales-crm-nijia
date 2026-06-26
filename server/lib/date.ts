/** Ngày hôm nay dạng ISO 'YYYY-MM-DD' (local-agnostic, dùng cho created_at/issued_date...). */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
