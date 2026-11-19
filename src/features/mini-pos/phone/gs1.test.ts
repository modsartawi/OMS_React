import { describe, expect, it } from 'vitest'
import { addItemCode, parseGs1 } from './gs1'

// Ticket 928 proof: the GS1 parse, in the three spellings a reader answers (raw, `]d2`, bracketed).
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

// Review 4063 #1: a code that merely opens with 00/01/02 is not a GS1 element string. Only a DataMatrix read, the `]d2`
// prefix, the bracketed form or a <GS> marks one; a bare read must carry a whole 14-digit AI 01 to be read as GS1.
describe('only a GS1-marked read is parsed as GS1', () => {
  it('a UPC-A and an EAN-13 opening with 01 are sent whole', () => {
    expect(parseGs1('016000275287')).toBeNull()
    expect(parseGs1('0123456789012')).toBeNull()
    expect(addItemCode('016000275287', 'upc_a')).toEqual({ code: '016000275287', serial: null })
    expect(addItemCode('0123456789012', 'ean_13')).toEqual({ code: '0123456789012', serial: null })
  })

  it('typed item numbers pass through untouched', () => {
    expect(addItemCode('0012345')).toEqual({ code: '0012345', serial: null })
    expect(addItemCode('0212345678')).toEqual({ code: '0212345678', serial: null })
    expect(addItemCode('016000275287')).toEqual({ code: '016000275287', serial: null })
  })

  it('a DataMatrix read is GS1 even without a prefix, and a bare read with a whole AI 01 is GS1', () => {
    expect(addItemCode(`0106281234567893` + `21SER1`, 'data_matrix')).toEqual({ code: '6281234567893', serial: 'SER1' })
    expect(addItemCode('0106281234567893')).toEqual({ code: '6281234567893', serial: null })
  })

  it('a <GS> marks a GS1 string', () => {
    expect(parseGs1(`10LOT9${GS}0106281234567893`)).toBeNull() // not opening with an SSCC/GTIN AI
    expect(parseGs1(`${GS}0106281234567893`)).toMatchObject({ gtin: '06281234567893' })
  })
})
