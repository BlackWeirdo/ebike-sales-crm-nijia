import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'
import './styles.css'
import App from './App.tsx'

// Unified design tokens — single source of truth for the whole app (no per-component hardcoded colors).
const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: { light: 6, dark: 5 },
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer', // checkboxes/switches show a pointer
  autoContrast: true, // auto-pick readable text color on filled elements
  focusRing: 'auto', // visible focus ring for keyboard users only
  components: {
    Card: { defaultProps: { radius: 'md' } },
    Button: { defaultProps: { radius: 'md' } },
    Modal: { defaultProps: { radius: 'md', overlayProps: { blur: 2, backgroundOpacity: 0.45 } } },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 250 } },
  },
})

// Persist the user's light/dark choice; default follows the OS until they toggle.
const colorSchemeManager = localStorageColorSchemeManager({ key: 'crm-color-scheme' })

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 10_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
      <Notifications position="top-right" autoClose={3500} />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
)
