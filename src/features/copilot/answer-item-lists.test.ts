import { describe, expect, it } from 'vitest'
import type { CopilotAnswer } from '@/core/models/copilot'
import { answerLayout, copilotAnswerModel } from './answer'
import { calendarWarnings, formatChange, listPeriodsTable, usedListRows } from './answer-item-lists'

// oms-react 926 (BackOffice spec 4057, tickets 4060/4061): an answer that used an item list carries the server's
// "Used" line under its assumption lines, with a link to the list; a `list_periods` answer carries its comparison,
// drawn as a table with a per-status total, and the calendar overlaps as warning lines.

const reply: Partial<CopilotAnswer> = {
  conversationId: 'c-1',
  questionNo: 1,
  answer: 'Shortage Q3 recovered 18% per day once available.',
  trace: [{ tool: 'list_periods', input: { itemList: 'L-7' }, rows: 3, ms: 900, ok: true }],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude',
  assumptions: [{ en: 'Last month is October.', ar: 'الشهر الماضي هو أكتوبر.' }],
}

const usedLists = [
  {
    listId: 'L-7',
    name: 'Shortage Q3',
    version: 4,
    members: 38,
    line: { en: 'Used: Shortage Q3 (v4), 38 items, periods stated by the team', ar: 'المستخدمة: Shortage Q3 (الإصدار 4)، 38 صنفًا، فترات حددها الفريق' },
  },
]

const listPeriods = {
  step: 0,
  listId: 'L-7',
  measure: 'units',
  members: [
    {
      level: 'item',
      key: '100234',
      label: 'Panadol 500mg',
      noPeriods: false,
      change: 0.18,
      segments: [
        { status: 'available', days: 30, perDay: 118 },
        { status: 'unavailable', days: 12, perDay: 100 },
      ],
    },
    { level: 'brand', key: 'NUTRI', label: 'Nutri', noPeriods: false, change: -0.05, segments: [{ status: 'blocked', days: 5, perDay: 40 }, { status: 'available', days: 20, perDay: 38 }] },
    { level: 'item', key: '100999', label: 'Brufen 400mg', noPeriods: true, change: null, segments: [] },
  ],
  totals: [
    { status: 'available', days: 50, perDay: 156 },
    { status: 'unavailable', days: 12, perDay: 100 },
    { status: 'blocked', days: 5, perDay: 40 },
  ],
  overlaps: [
    {
      member: 'Panadol 500mg',
      status: 'unavailable',
      from: '2026-02-20',
      to: '2026-03-03',
      event: { en: 'Ramadan', ar: 'رمضان' },
      eventFrom: '2026-02-18',
      eventTo: '2026-03-19',
    },
  ],
} as unknown as CopilotAnswer['listPeriods']

describe('the "Used" line (BO 4061): the server’s words, linked to the list', () => {
  it('reads the line in the question’s language, and links the list by its route', () => {
    const model = copilotAnswerModel({ ...reply, usedLists } as Partial<CopilotAnswer>)
    expect(usedListRows(model, 'en')).toEqual([
      { listId: 'L-7', text: 'Used: Shortage Q3 (v4), 38 items, periods stated by the team', href: '/analytics/itemlist/L-7' },
    ])
    expect(usedListRows(model, 'ar')[0].text).toBe('المستخدمة: Shortage Q3 (الإصدار 4)، 38 صنفًا، فترات حددها الفريق')
  })
  it('is drawn right under the assumption lines', () => {
    const parts = answerLayout(copilotAnswerModel({ ...reply, usedLists } as Partial<CopilotAnswer>)).parts
    expect(parts.slice(parts.indexOf('assumptions'), parts.indexOf('assumptions') + 2)).toEqual(['assumptions', 'usedLists'])
  })
  it('an entry with no id, or no words, is left out; an answer without one draws nothing new', () => {
    const odd = [{ name: 'x', line: { en: 'Used: x', ar: '' } }, { listId: 'L-8', line: { en: '', ar: '' } }, 'junk']
    expect(copilotAnswerModel({ ...reply, usedLists: odd } as unknown as Partial<CopilotAnswer>).usedLists).toEqual([])
    const plain = copilotAnswerModel(reply)
    expect(plain.usedLists).toEqual([])
    expect(answerLayout(plain).parts).not.toContain('usedLists')
  })
  it('a line missing in Arabic reads the English one', () => {
    const model = copilotAnswerModel({ ...reply, usedLists: [{ ...usedLists[0], line: { en: 'Used: Shortage Q3 (v4)', ar: '' } }] } as Partial<CopilotAnswer>)
    expect(usedListRows(model, 'ar')[0].text).toBe('Used: Shortage Q3 (v4)')
  })
})

describe('list_periods (BO 4060): a table of each member’s per-day sales by status, with a per-status total', () => {
  const model = copilotAnswerModel({ ...reply, listPeriods } as Partial<CopilotAnswer>)

  it('is its own part, after the answer’s tables', () => {
    expect(answerLayout(model).parts).toContain('listPeriods')
  })
  it('one column per status present, in the statuses’ fixed order', () => {
    expect(listPeriodsTable(model.listPeriods!).statuses).toEqual(['unavailable', 'blocked', 'available'])
  })
  it('one row per member, its per-day figure under each status (none where it had no such period), and its change', () => {
    expect(listPeriodsTable(model.listPeriods!).rows).toEqual([
      { key: 'item:100234', member: 'Panadol 500mg', level: 'item', noPeriods: false, perDay: [100, null, 118], change: 0.18 },
      { key: 'brand:NUTRI', member: 'Nutri', level: 'brand', noPeriods: false, perDay: [null, 40, 38], change: -0.05 },
      { key: 'item:100999', member: 'Brufen 400mg', level: 'item', noPeriods: true, perDay: [null, null, null], change: null },
    ])
  })
  it('the total row is the server’s per-status total, under the same columns', () => {
    expect(listPeriodsTable(model.listPeriods!).totals).toEqual([100, 40, 156])
  })
  it('a reply without the part, or with a malformed one, draws none', () => {
    expect(copilotAnswerModel(reply).listPeriods).toBeNull()
    expect(copilotAnswerModel({ ...reply, listPeriods: { members: 'x' } } as unknown as Partial<CopilotAnswer>).listPeriods).toBeNull()
    expect(answerLayout(copilotAnswerModel(reply)).parts).not.toContain('listPeriods')
  })
  it('the change reads as a signed percent with one decimal', () => {
    expect(formatChange(0.18)).toBe('+18.0%')
    expect(formatChange(-0.05)).toBe('-5.0%')
    expect(formatChange(0)).toBe('0.0%')
    expect(formatChange(null)).toBe('')
  })
})

describe('the calendar warning (BO 4060): a period that overlaps Ramadan, an Eid, a national day or salary week', () => {
  it('one warning per overlap, the event named in the line’s language', () => {
    const model = copilotAnswerModel({ ...reply, listPeriods } as Partial<CopilotAnswer>)
    expect(calendarWarnings(model.listPeriods!, 'en')).toEqual([
      { member: 'Panadol 500mg', status: 'unavailable', period: '2026-02-20 – 2026-03-03', open: false, event: 'Ramadan', eventPeriod: '2026-02-18 – 2026-03-19' },
    ])
    expect(calendarWarnings(model.listPeriods!, 'ar')[0].event).toBe('رمضان')
  })
  it('an open period reads to today; no overlaps, no warning', () => {
    const open = { ...listPeriods!, overlaps: [{ ...listPeriods!.overlaps[0], to: null, member: null }] }
    const model = copilotAnswerModel({ ...reply, listPeriods: open } as Partial<CopilotAnswer>)
    expect(calendarWarnings(model.listPeriods!, 'en')[0]).toMatchObject({ member: null, period: '2026-02-20', open: true })
    const none = copilotAnswerModel({ ...reply, listPeriods: { ...listPeriods!, overlaps: [] } } as Partial<CopilotAnswer>)
    expect(calendarWarnings(none.listPeriods!, 'en')).toEqual([])
  })
})
