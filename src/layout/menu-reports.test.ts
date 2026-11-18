/**
 * The Reports nav group, gated (ticket 263, spec 261 §"Getting in"; a SECOND gated leaf at ticket 296, spec 1386; a
 * THIRD at ticket 461, BackOffice spec 2579).
 *
 * `resolveMenu` is the pure half of `useVisibleMenu` (ticket 124), so what the shell does with each answer is provable
 * with no renderer. Since oms 909 each leaf reads its own key off the ONE permissions answer (brief 3995 rows 33, 35,
 * 36): Invoices = `RetailInvoice:03`, IDoc inspector = `IDocInspector:03`, SAP export console = `SapExportConsole:03`.
 * The group is read out of the **real** `MENU`, never re-declared.
 *
 * 🚩 The failure being designed against: a **Reports** heading left standing in the nav for a session that holds
 * nothing — because the answer errored or is still pending.
 *
 * 🔑 **Three leaves, three grants.** A consultant who may print a receipt has no claim on every IDoc the SAP rail ever
 * generated, so the cases that matter most are the mixed ones: one grant held, the others not.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { canOpenRetailInvoice } from '@/features/reports/retail-invoice/api'
import { canOpenIDocInspector } from '@/features/reports/idoc-inspector/api'
import { canOpenSapExport } from '@/features/reports/sap-export-console/access'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const reports = MENU.find((g) => g.labelKey === 'reports:menu.reports')

const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })
const visible = (...screens: string[]) => labels(resolveMenu([reports!], holding(...screens)).items)
const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })

const INVOICE = 'RetailInvoice:03'
const IDOC = 'IDocInspector:03'
const SAP = 'SapExportConsole:03'

describe('the Reports nav group', () => {
  it('exists, with EVERY leaf gated', () => {
    expect(reports).toBeDefined()
    const leaves = reports!.items!
    expect(leaves.map((l) => l.routerLink)).toEqual(['/reports/invoice', '/reports/idoc-inspector', '/reports/sap-export'])
    for (const leaf of leaves) expect(isGated(leaf)).toBe(true)
  })

  it('all granted → the Reports group with every leaf, SAP export after the inspector', () => {
    expect(visible(INVOICE, IDOC, SAP)).toEqual([
      'reports:menu.reports',
      'reports:menu.invoices',
      'reports:menu.idocInspector',
      'sap-export-console:menu.sapExport',
    ])
  })

  it('🔑 only the SAP export console granted → the group keeps that leaf alone (461)', () => {
    expect(visible(SAP)).toEqual(['reports:menu.reports', 'sap-export-console:menu.sapExport'])
  })

  it('🚩 the SAP export key missing while the others grant → its leaf alone is hidden', () => {
    expect(visible(INVOICE, IDOC)).toEqual(['reports:menu.reports', 'reports:menu.invoices', 'reports:menu.idocInspector'])
  })

  it('🔑 invoices granted, the inspector NOT → the group keeps exactly one leaf', () => {
    expect(visible(INVOICE)).toEqual(['reports:menu.reports', 'reports:menu.invoices'])
  })

  it('🔑 the inspector granted, invoices NOT → the group keeps the OTHER leaf', () => {
    expect(visible(IDOC)).toEqual(['reports:menu.reports', 'reports:menu.idocInspector'])
  })

  it('🚩 denied everywhere → NO group at all, not an empty one', () => {
    expect(resolveMenu([reports!], holding()).items).toEqual([])
  })

  it('🚩 near-miss keys, a failed or a pending answer hide the group too', () => {
    for (const p of [holding('RetailInvoice:02', 'IDocInspector:06', 'SapExportConsole:02'), errored, pending]) {
      expect(resolveMenu([reports!], p).items).toEqual([])
    }
  })

  it('reports an errored answer as SETTLED — failing closed must not hang the menu', () => {
    expect(resolveMenu([reports!], errored).settled).toBe(true)
  })

  it('the predicate each screen gate reads says yes on exactly its own key', () => {
    for (const [can, key] of [
      [canOpenRetailInvoice, INVOICE],
      [canOpenIDocInspector, IDOC],
      [canOpenSapExport, SAP],
    ] as const) {
      expect(can(holding(key))).toBe(true)
      expect(can(holding(...[INVOICE, IDOC, SAP].filter((k) => k !== key)))).toBe(false)
      expect(can(errored)).toBe(false)
    }
  })
})
