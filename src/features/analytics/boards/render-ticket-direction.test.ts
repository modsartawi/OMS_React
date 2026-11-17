import { describe, expect, it } from 'vitest'
import { setTicketDocument } from './render-ticket'

// Review F2 (BackOffice spec 3630 M37): headless Chromium prints the report under a render ticket with no stored
// locale, so `index.html`'s pre-paint script leaves `<html dir>` empty and an Arabic run's PDF was laid out left to
// right. The ticket's language sets the page's direction and language before the report is drawn.

describe("the ticket's language is the page's", () => {
  it('an Arabic run lays the page out right to left, in Arabic', () => {
    const page = { dir: '', lang: 'en' }
    setTicketDocument(page, 'ar')
    expect(page).toEqual({ dir: 'rtl', lang: 'ar' })
  })

  it('an English run, left to right, in English', () => {
    const page = { dir: 'rtl', lang: 'ar' }
    setTicketDocument(page, 'en')
    expect(page).toEqual({ dir: 'ltr', lang: 'en' })
  })
})
