import { describe, expect, it } from 'vitest'
import { commandBar, type CommandBar, type CommandContext } from './commands'
import type { CommandKind } from './actions'
import { DOCUMENT_NUMBERS, PAYLOADS, type CapturedDocumentNo } from './__fixtures__/payloads'
import documentEn from '@/locales/en/document.json'

/**
 * The real `document` namespace, resolved the way `t('command.…')` does — same
 * helper as `rail.test.ts` and `items.test.ts`, and for the same reason: a key
 * deleted from the shipped JSON fails here instead of rendering raw to an
 * operator. The two disabled reasons are the whole point of this suite, so they
 * are asserted as the shipped English, never as a key.
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
      deliveryDocumentType: doc.deliveryDocumentType,
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

const AT_REST: CommandContext = { closeStatus: '', deliveryDocumentType: 'DL', busy: false }

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

  it('disables Return Document with its reason on anything but a BeyondBorder delivery', () => {
    // No capture is `BB`: three are `DL`, one `DLR`, and the eRx order carries
    // `null`. The gate must hold on all four shapes.
    for (const documentNo of DOCUMENT_NUMBERS) {
      expect(find(barFor(documentNo), 'return-document')).toEqual({
        kind: 'return-document',
        disabled: true,
        reason: 'Only a BeyondBorder delivery can be returned.',
      })
    }
  })

  it('and enables it on a BeyondBorder delivery, whatever the code’s case or padding', () => {
    for (const type of ['BB', 'bb', ' BB ']) {
      const bar = commandBar({ ...AT_REST, deliveryDocumentType: type }, t)
      expect(find(bar, 'return-document').disabled).toBe(false)
    }
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
    const bar = commandBar({ closeStatus: null, deliveryDocumentType: null, busy: false }, t)
    expect(find(bar, 'request-close').disabled).toBe(false)
    expect(find(bar, 'return-document').disabled).toBe(true)
  })
})
