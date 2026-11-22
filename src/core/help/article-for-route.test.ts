/** oms 952 (BackOffice spec 4182 §D): the page drawer opens the article whose `screens` hold the route, else `start`. */
import { describe, expect, it } from 'vitest'
import type { HelpArticleMeta } from '@/core/models/help'
import { articleForRoute } from './article-for-route'

const meta = (slug: string, screens: string[]): HelpArticleMeta => ({ slug, title: slug, order: 0, access: 'viewer', screens, questions: [], checkedAgainst: '' })

const ARTICLES = [
  meta('start', ['/analytics']),
  meta('library', ['/analytics/library', '/analytics/catalog']),
  meta('boards', ['/analytics/board/:id']),
  meta('board-editor', ['/analytics/board/:id/edit']),
  meta('reports', ['/analytics/report/:id', '/analytics/report/:id/edit']),
  meta('schedules', ['/analytics/report/:id/runs', '/analytics/my-schedules']),
  meta('sql', ['/analytics/sql/:id']),
  meta('sql-new', ['/analytics/sql/new']),
]

describe('articleForRoute', () => {
  it('picks the article whose screen matches the route, the longest match winning', () => {
    expect(articleForRoute(ARTICLES, '/analytics/board/42')).toBe('boards')
    expect(articleForRoute(ARTICLES, '/analytics/board/42/edit')).toBe('board-editor')
    expect(articleForRoute(ARTICLES, '/analytics/report/r-7/runs')).toBe('schedules')
    expect(articleForRoute(ARTICLES, '/analytics/report/r-7')).toBe('reports')
    expect(articleForRoute(ARTICLES, '/analytics/catalog/')).toBe('library')
    expect(articleForRoute(ARTICLES, '/analytics')).toBe('start')
    // A literal segment beats a parameter where both match the whole route.
    expect(articleForRoute(ARTICLES, '/analytics/sql/new')).toBe('sql-new')
    expect(articleForRoute(ARTICLES, '/analytics/sql/s-9')).toBe('sql')
  })

  it('falls back to start for a route no article covers, or no contents at all', () => {
    // A screen covers its whole route, not the routes under it: Home's `/analytics` does not swallow the rest.
    expect(articleForRoute([meta('home', ['/analytics']), ...ARTICLES.slice(1)], '/analytics/price-command-center')).toBe('start')
    expect(articleForRoute(ARTICLES, '/deliveries')).toBe('start')
    expect(articleForRoute([], '/analytics/board/42')).toBe('start')
    expect(articleForRoute(undefined, '/analytics/board/42')).toBe('start')
  })
})
