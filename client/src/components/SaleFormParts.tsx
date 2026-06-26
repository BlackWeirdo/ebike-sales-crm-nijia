// Sub-components tách từ SaleForm để giữ file gọn. Tất cả present-only: nhận state + handler
// qua props, không tự giữ state. SaleForm vẫn là nơi nắm toàn bộ logic đơn bán.
import {
  Table,
  Button,
  Select,
  NumberInput,
  Group,
  ActionIcon,
  Card,
  Text,
  Stack,
  Divider,
  Alert,
  ScrollArea,
  Switch,
} from '@mantine/core'
import { IconPlus, IconTrash, IconAlertCircle } from '@tabler/icons-react'
import type { SaleItemInput, ProductWithStock, BankAccount } from '@shared/types'
import { MoneyInput } from './MoneyInput.tsx'
import { formatVnd } from '../lib/format.ts'

// 1 dòng sản phẩm trong giỏ (mở rộng input + thông tin hiển thị).
export interface CartLine extends SaleItemInput {
  key: string
  productName: string
  productSku: string
  type: ProductWithStock['type']
  serialNumber?: string
}

// 1 dòng chia tiền theo tài khoản (UI). accountId tham chiếu bank_accounts; snapshot dựng khi save.
export interface PayAcctRow {
  key: string
  accountId: string | null
  amountVnd: number
}

/** Bảng giỏ hàng: chỉnh SL / đơn giá / giảm từng dòng + xóa dòng. */
export function SaleCartTable({
  cart,
  updateLine,
  removeLine,
}: {
  cart: CartLine[]
  updateLine: (key: string, patch: Partial<CartLine>) => void
  removeLine: (key: string) => void
}) {
  if (cart.length === 0) return null
  return (
    <ScrollArea.Autosize mah={260}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Sản phẩm</Table.Th>
            <Table.Th w={80}>SL</Table.Th>
            <Table.Th>Đơn giá</Table.Th>
            <Table.Th>Giảm</Table.Th>
            <Table.Th>Thành tiền</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cart.map((l) => (
            <Table.Tr key={l.key}>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {l.productName}
                  {l.productSku ? ` - ${l.productSku}` : ''}
                </Text>
                {l.serialNumber && (
                  <Text size="xs" c="dimmed">
                    SN: {l.serialNumber}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {l.type === 'QUANTITY' ? (
                  <NumberInput
                    size="xs"
                    min={1}
                    value={l.qty}
                    onChange={(v) => updateLine(l.key, { qty: Number(v) || 1 })}
                    w={70}
                  />
                ) : (
                  1
                )}
              </Table.Td>
              <Table.Td>
                <MoneyInput
                  size="xs"
                  value={l.unitPriceVnd}
                  onChange={(v) => updateLine(l.key, { unitPriceVnd: Number(v) || 0 })}
                  w={120}
                />
              </Table.Td>
              <Table.Td>
                <MoneyInput
                  size="xs"
                  value={l.lineDiscountVnd}
                  onChange={(v) => updateLine(l.key, { lineDiscountVnd: Number(v) || 0 })}
                  w={100}
                />
              </Table.Td>
              <Table.Td fw={600}>{formatVnd(l.qty * l.unitPriceVnd - l.lineDiscountVnd)}</Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" onClick={() => removeLine(l.key)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea.Autosize>
  )
}

/** Card tổng tiền: tạm tính / giảm giá đơn / tổng cộng / khách trả / còn nợ. */
export function SaleTotalsCard({
  subtotal,
  discountVnd,
  onDiscountChange,
  total,
  paidVnd,
  onPaidChange,
  balance,
}: {
  subtotal: number
  discountVnd: number
  onDiscountChange: (v: number) => void
  total: number
  paidVnd: number
  onPaidChange: (v: number) => void
  balance: number
}) {
  return (
    <Card withBorder w={300} padding="md">
      <Stack gap={6}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Tạm tính
          </Text>
          <Text size="sm">{formatVnd(subtotal)}</Text>
        </Group>
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Giảm giá đơn
          </Text>
          <MoneyInput size="xs" value={discountVnd} onChange={(v) => onDiscountChange(Number(v) || 0)} w={120} />
        </Group>
        <Group justify="space-between">
          <Text fw={700}>Tổng cộng</Text>
          <Text fw={700} c="teal" size="lg">
            {formatVnd(total)}
          </Text>
        </Group>
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Khách trả
          </Text>
          <MoneyInput size="xs" max={total} value={paidVnd} onChange={(v) => onPaidChange(Number(v) || 0)} w={120} />
        </Group>
        <Button size="xs" variant="subtle" onClick={() => onPaidChange(total)}>
          Trả đủ
        </Button>
        <Group justify="space-between">
          <Text fw={600} c={balance > 0 ? 'red' : 'teal'}>
            Còn nợ
          </Text>
          <Text fw={700} c={balance > 0 ? 'red' : 'teal'}>
            {formatVnd(balance)}
          </Text>
        </Group>
      </Stack>
    </Card>
  )
}

/** Khối "Chia tài khoản nhận tiền" (chỉ-để-in): toggle + các dòng chọn TK + số tiền. */
export function PaymentAccountsField({
  enabled,
  onToggle,
  payRows,
  bankAccounts,
  addPayRow,
  updatePayRow,
  removePayRow,
}: {
  enabled: boolean
  onToggle: (on: boolean) => void
  payRows: PayAcctRow[]
  bankAccounts: BankAccount[]
  addPayRow: () => void
  updatePayRow: (key: string, patch: Partial<PayAcctRow>) => void
  removePayRow: (key: string) => void
}) {
  return (
    <>
      <Divider
        label={
          <Switch
            label="Chia tài khoản nhận tiền (in trên phiếu)"
            checked={enabled}
            onChange={(e) => onToggle(e.currentTarget.checked)}
          />
        }
        labelPosition="left"
      />
      {enabled && (
        <Stack gap="xs">
          {bankAccounts.length === 0 && (
            <Alert color="blue" py="xs" icon={<IconAlertCircle size={16} />}>
              Chưa có tài khoản nào. Thêm ở mục "Tài khoản nhận tiền" trước khi chia.
            </Alert>
          )}
          {payRows.map((r) => (
            <Group key={r.key} align="flex-end" gap="xs">
              <Select
                label="Tài khoản nhận"
                placeholder="Chọn tài khoản"
                data={bankAccounts.map((b) => ({
                  value: String(b.id),
                  label: `${b.label}${b.bankName ? ` · ${b.bankName}` : ''}${b.accountNumber ? ` · ${b.accountNumber}` : ''}${b.active ? '' : ' (đã ẩn)'}`,
                }))}
                value={r.accountId}
                onChange={(v) => updatePayRow(r.key, { accountId: v })}
                searchable
                style={{ flex: 2 }}
              />
              <MoneyInput
                label="Số tiền"
                value={r.amountVnd}
                onChange={(v) => updatePayRow(r.key, { amountVnd: Number(v) || 0 })}
                w={150}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Xóa dòng tài khoản"
                onClick={() => removePayRow(r.key)}
                mb={6}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={addPayRow}
            style={{ alignSelf: 'flex-start' }}
          >
            Thêm tài khoản
          </Button>
        </Stack>
      )}
    </>
  )
}
