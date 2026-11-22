/**
 * How the console's figures read (oms 940, BackOffice spec 4157 "What each figure is") — pure, so a store row, an item
 * row (941) and the item's sum (943) draw reserved, free and status the same way. Returns kinds and locale keys; the
 * components say them.
 */

import { STOCK_CONSOLE_FLAGS, type StockConsoleFlag } from '@/core/models/stock-console'
import { isStageName } from '@/core/models/store-stage'
import type { Severity } from '@/core/ui/severity'

// ── Stage ───────────────────────────────────────────────────────────────────────────────────────────

/** A store's stage: one of the four in the console's words (`stage.<Stage>`); another as it came — never a raw key. */
export const stageWord = (stage: string | null | undefined): { key: string } | { raw: string } =>
  isStageName(stage) ? { key: `stage.${stage}` } : { raw: stage ?? '' }

// ── Status and flags ────────────────────────────────────────────────────────────────────────────────

const STATUS_SEV: Record<string, Severity> = { Ok: 'ok', Watch: 'warn', Problem: 'bad' }

/** The status pill: a known status in its words; an unknown one as it came, as a Watch — never as OK. */
export type StatusPill = { sev: Severity; key: string } | { sev: Severity; raw: string }

export function statusPill(status: string): StatusPill {
  const sev = Object.hasOwn(STATUS_SEV, status) ? STATUS_SEV[status] : undefined
  return sev ? { sev, key: `status.${status}` } : { sev: 'warn', raw: status }
}

/**
 * One line of the pill's popover. `key` is the flag's sentence, counted by `value` ("No SAP document for 31 hours");
 * with no measured value it is the flag's bare name; an unknown code takes `flag.unknown` and is drawn by its code.
 */
export interface FlagLine {
  code: string
  sev: Severity
  key: string
  value: number | null
  limit: { key: 'flag.limit'; value: number } | { key: 'flag.limitAny' }
}

const isKnownFlag = (code: string) => (STOCK_CONSOLE_FLAGS as readonly string[]).includes(code)

/** The flags as lines, Problem first and otherwise in the server's order. A level other than Problem reads as Watch. */
export function flagLines(flags: readonly StockConsoleFlag[]): FlagLine[] {
  const lines = flags.map((f): FlagLine => {
    const known = isKnownFlag(f.code)
    const value = typeof f.value === 'number' ? f.value : null
    return {
      code: f.code,
      sev: f.level === 'Problem' ? 'bad' : 'warn',
      key: !known ? 'flag.unknown' : value === null ? `flagName.${f.code}` : `flag.${f.code}`,
      value,
      // Raised strictly over its limit: over 0 is "any".
      limit: f.limit === 0 ? { key: 'flag.limitAny' } : { key: 'flag.limit', value: f.limit },
    }
  })
  return [...lines.filter((l) => l.sev === 'bad'), ...lines.filter((l) => l.sev !== 'bad')]
}

// ── Reserved and free ───────────────────────────────────────────────────────────────────────────────

/** The reserved part of any row the console draws: a store's, an item's. */
export interface ReservedFigures {
  reserved: number | null
  reservedState: string
  reservedIncluded: boolean
  reservedAt?: string | null
}

/**
 * Reserved as drawn. Never computed — or no figure at all — is "not computed", never a zero (spec: "reserved is never
 * shown as zero when it was not computed"). Stale is the figure, marked, with its time. Otherwise the figure and its time.
 */
export type ReservedView =
  | { kind: 'notComputed' }
  | { kind: 'stale'; value: number; at: string | null }
  | { kind: 'value'; value: number; at: string | null }

export function reservedView(row: ReservedFigures): ReservedView {
  if (row.reservedState === 'NeverComputed' || row.reserved === null || row.reserved === undefined)
    return { kind: 'notComputed' }
  const at = row.reservedAt ?? null
  return row.reservedState === 'Stale' ? { kind: 'stale', value: row.reserved, at } : { kind: 'value', value: row.reserved, at }
}

/** Free's sub-label: "reserved not included" whenever reserved is not in it — and whenever reserved reads "not computed". */
export function freeLabel(row: ReservedFigures): 'reservedNotIncluded' | null {
  return row.reservedIncluded === false || reservedView(row).kind === 'notComputed' ? 'reservedNotIncluded' : null
}
