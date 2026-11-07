import { describe, expect, it } from 'vitest'
import type { CopilotReportContext, CopilotReportEdit } from '@/core/models/copilot'
import { createReportContext } from './report-context'

const label = (en: string, ar = '') => ({ en, ar })
const definition = (heading: string) => ({ params: [], bindings: {}, sections: [{ id: 's1', heading: label(heading), blocks: [] }] })
const ctx = (reportId: string | null, revision = 1): CopilotReportContext => ({
  reportId,
  revision,
  draft: definition('Sales'),
})
const edit = (reportId: string | null): CopilotReportEdit => ({ reportId, definition: definition('Sales and cancellations'), note: label('Added the cancellation rate as a bar.') })

describe('the report-in-context bridge (ticket 832, spec 819 §E)', () => {
  it('holds nothing until a designer publishes', () => {
    const bridge = createReportContext()
    expect(bridge.getState().context).toBeNull()
  })

  it('publishes the open report, and replaces it as the draft moves on', () => {
    const bridge = createReportContext()
    bridge.getState().publish(ctx('r-1'))
    expect(bridge.getState().context?.reportId).toBe('r-1')
    bridge.getState().publish(ctx('r-1', 2))
    expect(bridge.getState().context?.revision).toBe(2)
  })

  it('clears only the report it was asked to clear', () => {
    const bridge = createReportContext()
    bridge.getState().publish(ctx('r-2'))
    bridge.getState().clear('r-1')
    expect(bridge.getState().context?.reportId).toBe('r-2')
    bridge.getState().clear('r-2')
    expect(bridge.getState().context).toBeNull()
  })

  it('hands a posted edit to the matching report once, with the request it answers', () => {
    const bridge = createReportContext()
    bridge.getState().publish(ctx('r-1'))
    bridge.getState().postEdit(edit('r-1'), 'add the cancellation rate as a bar')
    expect(bridge.getState().takeEdit('r-2')).toBeNull()
    const taken = bridge.getState().takeEdit('r-1')
    expect(taken?.request).toBe('add the cancellation rate as a bar')
    expect(taken?.edit.definition.sections[0].heading.en).toBe('Sales and cancellations')
    expect(bridge.getState().takeEdit('r-1')).toBeNull()
  })

  it('drops an edit for a report that is not open in the designer', () => {
    const bridge = createReportContext()
    bridge.getState().postEdit(edit('r-1'), 'add a bar')
    expect(bridge.getState().edit).toBeNull()
    bridge.getState().publish(ctx('r-2'))
    bridge.getState().postEdit(edit('r-1'), 'add a bar')
    expect(bridge.getState().takeEdit('r-1')).toBeNull()
    expect(bridge.getState().takeEdit('r-2')).toBeNull()
  })

  it('closing the designer drops an edit it never took', () => {
    const bridge = createReportContext()
    bridge.getState().publish(ctx('r-1'))
    bridge.getState().postEdit(edit('r-1'), 'add a bar')
    bridge.getState().clear('r-1')
    bridge.getState().publish(ctx('r-1'))
    expect(bridge.getState().takeEdit('r-1')).toBeNull()
  })

  it('story 101: an unsaved new report (no id yet) is in context too, and takes the edit made for it', () => {
    const bridge = createReportContext()
    bridge.getState().publish(ctx(null, 0))
    expect(bridge.getState().context?.reportId).toBeNull()
    bridge.getState().postEdit(edit('r-1'), 'add a bar')
    expect(bridge.getState().takeEdit(null)).toBeNull()
    bridge.getState().postEdit(edit(null), 'add the cancellation rate as a bar')
    expect(bridge.getState().takeEdit('r-1')).toBeNull()
    expect(bridge.getState().takeEdit(null)?.request).toBe('add the cancellation rate as a bar')
    bridge.getState().clear(null)
    expect(bridge.getState().context).toBeNull()
  })

  it('an edit for an unsaved report is dropped when no designer is open', () => {
    const bridge = createReportContext()
    bridge.getState().postEdit(edit(null), 'add a bar')
    expect(bridge.getState().edit).toBeNull()
  })
})
