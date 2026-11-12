import { describe, expect, it } from 'vitest'
import type { CopilotAnswer } from '@/core/models/copilot'
import { COPILOT_MAX_QUESTION, answerBlocks, answerLayout, answerPlainText, askView, assumptionLines, copilotAnswerModel, inlineMarks, orderSegments, questionFits, suggestionButtons, viewHref } from './answer'

describe('the answer view model (spec 734 D10, D11)', () => {
  it('copilotAnswerModel_readsABareAnswerAsEmpty', () => {
    // A reply missing `trace`, `orderRefs` and `answer` — what a young door or a partial
    // envelope can send — builds a model with nothing in it, and does not throw.
    const bare = { conversationId: 'c-1', questionNo: 1 } as Partial<CopilotAnswer>
    const model = copilotAnswerModel(bare)
    expect(model.blocks).toEqual([])
    expect(model.orderRefs).toEqual([])
    expect(model.trace).toEqual([])
    expect(model.stoppedEarly).toBe(false)
    expect(model.conversationId).toBe('c-1')

    // …and so does no reply at all, or one whose lists are not lists.
    expect(copilotAnswerModel(null).blocks).toEqual([])
    const odd = { answer: null, trace: 'x', orderRefs: 7 } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(odd)).toMatchObject({ blocks: [], trace: [], orderRefs: [], conversationId: null })
  })

  it('copilotAnswerModel_readsParagraphsBulletsAndSimpleTables', () => {
    const answer = [
      'Order 1234 was 42 minutes late.',
      'The pick ran long.',
      '',
      '- Callout round 1 at 3 km',
      '* Round 2 widened to 6 km',
      '',
      '| Week | Orders |',
      '|---|---:|',
      '| This | 120 |',
      '| Last | 98 |',
      '',
      'That is all.',
    ].join('\n')
    expect(copilotAnswerModel({ answer }).blocks).toEqual([
      { kind: 'paragraph', text: 'Order 1234 was 42 minutes late.\nThe pick ran long.' },
      { kind: 'list', items: ['Callout round 1 at 3 km', 'Round 2 widened to 6 km'] },
      { kind: 'table', head: ['Week', 'Orders'], rows: [['This', '120'], ['Last', '98']] },
      { kind: 'paragraph', text: 'That is all.' },
    ])
  })
})

describe('the answer reads the markdown models actually send', () => {
  it('readsHeadingsAndNumberedLists', () => {
    const answer = ['### Returns, October', '1. In store', '2) Call centre', '', 'Done.'].join('\n')
    expect(copilotAnswerModel({ answer }).blocks).toEqual([
      { kind: 'heading', text: 'Returns, October' },
      { kind: 'list', items: ['In store', 'Call centre'], ordered: true },
      { kind: 'paragraph', text: 'Done.' },
    ])
  })

  it('inlineMarks_readsBoldItalicAndCode_leavesALoneAsteriskAlone', () => {
    // The screenshot's case: a bolded table cell must not show its asterisks.
    expect(inlineMarks('**Count (Receipts)**')).toEqual([{ text: 'Count (Receipts)', mark: 'strong' }])
    expect(inlineMarks('Sales of __2,425__ and *rising*, see `till_sales`.')).toEqual([
      { text: 'Sales of ', mark: null },
      { text: '2,425', mark: 'strong' },
      { text: ' and ', mark: null },
      { text: 'rising', mark: 'em' },
      { text: ', see ', mark: null },
      { text: 'till_sales', mark: 'code' },
      { text: '.', mark: null },
    ])
    expect(inlineMarks('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15', mark: null }])
    expect(inlineMarks('')).toEqual([])
  })
})

describe('the answer links its orders (spec 734 D10, D11; ticket 736)', () => {
  it('copilotAnswerModel_linksEveryOrderRef', () => {
    const model = copilotAnswerModel({
      answer: 'Order 7000123456 was late; 8000000253 was not.',
      orderRefs: ['7000123456', '8000000253', '123'],
    })
    // Every ref found in the text is a link segment, wherever it sits — twice, at the start, at the end.
    expect(orderSegments('7000123456 and 8000000253, then 7000123456', model.orderRefs)).toEqual([
      { kind: 'order', no: '7000123456' },
      { kind: 'text', text: ' and ' },
      { kind: 'order', no: '8000000253' },
      { kind: 'text', text: ', then ' },
      { kind: 'order', no: '7000123456' },
    ])
    // A ref inside a longer number is not that order: "123" never links part of 70001234567.
    expect(orderSegments('Store 70001234567 and order 123.', ['123'])).toEqual([
      { kind: 'text', text: 'Store 70001234567 and order ' },
      { kind: 'order', no: '123' },
      { kind: 'text', text: '.' },
    ])
    // Text without a ref stays plain, and no refs at all leaves the text whole.
    expect(orderSegments('No order here.', model.orderRefs)).toEqual([{ kind: 'text', text: 'No order here.' }])
    expect(orderSegments('Order 7000123456.', [])).toEqual([{ kind: 'text', text: 'Order 7000123456.' }])
    expect(orderSegments('', ['1'])).toEqual([])
  })
})

describe('the answer links the views it created (spec 766 D; ticket 781)', () => {
  it('answer_viewRefsBecomeOpenViewLinks_absentViewRefsReadAsEmpty', () => {
    const model = copilotAnswerModel({
      answer: 'I saved the chart as a view.',
      viewRefs: [
        { id: 'v-42', title: { en: 'Orders by channel, last 4 weeks', ar: 'الطلبات حسب القناة' } },
        { id: 'v 7/x', title: { en: 'Late orders', ar: '' } },
      ],
    } as Partial<CopilotAnswer>)
    // Each ref keeps its id and both titles, and links to its view by route string.
    expect(model.viewRefs).toEqual([
      { id: 'v-42', title: { en: 'Orders by channel, last 4 weeks', ar: 'الطلبات حسب القناة' } },
      { id: 'v 7/x', title: { en: 'Late orders', ar: '' } },
    ])
    expect(model.viewRefs.map((v) => viewHref(v.id))).toEqual(['/analytics/view/v-42', '/analytics/view/v%207%2Fx'])

    // A reply without viewRefs (every pre-3383 server) reads as none; so does one that is not a list.
    expect(copilotAnswerModel({ answer: 'x' }).viewRefs).toEqual([])
    expect(copilotAnswerModel(null).viewRefs).toEqual([])
    expect(copilotAnswerModel({ viewRefs: 'v-1' } as unknown as Partial<CopilotAnswer>).viewRefs).toEqual([])

    // A malformed ref is dropped (no id); a missing or partial title reads as blank text.
    const odd = {
      viewRefs: [null, { title: { en: 'No id' } }, { id: '' }, { id: 9 }, { id: 'v-3', title: { en: 'Only English' } }],
    } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(odd).viewRefs).toEqual([
      { id: '9', title: { en: '', ar: '' } },
      { id: 'v-3', title: { en: 'Only English', ar: '' } },
    ])
  })
})

describe('the question limit (spec 734 D7)', () => {
  it('copilotQuestion_holdsAtMostAThousandCharacters', () => {
    expect(COPILOT_MAX_QUESTION).toBe(1000)
    expect(questionFits('a'.repeat(1000))).toBe(true)
    expect(questionFits('a'.repeat(1001))).toBe(false)
    expect(questionFits('   ')).toBe(false)
  })
})

describe('the answer names its house rules (ticket 790)', () => {
  it('promptVersion_aNumberIsRulesN_zeroIsBuiltIn_absentIsNothing', () => {
    expect(copilotAnswerModel({ answer: 'x', promptVersion: 3 }).rules).toEqual({ kind: 'version', n: 3 })
    expect(copilotAnswerModel({ answer: 'x', promptVersion: 0 }).rules).toEqual({ kind: 'builtIn' })
    expect(copilotAnswerModel({ answer: 'x' }).rules).toBeNull()
    expect(copilotAnswerModel(null).rules).toBeNull()
    // Not a whole, non-negative number: nothing, never "rules vNaN".
    for (const odd of ['3', -1, 1.5, Number.NaN, null])
      expect(copilotAnswerModel({ promptVersion: odd } as unknown as Partial<CopilotAnswer>).rules).toBeNull()
  })
})

describe('the answer’s reports (spec 819 §D, ticket 832)', () => {
  const definition = { params: [], bindings: {}, sections: [{ id: 's1', heading: { en: 'Sales', ar: 'المبيعات' }, blocks: [] }] }

  it('reportRefs_readIdRevisionAndBilingualTitle', () => {
    const reply = {
      reportRefs: [{ id: 'r-1', revision: 1, title: { en: 'Channel sales', ar: 'مبيعات القنوات' } }],
    } as Partial<CopilotAnswer>
    expect(copilotAnswerModel(reply).reportRefs).toEqual([{ id: 'r-1', revision: 1, title: { en: 'Channel sales', ar: 'مبيعات القنوات' } }])
  })

  it('reportRefs_withoutAnIdAreDropped_andAMissingHalfReadsBlank', () => {
    const odd = {
      // The demo's string title reads as no title; an absent revision as 1.
      reportRefs: [null, { title: { en: 'No id' } }, { id: ' ' }, { id: 'r-2', title: 'Demo title' }, { id: 'r-3', revision: 4, title: { ar: 'عربي فقط' } }],
    } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(odd).reportRefs).toEqual([
      { id: 'r-2', revision: 1, title: { en: '', ar: '' } },
      { id: 'r-3', revision: 4, title: { en: '', ar: 'عربي فقط' } },
    ])
  })

  it('reportRefs_carryTheShareAndScheduleStepsTheWordsAskedFor_andNothingElse (story 108)', () => {
    const reply = {
      reportRefs: [
        { id: 'r-1', revision: 1, title: { en: 'Channel sales', ar: '' }, nextSteps: ['share', 'schedule', 'certify', 'share', 7] },
        { id: 'r-2', revision: 1, title: { en: 'Plain', ar: '' }, nextSteps: 'share' },
      ],
    } as unknown as Partial<CopilotAnswer>
    const [asked, plain] = copilotAnswerModel(reply).reportRefs
    expect(asked.nextSteps).toEqual(['share', 'schedule'])
    expect(plain.nextSteps ?? []).toEqual([])
  })

  it('reportEdit_readsTheReportItsDefinitionAndItsNote', () => {
    const reply = { reportEdit: { reportId: 'r-1', definition, note: { en: 'Added the cancellation rate as a bar.', ar: 'أُضيفت نسبة الإلغاء كأعمدة.' } } } as Partial<CopilotAnswer>
    expect(copilotAnswerModel(reply).reportEdit).toEqual({ reportId: 'r-1', definition, note: { en: 'Added the cancellation rate as a bar.', ar: 'أُضيفت نسبة الإلغاء كأعمدة.' } })
  })

  it('reportEdit_forTheUnsavedNewReportInContext_namesNoReport (story 101)', () => {
    const reply = { reportEdit: { reportId: null, definition, note: { en: 'Added a bar.', ar: '' } } } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(reply).reportEdit).toEqual({ reportId: null, definition, note: { en: 'Added a bar.', ar: '' } })
  })

  it('reportEdit_withoutAReportOrSectionsIsNone', () => {
    for (const odd of [null, 'x', {}, { reportId: 'r-1' }, { reportId: '', definition }, { reportId: 'r-1', definition: { sections: 'x' } }])
      expect(copilotAnswerModel({ reportEdit: odd } as unknown as Partial<CopilotAnswer>).reportEdit).toBeNull()
    // A missing note reads blank, never a crash.
    expect(copilotAnswerModel({ reportEdit: { reportId: 'r-1', definition } } as unknown as Partial<CopilotAnswer>).reportEdit?.note).toEqual({ en: '', ar: '' })
  })

  it('assumptions_areOneLineEach_blankOnesDropped', () => {
    const reply = {
      assumptions: [{ en: 'Period: a parameter, default yesterday', ar: 'الفترة: معامل، افتراضيًا أمس' }, { en: '', ar: '' }, null, { en: 'HungerStation and QC: two named series' }],
    } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(reply).assumptions).toEqual([
      { en: 'Period: a parameter, default yesterday', ar: 'الفترة: معامل، افتراضيًا أمس' },
      { en: 'HungerStation and QC: two named series', ar: '' },
    ])
  })

  it('a bare answer has no reports, no edit and no assumptions', () => {
    expect(copilotAnswerModel({ answer: 'x' })).toMatchObject({ reportRefs: [], reportEdit: null, assumptions: [] })
    expect(copilotAnswerModel(null)).toMatchObject({ reportRefs: [], reportEdit: null, assumptions: [] })
    expect(copilotAnswerModel({ reportRefs: 'x', assumptions: 7 } as unknown as Partial<CopilotAnswer>)).toMatchObject({ reportRefs: [], assumptions: [] })
  })
})

describe('the board edit (ticket 836, BackOffice 3430)', () => {
  const definition = {
    params: [],
    bindings: {},
    panels: [{ id: 'p-a', kind: 'view', viewId: 'v-1', layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] }],
  }

  it('boardEdit_readsTheBoardItsDefinitionAndItsNote', () => {
    const reply = { boardEdit: { boardId: 'b-1', definition, note: { en: 'Removed the stores chart.', ar: 'أزيل رسم الفروع.' } } } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(reply).boardEdit).toEqual({ boardId: 'b-1', definition, note: { en: 'Removed the stores chart.', ar: 'أزيل رسم الفروع.' } })
  })

  it('boardEdit_withoutABoardOrPanelsIsNone_andAbsentIsNone', () => {
    for (const odd of [null, 'x', { definition }, { boardId: '', definition }, { boardId: 'b-1' }, { boardId: 'b-1', definition: { sections: [] } }])
      expect(copilotAnswerModel({ boardEdit: odd } as unknown as Partial<CopilotAnswer>).boardEdit).toBeNull()
    expect(copilotAnswerModel({ answer: 'x' }).boardEdit).toBeNull()
    expect(copilotAnswerModel({ boardEdit: { boardId: 'b-1', definition: { panels: [] } } } as unknown as Partial<CopilotAnswer>).boardEdit).toEqual({
      boardId: 'b-1',
      definition: { panels: [], params: [], bindings: {} },
      note: { en: '', ar: '' },
    })
  })
})

describe('Copy puts the answer on the clipboard as clean text', () => {
  it('answerPlainText_dropsTheMarkdownAndKeepsTheShape', () => {
    const blocks = answerBlocks(
      ['## Deliveries by channel', 'Most came through **our app**, see `QC`.', '- HungerStation: *2,197*', '- Call centre: 2,187', '1. first', '2. second', '| Channel | Deliveries |', '|---|---|', '| App | 4,385 |'].join('\n'),
    )
    expect(answerPlainText(blocks)).toBe(
      ['Deliveries by channel', 'Most came through our app, see QC.', '- HungerStation: 2,197\n- Call centre: 2,187', '1. first\n2. second', 'Channel\tDeliveries\nApp\t4,385'].join('\n\n'),
    )
    expect(answerPlainText([])).toBe('')
  })
})

describe('the answer tables (spec 3558 D5; ticket 868)', () => {
  const reply: Partial<CopilotAnswer> = {
    conversationId: 'c-1',
    questionNo: 1,
    answer: 'Riyadh leads with 1,204 deliveries.',
    trace: [{ tool: 'semantic_query', input: { measures: ['deliveries'] }, rows: 2, ms: 40, ok: true }],
    outcome: 'answered',
    stoppedEarly: false,
    servedBy: 'anthropic/claude',
  }
  const table = {
    step: 0,
    columns: [{ key: 'city', role: 'dimension', label: { en: 'City', ar: 'المدينة' }, unit: null, shape: null, dateBasis: null, calculation: null, variant: null }],
    rows: [{ values: ['Riyadh'], isTotal: null }],
    total: 1,
    truncated: false,
    periodFrom: '2026-10-01',
    periodTo: '2026-10-31',
    previous: null,
    previousFrom: null,
    previousTo: null,
    dataAsOf: '2026-11-11T08:00:00',
    notes: { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null },
    query: { measures: ['deliveries'], dimensions: ['city'], filters: [] },
  }

  it('noTables_theAnswerRendersAsToday', () => {
    const today = copilotAnswerModel(reply)
    expect(today.tables).toEqual([])
    // Absent, empty, null or not a list: the same model, field for field.
    for (const tables of [undefined, [], null, 'x']) {
      expect(copilotAnswerModel({ ...reply, tables } as unknown as Partial<CopilotAnswer>)).toEqual(today)
    }
  })

  describe('a figures-only answer (BackOffice spec 3586 A16-A18, 3590; ticket 870)', () => {
    const lookups = [
      { tool: 'semantic_query', input: { measures: ['deliveries'] }, rows: 2, ms: 40, ok: true },
      { tool: 'store_lookup', input: { text: 'Olaya' }, rows: 1, ms: 12, ok: true },
    ]

    it('figuresOnly_showsItsSentenceAboveItsTables_andItsLookups', () => {
      const model = copilotAnswerModel({
        ...reply,
        outcome: 'figures-only',
        answer: 'I could not verify my summary, so here are the figures.',
        orderRefs: [],
        trace: lookups,
        tables: [table, { ...table, step: 1 }],
      } as unknown as Partial<CopilotAnswer>)
      // The sentence first, the tables under it, and the lookups open below: what the sentence points at.
      expect(answerLayout(model)).toEqual({ figuresOnly: true, parts: ['text', 'tables'], lookups: 'open' })
      expect(model.blocks).toEqual([{ kind: 'paragraph', text: 'I could not verify my summary, so here are the figures.' }])
      expect(model.tables).toHaveLength(2)
      expect(model.trace).toEqual(lookups)
    })

    it('figuresOnly_withNoTables_showsItsSentenceAndItsLookups', () => {
      const model = copilotAnswerModel({
        ...reply,
        outcome: 'figures-only',
        answer: 'I could not verify my summary. The lookups I ran are listed below.',
        orderRefs: [],
        trace: lookups,
      })
      expect(answerLayout(model)).toEqual({ figuresOnly: true, parts: ['text'], lookups: 'open' })
      expect(model.blocks).toEqual([{ kind: 'paragraph', text: 'I could not verify my summary. The lookups I ran are listed below.' }])
      // Stopped early: the loop's stop note follows the sentence after a blank line, as its own paragraph.
      const stopped = copilotAnswerModel({
        ...reply,
        outcome: 'figures-only',
        answer: 'I could not verify my summary. The lookups I ran are listed below.\n\nI stopped before finishing (the 60-second time limit).',
        stoppedEarly: true,
        orderRefs: [],
        trace: lookups,
      })
      expect(stopped.blocks).toEqual([
        { kind: 'paragraph', text: 'I could not verify my summary. The lookups I ran are listed below.' },
        { kind: 'paragraph', text: 'I stopped before finishing (the 60-second time limit).' },
      ])
      expect(answerLayout(stopped)).toEqual({ figuresOnly: true, parts: ['text'], lookups: 'open' })
    })
  })

  it('tables_areKeptInTheOrderSent_andOneWithoutColumnsOrRowsIsDropped', () => {
    const second = { ...table, step: 2 }
    const model = copilotAnswerModel({ ...reply, tables: [table, { step: 1 }, second] } as unknown as Partial<CopilotAnswer>)
    expect(model.tables).toEqual([table, second])
  })
})

describe('what the answer assumed, under any answer (BackOffice spec 3586, 3594; ticket 870)', () => {
  const plain: Partial<CopilotAnswer> = {
    conversationId: 'c-1',
    questionNo: 1,
    answer: 'Sales rose 4% on last week.',
    trace: [{ tool: 'semantic_query', input: { measures: ['sales'] }, rows: 1, ms: 30, ok: true }],
    outcome: 'answered',
    stoppedEarly: false,
    servedBy: 'anthropic/claude',
  }

  it('aPlainAnswerWithTwoAssumptions_listsBothUnderTheAnswer_inThePanelsLanguage', () => {
    const model = copilotAnswerModel({
      ...plain,
      assumptions: [
        { en: 'Period: last week, Sunday to Saturday', ar: 'الفترة: الأسبوع الماضي، من الأحد إلى السبت' },
        { en: 'Compared with the week before', ar: 'مقارنة بالأسبوع الذي قبله' },
      ],
    })
    expect(assumptionLines(model.assumptions, 'en')).toEqual(['Period: last week, Sunday to Saturday', 'Compared with the week before'])
    expect(assumptionLines(model.assumptions, 'ar')).toEqual(['الفترة: الأسبوع الماضي، من الأحد إلى السبت', 'مقارنة بالأسبوع الذي قبله'])
    // Not mixed into the answer's own text.
    expect(model.blocks).toEqual([{ kind: 'paragraph', text: 'Sales rose 4% on last week.' }])
  })

  it('anAnswerWithNoAssumptions_rendersAsToday', () => {
    const today = copilotAnswerModel(plain)
    // The text, then the collapsed "How I got this": no assumptions part.
    expect(answerLayout(today)).toEqual({ figuresOnly: false, parts: ['text'], lookups: 'collapsed' })
    // Absent, empty, null or not a list: the same model and the same layout.
    for (const assumptions of [undefined, [], null, 'x']) {
      const model = copilotAnswerModel({ ...plain, assumptions } as unknown as Partial<CopilotAnswer>)
      expect(model).toEqual(today)
      expect(answerLayout(model)).toEqual(answerLayout(today))
    }
    // With two, they sit under the text.
    const withTwo = copilotAnswerModel({ ...plain, assumptions: [{ en: 'a', ar: 'أ' }, { en: 'b', ar: 'ب' }] })
    expect(answerLayout(withTwo).parts).toEqual(['text', 'assumptions'])
  })
})

describe('the suggested next questions (BackOffice spec 3586 A46, A49, 3598; ticket 871)', () => {
  const plain: Partial<CopilotAnswer> = {
    conversationId: 'c-1',
    questionNo: 1,
    answer: 'Olaya delivered 412 orders last week.',
    trace: [{ tool: 'semantic_query', input: { measures: ['deliveries'] }, rows: 1, ms: 30, ok: true }],
    outcome: 'answered',
    stoppedEarly: false,
    servedBy: 'anthropic/claude',
  }
  const three: CopilotAnswer['suggestions'] = [
    { question: 'Break it down by city', by: 'model' },
    { question: 'Compare with the week before', by: 'server' },
    { question: 'Show the lowest 10 stores', by: 'server' },
  ]

  it('anAnswerWithThreeSuggestions_showsThreeButtonsUnderIt', () => {
    const model = copilotAnswerModel({ ...plain, suggestions: three })
    // Under the answer: after its text and its other parts.
    expect(answerLayout(model).parts).toEqual(['text', 'suggestions'])
    expect(answerLayout(copilotAnswerModel({ ...plain, suggestions: three, assumptions: [{ en: 'a', ar: 'أ' }] })).parts).toEqual([
      'text',
      'assumptions',
      'suggestions',
    ])
    // One button each, in the order sent, its text the suggestion's own question; the latest answer's can be tapped.
    expect(suggestionButtons(model, true)).toEqual([
      { question: 'Break it down by city', tappable: true },
      { question: 'Compare with the week before', tappable: true },
      { question: 'Show the lowest 10 stores', tappable: true },
    ])
    // Not part of the answer's own text, nor of what Copy takes.
    expect(model.blocks).toEqual([{ kind: 'paragraph', text: 'Olaya delivered 412 orders last week.' }])
  })

  it('anEarlierAnswersSuggestions_areShownButCannotBeTapped', () => {
    const model = copilotAnswerModel({ ...plain, suggestions: three })
    expect(answerLayout(model).parts).toEqual(['text', 'suggestions'])
    expect(suggestionButtons(model, false)).toEqual([
      { question: 'Break it down by city', tappable: false },
      { question: 'Compare with the week before', tappable: false },
      { question: 'Show the lowest 10 stores', tappable: false },
    ])
  })

  it('anAnswerWithNoSuggestions_rendersAsToday', () => {
    const today = copilotAnswerModel(plain)
    // The text, then the collapsed "How I got this": no suggestions part, no buttons.
    expect(answerLayout(today)).toEqual({ figuresOnly: false, parts: ['text'], lookups: 'collapsed' })
    expect(suggestionButtons(today, true)).toEqual([])
    // Absent, empty, null, not a list, or none usable: the same layout and no buttons.
    for (const suggestions of [undefined, [], null, 'x', [{ question: '', by: 'model' }]]) {
      const model = copilotAnswerModel({ ...plain, suggestions } as unknown as Partial<CopilotAnswer>)
      expect(answerLayout(model)).toEqual(answerLayout(today))
      expect(suggestionButtons(model, true)).toEqual([])
      expect(model.blocks).toEqual(today.blocks)
    }
  })

  it('suggestions_showAtMostThree_andABlankOrMalformedOneIsLeftOut', () => {
    const model = copilotAnswerModel({
      ...plain,
      suggestions: [{ question: '  ', by: 'model' }, null, { by: 'model' }, ...(three ?? []), { question: 'A fourth', by: 'server' }],
    } as unknown as Partial<CopilotAnswer>)
    expect(suggestionButtons(model, true).map((b) => b.question)).toEqual([
      'Break it down by city',
      'Compare with the week before',
      'Show the lowest 10 stores',
    ])
  })
})

describe('the clarifying question (BackOffice spec 3586 A36, 3596; ticket 872)', () => {
  const asked: Partial<CopilotAnswer> = {
    conversationId: 'c-1',
    questionNo: 2,
    answer: 'Which one did you mean by "Mall"?',
    trace: [{ tool: 'find_names', input: { text: 'Mall' }, rows: 3, ms: 20, ok: true }],
    outcome: 'asked',
    stoppedEarly: false,
    servedBy: 'anthropic/claude',
    assumptions: [],
    ask: {
      id: 'ask-1',
      question: { en: 'Which one did you mean by "Mall"?', ar: 'أيّها تقصد بـ «Mall»؟' },
      text: 'Mall',
      choices: [
        { key: 'store:S102', label: { en: 'Jeddah Mall (store, Jeddah)', ar: 'جدة مول (فرع، جدة)' } },
        { key: 'store:S207', label: { en: 'Riyadh Mall (store, Riyadh)', ar: 'الرياض مول (فرع، الرياض)' } },
      ],
    },
  }

  it('anAskedAnswer_showsTheQuestionAndOneButtonPerChoice_inThePanelsLanguage_andNotItsTextBesideIt', () => {
    const model = copilotAnswerModel(asked)
    // The question in place of the text: the plain-text repeat of it is not drawn beside it.
    expect(answerLayout(model).parts).toEqual(['ask'])
    expect(askView(model, 'en', true)).toEqual({
      question: 'Which one did you mean by "Mall"?',
      choices: [
        { key: 'store:S102', label: 'Jeddah Mall (store, Jeddah)', tappable: true },
        { key: 'store:S207', label: 'Riyadh Mall (store, Riyadh)', tappable: true },
      ],
    })
    expect(askView(model, 'ar', true)).toEqual({
      question: 'أيّها تقصد بـ «Mall»؟',
      choices: [
        { key: 'store:S102', label: 'جدة مول (فرع، جدة)', tappable: true },
        { key: 'store:S207', label: 'الرياض مول (فرع، الرياض)', tappable: true },
      ],
    })
    // Any other answer has no question to show.
    expect(askView(copilotAnswerModel({ ...asked, outcome: 'answered', ask: undefined }), 'en', true)).toBeNull()
  })
})
