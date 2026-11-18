/**
 * BackOffice spec 3972, ticket 3981 — the Rule hits page: the month's guard rule hits, filtered, and their Excel
 * download (door 3980: `GET InsuranceRules/RuleHits` + `…/RuleHits/Excel`). React Testing Library is not installed
 * (oms CLAUDE.md), so the page is proven at its pure address (`./query`), its doors (`./api`, the network stubbed at
 * `@/core/api`) and the real menu (`resolveMenu` over `MENU`).
 */
import { describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), blob: vi.fn(), postJsonBlob: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

// Imported once, at the top: the real menu pulls every area's module graph, too slow to load inside a test.
const { readRuleHitsQuery, writeRuleHitsQuery } = await import('./query')
const { ruleHitsApi, ruleHitsFileName } = await import('./api')
const { MENU } = await import('@/layout/menu-model')
const { resolveMenu } = await import('@/layout/useVisibleMenu')
const { permissionsOf } = await import('@/core/permissions')

const TODAY = '2026-11-16'
const read = (qs: string) => readRuleHitsQuery(new URLSearchParams(qs), TODAY)

describe('3981 — the Rule hits page', () => {
  it('RuleHitsPage_DefaultsToLastMonthLive', () => {
    expect(read('')).toEqual({ from: '2026-10-01', to: '2026-10-31', rule: '', payer: '', store: '', kind: 'live' })
    // January's last month is the year before's December.
    expect(readRuleHitsQuery(new URLSearchParams(''), '2027-01-09')).toMatchObject({ from: '2026-12-01', to: '2026-12-31', kind: 'live' })
    // An unknown kind falls back to live; the bare address stays bare.
    expect(read('kind=both').kind).toBe('live')
    expect(writeRuleHitsQuery(read(''), TODAY).toString()).toBe('')
  })

  it('RuleHitsPage_FiltersReachTheQuery', async () => {
    const row = { checkId: 'C1', lineNumber: 1, ruleId: 'BR-3.3', firedAt: '2026-10-03T14:05:06', kind: 'shadow' }
    api.get.mockResolvedValueOnce({ from: '2026-10-01T00:00:00', to: '2026-10-15T00:00:00', kind: 'shadow', rows: [row] })
    const q = read('from=2026-10-01&to=2026-10-15&rule=BR-3.3&payer=BUPA&store=S001&kind=shadow')
    await expect(ruleHitsApi.rows(q)).resolves.toMatchObject({ kind: 'shadow', rows: [row] })
    expect(api.get).toHaveBeenLastCalledWith('InsuranceRules/RuleHits', { from: '2026-10-01', to: '2026-10-15', rule: 'BR-3.3', payer: 'BUPA', store: 'S001', kind: 'shadow' })

    // An empty filter is not sent (the door would read '' as "exactly blank"); the window and kind always are.
    api.get.mockResolvedValueOnce(null)
    await expect(ruleHitsApi.rows(read('payer=TAWUNIYA'))).resolves.toMatchObject({ rows: [] })
    expect(api.get).toHaveBeenLastCalledWith('InsuranceRules/RuleHits', { from: '2026-10-01', to: '2026-10-31', payer: 'TAWUNIYA', kind: 'live' })
  })

  it('RuleHitsPage_DownloadCallsTheExcelDoor', async () => {
    const file = { blob: new Blob(['PK']), filename: 'rule-hits-20261001-to-20261031-shadow.xlsx' }
    api.blob.mockResolvedValueOnce(file)
    const q = read('rule=BR-7&store=S001&kind=shadow')
    await expect(ruleHitsApi.excel(q)).resolves.toBe(file)
    // The SAME query as the rows: what is on screen is what downloads.
    expect(api.blob).toHaveBeenLastCalledWith('InsuranceRules/RuleHits/Excel', { from: '2026-10-01', to: '2026-10-31', rule: 'BR-7', store: 'S001', kind: 'shadow' })
    // The server's Content-Disposition name wins; the fallback is 3980's own spelling.
    expect(ruleHitsFileName(q)).toBe('rule-hits-20261001-to-20261031-shadow.xlsx')
    expect(ruleHitsFileName(read(''))).toBe('rule-hits-20261001-to-20261031.xlsx')
  })

  it('RuleHitsPage_HiddenWithoutGrant', () => {
    type Item = (typeof MENU)[number]
    const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
    // The one permissions answer (oms 909) holding exactly `screens`.
    const shown = (...screens: string[]) =>
      leaves(resolveMenu(MENU, permissionsOf({ screens })).items).map((l) => [l.labelKey, l.routerLink])
    const leaf = ['insurance-rules:menu.ruleHits', '/insurance-rules/rule-hits']

    expect(shown('InsuranceRuleHits:03')).toContainEqual(leaf)
    // Every other insurance-rules grant but this one: the leaf stays hidden, and so does a neighbouring command.
    expect(shown('InsuranceRuleAuthoring:03', 'InsurancePatientBlock:03', 'InsurerSettings:03')).not.toContainEqual(leaf)
    expect(shown('InsuranceRuleHits:02')).not.toContainEqual(leaf)
    expect(shown()).not.toContainEqual(leaf)
  })
})
