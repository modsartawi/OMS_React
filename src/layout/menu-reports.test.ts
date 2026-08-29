/**
 * The Reports nav group, gated (ticket 263, spec 261 §"Getting in"; a SECOND
 * gated leaf at ticket 296, spec 1386).
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
 * value slipped past the predicate. Until 296 the group had one leaf, so hiding
 * the leaf and hiding the group were the same event; now they are not, and that
 * difference is the point of half the cases below.
 *
 * 🔑 **Two leaves, two grants, and the probe answers are NOT shared.** The IDoc
 * inspector's grant is its own — a consultant who may print a receipt has no
 * claim on every IDoc the SAP rail ever generated. So the cases below answer the
 * two probes SEPARATELY, and the ones that matter most are the mixed ones: one
 * grant held, the other not. A helper that fed one answer to both leaves (the
 * shape this file had while the group held one leaf) would pass on a menu that
 * gated them together.
 */
import { describe, expect, it } from 'vitest'
import {
  canOpenRetailInvoice,
  RETAIL_INVOICE_ACCESS_KEY,
  retailInvoiceAccessQuery,
} from '@/features/reports/retail-invoice/api'
import {
  canOpenIDocInspector,
  IDOC_INSPECTOR_ACCESS_KEY,
  idocInspectorAccessQuery,
} from '@/features/reports/idoc-inspector/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const reports = MENU.find((g) => g.labelKey === 'reports:menu.reports')

const gatedLeaves = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gatedLeaves(i.items ?? [])])
const labels = (items: ShellMenuItem[]): string[] =>
  items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

const leaves = gatedLeaves([reports!])
/**
 * Probe answers in the order `resolveMenu` reads them — one per gated leaf, and
 * ⚠️ **positional**: `useVisibleMenu` zips `useQueries`' results against
 * `collectGated(MENU)`, so index 0 is the Invoices leaf and index 1 the IDoc
 * inspector's. Answered separately on purpose; see the file remark.
 */
const answered = (...data: unknown[]): ProbeState[] =>
  leaves.map((_, i) => ({ isPending: false, isSuccess: true, data: data[i] }))
/** Both leaves, one answer — for the cases where the answer is about the SHAPE
 *  (malformed, truthy-not-true) rather than about one grant or the other. */
const probed = (data: unknown): ProbeState[] => answered(...leaves.map(() => data))
/** An errored probe: settled, unsuccessful, no data — the thrown-probe case. */
const errored: ProbeState[] = leaves.map(() => ({
  isPending: false,
  isSuccess: false,
  data: undefined,
}))
const pending: ProbeState[] = leaves.map(() => ({
  isPending: true,
  isSuccess: false,
  data: undefined,
}))

describe('the Reports nav group', () => {
  it('exists, with EVERY leaf gated behind its own screen access key', () => {
    expect(reports).toBeDefined()
    expect(leaves.map((l) => l.routerLink)).toEqual(['/reports/invoice', '/reports/idoc-inspector'])
    // ONE call per screen: each leaf's probe key is the SAME exported constant
    // that screen's own gate reads. That identity is what makes a gated screen
    // cost one round trip, and what stops the nav and the screen disagreeing
    // about whether the session is allowed in.
    expect(leaves[0].access!.key).toBe(RETAIL_INVOICE_ACCESS_KEY)
    expect(retailInvoiceAccessQuery().queryKey).toBe(RETAIL_INVOICE_ACCESS_KEY)
    expect(leaves[1].access!.key).toBe(IDOC_INSPECTOR_ACCESS_KEY)
    expect(idocInspectorAccessQuery().queryKey).toBe(IDOC_INSPECTOR_ACCESS_KEY)
  })

  it('🔑 the two leaves are gated SEPARATELY — one area is not one grant', () => {
    // Sharing an area, a URL prefix and an i18n namespace is not sharing a
    // permission. A single key here would hand a consultant the IDoc inspector
    // because they can print receipts.
    expect(IDOC_INSPECTOR_ACCESS_KEY).not.toEqual(RETAIL_INVOICE_ACCESS_KEY)
    expect(new Set(leaves.map((l) => l.access!.key)).size).toBe(leaves.length)
  })

  it('every screen query option fails closed — no retry on a refusal, one probe per page life', () => {
    // 🚩 react-query merges the options of concurrent observers, so a reader that
    // dropped `retry: false` would make a REFUSED probe retry under a gate whose
    // whole ruling is to fail closed on the first no.
    for (const q of [retailInvoiceAccessQuery(), idocInspectorAccessQuery()]) {
      expect(q.retry).toBe(false)
      expect(q.staleTime).toBe(Infinity)
    }
  })

  it('both granted → the Reports group with both leaves', () => {
    expect(labels(resolveMenu([reports!], probed({ screenAllowed: true })).items)).toEqual([
      'reports:menu.reports',
      'reports:menu.invoices',
      'reports:menu.idocInspector',
    ])
  })

  it('🔑 invoices granted, the inspector NOT → the group keeps exactly one leaf', () => {
    // The mixed case, and the one a shared probe would get wrong: the group
    // survives, and the leaf whose grant is not held is the only thing missing.
    expect(
      labels(
        resolveMenu([reports!], answered({ screenAllowed: true }, { screenAllowed: false })).items,
      ),
    ).toEqual(['reports:menu.reports', 'reports:menu.invoices'])
  })

  it('🔑 the inspector granted, invoices NOT → the group keeps the OTHER leaf', () => {
    expect(
      labels(
        resolveMenu([reports!], answered({ screenAllowed: false }, { screenAllowed: true })).items,
      ),
    ).toEqual(['reports:menu.reports', 'reports:menu.idocInspector'])
  })

  it('🚩 denied everywhere → NO group at all, not an empty one', () => {
    // The probe answers a denial with 200 `{ screenAllowed: false }` — a boolean
    // to read, not an error to catch — and the heading vanishes with its children
    // so a "Reports" group is never left standing over nothing.
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

  it('the predicate the nav reads IS the predicate each screen gate reads', () => {
    // Both sites import the same function; asserting it here pins the behaviour
    // they share rather than two spellings of it.
    for (const can of [canOpenRetailInvoice, canOpenIDocInspector]) {
      expect(can({ screenAllowed: true })).toBe(true)
      expect(can({ screenAllowed: false })).toBe(false)
      expect(can(null)).toBe(false)
      expect(can(undefined)).toBe(false)
    }
  })
})
