import { describe, expect, it } from 'vitest'

import { paperStoreText } from './store-text'

// Ticket 314 (BackOffice 1990): the papers print the server's storeText as sent.
describe('paperStoreText', () => {
  it('prints the server’s storeText as sent — PH-019 (P019)', () => {
    expect(paperStoreText({ storeCode: 'P019', storeText: 'PH-019 (P019)' })).toBe('PH-019 (P019)')
  })

  it('prints the code alone when that is what the server sent — never "()"', () => {
    expect(paperStoreText({ storeCode: 'P020', storeText: 'P020' })).toBe('P020')
  })

  it('never composes: a storeText that disagrees with the code still prints as sent', () => {
    // The server's formatter is the one spelling; the client does not check it.
    expect(paperStoreText({ storeCode: 'P019', storeText: 'PH-999 (X)' })).toBe('PH-999 (X)')
  })

  it('a SIS.Api without 1990 omits the field: the paper prints the code, as before', () => {
    expect(paperStoreText({ storeCode: 'P019' })).toBe('P019')
  })
})
