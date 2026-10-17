import { describe, expect, it } from 'vitest'
import { csvCells } from './csv-cells'

describe('csvCells', () => {
  it('splits on the separator, trims, and reads a quoted cell with the separator and a doubled quote', () => {
    expect(csvCells(' A-1 , M-1 ', ',')).toEqual(['A-1', 'M-1'])
    expect(csvCells('"A,1";"say ""hi""";', ';')).toEqual(['A,1', 'say "hi"', ''])
    expect(csvCells('a\tb', '\t')).toEqual(['a', 'b'])
    expect(csvCells('', ',')).toEqual([''])
  })
})
