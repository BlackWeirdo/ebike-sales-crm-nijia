import { ActionIcon, Tooltip } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { toastError } from '../lib/notify.ts'

/** Nút đăng xuất — chỉ hiện khi server bật auth (APP_PASSWORD). */
export function LogoutButton() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['auth', 'me'], queryFn: api.auth.me, retry: false })
  const logoutMut = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
    onError: toastError,
  })

  if (!data?.authEnabled) return null

  return (
    <Tooltip label="Đăng xuất">
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        onClick={() => logoutMut.mutate()}
        loading={logoutMut.isPending}
        aria-label="Đăng xuất"
      >
        <IconLogout size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
