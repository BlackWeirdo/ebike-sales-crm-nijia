import { modals } from '@mantine/modals'

/**
 * Hộp thoại xác nhận xóa đẹp + accessible (Esc/Enter dùng được), thay cho confirm() native.
 * `onConfirm` chạy khi người dùng bấm "Xóa".
 */
export function confirmDelete(opts: { title?: string; message: string; onConfirm: () => void }): void {
  modals.openConfirmModal({
    title: opts.title ?? 'Xác nhận xóa',
    children: opts.message,
    centered: true,
    labels: { confirm: 'Xóa', cancel: 'Hủy' },
    confirmProps: { color: 'red' },
    onConfirm: opts.onConfirm,
  })
}
