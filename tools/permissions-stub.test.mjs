import { describe, expect, it } from 'vitest'
import { SCREEN_KEYS } from '../src/core/permissions'
import { INSURANCE_RULES_GRANTS } from '../src/core/insurance-rules/access'
import { ALL_SCREENS, FLAG_KEYS, GRANTED_852, flagKeys, permissionsBody } from './permissions-stub.mjs'

describe('the drives’ Auth/Permissions stub', () => {
  it('reads every two-field key from SCREEN_KEYS', () => {
    expect([...ALL_SCREENS]).toEqual([...SCREEN_KEYS])
  })

  it('names only keys the app reads', () => {
    const known = new Set(SCREEN_KEYS)
    const named = [...GRANTED_852, ...Object.values(FLAG_KEYS).flatMap((area) => Object.values(area).flat())]
    expect(named.filter((k) => !known.has(k))).toEqual([])
  })

  it('maps the Insurance rules flags exactly as the app does', () => {
    for (const [flag, key] of Object.entries(INSURANCE_RULES_GRANTS)) expect(FLAG_KEYS.InsuranceRules[flag]).toEqual([key])
    expect(Object.keys(FLAG_KEYS.InsuranceRules).sort()).toEqual(Object.keys(INSURANCE_RULES_GRANTS).sort())
  })

  it('grants every Insurance rules leaf in the 852 set', () => {
    expect(Object.values(INSURANCE_RULES_GRANTS).filter((k) => !GRANTED_852.includes(k))).toEqual([])
  })

  it('maps a combination to every key it needs, and a false flag to none', () => {
    expect(flagKeys('BbyMaintain', { screenAllowed: false, canTest: true })).toEqual(['BbyMaintain:03', 'BbyMaintain:04'])
    expect(flagKeys('Oms', { canOpenList: false })).toEqual([])
  })

  it('answers the wrapped shape, sorted and unique', () => {
    const body = permissionsBody({ 'DocumentList:03': true, 'CallCenter:03': true, 'Copilot:01': false })
    expect(body.success).toBe(true)
    expect(body.data.screens).toEqual(['CallCenter:03', 'DocumentList:03'])
    expect(body.data.version).toMatch(/^[0-9a-f]{32}$/)
    expect(Object.keys(body.data.extras).sort()).toEqual(
      ['canManageRoles', 'canManageUsers', 'fileServerReady', 'notificationCenterOn', 'nphiesContractVersion'],
    )
  })
})
