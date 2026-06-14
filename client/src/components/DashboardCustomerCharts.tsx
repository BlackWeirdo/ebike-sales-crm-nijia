import { Grid, Group, Stack, Text, Box, Divider } from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import { IconUsers } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { ChartCard, SectionTitle } from './ChartCard.tsx'
import { CUSTOMER_TYPE } from '../lib/labels.ts'
import { formatVnd, formatNumber, formatDate } from '../lib/format.ts'

/** Nhóm biểu đồ phân tích khách hàng trên trang Tổng quan. */
export function DashboardCustomerCharts({ from, to }: { from: string; to: string }) {
  const { data: cust } = useQuery({
    queryKey: ['dashboard', 'customer-analytics', from, to],
    queryFn: () => api.dashboard.customerAnalytics(from, to),
  })

  const typeDonut = (cust?.byType ?? [])
    .filter((r) => r.count > 0)
    .map((r) => ({ name: CUSTOMER_TYPE[r.type].label, value: r.count, color: r.type === 'individual' ? 'teal.6' : 'blue.6' }))
  const topData = (cust?.topCustomers ?? []).map((c) => ({ name: c.name, 'Doanh thu': c.revenueVnd }))
  const newData = (cust?.newCustomersSeries ?? []).map((p) => ({ date: formatDate(p.date), 'Khách mới': p.count }))
  const debtDonut = cust
    ? [
        { name: 'Còn nợ', value: cust.debt.withDebtCount, color: 'red.6' },
        { name: 'Đã thanh toán', value: cust.debt.clearCount, color: 'teal.6' },
      ].filter((d) => d.value > 0)
    : []

  return (
    <>
      <SectionTitle icon={IconUsers} color="grape">
        Phân tích khách hàng
      </SectionTitle>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <ChartCard title="Cơ cấu khách hàng" empty={typeDonut.length === 0} emptyText="Chưa có khách hàng.">
            <Group justify="center" my="sm">
              <DonutChart
                data={typeDonut}
                size={170}
                thickness={28}
                withTooltip
                chartLabel={`${cust?.byType.reduce((s, r) => s + r.count, 0) ?? 0} KH`}
                tooltipDataSource="segment"
                valueFormatter={(v) => `${formatNumber(v)} KH`}
              />
            </Group>
            <Stack gap={4}>
              {(cust?.byType ?? []).map((r) => (
                <Group key={r.type} justify="space-between">
                  <Group gap={6}>
                    <Box
                      w={10}
                      h={10}
                      style={{
                        borderRadius: 2,
                        background: r.type === 'individual' ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-blue-6)',
                      }}
                    />
                    <Text size="sm">{CUSTOMER_TYPE[r.type].label}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {r.count} KH · {formatVnd(r.revenueVnd)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <ChartCard title="Top khách hàng theo doanh thu" empty={topData.length === 0}>
            <BarChart
              h={300}
              data={topData}
              dataKey="name"
              orientation="vertical"
              series={[{ name: 'Doanh thu', color: 'grape.6' }]}
              valueFormatter={(v) => formatNumber(v)}
              yAxisProps={{ width: 140 }}
              barProps={{ radius: 4 }}
            />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <ChartCard title="Khách mới theo thời gian" empty={newData.length === 0}>
            <BarChart
              h={260}
              data={newData}
              dataKey="date"
              series={[{ name: 'Khách mới', color: 'teal.6' }]}
              valueFormatter={(v) => formatNumber(v)}
              barProps={{ radius: 4 }}
            />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <ChartCard title="Khách hàng theo công nợ" empty={debtDonut.length === 0} emptyText="Chưa có dữ liệu công nợ.">
            <Group justify="center" my="sm">
              <DonutChart data={debtDonut} size={150} thickness={26} withTooltip valueFormatter={(v) => `${formatNumber(v)} KH`} />
            </Group>
            <Divider my="sm" />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Tổng dư nợ
              </Text>
              <Text size="sm" fw={700} c="red">
                {formatVnd(cust?.debt.outstandingVnd ?? 0)}
              </Text>
            </Group>
          </ChartCard>
        </Grid.Col>
      </Grid>
    </>
  )
}
