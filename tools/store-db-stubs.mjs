// Stubs of the Store database doors (BackOffice spec 4016, doors 4030–4039; oms 915–919), shared by every
// `tools/store-db-*-drive.mjs`.
//
// 🚩 GUESSED contract. No BackOffice brief exists for 4016: the paths are the BO tickets', every field is a guess
// (`src/core/models/store-database.ts`). NOTHING here is driven against a live SIS.Api.
//
// Convention, so a later ticket adds a fixture FILE, not a line here:
//   GET|POST StoreDatabase/<Door>  →  src/features/admin/sync-console/store-db/__fixtures__/<door-kebab>.json
//   (`Fleet` → `fleet.json`, `LiveActivity` → `live-activity.json`, `BackupSchedule` → `backup-schedule.json`).
// A drive overrides any door (a refusal, a hang, another fixture) through `overrides[<Door>]`.
//
//   import { storeDbRoute, refusal } from './store-db-stubs.mjs'
//   await page.route('**/api/**', storeDbRoute({ screens: ['ActionSyncConsole:03', 'StoreDatabaseView:03'] }))
//   storeDbRoute({ screens, overrides: { Fleet: refusal('NO_ACCESS', 'Nope.', 500) } })
import { existsSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'

const FIXTURES = new URL('../src/features/admin/sync-console/store-db/__fixtures__/', import.meta.url)

/** The REAL SIS.Api envelope `src/core/api.ts` reads. */
export const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

/** A business refusal: non-2xx, `success: false`, the code in `errors[0]`. */
export const refusal = (errorCode, message, status = 400, data = null) => envelope(data, { status, success: false, message, errorCode })

/** A missing grant: a BARE 403. */
export const bare403 = { status: 403, contentType: 'text/plain', body: '' }

/** `LiveActivity` → `live-activity`. */
export const doorFile = (door) => door.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** A fixture by name (no extension), parsed. */
export const fixture = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8'))

/**
 * A `page.route('**\/api/**', …)` handler: Auth, the permissions answer, every `StoreDatabase/*` door by convention,
 * and an empty answer for anything else the shell asks. `calls` (optional array) collects every path + query asked;
 * `posts` (optional object) collects each write's body by door.
 */
export function storeDbRoute({ screens = [], overrides = {}, calls, posts } = {}) {
  return async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    calls?.push(`${p}${url.search}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(screens))
    const door = /^StoreDatabase\/(\w+)$/.exec(p)?.[1]
    if (door) {
      if (route.request().method() !== 'GET' && posts) (posts[door] ??= []).push(route.request().postDataJSON())
      const o = overrides[door]
      if (o === 'hang') return new Promise(() => {})
      if (typeof o === 'function') return route.fulfill(o(url, route.request()))
      if (o) return route.fulfill(o)
      const file = new URL(`${doorFile(door)}.json`, FIXTURES)
      if (existsSync(file)) return route.fulfill(envelope(JSON.parse(readFileSync(file, 'utf8'))))
      return route.fulfill(refusal('NO_STUB', `No stub for StoreDatabase/${door}.`, 404))
    }
    if (p === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
    return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
  }
}
