import { Modal, Table, Button, Group, ActionIcon, Text, TextInput, Divider, ScrollArea, Badge } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProductWithStock, InventoryUnit } from '@shared/types'
import { api } from '../lib/api.ts'
import { MoneyInput } from './MoneyInput.tsx'
import { formatDate, today } from '../lib/format.ts'
import { toastOk, toastError } from '../lib/notify.ts'

const UNIT_STATUS: Record<InventoryUnit['status'], { label: string; color: string }> = {
  in_stock: { label: 'Còn trong kho', color: 'teal' },
  sold: { label: 'Đã bán', color: 'gray' },
  reserved: { label: 'Đã giữ', color: 'yellow' },
  returned: { label: 'Đã trả', color: 'orange' },
}

/** Modal quản lý serial (đơn vị tồn kho) của 1 sản phẩm loại xe: nhập kho + xóa. */
export function UnitsModal({ product, onClose }: { product: ProductWithStock; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: units = [] } = useQuery({
    queryKey: ['units', product.id],
    queryFn: () => api.products.units(product.id),
  })
  const form = useForm({ initialValues: { serialNumber: '', costVnd: product.costVnd, acquiredDate: today() } })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['units', product.id] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const addMut = useMutation({
    mutationFn: (v: { serialNumber: string; costVnd: number; acquiredDate: string }) => api.products.addUnit(product.id, v),
    onSuccess: () => {
      refresh()
      form.setFieldValue('serialNumber', '')
      toastOk('Đã nhập serial vào kho')
    },
    onError: toastError,
  })

  const delMut = useMutation({
    mutationFn: (unitId: number) => api.products.removeUnit(unitId),
    onSuccess: refresh,
    onError: toastError,
  })

  return (
    <Modal opened onClose={onClose} title={`Serial: ${product.name}`} size="lg" centered>
      <form onSubmit={form.onSubmit((v) => addMut.mutate(v))}>
        <Group align="flex-end" gap="sm">
          <TextInput label="Số serial" required style={{ flex: 1 }} {...form.getInputProps('serialNumber')} />
          <MoneyInput label="Giá nhập (₫)" w={140} {...form.getInputProps('costVnd')} />
          <TextInput label="Ngày nhập" type="date" {...form.getInputProps('acquiredDate')} />
          <Button type="submit" loading={addMut.isPending} leftSection={<IconPlus size={16} />}>
            Nhập kho
          </Button>
        </Group>
      </form>
      <Divider my="md" />
      <ScrollArea h={320}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Serial</Table.Th>
              <Table.Th>Trạng thái</Table.Th>
              <Table.Th>Ngày nhập</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {units.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td fw={600}>{u.serialNumber}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={UNIT_STATUS[u.status].color}>
                    {UNIT_STATUS[u.status].label}
                  </Badge>
                </Table.Td>
                <Table.Td>{formatDate(u.acquiredDate)}</Table.Td>
                <Table.Td align="right">
                  {u.status === 'in_stock' && (
                    <ActionIcon variant="subtle" color="red" onClick={() => delMut.mutate(u.id)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {units.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="md">
                    Chưa có serial nào. Nhập serial ở trên.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Modal>
  )
}
