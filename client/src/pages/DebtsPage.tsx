import { useState } from 'react'
import { Table, Modal, Group, ActionIcon, Card, Text, Stack, Badge, Grid, SegmentedControl, Divider } from '@mantine/core'
import { IconCash, IconEye } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import type { DebtWithBalance } from '@shared/types'
import { api } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ListTable } from '../components/ListTable.tsx'
import { DebtPaymentsManager } from '../components/DebtPaymentsManager.tsx'
import { LoadingBlock } from '../components/LoadingBlock.tsx'
import { formatVnd, formatDate, formatDateTime } from '../lib/format.ts'
import { DEBT_AGING_BUCKET } from '../lib/labels.ts'

const SUBTLE_BG = 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))'

export default function DebtsPage() {
  const [filter, setFilter] = useState<'open' | 'paid' | 'all'>('open')
  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', filter],
    queryFn: () => api.debts.list(filter),
  })
  const { data: aging } = useQuery({ queryKey: ['debts', 'aging'], queryFn: api.debts.aging })
  const [payId, setPayId] = useState<number | null>(null)
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
                (Object.keys(DEBT_AGING_BUCKET) as DebtWithBalance['agingBucket'][]).map((b) => (
                  <Stack key={b} gap={0}>
                    <Badge color={DEBT_AGING_BUCKET[b].color} variant="light" size="sm">
                      {DEBT_AGING_BUCKET[b].label}
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
                <Badge color={DEBT_AGING_BUCKET[d.agingBucket].color} variant="light">
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
                  <ActionIcon variant="light" color="teal" title="Thu nợ / ghi nhận thanh toán" onClick={() => setPayId(d.id)}>
                    <IconCash size={18} />
                  </ActionIcon>
                )}
                <ActionIcon variant="subtle" title="Xem chi tiết công nợ" onClick={() => setViewId(d.id)}>
                  <IconEye size={18} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </ListTable>

      {payId && <DebtPaymentModal id={payId} onClose={() => setPayId(null)} />}
      {viewId && <DebtViewModal id={viewId} onClose={() => setViewId(null)} />}
    </>
  )
}

/** Modal ghi nhận / sửa / xóa thanh toán công nợ (cho nút Thu nợ). */
function DebtPaymentModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['debt', id], queryFn: () => api.debts.get(id) })
  return (
    <Modal opened onClose={onClose} title="Thu nợ — ghi nhận thanh toán" centered size="lg">
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

/** Modal CHỈ XEM chi tiết công nợ: đơn hàng nguồn, ngày mua, sản phẩm, lịch sử thanh toán (read-only). */
function DebtViewModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['debt', id], queryFn: () => api.debts.get(id) })
  const { data: sale } = useQuery({
    queryKey: ['sale', data?.saleId],
    queryFn: () => api.sales.get(data!.saleId!),
    enabled: !!data?.saleId,
  })
  return (
    <Modal opened onClose={onClose} title="Chi tiết công nợ" centered size="lg">
      {isLoading || !data ? (
        <LoadingBlock label="Đang tải công nợ..." />
      ) : (
        <Stack>
          <Group justify="space-between">
            <Text fw={700} size="lg">
              {data.customerName}
            </Text>
            {data.balanceVnd > 0 ? (
              <Badge color={DEBT_AGING_BUCKET[data.agingBucket].color} variant="light">
                {data.agingBucket === 'current' ? 'Trong hạn' : `Quá hạn ${data.daysOverdue} ngày`}
              </Badge>
            ) : (
              <Badge color="teal" variant="light">
                Đã thu xong
              </Badge>
            )}
          </Group>

          <Card withBorder padding="sm" radius="md" style={{ background: SUBTLE_BG }}>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm">
                  🧾 Thuộc đơn hàng: <b>{data.saleId ? `#${data.saleId}` : '—'}</b>
                </Text>
                <Text size="sm">
                  Ngày mua: <b>{sale ? formatDate(sale.saleDate) : '—'}</b>
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Ngày phát sinh nợ: {formatDate(data.issuedDate)}
                </Text>
                <Text size="xs" c="dimmed">
                  Hạn trả: {formatDate(data.dueDate)}
                </Text>
              </Group>
            </Stack>
          </Card>

          <Group justify="space-between">
            <Text size="sm">
              Nợ gốc: <b>{formatVnd(data.amountVnd)}</b> · Đã trả:{' '}
              <Text span fw={700} c="teal">
                {formatVnd(data.paidVnd)}
              </Text>
            </Text>
            <Badge color={data.balanceVnd > 0 ? 'red' : 'teal'} variant="light" size="lg">
              Còn nợ: {formatVnd(data.balanceVnd)}
            </Badge>
          </Group>

          {sale && sale.items.length > 0 && (
            <>
              <Divider label="Sản phẩm trong đơn" labelPosition="left" />
              <Table withTableBorder fz="sm" verticalSpacing={6}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Sản phẩm</Table.Th>
                    <Table.Th w={50} ta="center">
                      SL
                    </Table.Th>
                    <Table.Th ta="right">Thành tiền</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sale.items.map((it) => (
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
                      <Table.Td ta="center">{it.qty}</Table.Td>
                      <Table.Td ta="right">{formatVnd(it.lineTotalVnd)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}

          <Divider label="Lịch sử thanh toán" labelPosition="left" />
          {data.payments.length === 0 ? (
            <Text size="sm" c="dimmed">
              Chưa có lần thanh toán nào.
            </Text>
          ) : (
            <Table withTableBorder fz="sm" verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ngày giờ trả</Table.Th>
                  <Table.Th ta="right">Số tiền</Table.Th>
                  <Table.Th>Hình thức</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.payments.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{formatDateTime(p.paidAt ?? p.paymentDate)}</Table.Td>
                    <Table.Td ta="right" fw={600} c="teal">
                      {formatVnd(p.amountVnd)}
                    </Table.Td>
                    <Table.Td>{p.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {data.notes && (
            <Text size="sm" c="dimmed">
              📝 {data.notes}
            </Text>
          )}
        </Stack>
      )}
    </Modal>
  )
}
