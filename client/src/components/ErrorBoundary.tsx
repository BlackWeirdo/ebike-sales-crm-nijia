import { Component, type ReactNode } from 'react'
import { Container, Alert, Button, Code, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

interface State {
  error: Error | null
}

/** Catches render errors in the subtree so the whole app never goes blank-white. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.error) {
      return (
        <Container size="sm" py="xl">
          <Alert color="red" icon={<IconAlertTriangle />} title="Đã xảy ra lỗi hiển thị" radius="md">
            <Stack gap="sm">
              <Text size="sm">Có lỗi khi hiển thị trang. Hãy thử tải lại. Nếu vẫn lỗi, báo lại nội dung bên dưới.</Text>
              <Code block>{this.state.error.message}</Code>
              <Button onClick={() => window.location.reload()} w="fit-content">
                Tải lại trang
              </Button>
            </Stack>
          </Alert>
        </Container>
      )
    }
    return this.props.children
  }
}
