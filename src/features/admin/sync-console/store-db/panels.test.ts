import { describe, expect, it } from 'vitest'
import { resolveStoreDbPanel, storeDbPanels } from './panels'

describe('the store page\'s panel strip', () => {
  it('shows the built panels in the page\'s fixed order, whatever order they were mounted in', () => {
    expect(storeDbPanels(['jobs', 'readings', 'live'])).toEqual(['readings', 'live', 'jobs'])
    expect(storeDbPanels(['restore', 'backup', 'space', 'health', 'live', 'jobs', 'readings'])).toEqual([
      'readings',
      'live',
      'health',
      'space',
      'backup',
      'jobs',
      'restore',
    ])
  })

  it('a key no panel is known by is not shown', () => {
    expect(storeDbPanels(['readings', 'charts'])).toEqual(['readings'])
  })

  it('the open panel is ?panel= when it is shown, else the first', () => {
    expect(resolveStoreDbPanel('live', ['readings', 'live'])).toBe('live')
    expect(resolveStoreDbPanel('jobs', ['readings', 'live'])).toBe('readings')
    expect(resolveStoreDbPanel(null, ['readings'])).toBe('readings')
  })
})
