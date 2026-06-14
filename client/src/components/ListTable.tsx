import type { ReactNode } from 'react'
import { Card, Table, Text, Skeleton } from '@mantine/core'

interface ListTableProps {
  /** Tiêu đề cột. Cột thao tác cuối truyền '' (ô trống). */
  headers: ReactNode[]
  minWidth?: number
  /** true = không có dòng nào → hiện dòng "trống" hoặc skeleton khi đang tải. */
  isEmpty: boolean
  loading?: boolean
  emptyText: string
  /** Các <Table.Tr> dữ liệu. */
  children: ReactNode
}

const THEAD_BG = 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))'

/**
 * Khung bảng danh sách dùng chung: Card + cuộn ngang + header (adaptive sáng/tối) +
 * skeleton khi tải + dòng trạng thái rỗng. Cột tự suy ra colSpan từ số header.
 */
export function ListTable({ headers, minWidth = 700, isEmpty, loading, emptyText, children }: ListTableProps) {
  return (
    <Card withBorder padding="0" radius="md">
      <Table.ScrollContainer minWidth={minWidth}>
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
          <Table.Thead style={{ background: THEAD_BG }}>
            <Table.Tr>
              {headers.map((h, i) => (
                <Table.Th key={i}>{h}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <Table.Tr key={r}>
                  {headers.map((_, c) => (
                    <Table.Td key={c}>
                      <Skeleton height={18} radius="sm" />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            ) : isEmpty ? (
              <Table.Tr>
                <Table.Td colSpan={headers.length}>
                  <Text ta="center" c="dimmed" py="xl">
                    {emptyText}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              children
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  )
}
