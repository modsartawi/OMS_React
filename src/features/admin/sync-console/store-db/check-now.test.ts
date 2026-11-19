import { describe, expect, it } from 'vitest'
import type { StoreDbCheckNowAnswer } from '@/core/models/store-database'
import checkNowFixture from './__fixtures__/check-now.json'
import { checkNowBody, checkNowOutcome } from './check-now'

describe('checkNowBody', () => {
  it('sends nothing without a reason', () => {
    expect(checkNowBody('P104', '')).toBeNull()
  })

  it('sends nothing for a reason of white space only', () => {
    expect(checkNowBody('P104', '   \n\t ')).toBeNull()
  })

  it('sends the store and the reason, trimmed', () => {
    expect(checkNowBody('P104', '  helpdesk ticket 5512 \n')).toEqual({ code: 'P104', reason: 'helpdesk ticket 5512' })
  })
})

describe('the Check now answer (StoreDatabaseCheckNowAnswer: a reading result, not a store page)', () => {
  it('a reading that succeeded is told as done', () => {
    expect(checkNowOutcome(checkNowFixture as StoreDbCheckNowAnswer)).toBe('done')
  })

  it('a failed read is not a refusal: it comes back succeeded:false and is told as a failure', () => {
    expect(checkNowOutcome({ ...(checkNowFixture as StoreDbCheckNowAnswer), succeeded: false, error: 'Login timeout expired', reading: null, largestTables: [] })).toBe('failedRead')
  })
})
