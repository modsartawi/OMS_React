/**
 * The Replay page's pure logic (spec 470, ticket 472): the preflight that reads a pasted
 * receipt snapshot before anything is sent, the push request built from it, and the words
 * of the result. No React, no network — pinned by `replay-helpers.test.ts`.
 *
 * The snapshot is the engine's `PosTransactionSnapshot` (`Header`, `Lines[]`, `Tenders[]`,
 * …). The door serializes it with Newtonsoft, and whether it arrives PascalCase or
 * camelCase is not pinned, so every key is read case-insensitively (`field`).
 *
 * 🚩 Privacy: a snapshot carries customer, loyalty and tender data. Nothing here logs it.
 *
 * The preflight is a convenience, never the guard: the replay door checks the same
 * things again and refuses with its own codes.
 */
import { REPLAY_REMOVED, type ReplayRequest } from '@/core/models/sync-console'
import { failureLabelKey } from './control-helpers'

// ── The preflight ───────────────────────────────────────────────────────────────

/** What a pasted snapshot is: a sale, a return (`Header.IsReturn`) or a voided sale (`Status`). */
export type ReplayDocKind = 'sale' | 'return' | 'void'

/** Why a paste gives no summary. A missing number is a reason, never a zero. */
export type ReplayInvalidReason = 'empty' | 'json' | 'notObject' | 'noHeader' | 'noTotal' | 'tenders' | 'tenderAmount'

export interface ReplaySummary {
  /** `Header.StoreId`, `Header.ReceiptNumber`, `Header.TransactionId` as text; `null` when absent. */
  sourceStoreCode: string | null
  sourceReceiptNumber: string | null
  sourceTransactionId: string | null
  docKind: ReplayDocKind
  /** `Header.Status` is `Completed` (any case). */
  completed: boolean
  /** `Header.IsTraining`. */
  training: boolean
  lineCount: number
  /** `Header.GrandTotal`. */
  total: number
  /** The sum of `Tenders[].AppliedAmount`. */
  tenderTotal: number
  /** The total and the tender total are equal to the cent. */
  balanced: boolean
}

export type ReplayPreflight =
  | { kind: 'invalid'; reason: ReplayInvalidReason; /** The parser's offset into the text, for `json` only. */ at: number | null }
  | { kind: 'summary'; summary: ReplaySummary }

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v)

/** A member of `obj` by name, in any case: the one way every snapshot key is read. */
function field(obj: Json, name: string): unknown {
  if (name in obj) return obj[name]
  const want = name.toLowerCase()
  const key = Object.keys(obj).find((k) => k.toLowerCase() === want)
  return key === undefined ? undefined : obj[key]
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A source field as text: a string as is, a number as its digits, anything else absent. */
const textOf = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : finite(v) ? String(v) : null)

const sameWord = (v: unknown, word: string): boolean => typeof v === 'string' && v.toLowerCase() === word

/** Money judged to the cent. */
const cents = (n: number): number => Math.round(n * 100)

const invalid = (reason: ReplayInvalidReason, at: number | null = null): ReplayPreflight => ({ kind: 'invalid', reason, at })

/** Parse `text`, or the parser's offset of the first fault (the end of the text for a truncated paste). */
function parse(text: string): { ok: true; value: unknown } | { ok: false; at: number | null } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (err) {
    return { ok: false, at: jsonErrorOffset(err instanceof Error ? err.message : '', text) }
  }
}

/**
 * V8 says "… at position N (line L column C)", or "Unexpected end of JSON input" with no
 * position; Firefox says "… at line L column C of the JSON data". Any other wording gives no
 * position rather than a wrong one.
 */
function jsonErrorOffset(message: string, text: string): number | null {
  const position = /position (\d+)/.exec(message)
  if (position) return Number(position[1])
  if (/end of (JSON|data)/i.test(message)) return text.length
  const lineCol = /line (\d+) column (\d+)/.exec(message)
  if (!lineCol) return null
  const lines = text.split('\n')
  const line = Number(lineCol[1])
  if (line < 1 || line > lines.length) return null
  return lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + Number(lineCol[2]) - 1
}

/** A 1-based line and column of an offset into `text`, as the page says where the JSON breaks. */
export function lineColumn(text: string, at: number): { line: number; column: number } {
  const before = text.slice(0, at)
  const line = before.split('\n').length
  return { line, column: at - before.lastIndexOf('\n') }
}

/**
 * Read a pasted snapshot before anything is sent: not JSON (with where), not an object,
 * no header or no grand total (never read as zero), a tender with no applied amount —
 * or a summary of the source, its kind and its money.
 */
export function replayPreflight(text: string): ReplayPreflight {
  if (text.trim() === '') return invalid('empty')
  const parsed = parse(text)
  if (!parsed.ok) return invalid('json', parsed.at)
  const root = parsed.value
  if (!isObject(root)) return invalid('notObject')
  const header = field(root, 'Header')
  if (!isObject(header)) return invalid('noHeader')
  const total = field(header, 'GrandTotal')
  if (!finite(total)) return invalid('noTotal')

  const tenders = field(root, 'Tenders') ?? []
  if (!Array.isArray(tenders)) return invalid('tenders')
  let tenderTotal = 0
  for (const tender of tenders) {
    const applied = isObject(tender) ? field(tender, 'AppliedAmount') : undefined
    if (!finite(applied)) return invalid('tenderAmount')
    tenderTotal += applied
  }

  const status = field(header, 'Status')
  const lines = field(root, 'Lines')
  return {
    kind: 'summary',
    summary: {
      sourceStoreCode: textOf(field(header, 'StoreId')),
      sourceReceiptNumber: textOf(field(header, 'ReceiptNumber')),
      sourceTransactionId: textOf(field(header, 'TransactionId')),
      docKind: field(header, 'IsReturn') === true ? 'return' : sameWord(status, 'voided') ? 'void' : 'sale',
      completed: sameWord(status, 'completed'),
      training: field(header, 'IsTraining') === true,
      lineCount: Array.isArray(lines) ? lines.length : 0,
      total,
      tenderTotal,
      balanced: cents(total) === cents(tenderTotal),
    },
  }
}

/**
 * Whether Push may be offered for this paste. Slice 0 (472): a valid, completed sale.
 * The training and balance warnings, and the words for each, are ticket 473's.
 */
export function pushReady(preflight: ReplayPreflight): boolean {
  return preflight.kind === 'summary' && preflight.summary.docKind === 'sale' && preflight.summary.completed
}

// ── The target and the push ─────────────────────────────────────────────────────

/** The typed target store code as it is sent: trimmed, upper-cased. */
export const targetStoreCode = (typed: string): string => typed.trim().toUpperCase()

/**
 * `POST ActionSync/Replay`'s body: the snapshot as the PARSED object (never the string),
 * exactly as pasted, edits included; the target store code as sent; the register.
 * `null` when the text is not a JSON object or a target is missing.
 */
export function replayRequest(text: string, store: string, registerId: string): ReplayRequest | null {
  const parsed = parse(text)
  const targetStore = targetStoreCode(store)
  if (!parsed.ok || !isObject(parsed.value) || targetStore === '' || registerId === '') return null
  return { targetStoreCode: targetStore, registerId, snapshot: parsed.value }
}

// ── The result ──────────────────────────────────────────────────────────────────

/** The words of a removed link, or `null` for one this bundle does not know (shown raw). */
export function removedLabel(removed: string): string | null {
  return (REPLAY_REMOVED as readonly string[]).includes(removed) ? `replay.result.removed.${removed}` : null
}

/**
 * A refused registers read or push, in slice 0 (472): the console's shared words for a code
 * that has them (`failureLabelKey` — `NO_STORE`), shown beside the code; any other code raw
 * with the server's message; no code (a 500) under the console's failure sentence alone.
 * The replay's own refusal words are ticket 473's.
 */
export function replayFailure(code: string | null): { labelKey: string | null; showCode: boolean } {
  if (code === null) return { labelKey: null, showCode: false }
  return { labelKey: failureLabelKey(code), showCode: true }
}
