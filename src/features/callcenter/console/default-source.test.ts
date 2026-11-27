/**
 * Ticket 993 (spec 983 D14) — the agent's default source applies when an order
 * opens, once per order, and never over a source the order already holds.
 */
import { describe, expect, it } from 'vitest'
import type { AgentDocumentSource } from '@/core/models/callcenter'
import { afterDefaultRefused, defaultSourceToApply } from './default-source'

const row = (documentSource: string, isDefault: boolean): AgentDocumentSource => ({
  documentSource,
  description: `${documentSource} desc`,
  documentSourceCategory: 'C',
  isDefault,
})

const WITH_DEFAULT = [row('WEB', false), row('TMRA', true), row('CALL', false)]
const NO_DEFAULT = [row('WEB', false), row('CALL', false)]

const at = (over: Partial<Parameters<typeof defaultSourceToApply>[0]> = {}) =>
  defaultSourceToApply({
    transactionId: 'T-1',
    status: 'open',
    currentSource: null,
    sources: WITH_DEFAULT,
    tried: new Set<string>(),
    ...over,
  })

describe('appliesOnceOnlyWhenEmptyAndADefaultExists', () => {
  it('applies the default to an open order with no source', () => {
    expect(at()).toBe('TMRA')
  })

  it('does nothing when the agent has no default (the owner login)', () => {
    expect(at({ sources: NO_DEFAULT })).toBeNull()
    expect(at({ sources: [] })).toBeNull()
  })

  it('never overwrites a source the order already holds', () => {
    expect(at({ currentSource: 'WEB' })).toBeNull()
    expect(at({ currentSource: 'TMRA' })).toBeNull()
  })

  it('waits while the list or the order is not there yet', () => {
    expect(at({ sources: undefined })).toBeNull()
    expect(at({ transactionId: null })).toBeNull()
  })

  it('does nothing on an order that is no longer open', () => {
    expect(at({ status: 'submitted' })).toBeNull()
  })

  it('applies once per order: a tried order is not tried again, another order is', () => {
    expect(at({ tried: new Set(['T-1']) })).toBeNull()
    expect(at({ tried: new Set(['T-1']), transactionId: 'T-2' })).toBe('TMRA')
  })
})

describe('aReferenceRequiredOpensTheSectionPrefilled', () => {
  it('a source that needs a reference opens the section on that source, reference focused', () => {
    expect(afterDefaultRefused('TMRA', 'SOURCE_REFERENCE_REQUIRED')).toEqual({
      kind: 'askReference',
      documentSource: 'TMRA',
    })
  })

  it('any other refusal stays quiet: the source chip is still unset and still the agent’s', () => {
    expect(afterDefaultRefused('TMRA', 'SOURCE_NOT_ALLOWED')).toEqual({ kind: 'quiet' })
    expect(afterDefaultRefused('TMRA', undefined)).toEqual({ kind: 'quiet' })
  })
})
