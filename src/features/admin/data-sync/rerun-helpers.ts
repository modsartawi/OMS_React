/**
 * *New campaign from failed* (spec 863, ticket 864): the New campaign dialog's pre-fill from the
 * re-run offer (`GET DataSync/Campaigns/{id}/RerunTargets`). No React, no network — pinned by
 * `rerun-helpers.test.ts`.
 *
 * 🚩 Which stores qualify is the door's decision (the failures Retry refuses in that campaign, less
 * the stores a live re-run holds); this only turns the offer into what the dialog starts with. The
 * technician can still drop stores or tables.
 */
import type { Campaign, Mode, RerunExclusion, RerunOffer } from '@/core/models/data-sync'

/** What the dialog starts with in re-run mode. */
export interface RerunPrefill {
  /** Locked: a re-run runs the original's profile. */
  profileId: string
  /** The offer's union of unfinished tables, in profile order. */
  pickedTables: string[]
  /** The original's mode; the technician may switch it. */
  mode: Mode
  /** The stores to re-run, by code, for the starting mode (`rerunCodesForMode`). */
  codes: string[]
  /** The offer's WPF-hosted stores: left out (and named in a note) while the dialog is Apply, back in report only. */
  wpfHosted: string[]
  /** Stores already in a live re-run of this campaign (865), named in a note. */
  excluded: RerunExclusion[]
  /** Always empty: the technician writes what was fixed. */
  reason: ''
  rerunOf: string
}

const WPF_HOSTED = 'StoreWpfHosted'

export function rerunDraft(offer: RerunOffer, profileTables: readonly string[]): RerunPrefill {
  const wanted = new Set(offer.tables)
  const wpfHosted = offer.targets.filter((t) => t.failureReason === WPF_HOSTED).map((t) => t.code)
  return {
    profileId: offer.profileId,
    // Filtering the profile's own list keeps profile order and never ticks a table beyond it.
    pickedTables: profileTables.filter((t) => wanted.has(t)),
    mode: offer.mode,
    codes: rerunCodesForMode(
      offer.targets.map((t) => t.code),
      wpfHosted,
      offer.mode,
    ),
    wpfHosted,
    excluded: offer.excluded,
    reason: '',
    rerunOf: offer.campaignId,
  }
}

/**
 * The codes the dialog holds once its mode is `mode`: Apply drops the WPF-hosted stores (they can
 * never be applied to); report only puts back any that are missing, after the others. Compared
 * case-insensitively; every other code is kept as typed.
 */
export function rerunCodesForMode(codes: readonly string[], wpfHosted: readonly string[], mode: Mode): string[] {
  const wpf = new Set(wpfHosted.map((c) => c.toUpperCase()))
  if (mode === 'Apply') return codes.filter((c) => !wpf.has(c.trim().toUpperCase()))
  const have = new Set(codes.map((c) => c.trim().toUpperCase()))
  return [...codes, ...wpfHosted.filter((c) => !have.has(c.toUpperCase()))]
}

/**
 * The N of *New campaign from failed (N)*, from the campaign read model (`rerunnableJobs`, no offer
 * fetch): the stores the dialog will pre-fill. An Apply campaign's re-run leaves its WPF-hosted
 * stores out, so they are not counted. 0 hides the button, as does a service that sends no count.
 */
export function rerunCount(campaign: Campaign | undefined): number {
  const all = campaign?.rerunnableJobs
  if (typeof all !== 'number') return 0
  const wpf = typeof campaign?.rerunnableWpfHostedJobs === 'number' ? campaign.rerunnableWpfHostedJobs : 0
  return Math.max(0, campaign?.mode === 'Apply' ? all - wpf : all)
}
