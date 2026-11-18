import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canActStoreDb, canRestoreStoreDb, canViewStoreDb } from '../access'

/** Oms 915 (BackOffice spec 4016 D9): the Store database grants, read off the one permissions answer. The tab's link is `../console-pages.test.ts`. */
describe('the Store database grants', () => {
  it('withholds View from a console operator who holds every other store database key', () => {
    expect(canViewStoreDb(permissionsOf({ screens: ['ActionSyncConsole:03', 'ActionSyncConsole:06', 'StoreDatabase:06', 'StoreDatabaseRestore:06'] }))).toBe(false)
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

  // The store page calls these directly (oms 917–919): Check now, the jobs, Back up now, the backup schedule.
  it('gives the store page’s Act controls — the jobs and the whole backup schedule, fleet default included (D9) — to Act beside View only', () => {
    const viewAct = permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabase:06'] })
    expect(canActStoreDb(viewAct)).toBe(true)
    expect(canActStoreDb(permissionsOf({ screens: ['StoreDatabase:03', 'ActionSyncConsole:03', 'ActionSyncConsole:06'] }))).toBe(false)
    expect(canActStoreDb(permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabaseRestore:06'] }))).toBe(false)
  })

  it('gives Restore and Drop to the Restore key beside View only, never to an Act holder or a console operator', () => {
    expect(canRestoreStoreDb(permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabaseRestore:06'] }))).toBe(true)
    expect(canRestoreStoreDb(permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabase:06', 'ActionSyncConsole:06'] }))).toBe(false)
    expect(canRestoreStoreDb(permissionsOf({ screens: ['StoreDatabaseRestore:06'] }))).toBe(false)
  })

  it('grants nothing on a failed answer', () => {
    expect(canViewStoreDb(permissionsOf(null))).toBe(false)
  })
})
