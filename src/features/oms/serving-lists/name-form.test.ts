/**
 * Ticket 570 — the create / rename name form (BackOffice spec 3042, `SVL-00005` / `SVL-00006`): both names are
 * required after trimming, at most 100 characters each, and a rename with unchanged names is not sent.
 */
import { describe, expect, it } from 'vitest'
import { nameBody, nameCheck, noteBody } from './name-form'

const form = (nameEn: string, nameAr: string, note = '') => ({ nameEn, nameAr, note })

describe('nameCheck — create', () => {
  it('two names go', () => {
    expect(nameCheck(form('Riyadh north', 'شمال الرياض'))).toEqual({ en: null, ar: null, unchanged: false, ready: true })
  })

  it('a blank English or Arabic name is required (white space alone is blank)', () => {
    expect(nameCheck(form('', 'شمال الرياض'))).toMatchObject({ en: 'required', ar: null, ready: false })
    expect(nameCheck(form('Riyadh north', '   '))).toMatchObject({ en: null, ar: 'required', ready: false })
  })

  it('100 characters go, 101 are too long — counted after trimming', () => {
    expect(nameCheck(form('a'.repeat(100), 'ب'.repeat(100))).ready).toBe(true)
    expect(nameCheck(form('a'.repeat(101), 'ب'))).toMatchObject({ en: 'tooLong', ready: false })
    expect(nameCheck(form('a', 'ب'.repeat(101)))).toMatchObject({ ar: 'tooLong', ready: false })
    expect(nameCheck(form(`  ${'a'.repeat(100)}  `, 'ب')).en).toBeNull()
  })
})

describe('nameCheck — rename', () => {
  const current = { nameEn: 'Riyadh north', nameAr: 'شمال الرياض' }

  it('unchanged names are not ready (the door would log nothing)', () => {
    expect(nameCheck(form('Riyadh north', 'شمال الرياض'), current)).toEqual({ en: null, ar: null, unchanged: true, ready: false })
  })

  it('names that differ only by surrounding spaces are unchanged', () => {
    expect(nameCheck(form(' Riyadh north ', 'شمال الرياض '), current).unchanged).toBe(true)
  })

  it('a note alone does not make a rename', () => {
    expect(nameCheck(form('Riyadh north', 'شمال الرياض', 'typo'), current).ready).toBe(false)
  })

  it('one changed name is ready', () => {
    expect(nameCheck(form('Riyadh North', 'شمال الرياض'), current)).toMatchObject({ unchanged: false, ready: true })
  })
})

describe('nameBody', () => {
  it('trims both names and the note; a blank note is left out', () => {
    expect(nameBody(form(' Riyadh north ', ' شمال الرياض ', '  '))).toEqual({ nameEn: 'Riyadh north', nameAr: 'شمال الرياض' })
    expect(nameBody(form('A', 'ب', ' new pilot '))).toEqual({ nameEn: 'A', nameAr: 'ب', note: 'new pilot' })
  })
})

describe('noteBody', () => {
  it('a note-only write sends the trimmed note, or nothing when blank', () => {
    expect(noteBody(' pilot over ')).toEqual({ note: 'pilot over' })
    expect(noteBody('  ')).toEqual({})
  })
})
