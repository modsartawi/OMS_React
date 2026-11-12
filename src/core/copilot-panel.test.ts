import { describe, expect, it } from 'vitest'
import { createCopilotPanel } from './copilot-panel'

describe('panel opener (ticket 782)', () => {
  it('open(question) opens and hands the question over once', () => {
    const panel = createCopilotPanel()
    panel.getState().openPanel('Orders by channel last week')
    expect(panel.getState().open).toBe(true)
    expect(panel.getState().takeQuestion()).toBe('Orders by channel last week')
    expect(panel.getState().takeQuestion()).toBeNull()
    expect(panel.getState().open).toBe(true)
  })

  it('a plain open carries none', () => {
    const panel = createCopilotPanel()
    panel.getState().openPanel()
    expect(panel.getState().open).toBe(true)
    expect(panel.getState().takeQuestion()).toBeNull()
  })

  it('a blank question is a plain open', () => {
    const panel = createCopilotPanel()
    panel.getState().openPanel('   ')
    expect(panel.getState().takeQuestion()).toBeNull()
  })

  it('closing drops a question nobody took', () => {
    const panel = createCopilotPanel()
    panel.getState().openPanel('Stores with the most late orders')
    panel.getState().close()
    expect(panel.getState().open).toBe(false)
    panel.getState().openPanel()
    expect(panel.getState().takeQuestion()).toBeNull()
  })

  it('is closed and unavailable until the shell says the copilot answered canAsk', () => {
    const panel = createCopilotPanel()
    expect(panel.getState().open).toBe(false)
    expect(panel.getState().available).toBe(false)
    panel.getState().setAvailable(true)
    expect(panel.getState().available).toBe(true)
  })

  it('becoming unavailable closes the panel and drops its question', () => {
    const panel = createCopilotPanel()
    panel.getState().setAvailable(true)
    panel.getState().openPanel('Orders by channel last week')
    panel.getState().setAvailable(false)
    expect(panel.getState().open).toBe(false)
    expect(panel.getState().takeQuestion()).toBeNull()
  })

  it('prefill(text) opens with the text in the box and sends nothing (843)', () => {
    const panel = createCopilotPanel()
    panel.getState().prefill('  What does Item sales cover?  ')
    expect(panel.getState().open).toBe(true)
    // Nothing queued to send: the text waits in the box for the user.
    expect(panel.getState().takeQuestion()).toBeNull()
    expect(panel.getState().takeDraft()).toBe('What does Item sales cover?')
    expect(panel.getState().takeDraft()).toBeNull()
  })

  it('openSqlItem opens the panel and hands the SQL item over once, asking nothing (3632 Q46)', () => {
    const panel = createCopilotPanel()
    panel.getState().setAvailable(true)
    panel.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    expect(panel.getState().open).toBe(true)
    expect(panel.getState().takeQuestion()).toBeNull()
    expect(panel.getState().takeSqlItem()).toEqual({ itemId: 'q1', revision: 3 })
    expect(panel.getState().takeSqlItem()).toBeNull()
  })

  it('closing, or the copilot going away, drops a SQL item nobody took', () => {
    const panel = createCopilotPanel()
    panel.getState().setAvailable(true)
    panel.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    panel.getState().close()
    expect(panel.getState().takeSqlItem()).toBeNull()
    panel.getState().openSqlItem({ itemId: 'q1', revision: 3 })
    panel.getState().setAvailable(false)
    expect(panel.getState().takeSqlItem()).toBeNull()
  })

  it('without the copilot, a prefill is dropped', () => {
    const panel = createCopilotPanel()
    panel.getState().prefill('Anything')
    panel.getState().setAvailable(false)
    expect(panel.getState().open).toBe(false)
    expect(panel.getState().takeDraft()).toBeNull()
  })
})
