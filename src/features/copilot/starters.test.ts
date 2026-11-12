import { describe, expect, it } from 'vitest'
import type { CopilotReaderStarters } from '@/core/models/copilot'
import { EMPTY_CONVERSATION, askBody } from './conversation'
import { emptyPanelOffer, startersOrNothing } from './starters'

/** What `GET Copilot/Starters` gives an operations reader (3601, A53): two starters, the second with a blank. */
const read: CopilotReaderStarters = {
  kind: 'operations',
  starters: [
    { question: { en: 'Late orders in Riyadh today?', ar: 'الطلبات المتأخرة في الرياض اليوم؟' }, blank: false },
    { question: { en: 'Why was order ___ late?', ar: 'لماذا تأخر الطلب ___؟' }, blank: true },
  ],
}

describe("the empty panel's starters (873, spec 3586 A52, A53)", () => {
  it('startersFromTheDoor_areShownInThePanelsLanguage', () => {
    const en = emptyPanelOffer(read, 'en')
    expect(en.kind).toBe('starters')
    expect(en.kind === 'starters' && en.starters.map((s) => s.text)).toEqual(['Late orders in Riyadh today?', 'Why was order ___ late?'])

    const ar = emptyPanelOffer(read, 'ar')
    expect(ar.kind === 'starters' && ar.starters.map((s) => s.text)).toEqual(['الطلبات المتأخرة في الرياض اليوم؟', 'لماذا تأخر الطلب ___؟'])
  })

  it('aTap_buildsARequestWithTheStartersText_andTheOriginStarter', () => {
    const offer = emptyPanelOffer(read, 'en')
    const tap = offer.kind === 'starters' ? offer.starters[0].tap : null
    expect(tap).toEqual({ kind: 'ask', question: 'Late orders in Riyadh today?', origin: 'starter' })
    // The request the panel sends with it: the starter's own text, saying it came from a starter.
    if (tap?.kind !== 'ask') throw new Error('not asked')
    expect(askBody(EMPTY_CONVERSATION, tap.question, { origin: tap.origin })).toEqual({
      question: 'Late orders in Riyadh today?',
      origin: 'starter',
    })
  })

  it('aStarterWithABlank_fillsTheQuestionBox_andSendsNothing', () => {
    const offer = emptyPanelOffer(read, 'ar')
    const tap = offer.kind === 'starters' ? offer.starters[1].tap : null
    // The box takes the text in the panel's language for the reader to complete; there is no question to ask, no origin.
    expect(tap).toEqual({ kind: 'fill', text: 'لماذا تأخر الطلب ___؟' })
  })

  it('noStarters_orAFailedRead_showsTheTwoFixedExamples', async () => {
    // The door says none: the switch off (no `kind`), or the reader's own list empty.
    expect(emptyPanelOffer({ starters: [] }, 'en')).toEqual({ kind: 'examples' })
    expect(emptyPanelOffer({ kind: 'executive', starters: [] }, 'ar')).toEqual({ kind: 'examples' })
    // A failed read is nothing, never an error on the panel, and nothing is the examples.
    const failed = await startersOrNothing(Promise.reject(new Error('503')))
    expect(failed).toBeNull()
    expect(emptyPanelOffer(failed, 'en')).toEqual({ kind: 'examples' })
    // A reply with no list, or whose starters say nothing in either language, is none too.
    expect(emptyPanelOffer({ kind: 'operations' } as unknown as CopilotReaderStarters, 'en')).toEqual({ kind: 'examples' })
    expect(emptyPanelOffer({ kind: 'operations', starters: [{ question: { en: ' ', ar: '' }, blank: false }] }, 'en')).toEqual({ kind: 'examples' })
    // A read that worked passes through.
    expect(await startersOrNothing(Promise.resolve(read))).toBe(read)
  })
})
