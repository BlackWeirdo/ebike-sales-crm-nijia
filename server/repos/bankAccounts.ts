import { db } from '../db.ts'
import { today } from '../lib/date.ts'
import type { BankAccount, BankAccountInput } from '@shared/types'

const COLS = `id, label, bank_name AS bankName, account_number AS accountNumber,
  account_holder AS accountHolder, active, created_at AS createdAt`

export const bankAccountsRepo = {
  // Trả TẤT CẢ tài khoản (kể cả đã xóa mềm) — Select đơn bán + màn CRUD đều hiện hết.
  // TK active sắp trước cho dễ chọn.
  list(): BankAccount[] {
    return db
      .prepare(`SELECT ${COLS} FROM bank_accounts ORDER BY active DESC, label COLLATE NOCASE`)
      .all() as unknown as BankAccount[]
  },

  get(id: number): BankAccount | undefined {
    return db.prepare(`SELECT ${COLS} FROM bank_accounts WHERE id = ?`).get(id) as BankAccount | undefined
  },

  create(input: BankAccountInput): BankAccount {
    const info = db
      .prepare(
        `INSERT INTO bank_accounts (label, bank_name, account_number, account_holder, active, created_at)
         VALUES (@label, @bankName, @accountNumber, @accountHolder, @active, @createdAt)`,
      )
      .run({ ...input, createdAt: today() })
    return this.get(Number(info.lastInsertRowid))!
  },

  update(id: number, input: BankAccountInput): BankAccount | undefined {
    db.prepare(
      `UPDATE bank_accounts SET label=@label, bank_name=@bankName, account_number=@accountNumber,
        account_holder=@accountHolder, active=@active WHERE id=@id`,
    ).run({ ...input, id })
    return this.get(id)
  },

  // Xóa MỀM: set active=0. Giữ lịch sử; snapshot trên đơn cũ luôn an toàn (đã copy thông tin).
  remove(id: number): void {
    db.prepare(`UPDATE bank_accounts SET active=0 WHERE id=?`).run(id)
  },
}
