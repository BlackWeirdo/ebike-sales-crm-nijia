import { lazy, Suspense } from 'react'
import { AppShell, Group, Text, NavLink, ThemeIcon, Box, Center, Loader, Burger } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconLayoutDashboard,
  IconBox,
  IconUsers,
  IconShoppingCart,
  IconReceipt2,
  IconBike,
} from '@tabler/icons-react'
import { Routes, Route, NavLink as RouterNavLink, Navigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ColorSchemeToggle } from './components/ColorSchemeToggle.tsx'

// Lazy-load each page → code-split heavy deps (recharts on Dashboard, xlsx on Products) into separate chunks.
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'))
const ProductsPage = lazy(() => import('./pages/ProductsPage.tsx'))
const CustomersPage = lazy(() => import('./pages/CustomersPage.tsx'))
const SalesPage = lazy(() => import('./pages/SalesPage.tsx'))
const DebtsPage = lazy(() => import('./pages/DebtsPage.tsx'))

const NAV = [
  { to: '/dashboard', label: 'Tổng quan', icon: IconLayoutDashboard },
  { to: '/products', label: 'Tồn kho', icon: IconBox },
  { to: '/sales', label: 'Bán hàng', icon: IconShoppingCart },
  { to: '/customers', label: 'Khách hàng', icon: IconUsers },
  { to: '/debts', label: 'Công nợ', icon: IconReceipt2 },
]

export default function App() {
  const location = useLocation()
  const [opened, { toggle, close }] = useDisclosure(false)

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Mở/đóng menu" />
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
            <IconBike size={22} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="sm" lh={1.1}>
              Xe Đạp Điện
            </Text>
            <Text size="xs" c="dimmed" visibleFrom="xs">
              Quản lý cửa hàng
            </Text>
          </Box>
          <Box style={{ flex: 1 }} />
          <ColorSchemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            component={RouterNavLink}
            to={item.to}
            label={item.label}
            leftSection={<item.icon size={20} stroke={1.6} />}
            onClick={close}
            style={{ borderRadius: 8 }}
            mb={4}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main style={{ background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))' }}>
        <ErrorBoundary key={location.pathname}>
          <Suspense
            fallback={
              <Center h="60vh">
                <Loader color="teal" />
              </Center>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/debts" element={<DebtsPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell.Main>
    </AppShell>
  )
}
