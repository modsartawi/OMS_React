/**
 * BackOffice ticket 3983 (spec 3972; 3971): what a paste over one field of a draft item list changes against the
 * LIVE version of that list, as HQ counts it (`POST InsuranceRules/Lists/PasteCounts { listId, field, codes }` →
 * `{ added, removed, notInMaster, addedCodes, removedCodes, notInMasterCodes }`). A list the live version does not
 * have yet counts as empty there. A code not in the master never matches (3968 §3), so it is named.
 */

export interface PasteCounts {
  added: number
  removed: number
  notInMaster: number
  addedCodes: string[]
  removedCodes: string[]
  notInMasterCodes: string[]
}

export interface PasteCountsReply {
  added?: number
  removed?: number
  notInMaster?: number
  addedCodes?: string[]
  removedCodes?: string[]
  notInMasterCodes?: string[]
}

export const pasteCountsOf = (r: PasteCountsReply | null | undefined): PasteCounts => ({
  added: r?.added ?? 0,
  removed: r?.removed ?? 0,
  notInMaster: r?.notInMaster ?? 0,
  addedCodes: r?.addedCodes ?? [],
  removedCodes: r?.removedCodes ?? [],
  notInMasterCodes: r?.notInMasterCodes ?? [],
})

export type PasteCountKind = 'added' | 'removed' | 'notInMaster'

/** The three lines the editor shows, always all three and in this order (a zero says the check ran). */
export const pasteCountLines = (c: PasteCounts): { kind: PasteCountKind; count: number }[] => [
  { kind: 'added', count: c.added },
  { kind: 'removed', count: c.removed },
  { kind: 'notInMaster', count: c.notInMaster },
]
