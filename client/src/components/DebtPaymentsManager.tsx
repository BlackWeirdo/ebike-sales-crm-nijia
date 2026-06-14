import { useState } from 'react'
import { Table, Button, Group, ActionIcon, Text, Stack, Select, TextInput, Divider, Box, Badge } from '@mantine/core'
import { IconCash, IconEdit, IconTrash, IconX, IconPlus } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PaymentInput } from '../lib/api.ts'
import { MoneyInput } from './MoneyInput.tsx'
import { LoadingBlock } from './LoadingBlock.tsx'
import { formatVnd, formatDateTime, nowLocal } from '../lib/format.ts'
import { toastOk, toastError } from '../lib/notify.ts'
import { confirmDelete } from '../lib/confirm.ts'

/**
 * Manage all debt payments for one debt: list + add + edit + delete.
 * Every mutation recalculates the debt (server) and refreshes sales/debts/dashboard views.
 */
export function DebtPaymentsManager({ debtId }: { debtId: number }) {
  const qc = useQueryClient()
  const { data: debt, isLoading } = useQuery({ queryKey: ['debt', debtId], queryFn: () => api.debts.get(debtId) })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [paidAt, setPaidAt] = useState(nowLocal())
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash')

  function refreshAll() {
    // debt_payments is the single source of truth → refresh every view that derives from it
    for (const key of [['debt'], ['debts'], ['sales'], ['sale'], ['dashboard'], ['customers'], ['customer']]) {
      qc.invalidateQueries({ queryKey: key })
    }
  }
  function resetForm() {
    setEditingId(null)
    setPaidAt(nowLocal())
    setAmount(0)
    setMethod('cash')
  }

  const buildPaymentInput = (): PaymentInput => ({ paidAt, amountVnd: amount, method, notes: null })

  const addMut = useMutation({
    mutationFn: () => api.debts.addPayment(debtId, buildPaymentInput()),
    onSuccess: () => {
      refreshAll()
      resetForm()
      toastOk('Đã ghi nhận thanh toán')
    },
    onError: toastError,
  })
  const updateMut = useMutation({
    mutationFn: () => api.debts.updatePayment(debtId, editingId!, buildPaymentInput()),
    onSuccess: () => {
      refreshAll()
      resetForm()
      toastOk('Đã cập nhật thanh toán')
    },
    onError: toastError,
  })
  const delMut = useMutation({
    mutationFn: (paymentId: number) => api.debts.deletePayment(debtId, paymentId),
    onSuccess: () => {
      refreshAll()
      if (editingId) resetForm()
      toastOk('Đã xóa thanh toán')
    },
    onError: toastError,
  })

  if (isLoading || !debt) return <LoadingBlock label="Đang tải thanh toán..." />

  // editing payment contributes to current balance → allow up to balance + its own amount
  const editingAmount = editingId ? (debt.payments.find((p) => p.id === editingId)?.amountVnd ?? 0) : 0
  const maxAmount = debt.balanceVnd + editingAmount
  const submitting = addMut.isPending || updateMut.isPending
  const canSubmit = amount > 0 && amount <= maxAmount

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Nợ gốc: <b>{formatVnd(debt.amountVnd)}</b> · Đã trả:{' '}
          <Text span fw={700} c="teal">
            {formatVnd(debt.paidVnd)}
          </Text>
        </Text>
        <Badge color={debt.balanceVnd > 0 ? 'red' : 'teal'} variant="light" size="lg">
          Còn nợ: {formatVnd(debt.balanceVnd)}
        </Badge>
      </Group>

      {debt.payments.length > 0 && (
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ngày giờ trả</Table.Th>
              <Table.Th>Số tiền</Table.Th>
              <Table.Th>Hình thức</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {debt.payments.map((p) => (
              <Table.Tr key={p.id} bg={editingId === p.id ? 'yellow.0' : undefined}>
                <Table.Td>{formatDateTime(p.paidAt ?? p.paymentDate)}</Table.Td>
                <Table.Td fw={600} c="teal">
                  {formatVnd(p.amountVnd)}
                </Table.Td>
                <Table.Td>{p.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      title="Sửa"
                      onClick={() => {
                        setEditingId(p.id)
                        setPaidAt(p.paidAt ?? `${p.paymentDate}T00:00`)
                        setAmount(p.amountVnd)
                        setMethod(p.method)
                      }}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      title="Xóa"
                      aria-label="Xóa lần thanh toán"
                      onClick={() =>
                        confirmDelete({
                          title: 'Xóa thanh toán',
                          message: 'Xóa lần thanh toán này? Dư nợ sẽ được tính lại.',
                          onConfirm: () => delMut.mutate(p.id),
                        })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Divider
        label={editingId ? 'Sửa lần thanh toán' : 'Ghi nhận thanh toán mới'}
        labelPosition="left"
      />

      {debt.balanceVnd <= 0 && !editingId ? (
        <Text size="sm" c="teal" fw={500}>
          ✓ Đơn này đã thanh toán đủ.
        </Text>
      ) : (
        <Box>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              label="Ngày giờ trả"
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.currentTarget.value)}
              w={210}
            />
            <MoneyInput
              label="Số tiền trả (₫)"
              value={amount}
              max={maxAmount}
              onChange={(v) => setAmount(Number(v) || 0)}
              w={160}
            />
            <Select
              label="Hình thức"
              data={[
                { value: 'cash', label: 'Tiền mặt' },
                { value: 'transfer', label: 'Chuyển khoản' },
              ]}
              value={method}
              onChange={(v) => setMethod((v as 'cash' | 'transfer') ?? 'cash')}
              allowDeselect={false}
              w={150}
            />
            <Button
              leftSection={editingId ? <IconCash size={16} /> : <IconPlus size={16} />}
              disabled={!canSubmit}
              loading={submitting}
              onClick={() => (editingId ? updateMut.mutate() : addMut.mutate())}
            >
              {editingId ? 'Cập nhật' : 'Thêm'}
            </Button>
            {editingId && (
              <Button variant="subtle" color="gray" leftSection={<IconX size={16} />} onClick={resetForm}>
                Hủy
              </Button>
            )}
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Tối đa có thể nhập: {formatVnd(maxAmount)}
          </Text>
        </Box>
      )}
    </Stack>
  )
}
