import { fieldRefusal } from '@/core/deliverect/reason'
import {
  DELIVERECT_ERRORS,
  type DeliverectImportPush,
  type DeliverectImportPushSkip,
  type DeliverectStockPushAccount,
} from '@/core/models/deliverect'

/**
 * The on-demand stock push as the catalog screen reads it (ticket 860, BackOffice spec 3481): the
 * whitelist import's `push` block (3485) and `POST Stock/Push`'s answer and refusals (3483). Pure:
 * no React, no `t`.
 */

/** The contract's cap on one push (DLV-00015 refuses more); a larger import's push is skipped. */
export const STOCK_PUSH_MAX = 200

/** The skip reasons the contract names; any other is said generically. */
const SKIPS: readonly DeliverectImportPushSkip[] = ['pushStockOff', 'overCap', 'noKnownMaterials']

/** One account's entry, with whether it failed. Any status but `"S"` is a failure. */
export interface PushAccountView extends DeliverectStockPushAccount {
  failed: boolean
}

export interface PushAccountsView {
  accounts: PushAccountView[]
  /** Stores reached across every account. */
  stores: number
  /** PLUs sent across every account. */
  rows: number
  /** Accounts whose file Deliverect refused or could not be reached for. */
  failed: number
}

export function pushAccountsView(entries: readonly DeliverectStockPushAccount[]): PushAccountsView {
  const accounts = entries.map((a) => ({ ...a, stores: a.stores ?? [], failed: a.status !== 'S' }))
  return {
    accounts,
    stores: accounts.reduce((n, a) => n + a.stores.length, 0),
    rows: accounts.reduce((n, a) => n + (a.rows ?? 0), 0),
    failed: accounts.filter((a) => a.failed).length,
  }
}

/**
 * The import's push, as one of five things to say:
 * - `absent` — a server before 3485 sent no block: nothing is said;
 * - `skipped` — not attempted, and why (`null` for a reason the contract does not name);
 * - `failed` — attempted, and failed as a whole: a WARNING beside a committed import, never a failed one;
 * - `noStores` — attempted, but no linked, unpaused store was reached;
 * - `pushed` — per account (one of them may still be `"E"`).
 */
export type ImportPushView =
  | { kind: 'absent' }
  | { kind: 'skipped'; why: DeliverectImportPushSkip | null }
  | { kind: 'failed'; error: string }
  | { kind: 'noStores' }
  | ({ kind: 'pushed' } & PushAccountsView)

export function importPushView(push: DeliverectImportPush | null | undefined): ImportPushView {
  if (!push) return { kind: 'absent' }
  if (push.skipped) {
    const why = SKIPS.find((s) => s === push.why) ?? null
    return { kind: 'skipped', why }
  }
  if (push.error) return { kind: 'failed', error: push.error }
  const accounts = push.accounts ?? []
  if (accounts.length === 0) return { kind: 'noStores' }
  return { kind: 'pushed', ...pushAccountsView(accounts) }
}

/**
 * The materials a refusal's message names, from those sent: whole tokens, matched case-insensitively
 * as the door matches numbers, in the order sent. The door names every non-whitelisted number in
 * `message` (DLV-00004); this picks them back out so the list can mark them.
 */
export function namedMaterials(message: string, sent: readonly string[]): string[] {
  const tokens = new Set(message.toUpperCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))
  return sent.filter((m) => tokens.has(m.toUpperCase()))
}

/** A refusal of Push now's LIST, shown under the list; the reason's own refusal is the reason field's. */
export interface PushNowRefusal {
  kind: 'notWhitelisted' | 'invalidList'
  code: string
  /** The server's own sentence. */
  message: string
  /** For `notWhitelisted`, the sent materials it names; else empty. */
  materials: string[]
}

export const PUSH_NOW_LIST_CODES = [DELIVERECT_ERRORS.noSuchMaterial, DELIVERECT_ERRORS.stockPushInvalid] as const

export function pushNowRefusal(err: unknown, sent: readonly string[], fallback: string): PushNowRefusal | null {
  const r = fieldRefusal(err, PUSH_NOW_LIST_CODES, fallback)
  if (!r || r.code === null) return null
  return r.code === DELIVERECT_ERRORS.noSuchMaterial
    ? { kind: 'notWhitelisted', code: r.code, message: r.message, materials: namedMaterials(r.message, sent) }
    : { kind: 'invalidList', code: r.code, message: r.message, materials: [] }
}
