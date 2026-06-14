import type { CustomerType, ProductType } from '@shared/types'

/** Nhãn + màu badge cho loại khách hàng (dùng chung mọi nơi). */
export const CUSTOMER_TYPE: Record<CustomerType, { label: string; color: string }> = {
  individual: { label: 'Cá nhân', color: 'blue' },
  dealer: { label: 'Đại lý', color: 'grape' },
}

/** Nhãn + màu badge cho loại sản phẩm. */
export const PRODUCT_TYPE: Record<ProductType, { label: string; color: string }> = {
  SERIALIZED: { label: 'Xe (serial)', color: 'blue' },
  QUANTITY: { label: 'Phụ kiện', color: 'grape' },
}
