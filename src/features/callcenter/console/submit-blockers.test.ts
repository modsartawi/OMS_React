/**
 * `aDeadSubmitAlwaysNamesItsReason` (ticket 173) — asserted at the module's
 * edge: a list of wire codes in, words and chip ownership out.
 *
 * 🚩 The locale file is imported and asserted against, rather than the keys
 * being eyeballed. A `t()` call with no backing key renders the raw key to the
 * agent, which is the exact failure this ticket exists to close — and it is a
 * failure no type check can see.
 */
import { describe, expect, it } from 'vitest'
import callcenter from '@/locales/en/callcenter.json'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import { headerChips } from './header-chips'
import { blockedChips, submitBlockers, UNKNOWN_BLOCKER_KEY } from './submit-blockers'

/** `blockers.NO_LINES` → the phrase, or undefined if the key does not exist. */
const phrase = (key: string): string | undefined =>
  (callcenter as unknown as Record<string, Record<string, string>>)[key.split('.')[0]]?.[
    key.split('.')[1]
  ]

/** Every code the contract names — CONTRACT.md §2/§7 and fixtures 01, 07, 09. */
const CONTRACT_CODES = [
  'NO_LINES',
  'NO_CUSTOMER',
  'NO_ADDRESS',
  // v1.3 (§2.3) — the one blocker 175 exists to raise. Absent from this list it
  // would print the *unknown blocker* phrase, which is the failure that ticket
  // was written to close.
  'STORE_NOT_CHOSEN',
  'MISSING_SLOT',
  'MISSING_SOURCE',
  'MISSING_SOURCE_REFERENCE',
  'SOURCE_REFERENCE_REQUIRED',
  'ALREADY_SUBMITTED',
]

describe('submitBlockers', () => {
  it('gives every contract code an agent-facing phrase', () => {
    for (const blocker of submitBlockers(CONTRACT_CODES)) {
      const words = phrase(blocker.key)
      expect(words, `${blocker.code} has no phrase`).toBeTruthy()
      // A phrase, not the code wearing a key's clothes.
      expect(words).not.toContain('_')
    }
  })

  it('names the chip that owns each header blocker, and only those', () => {
    // Asked one code at a time: ownership is a property of the CODE, and asking
    // the whole list at once would only prove it of the ones that survive the
    // dedupe below.
    const owner = Object.fromEntries(
      CONTRACT_CODES.map((code) => [code, submitBlockers([code])[0].chip]),
    )
    // 🚩 The store chip's own, and the reason it is here: 175 ruled this code
    // onto the contract and this client never got it, so the ONE blocker that
    // ticket exists to raise would otherwise reach the agent as the unknown
    // phrase — words, but the wrong words, on the one chip that could fix it.
    expect(owner.STORE_NOT_CHOSEN).toBe('store')
    expect(submitBlockers(['STORE_NOT_CHOSEN'])[0].key).toBe('blockers.STORE_NOT_CHOSEN')
    expect(submitBlockers(['STORE_NOT_CHOSEN'])[0].key).not.toBe(UNKNOWN_BLOCKER_KEY)
    expect(blockedChips(['STORE_NOT_CHOSEN'])).toEqual(new Set(['store']))
    expect(owner.MISSING_SLOT).toBe('slot')
    expect(owner.MISSING_SOURCE).toBe('source')
    expect(owner.MISSING_SOURCE_REFERENCE).toBe('reference')
    expect(owner.SOURCE_REFERENCE_REQUIRED).toBe('reference')
    // The basket's and the rail's are fixed elsewhere — a chip must not claim them.
    expect(owner.NO_LINES).toBeNull()
    expect(owner.NO_CUSTOMER).toBeNull()
    expect(owner.NO_ADDRESS).toBeNull()
    expect(owner.ALREADY_SUBMITTED).toBeNull()
  })

  it('answers an unrecognised code with words rather than the raw code', () => {
    // §9 — an additive server change ships server-first, so this is an ordinary
    // wire state. What it must never be is a machine code on the agent's screen.
    const [blocker] = submitBlockers(['MISSING_PAYMENT_TYPE'])
    expect(blocker.key).toBe(UNKNOWN_BLOCKER_KEY)
    expect(phrase(blocker.key)).toBeTruthy()
    expect(blocker.chip).toBeNull()
    // The code survives for the log and the drive, never for the eye.
    expect(blocker.code).toBe('MISSING_PAYMENT_TYPE')
  })

  it('says one fact once, however many codes carry it', () => {
    const blockers = submitBlockers(['MISSING_SOURCE_REFERENCE', 'SOURCE_REFERENCE_REQUIRED'])
    expect(blockers).toHaveLength(1)
    // On the FIRST occurrence — the server's order is not re-sorted.
    expect(blockers[0].code).toBe('MISSING_SOURCE_REFERENCE')
    // 🚩 Two unknown codes are one sentence too — they would print identical
    // words, and saying them twice tells the agent strictly less. Nothing
    // RECOGNISED is ever collapsed away: each of those keeps its own phrase.
    expect(submitBlockers(['A_NEW_RULE', 'ANOTHER_NEW_RULE'])).toHaveLength(1)
    expect(submitBlockers(['MISSING_SLOT', 'MISSING_SOURCE'])).toHaveLength(2)
  })

  it('leaves submit live when the list is empty, absent, or nonsense', () => {
    expect(submitBlockers([])).toEqual([])
    expect(submitBlockers(null)).toEqual([])
    expect(submitBlockers(undefined)).toEqual([])
    expect(blockedChips([]).size).toBe(0)
  })

  it('keeps the server’s own order', () => {
    const codes = ['MISSING_SOURCE', 'NO_LINES', 'MISSING_SLOT']
    expect(submitBlockers(codes).map((b) => b.code)).toEqual(codes)
  })

  it('marks exactly the chips the receipt names — one table, two surfaces', () => {
    // 🚩 US22: a chip that still needs something must LOOK like it does, off the
    // same list the receipt reads. Two tables would eventually disagree, and the
    // agent would find out at submit.
    const codes = ['NO_LINES', 'MISSING_SLOT', 'SOURCE_REFERENCE_REQUIRED', 'MISSING_PAYMENT_TYPE']
    const named = new Set(submitBlockers(codes).map((b) => b.chip).filter(Boolean))
    expect(blockedChips(codes)).toEqual(named)

    const chips = headerChips(EMPTY_SESSION.header, {
      ...EMPTY_SESSION.capabilities,
      submitBlockers: codes,
    })
    expect(chips.filter((c) => c.state === 'needsAttention').map((c) => c.id)).toEqual([
      'slot',
      'reference',
    ])
  })
})
