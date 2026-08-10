/**
 * The Reports nav group, gated (ticket 263, spec 261 §"Getting in").
 *
 * `resolveMenu` is the pure half of `useVisibleMenu` (ticket 124), so what the
 * shell does with each answer the `RetailInvoice/Access` probe can produce is
 * provable with no renderer. The group is read out of the **real** `MENU`, never
 * re-declared, so a leaf that lost its probe, drifted off the shared key or picked
 * up the wrong flag fails here.
 *
 * 🚩 The failure being designed against: a **Reports** heading left standing in
 * the nav for a session that holds nothing — because the probe errored, because
 * the answer was a shape nobody agreed to, or because a truthy-but-not-`true`
 * value slipped past the predicate. The group has one leaf, so hiding the leaf and
 * hiding the group are the same event, and both are asserted.
 */
import { describe, expect, it } from 'vitest'
import {
  canOpenRetailInvoice,
  RETAIL_INVOICE_ACCESS_KEY,
  retailInvoiceAccessQuery,
} from '@/features/reports/retail-invoice/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const reports = MENU.find((g) => g.labelKey === 'reports:menu.reports')

const gatedLeaves = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gatedLeaves(i.items ?? [])])
const labels = (items: ShellMenuItem[]): string[] =>
  items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

/** One probe answer, repeated once per gated leaf. */
const probed = (data: unknown): ProbeState[] =>
  gatedLeaves([reports!]).map(() => ({ isPending: false, isSuccess: true, data }))
/** An errored probe: settled, unsuccessful, no data — the thrown-probe case. */
const errored: ProbeState[] = gatedLeaves([reports!]).map(() => ({
  isPending: false,
  isSuccess: false,
  data: undefined,
}))
const pending: ProbeState[] = gatedLeaves([reports!]).map(() => ({
  isPending: true,
  isSuccess: false,
  data: undefined,
}))

describe('the Reports nav group', () => {
  it('exists, with its one leaf gated behind the shared access key', () => {
    expect(reports).toBeDefined()
    const leaves = gatedLeaves([reports!])
    expect(leaves.map((l) => l.routerLink)).toEqual(['/reports/invoice'])
    // ONE call for the area: the leaf's probe key is the SAME exported constant
    // the screen's own gate reads. That identity is what makes a gated area cost
    // one round trip, and what stops the nav and the screen disagreeing about
    // whether the session is allowed in.
    expect(leaves[0].access!.key).toBe(RETAIL_INVOICE_ACCESS_KEY)
    expect(retailInvoiceAccessQuery().queryKey).toBe(RETAIL_INVOICE_ACCESS_KEY)
  })

  it('the shared query options fail closed — no retry on a refusal, one probe per page life', () => {
    // 🚩 react-query merges the options of concurrent observers, so a reader that
    // dropped `retry: false` would make a REFUSED probe retry under a gate whose
    // whole ruling is to fail closed on the first no.
    const q = retailInvoiceAccessQuery()
    expect(q.retry).toBe(false)
    expect(q.staleTime).toBe(Infinity)
  })

  it('granted → the Reports group with its Invoices leaf', () => {
    expect(labels(resolveMenu([reports!], probed({ screenAllowed: true })).items)).toEqual([
      'reports:menu.reports',
      'reports:menu.invoices',
    ])
  })

  it('🚩 denied → NO group at all, not an empty one', () => {
    // The probe answers a denial with 200 `{ screenAllowed: false }` — a boolean
    // to read, not an error to catch — and the heading vanishes with its child so
    // a "Reports" group is never left standing over nothing.
    expect(resolveMenu([reports!], probed({ screenAllowed: false })).items).toEqual([])
  })

  it('🚩 an unknown, failed or malformed probe hides the group too', () => {
    for (const states of [
      errored,
      pending,
      probed({}),
      probed(null),
      // Truthy, but not `true` — the predicate is `=== true` and nothing looser,
      // so a malformed answer is a denial and not an accident of truthiness.
      probed({ screenAllowed: 'true' }),
      probed({ screenAllowed: 1 }),
      // The shape a different door might answer.
      probed({ canOpen: true }),
    ]) {
      expect(resolveMenu([reports!], states).items).toEqual([])
    }
  })

  it('reports an errored probe as SETTLED — failing closed must not hang the menu', () => {
    expect(resolveMenu([reports!], errored).settled).toBe(true)
  })

  it('the predicate the nav reads IS the predicate the screen gate reads', () => {
    // Both sites import `canOpenRetailInvoice`; asserting it here pins the
    // behaviour the two share rather than two spellings of it.
    expect(canOpenRetailInvoice({ screenAllowed: true })).toBe(true)
    expect(canOpenRetailInvoice({ screenAllowed: false })).toBe(false)
    expect(canOpenRetailInvoice(null)).toBe(false)
    expect(canOpenRetailInvoice(undefined)).toBe(false)
  })
})
