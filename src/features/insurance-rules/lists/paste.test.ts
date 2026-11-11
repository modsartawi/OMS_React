import { describe, expect, it } from 'vitest'
import { readPaste } from './paste'

describe('readPaste', () => {
  it('reads an Excel column, commas and spaces alike, each code once', () => {
    expect(readPaste('1001\r\n1002\r\n1001\n\n1003, 1004;1005\t1006', 'articles', [])).toEqual({
      added: ['1001', '1002', '1003', '1004', '1005', '1006'],
      repeated: 1,
      rejected: [],
    })
  })
  it('counts a code the list already holds, and rejects what is not a code', () => {
    expect(readPaste('1001 abc 1002 10-2', 'articles', ['1002'])).toEqual({ added: ['1001'], repeated: 1, rejected: ['abc', '10-2'] })
  })
  it('takes letters in a category code', () => {
    expect(readPaste('E01 GLP-1 x/y', 'categories', [])).toEqual({ added: ['E01', 'GLP-1'], repeated: 0, rejected: ['x/y'] })
  })
  it('reads 2000 codes', () => {
    const text = Array.from({ length: 2000 }, (_, i) => String(100000 + i)).join('\n')
    expect(readPaste(text, 'articles', []).added).toHaveLength(2000)
  })
})
