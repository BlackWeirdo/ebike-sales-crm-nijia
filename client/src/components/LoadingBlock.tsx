import { Center, Loader, Stack, Text } from '@mantine/core'

/** Trạng thái đang tải gọn, căn giữa — dùng trong modal/khu vực chờ dữ liệu. */
export function LoadingBlock({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <Loader color="teal" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Center>
  )
}
