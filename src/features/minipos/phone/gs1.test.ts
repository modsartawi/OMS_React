import { describe, expect, it } from 'vitest'
import { addItemCode, parseGs1 } from './gs1'

// Ticket 916 proof: the GS1 parse, in the three spellings a reader answers (raw, `]d2`, bracketed).
const GS = '\x1d'

describe('the GS1 element string parses alike in all three spellings', () => {
  const expected = { gtin: '06281234567893', expiry: '270131', batch: 'AB12', serial: 'XYZ789' }

  it('raw, as the built-in reader answers it (batch ended by <GS>, serial running to the end)', () => {
    expect(parseGs1(`010628123456789317270131` + `10AB12${GS}21XYZ789`)).toMatchObject(expected)
  })

  it('with the ]d2 symbology prefix a wedge scanner sends', () => {
    expect(parseGs1(`]d2010628123456789317270131` + `10AB12${GS}21XYZ789`)).toMatchObject(expected)
  })

  it('bracketed, as typed off the pack', () => {
    expect(parseGs1('(01)06281234567893(17)270131(10)AB12(21)XYZ789')).toMatchObject(expected)
  })

  it('a serial first and a batch last both run to their separator or the end', () => {
    expect(parseGs1(`0106281234567893` + `21SER1${GS}10LOT9`)).toMatchObject({ serial: 'SER1', batch: 'LOT9', expiry: null })
  })

  it('an unknown AI ends the read and is kept whole', () => {
    expect(parseGs1('0106281234567893' + '9912345')?.ais).toEqual({ '01': '06281234567893', '99?': '12345' })
  })

  it('an EAN-13 is not a GS1 element string', () => {
    expect(parseGs1('6281234567893')).toBeNull()
    expect(parseGs1('MPOS1|S001|T|123|abc')).toBeNull()
  })
})

describe('the code an add sends', () => {
  it('a DataMatrix sends its GTIN as the pack barcode, and its serial', () => {
    expect(addItemCode(`]d2010628123456789317270131` + `10AB12${GS}21XYZ789`)).toEqual({ code: '6281234567893', serial: 'XYZ789' })
  })

  it('a GTIN-14 with a packaging indicator is sent whole', () => {
    expect(addItemCode('(01)16281234567890')).toEqual({ code: '16281234567890', serial: null })
  })

  it('an EAN-13 or a typed item number is sent as read', () => {
    expect(addItemCode(' 6281234567893 ')).toEqual({ code: '6281234567893', serial: null })
    expect(addItemCode('100045')).toEqual({ code: '100045', serial: null })
  })
})
