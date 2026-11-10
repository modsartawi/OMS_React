/**
 * *New campaign from failed* (spec 863, ticket 864): the New campaign dialog's pre-fill from the
 * re-run offer (`GET DataSync/Campaigns/{id}/RerunTargets`). No React, no network — pinned by
 * `rerun-helpers.test.ts`.
 *
 * 🚩 Which stores qualify is the door's decision (the failures Retry refuses); this only turns the
 * offer into what the dialog starts with. The technician can still drop stores or tables.
 */
import type { Mode, RerunExclusion, RerunOffer } from '@/core/models/data-sync'

/** What the dialog starts with in re-run mode. */
export interface RerunPrefill {
  /** Locked: a re-run runs the original's profile. */
  profileId: string
  /** The offer's union of unfinished tables, never beyond the profile, in profile order. */
  pickedTables: string[]
  /** The original's mode; the technician may switch it. */
  mode: Mode
  /** The stores to re-run, by code. */
  codes: string[]
  /** Apply only: the WPF-hosted stores left out (they can never be applied to), named in a note. */
  leftOutWpf: string[]
  /** Stores already in a live re-run of this campaign (865), named in a note. */
  excluded: RerunExclusion[]
  /** Always empty: the technician writes what was fixed. */
  reason: ''
  rerunOf: string
}

const WPF_HOSTED = 'StoreWpfHosted'

export function rerunDraft(offer: RerunOffer, profileTables: readonly string[]): RerunPrefill {
  const inProfile = new Set(profileTables)
  const wanted = new Set(offer.tables)
  const held = new Set(offer.excluded.map((e) => e.code.toUpperCase()))
  const targets = offer.targets.filter((t) => !held.has(t.code.toUpperCase()))
  const dropWpf = offer.mode === 'Apply'
  return {
    profileId: offer.profileId,
    pickedTables: profileTables.filter((t) => wanted.has(t) && inProfile.has(t)),
    mode: offer.mode,
    codes: targets.filter((t) => !(dropWpf && t.failureReason === WPF_HOSTED)).map((t) => t.code),
    leftOutWpf: dropWpf ? targets.filter((t) => t.failureReason === WPF_HOSTED).map((t) => t.code) : [],
    excluded: offer.excluded,
    reason: '',
    rerunOf: offer.campaignId,
  }
}

/** The N of *New campaign from failed (N)*: the offer's target count; the button is hidden at 0. */
export const rerunCount = (offer: RerunOffer | undefined): number => offer?.targets.length ?? 0
