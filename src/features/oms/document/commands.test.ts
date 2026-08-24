import { describe, expect, it } from 'vitest'
import { commandBar, type CommandBar, type CommandContext } from './commands'
import { returnableLines } from './return-order'
import type { CommandKind } from './actions'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { DOCUMENT_NUMBERS, PAYLOADS, type CapturedDocumentNo } from './__fixtures__/payloads'
import { DELIVERY_WITH_REMAINING, FULLY_RETURNED_LINES } from './__fixtures__/return-lines'
import documentEn from '@/locales/en/document.json'

/**
 * The real `document` namespace, resolved the way `t('command.…')` does — same
 * helper as `rail.test.ts` and `items.test.ts`, and for the same reason: a key
 * deleted from the shipped JSON fails here instead of rendering raw to an
 * operator. The disabled reasons are the whole point of this suite, so they are
 * asserted as the shipped English, never as a key.
 */
const t = (key: string, options?: Record<string, unknown>): string => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${key}`)
  return value.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ''))
}

/** The bar for one captured document, at rest. */
function barFor(documentNo: CapturedDocumentNo, busy = false): CommandBar {
  const doc = PAYLOADS[documentNo]
  return commandBar(
    {
      closeStatus: doc.status?.closeStatus,
      documentCategory: doc.documentCategory,
      canReturn: doc.canReturn,
      lines: doc.lines,
      busy,
    },
    t,
  )
}

/** Every command on the bar, clusters then terminal, flattened. */
function everyCommand(bar: CommandBar) {
  return [...bar.clusters.flatMap((c) => c.commands), ...bar.terminal]
}

function find(bar: CommandBar, kind: CommandKind) {
  const hit = everyCommand(bar).find((c) => c.kind === kind)
  if (!hit) throw new Error(`command ${kind} is not on the bar`)
  return hit
}

const AT_REST: CommandContext = {
  closeStatus: '',
  documentCategory: 'D',
  canReturn: false,
  lines: [],
  busy: false,
}

/** The bar for one of the two return fixtures, with any field overridden. */
function returnBar(
  document: SdDocumentHeaderModel,
  overrides: Partial<CommandContext> = {},
): CommandBar {
  return commandBar(
    {
      closeStatus: document.status?.closeStatus,
      documentCategory: document.documentCategory,
      canReturn: document.canReturn,
      lines: document.lines,
      busy: false,
      ...overrides,
    },
    t,
  )
}

describe('commandGating', () => {
  it('offers all eight commands on every captured document — nothing is ever hidden', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      const kinds = everyCommand(barFor(documentNo)).map((c) => c.kind)
      expect(kinds.slice().sort()).toEqual(
        [
          'add-note',
          'cancel-close-request',
          'change-store',
          'close',
          'force-close',
          'request-close',
          'reschedule',
          'return-document',
        ].sort(),
      )
    }
  })

  it('reads as three labelled clusters of two, in order of increasing consequence', () => {
    const { clusters } = commandBar(AT_REST, t)
    expect(clusters.map((c) => c.id)).toEqual(['fulfilment', 'cancel-request', 'notes'])
    expect(clusters.map((c) => c.label)).toEqual([
      'Fulfilment',
      'Cancellation request',
      'Notes & docs',
    ])
    // Exactly two each, so the single-command-label case never arises.
    for (const cluster of clusters) expect(cluster.commands).toHaveLength(2)
    expect(clusters.flatMap((c) => c.commands.map((x) => x.kind))).toEqual([
      'reschedule',
      'change-store',
      'request-close',
      'cancel-close-request',
      'add-note',
      'return-document',
    ])
  })

  it('pins the terminal pair — override then sanctioned cancel — outside every cluster', () => {
    const bar = commandBar(AT_REST, t)
    expect(bar.terminal.map((c) => c.kind)).toEqual(['force-close', 'close'])
    // Unlabelled by design: a label would make it read as a fourth family.
    expect(bar.clusters.flatMap((c) => c.commands.map((x) => x.kind))).not.toContain('close')
    expect(bar.clusters.flatMap((c) => c.commands.map((x) => x.kind))).not.toContain('force-close')
  })

  it('disables Request Cancellation with its reason when one is already open', () => {
    // `8000000174` is the one capture of five carrying `closeStatus: 'R'`.
    expect(PAYLOADS['8000000174'].status.closeStatus).toBe('R')
    const bar = barFor('8000000174')
    expect(find(bar, 'request-close')).toEqual({
      kind: 'request-close',
      disabled: true,
      reason: 'A cancellation request is already open for this document.',
    })
  })

  it('and leaves Withdraw Request enabled — the cluster promotes by subtraction', () => {
    const bar = barFor('8000000174')
    expect(find(bar, 'cancel-close-request')).toEqual({
      kind: 'cancel-close-request',
      disabled: false,
      reason: null,
    })
    const cluster = bar.clusters.find((c) => c.id === 'cancel-request')
    expect(cluster?.commands.filter((c) => !c.disabled).map((c) => c.kind)).toEqual([
      'cancel-close-request',
    ])
  })

  it('leaves Request Cancellation takeable on the four documents with no open request', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      if (documentNo === '8000000174') continue
      expect(find(barFor(documentNo), 'request-close').disabled).toBe(false)
    }
  })

  it('disables Return Document on an order — the reason names the way out', () => {
    // `2000000551` is the eRx capture: `documentCategory: 'X'`, not a delivery.
    expect(PAYLOADS['2000000551'].documentCategory).not.toBe('D')
    expect(find(barFor('2000000551'), 'return-document')).toEqual({
      kind: 'return-document',
      disabled: true,
      reason: 'Open the delivery to return it.',
    })
  })

  it('disables Return Document on a delivery whose store is not on the rail', () => {
    // `canReturn` false with lines still remaining: the cause the screen splits
    // out as the store rule, because exhaustion is ruled out by the projection.
    const bar = returnBar(DELIVERY_WITH_REMAINING, { canReturn: false })
    expect(find(bar, 'return-document')).toEqual({
      kind: 'return-document',
      disabled: true,
      reason: 'Only bonded deliveries handled by Starlinks can be returned here.',
    })
  })

  it('disables Return Document on an exhausted delivery, and says so', () => {
    // Same `canReturn: false`, different derived cause: nothing projects.
    const bar = returnBar(FULLY_RETURNED_LINES)
    expect(find(bar, 'return-document')).toEqual({
      kind: 'return-document',
      disabled: true,
      reason: 'Everything on this delivery has already been returned.',
    })
  })

  it('enables Return Document only when canReturn is true', () => {
    const bar = returnBar(DELIVERY_WITH_REMAINING)
    expect(DELIVERY_WITH_REMAINING.canReturn).toBe(true)
    expect(find(bar, 'return-document')).toEqual({
      kind: 'return-document',
      disabled: false,
      reason: null,
    })
  })

  it('fails closed on a payload with no canReturn at all', () => {
    // The five captures predate BackOffice spec 1283 §2b and carry neither
    // field. Absent must read as NOT returnable — never as enabled.
    for (const documentNo of DOCUMENT_NUMBERS) {
      expect(PAYLOADS[documentNo].canReturn).toBeUndefined()
      expect(find(barFor(documentNo), 'return-document').disabled).toBe(true)
    }
    for (const canReturn of [undefined, null, false] as const) {
      expect(find(returnBar(DELIVERY_WITH_REMAINING, { canReturn }), 'return-document').disabled)
        .toBe(true)
    }
  })

  it('gives the store reason, not the exhausted one, when there are no lines to project', () => {
    // Nothing projected proves nothing was returned — exhaustion has to be
    // shown by lines that WERE. Tooltip-only either way.
    const bar = returnBar(DELIVERY_WITH_REMAINING, { canReturn: false, lines: [] })
    expect(find(bar, 'return-document').reason).toBe(
      'Only bonded deliveries handled by Starlinks can be returned here.',
    )
  })

  it('follows canReturn ALONE — even on a delivery-return category', () => {
    // `9000000003` is opened AS a delivery but carries `documentCategory: 'T'`.
    // If the server says a return may be created, the category must not refuse
    // it and tell the operator to open the delivery they are already on.
    const doc = PAYLOADS['9000000003']
    expect(doc.documentCategory).not.toBe('D')
    const bar = returnBar({ ...doc, canReturn: true })
    expect(find(bar, 'return-document')).toEqual({
      kind: 'return-document',
      disabled: false,
      reason: null,
    })
  })

  it('follows canReturn ALONE — the derived split is a reason, never a gate', () => {
    // An exhausted projection the server nonetheless says yes to: the button
    // stays takeable. A wrong split can only ever mislabel a tooltip.
    const bar = returnBar(FULLY_RETURNED_LINES, { canReturn: true })
    expect(returnableLines(FULLY_RETURNED_LINES.lines).rows).toEqual([])
    expect(find(bar, 'return-document')).toEqual({
      kind: 'return-document',
      disabled: false,
      reason: null,
    })
  })

  it('disables everything while busy, and explains none of it', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      for (const command of everyCommand(barFor(documentNo, true))) {
        expect(command).toEqual({ kind: command.kind, disabled: true, reason: null })
      }
    }
  })

  it('never disables Add Note — its emptiness rule moved into its dialog', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      expect(find(barFor(documentNo), 'add-note')).toEqual({
        kind: 'add-note',
        disabled: false,
        reason: null,
      })
    }
  })

  it('leaves the fulfilment pair and the terminal tier ungated at rest', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      const bar = barFor(documentNo)
      for (const kind of ['reschedule', 'change-store', 'close', 'force-close'] as CommandKind[]) {
        expect(find(bar, kind).disabled).toBe(false)
      }
    }
  })

  it('survives a document with no status block at all', () => {
    const bar = commandBar(
      { closeStatus: null, documentCategory: null, canReturn: null, lines: null, busy: false },
      t,
    )
    expect(find(bar, 'request-close').disabled).toBe(false)
    expect(find(bar, 'return-document').disabled).toBe(true)
  })
})
