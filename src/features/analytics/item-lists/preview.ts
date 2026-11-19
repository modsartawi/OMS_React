import { audienceWrite, type AudienceDraft } from '@/core/analytics-audience/audience'
import type { ItemListPreview, ItemListProblemKind } from '@/core/models/item-list'

/**
 * The item list's preview (oms 925, BackOffice spec 4057 "Upload and preview", ticket 4058), pure: what the file holds,
 * what it refuses, and whether it may be saved. Nothing is kept until Save, which spends the preview's token.
 */

/** The order the preview lists in: what matched nothing first, then what refuses the save, then the notices. */
export const PROBLEM_KINDS: readonly ItemListProblemKind[] = ['unknown', 'duplicate', 'badDate', 'overlap', 'refused', 'notice']

/** One line of a group: its rows, and either the value that matched nothing (`unknown`) or the server's words. */
export interface ProblemLine {
  rows: number[]
  /** The level the file named (an unknown value only). */
  level: string
  /** The value that matched nothing (an unknown value only). */
  value: string
  /** The server's words (a problem or a notice). */
  message: string
}

export interface ProblemGroup {
  kind: ItemListProblemKind
  problems: ProblemLine[]
}

const firstRow = (p: ProblemLine) => (p.rows.length ? p.rows[0] : Number.MAX_SAFE_INTEGER)

/** The preview's unknown values, problems and notices by kind, in `PROBLEM_KINDS` order, rows ascending, lines by first row. */
export function problemGroups(preview: ItemListPreview): ProblemGroup[] {
  const lines: { kind: ItemListProblemKind; line: ProblemLine }[] = [
    ...preview.unknown.map((u) => ({ kind: 'unknown' as const, line: { rows: [u.row], level: u.level, value: u.value, message: '' } })),
    ...[...preview.problems, ...preview.notices].map((p) => ({ kind: p.kind, line: { rows: p.rows, level: '', value: '', message: p.message } })),
  ]
  return PROBLEM_KINDS.map((kind) => ({
    kind,
    problems: lines
      .filter((l) => l.kind === kind)
      .map(({ line }) => ({ ...line, rows: [...line.rows].sort((a, b) => a - b) }))
      .sort((a, b) => firstRow(a) - firstRow(b)),
  })).filter((g) => g.problems.length > 0)
}

/** The server keeps a preview's token 30 minutes (spec 4057; BO `AnalyticsItemListPreviews.Kept`, absolute). */
export const TOKEN_MINUTES = 30

/**
 * When the preview's token lapses, on this machine's clock (ms): 30 minutes from `receivedAt`, when this page received
 * the preview. The server's `expiresAt` is its local wall clock with no zone and is never compared with this machine's
 * clock. It is only a courtesy: Save's `ANALYTICS-435` refusal is what says the token lapsed.
 */
export function tokenDeadline(receivedAt: number): number {
  return receivedAt + TOKEN_MINUTES * 60_000
}

/** `create` makes a new list (name, audience, folder); `replace` is a re-upload, a new revision of its contents only. */
export type SaveMode = 'create' | 'replace'

/** Why Save is held, in the order it is judged; `null` when it may be pressed. */
export type SaveHold = 'noFile' | 'expired' | 'nothingMatched' | 'problems' | 'noName' | 'noAudience' | 'saving'

/**
 * Save's state. It is held with no preview, once the token lapsed, while nothing matched (the unknown rows alone are
 * no list), while the file has problems (BO 4058 then gives the preview no token), and — on a new list — without a
 * name or with a chosen audience left empty. Unknown values never hold it: the members are saved and the unknown
 * values listed (story 6).
 */
export function saveState(s: {
  preview: ItemListPreview | null
  mode: SaveMode
  name: string
  audience: AudienceDraft
  /** The token's deadline on this machine's clock (`tokenDeadline`). */
  deadline: number
  now: number
  pending: boolean
}): { enabled: boolean; reason: SaveHold | null } {
  const hold = (reason: SaveHold) => ({ enabled: false, reason })
  if (!s.preview) return hold('noFile')
  if (s.now >= s.deadline) return hold('expired')
  if (s.preview.members.length === 0) return hold('nothingMatched')
  if (!s.preview.token) return hold('problems')
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
