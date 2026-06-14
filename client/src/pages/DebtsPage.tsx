import { useState } from 'react'
import { Table, Modal, Group, ActionIcon, Card, Text, Stack, Badge, Grid, SegmentedControl } from '@mantine/core'
import { IconCash, IconEye } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import type { DebtWithBalance } from '@shared/types'
import { api } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ListTable } from '../components/ListTable.tsx'
import { DebtPaymentsManager } from '../components/DebtPaymentsManager.tsx'
import { LoadingBlock } from '../components/LoadingBlock.tsx'
import { formatVnd, formatDate } from '../lib/format.ts'

const BUCKET_LABELS: Record<DebtWithBalance['agingBucket'], { label: string; color: string }> = {
  current: { label: 'Trong hạn', color: 'teal' },
  '1-30': { label: '1-30 ngày', color: 'yellow' },
  '31-60': { label: '31-60 ngày', color: 'orange' },
  '61-90': { label: '61-90 ngày', color: 'red' },
  '90+': { label: 'Trên 90 ngày', color: 'red' },
}

export default function DebtsPage() {
  const [filter, setFilter] = useState<'open' | 'paid' | 'all'>('open')
  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', filter],
    queryFn: () => api.debts.list(filter),
  })
  const { data: aging } = useQuery({ queryKey: ['debts', 'aging'], queryFn: api.debts.aging })
  const [viewId, setViewId] = useState<number | null>(null)

  return (
    <>
      <PageHeader title="Công nợ" subtitle="Theo dõi khoản phải thu, phân tích tuổi nợ và ghi nhận thanh toán" />

      {/* Aging summary cards */}
      <Grid mb="lg">
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card withBorder padding="lg" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Tổng còn phải thu
            </Text>
            <Text size="xl" fw={700} c="red" mt={4}>
              {formatVnd(aging?.totalOutstandingVnd ?? 0)}
            </Text>
            <Text size="xs" c="dimmed">
              {aging?.openCount ?? 0} khoản nợ
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <Card withBorder padding="lg" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              Phân tích tuổi nợ
            </Text>
            <Group gap="lg">
              {aging &&
                (Object.keys(BUCKET_LABELS) as DebtWithBalance['agingBucket'][]).map((b) => (
                  <Stack key={b} gap={0}>
                    <Badge color={BUCKET_LABELS[b].color} variant="light" size="sm">
                      {BUCKET_LABELS[b].label}
                    </Badge>
                    <Text fw={600} size="sm" mt={4}>
                      {formatVnd(aging.buckets[b]?.totalVnd ?? 0)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {aging.buckets[b]?.count ?? 0} khoản
                    </Text>
                  </Stack>
                ))}
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      <SegmentedControl
        mb="md"
        value={filter}
        onChange={(v) => setFilter(v as typeof filter)}
        data={[
          { value: 'open', label: 'Còn nợ' },
          { value: 'paid', label: 'Đã thu xong' },
          { value: 'all', label: 'Tất cả' },
        ]}
      />

      <ListTable
        headers={['Khách hàng', 'Đơn', 'Nợ gốc', 'Đã trả', 'Còn nợ', 'Hạn trả', 'Tuổi nợ', '']}
        minWidth={750}
        isEmpty={debts.length === 0}
        loading={isLoading}
        emptyText="Không có khoản nợ nào."
      >
        {debts.map((d) => (
          <Table.Tr key={d.id}>
            <Table.Td fw={600}>{d.customerName}</Table.Td>
            <Table.Td>{d.saleId ? `#${d.saleId}` : '—'}</Table.Td>
            <Table.Td>{formatVnd(d.amountVnd)}</Table.Td>
            <Table.Td c="teal">{formatVnd(d.paidVnd)}</Table.Td>
            <Table.Td fw={600} c={d.balanceVnd > 0 ? 'red' : 'teal'}>
              {formatVnd(d.balanceVnd)}
            </Table.Td>
            <Table.Td>{formatDate(d.dueDate)}</Table.Td>
            <Table.Td>
              {d.balanceVnd > 0 ? (
                <Badge color={BUCKET_LABELS[d.agingBucket].color} variant="light">
                  {d.agingBucket === 'current' ? 'Trong hạn' : `Quá ${d.daysOverdue}n`}
                </Badge>
              ) : (
                <Badge color="teal" variant="light">
                  Xong
                </Badge>
              )}
            </Table.Td>
            <Table.Td align="right">
              <Group gap={4} justify="flex-end">
                {d.balanceVnd > 0 && (
                  <ActionIcon variant="light" color="teal" title="Thu nợ / cập nhật thanh toán" onClick={() => setViewId(d.id)}>
                    <IconCash size={18} />
                  </ActionIcon>
                )}
                <ActionIcon variant="subtle" title="Xem & quản lý thanh toán" onClick={() => setViewId(d.id)}>
                  <IconEye size={18} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </ListTable>

      {viewId && <DebtDetailModal id={viewId} onClose={() => setViewId(null)} />}
    </>
  )
}

function DebtDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['debt', id], queryFn: () => api.debts.get(id) })
  return (
    <Modal opened onClose={onClose} title="Công nợ — quản lý thanh toán" centered size="lg">
      {isLoading || !data ? (
        <LoadingBlock label="Đang tải công nợ..." />
      ) : (
        <Stack>
          <Group justify="space-between">
            <Text fw={700}>{data.customerName}</Text>
            <Text size="sm" c="dimmed">
              {data.saleId ? `Đơn #${data.saleId} · ` : ''}Hạn trả: {formatDate(data.dueDate)}
            </Text>
          </Group>
          <DebtPaymentsManager debtId={id} />
        </Stack>
      )}
    </Modal>
  )
}
