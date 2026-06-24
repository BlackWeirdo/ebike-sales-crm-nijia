import { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Group,
  Badge,
  ActionIcon,
  Text,
  Stack,
  Switch,
  Tooltip,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconPlus, IconEdit, IconTrash, IconBike, IconPackage, IconFileSpreadsheet } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProductWithStock } from '@shared/types'
import { api, type ProductInput } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ListTable } from '../components/ListTable.tsx'
import { MoneyInput } from '../components/MoneyInput.tsx'
import { ImportModal } from '../components/ImportModal.tsx'
import { UnitsModal } from '../components/UnitsModal.tsx'
import { formatVnd } from '../lib/format.ts'
import { toastOk, toastError } from '../lib/notify.ts'
import { confirmDelete } from '../lib/confirm.ts'

const EMPTY_PRODUCT: ProductInput = {
  sku: '',
  name: '',
  type: 'QUANTITY',
  category: 'bike',
  color: '',
  costVnd: 0,
  sellingPriceVnd: 0,
  qtyOnHand: 0,
  lowStockThreshold: 1,
  active: 1,
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: api.products.list })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProductWithStock | null>(null)
  const [unitsFor, setUnitsFor] = useState<ProductWithStock | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm<ProductInput>({ initialValues: EMPTY_PRODUCT })

  const saveMut = useMutation({
    mutationFn: (v: ProductInput) => {
      const payload: ProductInput = { ...v, color: (v.color ?? '').toString().trim() || null }
      return editing ? api.products.update(editing.id, payload) : api.products.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toastOk(editing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
      setModalOpen(false)
    },
    onError: toastError,
  })

  const delMut = useMutation({
    mutationFn: (id: number) => api.products.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toastOk('Đã xóa sản phẩm')
    },
    onError: toastError,
  })

  function openCreate() {
    setEditing(null)
    form.setValues(EMPTY_PRODUCT)
    setModalOpen(true)
  }
  function openEdit(p: ProductWithStock) {
    setEditing(p)
    form.setValues({
      sku: p.sku,
      name: p.name,
      type: p.type,
      category: p.category,
      color: p.color ?? '',
      costVnd: p.costVnd,
      sellingPriceVnd: p.sellingPriceVnd,
      qtyOnHand: p.qtyOnHand,
      lowStockThreshold: p.lowStockThreshold,
      active: p.active,
    })
    setModalOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Tồn kho sản phẩm"
        subtitle="Quản lý xe đạp điện & phụ kiện — theo số lượng hoặc theo serial"
        action={
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileSpreadsheet size={18} />} onClick={() => setImportOpen(true)}>
              Nhập Excel
            </Button>
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              Thêm sản phẩm
            </Button>
          </Group>
        }
      />

      <ListTable
        headers={['Sản phẩm', 'Loại', 'Màu', 'Giá nhập', 'Giá bán', 'Tồn', '']}
        isEmpty={products.length === 0}
        loading={isLoading}
        emptyText='Chưa có sản phẩm. Bấm "Thêm sản phẩm".'
      >
        {products.map((p) => {
          const low = p.active === 1 && p.unitsInStock <= p.lowStockThreshold
          return (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Group gap="xs">
                  {p.category === 'bike' ? <IconBike size={18} /> : <IconPackage size={18} />}
                  <div>
                    <Text fw={600} size="sm">
                      {p.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {p.sku}
                    </Text>
                  </div>
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap={6}>
                  <Badge variant="light" color={p.category === 'bike' ? 'teal' : 'grape'}>
                    {p.category === 'bike' ? 'Xe' : 'Phụ kiện'}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {p.type === 'SERIALIZED' ? 'serial' : 'số lượng'}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>{p.color || '—'}</Table.Td>
              <Table.Td>{formatVnd(p.costVnd)}</Table.Td>
              <Table.Td>{formatVnd(p.sellingPriceVnd)}</Table.Td>
              <Table.Td>
                <Badge color={low ? 'red' : 'teal'} variant={low ? 'filled' : 'light'}>
                  {p.unitsInStock}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap={4} justify="flex-end">
                  {p.type === 'SERIALIZED' && (
                    <Tooltip label="Quản lý serial">
                      <ActionIcon variant="subtle" color="blue" onClick={() => setUnitsFor(p)}>
                        <IconBike size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <ActionIcon variant="subtle" onClick={() => openEdit(p)}>
                    <IconEdit size={18} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Xóa ${p.name}`}
                    onClick={() =>
                      confirmDelete({
                        message: `Xóa sản phẩm "${p.name}"? Hành động này không thể hoàn tác.`,
                        onConfirm: () => delMut.mutate(p.id),
                      })
                    }
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          )
        })}
      </ListTable>

      {/* Create / edit modal */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} centered>
        <form onSubmit={form.onSubmit((v) => saveMut.mutate(v))}>
          <Stack>
            <TextInput label="Tên sản phẩm" required {...form.getInputProps('name')} />
            <TextInput label="Mã SKU" required {...form.getInputProps('sku')} />
            <Select
              label="Danh mục"
              description="Dùng cho biểu đồ doanh thu theo loại SP"
              data={[
                { value: 'bike', label: 'Xe' },
                { value: 'accessory', label: 'Phụ kiện' },
              ]}
              allowDeselect={false}
              {...form.getInputProps('category')}
            />
            <Select
              label="Cách quản lý tồn kho"
              data={[
                { value: 'QUANTITY', label: 'Theo số lượng (bán buôn — không cần serial)' },
                { value: 'SERIALIZED', label: 'Theo serial (định danh từng xe — cần bảo hành)' },
              ]}
              allowDeselect={false}
              {...form.getInputProps('type')}
            />
            <TextInput label="Màu sắc" placeholder="VD: Đỏ, Đen, Trắng..." {...form.getInputProps('color')} />
            <Group grow>
              <MoneyInput label="Giá nhập (₫)" {...form.getInputProps('costVnd')} />
              <MoneyInput label="Giá bán (₫)" {...form.getInputProps('sellingPriceVnd')} />
            </Group>
            {form.values.type === 'QUANTITY' && (
              <NumberInput label="Số lượng tồn" min={0} {...form.getInputProps('qtyOnHand')} />
            )}
            <NumberInput label="Ngưỡng cảnh báo tồn thấp" min={0} {...form.getInputProps('lowStockThreshold')} />
            <Switch
              label="Đang kinh doanh"
              checked={form.values.active === 1}
              onChange={(e) => form.setFieldValue('active', e.currentTarget.checked ? 1 : 0)}
            />
            <Button type="submit" loading={saveMut.isPending} mt="sm">
              {editing ? 'Lưu thay đổi' : 'Thêm'}
            </Button>
          </Stack>
        </form>
      </Modal>

      {unitsFor && <UnitsModal product={unitsFor} onClose={() => setUnitsFor(null)} />}
      <ImportModal opened={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
