import { describe, expect, it } from 'vitest'
import { bbyStatusSeverity, compareBbyStatus, readBbyStatus } from './status'

// The BBY status reading shared by the inquiry and Bonus Buy Maintenance (ticket 442):
// SAP's KONBBYH.STATUS codes plus OMS's own `3` = Tested (CONTEXT "BBY status").
describe('readBbyStatus', () => {
  it('reads SAP blank as Activated, padded or not', () => {
    expect(readBbyStatus('')).toBe('activated')
    expect(readBbyStatus('  ')).toBe('activated')
  })

  it('reads 1 / 2 / 3 as Planned / Deactivated / Tested', () => {
    expect(readBbyStatus('1')).toBe('planned')
    expect(readBbyStatus('2')).toBe('deactivated')
    expect(readBbyStatus('3')).toBe('tested')
    expect(readBbyStatus(' 3 ')).toBe('tested')
  })

  it('never reads a missing field as Activated', () => {
    expect(readBbyStatus(null)).toBe('unknown')
    expect(readBbyStatus(undefined)).toBe('unknown')
  })

  it('reads any other code, the retired A/I/D/X included, as unknown', () => {
    for (const code of ['Z', 'A', 'I', 'D', 'X', '4']) expect(readBbyStatus(code)).toBe('unknown')
  })
})

describe('bbyStatusSeverity', () => {
  it('paints Activated ok, Planned warn, Tested go, the rest neutral', () => {
    expect(bbyStatusSeverity('activated')).toBe('ok')
    expect(bbyStatusSeverity('planned')).toBe('warn')
    expect(bbyStatusSeverity('tested')).toBe('go')
    expect(bbyStatusSeverity('deactivated')).toBe('mute')
    expect(bbyStatusSeverity('unknown')).toBe('mute')
  })
})

describe('compareBbyStatus', () => {
  it('sorts by reading: Activated, Tested, Planned, Deactivated, Unknown', () => {
    const codes = ['Z', '2', '1', '', '3', null]
    expect([...codes].sort(compareBbyStatus)).toEqual(['', '3', '1', '2', 'Z', null])
  })
})
