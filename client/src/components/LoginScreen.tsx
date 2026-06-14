import { useState } from 'react'
import { Center, Paper, Stack, PasswordInput, Button, Group, ThemeIcon, Title, Text } from '@mantine/core'
import { IconBike, IconLock } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { toastError } from '../lib/notify.ts'

/** Màn đăng nhập 1 mật khẩu — hiện khi server bật auth và chưa đăng nhập. */
export function LoginScreen() {
  const qc = useQueryClient()
  const [password, setPassword] = useState('')

  const loginMut = useMutation({
    mutationFn: () => api.auth.login(password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
    onError: toastError,
  })

  return (
    <Center h="100vh" p="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
      <Paper withBorder radius="lg" p="xl" w={380} shadow="md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (password) loginMut.mutate()
          }}
        >
          <Stack>
            <Group justify="center">
              <ThemeIcon size={56} radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
                <IconBike size={32} />
              </ThemeIcon>
            </Group>
            <Stack gap={2} align="center">
              <Title order={3}>Xe Đạp Điện</Title>
              <Text size="sm" c="dimmed">
                Nhập mật khẩu để vào quản lý cửa hàng
              </Text>
            </Stack>
            <PasswordInput
              label="Mật khẩu"
              placeholder="••••••••"
              leftSection={<IconLock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              data-autofocus
              autoFocus
              required
            />
            <Button type="submit" fullWidth loading={loginMut.isPending} disabled={!password}>
              Đăng nhập
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
