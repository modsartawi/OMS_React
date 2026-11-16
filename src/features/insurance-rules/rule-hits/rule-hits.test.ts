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
const { INSURANCE_RULES_ACCESS_KEY } = await import('@/core/insurance-rules/access')

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
    const keyOf = (k: readonly unknown[]) => JSON.stringify(k)
    const gated = (items: Item[]): Item[] => items.flatMap((i) => [...(i.access ? [i] : []), ...gated(i.items ?? [])])
    const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
    // Every probe but the insurance area's errors; the area answers `access`.
    const shown = (access: Record<string, unknown>) => {
      const states = gated(MENU).map((i) =>
        keyOf(i.access!.key) === keyOf(INSURANCE_RULES_ACCESS_KEY)
          ? { isPending: false, isSuccess: true, data: access }
          : { isPending: false, isSuccess: false, data: undefined },
      )
      return leaves(resolveMenu(MENU, states).items).map((l) => [l.labelKey, l.routerLink])
    }
    const leaf = ['insurance-rules:menu.ruleHits', '/insurance-rules/rule-hits']

    expect(shown({ canRuleHits: true })).toEqual([leaf])
    // Every insurance-rules grant but this one: the leaf stays hidden, and so does an absent or non-true flag.
    expect(shown({ canGuards: true, canMetrics: true, canPatientLists: true, canRuleHits: false })).not.toContainEqual(leaf)
    expect(shown({ canGuards: true })).not.toContainEqual(leaf)
    expect(shown({ canRuleHits: 'true' })).toEqual([])
  })
})
