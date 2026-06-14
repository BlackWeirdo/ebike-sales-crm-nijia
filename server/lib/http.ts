import type { Request, Response, NextFunction } from 'express'
import type { ZodTypeAny, infer as zInfer } from 'zod'

/** Lỗi HTTP có chủ đích (kèm status). Repo ném Error thường → middleware coi là 400 (lỗi nghiệp vụ). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Validate body theo zod schema; ném HttpError(400) với thông điệp tiếng Việt nếu sai.
 * Dùng: `const data = validateBody(schema, req.body)` — lỗi sẽ tự rơi vào errorHandler.
 */
export function validateBody<S extends ZodTypeAny>(schema: S, body: unknown): zInfer<S> {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message)
  return parsed.data
}

/**
 * Middleware xử lý lỗi tập trung. HttpError → status của nó; Error thường (nghiệp vụ từ repo) → 400.
 * Đặt sau tất cả route trong index.ts.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof HttpError ? err.status : 400
  const message = err instanceof Error ? err.message : 'Lỗi máy chủ'
  if (!(err instanceof HttpError)) console.error('[api error]', err)
  res.status(status).json({ error: message })
}
