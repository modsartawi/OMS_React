import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-promotions.json'
import {
  ASSIGN_MAX,
  EMPTY_PROMOTION_FORM,
  PROMOTION_REFUSAL_REASONS,
  assignmentLine,
  assignmentSummary,
  promotionCodeError,
  promotionEmptiness,
  promotionFormProblems,
  promotionRefusalView,
  refusalKey,
  sendable,
  toPromotionBody,
  togglePick,
} from './promotion-write'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'campaign-promotions': en } },
  ns: ['campaign-promotions'],
  defaultNS: 'campaign-promotions',
  initAsync: false,
  interpolation: { escapeValue: false },
})
/** A sentence as the page draws it, its component tags (the isolates) dropped. */
const plain = (key: string, values: Record<string, unknown>) => instance.t(key, values).replace(/<\/?\w+>/g, '')

describe('promotionCodeError', () => {
  it('refuses an empty code, and one of blanks only', () => {
    expect(promotionCodeError('')).toBe('required')
    expect(promotionCodeError('   ')).toBe('required')
  })

  it('refuses 39 characters and takes 38', () => {
    expect(promotionCodeError('A'.repeat(39))).toBe('tooLong')
    expect(promotionCodeError('A'.repeat(38))).toBeNull()
  })

  it('refuses a space or a slash inside the code', () => {
    expect(promotionCodeError('EID GIFTS')).toBe('characters')
    expect(promotionCodeError('EID/GIFTS')).toBe('characters')
    expect(promotionCodeError('عيد')).toBe('characters')
  })

  it('takes letters, digits, dots, underscores and dashes', () => {
    expect(promotionCodeError('0001-W43_ad.hoc')).toBeNull()
  })

  it('weighs the code as HQ trims it', () => {
    expect(promotionCodeError('  RAMADAN-BUNDLES ')).toBeNull()
  })
})

describe('promotionFormProblems', () => {
  it('a new promotion needs a code and an English name', () => {
    expect(promotionFormProblems(EMPTY_PROMOTION_FORM)).toEqual(['code.required', 'nameEnRequired'])
    expect(promotionFormProblems({ ...EMPTY_PROMOTION_FORM, promotionCode: 'EID', nameEn: 'Eid gifts' })).toEqual([])
  })

  it('a rename never checks the code (it is HQ\'s and never changes)', () => {
    expect(promotionFormProblems({ ...EMPTY_PROMOTION_FORM, promotionCode: 'x'.repeat(50), nameEn: ' ' }, { renaming: true })).toEqual(['nameEnRequired'])
  })

  it('sends every field as shown, trimmed: an empty Arabic name or note is sent, never null', () => {
    expect(toPromotionBody({ promotionCode: ' EID ', nameEn: ' Eid gifts ', nameAr: '', note: '' })).toEqual({ promotionCode: 'EID', nameEn: 'Eid gifts', nameAr: '', note: '' })
  })
})

describe('assignmentSummary', () => {
  it('reads "3 assigned, 1 moved from X"', () => {
    const summary = assignmentSummary({ changed: ['a', 'b', 'c'], moved: [{ id: 'c', from: 'X' }] })
    expect(summary).toEqual({ assigned: 3, moved: [{ from: 'X', count: 1 }] })
    const line = assignmentLine(summary)
      .map((p) => plain(p.key, p.key === 'assign.done' ? { n: p.count } : { n: p.count, from: p.from }))
      .join('')
    expect(line).toBe('3 assigned, 1 moved from X')
  })

  it('groups the moved campaigns by the promotion they left, in the order HQ named them', () => {
    expect(
      assignmentSummary({
        changed: ['a', 'b', 'c', 'd'],
        moved: [
          { id: 'a', from: 'Y' },
          { id: 'b', from: 'X' },
          { id: 'c', from: 'Y' },
        ],
      }),
    ).toEqual({ assigned: 4, moved: [{ from: 'Y', count: 2 }, { from: 'X', count: 1 }] })
  })

  it('none moved: the line is the count assigned alone', () => {
    expect(assignmentLine(assignmentSummary({ changed: ['a', 'b'], moved: [] }))).toEqual([{ key: 'assign.done', count: 2 }])
  })
})

describe('the pick', () => {
  it('toggles an id, keeping the order picked', () => {
    expect(togglePick(['a'], 'b')).toEqual(['a', 'b'])
    expect(togglePick(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('one call names 1 to 2,000 campaigns', () => {
    expect(sendable(0)).toBe(false)
    expect(sendable(1)).toBe(true)
    expect(sendable(ASSIGN_MAX)).toBe(true)
    expect(sendable(ASSIGN_MAX + 1)).toBe(false)
  })
})

describe('promotionEmptiness', () => {
  it('a promotion the list counts campaigns for holds them, whatever the table has read', () => {
    expect(promotionEmptiness(2, undefined)).toBe('held')
    expect(promotionEmptiness(2, 0)).toBe('held')
  })

  it('none counted: the unfiltered table decides (a pending upload\'s rows are not counted)', () => {
    expect(promotionEmptiness(0, 0)).toBe('empty')
    expect(promotionEmptiness(0, 3)).toBe('held')
  })

  it('none counted and the table not read: unknown, never "unassign them first"', () => {
    expect(promotionEmptiness(0, undefined)).toBe('unknown')
  })
})

describe('promotionRefusalView', () => {
  const view = (code: string | null, details: string[] = [], bareDenial = false) => promotionRefusalView({ code, bareDenial, details })

  it.each([
    ['RULES_PROMOTION_EXISTS', 'exists'],
    ['RULES_PROMOTION_OWNED', 'owned'],
    ['RULES_PROMOTION_NOT_EMPTY', 'notEmpty'],
    ['RULES_PROMOTION_CAMPAIGN_NOT_FOUND', 'campaignNotFound'],
    ['RULES_PROMOTION_NOT_FOUND', 'notFound'],
    ['RULES_PROMOTION_BAD', 'bad'],
  ])('%s reads as %s and keeps its detail lines', (code, reason) => {
    const lines = ['Campaign 0001000048-261009-261015-S1 belongs to upload 0001000048-261009-261015.', 'Campaign X-2 belongs to upload X.']
    expect(view(code, lines)).toEqual({ reason, details: lines })
  })

  it('a bare 403 is the missing grant', () => {
    expect(view(null, [], true)).toEqual({ reason: 'denied', details: [] })
  })

  it('a code the dialogs have no words for is HQ\'s message alone', () => {
    expect(view('RULES_SOMETHING_NEW', ['a line'])).toEqual({ reason: null, details: ['a line'] })
    expect(view(null)).toEqual({ reason: null, details: [] })
  })

  it('every reason has its words in the namespace', () => {
    for (const reason of PROMOTION_REFUSAL_REASONS) expect(instance.exists(refusalKey(reason)), reason).toBe(true)
    expect(instance.t(refusalKey('denied'))).toBe('You do not have access to this action.')
  })
})
