import type { ReactNode } from 'react'
import { Card, Text, Group, ThemeIcon } from '@mantine/core'
import type { Icon as TablerIcon } from '@tabler/icons-react'

/** Tiêu đề một nhóm biểu đồ trên dashboard (icon + chữ). */
export function SectionTitle({
  icon: Icon,
  color,
  children,
}: {
  icon: TablerIcon
  color: string
  children: string
}) {
  return (
    <Group gap="xs" mt="xl" mb="sm">
      <ThemeIcon size={30} radius="md" variant="light" color={color}>
        <Icon size={18} />
      </ThemeIcon>
      <Text fw={700} size="lg">
        {children}
      </Text>
    </Group>
  )
}

interface ChartCardProps {
  title: string
  action?: ReactNode
  empty?: boolean
  emptyText?: string
  children: ReactNode
}

/** Khung thẻ biểu đồ dùng chung cho dashboard: tiêu đề + trạng thái rỗng nhất quán. */
export function ChartCard({ title, action, empty, emptyText, children }: ChartCardProps) {
  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Text fw={600}>{title}</Text>
        {action}
      </Group>
      {empty ? (
        <Text c="dimmed" ta="center" py="xl">
          {emptyText ?? 'Chưa có dữ liệu trong khoảng này.'}
        </Text>
      ) : (
        children
      )}
    </Card>
  )
}
