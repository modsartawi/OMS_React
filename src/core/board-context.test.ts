import { describe, expect, it } from 'vitest'
import type { CopilotBoardContext, CopilotBoardEdit } from '@/core/models/copilot'
import { createBoardContext } from './board-context'

const definition = (viewId: string) => ({ params: [], bindings: {}, panels: [{ id: 'p-a', kind: 'view' as const, viewId, layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] }] })
const ctx = (boardId: string, revision = 1): CopilotBoardContext => ({ boardId, revision, draft: definition('v-1') })
const edit = (boardId: string): CopilotBoardEdit => ({ boardId, definition: definition('v-2'), note: { en: 'Swapped the chart.', ar: '' } })
const title = { en: 'Delivery', ar: 'التوصيل' }

describe('the board-in-context bridge (ticket 836)', () => {
  it('publishes the open board with its title, keeps the title as the draft moves on, and clears both', () => {
    const bridge = createBoardContext()
    bridge.getState().publish(ctx('b-1'), title)
    expect(bridge.getState().title).toEqual(title)
    bridge.getState().publish(ctx('b-1', 2))
    expect(bridge.getState()).toMatchObject({ context: { revision: 2 }, title })
    bridge.getState().clear('b-2')
    expect(bridge.getState().context).not.toBeNull()
    bridge.getState().clear('b-1')
    expect(bridge.getState()).toMatchObject({ context: null, title: null, edit: null })
  })

  it('hands an edit only to the board it names, once; another board drops it', () => {
    const bridge = createBoardContext()
    bridge.getState().publish(ctx('b-1'))
    bridge.getState().postEdit(edit('b-2'), 'q')
    expect(bridge.getState().edit).toBeNull()
    bridge.getState().postEdit(edit('b-1'), 'swap the chart')
    expect(bridge.getState().takeEdit('b-2')).toBeNull()
    expect(bridge.getState().takeEdit('b-1')?.request).toBe('swap the chart')
    expect(bridge.getState().takeEdit('b-1')).toBeNull()
  })

  it('a different board opening drops the waiting edit and the old title', () => {
    const bridge = createBoardContext()
    bridge.getState().publish(ctx('b-1'), title)
    bridge.getState().postEdit(edit('b-1'), 'q')
    bridge.getState().publish(ctx('b-2'))
    expect(bridge.getState()).toMatchObject({ edit: null, title: null })
  })
})
