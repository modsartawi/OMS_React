import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { useSession } from '@/core/session'
import type { CopilotAnswer, CopilotAskRequest, CopilotSqlPart } from '@/core/models/copilot'
import { answerLayout, copilotAnswerModel } from './answer'
import { canUseSqlMode } from './access'
import { askBody, EMPTY_CONVERSATION } from './conversation'
import { createCopilotConversation } from './conversation-store'
import { copilotRefusal } from './refusal'
import { toolLabelKey } from './trace'

/**
 * BackOffice spec 3632 Q27, Q28, Q33 (ticket 888): the panel's SQL mode. The wire is BackOffice 3673's (`sqlMode` on the
 * ask, `sql` on the answer) and 3674's (`sqlOffer` on a can't-answer); the grant is 3672's `canSql` on `Analytics/Access`.
 */

const reply = (over: Partial<CopilotAnswer> = {}): CopilotAnswer => ({
  conversationId: 'c-0001',
  questionNo: 1,
  answer: 'Riyadh sold the most last week.',
  orderRefs: [],
  trace: [],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-12T10:15:00',
  ...over,
})

/** A `Copilot/Ask` stand-in whose calls the test answers by hand. The origin (871) is kept beside the body. */
function door() {
  const calls: { body: CopilotAskRequest; origin?: CopilotAskRequest['origin']; answer: (r: CopilotAnswer) => void }[] = []
  const ask = ({ requestId: _id, origin, ...body }: CopilotAskRequest) =>
    new Promise<CopilotAnswer>((answer) => {
      calls.push({ body, origin, answer })
    })
  return { ask, calls }
}

afterEach(() => useSession.getState().clear())

describe('the SQL mode toggle shows for a grant holder only and sends the mode (Q27)', () => {
  it('is held only on canSql === true; absent, old or malformed is a denial', () => {
    expect(canUseSqlMode({ canView: true, canAuthor: true, canCurate: false, canSql: true })).toBe(true)
    expect(canUseSqlMode({ canView: true, canAuthor: true, canCurate: true, canSql: false })).toBe(false)
    // A pre-3672 server sends no canSql: no toggle.
    expect(canUseSqlMode({ canView: true, canAuthor: true, canCurate: true })).toBe(false)
    expect(canUseSqlMode({ canView: true, canAuthor: true, canCurate: false, canSql: 'true' } as never)).toBe(false)
    expect(canUseSqlMode(undefined)).toBe(false)
    expect(canUseSqlMode(null)).toBe(false)
  })

  it('the ask body says sqlMode: true only when the mode is on', () => {
    expect(askBody(EMPTY_CONVERSATION, 'Top stores?', { sqlMode: true })).toEqual({ question: 'Top stores?', sqlMode: true })
    expect(askBody(EMPTY_CONVERSATION, 'Top stores?', { sqlMode: false })).toEqual({ question: 'Top stores?' })
    expect(askBody(EMPTY_CONVERSATION, 'Top stores?')).toEqual({ question: 'Top stores?' })
  })

  it('the store sends the mode with the question when asked in it, and not otherwise', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().ask('Top 5 stores by sales last week?', { sqlMode: true })
    expect(d.calls[0].body).toEqual({ question: 'Top 5 stores by sales last week?', sqlMode: true })
    d.calls[0].answer(reply())
    await first
    const next = store.getState().ask('And by region?')
    expect(d.calls[1].body).toEqual({ question: 'And by region?', conversationId: 'c-0001' })
    d.calls[1].answer(reply({ questionNo: 2 }))
    await next
  })

  it('the toggle is held in the store, starts off and is dropped when the user changes', () => {
    const store = createCopilotConversation(door().ask)
    expect(store.getState().sqlMode).toBe(false)
    store.getState().setSqlMode(true)
    expect(store.getState().sqlMode).toBe(true)
    useSession.setState({ userId: 'someone-else' })
    expect(store.getState().sqlMode).toBe(false)
  })
})

describe('the "Try in SQL mode" offer re-asks with the mode on (Q28)', () => {
  it('is read off a can\'t-answer; absent on every other answer', () => {
    const offered = copilotAnswerModel(reply({ outcome: 'cannot-answer', sqlOffer: { question: 'Top stores?', conversationId: 'c-0001' } }))
    expect(offered.sqlOffer).toEqual({ question: 'Top stores?', conversationId: 'c-0001' })
    expect(copilotAnswerModel(reply()).sqlOffer).toBeNull()
    // A malformed offer (no question) is no offer.
    expect(copilotAnswerModel(reply({ sqlOffer: { conversationId: 'c-0001' } as never })).sqlOffer).toBeNull()
  })

  it('a tap asks the same question in the same conversation with the mode on, and turns the toggle on', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().ask('Top stores by basket size?')
    d.calls[0].answer(reply({ outcome: 'cannot-answer', sqlOffer: { question: 'Top stores by basket size?', conversationId: 'c-0001' } }))
    await first
    const again = store.getState().trySqlOffer({ question: 'Top stores by basket size?', conversationId: 'c-0001' })
    expect(again).not.toBeNull()
    expect(d.calls[1].body).toEqual({ question: 'Top stores by basket size?', conversationId: 'c-0001', sqlMode: true })
    expect(store.getState().sqlMode).toBe(true)
    d.calls[1].answer(reply({ questionNo: 2 }))
    await again
    expect(store.getState().conv.turns).toHaveLength(2)
  })

  it('a null conversation id (its last question) starts a new conversation for the tap', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().ask('Q10?')
    d.calls[0].answer(reply({ questionNo: 10, outcome: 'cannot-answer', sqlOffer: { question: 'Q10?', conversationId: null } }))
    await first
    store.getState().trySqlOffer({ question: 'Q10?', conversationId: null })
    expect(d.calls[1].body).toEqual({ question: 'Q10?', sqlMode: true })
    // The full conversation is filed in the history, as "New conversation" does.
    expect(store.getState().history).toHaveLength(1)
    expect(store.getState().conv.turns).toHaveLength(0)
  })
})

const SQL: CopilotSqlPart = {
  mark: 'sql',
  ran: true,
  step: 1,
  statement: 'SELECT TOP 1001\n    StoreCode,\n    SUM(Sales) AS Sales\nFROM Fact_Sales\nGROUP BY StoreCode',
  tables: ['Fact_Sales', 'Dim_Store'],
  columns: ['StoreCode', 'Sales'],
  rows: [
    ['S101', '1200.500'],
    ['S102', null],
    ['S103', '980'],
  ],
  rowCount: 3,
  isCut: false,
  durationMs: 412,
}

describe('a SQL answer draws its mark, rows, statement and the tables it read (Q33)', () => {
  it('reads the SQL part whole: every row, the statement, the tables, the count, the time, the cut', () => {
    const model = copilotAnswerModel(reply({ sql: SQL }))
    expect(model.sql).toEqual({
      ran: true,
      statement: SQL.statement,
      tables: ['Fact_Sales', 'Dim_Store'],
      columns: ['StoreCode', 'Sales'],
      rows: [
        ['S101', '1200.500'],
        ['S102', null],
        ['S103', '980'],
      ],
      rowCount: 3,
      isCut: false,
      durationMs: 412,
    })
  })

  it('reads the statement as authored beside the one the server ran (3632 review, item 14)', () => {
    expect(copilotAnswerModel(reply({ sql: { ...SQL, authoredStatement: 'select StoreCode, sum(Sales) from Fact_Sales group by StoreCode' } })).sql?.authoredStatement).toBe(
      'select StoreCode, sum(Sales) from Fact_Sales group by StoreCode',
    )
    expect(copilotAnswerModel(reply({ sql: SQL })).sql).not.toHaveProperty('authoredStatement')
  })

  it('draws the SQL part right under the text, before anything else', () => {
    const model = copilotAnswerModel(reply({ sql: { ...SQL, rows: [], tables: [], columns: [] }, assumptions: [{ en: 'Last week.', ar: 'الأسبوع الماضي.' }] }))
    expect(answerLayout(model).parts).toEqual(['text', 'sql', 'assumptions'])
  })

  it('a SQL part where no statement ran still carries its mark, with no rows', () => {
    const model = copilotAnswerModel(
      reply({ outcome: 'cannot-answer', sql: { mark: 'sql', ran: false, step: null, statement: '', tables: [], columns: [], rows: [], rowCount: 0, isCut: false, durationMs: 0 } }),
    )
    expect(model.sql?.ran).toBe(false)
    expect(answerLayout(model).parts).toContain('sql')
  })

  it('a cut result says so, and keeps its count', () => {
    const model = copilotAnswerModel(reply({ sql: { ...SQL, rows: [['S101', '1']], tables: [], columns: ['StoreCode', 'Sales'], rowCount: 1000, isCut: true } }))
    expect(model.sql?.isCut).toBe(true)
    expect(model.sql?.rowCount).toBe(1000)
  })

  it('a ragged or odd row is read to the columns, a non-text cell as NULL', () => {
    const model = copilotAnswerModel(reply({ sql: { ...SQL, rows: [['S101'], ['S102', '5', 'extra'], 'junk', ['S104', 7]] as never } }))
    expect(model.sql?.rows).toEqual([
      ['S101', null],
      ['S102', '5'],
      ['S104', null],
    ])
  })

  it('the two SQL tools have their own words in the lookups', () => {
    expect(toolLabelKey('run_sql')).toBe('trace.tools.run_sql')
    expect(toolLabelKey('describe_tables')).toBe('trace.tools.describe_tables')
  })
})

describe('an answer with no SQL part draws as today', () => {
  it('has no SQL part and no offer, and the same layout', () => {
    const model = copilotAnswerModel(reply())
    expect(model.sql).toBeNull()
    expect(model.sqlOffer).toBeNull()
    expect(answerLayout(model)).toEqual({ figuresOnly: false, parts: ['text'], lookups: 'none' })
  })

  it('a malformed SQL part (no statement or rows list) is no SQL part', () => {
    expect(copilotAnswerModel(reply({ sql: { mark: 'sql' } as never })).sql).toBeNull()
    expect(copilotAnswerModel(reply({ sql: null as never })).sql).toBeNull()
  })
})

// 3632 Q46 (BackOffice 3678): "Change by asking" opens the panel on a SQL item. The conversation starts anew in SQL mode, and
// its first question carries `sqlItemContext { itemId }`; follow-ups do not (the conversation already holds the statement).
describe('a SQL item opened in the copilot sends its context with the first question only (Q46)', () => {
  it('starts a new conversation in SQL mode and sends the item with the first question', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const before = store.getState().ask('Anything?')
    d.calls[0].answer(reply())
    await before
    store.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    expect(store.getState().sqlMode).toBe(true)
    expect(store.getState().conv.turns).toEqual([])
    expect(store.getState().history).toHaveLength(1)
    expect(store.getState().sqlItem).toEqual({ itemId: 'q1', revision: 3 })
    const first = store.getState().ask('Only Riyadh, please', { sqlMode: true })
    expect(d.calls[1].body).toEqual({ question: 'Only Riyadh, please', sqlMode: true, sqlItemContext: { itemId: 'q1' } })
    d.calls[1].answer(reply({ conversationId: 'c-0002' }))
    await first
    const next = store.getState().ask('And last month?', { sqlMode: true })
    expect(d.calls[2].body).toEqual({ question: 'And last month?', conversationId: 'c-0002', sqlMode: true })
    d.calls[2].answer(reply({ conversationId: 'c-0002', questionNo: 2 }))
    await next
    // The conversation still edits that item, for the answer's Edit.
    expect(store.getState().sqlItem).toEqual({ itemId: 'q1', revision: 3 })
  })

  it('a question asked with the mode off does not carry the item, and leaves it for the first SQL question', () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    store.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    store.getState().ask('Change it')
    expect(d.calls[0].body).toEqual({ question: 'Change it' })
  })

  it('a new conversation, or another user, drops the item', () => {
    const store = createCopilotConversation(door().ask)
    store.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    store.getState().startNew()
    expect(store.getState().sqlItem).toBeNull()
    store.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    useSession.setState({ userId: 'someone-else' })
    expect(store.getState().sqlItem).toBeNull()
  })

  it('COPILOT-456 has its own words', () => {
    expect(copilotRefusal(new ApiError('business', 'No.', 400, [{ errorCode: 'COPILOT-456', internalErrorCode: '', errorMessage: 'No.' }]), 'x')).toEqual({
      key: 'refusal.sqlItemNotOpenable',
      resetAt: null,
    })
  })
})
