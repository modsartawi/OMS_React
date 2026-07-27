// The report-card row (ticket 152, spec 147 "Tier 1 — pure"). The whole reason
// this is a module and not an inline array: the seventh card is conditional, and
// the failure mode is silent — a missing count rendered as `0` looks like a
// working screen and reads as "the cutover hasn't started".
import { describe, expect, it } from 'vitest'
import type { UaReportCountsResult } from '@/core/models/ua-user'
import { visibleCards } from './cards'

/** What the server sends today — no `completedActivation` (BackOffice 805 pending). */
const sixFieldCounts = (over: Partial<UaReportCountsResult> = {}): UaReportCountsResult => ({
  allPeople: 6000,
  notSeeded: 12,
  phoneGap: 400,
  awaitingActivation: 152,
  mustChangePassword: 3,
  disabled: 40,
  ...over,
})

const codes = (counts: UaReportCountsResult | undefined) => visibleCards(counts).map((c) => c.card)

describe('visibleCardsAtSixAndSeven', () => {
  it('renders today’s six, in today’s order, when the field is absent', () => {
    expect(codes(sixFieldCounts())).toEqual([
      'all',
      'notSeeded',
      'phoneGap',
      'awaitingActivation',
      'mustChange',
      'disabled',
    ])
  })

  it('renders seven with Activation done fifth, and Disabled still last, when it arrives', () => {
    expect(codes(sixFieldCounts({ completedActivation: 4812 }))).toEqual([
      'all',
      'notSeeded',
      'phoneGap',
      'awaitingActivation',
      'completedActivation',
      'mustChange',
      'disabled',
    ])
  })

  it('renders a completedActivation of 0 — zero is a count, absence is not', () => {
    // The distinction the whole module exists for. A server saying "nobody has
    // finished yet" is information; a server saying nothing is not.
    const cards = visibleCards(sixFieldCounts({ completedActivation: 0 }))
    expect(cards.map((c) => c.card)).toContain('completedActivation')
    expect(cards.find((c) => c.card === 'completedActivation')?.count).toBe(0)
  })

  it('carries each card’s own count', () => {
    const cards = visibleCards(sixFieldCounts({ completedActivation: 4812 }))
    expect(Object.fromEntries(cards.map((c) => [c.card, c.count]))).toEqual({
      all: 6000,
      notSeeded: 12,
      phoneGap: 400,
      awaitingActivation: 152,
      completedActivation: 4812,
      mustChange: 3,
      disabled: 40,
    })
  })

  it('leaves Activation done untoned — colour on this row means there is work here', () => {
    const cards = visibleCards(sixFieldCounts({ completedActivation: 4812 }))
    expect(cards.find((c) => c.card === 'completedActivation')?.tone).toBe('')
    // Its neighbour keeps its accent: the asymmetry is the point.
    expect(cards.find((c) => c.card === 'awaitingActivation')?.tone).not.toBe('')
  })

  it('holds the six-card shape with no numbers while the counts read is in flight', () => {
    // So the row doesn't appear from nothing on first paint. `null`, not 0 —
    // the screen shows a dash.
    const pending = visibleCards(undefined)
    expect(pending).toHaveLength(6)
    expect(pending.every((c) => c.count === null)).toBe(true)
    expect(pending.map((c) => c.card)).not.toContain('completedActivation')
  })
})
