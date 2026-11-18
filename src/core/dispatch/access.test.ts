/**
 * Ticket 541, on the one permissions answer (oms 909): the board's Display and Execute grants are two independent keys.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canOpenDispatchBoard, canReleaseLock } from './access'

const holding = (...screens: string[]) => permissionsOf({ screens })

describe('the dispatch board grants', () => {
  it('each predicate reads only its own key', () => {
    expect([canOpenDispatchBoard(holding('DispatchBoard:03')), canReleaseLock(holding('DispatchBoard:03'))]).toEqual([true, false])
    expect([canOpenDispatchBoard(holding('DispatchBoard:06')), canReleaseLock(holding('DispatchBoard:06'))]).toEqual([false, true])
  })

  it('🚩 no answer grants nothing', () => {
    expect([canOpenDispatchBoard(permissionsOf(null)), canReleaseLock(permissionsOf(null))]).toEqual([false, false])
  })
})
