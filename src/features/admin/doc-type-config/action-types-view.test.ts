/**
 * Ticket 3155 — the action types page's address: `?category=` is the category shown (blank until one is picked) and
 * `?tab=history` its History tab; Action types is the default tab and writes no key.
 */
import { describe, expect, it } from 'vitest'
import { actionTypesParams, actionTypesViewFromParams } from './action-types-view'

describe('the action types page address', () => {
  it('reads the category and the tab', () => {
    expect(actionTypesViewFromParams(new URLSearchParams('category=O&tab=history'))).toEqual({ category: 'O', tab: 'history' })
    expect(actionTypesViewFromParams(new URLSearchParams('category=D'))).toEqual({ category: 'D', tab: 'actionTypes' })
    expect(actionTypesViewFromParams(new URLSearchParams('tab=nonsense'))).toEqual({ category: '', tab: 'actionTypes' })
  })

  it('writes only what is not the default', () => {
    expect(actionTypesParams({ category: 'O', tab: 'actionTypes' }).toString()).toBe('category=O')
    expect(actionTypesParams({ category: 'X', tab: 'history' }).toString()).toBe('category=X&tab=history')
    expect(actionTypesParams({ category: '', tab: 'actionTypes' }).toString()).toBe('')
  })
})
