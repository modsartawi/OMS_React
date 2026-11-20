/**
 * Oms 924 — the manager's pattern doors at the `@/core/api` boundary, reconciled with BackOffice 4055 and 4056 as built
 * (`InsuranceRules/Patterns/...`): what is sent, what is refused before any call, and what of each answer is kept. Every
 * answer is read field by field, so a field nobody agreed to — above all a patient's identity — never reaches the query
 * cache or the screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatternSetting } from '@/core/models/insurance-pattern-manager'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { managerApi, SettingsNotSentError, BlockNotSentError } = await import('./manager-api')
const { draftsOf } = await import('./settings')
const { EMPTY_BLOCK } = await import('./block')

const setting = (key: string, value: number, defaultValue: number, min: number, max: number, wholeNumber: boolean) => ({
  key,
  value,
  defaultValue,
  min,
  max,
  wholeNumber,
  updatedBy: 'manager1',
  updatedAt: '2026-11-02T09:30:00',
})

/** The settings answer as BackOffice 4055 sends it: each value with its default, its range and who last set it. */
const SETTINGS_ANSWER = {
  settings: [
    setting('WindowDays', 7, 7, 1, 30, true),
    setting('MinStores', 3, 3, 2, 10, true),
    setting('MaxKmPerHour', 120, 120, 30, 500, false),
    setting('MinTravelKm', 50, 50, 1, 500, false),
    setting('OverlapShare', 0.25, 0.25, 0.05, 0.9, false),
    setting('CaseQuietDays', 30, 30, 7, 90, true),
    { ...setting('LookbackDays', 90, 90, 30, 365, true), note: 'not agreed' },
  ],
  changes: [{ key: 'WindowDays', oldValue: 5, newValue: 7, changedBy: 'manager1', changedAt: '2026-11-18T09:30:00', host: 'not agreed' }],
}

const SAVED: PatternSetting[] = SETTINGS_ANSWER.settings.map(({ key, value }) => ({ name: key, value }))

beforeEach(() => {
  api.get.mockReset().mockResolvedValue(SETTINGS_ANSWER)
  api.put.mockReset().mockResolvedValue(SETTINGS_ANSWER)
  api.post.mockReset().mockResolvedValue(null)
})

describe('the thresholds', () => {
  it('are GET InsuranceRules/Patterns/Settings, read field by field: key → name, changedBy/At → by/at; the server’s range is not kept', async () => {
    const read = await managerApi.settings()
    expect(api.get).toHaveBeenCalledWith('InsuranceRules/Patterns/Settings')
    expect(read).toEqual({
      settings: SAVED,
      changes: [{ name: 'WindowDays', oldValue: 5, newValue: 7, by: 'manager1', at: '2026-11-18T09:30:00' }],
    })
  })

  it('a save is PUT InsuranceRules/Patterns/Settings, FLAT with the changed thresholds only, answered like the GET', async () => {
    const read = await managerApi.saveSettings({ ...draftsOf(SAVED), WindowDays: '10', OverlapShare: '0.3' }, SAVED)
    expect(api.put).toHaveBeenCalledWith('InsuranceRules/Patterns/Settings', { windowDays: 10, overlapShare: 0.3 })
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
  page: 1,
  pageSize: 25,
  total: 2,
  rows: [
    {
      caseNumber: 123,
      revealedBy: 'investigator1',
      revealedAt: '2026-11-19T10:12:00',
      reason: 'Payer BUPA asked for the patient on this case.',
      fieldsShown: 'patientKey,memberId',
      patientKey: 'NI:1012345678',
      memberId: 'M-998877',
    },
    { caseNumber: 204, revealedBy: 'investigator2', revealedAt: '2026-11-18T08:00:00', reason: 'block', fieldsShown: 'patientKey', nationalId: '1012345678' },
  ],
}

describe('the reveal log', () => {
  it('is GET InsuranceRules/Patterns/Reveals with the filters, the case number as `case`, and the 1-based page', async () => {
    api.get.mockResolvedValue({ page: 2, pageSize: 25, total: 0, rows: [] })
    await managerApi.reveals({ from: '2026-11-01', to: '2026-11-19', user: 'investigator1', case: '123', page: 2, pageSize: 25 })
    expect(api.get).toHaveBeenCalledWith('InsuranceRules/Patterns/Reveals', {
      from: '2026-11-01',
      to: '2026-11-19',
      user: 'investigator1',
      case: '123',
      page: 2,
      pageSize: 25,
    })
  })

  it('keeps who revealed which case, when and why — and drops every identity field the server sent', async () => {
    api.get.mockResolvedValue(REVEALS_WITH_IDENTITY)
    const page = await managerApi.reveals({ page: 1, pageSize: 25 })
    expect(page).toEqual({
      items: [
        { caseNumber: '123', by: 'investigator1', at: '2026-11-19T10:12:00', reason: 'Payer BUPA asked for the patient on this case.' },
        { caseNumber: '204', by: 'investigator2', at: '2026-11-18T08:00:00', reason: 'block' },
      ],
      totalMatches: 2,
    })
    expect(JSON.stringify(page)).not.toMatch(/1012345678|M-998877|fieldsShown/)
  })

  it('an answer that is not the agreed shape reads as an empty log', async () => {
    api.get.mockResolvedValue('nonsense')
    expect(await managerApi.reveals({ page: 1, pageSize: 25 })).toEqual({ items: [], totalMatches: 0 })
  })
})

describe('the block', () => {
  const TODAY = '2026-11-19'

  it('is POST InsuranceRules/Patterns/Cases/{caseNumber}/Block with the body the form makes — the end as `expiresOn`', async () => {
    await managerApi.block('123', { reasonKind: 'fraud', payer: ' BUPA ', startsOn: '', endsOn: '2027-05-19' }, TODAY)
    expect(api.post).toHaveBeenCalledWith('InsuranceRules/Patterns/Cases/123/Block', { reasonKind: 'fraud', payer: 'BUPA', expiresOn: '2027-05-19' })
  })

  it('a form without its kind of finding, or with its start after its end, is refused before the call', async () => {
    await expect(managerApi.block('123', EMPTY_BLOCK, TODAY)).rejects.toBeInstanceOf(BlockNotSentError)
    await expect(managerApi.block('123', { reasonKind: 'abuse', payer: '', startsOn: '2026-12-02', endsOn: '2026-12-01' }, TODAY)).rejects.toBeInstanceOf(BlockNotSentError)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('keeps nothing of the answer: the list entry it may echo carries the patient key', async () => {
    api.post.mockResolvedValue({ key: 'NI:1012345678', reasonKind: 'fraud', reference: 'Case 123' })
    await expect(managerApi.block('123', { ...EMPTY_BLOCK, reasonKind: 'fraud' }, TODAY)).resolves.toBeUndefined()
  })

  it('trims and escapes the case number in the path', async () => {
    await managerApi.block(' 1/23 ', { ...EMPTY_BLOCK, reasonKind: 'abuse' }, TODAY)
    expect(api.post).toHaveBeenCalledWith('InsuranceRules/Patterns/Cases/1%2F23/Block', { reasonKind: 'abuse' })
  })
})
