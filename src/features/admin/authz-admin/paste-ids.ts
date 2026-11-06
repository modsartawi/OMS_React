/**
 * Paste IDs in Add holders (spec 805, ticket 808): a pasted list of employee IDs turned into people
 * to pick. The paste is split with the core code-list parser (a column from Excel, or IDs separated
 * by commas, spaces or new lines) and de-duplicated **case-insensitively**, as the server compares
 * employee IDs (`ab12` and `AB12` are one person: looked up once, picked once). Each ID is then
 * looked up through the people search, **one at a time**, and — because that search is a
 * contains-match — resolves only to the row whose `employeeId` **equals** it: `1234` never picks `12345`.
 *
 * Each ID ends as **found** (the person, to pick), **already holds** (a current holder: reported, not
 * looked up, not picked), **too many** (the search hit its row cap without the exact row in it, so the
 * ID cannot be told apart from its neighbours: check it by hand), **not found** (listed back), or
 * **failed** (the lookup itself failed, with its error). The lookups run through the batch runner, so
 * a failed lookup never stops the rest and an expired session does (`stopped`; `handle401` is already
 * redirecting).
 *
 * Pure apart from the lookup it is handed: no React, no DOM.
 */
import { pastedCodes } from '@/core/util/code-list'
import { runBatch } from '@/core/util/batch-runner'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'

export interface PasteResolution {
  /** The people found, in pasted order, each once. */
  found: UaEmployeeGridRow[]
  /** Pasted IDs that already hold the role. */
  alreadyHolds: string[]
  /** Pasted IDs whose search was capped with no exact row in it: not known to be absent, check by hand. */
  tooMany: string[]
  /** Pasted IDs no search row equals (the search was complete). */
  notFound: string[]
  /** Pasted IDs whose lookup failed, with the error (shown through `refusalText`). */
  failed: { id: string; error: unknown }[]
  /** True when an expired session ended the lookups early. */
  stopped: boolean
}

/** One people search's answer: its rows, and whether it hit its row cap. */
export interface LookupResult {
  rows: readonly UaEmployeeGridRow[]
  isCapped: boolean
}

export interface ResolveOptions {
  /** The role's current holders' employee IDs. */
  holders: readonly string[]
  /** IDs to leave out of the paste altogether (already picked). */
  skip?: readonly string[]
  /** One people search for one ID (contains-match). */
  lookup: (id: string) => Promise<LookupResult>
  /** The lookups' progress: first `(0, total)` before any is sent, then once per settled lookup. */
  onProgress?: (completed: number, total: number) => void
}

/** Employee IDs compare as the server does: trimmed, case-insensitive (the CI collation). */
const key = (id: string) => id.trim().toUpperCase()
const same = (a: string, b: string) => key(a) === key(b)

/** The IDs once each by `key`, first spelling kept, without any `skip` holds. */
function distinct(ids: readonly string[], skip: readonly string[]): string[] {
  const seen = new Set(skip.map(key))
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(key(id))) continue
    seen.add(key(id))
    out.push(id)
  }
  return out
}

export async function resolvePastedIds(text: string, { holders, skip = [], lookup, onProgress }: ResolveOptions): Promise<PasteResolution> {
  const ids = distinct(pastedCodes(text), skip)
  const alreadyHolds = ids.filter((id) => holders.some((h) => same(h, id)))
  const toLookUp = ids.filter((id) => !alreadyHolds.includes(id))
  if (toLookUp.length > 0) onProgress?.(0, toLookUp.length)

  const found: UaEmployeeGridRow[] = []
  const tooMany: string[] = []
  const notFound: string[] = []
  const outcome = await runBatch(
    toLookUp,
    async (id) => {
      const { rows, isCapped } = await lookup(id)
      const match = rows.find((r) => same(r.employeeId, id))
      if (match) {
        // Defensive: two spellings the server matched alike must still be one pick.
        if (!found.some((f) => same(f.employeeId, match.employeeId))) found.push(match)
      } else if (isCapped) tooMany.push(id)
      else notFound.push(id)
    },
    (p) => onProgress?.(p.completed, p.total),
  )
  const failed = outcome.outcomes.flatMap((o) => (o.status === 'refused' ? [{ id: o.item, error: o.error }] : []))
  return { found, alreadyHolds, tooMany, notFound, failed, stopped: outcome.stopped }
}
