// Which report cards the screen shows, in what order, given a counts result
// (ticket 152). Pure: counts in, card list out — no React, no `t`, no network.
//
// It left the page for one reason: the seventh card is CONDITIONAL. "Is the
// field there?" is a question with a wrong answer that looks fine on screen — a
// missing count rendered as `0` reads as "the cutover hasn't started" and gets
// repeated in a status meeting — so it belongs somewhere a test can ask it.

import type { UaReportCountsResult } from '@/core/models/ua-user'

/**
 * One card as the row renders it.
 *
 * `card` is BOTH the i18n key (`cards.<card>`) and the `/ReportCards/{card}`
 * path arg — one string, so a card cannot be labelled one thing and open
 * another. `count` is `null` only while the counts read is in flight (the row
 * holds its shape and shows a dash); a real `0` is a number.
 */
export interface ReportCard {
  card: CardCode
  count: number | null
  /** Token class, or `''` for untoned. */
  tone: string
}

/** The card codes, as a union — a typo is a type error, not a raw i18n key. */
export type CardCode = (typeof ROW)[number]['card']

/**
 * The row's order, and where each count comes from.
 *
 * Colour on this row means **there is work here**. That is why *Authenticator
 * active* is untoned even though it sits beside an accented neighbour: it is the
 * one card whose rows need nothing done. The asymmetry is deliberate — don't
 * "fix" it. *People* and *Disabled* are untoned for the same reason.
 *
 * `completedActivation` sits fifth, immediately after *Awaiting activation*, so
 * the pair reads as two ends of one journey: how many still need chasing, how
 * many are finished. *Disabled* stays last and keeps its name — the collision is
 * the word *active*, and the fix is never spending it (it is the same word as
 * the status pill, the Status column, and the Disable/Re-enable actions). The
 * label here says *Authenticator* first for exactly that reason: it is the noun
 * that disambiguates, so it leads.
 */
const ROW = [
  { card: 'all', count: (c: UaReportCountsResult) => c.allPeople, tone: '' },
  { card: 'notSeeded', count: (c: UaReportCountsResult) => c.notSeeded, tone: 'text-danger-800' },
  { card: 'phoneGap', count: (c: UaReportCountsResult) => c.phoneGap, tone: 'text-attention-800' },
  {
    card: 'awaitingActivation',
    count: (c: UaReportCountsResult) => c.awaitingActivation,
    tone: 'text-sidebar-active',
  },
  // The one card that may not be on the wire at all. `conditional` says so ONCE,
  // so the loaded and the in-flight arms below can't disagree about which card
  // that is — and an eighth conditional card is a one-line change.
  {
    card: 'completedActivation',
    count: (c: UaReportCountsResult) => c.completedActivation,
    tone: '',
    conditional: true,
  },
  {
    card: 'mustChange',
    count: (c: UaReportCountsResult) => c.mustChangePassword,
    tone: 'text-sidebar-active',
  },
  { card: 'disabled', count: (c: UaReportCountsResult) => c.disabled, tone: '' },
] as const

/**
 * The cards to render, in order.
 *
 * A card whose count is **absent** from the envelope is not rendered at all —
 * no zero, no dash, no placeholder. Six cards is a real state, not a temporary
 * hack: it is what production shows until BackOffice 805 deploys, and the row is
 * an auto-fitting track so both arrangements look deliberate.
 *
 * `undefined` counts (the read hasn't landed) keep the full six-card shape with
 * no numbers, so the row doesn't appear from nothing on first paint.
 */
export function visibleCards(counts: UaReportCountsResult | undefined): ReportCard[] {
  if (counts === undefined) {
    return ROW.filter((c) => !('conditional' in c)).map((c) => ({ card: c.card, count: null, tone: c.tone }))
  }
  const cards: ReportCard[] = []
  for (const c of ROW) {
    const count = c.count(counts)
    if (count === undefined) continue
    cards.push({ card: c.card, count, tone: c.tone })
  }
  return cards
}
