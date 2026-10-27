/** Ticket 3152 — the document type page's tab lives in `?tab=`; Settings is the default and writes no key. */
import { describe, expect, it } from 'vitest'
import { docTypeTabFromParams, docTypeTabParams } from './doc-type-tab'

describe('document type tab', () => {
  it('reads History from the address, anything else as Settings', () => {
    expect(docTypeTabFromParams(new URLSearchParams('tab=history'))).toBe('history')
    expect(docTypeTabFromParams(new URLSearchParams('tab=nope'))).toBe('settings')
    expect(docTypeTabFromParams(new URLSearchParams())).toBe('settings')
  })

  it('writes no key for Settings', () => {
    expect(docTypeTabParams('settings').toString()).toBe('')
    expect(docTypeTabParams('history').toString()).toBe('tab=history')
  })
})
