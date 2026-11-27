/**
 * oms 946 (BackOffice spec 4165): the shared finding card — one stored finding drawn the same way in the brief and (950)
 * in the copilot. Its sentence and SAR figure are drawn as the server sent them, isolated by kind (`.claude/rules/bidi.md`):
 * the sentence is free text (`<bdi>`), a pharmacy code and the figure machine values (`Ltr`), a category name free text.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { targetHref } from '@/core/command-center-routes'
import type { CcLine } from '@/core/models/command-center'
import FindingCard from './FindingCard'

const line: CcLine = {
  findingId: 'f-1',
  parts: [
    { text: 'P166', target: { kind: 'store', storeCode: 'P166' } },
    { text: ' أُشّرت حديثًا في ' },
    { text: 'العناية بالبشرة', target: { kind: 'category', level: 'top', code: 'C07' } },
  ],
  money: 'SAR 1.2 m',
  tone: 'red',
}

const draw = (l: CcLine, action?: string) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(FindingCard, {
        line: l,
        hrefOf: (target) => targetHref(target, { lang: 'ar', store: 'scorecard' }),
        action: action ? createElement('span', { 'data-action': '' }, action) : undefined,
      }),
    ),
  )

describe('the finding card', () => {
  it('draws the sentence, its links and the SAR figure as sent, each isolated by kind', () => {
    const html = draw(line)
    expect(html).toContain('data-finding="f-1"')
    expect(html).toContain('href="/analytics/command-center?store=P166&amp;lang=ar"')
    expect(html).toContain('<bdi dir="ltr">P166</bdi>')
    expect(html).toContain('href="/analytics/command-center/category/top/C07?lang=ar"')
    expect(html).toContain('<bdi>العناية بالبشرة</bdi>')
    expect(html).toContain('<bdi dir="ltr">SAR 1.2 m</bdi>')
    expect(html).toContain(' أُشّرت حديثًا في ')
  })

  it("draws the stored colour with its token and no colour of its own; no colour, no dot", () => {
    expect(draw(line)).toMatch(/class="[^"]*bg-danger" data-tone="red"/)
    expect(draw({ ...line, tone: 'amber' })).toContain('bg-attention')
    expect(draw({ ...line, tone: undefined })).not.toContain('data-tone')
  })

  it("holds the caller's action beside the figure (950's Ask)", () => {
    const html = draw(line, 'Ask')
    expect(html.indexOf('data-action')).toBeGreaterThan(html.indexOf('SAR 1.2 m'))
    expect(draw(line)).not.toContain('data-action')
  })
})
