import { useEffect, useMemo, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Select,
  NumberInput,
  Group,
  ActionIcon,
  Card,
  Text,
  Stack,
  Divider,
  Box,
  TextInput,
  Textarea,
  Alert,
  ScrollArea,
} from '@mantine/core'
import { IconPlus, IconTrash, IconShoppingCart, IconAlertCircle } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProductWithStock, InventoryUnit, SaleItemInput, PaymentMethod } from '@shared/types'
import { api } from '../lib/api.ts'
import { MoneyInput } from './MoneyInput.tsx'
import { formatVnd, today } from '../lib/format.ts'
import { toastOk, toastError } from '../lib/notify.ts'

interface CartLine extends SaleItemInput {
  key: string
  productName: string
  productSku: string
  type: ProductWithStock['type']
  serialNumber?: string
}

/**
 * Modal tạo HOẶC sửa đơn bán: chọn khách, thêm sản phẩm vào giỏ, tính tiền, ghi nhận thanh toán.
 * Truyền `editId` để sửa đơn cũ (vd áp chiết khấu hồi tố). Khi sửa, hệ thống hoàn tả tồn kho cũ +
 * dựng lại công nợ; số tiền đã thu được gộp vào "Khách trả" nên không mất tiền, chỉ mất chi tiết từng lần.
 */
export function SaleForm({ onClose, editId }: { onClose: () => void; editId?: number }) {
  const qc = useQueryClient()
  const isEdit = editId != null
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: api.products.list })
  const { data: customers = [] } = useQuery({ queryKey: ['customers', ''], queryFn: () => api.customers.list() })
  const { data: editSale } = useQuery({
    queryKey: ['sale', editId],
    queryFn: () => api.sales.get(editId!),
    enabled: isEdit,
  })

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [saleDate, setSaleDate] = useState(today())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discountVnd, setDiscountVnd] = useState(0)
  const [paidVnd, setPaidVnd] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  // Whether the edited sale had recorded installment payments (warn they'll be consolidated).
  const hadInstallments = (editSale?.debt?.payments.length ?? 0) > 0

  // Pre-fill the form once from the existing sale + products (edit mode only).
  useEffect(() => {
    if (!isEdit || hydrated || !editSale || products.length === 0) return
    setCustomerId(editSale.customerId != null ? String(editSale.customerId) : null)
    setSaleDate(editSale.saleDate)
    setPaymentMethod(editSale.paymentMethod)
    setDiscountVnd(editSale.discountVnd)
    setPaidVnd(Math.min(editSale.collectedVnd, editSale.totalVnd)) // preserve money already collected
    setDueDate(editSale.debt?.dueDate ?? '')
    setNotes(editSale.notes ?? '')
    setCart(
      editSale.items
        .filter((it) => it.productId != null)
        .map((it) => ({
          key: it.inventoryUnitId ? `u${it.inventoryUnitId}` : `p${it.productId}-${it.id}`,
          productId: it.productId as number,
          inventoryUnitId: it.inventoryUnitId,
          qty: it.qty,
          unitPriceVnd: it.unitPriceVnd,
          lineDiscountVnd: it.lineDiscountVnd,
          productName: it.productName,
          productSku: it.productSku ?? '',
          type: products.find((p) => p.id === it.productId)?.type ?? (it.inventoryUnitId ? 'SERIALIZED' : 'QUANTITY'),
          serialNumber: it.serialNumber ?? undefined,
        })),
    )
    setHydrated(true)
  }, [isEdit, hydrated, editSale, products])

  // line-add controls
  const [pickProduct, setPickProduct] = useState<string | null>(null)
  const [pickUnit, setPickUnit] = useState<string | null>(null)
  const [pickQty, setPickQty] = useState(1)

  const selectedProduct = products.find((p) => String(p.id) === pickProduct)
  const { data: availUnits = [] } = useQuery({
    queryKey: ['availUnits', pickProduct],
    queryFn: () => api.products.availableUnits(Number(pickProduct)),
    enabled: !!selectedProduct && selectedProduct.type === 'SERIALIZED',
  })

  const subtotal = cart.reduce((s, l) => s + (l.qty * l.unitPriceVnd - l.lineDiscountVnd), 0)
  const total = Math.max(0, subtotal - discountVnd)
  const balance = Math.max(0, total - paidVnd)

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: customerId ? Number(customerId) : null,
        saleDate,
        discountVnd,
        paidVnd,
        paymentMethod,
        notes: notes || null,
        dueDate: balance > 0 ? dueDate || null : null,
        items: cart.map((l) => ({
          productId: l.productId,
          inventoryUnitId: l.inventoryUnitId,
          qty: l.qty,
          unitPriceVnd: l.unitPriceVnd,
          lineDiscountVnd: l.lineDiscountVnd,
        })),
      }
      return isEdit ? api.sales.update(editId!, payload) : api.sales.create(payload)
    },
    onSuccess: () => {
      for (const key of [['sales'], ['products'], ['debts'], ['dashboard'], ['customers']])
        qc.invalidateQueries({ queryKey: key })
      if (isEdit) qc.invalidateQueries({ queryKey: ['sale', editId] })
      toastOk(isEdit ? 'Đã cập nhật đơn bán' : 'Đã tạo đơn bán')
      onClose()
    },
    onError: toastError,
  })

  function addLine() {
    if (!selectedProduct) return
    if (selectedProduct.type === 'SERIALIZED') {
      const unit = availUnits.find((u) => String(u.id) === pickUnit)
      if (!unit) {
        toastError(new Error('Chọn 1 serial còn trong kho'))
        return
      }
      if (cart.some((l) => l.inventoryUnitId === unit.id)) {
        toastError(new Error('Serial này đã có trong đơn'))
        return
      }
      setCart((c) => [
        ...c,
        {
          key: `u${unit.id}`,
          productId: selectedProduct.id,
          inventoryUnitId: unit.id,
          qty: 1,
          unitPriceVnd: selectedProduct.sellingPriceVnd,
          lineDiscountVnd: 0,
          productName: selectedProduct.name,
          productSku: selectedProduct.sku,
          type: 'SERIALIZED',
          serialNumber: unit.serialNumber,
        },
      ])
    } else {
      if (pickQty <= 0) return
      if (pickQty > selectedProduct.unitsInStock) {
        toastError(new Error('Vượt quá tồn kho'))
        return
      }
      setCart((c) => [
        ...c,
        {
          key: `p${selectedProduct.id}-${Date.now()}`,
          productId: selectedProduct.id,
          inventoryUnitId: null,
          qty: pickQty,
          unitPriceVnd: selectedProduct.sellingPriceVnd,
          lineDiscountVnd: 0,
          productName: selectedProduct.name,
          productSku: selectedProduct.sku,
          type: 'QUANTITY',
        },
      ])
    }
    setPickProduct(null)
    setPickUnit(null)
    setPickQty(1)
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: string) {
    setCart((c) => c.filter((l) => l.key !== key))
  }

  const productOptions = useMemo(
    () =>
      products
        .filter((p) => p.active === 1 && p.unitsInStock > 0)
        .map((p) => ({ value: String(p.id), label: `[${p.sku}] ${p.name} (tồn: ${p.unitsInStock})` })),
    [products],
  )

  const canSubmit = cart.length > 0 && (balance === 0 || !!customerId)

  return (
    <Modal opened onClose={onClose} title={isEdit ? `Sửa đơn bán #${editId}` : 'Tạo đơn bán'} size="xl" centered>
      <Stack>
        {isEdit && hadInstallments && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow" py="xs">
            Đơn này đã có lịch sử thu nợ nhiều lần. Lưu thay đổi sẽ gộp các lần thu thành 1 số "Khách trả" (
            {formatVnd(editSale?.collectedVnd ?? 0)}) — không mất tiền, chỉ mất chi tiết từng lần.
          </Alert>
        )}
        {isEdit && editSale && editSale.collectedVnd > total && (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" py="xs">
            Khách đã trả {formatVnd(editSale.collectedVnd)} — nhiều hơn tổng mới {formatVnd(total)}. Thừa{' '}
            {formatVnd(editSale.collectedVnd - total)} cần hoàn lại cho khách (ngoài hệ thống).
          </Alert>
        )}
        <Group grow align="flex-start">
          <Select
            label="Khách hàng"
            placeholder="Khách lẻ (không bắt buộc)"
            data={customers.map((c) => ({
              value: String(c.id),
              label: `${c.type === 'dealer' ? '[Đại lý] ' : ''}${c.name}${c.phone ? ` · ${c.phone}` : ''}`,
            }))}
            value={customerId}
            onChange={setCustomerId}
            searchable
            clearable
          />
          <TextInput label="Ngày bán" type="date" value={saleDate} onChange={(e) => setSaleDate(e.currentTarget.value)} />
        </Group>

        <Divider label="Thêm sản phẩm vào đơn" labelPosition="left" />
        <Group align="flex-end">
          <Select
            label="Sản phẩm"
            placeholder="Chọn sản phẩm"
            data={productOptions}
            value={pickProduct}
            onChange={(v) => {
              setPickProduct(v)
              setPickUnit(null)
            }}
            searchable
            style={{ flex: 2 }}
          />
          {selectedProduct?.type === 'SERIALIZED' ? (
            <Select
              label="Serial"
              placeholder="Chọn serial"
              data={availUnits.map((u: InventoryUnit) => ({ value: String(u.id), label: u.serialNumber }))}
              value={pickUnit}
              onChange={setPickUnit}
              searchable
              style={{ flex: 1 }}
            />
          ) : (
            <NumberInput label="Số lượng" min={1} value={pickQty} onChange={(v) => setPickQty(Number(v) || 1)} w={120} />
          )}
          <Button onClick={addLine} disabled={!selectedProduct} leftSection={<IconPlus size={16} />}>
            Thêm
          </Button>
        </Group>

        {cart.length > 0 && (
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
        )}

        <Divider />
        <Group justify="space-between" align="flex-start">
          <Box style={{ flex: 1 }}>
            <Select
              label="Hình thức thanh toán"
              data={[
                { value: 'cash', label: 'Tiền mặt' },
                { value: 'transfer', label: 'Chuyển khoản' },
                { value: 'mixed', label: 'Kết hợp' },
              ]}
              value={paymentMethod}
              onChange={(v) => setPaymentMethod((v as PaymentMethod) ?? 'cash')}
              allowDeselect={false}
              mb="xs"
            />
            <Textarea label="Ghi chú" autosize minRows={1} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
          </Box>
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
                <MoneyInput size="xs" value={discountVnd} onChange={(v) => setDiscountVnd(Number(v) || 0)} w={120} />
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
                <MoneyInput size="xs" max={total} value={paidVnd} onChange={(v) => setPaidVnd(Number(v) || 0)} w={120} />
              </Group>
              <Button size="xs" variant="subtle" onClick={() => setPaidVnd(total)}>
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
        </Group>

        {balance > 0 && (
          <Group align="flex-end">
            <Alert icon={<IconAlertCircle size={16} />} color="orange" style={{ flex: 1 }} py="xs">
              Đơn còn nợ {formatVnd(balance)} — sẽ tạo công nợ. Bắt buộc chọn khách hàng.
            </Alert>
            <TextInput
              label="Hạn trả nợ"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.currentTarget.value)}
              description="Bỏ trống = +30 ngày"
            />
          </Group>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Hủy
          </Button>
          <Button
            leftSection={<IconShoppingCart size={18} />}
            onClick={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={!canSubmit}
          >
            {isEdit ? 'Lưu thay đổi' : 'Hoàn tất đơn bán'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
