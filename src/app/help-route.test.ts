/**
 * Review 4182 #3: the help center is ONE route, `analytics/help/:slug?`, so opening an article from the search keeps
 * the same HelpPage mounted (and its search box filled). `router.tsx` is read as text (it cannot load in node).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchPath } from 'react-router'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const router = readFileSync(path.join(here, 'router.tsx'), 'utf8')
const helpPaths = [...router.matchAll(/\bpath:\s*'(analytics\/help[^']*)'/g)].map((m) => m[1])

describe('the help center route', () => {
  it('is one route for the start and every article', () => {
    expect(helpPaths).toEqual(['analytics/help/:slug?'])
    expect(matchPath({ path: `/${helpPaths[0]}`, end: true }, '/analytics/help')).not.toBeNull()
    expect(matchPath({ path: `/${helpPaths[0]}`, end: true }, '/analytics/help/boards')?.params.slug).toBe('boards')
  })
})
