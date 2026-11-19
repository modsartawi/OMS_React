import { audienceWrite, type AudienceDraft } from '@/core/analytics-audience/audience'
import type { ItemListPreview, ItemListProblem, ItemListProblemKind } from '@/core/models/item-list'

/**
 * The item list's preview (oms 925, BackOffice spec 4057 "Upload and preview"), pure: what the file holds, what it
 * refuses, and whether it may be saved. Nothing is kept until Save, which spends the preview's token.
 */

/** The order the preview names its problems in: what matched nothing first, then what the file got wrong. */
export const PROBLEM_KINDS: readonly ItemListProblemKind[] = ['unknown', 'duplicate', 'badDate', 'overlap', 'refused']

export interface ProblemGroup {
  kind: ItemListProblemKind
  problems: ItemListProblem[]
}

const firstRow = (p: ItemListProblem) => (p.rows.length ? p.rows[0] : Number.MAX_SAFE_INTEGER)

/** The preview's problems by kind, in `PROBLEM_KINDS` order, each problem's rows ascending, problems by first row. */
export function problemGroups(preview: ItemListPreview): ProblemGroup[] {
  return PROBLEM_KINDS.map((kind) => ({
    kind,
    problems: preview.problems
      .filter((p) => p.kind === kind)
      .map((p) => ({ ...p, rows: [...p.rows].sort((a, b) => a - b) }))
      .sort((a, b) => firstRow(a) - firstRow(b)),
  })).filter((g) => g.problems.length > 0)
}

/**
 * Whether the preview's token has lapsed by `now` (ms). The server keeps it 30 minutes and says when; a token with no
 * readable `expiresAt` is never judged expired here — Save is sent and the server's refusal says so.
 */
export function tokenExpired(preview: Pick<ItemListPreview, 'expiresAt'>, now: number): boolean {
  const at = Date.parse(preview.expiresAt)
  return Number.isFinite(at) && now >= at
}

/** `create` makes a new list (name, audience, folder); `replace` is a re-upload, a new revision of its contents only. */
export type SaveMode = 'create' | 'replace'

/** Why Save is held, in the order it is judged; `null` when it may be pressed. */
export type SaveHold = 'noFile' | 'expired' | 'nothingMatched' | 'noName' | 'noAudience' | 'saving'

/**
 * Save's state. It is held with no preview, once the token lapsed, while nothing matched (the unknown rows alone are
 * no list), and — on a new list — without a name or with a chosen audience left empty. Unknown rows never hold it:
 * the matched rows are saved and the unknown ones listed (story 6).
 */
export function saveState(s: {
  preview: ItemListPreview | null
  mode: SaveMode
  name: string
  audience: AudienceDraft
  now: number
  pending: boolean
}): { enabled: boolean; reason: SaveHold | null } {
  const hold = (reason: SaveHold) => ({ enabled: false, reason })
  if (!s.preview) return hold('noFile')
  if (tokenExpired(s.preview, s.now)) return hold('expired')
  if (s.preview.matched.length === 0) return hold('nothingMatched')
  if (s.mode === 'create' && !s.name.trim()) return hold('noName')
  if (s.mode === 'create' && !audienceWrite(s.audience)) return hold('noAudience')
  if (s.pending) return hold('saving')
  return { enabled: true, reason: null }
}

/** The drop's limit (spec 4057: 2 MB); the server judges it too. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024

/** Why a picked file is refused before it is sent: not an `.xlsx` / `.csv`, or over 2 MB. */
export function fileProblem(file: { name: string; size: number }): 'type' | 'size' | null {
  if (!/\.(xlsx|csv)$/i.test(file.name)) return 'type'
  if (file.size > MAX_FILE_BYTES) return 'size'
  return null
}
