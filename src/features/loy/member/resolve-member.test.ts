/**
 * `resolveMember` — ticket 233's pure Proof bullet, and the wave's biggest
 * unknown retired at the only seam that can prove it while the `LoyWeb` door
 * does not exist (spec 231 §3, decision 225).
 *
 * Typed text in, a decision out. Nothing here knows what the field looks like or
 * which hook fired: the assertions are about what reaches the server and how the
 * two answers compose — which is the only place the cascade is either correct or
 * a lie about a shut door.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import { compact, resolveMember, type MemberReads } from './resolve-member'

const MEMBER: LoyMember = {
  loyId: '100001293',
  mobileCountry: 'SA',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbi',
  birthDate: '1990-11-08T00:00:00',
  gender: 'F',
  email: 'nouf.h@example.com',
  nationality: 'SA',
  nationalId: '1098443217',
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: 'AR',
  joinDate: '2021-03-14T00:00:00',
  lastUpdate: '2026-07-31T09:12:00',
  tier: 'G',
  tierPointsBalance: 8940,
  pendingPoints: 320,
  pointsBalance: 12480,
  pointsBalanceAmount: 561,
  pointsBalanceAmountCurrency: 'SAR',
  pointsExpireSoon: 1200,
  memberType: 'M',
  blockedReasonCode: null,
}

/** A business refusal exactly as `core/api.ts` builds one off the envelope. */
const business = (code: string, message: string) =>
  new ApiError('business', message, 400, [
    { errorCode: code, errorMessage: message, internalErrorCode: '' },
  ])

const NOT_FOUND_BY_MOBILE = () =>
  business('LOY-00100', "Customer with 966555000111 doesn't exists")
const NOT_FOUND_BY_LOYID = () => business('LOY-00100', "Customer 966555000111 doesn't exists")

/**
 * A stubbed pair of reads that records every key it was asked for, so "one call"
 * and "two calls" are assertable facts rather than an assumption.
 */
function reads(
  byMobile: (key: string) => Promise<LoyMember>,
  byLoyId: (key: string) => Promise<LoyMember>,
) {
  const calls: string[] = []
  const spy: MemberReads = {
    byMobile: (key) => {
      calls.push(`byMobile:${key}`)
      return byMobile(key)
    },
    byLoyId: (key) => {
      calls.push(`byLoyId:${key}`)
      return byLoyId(key)
    },
  }
  return { calls, spy }
}

const hit = async () => MEMBER
const miss = (err: () => ApiError) => async () => {
  throw err()
}

describe('compact', () => {
  it('strips whitespace, dashes, parens and a leading + — and nothing else', () => {
    // 🚩 Compaction is NOT normalisation. No dialling code, no PadLeft, no
    // country rule: the rule that builds the loyalty base's key is server-side
    // (225 ruling 4), and a second spelling of it here is how the two drift.
    expect(compact('+966 55 500 0111')).toBe('966555000111')
    expect(compact('  0555-000-111 ')).toBe('0555000111')
    expect(compact('(966) 555 000 111')).toBe('966555000111')
    expect(compact('100001293')).toBe('100001293')
    // A leading 0 survives, because prefixing is not ours to do.
    expect(compact('0555000111')).toBe('0555000111')
  })
})

describe('resolveMember', () => {
  it('a blank submit is silent — no call, no message', async () => {
    const { calls, spy } = reads(hit, hit)
    expect(await resolveMember('', spy)).toEqual({ kind: 'noop' })
    expect(await resolveMember('   ', spy)).toEqual({ kind: 'noop' })
    expect(calls).toEqual([])
  })

  it('a mobile hit takes ONE call, on the compacted key', async () => {
    const { calls, spy } = reads(hit, miss(NOT_FOUND_BY_LOYID))
    const result = await resolveMember('+966 55 500 0111', spy)
    expect(result).toEqual({ kind: 'member', member: MEMBER })
    expect(calls).toEqual(['byMobile:966555000111'])
  })

  it('LOY-00100 on the mobile retries the SAME text as a Loy ID', async () => {
    const { calls, spy } = reads(miss(NOT_FOUND_BY_MOBILE), hit)
    const result = await resolveMember('100001293', spy)
    expect(result).toEqual({ kind: 'member', member: MEMBER })
    expect(calls).toEqual(['byMobile:100001293', 'byLoyId:100001293'])
  })

  it('a double miss is a noMatch carrying what was TYPED, not the compacted key', async () => {
    // The sentence the agent reads names what they typed — the box is never
    // rewritten (225 ruling 5), so neither is the sentence about it.
    const { calls, spy } = reads(miss(NOT_FOUND_BY_MOBILE), miss(NOT_FOUND_BY_LOYID))
    const result = await resolveMember('0555 000 999', spy)
    expect(result).toEqual({ kind: 'noMatch', typed: '0555 000 999' })
    expect(calls).toEqual(['byMobile:0555000999', 'byLoyId:0555000999'])
  })

  it('🚩 a 403 propagates — a shut door never reads as "no member matches"', async () => {
    // 224: an ungranted portal call gets a BARE 403. Cascading on it would
    // double the load on a door that refused us and tell the agent to re-read a
    // number that was correct.
    const refusal = new ApiError('unknown', 'Forbidden', 403)
    const { calls, spy } = reads(
      async () => {
        throw refusal
      },
      hit,
    )
    await expect(resolveMember('0555000111', spy)).rejects.toBe(refusal)
    expect(calls).toEqual(['byMobile:0555000111'])
  })

  it('🚩 a 500 propagates and is never a second call', async () => {
    const down = new ApiError('server', 'Something went wrong.', 500)
    const { calls, spy } = reads(
      async () => {
        throw down
      },
      hit,
    )
    await expect(resolveMember('0555000111', spy)).rejects.toBe(down)
    expect(calls).toEqual(['byMobile:0555000111'])
  })

  it('🚩 a network failure propagates and is never a second call', async () => {
    const offline = new ApiError('network', 'Could not reach the server.', 0)
    const { calls, spy } = reads(
      async () => {
        throw offline
      },
      hit,
    )
    await expect(resolveMember('0555000111', spy)).rejects.toBe(offline)
    expect(calls).toEqual(['byMobile:0555000111'])
  })

  it('another BUSINESS code on the mobile stops and shows itself', async () => {
    // Only LOY-00100 cascades. A different refusal is the server saying
    // something specific about the call that was made, and it is not an absence.
    const other = business('LOY-00999', 'Loyalty is closed for end-of-day.')
    const { calls, spy } = reads(
      async () => {
        throw other
      },
      hit,
    )
    await expect(resolveMember('0555000111', spy)).rejects.toBe(other)
    expect(calls).toEqual(['byMobile:0555000111'])
  })

  it('a non-LOY-00100 refusal on the SECOND call propagates too', async () => {
    const other = business('LOY-00999', 'Loyalty is closed for end-of-day.')
    const { calls, spy } = reads(miss(NOT_FOUND_BY_MOBILE), async () => {
      throw other
    })
    await expect(resolveMember('100001293', spy)).rejects.toBe(other)
    expect(calls).toEqual(['byMobile:100001293', 'byLoyId:100001293'])
  })

  it('🚩 LOY-00101 on the Loy ID is the archived guard, never a no-match', async () => {
    // Expected UNREACHABLE in production: 230's amendment drops the archived
    // refusal from the `LoyWeb` LoyId read. This case exists to say so, and to
    // keep the screen correct if the door ships before the amendment does.
    const { calls, spy } = reads(
      miss(NOT_FOUND_BY_MOBILE),
      miss(() => business('LOY-00101', 'Customer 100001293 archived')),
    )
    expect(await resolveMember('100001293', spy)).toEqual({
      kind: 'archivedRefusal',
      key: '100001293',
    })
    expect(calls).toEqual(['byMobile:100001293', 'byLoyId:100001293'])
  })

  it('🚩 LOY-00101 on the MOBILE stops there — it is not a miss, so it never cascades', async () => {
    // `MemberByMobile` has no archived check today, so this is doubly defensive;
    // what matters is that the one code that cascades is the one that means
    // "no such member".
    const archived = business('LOY-00101', 'Customer 100001293 archived')
    const { calls, spy } = reads(
      async () => {
        throw archived
      },
      hit,
    )
    await expect(resolveMember('0555000111', spy)).rejects.toBe(archived)
    expect(calls).toEqual(['byMobile:0555000111'])
  })
})
