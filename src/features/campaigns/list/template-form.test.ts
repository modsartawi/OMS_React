import { describe, expect, it } from 'vitest'
import type { RuleTemplate } from '@/core/models/rule-campaign'
import {
  placeholderKind,
  placeholderLookup,
  templateBody,
  templateFormFor,
  templateFormId,
  templateProblems,
  templateReady,
  type TemplateForm,
} from './template-form'

/** The prototype's "Spend X, get Y% off a category", as `Templates/List` answers it (2759). */
const SPEND: RuleTemplate = {
  code: 'T-SPEND-PCT',
  name: { en: 'Spend X, get Y% off a category', ar: 'أنفق واحصل على خصم' },
  revision: 2,
  features: [],
  campaign: {
    id: 'T-SPEND-PCT',
    name: { en: 'Spend SAR 200, get 10% off', ar: 'أنفق 200 ريال واحصل على خصم 10%' },
    rules: [],
  },
  placeholders: [
    { name: 'minSpend', label: { en: 'Minimum basket', ar: 'الحد الأدنى للسلة' }, path: 'rules[0].when[0].amount', default: 200 },
    { name: 'pct', label: { en: 'Percent off', ar: 'نسبة الخصم' }, path: 'rules[0].then[0].value', default: 10 },
    { name: 'cats', label: { en: 'Category', ar: 'الفئة' }, path: 'rules[0].filters[0].categories', default: ['A002'] },
    { name: 'label', label: { en: 'Receipt label', ar: 'نص الإيصال' }, path: 'rules[0].then[0].label.en', default: '10% off' },
    { name: 'fees', label: { en: 'Fees too', ar: 'الرسوم أيضاً' }, path: 'rules[0].then[0].scope', default: false },
    { name: 'window', label: { en: 'Window', ar: 'الفترة' }, path: 'window', default: { from: '2026-11-01' } },
  ],
  updatedAt: '2026-10-10T09:00:00',
  updatedBy: 'Omar (marketing)',
}

describe('the placeholder kinds', () => {
  it('follow the default’s JSON: a number, a text, yes / no, a list of codes, anything else JSON', () => {
    expect(SPEND.placeholders.map(placeholderKind)).toEqual(['number', 'number', 'codes', 'text', 'bool', 'json'])
    expect(placeholderKind({ default: null })).toBe('json')
    expect(placeholderKind({ default: [1, 2] })).toBe('json')
  })

  it('a list of codes is picked through the lookup its path’s field names', () => {
    expect(placeholderLookup({ path: 'rules[0].filters[0].categories' })).toBe('categories')
    expect(placeholderLookup({ path: 'rules[0].filters[1].articles' })).toBe('materials')
    expect(placeholderLookup({ path: 'audience.stores' })).toBe('stores')
    expect(placeholderLookup({ path: 'audience.channels' })).toBeNull()
  })
})

describe('templateForm', () => {
  it('starts each placeholder at its default and the names at the template campaign’s', () => {
    const form = templateFormFor(SPEND)
    expect(form.values).toEqual({ minSpend: '200', pct: '10', cats: ['A002'], label: '10% off', fees: 'false', window: '{"from":"2026-11-01"}' })
    expect(form).toMatchObject({ nameEn: 'Spend SAR 200, get 10% off', nameAr: 'أنفق 200 ريال واحصل على خصم 10%', idEdited: false })
    expect(templateFormId(form)).toBe('SPEND-SAR-200-GET-10-OFF')
  })

  it('refuses an empty value, a non-number, a list with no code and text that is not JSON', () => {
    const form = templateFormFor(SPEND)
    expect(templateReady(templateProblems(SPEND, form))).toBe(true)
    const bad: TemplateForm = { ...form, values: { ...form.values, minSpend: ' ', pct: '1e1', cats: [], label: '', window: '{from:' } }
    expect(templateProblems(SPEND, bad).values).toEqual([
      { name: 'minSpend', problem: 'required' },
      { name: 'pct', problem: 'notNumber' },
      { name: 'cats', problem: 'required' },
      { name: 'label', problem: 'required' },
      { name: 'window', problem: 'notJson' },
    ])
  })

  it('wants both names and an id it can use', () => {
    const form = { ...templateFormFor(SPEND), nameAr: ' ' }
    expect(templateProblems(SPEND, form)).toMatchObject({ nameArRequired: true, nameEnRequired: false, id: null })
    expect(templateProblems(SPEND, { ...form, idEdited: true, id: 'priority' }).id).toBe('idReserved')
    expect(templateProblems(SPEND, { ...form, idEdited: true, id: 'WKND20' }, ['WKND20']).id).toBe('idTaken')
  })
})

describe('templateBody_sendsJsonByPlaceholderName', () => {
  it('sends each value as the JSON its kind says, the picked id and both names trimmed', () => {
    const form: TemplateForm = {
      ...templateFormFor(SPEND),
      values: { minSpend: ' 250 ', pct: '15', cats: ['A002', 'A003'], label: ' 15% off ', fees: 'true', window: '{"from":"2026-12-01","until":"2026-12-31"}' },
      nameEn: ' Spend 250 ',
      nameAr: ' أنفق 250 ',
      idEdited: true,
      id: ' SPEND-250 ',
    }
    expect(templateBody(SPEND, form)).toEqual({
      template: 'T-SPEND-PCT',
      campaign: 'SPEND-250',
      name: { en: 'Spend 250', ar: 'أنفق 250' },
      values: { minSpend: 250, pct: 15, cats: ['A002', 'A003'], label: '15% off', fees: true, window: { from: '2026-12-01', until: '2026-12-31' } },
    })
  })

  it('a list of codes typed by hand is split at its commas', () => {
    const t: RuleTemplate = { ...SPEND, placeholders: [{ name: 'ch', label: { en: 'Channels', ar: '' }, path: 'audience.channels', default: ['POS'] }] }
    const form = { ...templateFormFor(t), values: { ch: 'POS, CC ,' } }
    expect(templateProblems(t, form).values).toEqual([])
    expect(templateBody(t, form).values).toEqual({ ch: ['POS', 'CC'] })
  })
})
