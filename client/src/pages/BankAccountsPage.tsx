import { useState } from 'react'
import { Table, Button, Modal, TextInput, Switch, Group, ActionIcon, Text, Stack, Badge } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconPlus, IconEdit, IconTrash, IconBuildingBank } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { BankAccount } from '@shared/types'
import { api, type BankAccountInput } from '../lib/api.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { ListTable } from '../components/ListTable.tsx'
import { toastOk, toastError } from '../lib/notify.ts'
import { confirmDelete } from '../lib/confirm.ts'

const EMPTY: BankAccountInput = {
  label: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  active: 1,
}

export default function BankAccountsPage() {
  const qc = useQueryClient()
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: api.bankAccounts.list,
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)

  const form = useForm<BankAccountInput>({
    initialValues: EMPTY,
    validate: { label: (v) => (v.trim() ? null : 'Bắt buộc nhập tên gợi nhớ') },
  })

  const saveMut = useMutation({
    mutationFn: (v: BankAccountInput) => {
      const payload: BankAccountInput = {
        label: v.label.trim(),
        bankName: (v.bankName ?? '').trim(),
        accountNumber: (v.accountNumber ?? '').trim(),
        accountHolder: (v.accountHolder ?? '').trim(),
        active: v.active ? 1 : 0,
      }
      return editing ? api.bankAccounts.update(editing.id, payload) : api.bankAccounts.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bankAccounts'] })
      toastOk(editing ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản')
      setModalOpen(false)
    },
    onError: toastError,
  })

  const delMut = useMutation({
    mutationFn: (id: number) => api.bankAccounts.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bankAccounts'] })
      toastOk('Đã ẩn tài khoản')
    },
    onError: toastError,
  })

  function openCreate() {
    setEditing(null)
    form.setValues(EMPTY)
    setModalOpen(true)
  }
  function openEdit(a: BankAccount) {
    setEditing(a)
    form.setValues({
      label: a.label,
      bankName: a.bankName,
      accountNumber: a.accountNumber,
      accountHolder: a.accountHolder,
      active: a.active,
    })
    setModalOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Tài khoản nhận tiền"
        subtitle="Danh mục tài khoản để chọn khi tạo đơn bán — in lên phiếu làm chỉ dẫn chuyển khoản cho khách"
        action={
          <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
            Thêm tài khoản
          </Button>
        }
      />

      <ListTable
        headers={['Tên gợi nhớ', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Trạng thái', '']}
        minWidth={820}
        isEmpty={accounts.length === 0}
        loading={isLoading}
        emptyText="Chưa có tài khoản nào. Thêm tài khoản công ty / cá nhân để dùng khi tạo đơn."
      >
        {accounts.map((a) => (
          <Table.Tr key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
            <Table.Td>
              <Group gap="xs">
                <IconBuildingBank size={18} />
                <Text fw={600} size="sm">
                  {a.label}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>{a.bankName || '—'}</Table.Td>
            <Table.Td>{a.accountNumber || '—'}</Table.Td>
            <Table.Td>{a.accountHolder || '—'}</Table.Td>
            <Table.Td>
              <Badge variant="light" color={a.active ? 'teal' : 'gray'}>
                {a.active ? 'Đang dùng' : 'Đã ẩn'}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Group gap={4} justify="flex-end">
                <ActionIcon variant="subtle" aria-label={`Sửa ${a.label}`} onClick={() => openEdit(a)}>
                  <IconEdit size={18} />
                </ActionIcon>
                {a.active === 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Ẩn ${a.label}`}
                    onClick={() =>
                      confirmDelete({
                        message: `Ẩn tài khoản "${a.label}"? Phiếu cũ vẫn in đúng (đã lưu bản sao). Có thể bật lại bằng cách sửa.`,
                        onConfirm: () => delMut.mutate(a.id),
                      })
                    }
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </ListTable>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        centered
      >
        <form onSubmit={form.onSubmit((v) => saveMut.mutate(v))}>
          <Stack>
            <TextInput
              label="Tên gợi nhớ"
              placeholder='VD: "Công ty - VCB", "NV Ngọc - MB"'
              required
              {...form.getInputProps('label')}
            />
            <Group grow>
              <TextInput label="Ngân hàng" placeholder="VD: Vietcombank" {...form.getInputProps('bankName')} />
              <TextInput label="Số tài khoản" {...form.getInputProps('accountNumber')} />
            </Group>
            <TextInput label="Chủ tài khoản" placeholder="Tên chủ TK" {...form.getInputProps('accountHolder')} />
            <Switch
              label="Đang dùng"
              checked={!!form.values.active}
              onChange={(e) => form.setFieldValue('active', e.currentTarget.checked ? 1 : 0)}
            />
            <Button type="submit" loading={saveMut.isPending} mt="sm">
              {editing ? 'Lưu thay đổi' : 'Thêm'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
