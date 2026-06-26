import { Modal, Group, Text, Stack, Table, Divider, Button } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { DebtPaymentsManager } from './DebtPaymentsManager.tsx'
import { LoadingBlock } from './LoadingBlock.tsx'
import { formatVnd, formatDate } from '../lib/format.ts'
import { printSaleInvoice } from '../lib/printInvoice.ts'

/** Modal xem chi tiết 1 đơn bán + quản lý thanh toán công nợ của đơn + in hóa đơn. */
export function SaleDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['sale', id], queryFn: () => api.sales.get(id) })
  const balance = data ? data.remainingVnd : 0
  const hasLineDiscount = data ? data.items.some((it) => it.lineDiscountVnd > 0) : false
  return (
    <Modal opened onClose={onClose} title={`Đơn bán #${id}`} centered size="lg">
      {isLoading || !data ? (
        <LoadingBlock label="Đang tải đơn bán..." />
      ) : (
        <Stack>
          <Group justify="space-between">
            <Text size="sm">
              <b>Khách:</b> {data.customerName ?? 'Khách lẻ'}
            </Text>
            <Text size="sm">
              <b>Ngày:</b> {formatDate(data.saleDate)}
            </Text>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sản phẩm</Table.Th>
                <Table.Th>SL</Table.Th>
                <Table.Th>Đơn giá</Table.Th>
                {hasLineDiscount && <Table.Th>Giảm</Table.Th>}
                <Table.Th>Thành tiền</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    {it.productName}
                    {it.productSku ? ` - ${it.productSku}` : ''}
                    {it.serialNumber && (
                      <Text size="xs" c="dimmed">
                        SN: {it.serialNumber}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{it.qty}</Table.Td>
                  <Table.Td>{formatVnd(it.unitPriceVnd)}</Table.Td>
                  {hasLineDiscount && (
                    <Table.Td>{it.lineDiscountVnd > 0 ? `- ${formatVnd(it.lineDiscountVnd)}` : '-'}</Table.Td>
                  )}
                  <Table.Td>{formatVnd(it.lineTotalVnd)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Divider />
          <Group justify="flex-end" gap="xl">
            <Stack gap={2} align="flex-end">
              {data.discountVnd > 0 && (
                <>
                  <Text size="sm" c="dimmed">
                    Tạm tính: {formatVnd(data.subtotalVnd)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Giảm giá: - {formatVnd(data.discountVnd)}
                  </Text>
                </>
              )}
              <Text size="sm" c="dimmed">
                Tổng: <b>{formatVnd(data.totalVnd)}</b>
              </Text>
              <Text size="sm" c="teal">
                Đã trả: {formatVnd(data.collectedVnd)}
              </Text>
              {balance > 0 && (
                <Text size="sm" c="red" fw={600}>
                  Còn nợ: {formatVnd(balance)}
                </Text>
              )}
            </Stack>
          </Group>
          {data.notes && (
            <Text size="sm" c="dimmed">
              Ghi chú: {data.notes}
            </Text>
          )}

          {data.paymentAccounts && data.paymentAccounts.length > 0 && (
            <>
              <Divider label="Tài khoản nhận tiền" labelPosition="left" />
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tài khoản</Table.Th>
                    <Table.Th>Ngân hàng</Table.Th>
                    <Table.Th>Số TK</Table.Th>
                    <Table.Th>Số tiền</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.paymentAccounts.map((a, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{a.label}</Table.Td>
                      <Table.Td>{a.bankName || '—'}</Table.Td>
                      <Table.Td>{a.accountNumber || '—'}</Table.Td>
                      <Table.Td>{formatVnd(a.amountVnd)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}

          {data.debt && (
            <>
              <Divider label="Thanh toán công nợ" labelPosition="left" />
              <DebtPaymentsManager debtId={data.debt.id} />
            </>
          )}

          <Group justify="flex-end">
            <Button leftSection={<IconPrinter size={18} />} variant="light" onClick={() => printSaleInvoice(data)}>
              In hóa đơn
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
