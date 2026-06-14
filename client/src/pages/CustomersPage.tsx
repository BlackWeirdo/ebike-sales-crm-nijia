import { useState } from 'react'
import { Table, Button, Modal, TextInput, Textarea, Group, ActionIcon, Text, Stack, Badge, SegmentedControl } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash, IconSearch, IconUser, IconBuildingStore } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Customer, CustomerType } from '@shared/types'
import { api, type CustomerInput } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ListTable } from '../components/ListTable.tsx'
import { CustomerDetailModal } from '../components/CustomerDetailModal.tsx'
import { CUSTOMER_TYPE } from '../lib/labels.ts'
import { toastOk, toastError } from '../lib/notify.ts'
import { confirmDelete } from '../lib/confirm.ts'

const EMPTY_CUSTOMER: CustomerInput = {
  type: 'individual',
  name: '',
  contactPerson: '',
  taxCode: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

export default function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search, 300)
  const [filter, setFilter] = useState<'all' | CustomerType>('all')
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', debounced, filter],
    queryFn: () => api.customers.list(debounced, filter === 'all' ? undefined : filter),
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const form = useForm<CustomerInput>({
    initialValues: EMPTY_CUSTOMER,
    validate: { name: (v) => (v.trim() ? null : 'Bắt buộc nhập tên') },
  })
  const isDealer = form.values.type === 'dealer'

  const saveMut = useMutation({
    mutationFn: (v: CustomerInput) => {
      const clean = (s: string | null) => (s ?? '').toString().trim() || null
      const payload: CustomerInput = {
        type: v.type,
        name: v.name.trim(),
        contactPerson: v.type === 'dealer' ? clean(v.contactPerson) : null,
        taxCode: v.type === 'dealer' ? clean(v.taxCode) : null,
        phone: clean(v.phone),
        email: clean(v.email),
        address: clean(v.address),
        notes: clean(v.notes),
      }
      return editing ? api.customers.update(editing.id, payload) : api.customers.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toastOk(editing ? 'Đã cập nhật khách hàng' : 'Đã thêm khách hàng')
      setModalOpen(false)
    },
    onError: toastError,
  })

  const delMut = useMutation({
    mutationFn: (id: number) => api.customers.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toastOk('Đã xóa khách hàng')
    },
    onError: toastError,
  })

  function openCreate() {
    setEditing(null)
    form.setValues(EMPTY_CUSTOMER)
    setModalOpen(true)
  }
  function openEdit(c: Customer) {
    setEditing(c)
    form.setValues({
      type: c.type,
      name: c.name,
      contactPerson: c.contactPerson ?? '',
      taxCode: c.taxCode ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    })
    setModalOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Khách hàng"
        subtitle="Quản lý khách lẻ (cá nhân) và đại lý — thông tin công ty, người liên hệ, mã số thuế"
        action={
          <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
            Thêm khách hàng
          </Button>
        }
      />

      <Group mb="md" justify="space-between">
        <TextInput
          placeholder="Tìm theo tên, SĐT, MST, người liên hệ..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={360}
        />
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as 'all' | CustomerType)}
          data={[
            { value: 'all', label: 'Tất cả' },
            { value: 'individual', label: 'Cá nhân' },
            { value: 'dealer', label: 'Đại lý' },
          ]}
        />
      </Group>

      <ListTable
        headers={['Tên', 'Loại', 'Điện thoại', 'MST', 'Người liên hệ', 'Địa chỉ', '']}
        minWidth={920}
        isEmpty={customers.length === 0}
        loading={isLoading}
        emptyText="Không có khách hàng nào."
      >
        {customers.map((c) => (
          <Table.Tr
            key={c.id}
            style={{ cursor: 'pointer' }}
            tabIndex={0}
            onClick={() => setDetailId(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setDetailId(c.id)
            }}
          >
            <Table.Td>
              <Group gap="xs">
                {c.type === 'dealer' ? <IconBuildingStore size={18} /> : <IconUser size={18} />}
                <Text fw={600} size="sm">
                  {c.name}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color={CUSTOMER_TYPE[c.type].color}>
                {CUSTOMER_TYPE[c.type].label}
              </Badge>
            </Table.Td>
            <Table.Td>{c.phone ?? '—'}</Table.Td>
            <Table.Td>{c.type === 'dealer' ? c.taxCode || '—' : '—'}</Table.Td>
            <Table.Td>{c.type === 'dealer' ? c.contactPerson || '—' : '—'}</Table.Td>
            <Table.Td>
              <Text size="sm" lineClamp={1}>
                {c.address || '—'}
              </Text>
            </Table.Td>
            <Table.Td onClick={(e) => e.stopPropagation()}>
              <Group gap={4} justify="flex-end">
                <ActionIcon variant="subtle" onClick={() => openEdit(c)}>
                  <IconEdit size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Xóa ${c.name}`}
                  onClick={() =>
                    confirmDelete({
                      message: `Xóa khách hàng "${c.name}"? Hành động này không thể hoàn tác.`,
                      onConfirm: () => delMut.mutate(c.id),
                    })
                  }
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </ListTable>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'} centered>
        <form onSubmit={form.onSubmit((v) => saveMut.mutate(v))}>
          <Stack>
            <SegmentedControl
              fullWidth
              value={form.values.type}
              onChange={(v) => form.setFieldValue('type', v as CustomerType)}
              data={[
                { value: 'individual', label: 'Khách cá nhân (lẻ)' },
                { value: 'dealer', label: 'Đại lý' },
              ]}
            />
            <TextInput label={isDealer ? 'Tên công ty / đại lý' : 'Tên khách hàng'} required {...form.getInputProps('name')} />
            {isDealer && (
              <Group grow>
                <TextInput label="Người liên hệ" placeholder="Tên người phụ trách" {...form.getInputProps('contactPerson')} />
                <TextInput label="Mã số thuế" {...form.getInputProps('taxCode')} />
              </Group>
            )}
            <Group grow>
              <TextInput label="Điện thoại" {...form.getInputProps('phone')} />
              <TextInput label="Email" {...form.getInputProps('email')} />
            </Group>
            <TextInput label="Địa chỉ" {...form.getInputProps('address')} />
            <Textarea label="Ghi chú" autosize minRows={2} {...form.getInputProps('notes')} />
            <Button type="submit" loading={saveMut.isPending} mt="sm">
              {editing ? 'Lưu thay đổi' : 'Thêm'}
            </Button>
          </Stack>
        </form>
      </Modal>

      {detailId && <CustomerDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </>
  )
}
