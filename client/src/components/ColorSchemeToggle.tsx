import { ActionIcon, Tooltip, useMantineColorScheme, useComputedColorScheme } from '@mantine/core'
import { IconSun, IconMoon } from '@tabler/icons-react'

/** Nút chuyển Sáng/Tối — lựa chọn được nhớ qua localStorage (xem main.tsx). */
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computed === 'dark'

  return (
    <Tooltip label={isDark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}>
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
        aria-label="Chuyển chế độ sáng/tối"
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  )
}
