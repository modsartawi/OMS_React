/**
 * Ticket 567, on the one permissions answer (oms 909): View (`ServingList:03`) and Edit (`ServingList:06`) are two keys.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canEditServingLists, canViewServingLists } from './access'

const holding = (...screens: string[]) => permissionsOf({ screens })

describe('the serving-list grants', () => {
  it('each predicate reads only its own key', () => {
    expect([canViewServingLists(holding('ServingList:03')), canEditServingLists(holding('ServingList:03'))]).toEqual([true, false])
    expect([canViewServingLists(holding('ServingList:06')), canEditServingLists(holding('ServingList:06'))]).toEqual([false, true])
  })

  it('🚩 no answer grants nothing', () => {
    expect([canViewServingLists(permissionsOf(null)), canEditServingLists(permissionsOf(null))]).toEqual([false, false])
  })
})
