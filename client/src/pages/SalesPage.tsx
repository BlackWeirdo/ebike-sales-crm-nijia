import { useState } from 'react'
import { Button, Group, ActionIcon, Table, Badge } from '@mantine/core'
import { IconPlus, IconEye, IconPrinter, IconCash } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ListTable } from '../components/ListTable.tsx'
import { SaleForm } from '../components/SaleForm.tsx'
import { SaleDetailModal } from '../components/SaleDetailModal.tsx'
import { formatVnd, formatDate } from '../lib/format.ts'
import { printSaleInvoice } from '../lib/printInvoice.ts'

export default function SalesPage() {
  const { data: sales = [], isLoading } = useQuery({ queryKey: ['sales'], queryFn: api.sales.list })
  const [formOpen, setFormOpen] = useState(false)
  const [viewId, setViewId] = useState<number | null>(null)

  return (
    <>
      <PageHeader
        title="Bán hàng"
        subtitle="Tạo đơn bán — doanh thu và công nợ phát sinh tự động từ đây"
        action={
          <Button leftSection={<IconPlus size={18} />} onClick={() => setFormOpen(true)}>
            Tạo đơn bán
          </Button>
        }
      />

      <ListTable
        headers={['Mã đơn', 'Ngày', 'Khách hàng', 'Tổng tiền', 'Đã trả', 'Còn nợ', '']}
        isEmpty={sales.length === 0}
        loading={isLoading}
        emptyText="Chưa có đơn bán nào."
      >
        {sales.map((s) => (
          <Table.Tr key={s.id}>
            <Table.Td fw={600}>#{s.id}</Table.Td>
            <Table.Td>{formatDate(s.saleDate)}</Table.Td>
            <Table.Td>{s.customerName ?? 'Khách lẻ'}</Table.Td>
            <Table.Td fw={600}>{formatVnd(s.totalVnd)}</Table.Td>
            <Table.Td c="teal">{formatVnd(s.collectedVnd)}</Table.Td>
            <Table.Td>
              {s.remainingVnd > 0 ? (
                <Badge color="red" variant="light">
                  {formatVnd(s.remainingVnd)}
                </Badge>
              ) : (
                <Badge color="teal" variant="light">
                  Đã thanh toán
                </Badge>
              )}
            </Table.Td>
            <Table.Td align="right">
              <Group gap={4} justify="flex-end">
                {s.remainingVnd > 0 && (
                  <ActionIcon variant="light" color="teal" title="Thu nợ / cập nhật thanh toán" onClick={() => setViewId(s.id)}>
                    <IconCash size={18} />
                  </ActionIcon>
                )}
                <ActionIcon variant="subtle" onClick={() => setViewId(s.id)} title="Xem chi tiết">
                  <IconEye size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="teal"
                  title="In hóa đơn"
                  onClick={() => api.sales.get(s.id).then(printSaleInvoice)}
                >
                  <IconPrinter size={18} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </ListTable>

      {formOpen && <SaleForm onClose={() => setFormOpen(false)} />}
      {viewId && <SaleDetailModal id={viewId} onClose={() => setViewId(null)} />}
    </>
  )
}
