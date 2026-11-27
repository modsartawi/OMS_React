/**
 * oms 950 (BackOffice spec 4165): the shared "Ask" button. It shows only when the server offered the copilot's findings
 * tool (it sends `ask` only with `Copilot:Findings` on) and the reader holds the copilot; a tap opens the copilot panel
 * with the server's written question and the finding's id. The pharmacy case: the scorecard panel's "ask the copilot"
 * asks about the pharmacy, with no brief line to draw.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createCopilotPanel } from '@/core/copilot-panel'
import type { CcAsk, CcLine } from '@/core/models/command-center'
import { AskButtonView, askOffer } from './AskButton'

const pharmacy: CcAsk = { question: 'How is P166 doing this morning?', findingId: 'store-status:P166' }

const line: CcLine = {
  findingId: 'f-1',
  parts: [{ text: 'P166', target: { kind: 'store', storeCode: 'P166' } }, { text: ' is newly flagged.' }],
  money: 'SAR 1.2 m',
  ask: { question: 'Why is P166 newly flagged?', findingId: 'f-1' },
}

describe('the Ask button', () => {
  it("the pharmacy's ask opens the copilot with the written question and the finding's id", () => {
    const panel = createCopilotPanel()
    panel.getState().setAvailable(true)
    const finding = askOffer(pharmacy, true)
    expect(finding).toEqual({ question: 'How is P166 doing this morning?', findingId: 'store-status:P166' })
    const button = AskButtonView({ finding, label: 'Ask the copilot', onAsk: panel.getState().askAbout })
    expect(renderToStaticMarkup(button)).toContain('data-copilot-ask="store-status:P166"')
    expect(renderToStaticMarkup(button)).toContain('Ask the copilot')
    ;(button?.props as { onClick: () => void }).onClick()
    expect(panel.getState().open).toBe(true)
    expect(panel.getState().takeFinding()).toEqual({ question: 'How is P166 doing this morning?', findingId: 'store-status:P166' })
  })

  it("a brief line's ask carries the line and its language for the copilot's card", () => {
    expect(askOffer(line.ask, true, { line, lang: 'ar' })).toEqual({ question: 'Why is P166 newly flagged?', findingId: 'f-1', line, lang: 'ar' })
  })

  it('is absent when the server did not offer the findings tool, or the reader has no copilot', () => {
    expect(askOffer(undefined, true)).toBeNull()
    expect(askOffer(pharmacy, false)).toBeNull()
    expect(renderToStaticMarkup(createElement(AskButtonView, { finding: null, label: 'Ask', onAsk: () => {} }))).toBe('')
  })
})
