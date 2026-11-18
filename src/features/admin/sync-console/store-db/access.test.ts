import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canActStoreDb, canRestoreStoreDb, canViewStoreDb } from '../access'
import { consolePages } from '../console-pages'

/** Oms 915 (BackOffice spec 4016 D9): the Store database tab is read off the one permissions answer. */
describe('the Store database grants', () => {
  const console03 = 'ActionSyncConsole:03' as const

  it('shows the Store database tab to a holder of the View key', () => {
    const pages = consolePages(permissionsOf({ screens: [console03, 'StoreDatabase:03'] })).map((p) => p.key)
    expect(pages).toContain('database')
  })

  it('hides the tab without the View key, even to a console operator', () => {
    const p = permissionsOf({ screens: [console03, 'ActionSyncConsole:06', 'StoreDatabase:06', 'StoreDatabaseRestore:06'] })
    expect(consolePages(p).map((x) => x.key)).not.toContain('database')
    expect(canViewStoreDb(p)).toBe(false)
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

  it('lets Act and Restore count only beside View', () => {
    const actOnly = permissionsOf({ screens: ['StoreDatabase:06', 'StoreDatabaseRestore:06'] })
    expect(canActStoreDb(actOnly)).toBe(false)
    expect(canRestoreStoreDb(actOnly)).toBe(false)
    const all = permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabase:06', 'StoreDatabaseRestore:06'] })
    expect(canActStoreDb(all)).toBe(true)
    expect(canRestoreStoreDb(all)).toBe(true)
    expect(canRestoreStoreDb(permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabase:06'] }))).toBe(false)
  })

  it('grants nothing on a failed answer', () => {
    expect(canViewStoreDb(permissionsOf(null))).toBe(false)
  })
})
