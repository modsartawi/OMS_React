/**
 * A picked unit's serial cell (ticket 540, BackOffice brief 2875): SIS.Api withholds the serial for a
 * caller without `PickSupportSerial,03` and says so per unit with `serialWithheld`. The client only
 * reads that flag — it never works out visibility, and never from the probe.
 */
import { describe, expect, it } from 'vitest'
import { serialCell } from './serial'

describe('serialCell', () => {
  it('reads Restricted when serialWithheld is true', () => {
    expect(serialCell({ serialNumber: '', serialWithheld: true })).toEqual({ kind: 'restricted' })
  })

  it('the data wins: a withheld unit reads Restricted even if a serial came with it', () => {
    expect(serialCell({ serialNumber: 'SN12345', serialWithheld: true })).toEqual({ kind: 'restricted' })
  })

  it('reads none for an empty serial without the flag, and serial for a non-empty one; an absent serialWithheld draws as today', () => {
    expect(serialCell({ serialNumber: '', serialWithheld: false })).toEqual({ kind: 'none' })
    expect(serialCell({ serialNumber: '  ' })).toEqual({ kind: 'none' })
    expect(serialCell({ serialNumber: null as unknown as string })).toEqual({ kind: 'none' })
    expect(serialCell({ serialNumber: 'SN12345', serialWithheld: false })).toEqual({ kind: 'serial', serial: 'SN12345' })
    expect(serialCell({ serialNumber: ' SN12345 ' })).toEqual({ kind: 'serial', serial: 'SN12345' })
  })

  it('a malformed flag is not a withholding', () => {
    expect(serialCell({ serialNumber: '', serialWithheld: 'true' as unknown as boolean })).toEqual({ kind: 'none' })
  })
})
