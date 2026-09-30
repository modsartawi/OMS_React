import { describe, expect, it } from 'vitest'
import settlement from '@/locales/en/settlement.json'
import type { SettlementOpenLaneRow } from '@/core/models/settlement'
import { DEFAULT_OPEN_TAB, readOpenTab, tallyOpenLane } from './open-lane'

/**
 * **One vocabulary on the settlement screens** (ticket 340, BackOffice spec 2149 D13).
 *
 * The owner's ruling, 2026-09-30: *"I saw owed and owned, why not keep it surplus/short
 * as before"*. The kinds are Shortage and Surplus everywhere a reader looks, and nobody
 * has to work out who owes whom.
 *
 * 🚩 **Labels only.** The tab KEYS (`owing`, `owed`) are an address an accountant may
 * have saved, so they stay — the last block here is what holds that, and it is the one
 * a well-meant rename would break.
 *
 * ⚠️ The sweep walks the WHOLE locale file rather than the keys the ticket names: a
 * leftover *"owes"* in a sentence nobody listed renders perfectly and passes every
 * other gate.
 */

/** Every user-facing string in the namespace, with the dotted key that holds it. */
function strings(node: unknown, path = ''): Array<[key: string, text: string]> {
  if (typeof node === 'string') return [[path, node]]
  if (node === null || typeof node !== 'object') return []
  return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
}

const ALL = strings(settlement)

describe('the open settlements tabs', () => {
  it('open settlements tabs are labelled Shortage and Surplus', () => {
    expect(settlement.open.tabs.owing).toBe('Shortage')
    expect(settlement.open.tabs.owed).toBe('Surplus')
  })

  it('the empty states say which kind is empty, not who owes whom', () => {
    expect(settlement.open.empty.owing.title).toMatch(/shortage/i)
    expect(settlement.open.empty.owed.title).toMatch(/surplus/i)
  })
})

describe('the wording', () => {
  it('no user-facing settlement string says owed, owes or owing', () => {
    // Sanity: the walk reached the file, or the assertion below proves nothing.
    expect(ALL.length).toBeGreaterThan(300)
    const leftovers = ALL.filter(([, text]) => /\bow(e|es|ed|ing)\b/i.test(text))
    expect(leftovers).toEqual([])
  })

  it('the headline says Shortage and Surplus, plainly', () => {
    expect(settlement.account.headline.shortage).toBe('Shortage')
    expect(settlement.account.headline.surplus).toBe('Surplus')
    // The sentence beside the net figure leads with the kind, whichever way it points.
    expect(settlement.account.position.owes).toMatch(/^shortage /)
    expect(settlement.account.position.keeps).toMatch(/^surplus /)
  })

  it('the kind labels carry their Arabic words inline', () => {
    expect(settlement.account.kind.SHORTAGE).toBe('Shortage · عجز')
    expect(settlement.account.kind.SURPLUS).toBe('Surplus · فائض')
  })

  it('the accountant’s text is labelled Description on every screen', () => {
    for (const label of [
      settlement.account.columns.reason,
      settlement.bulk.columns.reason,
      settlement.open.columns.reason,
      settlement.approval.fields.reason,
      settlement.post.reason.label,
    ]) {
      expect(label).toMatch(/^Description/)
    }
  })
})

/** One open row of a kind — the tally reads nothing else off it. */
const open = (entryKind: 'SHORTAGE' | 'SURPLUS') =>
  ({ entryKind, status: 'OPEN' }) as SettlementOpenLaneRow

describe('a saved address survives the relabelling', () => {
  it('the old tab address still opens the shortage tab', () => {
    const tab = readOpenTab(new URLSearchParams('tab=owing'))
    expect(tab).toBe('owing')
    // The key the address resolves to is the one the strip labels Shortage…
    expect(settlement.open.tabs[tab]).toBe('Shortage')
    // …and the one the shortages are still counted under.
    const { counts } = tallyOpenLane({ rows: [open('SHORTAGE')], failed: false })
    expect(counts).toEqual({ owing: 1, owed: 0 })
    // The address with no tab at all is how the default is spelled, and it is the same tab.
    expect(readOpenTab(new URLSearchParams(''))).toBe('owing')
    expect(DEFAULT_OPEN_TAB).toBe('owing')
  })

  it('…and the old surplus address still opens the surplus tab', () => {
    const tab = readOpenTab(new URLSearchParams('tab=owed'))
    expect(tab).toBe('owed')
    expect(settlement.open.tabs[tab]).toBe('Surplus')
    const { counts } = tallyOpenLane({ rows: [open('SURPLUS')], failed: false })
    expect(counts).toEqual({ owing: 0, owed: 1 })
  })
})
