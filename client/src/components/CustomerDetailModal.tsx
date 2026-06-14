import { Modal, Group, Text, Stack, Badge, Grid, Box, Card, Divider, ScrollArea, Accordion, Table } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { formatVnd, formatDate } from '../lib/format.ts'
import { CUSTOMER_TYPE } from '../lib/labels.ts'
import { LoadingBlock } from './LoadingBlock.tsx'

const SUBTLE_BG = 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))'

/** Modal chi tiết khách hàng: thông tin + thống kê (đơn/chi tiêu/nợ) + lịch sử mua hàng. */
export function CustomerDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['customer', id], queryFn: () => api.customers.get(id) })
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: () => api.customers.orders(id),
  })
  return (
    <Modal opened onClose={onClose} title="Chi tiết khách hàng" centered size="lg">
      {isLoading || !data ? (
        <LoadingBlock label="Đang tải thông tin khách hàng..." />
      ) : (
        <Stack>
          <Box>
            <Group gap="xs">
              <Text fw={700} size="lg">
                {data.name}
              </Text>
              <Badge variant="light" color={CUSTOMER_TYPE[data.type].color}>
                {CUSTOMER_TYPE[data.type].label}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {data.phone ?? 'Không có SĐT'} · {data.email ?? 'Không có email'}
            </Text>
          </Box>
          {data.type === 'dealer' && (
            <Card withBorder padding="sm" radius="md" style={{ background: SUBTLE_BG }}>
              <Stack gap={4}>
                {data.contactPerson && (
                  <Text size="sm">
                    👤 Người liên hệ: <b>{data.contactPerson}</b>
                  </Text>
                )}
                {data.taxCode && (
                  <Text size="sm">
                    🧾 Mã số thuế: <b>{data.taxCode}</b>
                  </Text>
                )}
                {!data.contactPerson && !data.taxCode && (
                  <Text size="sm" c="dimmed">
                    Chưa có thông tin công ty bổ sung.
                  </Text>
                )}
              </Stack>
            </Card>
          )}
          {data.address && <Text size="sm">📍 {data.address}</Text>}
          {data.notes && (
            <Text size="sm" c="dimmed">
              📝 {data.notes}
            </Text>
          )}
          <Grid mt="sm">
            <Grid.Col span={4}>
              <Card withBorder padding="sm" ta="center">
                <Text size="xl" fw={700}>
                  {data.stats.purchaseCount}
                </Text>
                <Text size="xs" c="dimmed">
                  Đơn mua
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder padding="sm" ta="center">
                <Text size="sm" fw={700} c="teal">
                  {formatVnd(data.stats.totalSpentVnd)}
                </Text>
                <Text size="xs" c="dimmed">
                  Tổng chi tiêu
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder padding="sm" ta="center">
                <Badge color={data.stats.outstandingDebtVnd > 0 ? 'red' : 'teal'} variant="light">
                  {formatVnd(data.stats.outstandingDebtVnd)}
                </Badge>
                <Text size="xs" c="dimmed" mt={4}>
                  Còn nợ
                </Text>
              </Card>
            </Grid.Col>
          </Grid>

          <Divider label="Lịch sử mua hàng" labelPosition="left" mt="xs" />
          {ordersLoading ? (
            <Text c="dimmed" size="sm">
              Đang tải đơn hàng...
            </Text>
          ) : orders.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">
              Khách hàng chưa có đơn mua nào.
            </Text>
          ) : (
            <ScrollArea.Autosize mah={360}>
              <Accordion variant="separated" radius="md">
                {orders.map((o) => {
                  const remaining = o.totalVnd - o.collectedVnd
                  return (
                    <Accordion.Item key={o.id} value={String(o.id)}>
                      <Accordion.Control>
                        <Group justify="space-between" pr="sm" wrap="nowrap">
                          <Box>
                            <Text fw={600} size="sm">
                              Đơn #{o.id}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatDate(o.saleDate)} · {o.items.length} sản phẩm
                            </Text>
                          </Box>
                          <Box ta="right">
                            <Text fw={600} size="sm" c="teal">
                              {formatVnd(o.totalVnd)}
                            </Text>
                            {remaining > 0 && (
                              <Badge color="red" variant="light" size="xs">
                                Còn nợ {formatVnd(remaining)}
                              </Badge>
                            )}
                          </Box>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Table withTableBorder verticalSpacing={6} fz="sm">
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Sản phẩm</Table.Th>
                              <Table.Th w={50} ta="center">
                                SL
                              </Table.Th>
                              <Table.Th ta="right">Đơn giá</Table.Th>
                              <Table.Th ta="right">Thành tiền</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {o.items.map((it) => (
                              <Table.Tr key={it.id}>
                                <Table.Td>
                                  {it.productName}
                                  {it.serialNumber && (
                                    <Text size="xs" c="dimmed">
                                      SN: {it.serialNumber}
                                    </Text>
                                  )}
                                </Table.Td>
                                <Table.Td ta="center">{it.qty}</Table.Td>
                                <Table.Td ta="right">{formatVnd(it.unitPriceVnd)}</Table.Td>
                                <Table.Td ta="right">{formatVnd(it.lineTotalVnd)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                        {o.notes && (
                          <Text size="xs" c="dimmed" mt={6}>
                            Ghi chú: {o.notes}
                          </Text>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>
                  )
                })}
              </Accordion>
            </ScrollArea.Autosize>
          )}
        </Stack>
      )}
    </Modal>
  )
}
