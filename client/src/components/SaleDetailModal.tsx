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
                <Table.Th>Thành tiền</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    {it.productName}
                    {it.serialNumber && (
                      <Text size="xs" c="dimmed">
                        SN: {it.serialNumber}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{it.qty}</Table.Td>
                  <Table.Td>{formatVnd(it.unitPriceVnd)}</Table.Td>
                  <Table.Td>{formatVnd(it.lineTotalVnd)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Divider />
          <Group justify="flex-end" gap="xl">
            <Stack gap={2} align="flex-end">
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
