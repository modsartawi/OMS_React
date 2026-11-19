/**
 * Oms 924 — the manager's pattern doors at the `@/core/api` boundary (BackOffice 4055, 4056; GUESSED shapes): what is
 * sent, what is refused before any call, and what of each answer is kept. Every answer is read field by field, so a
 * field nobody agreed to — above all a patient's identity — never reaches the query cache or the screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatternSetting } from '@/core/models/insurance-pattern-manager'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { managerApi, SettingsNotSentError, BlockNotSentError } = await import('./manager-api')
const { draftsOf } = await import('./settings')
const { EMPTY_BLOCK } = await import('./block')

/** The settings answer as the server might send it: each value with its own min and max, and a field nobody agreed to. */
const SETTINGS_ANSWER = {
  settings: [
    { name: 'WindowDays', value: 7, min: 1, max: 30 },
    { name: 'MinStores', value: 3, min: 2, max: 10 },
    { name: 'MaxKmPerHour', value: 120, min: 30, max: 500 },
    { name: 'MinTravelKm', value: 50, min: 1, max: 500 },
    { name: 'OverlapShare', value: 0.25, min: 0.05, max: 0.9 },
    { name: 'CaseQuietDays', value: 30, min: 7, max: 90 },
    { name: 'LookbackDays', value: 90, min: 30, max: 365, note: 'not agreed' },
  ],
  changes: [{ name: 'WindowDays', oldValue: 5, newValue: 7, by: 'manager1', at: '2026-11-18T09:30:00', host: 'not agreed' }],
}

const SAVED: PatternSetting[] = SETTINGS_ANSWER.settings.map(({ name, value }) => ({ name, value }))

beforeEach(() => {
  api.get.mockReset().mockResolvedValue(SETTINGS_ANSWER)
  api.put.mockReset().mockResolvedValue(SETTINGS_ANSWER)
  api.post.mockReset().mockResolvedValue(null)
})

describe('the thresholds', () => {
  it('are GET Insurance/Patterns/Settings, read field by field: the server’s min and max are not kept', async () => {
    const read = await managerApi.settings()
    expect(api.get).toHaveBeenCalledWith('Insurance/Patterns/Settings')
    expect(read).toEqual({
      settings: SAVED,
      changes: [{ name: 'WindowDays', oldValue: 5, newValue: 7, by: 'manager1', at: '2026-11-18T09:30:00' }],
    })
  })

  it('a save is PUT Insurance/Patterns/Settings with the changed thresholds, answered like the GET', async () => {
    const read = await managerApi.saveSettings({ ...draftsOf(SAVED), WindowDays: '10' }, SAVED)
    expect(api.put).toHaveBeenCalledWith('Insurance/Patterns/Settings', { settings: [{ name: 'WindowDays', value: 10 }] })
    expect(read.settings).toEqual(SAVED)
  })

  it.each([
    ['WindowDays', '31'],
    ['MinStores', '1'],
    ['OverlapShare', '0.91'],
    ['LookbackDays', '29'],
  ] as const)('%s = %s is refused before the call: no PUT is made', async (name, typed) => {
    await expect(managerApi.saveSettings({ ...draftsOf(SAVED), WindowDays: '10', [name]: typed }, SAVED)).rejects.toBeInstanceOf(SettingsNotSentError)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('nothing changed: no PUT is made', async () => {
    await expect(managerApi.saveSettings(draftsOf(SAVED), SAVED)).rejects.toBeInstanceOf(SettingsNotSentError)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('an answer that is not the agreed shape reads as no thresholds and no changes', async () => {
    api.get.mockResolvedValue(null)
    expect(await managerApi.settings()).toEqual({ settings: [], changes: [] })
  })
})

/** A reveal-log answer as a careless server might send it: the revealed identity beside each row. */
const REVEALS_WITH_IDENTITY = {
  items: [
    {
      caseId: '01JD3K7Q2WPC0123',
      caseNumber: 'PC-000123',
      by: 'investigator1',
      at: '2026-11-19T10:12:00',
      reason: 'Payer BUPA asked for the patient on this case.',
      patientKey: 'NI:1012345678',
      memberId: 'M-998877',
      fields: ['patientKey', 'memberId'],
    },
    { caseId: '01JGEN0004', caseNumber: 'PC-000204', by: 'investigator2', at: '2026-11-18T08:00:00', reason: 'block', nationalId: '1012345678' },
  ],
  totalMatches: 2,
}

describe('the reveal log', () => {
  it('is GET Insurance/Patterns/Reveals with the filters and the page as query parameters', async () => {
    api.get.mockResolvedValue({ items: [], totalMatches: 0 })
    await managerApi.reveals({ from: '2026-11-01', to: '2026-11-19', user: 'investigator1', caseId: '01JD3K7Q2WPC0123', skip: 25, take: 25 })
    expect(api.get).toHaveBeenCalledWith('Insurance/Patterns/Reveals', {
      from: '2026-11-01',
      to: '2026-11-19',
      user: 'investigator1',
      caseId: '01JD3K7Q2WPC0123',
      skip: 25,
      take: 25,
    })
  })

  it('keeps who revealed which case, when and why — and drops every identity field the server sent', async () => {
    api.get.mockResolvedValue(REVEALS_WITH_IDENTITY)
    const page = await managerApi.reveals({ skip: 0, take: 25 })
    expect(page).toEqual({
      items: [
        { caseId: '01JD3K7Q2WPC0123', caseNumber: 'PC-000123', by: 'investigator1', at: '2026-11-19T10:12:00', reason: 'Payer BUPA asked for the patient on this case.' },
        { caseId: '01JGEN0004', caseNumber: 'PC-000204', by: 'investigator2', at: '2026-11-18T08:00:00', reason: 'block' },
      ],
      totalMatches: 2,
    })
    expect(JSON.stringify(page)).not.toMatch(/1012345678|M-998877/)
  })

  it('an answer that is not the agreed shape reads as an empty log', async () => {
    api.get.mockResolvedValue('nonsense')
    expect(await managerApi.reveals({ skip: 0, take: 25 })).toEqual({ items: [], totalMatches: 0 })
  })
})

describe('the block', () => {
  const TODAY = '2026-11-19'

  it('is POST Insurance/Patterns/Cases/{caseId}/Block with the body the form makes', async () => {
    await managerApi.block('01JD3K7Q2WPC0123', { reasonKind: 'fraud', payer: ' BUPA ', startsOn: '', endsOn: '2027-05-19' }, TODAY)
    expect(api.post).toHaveBeenCalledWith('Insurance/Patterns/Cases/01JD3K7Q2WPC0123/Block', { reasonKind: 'fraud', payer: 'BUPA', endsOn: '2027-05-19' })
  })

  it('a form without its kind of finding, or with its start after its end, is refused before the call', async () => {
    await expect(managerApi.block('01JD3K7Q2WPC0123', EMPTY_BLOCK, TODAY)).rejects.toBeInstanceOf(BlockNotSentError)
    await expect(
      managerApi.block('01JD3K7Q2WPC0123', { reasonKind: 'abuse', payer: '', startsOn: '2026-12-02', endsOn: '2026-12-01' }, TODAY),
    ).rejects.toBeInstanceOf(BlockNotSentError)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('keeps nothing of the answer: the list entry it may echo carries the patient key', async () => {
    api.post.mockResolvedValue({ key: 'NI:1012345678', reasonKind: 'fraud', reference: 'Case PC-000123' })
    await expect(managerApi.block('01JD3K7Q2WPC0123', { ...EMPTY_BLOCK, reasonKind: 'fraud' }, TODAY)).resolves.toBeUndefined()
  })

  it('escapes the case id in the path', async () => {
    await managerApi.block(' 01J/D3 ', { ...EMPTY_BLOCK, reasonKind: 'abuse' }, TODAY)
    expect(api.post).toHaveBeenCalledWith('Insurance/Patterns/Cases/01J%2FD3/Block', { reasonKind: 'abuse' })
  })
})
