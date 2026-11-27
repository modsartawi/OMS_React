/**
 * oms 950 (BackOffice spec 4165): every line of the brief that the server offers to the copilot (`line.ask`, sent only
 * while `Copilot:Findings` is on) carries "Ask"; a line without it has none. Each line is drawn by the shared finding card
 * in `@/core/findings` — the same card the copilot draws at the top of its panel (`features/copilot/finding.test.ts`).
 *
 * The copilot grant is read through the shell's opener; static markup reads a store's initial state, so the opener is
 * stood in for here by one that says the reader holds the copilot.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import i18n from '@/core/i18n'
import { targetHref } from '@/core/command-center-routes'
import FindingCard from '@/core/findings/FindingCard'
import type { CcLang } from '@/core/models/command-center'
import Brief from './Brief'
import { NS } from './lang'
import { homeFixture } from './__fixtures__/home'

vi.mock('@/core/copilot-panel', async (actual) => {
  const real = await actual<typeof import('@/core/copilot-panel')>()
  const panel = real.createCopilotPanel()
  panel.getState().setAvailable(true)
  const useCopilotPanel = Object.assign(<T,>(pick: (s: ReturnType<typeof panel.getState>) => T) => pick(panel.getState()), panel)
  return { ...real, useCopilotPanel }
})

const drawBrief = (lang: CcLang) =>
  renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Brief, { brief: homeFixture(lang).brief, lang, t: i18n.getFixedT(lang, NS) })),
  )

/** One finding's card, from its opening tag to its close. */
const cardOf = (html: string, findingId: string): string => {
  const at = html.lastIndexOf('<article', html.indexOf(`data-finding="${findingId}"`))
  return html.slice(at, html.indexOf('</article>', at) + '</article>'.length)
}

describe("the brief's Ask (950)", () => {
  it('a line the server offers carries Ask, in the page language; a line without the offer has none', () => {
    const en = drawBrief('en')
    expect(cardOf(en, 'f-changed-1')).toContain('data-copilot-ask="f-changed-1"')
    expect(cardOf(en, 'f-changed-1')).toContain('>Ask</button>')
    expect(cardOf(en, 'f-changed-2')).not.toContain('data-copilot-ask')
    expect(cardOf(drawBrief('ar'), 'f-changed-1')).toContain('>اسأل</button>')
  })

  it('draws each line through the shared finding card', () => {
    const line = homeFixture('en').brief.sections.find((s) => s.key === 'changed')!.lines[1]
    const card = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(FindingCard, { line, hrefOf: (t) => targetHref(t, { lang: 'en', store: 'scorecard' }) })),
    )
    expect(cardOf(drawBrief('en'), 'f-changed-2')).toBe(card)
  })
})
