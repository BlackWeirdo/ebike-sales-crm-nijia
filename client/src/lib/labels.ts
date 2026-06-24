import type { CustomerType, ProductType, ProductCategory } from '@shared/types'

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
