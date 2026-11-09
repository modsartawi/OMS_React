import { describe, expect, it } from 'vitest'
import { INSURANCE_RULES_FLAGS } from '../src/core/insurance-rules/access'
import { INSURANCE_RULES_FLAGS_852, granted852 } from './access-852-grants.mjs'

describe('the drives’ 852 grant stub', () => {
  it('names exactly the app’s insurance flags, so an all-granted answer shows every leaf', () => {
    expect(INSURANCE_RULES_FLAGS_852).toEqual([...INSURANCE_RULES_FLAGS])
  })
  it('answers only the three probes', () => {
    expect(granted852('Rules/Access')).toMatchObject({ canAuthor: true, canSwitchEngine: true })
    expect(granted852('Notifications/Access')).toBeNull()
  })
})
