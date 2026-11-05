import { describe, expect, it } from 'vitest'
import { boardEditHref, itemHref } from './analytics-routes'

describe('analytics item routes', () => {
  it('a view and a board open their own page, the id escaped', () => {
    expect(itemHref('view', 'v-42')).toBe('/analytics/view/v-42')
    expect(itemHref('board', 'b 7/x')).toBe('/analytics/board/b%207%2Fx')
  })
  it("a board's editor is under its page", () => {
    expect(boardEditHref('b-ops')).toBe('/analytics/board/b-ops/edit')
  })
})
