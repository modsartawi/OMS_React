/**
 * The branch account's read model, asserted against **the six hostile branches**
 * rather than a happy path (ticket 269, spec 267 §Further Notes).
 *
 * Everything here is a fact about a fixture the prototype chose *because it broke a
 * layout that looked fine on the easy case* — so a green suite means the awkward
 * cases hold, which is the only thing worth asserting about a projection.
 *
 * ⚠️ The three rendering rules the ticket calls "the actual work" each have their
 * own describe block: they are the assertions a later tidy-up is most likely to
 * regress, and the ones nothing else on the screen would notice breaking.
 */
import { describe, expect, it } from 'vitest'

import { formatMoneyIn } from '@/core/money'
import { settlementMoney } from './money-display'
import { formatDateTime } from '@/core/util/date-format'
import {
  accountHeadline,
  describeDocument,
  journalFor,
  projectAccount,
} from './account-projection'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'

const account = (code: string) => SETTLEMENT_ACCOUNTS[code]
const rowsOf = (code: string) => projectAccount(account(code))
const row = (code: string, entryNumber: number) => {
  const found = rowsOf(code).find((r) => r.entryNumber === entryNumber)
  if (!found) throw new Error(`fixture ${code} has no entry ${entryNumber}`)
  return found
}

describe('the fixture itself', () => {
  it('is the six branches the ticket names, and no others', () => {
    expect(Object.keys(SETTLEMENT_ACCOUNTS)).toEqual([
      '0142',
      '0207',
      '0331',
      '0455',
      '0512',
      '0688',
    ])
  })

  it('🔑 carries one branch whose figures hold three decimals — 0688, the Bahraini one', () => {
    // ⚠️ 274 removed `currencyKey` from the account (the door does not send one),
    // so the branch is now identified by the thing that actually matters: it is the
    // only one carrying figures a 2-decimal renderer would round. If someone
    // "tidies" 0688's amounts to whole riyals, the Proof bullet about a Bahraini
    // branch's fils becomes unfalsifiable and every figure still looks fine.
    const threeDecimal = (v: number) => Math.round(v * 1000) % 10 !== 0 || v % 1 !== 0
    expect(account('0688').entries.some((e) => threeDecimal(e.amount))).toBe(true)
  })
})

describe('the signed headline', () => {
  it('0142 holds BOTH kinds open at once and nets them for display', () => {
    // 500.000 + 75.500 owed, 120.000 of surplus left after 200 was consumed.
    expect(accountHeadline(account('0142').entries)).toEqual({
      shortageTotal: 575.5,
      surplusTotal: 120,
      signedPosition: 455.5,
      direction: 'owes',
      openCount: 3,
    })
  })

  it('counts ONLY open entries — a consumed one is finished, not a position', () => {
    // 0207's surplus went to zero last night; only the 1,240 shortage is a position.
    expect(accountHeadline(account('0207').entries)).toMatchObject({
      shortageTotal: 1240,
      surplusTotal: 0,
      signedPosition: 1240,
      openCount: 1,
    })
  })

  it('0512 is SQUARE — history only, and the direction says so', () => {
    expect(accountHeadline(account('0512').entries)).toEqual({
      shortageTotal: 0,
      surplusTotal: 0,
      signedPosition: 0,
      direction: 'square',
      openCount: 0,
    })
  })

  it('🚩 a CANCELLED entry with a full remaining is NOT a position', () => {
    // 0688's entry 147 still carries `remainingAmount: 180` on the wire — the
    // cancel closed it without zeroing the figure. Counting it would put 180.000 of
    // surplus on a branch that owes it to nobody.
    const headline = accountHeadline(account('0688').entries)
    expect(headline.surplusTotal).toBe(0)
    expect(headline.openCount).toBe(1)
    expect(headline.signedPosition).toBe(95.25)
  })

  it('a surplus-heavy branch reads as `keeps`, the mirror of `owes`', () => {
    expect(accountHeadline(account('0331').entries)).toMatchObject({
      surplusTotal: 300,
      signedPosition: -300,
      direction: 'keeps',
    })
  })

  it('🚩 rounds to three places, so a level branch is exactly square', () => {
    // The float tail this guards: 0.1 + 0.2 - 0.3 is 5.5e-17, which is > 0 and
    // would render a square branch as owing.
    const entries = account('0142').entries
    const level = accountHeadline([
      { ...entries[0], amount: 0.3, remainingAmount: 0.3, entryKind: 'SHORTAGE' },
      { ...entries[1], amount: 0.1, remainingAmount: 0.1, entryKind: 'SURPLUS', status: 'OPEN' },
      { ...entries[2], amount: 0.2, remainingAmount: 0.2, entryKind: 'SURPLUS' },
    ])
    expect(level.signedPosition).toBe(0)
    expect(level.direction).toBe('square')
  })
})

describe('🔑 rule 1 — a consumption with no document is a NAMED condition', () => {
  it("0331's orphan is tagged `orphan`, not handed over as an empty string", () => {
    const journal = row('0331', 137).journal
    expect(journal).toHaveLength(1)
    expect(journal[0].isOrphan).toBe(true)
    expect(journal[0].document).toEqual({ kind: 'orphan' })
    // …and the entry knows, so a collapsed drilldown can still flag it.
    expect(row('0331', 137).hasOrphan).toBe(true)
  })

  it('every documented row is NOT an orphan, whichever document spent it', () => {
    expect(row('0142', 151).journal.map((r) => r.isOrphan)).toEqual([false])
    expect(row('0455', 141).journal.map((r) => r.isOrphan)).toEqual([false, false, false, false])
    expect(row('0455', 141).hasOrphan).toBe(false)
  })

  it('⚠️ a REVERSE with no document number is a reversal, never an orphan', () => {
    // A void's own subject can be an unnumbered receipt; the row still means
    // something definite, so the reversal test has to come first.
    const [reversal] = journalFor('e', [
      {
        ...account('0455').consumptions[2],
        settlementEntryId: 'e',
        documentNumber: '',
      },
    ])
    expect(reversal.isOrphan).toBe(false)
    expect(reversal.document).toEqual({ kind: 'reversal', documentNumber: '' })
  })

  it('names which document spent it — a receipt, or a close on its business day', () => {
    expect(describeDocument(account('0455').consumptions[0])).toEqual({
      kind: 'receipt',
      documentNumber: 'SR-0455-0011',
    })
    expect(describeDocument(account('0142').consumptions[0])).toEqual({
      kind: 'shift-close',
      documentNumber: 'Z-40318',
      businessDay: '2026-08-12',
    })
  })
})

describe('🔑 rule 2 — a REVERSE is a restoration, not a spend', () => {
  it("0455's void is flagged, and it is the ONLY flagged row on the entry", () => {
    const journal = row('0455', 141).journal
    expect(journal.map((r) => r.isRestoration)).toEqual([false, false, true, false])
  })

  it('🚩 the restoration RAISES what it left behind — the tell a spend never shows', () => {
    // If a reader treated the void as another spend, the branch's position on
    // screen would invert: 200.000 taken instead of 200.000 given back.
    const journal = row('0455', 141).journal
    expect(journal.map((r) => r.consumption.remainingAfter)).toEqual([600, 400, 600, 400])
    const void_ = journal[2]
    expect(void_.consumption.remainingAfter).toBeGreaterThan(
      journal[1].consumption.remainingAfter,
    )
  })
})

describe('the journal', () => {
  it('reads oldest first — the story of the entry, forward in time', () => {
    expect(row('0455', 141).journal.map((r) => r.consumption.consumedAt)).toEqual([
      '2026-08-08T19:40:00',
      '2026-08-10T20:11:00',
      '2026-08-10T20:58:00',
      '2026-08-12T18:25:00',
    ])
  })

  it('puts the void directly UNDER the receipt it voids', () => {
    const journal = row('0455', 141).journal
    expect(journal[1].consumption.documentNumber).toBe('SR-0455-0012')
    expect(journal[2].consumption.documentNumber).toBe('SR-0455-0012')
    expect(journal[2].isRestoration).toBe(true)
  })

  it('🚩 is totally ordered — two rows sharing a timestamp cannot reshuffle', () => {
    const base = account('0207').consumptions[0]
    const tied = [
      { ...base, settlementConsumptionId: 'B', consumedAt: '2026-08-11T23:04:00' },
      { ...base, settlementConsumptionId: 'A', consumedAt: '2026-08-11T23:04:00' },
    ]
    expect(journalFor(base.settlementEntryId, tied).map((r) => r.consumption.settlementConsumptionId)).toEqual(['A', 'B'])
    // …and reversing the input does not reverse the output.
    expect(journalFor(base.settlementEntryId, [...tied].reverse()).map((r) => r.consumption.settlementConsumptionId)).toEqual(['A', 'B'])
  })

  it('takes only its own entry’s rows, out of one flat cross-entry array', () => {
    // 0207 carries two entries and two consumptions, both belonging to entry 149.
    expect(row('0207', 149).journalCount).toBe(2)
    expect(row('0207', 155).journal).toEqual([])
  })

  it('a CANCELLED entry has an EMPTY journal — nothing had touched it', () => {
    expect(row('0688', 147).journal).toEqual([])
  })
})

describe('🔑 how an entry stopped being open', () => {
  it('OPEN entries have no closure at all', () => {
    expect(row('0142', 143).closure).toBeNull()
    expect(row('0142', 143).isOpen).toBe(true)
    expect(row('0142', 143).writtenOff).toBeNull()
  })

  it('a till taking the last of it reads as `consumed`', () => {
    expect(row('0207', 149)).toMatchObject({ closure: 'consumed', isOpen: false, writtenOff: null })
  })

  it('a withdrawal while untouched reads as `cancelled`', () => {
    expect(row('0688', 147)).toMatchObject({ closure: 'cancelled', isOpen: false })
  })

  it('🚩 a CANCELLED entry draws NO remaining — the wire still carries 180.000', () => {
    // The grid and the headline must not tell a reader two different things about
    // one entry: `accountHeadline` refuses to count this figure, so the Remaining
    // column refuses to draw it.
    const cancelled = row('0688', 147)
    expect(cancelled.remainingAmount).toBe(180)
    expect(cancelled.displayRemaining).toBeNull()
    // …while every other status draws exactly what the server said.
    expect(row('0688', 152).displayRemaining).toBe(95.25)
    expect(row('0688', 133).displayRemaining).toBe(0)
    expect(row('0207', 149).displayRemaining).toBe(0)
  })

  it("🚩 0688's CLOSED_OUT shows a zero remaining that NO consumption produced", () => {
    // The Proof bullet. 640.000 posted, 240.000 taken by a till, 400.000 forgiven —
    // and the 400 is the journal's own last `remainingAfter`, read back, never a
    // difference between two totals (spec D3: this screen computes no variance).
    const closedOut = row('0688', 133)
    expect(closedOut.closure).toBe('written-off')
    expect(closedOut.closure).not.toBe('consumed')
    expect(closedOut.remainingAmount).toBe(0)
    expect(closedOut.journalCount).toBe(1)
    expect(closedOut.journal[0].consumption.remainingAfter).toBe(400)
    expect(closedOut.writtenOff).toBe(400)
  })

  it('a CLOSED_OUT entry no till ever touched writes off the whole amount', () => {
    const [only] = projectAccount({
      ...account('0688'),
      entries: [{ ...account('0688').entries[0], settlementEntryId: 'untouched' }],
      consumptions: [],
    })
    expect(only.journal).toEqual([])
    expect(only.writtenOff).toBe(640)
  })
})

describe('the grid’s landing order', () => {
  it('puts open entries first, then the closed history', () => {
    expect(rowsOf('0688').map((r) => [r.entryNumber, r.isOpen])).toEqual([
      [152, true],
      [147, false],
      [133, false],
    ])
  })

  it('sorts newest posted first inside each group', () => {
    expect(rowsOf('0142').map((r) => r.entryNumber)).toEqual([151, 143, 128])
  })

  it('renders open AND closed — nothing is dropped', () => {
    for (const [code, expected] of [
      ['0142', 3],
      ['0207', 2],
      ['0331', 1],
      ['0455', 1],
      ['0512', 1],
      ['0688', 3],
    ] as const) {
      expect(rowsOf(code)).toHaveLength(expected)
    }
  })
})

describe('🔑 money survives a contract that forgot to say which currency it is in', () => {
  // ⚠️ **The rule D10 states cannot be obeyed as written, and this is the fallback.**
  // 274 found no read door carries `currencyKey` (`.afk/FINDINGS-274.md` §B6), so the
  // screen cannot draw *at the branch's own precision*. What it can do — and what
  // `settlementMoney` does — is refuse to ROUND: minimum two decimals, maximum three,
  // which is the scale the ledger's own columns hold.
  //
  // These are the regression tests for that workaround. They should be deleted, and
  // the per-currency ones above them restored, the day the reads carry a code.
  it('🚩 keeps a third decimal that carries VALUE, with no currency to read', () => {
    // The whole finding in one assertion: a Bahraini figure of 95.255 rendered at two
    // decimals is 95.26 — **a fils invented by rounding** — and nothing on the wire
    // says this branch has fils at all.
    expect(settlementMoney(95.255, '')).toBe('95.255')
    expect(formatMoneyIn(95.255, '')).toBe('95.26') // …what it would otherwise have been
  })

  it('⚠️ cannot restore a TRAILING zero, and that is the residual cost of §B6', () => {
    // 🚩 Worth stating plainly rather than discovering later: `95.250` and `95.25`
    // are the same IEEE-754 number, so *"BHD draws at three decimals"* is a display
    // convention this screen can no longer honour — only the currency code carries
    // it. What is preserved is every digit that means money; what is lost is a zero
    // that means none. The account's own figures are the ordinary case:
    expect(settlementMoney(row('0688', 152).amount, '')).toBe('95.25')
    expect(settlementMoney(row('0688', 133).writtenOff, '')).toBe('400.00')
    // …and with the code the door does not send, they read as Bahrain expects.
    expect(settlementMoney(row('0688', 152).amount, 'BHD')).toBe('95.250')
  })

  it('leaves the ordinary SAR case exactly as it was, and groups the thousands', () => {
    // The common case must not regress to please the rare one — a riyal figure still
    // reads at two decimals, because it has no third to show.
    expect(settlementMoney(row('0207', 155).amount, '')).toBe('1,240.00')
    expect(settlementMoney(row('0142', 128).amount, '')).toBe('75.50')
  })

  it('honours a currency the moment one is passed — the day §B6 lands', () => {
    // `settlementMoney` is not a replacement for the per-currency rule; it is what
    // stands in for it while the field is missing. Given a code it defers to
    // `formatMoneyIn`, so restoring the contract restores the behaviour.
    expect(settlementMoney(95.25, 'BHD')).toBe('95.250')
    expect(settlementMoney(95.25, 'SAR')).toBe('95.25')
    expect(formatMoneyIn(95.25, 'SAR')).toBe('95.25')
  })
})

describe('⚠️ an unsettled contract cannot blank the screen', () => {
  // D8's route strings and shape are 274's to confirm, and there is no ErrorBoundary
  // in this app — so a door that answers `data: null`, or the arrays under other
  // names, must produce an empty account rather than a throw inside render.
  it('survives a null envelope, a missing array and a missing entry list', () => {
    expect(projectAccount(null)).toEqual([])
    expect(projectAccount(undefined)).toEqual([])
    expect(accountHeadline(null)).toMatchObject({ signedPosition: 0, direction: 'square' })
    const half = { ...account('0142'), consumptions: undefined } as never
    expect(projectAccount(half)).toHaveLength(3)
    expect(projectAccount(half).every((r) => r.journal.length === 0)).toBe(true)
  })
})

describe('the wire’s local timestamps', () => {
  it('are the ISO local form the grid formatter reads, with no zone on them', () => {
    // ⚠️ Settlement timestamps are LOCAL wall clock (spec D6). A trailing `Z` here
    // would shift every posted-at by three hours against the branch manager's own
    // row — the exact lie D6 keeps this feature away from `UaAdminAudit`.
    for (const a of Object.values(SETTLEMENT_ACCOUNTS))
      for (const e of a.entries) expect(e.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    expect(formatDateTime(row('0142', 143).postedAt)).toBe('2026-08-09 11:14')
  })
})
