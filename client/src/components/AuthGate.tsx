import type { ReactNode } from 'react'
import { Center, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { LoginScreen } from './LoginScreen.tsx'

/** Cổng đăng nhập: kiểm tra phiên; chưa đăng nhập → màn login; auth tắt (dev) → cho vào thẳng. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ['auth', 'me'], queryFn: api.auth.me, retry: false })

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader color="teal" />
      </Center>
    )
  }
  if (data && data.authEnabled && !data.authed) return <LoginScreen />
  return <>{children}</>
}
