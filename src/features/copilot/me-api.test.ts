import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import type { MePage } from './me'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())

vi.mock('@/core/api', async (actual) => ({
  ...(await actual<typeof import('@/core/api')>()),
  api: { get, post },
}))

const { COPILOT_ME_KEY, copilotMeApi, meActions, meEntryVisible, meFeatureOff, meQuery } = await import('./me-api')

const label = (en: string) => ({ en, ar: `${en} (ar)` })
const PERIODS = [
  { value: 'last-7-days', label: label('The last 7 days') },
  { value: 'last-month', label: label('Last month') },
]
const period = (value: string, keptBy = 'offer') => ({
  kind: 'period',
  value,
  label: label(value),
  unused: false,
  choices: PERIODS,
  keptAt: '2026-11-12T09:30:00',
  keptBy,
})
const scope = { ...period('ksa'), kind: 'scope', choices: [{ value: 'ksa', label: label('Saudi Arabia') }] }
const SET_ID = '01JCSET00000000000000000001'
const member = (key: string, gone = false) => ({ key, kind: 'store', label: label(key), gone })
const mySet = (keys: string[]) => ({
  setId: SET_ID,
  name: 'my stores',
  kind: 'store',
  members: keys.map((k) => member(k)),
  gone: 0,
  keptAt: '2026-11-12T09:31:00',
  keptBy: 'offer',
})
const ME = {
  readings: [period('last-7-days'), scope],
  sets: [mySet(['store:S101'])],
  limits: { maxSets: 10, maxMembers: 200, maxName: 40 },
}

const refusal = (code: string) =>
  new ApiError('business', `Refused ${code}.`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: `Refused ${code}.` }])

let qc: QueryClient
const drawn = () => qc.getQueryData<MePage>(COPILOT_ME_KEY)!

beforeEach(async () => {
  get.mockReset()
  post.mockReset()
  get.mockResolvedValue(ME)
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await qc.fetchQuery(meQuery())
})

describe('the page "What the copilot knows about me" calls its doors and redraws (ticket 894, BackOffice 3689)', () => {
  it('readsThePageFromGetCopilotMe', () => {
    expect(get).toHaveBeenCalledWith('Copilot/Me')
    expect(drawn().readings.map((r) => r.kind)).toEqual(['period', 'scope'])
    expect(drawn().sets[0].members.map((m) => m.key)).toEqual(['store:S101'])
  })

  it('changeReading_postsKindAndValue_andTheReadingIsRedrawnFromTheAnswer', async () => {
    post.mockResolvedValueOnce(period('last-month', 'page'))
    await meActions(qc).changeReading('period', 'last-month')
    expect(post).toHaveBeenCalledWith('Copilot/Me/Readings', { kind: 'period', value: 'last-month' })
    expect(drawn().readings.map((r) => [r.kind, r.value, r.keptBy])).toEqual([
      ['period', 'last-month', 'page'],
      ['scope', 'ksa', 'offer'],
    ])
  })

  it('deleteReading_postsTheKind_andTheReadingLeavesThePage_evenWhenAlreadyGone', async () => {
    post.mockResolvedValueOnce({ deleted: false })
    await meActions(qc).deleteReading('period')
    expect(post).toHaveBeenCalledWith('Copilot/Me/Readings/Delete', { kind: 'period' })
    expect(drawn().readings.map((r) => r.kind)).toEqual(['scope'])
  })

  it('editSet_postsTheMembersInOrder_andTheSetIsRedrawnFromTheAnswer', async () => {
    post.mockResolvedValueOnce(mySet(['store:S101', 'store:S102']))
    await meActions(qc).editSet({ setId: SET_ID, members: ['store:S101', 'store:S102'] })
    expect(post).toHaveBeenCalledWith('Copilot/Me/Sets', { setId: SET_ID, members: ['store:S101', 'store:S102'] })
    expect(drawn().sets[0].members.map((m) => m.key)).toEqual(['store:S101', 'store:S102'])
  })

  it('deleteSet_postsTheSetId_andTheSetLeavesThePage', async () => {
    post.mockResolvedValueOnce({ deleted: true })
    await meActions(qc).deleteSet(SET_ID)
    expect(post).toHaveBeenCalledWith('Copilot/Me/Sets/Delete', { setId: SET_ID })
    expect(drawn().sets).toEqual([])
  })

  it('forgetEverything_postsWithNoBody_andThePageIsEmpty', async () => {
    post.mockResolvedValueOnce({ removed: 3 })
    expect(await meActions(qc).forget()).toBe(3)
    expect(post).toHaveBeenCalledWith('Copilot/Me/Forget', undefined)
    expect(drawn().readings).toEqual([])
    expect(drawn().sets).toEqual([])
    expect(drawn().empty).toBe(true)
  })

  it('aRefusedChange_leavesThePageAsItWas', async () => {
    post.mockRejectedValueOnce(refusal('COPILOT-433'))
    await expect(meActions(qc).editSet({ setId: SET_ID, members: ['store:S999'] })).rejects.toBeInstanceOf(ApiError)
    expect(drawn().sets[0].members.map((m) => m.key)).toEqual(['store:S101'])
  })

  it('lookup_getsTheNameLookupWithTheText', async () => {
    get.mockResolvedValueOnce({ text: 'Jeddah', matches: [{ key: 'city:Jeddah', kind: 'city', label: label('Jeddah'), gone: false }, { key: '' }] })
    const found = await copilotMeApi.lookup('Jeddah')
    expect(get).toHaveBeenLastCalledWith('Copilot/Me/Lookup', { text: 'Jeddah' })
    expect(found.map((m) => m.key)).toEqual(['city:Jeddah'])
  })

  it('aFourThirtyOnGetCopilotMeIsFeatureOff_andHidesTheEntry', async () => {
    expect(meFeatureOff(refusal('COPILOT-430'))).toBe(true)
    expect(meFeatureOff(refusal('COPILOT-401'))).toBe(false)
    expect(meFeatureOff(new Error('x'))).toBe(false)
    // The entry shows only on a page read: off, no grant, failed or pending all hide it.
    expect(meEntryVisible({ isSuccess: true })).toBe(true)
    expect(meEntryVisible({ isSuccess: false })).toBe(false)
  })
})
