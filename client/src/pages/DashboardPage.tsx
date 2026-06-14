import { useState } from 'react'
import { Grid, Card, Text, Group, ThemeIcon, Box, TextInput, Table, Badge, Stack } from '@mantine/core'
import { AreaChart } from '@mantine/charts'
import {
  IconCash,
  IconShoppingCart,
  IconUserPlus,
  IconReceipt2,
  IconAlertTriangle,
  IconTrendingUp,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ChartCard } from '../components/ChartCard.tsx'
import { DashboardCustomerCharts } from '../components/DashboardCustomerCharts.tsx'
import { DashboardProductCharts } from '../components/DashboardProductCharts.tsx'
import { formatVnd, formatNumber, formatDate } from '../lib/format.ts'

function firstOfMonth(): string {
  return new Date().toISOString().slice(0, 8) + '01'
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const KPIS = [
  { key: 'revenueVnd', label: 'Doanh thu', icon: IconCash, color: 'teal', money: true },
  { key: 'collectedVnd', label: 'Tiền đã thu', icon: IconTrendingUp, color: 'green', money: true },
  { key: 'salesCount', label: 'Số đơn bán', icon: IconShoppingCart, color: 'blue', money: false },
  { key: 'newCustomers', label: 'Khách mới', icon: IconUserPlus, color: 'grape', money: false },
  { key: 'outstandingDebtVnd', label: 'Công nợ phải thu', icon: IconReceipt2, color: 'red', money: true },
  { key: 'lowStockCount', label: 'SP sắp hết', icon: IconAlertTriangle, color: 'orange', money: false },
] as const

export default function DashboardPage() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary', from, to],
    queryFn: () => api.dashboard.summary(from, to),
  })
  const { data: series = [] } = useQuery({
    queryKey: ['dashboard', 'series', from, to],
    queryFn: () => api.dashboard.revenueSeries(from, to),
  })

  const chartData = series.map((p) => ({ date: formatDate(p.date), 'Doanh thu': p.revenueVnd }))

  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle="Doanh thu, đơn hàng và công nợ theo khoảng thời gian"
        action={
          <Group gap="xs">
            <TextInput type="date" size="sm" label="Từ" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
            <TextInput type="date" size="sm" label="Đến" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
          </Group>
        }
      />

      <Grid mb="lg">
        {KPIS.map((kpi) => {
          const value = (summary?.[kpi.key] as number) ?? 0
          return (
            <Grid.Col key={kpi.key} span={{ base: 12, xs: 6, md: 4 }}>
              <Card withBorder padding="md" radius="md" h="100%">
                <Group gap="sm" wrap="nowrap" align="center">
                  <ThemeIcon size={42} radius="md" variant="light" color={kpi.color}>
                    <kpi.icon size={22} />
                  </ThemeIcon>
                  <Box style={{ minWidth: 0 }}>
                    <Text size="xs" c="dimmed" lh={1.2}>
                      {kpi.label}
                    </Text>
                    <Text fw={700} size="lg" lh={1.2}>
                      {kpi.money ? formatVnd(value) : formatNumber(value)}
                    </Text>
                  </Box>
                </Group>
              </Card>
            </Grid.Col>
          )
        })}
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <ChartCard
            title="Biểu đồ doanh thu"
            empty={chartData.length === 0}
            emptyText="Chưa có dữ liệu doanh thu trong khoảng này."
          >
            <AreaChart
              h={300}
              data={chartData}
              dataKey="date"
              series={[{ name: 'Doanh thu', color: 'teal.6' }]}
              curveType="monotone"
              valueFormatter={(v) => formatNumber(v)}
              withGradient
              withDots={chartData.length < 30}
            />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <ChartCard
            title="Top sản phẩm bán chạy"
            empty={!summary || summary.topProducts.length === 0}
            emptyText="Chưa có dữ liệu bán hàng."
          >
            <Table>
              <Table.Tbody>
                {summary?.topProducts.map((p, i) => (
                  <Table.Tr key={p.name}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="sm" variant="light" color="teal" circle>
                          {i + 1}
                        </Badge>
                        <Stack gap={0}>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {p.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {p.qty} cái
                          </Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text size="sm" fw={600} c="teal">
                        {formatVnd(p.revenueVnd)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ChartCard>
        </Grid.Col>
      </Grid>

      <DashboardCustomerCharts from={from} to={to} />
      <DashboardProductCharts from={from} to={to} />
    </>
  )
}
