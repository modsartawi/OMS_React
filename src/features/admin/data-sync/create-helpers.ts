/**
 * The New campaign dialog's pure logic (spec 558, ticket 561): the request built from the dialog,
 * pasted store codes, and a create or Start refusal in words. No React, no network — pinned by
 * `create-helpers.test.ts`.
 *
 * 🔌 564 (Apply) builds on this shape rather than around it: `CreateDraft.mode` and `.reason`
 * already travel through `buildCreateRequest` (an Apply run sends its reason trimmed; the ≥ 10
 * check is the dialog's to add with its reason field), and `CREATE_REFUSAL_CODES` already words
 * the Apply-only refusals.
 */
import { apiErrorCode, ApiError } from '@/core/api'
import type { CreateCampaignRequest, DataSyncErrorCode, Mode } from '@/core/models/data-sync'

// ── The request ─────────────────────────────────────────────────────────────────

/** Where the run goes: the whole fleet, or the stores pasted or typed (already parsed). */
export type CreateTargets = { kind: 'fleet' } | { kind: 'stores'; codes: readonly string[] }

/** What the dialog holds when Create is pressed. */
export interface CreateDraft {
  profileId: string
  /** The chosen profile's tables, in the profile's order. */
  profileTables: readonly string[]
  /** The tables still ticked (any order). */
  pickedTables: readonly string[]
  mode: Mode
  targets: CreateTargets
  /** Optional; trimmed, and dropped when blank. */
  name: string
  /** Apply only; ignored for ReportOnly. */
  reason: string
}

/**
 * The `POST DataSync/Campaigns` body. Every table ticked sends no `tables` at all (the whole
 * profile, as the door reads an omitted list); a narrowed run sends the ticked ones in the
 * profile's order. Stores go by `{ code }` alone — DataSync ask A, see `TargetStoreRef`.
 */
export function buildCreateRequest(d: CreateDraft): CreateCampaignRequest {
  const picked = new Set(d.pickedTables)
  const tables = d.profileTables.filter((t) => picked.has(t))
  const body: CreateCampaignRequest = {
    profileId: d.profileId,
    mode: d.mode,
    targets: d.targets.kind === 'fleet' ? { fleet: 'all' } : { storeCodes: d.targets.codes.map((code) => ({ code })) },
  }
  if (tables.length < d.profileTables.length) body.tables = tables
  const name = d.name.trim()
  if (name) body.name = name
  if (d.mode === 'Apply') body.reason = d.reason.trim()
  return body
}

// ── Pasted store codes ──────────────────────────────────────────────────────────

/**
 * A store code as HQ spells one: letters, digits, `-` or `_`, at most 20, starting with a letter or
 * digit (P001, 0100, DEMO01). Anything else — a space inside, a `#`, a pasted name — is flagged
 * before the call rather than sent for the door to refuse the whole create.
 */
const STORE_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/

export interface MalformedCode {
  /** 1-based line of the box. */
  line: number
  value: string
}

export interface ParsedStoreCodes {
  /** Distinct well-formed codes, in the order first seen, first spelling kept. */
  codes: string[]
  malformed: MalformedCode[]
  /** How many repeats were collapsed. */
  duplicates: number
}

/** The box read as stores: one per line, or comma- / tab-separated on a line; de-duplicated case-insensitively. */
export function parseStoreCodes(text: string): ParsedStoreCodes {
  const codes: string[] = []
  const seen = new Set<string>()
  const malformed: MalformedCode[] = []
  let duplicates = 0
  text.split(/\r?\n|\r/).forEach((row, i) => {
    for (const piece of row.split(/[,\t]/)) {
      const value = piece.trim()
      if (!value) continue
      if (!STORE_CODE.test(value)) {
        malformed.push({ line: i + 1, value })
        continue
      }
      const key = value.toUpperCase()
      if (seen.has(key)) {
        duplicates++
        continue
      }
      seen.add(key)
      codes.push(value)
    }
  })
  return { codes, malformed, duplicates }
}

// ── Refusals in words ───────────────────────────────────────────────────────────

/** Every code a create can be refused with (spec 558), each with its sentence under `create.refusal.*`. */
export const CREATE_REFUSAL_CODES = [
  'DATASYNC_PROFILE_NOT_FOUND',
  'DATASYNC_TABLE_NOT_IN_PROFILE',
  'DATASYNC_UNKNOWN_STORE',
  'DATASYNC_SOURCE_UNAVAILABLE',
  'DATASYNC_INVALID_REQUEST',
  // Apply only (564), worded here so the one helper covers the door.
  'DATASYNC_REASON_REQUIRED',
  'DATASYNC_PROFILE_NO_APPLY_TABLES',
  'DATASYNC_STORE_BUSY',
] as const satisfies readonly DataSyncErrorCode[]

export type CreateRefusalCode = (typeof CREATE_REFUSAL_CODES)[number]

export interface CreateRefusalWords {
  /** The sentence key (`data-sync:create.refusal.<code>`). */
  key: string
  /** `DATASYNC_UNKNOWN_STORE`: the store the door named (`client/code`), when the detail carried it. */
  store?: string
  /** `DATASYNC_TABLE_NOT_IN_PROFILE`: the table the door named. */
  table?: string
}

/** The door's detail line (`errors[0].errorMessage`) — `apiErrorDetails` only returns the lines after it. */
const detailOf = (err: unknown): string => (err instanceof ApiError ? (err.details[0]?.errorMessage ?? '') : '')

/** The leading token of a detail like `000/P009 is not in DistributionLocation.` */
const leadingName = (detail: string): string | undefined => /^(\S+) is not in /.exec(detail)?.[1]

/**
 * A create refusal as a sentence key, plus the store or table it names. `null` for anything else —
 * an unknown code (the caller shows the door's own message), a bare 403, a crash.
 */
export function createRefusalWords(err: unknown): CreateRefusalWords | null {
  const code = apiErrorCode(err)
  if (!code || !(CREATE_REFUSAL_CODES as readonly string[]).includes(code)) return null
  const words: CreateRefusalWords = { key: `create.refusal.${code}` }
  const name = leadingName(detailOf(err))
  if (name && code === 'DATASYNC_UNKNOWN_STORE') words.store = name
  if (name && code === 'DATASYNC_TABLE_NOT_IN_PROFILE') words.table = name
  return words
}

const START_REFUSAL_CODES: readonly DataSyncErrorCode[] = ['DATASYNC_INVALID_STATE', 'DATASYNC_CAMPAIGN_NOT_FOUND']

/** A Start refusal as a sentence key (`data-sync:start.refusal.<code>`), or `null`. */
export function startRefusalWords(err: unknown): string | null {
  const code = apiErrorCode(err)
  return code && (START_REFUSAL_CODES as readonly string[]).includes(code) ? `start.refusal.${code}` : null
}
