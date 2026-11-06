/**
 * Paste IDs in Add holders (spec 805, ticket 808): a pasted list of employee IDs turned into people
 * to pick. The paste is split with the core code-list parser (a column from Excel, or IDs separated
 * by commas, spaces or new lines) and de-duplicated. Each ID is then looked up through the people
 * search, **one at a time**, and — because that search is a contains-match — resolves only to the row
 * whose `employeeId` **equals** it: `1234` never picks `12345`.
 *
 * Each ID ends as **found** (the person, to pick), **already holds** (a current holder: reported, not
 * looked up, not picked), **not found** (listed back), or **failed** (the lookup itself failed, with
 * its error). The lookups run through the batch runner, so a failed lookup never stops the rest and
 * an expired session does (`stopped`; `handle401` is already redirecting).
 *
 * Pure apart from the lookup it is handed: no React, no DOM.
 */
import { pastedCodes } from '@/core/util/code-list'
import { runBatch } from '@/core/util/batch-runner'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'

export interface PasteResolution {
  /** The people found, in pasted order. */
  found: UaEmployeeGridRow[]
  /** Pasted IDs that already hold the role. */
  alreadyHolds: string[]
  /** Pasted IDs no search row equals. */
  notFound: string[]
  /** Pasted IDs whose lookup failed, with the error (shown through `apiErrorMessage`). */
  failed: { id: string; error: unknown }[]
  /** True when an expired session ended the lookups early. */
  stopped: boolean
}

export interface ResolveOptions {
  /** The role's current holders' employee IDs. */
  holders: readonly string[]
  /** IDs to leave out of the paste altogether (already picked). */
  skip?: readonly string[]
  /** One people search for one ID (contains-match). */
  lookup: (id: string) => Promise<readonly UaEmployeeGridRow[]>
  onProgress?: (completed: number, total: number) => void
}

/** Employee IDs compare as the server does: trimmed, case-insensitive (the CI collation). */
const same = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

export async function resolvePastedIds(text: string, { holders, skip = [], lookup, onProgress }: ResolveOptions): Promise<PasteResolution> {
  const ids = pastedCodes(text, skip)
  const alreadyHolds = ids.filter((id) => holders.some((h) => same(h, id)))
  const toLookUp = ids.filter((id) => !alreadyHolds.includes(id))

  const found: UaEmployeeGridRow[] = []
  const notFound: string[] = []
  const outcome = await runBatch(
    toLookUp,
    async (id) => {
      const rows = await lookup(id)
      const match = rows.find((r) => same(r.employeeId, id))
      if (match) found.push(match)
      else notFound.push(id)
    },
    (p) => onProgress?.(p.completed, p.total),
  )
  const failed = outcome.outcomes.flatMap((o) => (o.status === 'refused' ? [{ id: o.item, error: o.error }] : []))
  return { found, alreadyHolds, notFound, failed, stopped: outcome.stopped }
}
