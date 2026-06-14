import { Grid, Group, Stack, Text, Box } from '@mantine/core'
import { BarChart, CompositeChart, DonutChart } from '@mantine/charts'
import { IconBox } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { ChartCard, SectionTitle } from './ChartCard.tsx'
import { PRODUCT_TYPE } from '../lib/labels.ts'
import { formatVnd, formatNumber } from '../lib/format.ts'

/** Nhóm biểu đồ phân tích sản phẩm trên trang Tổng quan. */
export function DashboardProductCharts({ from, to }: { from: string; to: string }) {
  const { data: prod } = useQuery({
    queryKey: ['dashboard', 'product-analytics', from, to],
    queryFn: () => api.dashboard.productAnalytics(from, to),
  })

  const revByTypeDonut = (prod?.revenueByType ?? [])
    .filter((r) => r.revenueVnd > 0)
    .map((r) => ({ name: PRODUCT_TYPE[r.type].label, value: r.revenueVnd, color: r.type === 'SERIALIZED' ? 'teal.6' : 'grape.6' }))
  const topData = (prod?.topProducts ?? []).map((p) => ({ name: p.name, 'Doanh thu': p.revenueVnd, 'Số lượng': p.qty }))
  const stockStatusDonut = prod
    ? [
        { name: 'Đủ hàng', value: prod.stockStatus.healthy, color: 'teal.6' },
        { name: 'Sắp hết', value: prod.stockStatus.low, color: 'orange.6' },
        { name: 'Hết hàng', value: prod.stockStatus.out, color: 'red.6' },
      ].filter((d) => d.value > 0)
    : []
  const stockValueData = (prod?.stockValue ?? []).map((p) => ({ name: p.name, 'Giá trị tồn': p.valueVnd }))
  const totalStockCount = prod ? prod.stockStatus.healthy + prod.stockStatus.low + prod.stockStatus.out : 0

  return (
    <>
      <SectionTitle icon={IconBox} color="teal">
        Phân tích sản phẩm
      </SectionTitle>
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <ChartCard title="Doanh thu theo loại SP" empty={revByTypeDonut.length === 0}>
            <Group justify="center" my="sm">
              <DonutChart data={revByTypeDonut} size={170} thickness={28} withTooltip valueFormatter={(v) => formatVnd(v)} />
            </Group>
            <Stack gap={4}>
              {(prod?.revenueByType ?? []).map((r) => (
                <Group key={r.type} justify="space-between">
                  <Group gap={6}>
                    <Box
                      w={10}
                      h={10}
                      style={{
                        borderRadius: 2,
                        background: r.type === 'SERIALIZED' ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-grape-6)',
                      }}
                    />
                    <Text size="sm">{PRODUCT_TYPE[r.type].label}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {r.qty} cái · {formatVnd(r.revenueVnd)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <ChartCard title="Top sản phẩm: số lượng & doanh thu" empty={topData.length === 0}>
            <CompositeChart
              h={300}
              data={topData}
              dataKey="name"
              series={[
                { name: 'Doanh thu', color: 'teal.6', type: 'bar' },
                { name: 'Số lượng', color: 'orange.6', type: 'line', yAxisId: 'right' },
              ]}
              withRightYAxis
              rightYAxisProps={{ tickFormatter: (v: number) => formatNumber(v) }}
              valueFormatter={(v) => formatNumber(v)}
              xAxisProps={{ angle: -15, textAnchor: 'end', height: 60, interval: 0, tick: { fontSize: 11 } }}
            />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <ChartCard title="Tình trạng tồn kho" empty={stockStatusDonut.length === 0} emptyText="Chưa có sản phẩm.">
            <Group justify="center" my="sm">
              <DonutChart
                data={stockStatusDonut}
                size={170}
                thickness={28}
                withTooltip
                chartLabel={`${totalStockCount} SP`}
                valueFormatter={(v) => `${formatNumber(v)} SP`}
              />
            </Group>
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <ChartCard title="Giá trị tồn kho theo SP" empty={stockValueData.length === 0} emptyText="Chưa có hàng tồn.">
            <BarChart
              h={300}
              data={stockValueData}
              dataKey="name"
              orientation="vertical"
              series={[{ name: 'Giá trị tồn', color: 'blue.6' }]}
              valueFormatter={(v) => formatNumber(v)}
              yAxisProps={{ width: 140 }}
              barProps={{ radius: 4 }}
            />
          </ChartCard>
        </Grid.Col>
      </Grid>
    </>
  )
}
