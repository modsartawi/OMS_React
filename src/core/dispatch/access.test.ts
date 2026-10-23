/**
 * Ticket 541 — the board's probe: the menu leaf and the ScreenGate share one predicate that fails
 * closed; Release lock reads its own flag.
 */
import { describe, expect, it } from 'vitest'
import type { DispatchBoardAccess } from '@/core/models/dispatch-board'
import { canOpenDispatchBoard, canReleaseLock } from './access'

describe('the dispatch probe', () => {
  it('each flag reads only its own field', () => {
    const watch: DispatchBoardAccess = { canOpenDispatchBoard: true, canReleaseLock: false }
    expect([canOpenDispatchBoard(watch), canReleaseLock(watch)]).toEqual([true, false])
    const release: DispatchBoardAccess = { canOpenDispatchBoard: false, canReleaseLock: true }
    expect([canOpenDispatchBoard(release), canReleaseLock(release)]).toEqual([false, true])
  })

  it.each([null, undefined, [], { canOpenDispatchBoard: 'true', canReleaseLock: 1 }])('🚩 %j grants nothing', (r) => {
    expect(canOpenDispatchBoard(r as unknown as DispatchBoardAccess)).toBe(false)
    expect(canReleaseLock(r as unknown as DispatchBoardAccess)).toBe(false)
  })
})
