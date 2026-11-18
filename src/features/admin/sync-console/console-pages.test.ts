import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { consolePages } from './console-pages'

/** The console's page links by grant (ticket 447; the Store database link, oms 915 / BackOffice spec 4016 D9). */
describe('the console’s page links', () => {
  const console03 = 'ActionSyncConsole:03' as const

  it('shows the Store database tab to a holder of the View key', () => {
    const pages = consolePages(permissionsOf({ screens: [console03, 'StoreDatabase:03'] })).map((p) => p.key)
    expect(pages).toContain('database')
  })

  it('hides the tab without the View key, even to a console operator', () => {
    const p = permissionsOf({ screens: [console03, 'ActionSyncConsole:06', 'StoreDatabase:06', 'StoreDatabaseRestore:06'] })
    expect(consolePages(p).map((x) => x.key)).not.toContain('database')
  })

  it('keeps the console’s other pages as they were', () => {
    expect(consolePages(permissionsOf({ screens: [console03] })).map((p) => p.key)).toEqual([
      'fleet',
      'passes',
      'commands',
      'audit',
      'pending',
      'objects',
      'scripts',
    ])
  })
})
