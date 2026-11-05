/**
 * Ticket 788 — the Insurance section's **Received** part (BackOffice 3392 / spec 3389 user stories
 * 64–66): the intake body as formatted, collapsible JSON with copy, or why there is none.
 */
import { describe, expect, it } from 'vitest'
import type { OrderInsuranceReadWire } from '@/core/models/order-insurance'
import { insuranceReadOf } from './insurance-wire'
import changedJson from './__fixtures__/insurance-1006358461-changed.json'
import baseJson from './__fixtures__/insurance-1006358459.json'
import { jsonTree, receivedView } from './received-section'

const CHANGED = insuranceReadOf(changedJson as unknown as OrderInsuranceReadWire)
const BASE = insuranceReadOf(baseJson as unknown as OrderInsuranceReadWire)

describe('received section', () => {
  it('an absent intake body says not kept', () => {
    expect(receivedView(CHANGED.intake)).toEqual({ kind: 'notKept', textKey: 'insurance.received.notKeptBefore', since: '2026-11-04' })
  })

  it('before keeping began (no date yet) it still says not kept, without a date', () => {
    expect(receivedView({ kept: false, keptSince: null })).toEqual({ kind: 'notKept', textKey: 'insurance.received.notKept', since: null })
  })

  it('a kept body copies byte for byte and draws as a tree', () => {
    const intake = BASE.intake
    if (!intake.kept) throw new Error('fixture keeps its body')
    const view = receivedView(intake)
    if (view.kind !== 'kept') throw new Error('kept')
    expect(view.copyText).toBe(intake.body)
    expect(view.receivedAt).toBe('2026-11-05 12:57')
    expect(view.tree?.type).toBe('object')
  })

  it('a body that is not JSON is shown as received, with no tree', () => {
    const view = receivedView({ kept: true, body: '<xml>not json</xml>', contentType: 'text/xml', receivedAt: '', receivedBy: '' })
    expect(view).toMatchObject({ kind: 'kept', tree: null, text: '<xml>not json</xml>', copyText: '<xml>not json</xml>' })
  })
})

describe('json tree', () => {
  it('keeps every value as written: 1.10 stays 1.10, Arabic and escapes stay', () => {
    expect(jsonTree('{"rate":1.10,"name":"محمد","q":"a\\"b","n":[1, null, true],"e":{}}')).toEqual({
      type: 'object',
      entries: [
        { key: '"rate"', value: { type: 'scalar', raw: '1.10' } },
        { key: '"name"', value: { type: 'scalar', raw: '"محمد"' } },
        { key: '"q"', value: { type: 'scalar', raw: '"a\\"b"' } },
        {
          key: '"n"',
          value: {
            type: 'array',
            items: [
              { type: 'scalar', raw: '1' },
              { type: 'scalar', raw: 'null' },
              { type: 'scalar', raw: 'true' },
            ],
          },
        },
        { key: '"e"', value: { type: 'object', entries: [] } },
      ],
    })
  })

  it('a scalar body is one scalar; a broken body has no tree', () => {
    expect(jsonTree(' 42 ')).toEqual({ type: 'scalar', raw: '42' })
    expect(jsonTree('{"a":')).toBeNull()
  })
})
