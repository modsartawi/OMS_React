// Store database Space / Backup / Jobs drive (oms 918, BackOffice spec 4016, doors 4034–4037) — drives the REAL store
// page in Chromium against STUBBED `StoreDatabase/*` envelopes (`tools/store-db-stubs.mjs`, fixtures
// `src/features/admin/sync-console/store-db/__fixtures__/store.json`, `jobs.json`, `backup-schedule.json`), shaped to
// the GUESSED contract. 🚩 NOTHING here is driven against a live SIS.Api.
//
// It verifies:
//   1. with Act the strip shows Space, Backup and Jobs after Readings;
//   2. Space reads the cap, used, file size, free inside the file, log and drive free from the page's reading;
//   3. Space shows Shrink log, Shrink data and Run cleanup now with the Act key;
//   4. the side copies are on Space, no longer on Readings;
//   5. Shrink log asks for a reason (Confirm waits for one), offers no Run now, and posts `{ code, kind, reason,
//      runNow: true }`; the toast names when it starts;
//   6. a refused job shows the server's refusal text with its code and words, and the dialog stays open;
//   7. Shrink data warns it blocks the till, defaults to tonight (`runNow: false`), and Run now sends `runNow: true`;
//   8. Backup shows the last full backup and Back up now posts kind Backup;
//   9. the store's schedule reads "Weekly on Friday (this store's own schedule)"; changing it to Daily asks for a reason
//      and PUTs `{ code, frequency: 'Daily', weekday: null, reason }`;
//  10. the fleet default is hidden without Restore, and with it the owner PUTs `{ code: null, … }`;
//  11. Jobs lists the store's jobs with state, attempts, not before, start, finish, and a failed job's error;
//  12. without Act no job button, schedule editor or fleet default shows; Jobs still lists;
//  13. under Arabic (RTL) the Space panel lays out right to left.
//
//   1. run the app:  npx vite --port 5199      (or any port: DRIVE_PORT=5218)
//   2. node tools/store-db-space-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { envelope, fixture, refusal, storeDbRoute } from './store-db-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.store-db-space-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const VIEW = ['ActionSyncConsole:03', 'StoreDatabase:03']
const ACT = [...VIEW, 'StoreDatabase:06']
const OWNER = [...ACT, 'StoreDatabaseRestore:06']
const ACCEPTED = { jobId: '01JD0000000000000000000000', notBefore: '2026-11-18T23:05:00', warning: null }
const TONIGHT = { jobId: '01JD0000000000000000000001', notBefore: '2026-11-19T02:00:00', warning: 'A data shrink blocks the till while it runs.' }

/** The Jobs door: the list on GET, an accepted job on POST (a per-kind answer when given). */
const jobsDoor = (answers = {}) => (url, req) => {
  if (req.method() !== 'POST') return envelope(fixture('jobs'))
  const kind = req.postDataJSON()?.kind
  const a = answers[kind]
  return a ?? envelope(ACCEPTED)
}

const browser = await chromium.launch()

async function open(path, { screens = ACT, overrides = {}, locale = 'en' } = {}) {
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
  await page.route('**/api/**', storeDbRoute({ screens, overrides: { Jobs: jobsDoor(), ...overrides }, calls, posts }))
  await page.goto(`${BASE}${path}`, { timeout: 120000 })
  return { context, page, errors, calls, posts }
}

const plain = (s) => s.replace(/[\u2066-\u2069\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim()
const text = async (loc) => plain(await loc.innerText())
const dialog = (page) => page.locator('[data-reason-dialog]')
// A toast's interpolated values are FSI…PDI isolated (bidi rule): match the words around them.
const iso = (re) => new RegExp(re.source.replace(/P104/g, '\\W?P104\\W?'))
const toast = (page, re) => page.locator('[data-sonner-toast]').filter({ hasText: iso(re) })

// ── 1–7: Space ───────────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open('/admin/sync/database/P104?panel=space', {
    overrides: { Jobs: jobsDoor({ ShrinkData: refusal('TOO_LITTLE_FREE', 'Only 120 MB is free inside the data file; a shrink needs 500 MB.', 400) }) },
  })
  await page.locator('[data-space-panel]').waitFor({ timeout: 60000 })
  const strip = (await page.locator('[data-store-db-panels]').getAttribute('data-store-db-panels')).split(' ')
  check('1. the strip shows Space, Backup and Jobs after Readings', strip[0] === 'readings' && ['space', 'backup', 'jobs'].every((p) => strip.includes(p)), strip.join(','))

  check('2. Space has its six lines', (await page.locator('[data-space-line]').count()) === 6)
  const free = await text(page.locator('[data-space-line="freeInFile"] dd'))
  const log = await text(page.locator('[data-space-line="log"] dd'))
  const used = await text(page.locator('[data-space-line="used"] dd'))
  check('2. …used, free inside the file and the log', used === '3.0 GB, 75% of the cap' && free === '256 MB' && log === '60 MB used of 512 MB', `${used} | ${free} | ${log}`)

  const buttons = await page.locator('[data-job-buttons]').getAttribute('data-job-buttons')
  check('3. Space shows Shrink log, Shrink data and Run cleanup now', buttons === 'ShrinkLog ShrinkData Cleanup', buttons)

  const copy = await text(page.locator('[data-space-panel] [data-tab-grid="store-db-side-copies"] .ag-row').first())
  check('4. the side copies are on Space', /POS_Restore_20261110/.test(copy) && /2.8 GB/.test(copy), copy)

  // 5. Shrink log
  await page.locator('[data-job-button="ShrinkLog"]').click()
  await dialog(page).waitFor()
  check('5. Shrink log opens its dialog', (await page.locator('[data-job-dialog]').getAttribute('data-job-dialog')) === 'ShrinkLog')
  check('5. …Confirm waits for a reason', await page.locator('[data-reason-confirm]').isDisabled())
  check('5. …and offers no Run now (it runs now)', (await page.locator('[data-job-run-now]').count()) === 0)
  await page.locator('[data-reason-input]').fill('  Log grew to 4 GB during the cleanup  ')
  await page.locator('[data-reason-confirm]').click()
  await toast(page, /Shrink log on P104 is queued/).waitFor({ timeout: 10000 })
  const sl = posts.Jobs?.[0]
  check('5. …posts code, kind, the trimmed reason and runNow', JSON.stringify(sl) === JSON.stringify({ code: 'P104', kind: 'ShrinkLog', reason: 'Log grew to 4 GB during the cleanup', runNow: true }), JSON.stringify(sl))
  const t5 = await text(toast(page, /Shrink log on P104 is queued/))
  check('5. …the toast says when it starts', /starts from 2026-11-18 23:05/.test(t5), t5)
  check('5. …and the dialog closes', (await dialog(page).count()) === 0)

  // 6–7. Shrink data: refused, then tonight / Run now
  await page.locator('[data-job-button="ShrinkData"]').click()
  await dialog(page).waitFor()
  const note = await text(dialog(page))
  check('7. Shrink data warns it blocks the till', /blocks the till/.test(note), note.slice(0, 120))
  check('7. …and defaults to tonight', (await page.locator('[data-job-when]').getAttribute('data-job-when')) === 'tonight')
  await page.locator('[data-reason-input]').fill('Data file has room after the cleanup')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error]').waitFor({ timeout: 10000 })
  const banner = await text(dialog(page))
  check('6. a refused job shows the server’s refusal text', /Only 120 MB is free inside the data file; a shrink needs 500 MB\./.test(banner), banner.slice(-160))
  check('6. …with its code and words', (await page.locator('[data-reason-error]').getAttribute('data-reason-error')) === 'TOO_LITTLE_FREE' &&
    /Too little space is free inside the data file\./.test(await text(page.locator('[data-reason-error-label]'))))
  check('6. …and the dialog stays open with the reason kept', (await page.locator('[data-reason-input]').inputValue()) === 'Data file has room after the cleanup')
  check('7. …the refused ask was sent for tonight', posts.Jobs?.[1]?.runNow === false && posts.Jobs?.[1]?.kind === 'ShrinkData', JSON.stringify(posts.Jobs?.[1]))
  await page.screenshot({ path: `${SHOTS}/refused.png` })
  await page.locator('[data-reason-cancel]').click()
  await context.close()
  check('no page errors (space)', errors.length === 0, errors.join(' | '))
}
{
  const { context, page, errors, posts } = await open('/admin/sync/database/P104?panel=space', {
    overrides: { Jobs: jobsDoor({ ShrinkData: envelope(TONIGHT) }) },
  })
  await page.locator('[data-job-button="ShrinkData"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-job-run-now]').click()
  check('7. Run now switches the job to now', (await page.locator('[data-job-when]').getAttribute('data-job-when')) === 'now')
  await page.locator('[data-reason-input]').fill('Store is closed for inventory')
  await page.locator('[data-reason-confirm]').click()
  await toast(page, /Shrink data on P104 is queued/).waitFor({ timeout: 10000 })
  check('7. …and posts runNow: true', posts.Jobs?.[0]?.runNow === true, JSON.stringify(posts.Jobs?.[0]))
  check('7. …the door’s warning is shown', (await toast(page, /blocks the till while it runs/).count()) === 1)
  check('no page errors (run now)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4b: Readings no longer lists side copies ─────────────────────────────────────
{
  const { context, page } = await open('/admin/sync/database/P104?panel=readings')
  await page.locator('[data-readings-panel]').waitFor({ timeout: 60000 })
  check('4. …no longer on Readings', (await page.locator('[data-store-db-side-copies]').count()) === 0)
  await context.close()
}

// ── 8–9: Backup (Act, not owner) ─────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open('/admin/sync/database/P104?panel=backup')
  await page.locator('[data-schedule-effective]').waitFor({ timeout: 60000 })
  check('8. Backup shows the last full backup', (await text(page.locator('[data-backup-last]'))) === '2026-11-17 02:15, 2.8 GB')
  await page.locator('[data-job-button="Backup"]').click()
  await dialog(page).waitFor()
  check('8. …Back up now offers no Run now', (await page.locator('[data-job-run-now]').count()) === 0)
  await page.locator('[data-reason-input]').fill('Before the engine move')
  await page.locator('[data-reason-confirm]').click()
  await toast(page, /Backup on P104 is queued/).waitFor({ timeout: 10000 })
  check('8. …and posts kind Backup, now', posts.Jobs?.[0]?.kind === 'Backup' && posts.Jobs?.[0]?.runNow === true, JSON.stringify(posts.Jobs?.[0]))

  const eff = await text(page.locator('[data-schedule-effective]'))
  check('9. the store’s schedule reads in words', eff === "Weekly on Friday (this store's own schedule)", eff)
  check('9. …Save waits for a change', await page.locator('[data-schedule-editor="store"] [data-schedule-save]').isDisabled())
  await page.locator('[data-schedule-editor="store"] [data-schedule-frequency]').selectOption('Daily')
  check('9. …the weekday goes with Weekly', (await page.locator('[data-schedule-editor="store"] [data-schedule-weekday]').count()) === 0)
  await page.locator('[data-schedule-editor="store"] [data-schedule-save]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('Busy store, daily from now')
  await page.locator('[data-reason-confirm]').click()
  await toast(page, /backup schedule of P104 is saved/).waitFor({ timeout: 10000 })
  const put = posts.BackupSchedule?.[0]
  check('9. …and PUTs the store’s schedule with the reason', JSON.stringify(put) === JSON.stringify({ code: 'P104', frequency: 'Daily', weekday: null, reason: 'Busy store, daily from now' }), JSON.stringify(put))
  check('10. the fleet default is hidden without Restore', (await page.locator('[data-fleet-default]').count()) === 0)
  check('no page errors (backup)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: the owner's fleet default ────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open('/admin/sync/database/P104?panel=backup', { screens: OWNER })
  await page.locator('[data-fleet-default]').waitFor({ timeout: 60000 })
  check('10. the owner sees the fleet default, Off', /Off/.test(await text(page.locator('[data-fleet-default]'))))
  await page.locator('[data-schedule-editor="fleet"] [data-schedule-frequency]').selectOption('Weekly')
  await page.locator('[data-schedule-editor="fleet"] [data-schedule-weekday]').selectOption('4')
  await page.locator('[data-schedule-editor="fleet"] [data-schedule-save]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('Fleet on Thursdays')
  await page.locator('[data-reason-confirm]').click()
  await toast(page, /fleet default backup schedule is saved/).waitFor({ timeout: 10000 })
  const put = posts.BackupSchedule?.[0]
  check('10. …and PUTs it with code null', JSON.stringify(put) === JSON.stringify({ code: null, frequency: 'Weekly', weekday: 4, reason: 'Fleet on Thursdays' }), JSON.stringify(put))
  await page.screenshot({ path: `${SHOTS}/backup-owner.png`, fullPage: true })
  check('no page errors (owner)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11: Jobs ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('/admin/sync/database/P104?panel=jobs')
  await page.locator('[data-tab-grid="store-db-jobs"] .ag-row').first().waitFor({ timeout: 60000 })
  check('11. Jobs asks the door for its store', calls.includes('StoreDatabase/Jobs?code=P104'))
  check('11. …and lists the 3 jobs', (await page.locator('[data-jobs-panel]').getAttribute('data-jobs-panel')) === '3')
  const states = await page.locator('[data-tab-grid="store-db-jobs"] [data-job-state]').evaluateAll((els) => els.map((e) => e.getAttribute('data-job-state')))
  check('11. …with their states', states.join(',') === 'Queued,Failed,Done', states.join(','))
  const row0 = page.locator('[data-tab-grid="store-db-jobs"] .ag-row[row-index="0"]')
  const nb = await text(row0.locator('[col-id="notBefore"]').first())
  check('11. …a tonight job shows its Not before', nb === '2026-11-19 02:00', nb)
  const row1 = page.locator('[data-tab-grid="store-db-jobs"] .ag-row[row-index="1"]')
  const err = await text(row1.locator('[data-job-error]'))
  const attempts = await text(row1.locator('[col-id="attempts"]').first())
  const started = await text(row1.locator('[col-id="startedAt"]').first())
  const finished = await text(row1.locator('[col-id="finishedAt"]').first())
  check('11. …a failed job shows its attempts, start, finish and error', attempts === '3' && started === '2026-11-18 09:52' && finished === '2026-11-18 09:52' &&
    /below 1.5 × the data used/.test(err), `${attempts} | ${started} | ${finished} | ${err}`)
  await page.screenshot({ path: `${SHOTS}/jobs.png`, fullPage: true })
  check('no page errors (jobs)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 12: View only ────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=space', { screens: VIEW })
  await page.locator('[data-space-panel]').waitFor({ timeout: 60000 })
  check('12. without Act Space shows no job button', (await page.locator('[data-job-button]').count()) === 0)
  await page.locator('[data-panel="backup"]').click()
  await page.locator('[data-schedule-effective]').waitFor({ timeout: 60000 })
  check('12. …Backup shows the schedule but no button, editor or fleet default',
    (await page.locator('[data-job-button]').count()) === 0 && (await page.locator('[data-schedule-editor]').count()) === 0 && (await page.locator('[data-fleet-default]').count()) === 0)
  await page.locator('[data-panel="jobs"]').click()
  await page.locator('[data-tab-grid="store-db-jobs"] .ag-row').first().waitFor({ timeout: 60000 })
  check('12. …and Jobs still lists', (await page.locator('[data-jobs-panel]').getAttribute('data-jobs-panel')) === '3')
  check('no page errors (view only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: Arabic ───────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=space', { locale: 'ar' })
  await page.locator('[data-space-panel]').waitFor({ timeout: 60000 })
  check('13. under Arabic the page lays out right to left', (await page.locator('html').getAttribute('dir')) === 'rtl')
  await page.screenshot({ path: `${SHOTS}/space-ar.png`, fullPage: true })
  check('no page errors (Arabic)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
