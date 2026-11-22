/**
 * oms 950 (BackOffice spec 4165, server 4179 — unbuilt, the door is stubbed): "Ask" on a brief line or a pharmacy's
 * scorecard opens the copilot with the server's written question and the finding's id as context. The reader can type
 * a further question in the same panel: it continues that conversation, and the finding is not sent again (the server
 * keeps it in the conversation, 4179 `AFindingId_OpensThatFindingAsContext`).
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import '@/core/i18n'
import { targetHref } from '@/core/command-center-routes'
import FindingCard from '@/core/findings/FindingCard'
import type { CcLine } from '@/core/models/command-center'
import { useSession } from '@/core/session'
import type { CopilotAnswer, CopilotAskRequest } from '@/core/models/copilot'
import AskedFinding from './AskedFinding'
import { createCopilotConversation } from './conversation-store'

const reply = (over: Partial<CopilotAnswer> = {}): CopilotAnswer => ({
  conversationId: 'c-0001',
  questionNo: 1,
  answer: 'P166 was flagged because its sales growth fell 9 points under its peers.',
  orderRefs: [],
  trace: [],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-22T07:15:00',
  ...over,
})

/** A `Copilot/Ask` stand-in whose calls the test answers by hand. */
function door() {
  const calls: { body: CopilotAskRequest; answer: (r: CopilotAnswer) => void }[] = []
  const ask = ({ requestId: _id, ...body }: CopilotAskRequest) =>
    new Promise<CopilotAnswer>((answer) => {
      calls.push({ body, answer })
    })
  return { ask, calls }
}

const finding = { question: 'Why is P166 newly flagged?', findingId: 'f-1' }

describe('a finding asked about in the copilot (950)', () => {
  it('asks the written question with the finding id, in a new conversation', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const before = store.getState().ask('Anything?')
    d.calls[0].answer(reply({ conversationId: 'c-0000' }))
    await before
    store.getState().openFinding(finding)
    expect(store.getState().history).toHaveLength(1)
    expect(d.calls[1].body).toEqual({ question: 'Why is P166 newly flagged?', findingContext: { findingId: 'f-1' } })
    expect(store.getState().finding).toEqual(finding)
  })

  it('a further question continues in the same conversation, without the finding again', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().openFinding(finding)
    d.calls[0].answer(reply())
    await first
    const next = store.getState().askFromBox('And compared with last month?')
    expect(d.calls[1].body).toEqual({ question: 'And compared with last month?', conversationId: 'c-0001', origin: 'typed' })
    d.calls[1].answer(reply({ questionNo: 2 }))
    await next
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['Why is P166 newly flagged?', 'And compared with last month?'])
    // The card stays at the top of the conversation it opened.
    expect(store.getState().finding).toEqual(finding)
  })

  it('a new conversation, a resumed one or another user drops the finding', () => {
    const store = createCopilotConversation(door().ask)
    store.getState().openFinding(finding)
    store.getState().startNew()
    expect(store.getState().finding).toBeNull()
    store.getState().openFinding(finding)
    useSession.setState({ userId: 'someone-else-950' })
    expect(store.getState().finding).toBeNull()
  })
})

describe("the copilot's opening card for an asked finding (950)", () => {
  const line: CcLine = {
    findingId: 'f-1',
    parts: [{ text: 'P166', target: { kind: 'store', storeCode: 'P166' } }, { text: ' أُشّرت حديثًا.' }],
    money: 'SAR 1.2 m',
    tone: 'red',
    ask: finding,
  }
  const inRouter = (el: ReactElement) => renderToStaticMarkup(createElement(MemoryRouter, null, el))

  it('draws the line through the same shared card the brief draws, with the same words and links', () => {
    const html = inRouter(createElement(AskedFinding, { finding: { ...finding, line, lang: 'ar' } }))
    const brief = inRouter(createElement(FindingCard, { line, hrefOf: (t) => targetHref(t, { lang: 'ar', store: 'scorecard' }) }))
    expect(html).toContain('data-copilot-finding="f-1"')
    expect(html).toContain(brief)
  })

  it("draws nothing for a pharmacy's ask, which has no line", () => {
    expect(inRouter(createElement(AskedFinding, { finding }))).toBe('')
  })
})
