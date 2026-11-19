// Store database Restore + sp_Blitz drive (oms 919, BackOffice spec 4016 D16/D18, doors 4038/4039) — drives the REAL
// store page in Chromium against STUBBED `StoreDatabase/*` envelopes (`tools/store-db-stubs.mjs`, fixtures
// `src/features/admin/sync-console/store-db/__fixtures__/store.json`, `backups.json`, `blitz.json`), shaped to the
// real doors on BO pricing2 (fa2759e8f) — the fixtures copy the server DTOs. NOTHING here is driven against a live SIS.Api.
//
// It verifies:
//   1. with Restore the strip ends with Restore, and the panel says the live database is never replaced;
//   2. nothing is browsed until Browse; an empty folder asks for the backup folder (no `folder`), and the field then
//      shows the folder read;
//   3. each file shows whether it can be restored: OK, newer engine, unreadable (with the engine's error);
//   4. a newer-engine or unreadable file's Restore is disabled with its reason; the store's own engine's is enabled;
//   5. Restore asks for a reason, shows the side copy it will create (POS_Restore_<today>), defaults to tonight and
//      posts `{ code, kind: 'RestoreSideCopy', reason, runNow: false, target }` to `StoreDatabase/RestoreJobs` (never Jobs);
//   6. a typed folder is asked for by name;
//   7. a taken side-copy name takes the `_2` suffix;
//   8. Drop on the Space panel's side copy posts `{ kind: 'DropSideCopy', target }` to `StoreDatabase/RestoreJobs`;
//   9. without the Restore key (Act only) no Restore or Drop shows; Browse still lists;
//  10. Health says sp_Blitz's install state is not reported (BO 4039 open) until Run; Run lists its findings, most
//      urgent first, and then reads installed with HQ's recorded build;
//  11. with Act Install / Remove show and Install posts kind InstallBlitz for tonight; NO_BLITZ_BUILD has its words;
//      a View holder sees Run only;
//  12. a store without sp_Blitz is told so plainly (the door's 409 refusal), not an empty list, and then reads Not installed;
//  13. under Arabic (RTL) the Restore panel lays out right to left.
//
//   1. run the app:  npx vite --port 5199      (or any port: DRIVE_PORT=5219)
//   2. node tools/store-db-restore-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { envelope, fixture, refusal, storeDbRoute } from './store-db-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.store-db-restore-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const VIEW = ['ActionSyncConsole:03', 'StoreDatabaseView:03']
const ACT = [...VIEW, 'StoreDatabaseAct:06']
const OWNER = [...ACT, 'StoreDatabaseRestore:06']
/** `StoreDatabaseJobQueued`, as the job doors answer. */
const ACCEPTED = { jobId: '01JD0000000000000000000009', code: 'P104', kind: 'RestoreSideCopy', notBefore: '2026-11-20T02:00:00', runNow: false, auditId: '01JD0A00000000000000000009', warning: '' }
const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const TODAY = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`

const jobsDoor = (url, req) => (req.method() === 'POST' ? envelope(ACCEPTED) : envelope(fixture('jobs')))

const browser = await chromium.launch()

async function open(path, { screens = OWNER, overrides = {}, locale = 'en' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const posts = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((lng) => {
    localStorage.setItem('oms.locale', lng)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', storeDbRoute({ screens, overrides: { Jobs: jobsDoor, RestoreJobs: () => envelope(ACCEPTED), ...overrides }, calls, posts }))
  await page.goto(`${BASE}${path}`, { timeout: 120000 })
  return { context, page, errors, calls, posts }
}

const plain = (s) => s.replace(/[\u2066-\u2069\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim()
const text = async (loc) => plain(await loc.innerText())
const dialog = (page) => page.locator('[data-reason-dialog]')
const status = (page, name) => page.locator(`[data-tab-grid="store-db-backups"] .ag-row`).filter({ hasText: name }).locator('[data-backup-status]')

// ── 1–6: Restore with the Restore key ────────────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open('/admin/sync/database/P104?panel=restore')
  await page.locator('[data-restore-panel]').waitFor({ timeout: 60000 })
  const strip = (await page.locator('[data-store-db-panels]').getAttribute('data-store-db-panels')).split(' ')
  check('1. the strip ends with Restore', strip.at(-1) === 'restore', strip.join(','))
  const never = await text(page.locator('[data-restore-never-live]'))
  check('1. …and the panel says the live database is never replaced', /never replaced/.test(never), never)

  check('2. nothing is browsed until Browse', (await page.locator('[data-restore-not-browsed]').count()) === 1 && !calls.some((c) => c.startsWith('StoreDatabase/Backups')))
  await page.locator('[data-restore-browse-button]').click()
  await page.locator('[data-tab-grid="store-db-backups"] .ag-row').first().waitFor({ timeout: 60000 })
  const asked = calls.filter((c) => c.startsWith('StoreDatabase/Backups'))
  check('2. an empty folder asks for the backup folder (no folder sent)', asked.length === 1 && asked[0] === 'StoreDatabase/Backups?code=P104', asked.join(' | '))
  const field = await page.locator('[data-restore-folder]').inputValue()
  check('2. …and the field shows the folder read', field === 'D:\\SQLBackup\\P104', field)

  check('3. four files are listed', (await page.locator('[data-tab-grid="store-db-backups"] .ag-row').count()) === 4)
  check('3. …the store engine’s backup can be restored', (await status(page, 'POS_full.bak').getAttribute('data-backup-status')) === 'ok')
  check('3. …an older build of the same engine can too', (await status(page, 'POS_20261101.bak').getAttribute('data-backup-status')) === 'ok')
  const newer = await text(status(page, 'POS_from_2019.bak'))
  check('3. …the 2019 backup says it was taken on a newer engine', /newer engine/.test(newer), newer)
  const broken = await text(status(page, 'half_copied.bak'))
  check('3. …an unreadable file shows the engine’s error', /could not read/.test(broken) && /incorrectly formed/.test(broken), broken)

  const btn = (name) => page.locator(`[data-backup-restore="${name}"]`)
  check('4. a newer-engine backup cannot be chosen', await btn('POS_from_2019.bak').isDisabled())
  check('4. …and its button says why', /newer engine/.test((await btn('POS_from_2019.bak').getAttribute('title')) ?? ''))
  check('4. an unreadable file cannot be chosen', await btn('half_copied.bak').isDisabled())
  check('4. the store engine’s backup can be chosen', await btn('POS_full.bak').isEnabled())

  await btn('POS_full.bak').click()
  await dialog(page).waitFor()
  check('5. Restore opens the RestoreSideCopy dialog', (await page.locator('[data-job-dialog]').getAttribute('data-job-dialog')) === 'RestoreSideCopy')
  const name = await page.locator('[data-restore-side-copy-name]').getAttribute('data-restore-side-copy-name')
  check('5. …it shows the side copy it will create', name === `POS_Restore_${TODAY}`, name)
  const words = await text(page.locator('[data-restore-dialog]'))
  check('5. …and the file it restores', /POS_full\.bak/.test(words) && new RegExp(`POS_Restore_${TODAY}`).test(words), words)
  check('5. …Confirm waits for a reason', await page.locator('[data-reason-confirm]').isDisabled())
  check('5. …it waits for tonight by default', (await page.locator('[data-job-when]').getAttribute('data-job-when')) === 'tonight')
  await page.locator('[data-reason-input]').fill('Check last week’s sales lines against HQ')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const body = posts.RestoreJobs?.[0]
  const want = { code: 'P104', kind: 'RestoreSideCopy', reason: 'Check last week’s sales lines against HQ', runNow: false, target: fixture('backups').files[0].file }
  check('5. …and posts the file to restore as its target, at the Restore door', JSON.stringify(body) === JSON.stringify(want) && !posts.Jobs, JSON.stringify(body))

  await page.locator('[data-restore-folder]').fill('E:\\Other')
  await page.locator('[data-restore-browse-button]').click()
  await page.waitForTimeout(500)
  const typed = calls.filter((c) => c.startsWith('StoreDatabase/Backups')).at(-1)
  check('6. a typed folder is asked for by name', typed === 'StoreDatabase/Backups?code=P104&folder=E%3A%5COther', typed)

  check('9. (owner) the side copies on Restore carry Drop', (await page.locator('[data-restore-panel] [data-side-copy-drop]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/restore.png`, fullPage: true })
  check('no page errors (restore)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: a taken side-copy name ────────────────────────────────────────────────────
{
  const store = fixture('store')
  store.sideCopies = [{ name: `POS_Restore_${TODAY}`, sizeKb: 2936012, createdAt: '2026-11-19T01:00:00' }]
  const backups = fixture('backups')
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=restore', { overrides: { Store: envelope(store), Backups: envelope(backups) } })
  await page.locator('[data-restore-browse-button]').click()
  await page.locator('[data-backup-restore="POS_full.bak"]').click()
  await dialog(page).waitFor()
  const name = await page.locator('[data-restore-side-copy-name]').getAttribute('data-restore-side-copy-name')
  check('7. a taken side-copy name takes the _2 suffix', name === `POS_Restore_${TODAY}_2`, name)
  check('no page errors (suffix)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: Drop on Space ─────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open('/admin/sync/database/P104?panel=space')
  await page.locator('[data-space-panel] [data-side-copy-drop="POS_Restore_20261110"]').click()
  await dialog(page).waitFor()
  check('8. Drop opens the DropSideCopy dialog naming the copy', (await page.locator('[data-job-dialog]').getAttribute('data-job-dialog')) === 'DropSideCopy' && (await page.locator('[data-drop-dialog]').getAttribute('data-drop-dialog')) === 'POS_Restore_20261110')
  await page.locator('[data-reason-input]').fill('Done comparing')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const body = posts.RestoreJobs?.[0]
  check('8. …and posts the side copy to drop as its target, at the Restore door', JSON.stringify(body) === JSON.stringify({ code: 'P104', kind: 'DropSideCopy', reason: 'Done comparing', runNow: false, target: 'POS_Restore_20261110' }) && !posts.Jobs, JSON.stringify(body))
  check('no page errors (drop)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: without the Restore key ───────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=restore', { screens: ACT })
  await page.locator('[data-restore-panel]').waitFor({ timeout: 60000 })
  check('9. without the Restore key the panel’s controls are off', (await page.locator('[data-restore-panel]').getAttribute('data-restore-controls')) === 'off')
  await page.locator('[data-restore-browse-button]').click()
  await page.locator('[data-tab-grid="store-db-backups"] .ag-row').first().waitFor({ timeout: 60000 })
  check('9. …Browse still lists', (await page.locator('[data-tab-grid="store-db-backups"] .ag-row').count()) === 4)
  check('9. …with no Restore button', (await page.locator('[data-backup-restore]').count()) === 0)
  check('9. …and no Drop on the side copies', (await page.locator('[data-side-copy-drop]').count()) === 0 && (await page.locator('[data-store-db-side-copies]').count()) === 1)
  await page.locator('[data-panel="space"]').click()
  await page.locator('[data-space-panel]').waitFor()
  check('9. …nor on the Space panel', (await page.locator('[data-side-copy-drop]').count()) === 0)
  check('no page errors (no restore key)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10–11: sp_Blitz with Act ─────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open('/admin/sync/database/P104?panel=health', { screens: ACT })
  await page.locator('[data-blitz]').waitFor({ timeout: 60000 })
  const state = await text(page.locator('[data-blitz-state]'))
  check('10. Health says the install state is not reported until Run (BO 4039 open)', state === 'Install state not reported', state)
  check('10. …and does not run it until asked', !calls.some((c) => c.startsWith('StoreDatabase/Blitz')))
  await page.locator('[data-blitz-run]').click()
  await page.locator('[data-tab-grid="store-db-blitz"] .ag-row').first().waitFor({ timeout: 60000 })
  check('10. Run lists its findings', (await page.locator('[data-tab-grid="store-db-blitz"] .ag-row').count()) === 3)
  const first = await text(page.locator('[data-tab-grid="store-db-blitz"] .ag-row[row-index="0"]'))
  check('10. …most urgent first', /Backups Not Performed Recently/.test(first), first)
  const after = await text(page.locator('[data-blitz-state]'))
  check('10. …and then reads installed with HQ’s recorded build', after === 'Installed, version 8.19', after)

  const jobs = await page.locator('[data-blitz] [data-job-buttons]').getAttribute('data-job-buttons')
  check('11. with Act Install and Remove show', jobs === 'InstallBlitz RemoveBlitz', jobs)
  await page.locator('[data-job-button="InstallBlitz"]').click()
  await dialog(page).waitFor()
  check('11. …Install defaults to tonight, with Run now', (await page.locator('[data-job-when]').getAttribute('data-job-when')) === 'tonight' && (await page.locator('[data-job-run-now]').count()) === 1)
  await page.locator('[data-reason-input]').fill('Deeper look at the slow till')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('11. …and posts kind InstallBlitz', JSON.stringify(posts.Jobs?.[0]) === JSON.stringify({ code: 'P104', kind: 'InstallBlitz', reason: 'Deeper look at the slow till', runNow: false }), JSON.stringify(posts.Jobs?.[0]))
  await page.screenshot({ path: `${SHOTS}/blitz.png`, fullPage: true })
  check('no page errors (blitz)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11: Install refused while HQ's sp_Blitz build slot is empty (BO 4039) ─────────
{
  const jobs = (url, req) => (req.method() === 'POST' ? refusal('NO_BLITZ_BUILD', 'No sp_Blitz build is loaded at HQ yet.', 409) : envelope(fixture('jobs')))
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=health', { screens: ACT, overrides: { Jobs: jobs } })
  await page.locator('[data-job-button="InstallBlitz"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('Deeper look at the slow till')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error]').waitFor({ timeout: 10000 })
  const code = await page.locator('[data-reason-error]').getAttribute('data-reason-error')
  const label = await text(page.locator('[data-reason-error-label]'))
  check('11. NO_BLITZ_BUILD is refused with its own words', code === 'NO_BLITZ_BUILD' && /no sp_Blitz build/.test(label), `${code} | ${label}`)
  check('no page errors (no build)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11–12: View only, and a store without sp_Blitz ───────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=health', {
    screens: VIEW,
    overrides: { Blitz: refusal('BLITZ_NOT_INSTALLED', 'sp_Blitz is not installed on P104.', 409) },
  })
  await page.locator('[data-blitz]').waitFor({ timeout: 60000 })
  check('11. a View holder sees Run only', (await page.locator('[data-blitz-run]').count()) === 1 && (await page.locator('[data-blitz] [data-job-button]').count()) === 0)
  await page.locator('[data-blitz-run]').click()
  await page.locator('[data-blitz-not-installed]').waitFor({ timeout: 30000 })
  check('12. after the refusal the state reads Not installed', (await text(page.locator('[data-blitz-state]'))) === 'Not installed')
  const said = await text(page.locator('[data-blitz-not-installed]'))
  check('12. a store without sp_Blitz is told so plainly', /not installed on this store/.test(said) && /P104/.test(said), said)
  check('12. …not an empty list', (await page.locator('[data-tab-grid="store-db-blitz"]').count()) === 0 && (await page.locator('[data-tab-empty="store-db-blitz"]').count()) === 0)
  check('no page errors (not installed)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: Arabic ───────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=restore', { locale: 'ar' })
  await page.locator('[data-restore-panel]').waitFor({ timeout: 60000 })
  check('13. under Arabic the page lays out right to left', (await page.locator('html').getAttribute('dir')) === 'rtl')
  await page.locator('[data-restore-browse-button]').click()
  await page.locator('[data-tab-grid="store-db-backups"] .ag-row').first().waitFor({ timeout: 60000 })
  await page.screenshot({ path: `${SHOTS}/restore-ar.png`, fullPage: true })
  check('no page errors (Arabic)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
