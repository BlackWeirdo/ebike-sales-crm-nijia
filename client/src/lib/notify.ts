import { createElement } from 'react'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconExclamationCircle } from '@tabler/icons-react'

/** Thông báo thành công (xanh, có icon ✓). */
export const toastOk = (message: string) =>
  notifications.show({
    message,
    color: 'teal',
    icon: createElement(IconCheck, { size: 18 }),
    withBorder: true,
    radius: 'md',
  })

/** Thông báo lỗi (đỏ, có icon) — dùng trực tiếp làm `onError` của mutation. */
export const toastError = (e: unknown) =>
  notifications.show({
    message: e instanceof Error ? e.message : 'Đã xảy ra lỗi',
    color: 'red',
    icon: createElement(IconExclamationCircle, { size: 18 }),
    withBorder: true,
    radius: 'md',
    autoClose: 5000,
  })
