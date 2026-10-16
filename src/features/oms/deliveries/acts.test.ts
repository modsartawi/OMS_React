import { describe, expect, it } from 'vitest'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { actsOffered } from './acts'

describe('the list offers its acts only to a session that may open AND change a delivery (ticket 521)', () => {
  it.each<[string, OmsAccessResult | null | undefined, boolean]>([
    ['open + change', { canOpenList: true, canOpenDetail: true, canChangeDetail: true }, true],
    ['a viewer (open, no change)', { canOpenList: true, canOpenDetail: true, canChangeDetail: false }, false],
    ['an older SIS.Api (canChangeDetail absent)', { canOpenList: true, canOpenDetail: true }, false],
    ['return only', { canOpenList: true, canOpenDetail: true, canCreateReturn: true }, false],
    ['change without opening Details', { canOpenList: true, canOpenDetail: false, canChangeDetail: true }, false],
    ['a malformed flag', { canOpenList: true, canOpenDetail: true, canChangeDetail: 'yes' } as unknown as OmsAccessResult, false],
    ['no answer', null, false],
  ])('%s → %s', (_, access, offered) => {
    expect(actsOffered(access)).toBe(offered)
  })
})
