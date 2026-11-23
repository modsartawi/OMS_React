/**
 * Presets of the bulk change (BackOffice spec 4190 stories 35–39, server ticket 4195; oms 960).
 * A preset holds operations, never bonus-buy numbers; picking one starts the form, which stays editable.
 */
import { describe, expect, it } from 'vitest'
import type { BbyBulkPreset } from '@/core/models/bonus-buy-bulk-preset'
import { EMPTY_FORM, type BulkForm } from './operations'
import { matchingPreset, pickPreset, presetForm, presetOperations, presetSaveRequest, readPresetOutcome } from './presets'

const callCenterOnly: BbyBulkPreset = {
  id: '01JF0000000000000000000001',
  name: 'Call-center only',
  version: 'v1',
  operations: {
    score: { op: 'set', value: 40 },
    maxValue: { op: 'set', value: 12.5 },
    isStackable: { op: 'set', value: false },
    timeWindow: { op: 'set', from: '150000', to: '183015' },
    includes: { op: 'clear' },
    excludes: { op: 'add', value: '100234, 100567' },
    originFilter: { op: 'replace', value: 'C' },
    stackingExcludes: { op: 'remove', value: 'OMS000000001' },
    loyGroups: { op: 'clear' },
    loyTiers: { op: 'replace', value: 'GOLD;SILVER' },
  },
}

describe('preset ↔ form', () => {
  it('a preset → the form → the operations it saves is lossless, every field operated', () => {
    const form = presetForm(callCenterOnly)
    expect(form.score).toEqual({ op: 'set', value: '40' })
    expect(form.timeWindow).toEqual({ op: 'set', from: '15:00:00', to: '18:30:15' })
    expect(form.lists.loyTiers).toEqual({ op: 'replace', value: 'GOLD;SILVER' })
    expect(presetOperations(form)).toEqual({ operations: callCenterOnly.operations, problems: [] })
  })

  it('a form → the saved operations → the form is lossless (absent keys stay Leave)', () => {
    const form: BulkForm = {
      ...EMPTY_FORM,
      isStackable: 'yes',
      timeWindow: { op: 'clear', from: '', to: '' },
      lists: { ...EMPTY_FORM.lists, excludes: { op: 'remove', value: '100234' } },
    }
    const { operations } = presetOperations(form)
    expect(operations).toEqual({
      isStackable: { op: 'set', value: true },
      timeWindow: { op: 'clear' },
      excludes: { op: 'remove', value: '100234' },
    })
    expect(presetForm({ ...callCenterOnly, operations })).toEqual(form)
  })

  it('🚩 operations stored as a JSON string (the column is NVARCHAR(MAX)) read the same as an object', () => {
    const asText = { ...callCenterOnly, operations: JSON.stringify(callCenterOnly.operations) }
    expect(presetForm(asText)).toEqual(presetForm(callCenterOnly))
  })

  it('unreadable operations start an all-Leave form, never a half-filled one', () => {
    expect(presetForm({ ...callCenterOnly, operations: '{not json' })).toEqual(EMPTY_FORM)
    expect(presetForm({ ...callCenterOnly, operations: null })).toEqual(EMPTY_FORM)
  })
})

describe('picking a preset', () => {
  const page = {
    promoNumber: 'P000000123',
    selected: ['OMS000000011', 'OMS000000012'],
    form: { ...EMPTY_FORM, score: { op: 'set', value: '9' } } as BulkForm,
  }

  it('starts the form from the preset and leaves the promotion and the selection alone', () => {
    const next = pickPreset(page, callCenterOnly)
    expect(next.promoNumber).toBe('P000000123')
    expect(next.selected).toEqual(['OMS000000011', 'OMS000000012'])
    expect(next.form.score).toEqual({ op: 'set', value: '40' })
    expect(next.form.lists.excludes).toEqual({ op: 'add', value: '100234, 100567' })
  })

  it('replaces the whole form: a field the preset leaves goes back to Leave', () => {
    const only = { ...callCenterOnly, operations: { isStackable: { op: 'set', value: true } } } as BbyBulkPreset
    expect(pickPreset(page, only).form).toEqual({ ...EMPTY_FORM, isStackable: 'yes' })
  })

  it('the chip of the preset the form still matches is lit; an edited form matches none', () => {
    const other = { ...callCenterOnly, id: '01JF0000000000000000000002', operations: { loyGroups: { op: 'clear' } } } as BbyBulkPreset
    const presets = [other, callCenterOnly]
    const picked = pickPreset(page, callCenterOnly).form
    expect(matchingPreset(presets, picked)).toBe(callCenterOnly.id)
    expect(matchingPreset(presets, { ...picked, isStackable: 'yes' })).toBeNull()
    expect(matchingPreset(presets, EMPTY_FORM)).toBeNull()
  })
})

describe('saving the form as a preset', () => {
  const form: BulkForm = { ...EMPTY_FORM, score: { op: 'set', value: '40' } }

  it('Save as preset creates: no id, no version, the name trimmed, the operations the form names', () => {
    expect(presetSaveRequest(form, '  مركز الاتصال فقط ', null)).toEqual({
      request: { id: null, name: 'مركز الاتصال فقط', operations: { score: { op: 'set', value: 40 } }, version: null },
    })
  })

  it('an edit carries the preset id and the version it was loaded at (the server guards it)', () => {
    expect(presetSaveRequest(form, 'Call-center only', callCenterOnly)).toEqual({
      request: { id: callCenterOnly.id, name: 'Call-center only', operations: { score: { op: 'set', value: 40 } }, version: 'v1' },
    })
  })

  it('a blank name, a form with problems or a form that changes nothing is not sent', () => {
    expect(presetSaveRequest(form, '   ', null)).toEqual({ problem: 'name' })
    expect(presetSaveRequest({ ...form, maxValue: { op: 'set', value: '' } }, 'x', null)).toEqual({ problem: 'form' })
    expect(presetSaveRequest(EMPTY_FORM, 'x', null)).toEqual({ problem: 'nothing' })
  })
})

describe('the preset answer (in-band)', () => {
  const duplicate = { code: 'BBY-PRESET-DUPLICATE-NAME', english: 'A preset named "Call-center only" already exists.', arabic: 'يوجد إعداد مسبق بهذا الاسم.' }
  const stale = { code: 'BBY-PRESET-STALE', english: 'Someone changed this preset since you loaded it.', arabic: 'غيّر شخص آخر هذا الإعداد.' }

  it('a saved preset comes back with its new version', () => {
    const saved = { ...callCenterOnly, version: 'v2' }
    expect(readPresetOutcome({ status: 'saved', preset: saved, refusals: [], warnings: [] })).toEqual({ ok: true, preset: saved })
    expect(readPresetOutcome({ status: 'deleted', refusals: [], warnings: [] })).toEqual({ ok: true, preset: null })
    // Saved with no row echoed: still saved — the list is fetched again for the new version.
    expect(readPresetOutcome({ status: 'saved', refusals: [], warnings: [] })).toEqual({ ok: true, preset: null })
  })

  it('a duplicate name and a stale edit render their bilingual refusals, as the server words them', () => {
    expect(readPresetOutcome({ status: 'refused', refusals: [duplicate], warnings: [] })).toEqual({
      ok: false,
      refusals: [duplicate],
      fallback: null,
    })
    expect(readPresetOutcome({ status: 'refused', refusals: [stale], warnings: [] })).toEqual({ ok: false, refusals: [stale], fallback: null })
  })

  it('🚩 a refusal with no words, a preset gone, or an unknown status is shown, never read as saved', () => {
    expect(readPresetOutcome({ status: 'refused', refusals: [], warnings: [] })).toEqual({ ok: false, refusals: [], fallback: 'refused' })
    expect(readPresetOutcome({ status: 'notFound', refusals: [], warnings: [] })).toEqual({ ok: false, refusals: [], fallback: 'notFound' })
    expect(readPresetOutcome({ status: 'queued', refusals: [], warnings: [] } as never)).toEqual({ ok: false, refusals: [], fallback: 'unknown' })
  })
})
