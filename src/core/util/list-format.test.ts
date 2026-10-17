import { describe, expect, it } from 'vitest'
import { listText } from './list-format'

describe('listText_joinsInTheReadersLanguage', () => {
  it('reads an English list with "and", never a bare comma', () => {
    expect(listText(['Threshold', 'Percent', 'Categories'], 'en')).toBe('Threshold, Percent, and Categories')
    expect(listText(['Threshold', 'Percent'], 'en')).toBe('Threshold and Percent')
    expect(listText(['Threshold'], 'en')).toBe('Threshold')
  })

  it('reads an Arabic list with the Arabic conjunction', () => {
    expect(listText(['أ', 'ب'], 'ar')).toBe('أ وب')
  })
})
