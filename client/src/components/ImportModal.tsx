import { useState } from 'react'
import { Modal, Stack, Alert, Button, FileInput, Group, Loader, Text, ScrollArea, List } from '@mantine/core'
import {
  IconFileSpreadsheet,
  IconDownload,
  IconUpload,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ImportPayload, ImportResult } from '@shared/types'
import { api } from '../lib/api.ts'
import { parseImportFile, downloadTemplate } from '../lib/excel.ts'
import { toastOk, toastError } from '../lib/notify.ts'

/** Modal nhập sản phẩm hàng loạt từ Excel (2 sheet) — đọc, kiểm lỗi từng dòng, rồi lưu. */
export function ImportModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [payload, setPayload] = useState<ImportPayload | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setFile(null)
    setPayload(null)
    setParseError(null)
    setResult(null)
  }

  async function onPick(f: File | null) {
    reset()
    setFile(f)
    if (!f) return
    setParsing(true)
    try {
      const parsed = await parseImportFile(f)
      if (parsed.products.length === 0 && parsed.units.length === 0) {
        setParseError('File không có dữ liệu. Kiểm tra sheet "SanPham" / "SerialXe".')
      } else {
        setPayload(parsed)
      }
    } catch {
      setParseError('Không đọc được file. Hãy dùng file .xlsx theo mẫu.')
    } finally {
      setParsing(false)
    }
  }

  const importMut = useMutation({
    mutationFn: () => api.products.import(payload!),
    onSuccess: (res) => {
      setResult(res)
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ['products'] })
        toastOk(`Đã nhập ${res.productsCreated} SP mới, cập nhật ${res.productsUpdated}, ${res.unitsCreated} serial xe`)
      }
    },
    onError: toastError,
  })

  function close() {
    reset()
    onClose()
  }

  return (
    <Modal opened={opened} onClose={close} title="Nhập sản phẩm từ Excel" size="lg" centered>
      <Stack>
        <Alert variant="light" color="blue" icon={<IconFileSpreadsheet size={18} />}>
          File Excel gồm 2 sheet: <b>SanPham</b> (danh sách sản phẩm) và <b>SerialXe</b> (serial từng xe). Chưa có file?
          Tải mẫu rồi điền theo.
        </Alert>

        <Button variant="light" leftSection={<IconDownload size={18} />} onClick={() => downloadTemplate()} w="fit-content">
          Tải file mẫu (.xlsx)
        </Button>

        <FileInput
          label="Chọn file Excel"
          placeholder="Bấm để chọn file .xlsx"
          accept=".xlsx,.xls,.csv"
          leftSection={<IconUpload size={18} />}
          value={file}
          onChange={onPick}
        />

        {parsing && (
          <Group gap="xs">
            <Loader size="xs" /> <Text size="sm">Đang đọc file...</Text>
          </Group>
        )}

        {parseError && (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            {parseError}
          </Alert>
        )}

        {payload && !result && (
          <Alert color="teal" variant="light">
            Đọc được <b>{payload.products.length}</b> sản phẩm và <b>{payload.units.length}</b> serial xe. Bấm "Nhập dữ
            liệu" để lưu.
          </Alert>
        )}

        {result && result.ok && (
          <Alert color="teal" icon={<IconCheck size={18} />}>
            Nhập thành công! Tạo mới <b>{result.productsCreated}</b> SP, cập nhật <b>{result.productsUpdated}</b> SP, thêm{' '}
            <b>{result.unitsCreated}</b> serial xe.
          </Alert>
        )}

        {result && !result.ok && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} title={`Có ${result.errors.length} lỗi — chưa lưu gì cả`}>
            <Text size="sm" mb="xs">
              Sửa các lỗi sau trong file rồi nhập lại:
            </Text>
            <ScrollArea h={160}>
              <List size="sm" spacing={2}>
                {result.errors.map((er, i) => (
                  <List.Item key={i}>
                    [{er.sheet} dòng {er.row}] {er.message}
                  </List.Item>
                ))}
              </List>
            </ScrollArea>
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            {result?.ok ? 'Đóng' : 'Hủy'}
          </Button>
          {!result?.ok && (
            <Button
              leftSection={<IconUpload size={18} />}
              disabled={!payload}
              loading={importMut.isPending}
              onClick={() => {
                setResult(null)
                importMut.mutate()
              }}
            >
              Nhập dữ liệu
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
