import { Group, Title, Text, Box } from '@mantine/core'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" gap="sm" wrap="wrap">
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Title order={2} fw={700}>
          {title}
        </Title>
        {subtitle && (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        )}
      </Box>
      {action}
    </Group>
  )
}
