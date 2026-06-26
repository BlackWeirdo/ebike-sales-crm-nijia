import type { CustomerType, ProductType, ProductCategory, UnitStatus, DebtWithBalance } from '@shared/types'

/** Nhãn + màu badge cho loại khách hàng (dùng chung mọi nơi). */
export const CUSTOMER_TYPE: Record<CustomerType, { label: string; color: string }> = {
  individual: { label: 'Cá nhân', color: 'blue' },
  dealer: { label: 'Đại lý', color: 'grape' },
}

/** Nhãn + màu badge cho cách quản lý tồn kho (storage mode). */
export const PRODUCT_TYPE: Record<ProductType, { label: string; color: string }> = {
  SERIALIZED: { label: 'Theo serial', color: 'blue' },
  QUANTITY: { label: 'Theo số lượng', color: 'grape' },
}

/** Nhãn + màu cho danh mục sản phẩm (Xe / Phụ kiện) — dùng cho phân tích doanh thu. */
export const PRODUCT_CATEGORY: Record<ProductCategory, { label: string; color: string }> = {
  bike: { label: 'Xe', color: 'teal' },
  accessory: { label: 'Phụ kiện', color: 'grape' },
}

/** Nhãn + màu cho trạng thái đơn vị tồn kho (serial). */
export const UNIT_STATUS: Record<UnitStatus, { label: string; color: string }> = {
  in_stock: { label: 'Còn trong kho', color: 'teal' },
  sold: { label: 'Đã bán', color: 'gray' },
  reserved: { label: 'Đã giữ', color: 'yellow' },
  returned: { label: 'Đã trả', color: 'orange' },
}

/** Nhãn + màu cho nhóm tuổi nợ (aging bucket). */
export const DEBT_AGING_BUCKET: Record<DebtWithBalance['agingBucket'], { label: string; color: string }> = {
  current: { label: 'Trong hạn', color: 'teal' },
  '1-30': { label: '1-30 ngày', color: 'yellow' },
  '31-60': { label: '31-60 ngày', color: 'orange' },
  '61-90': { label: '61-90 ngày', color: 'red' },
  '90+': { label: 'Trên 90 ngày', color: 'red' },
}
