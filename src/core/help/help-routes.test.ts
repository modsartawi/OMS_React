/** Review 4182 #6: the area a server answer names is a path segment, encoded. */
import { describe, expect, it } from 'vitest'
import { helpHref, helpPath } from './help-routes'

describe('help routes', () => {
  it('the analytics area reads as itself', () => {
    expect(helpPath('analytics')).toBe('/analytics/help')
    expect(helpHref('analytics', 'boards', 'share')).toBe('/analytics/help/boards#share')
  })

  it('a server-supplied area cannot climb out of its segment or reach another origin', () => {
    expect(helpHref('/evil.example', 'x')).toBe('/%2Fevil.example/help/x')
    expect(helpHref('\\evil.example', 'x')).toBe('/%5Cevil.example/help/x')
    expect(helpHref('../admin', 'x')).toBe('/..%2Fadmin/help/x')
  })
})
