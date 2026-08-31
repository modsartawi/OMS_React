/**
 * The member commands' two rulings (ticket 303, spec 301).
 *
 * Both are decisions an analyst's audit trail depends on, and neither is
 * reachable from JSX while React Testing Library is unbootstrapped — which is
 * exactly why they live in a pure module and are pinned here.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { LoyBlockedReasonPayload, LoyMember } from '@/core/models/loy'
import {
  commandRefusalKey,
  selectableBlockedReasons,
  statusCommand,
} from './member-commands'

/** A row as the door hands one over, built from the fields a scenario cares
 *  about. The cast is the point: the shapes worth testing are the ones the type
 *  forbids, and every one of them is a shape a real projection can emit. */
const row = (fields: Record<string, unknown>) => fields as unknown as LoyBlockedReasonPayload

const member = (blockedReasonCode: string | null) =>
  ({ blockedReasonCode }) as unknown as LoyMember

describe('aSystemReasonCannotReachTheSelectableList', () => {
  it('keeps the reasons a person may pick, with the server’s own words', () => {
    expect(
      selectableBlockedReasons([
        row({ code: 'CM', description: 'Mobile moved to another account', systemReason: false }),
        row({ code: 'IA', description: 'Inactive', systemReason: false }),
      ]),
    ).toEqual([
      { code: 'CM', description: 'Mobile moved to another account' },
      { code: 'IA', description: 'Inactive' },
    ])
  })

  it('🚩 drops the removal reason — it is a STATE, never a choice', () => {
    const offered = selectableBlockedReasons([
      row({ code: 'CM', description: 'Mobile moved to another account', systemReason: false }),
      row({ code: 'CR', description: 'Removed at customer request', systemReason: true }),
    ])
    expect(offered.map((r) => r.code)).toEqual(['CM'])
    // Said twice on purpose: the code that must never be offerable is the whole
    // reason this projection exists.
    expect(offered.some((r) => r.code === 'CR')).toBe(false)
  })

  it('🚩 treats ANYTHING truthy as a system reason — the looseness is inverted from 302’s', () => {
    // Dropping too much is the safe error here (a short picker), where in 302 it
    // was the opposite (a PII surface left open). So `1`, `'Y'` and even the
    // string `'false'` a careless projection might emit all withhold the row.
    const loose = [
      row({ code: 'A1', description: 'one', systemReason: 1 }),
      row({ code: 'A2', description: 'two', systemReason: 'Y' }),
      row({ code: 'A3', description: 'three', systemReason: 'false' }),
      row({ code: 'A4', description: 'four', systemReason: {} }),
    ]
    expect(selectableBlockedReasons(loose)).toEqual([])
  })

  it('keeps a row whose flag is ABSENT — the door’s own filter is the first line', () => {
    // A door that filtered server-side and did not project the flag must not
    // leave the analyst with an empty picker and no way to block anyone.
    expect(selectableBlockedReasons([row({ code: 'CM', description: 'Moved' })])).toEqual([
      { code: 'CM', description: 'Moved' },
    ])
    expect(
      selectableBlockedReasons([row({ code: 'CM', description: 'Moved', systemReason: null })]),
    ).toHaveLength(1)
  })

  it('drops a row with no usable code, whatever its flag says', () => {
    expect(
      selectableBlockedReasons([
        row({ code: '', description: 'blank', systemReason: false }),
        row({ code: '   ', description: 'padded', systemReason: false }),
        row({ code: null, description: 'absent', systemReason: false }),
      ]),
    ).toEqual([])
  })

  it('trims the code and reads a blank description as absent, never as empty words', () => {
    expect(selectableBlockedReasons([row({ code: ' CM ', description: '   ' })])).toEqual([
      { code: 'CM', description: null },
    ])
  })

  it('🚩 an empty answer is an empty LIST, never a failure', () => {
    expect(selectableBlockedReasons([])).toEqual([])
    expect(selectableBlockedReasons(null)).toEqual([])
    expect(selectableBlockedReasons(undefined)).toEqual([])
  })
})

describe('theStatusControlOffersTheCommandThatAppliesToThisMember', () => {
  it('offers Block to a member who is not blocked', () => {
    expect(statusCommand(member(null))).toBe('block')
  })

  it('offers Unblock to a member who is', () => {
    expect(statusCommand(member('CM'))).toBe('unblock')
    expect(statusCommand(member('IA'))).toBe('unblock')
    // Including an unseeded code: the member is blocked because a reason is
    // recorded, not because we recognise which one.
    expect(statusCommand(member('XZ'))).toBe('unblock')
  })

  it('🚩 reads a BLANK reason as not blocked — including a padded one', () => {
    // `blockedReasonCode` arrives from a `char`-backed column, so `'  '` is a
    // member with no block. Reading it as blocked would offer Unblock to a
    // member with nothing to unblock.
    for (const blank of ['', ' ', '   ', '\t']) {
      expect(statusCommand(member(blank))).toBe('block')
    }
  })

  it('offers exactly one command for every input — never both, never neither', () => {
    for (const code of [null, '', '  ', 'CM', 'IA', 'XZ', 'CR']) {
      expect(['block', 'unblock']).toContain(statusCommand(member(code)))
    }
  })
})

describe('commandRefusalKey — the codes the screen recognises by name', () => {
  const refusal = (code: string) =>
    new ApiError('business', 'server sentence', 400, [{ errorCode: code, errorMessage: '', internalErrorCode: '' }])

  it('names the two refusals this command can meet', () => {
    expect(commandRefusalKey(refusal('LOY-00100'))).toBe('command.refusal.noSuchMember')
    // `MemberBlockedReasonNoExists`, read off the shipped door. It sits far
    // outside the member block the guessed code assumed, which is exactly why
    // guessing could not have landed it.
    expect(commandRefusalKey(refusal('LOY-00453'))).toBe(
      'command.refusal.invalidBlockedReason',
    )
  })

  it('🚩 the retired GUESSES are not recognised — the reconciliation is one-way', () => {
    // The whole `LOY-001xx` block was invented while the backend half was
    // unnumbered, and every one of these was wrong. Leaving them behind
    // "just in case" would be worse than removing them: the screen would put
    // confident wording in front of a refusal it had not actually met, and the
    // next reader would take the block for something the server answers with.
    //
    // ⚠ MUTATION CHECK: restoring any retired code to `REFUSAL_KEYS` turns
    // this red.
    for (const retired of [
      'LOY-00105',
      'LOY-00106',
      'LOY-00107',
      'LOY-00108',
      'LOY-00109',
      'LOY-00110',
      'LOY-00111',
    ]) {
      expect(commandRefusalKey(refusal(retired))).toBeNull()
    }
  })

  it('🚩 returns null for a code it does not know — the server’s sentence still speaks', () => {
    // The wrong-guess cost is the screen's extra wording and nothing else: the
    // caller pairs this with `apiErrorMessage`, so an unrecognised refusal is
    // still explained rather than flattened.
    expect(commandRefusalKey(refusal('LOY-99999'))).toBeNull()
    // 🚩 Including the names every object literal inherits. A server answering
    // `constructor` would otherwise reach `Object.prototype`, survive a `?? null`
    // and be handed to `t()` as a translation key.
    for (const inherited of ['constructor', 'toString', 'valueOf', '__proto__'])
      expect(commandRefusalKey(refusal(inherited))).toBeNull()
    expect(commandRefusalKey(new Error('a bare transport failure'))).toBeNull()
    expect(commandRefusalKey(null)).toBeNull()
  })
})
