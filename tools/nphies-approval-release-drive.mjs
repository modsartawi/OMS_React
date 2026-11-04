// Release approval number drive (ticket 751, BackOffice spec 3342, Nphies contract 1.1) — drives the
// REAL app in Chromium against MOCKED `Nphies/*` envelopes.
//
// ⚠ No live SIS.Api: the stubs are the shapes BackOffice 3343 built (`NphiesApprovalNumberReleased`,
// `NphiesApprovalReleaseEntry`, the 1.1 `Nphies/Access` answer, the §6 refusal codes), so the stub is
// a contract assertion rather than a convenience.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/nphies-approval-release-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAGE_URL = BASE + '/nphies/approval-release'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// `NphiesAuthHeaderDto`, the fields the page reads. `isDispensed` is NOT on the DTO today; the
// scenarios that set it prove the page reads it the day it lands.
const AUTH = (over = {}) => ({
  contractVersion: '1.1',
  id: 'AUTH-1',
  eligibilityId: 'ELG-1',
  memberId: 'M-1',
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '1000000003',
  patientIdType: 'NI',
  patientName: 'محمد العتيبي',
  patientGender: 'male',
  patientBirthDate: '1980-01-01',
  preAuthRef: '12345678',
  claimProcessingCodes: 'Complete',
  queued: false,
  error: false,
  cancelled: false,
  adjudicationOutcome: 'approved',
  needComm: false,
  actionDateTime: '2026-11-01T09:15:00',
  responseDateTime: '2026-11-01T09:16:00',
  serviceDate: '2026-11-01T00:00:00',
  errorMessageShort: '',
  disposition: '',
  processNote: '',
  statusCode: 200,
  claimType: 0,
  diagnosis: '',
  policyNumber: '',
  policyHolder: '',
  prescriptionRef: '',
  exceptionPrescription: false,
  authLines: [],
  authSupportingInfos: [],
  ...over,
})

const ENTRY = (over = {}) => ({
  id: 7,
  authId: 'AUTH-1',
  payerCode: 'PAY-9',
  preAuthRefBefore: '12345678',
  preAuthRefAfter: '12345678_',
  userId: 'msartawi',
  userName: 'msartawi',
  origin: 'oms',
  note: 'الصيدلي سيعيد الإصدار',
  releasedAt: '2026-11-04T10:30:00',
  ...over,
})

let scenario
let calls
const reset = (over = {}) => {
  scenario = {
    access: { canOpenNphies: true, canReleaseApprovalNumber: true, contractVersion: '1.1' },
    auths: { 'AUTH-1': AUTH() },
    history: [],
    releaseRefusal: null,
    ...over,
  }
  calls = { detail: 0, history: 0, release: [] }
}

async function run() {
  const browser = await chromium.launch()
  const errors = []

  const open = async (dir = 'ltr') => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await page.addInitScript((d) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    }, dir)
    await page.route('**/api/**', async (route) => {
      const url = route.request().url()
      const path = decodeURIComponent(url.split('/api/')[1].split('?')[0])
      if (path === 'Auth/Me')
        return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
      if (path === 'Nphies/Access') return route.fulfill(envelope(scenario.access))
      if (path.startsWith('Nphies/AuthResponse/')) {
        calls.detail++
        // Case-insensitive, like the SQL Server collation behind the door: `auth-1` answers AUTH-1.
        const wanted = path.slice('Nphies/AuthResponse/'.length).toUpperCase()
        const found = Object.entries(scenario.auths).find(([k]) => k.toUpperCase() === wanted)?.[1]
        if (!found)
          return route.fulfill(
            envelope(null, {
              status: 404,
              success: false,
              message: 'No authorization with that reference exists.',
              errors: [{ errorCode: 'AUTH_NOT_FOUND', errorMessage: 'not found' }],
            }),
          )
        return route.fulfill(envelope(found))
      }
      if (path.startsWith('Nphies/ApprovalNumber/Releases/')) {
        calls.history++
        calls.historyIds = [...(calls.historyIds ?? []), path.slice('Nphies/ApprovalNumber/Releases/'.length)]
        return route.fulfill(envelope({ items: scenario.history, contractVersion: '1.1' }))
      }
      if (path === 'Nphies/ApprovalNumber/Release') {
        const body = JSON.parse(route.request().postData() || '{}')
        calls.release.push(body)
        if (scenario.releaseDelayMs) await new Promise((r) => setTimeout(r, scenario.releaseDelayMs))
        if (scenario.releaseRefusal) {
          const [status, code] = scenario.releaseRefusal
          return route.fulfill(
            envelope(null, { status, success: false, message: 'server sentence', errors: [{ errorCode: code, errorMessage: code }] }),
          )
        }
        const auth = scenario.auths[body.authId]
        const before = auth.preAuthRef
        const after = before + '_'
        auth.preAuthRef = after
        const release = ENTRY({ authId: body.authId, preAuthRefBefore: before, preAuthRefAfter: after, note: body.note })
        scenario.history = [release, ...scenario.history]
        return route.fulfill(envelope({ contractVersion: '1.1', authId: body.authId, before, after, release }))
      }
      // Anything else the shell asks for answers an empty object (the authorizations drive's fallthrough).
      return route.fulfill(envelope({}))
    })
    return page
  }

  const search = async (page, id) => {
    await page.fill('[data-testid=bundle-id]', id)
    await page.click('[data-testid=bundle-search]')
  }

  // 1 — not found is its own state, never an empty card.
  reset()
  let page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=bundle-id]')
  await search(page, 'NOPE-1')
  await page.waitForSelector('[data-testid=not-found]')
  check('an unknown bundle Id shows not found', await page.isVisible('[data-testid=not-found]'))
  check('…and no summary card', (await page.locator('[data-testid=release-summary]').count()) === 0)
  check('the id is in the URL', page.url().includes('id=NOPE-1'))

  // 2 — the happy path.
  await search(page, 'AUTH-1')
  await page.waitForSelector('[data-testid=release-summary]')
  const summary = await page.textContent('[data-testid=release-summary]')
  check('the summary shows the approval number', summary.includes('12345678'))
  check('the summary shows payer, patient and claim type', summary.includes('PAY-9') && summary.includes('محمد العتيبي') && summary.includes('Prior authorization'))
  check('the summary shows the verdict', summary.includes('Approved'))
  check('dispensed reads "not shown here" when the door does not answer it', summary.includes('Not shown here'))
  check('the release button shows with the grant on a releasable row', await page.isVisible('[data-testid=release-open]'))
  await page.waitForSelector('[data-testid=release-history]')
  check('the history says never released', (await page.textContent('[data-testid=release-history]')).includes('never been released'))

  await page.click('[data-testid=release-open]')
  await page.waitForSelector('[data-testid=release-note]')
  check('the dialog names the approval number', (await page.textContent('dialog')).includes('12345678'))
  check('confirm is aria-disabled while the note is blank', (await page.getAttribute('[data-testid=release-confirm]', 'aria-disabled')) === 'true')
  await page.click('[data-testid=release-confirm]', { force: true })
  await page.waitForTimeout(300)
  check('a blank confirm posts nothing', calls.release.length === 0)
  await page.fill('[data-testid=release-note]', '   ')
  check('a whitespace note still cannot confirm', (await page.getAttribute('[data-testid=release-confirm]', 'aria-disabled')) === 'true')
  await page.fill('[data-testid=release-note]', 'Pharmacist reissues — old approval never dispensed')
  check('a typed note enables confirm', (await page.getAttribute('[data-testid=release-confirm]', 'aria-disabled')) === 'false')
  const historyBefore = calls.history
  await page.click('[data-testid=release-confirm]')
  await page.waitForSelector('dialog', { state: 'detached' })
  check('the release posts once', calls.release.length === 1)
  check(
    '🚩 the release posts only authId and note',
    JSON.stringify(Object.keys(calls.release[0]).sort()) === '["authId","note"]' && calls.release[0].authId === 'AUTH-1',
    JSON.stringify(calls.release[0]),
  )
  await page.waitForFunction(() => document.querySelector('[data-testid=approval-number]')?.textContent?.includes('12345678_'))
  check('the summary shows the new value', (await page.textContent('[data-testid=approval-number]')).includes('12345678_'))
  await page.waitForFunction(() => document.querySelector('[data-testid=release-history] table'))
  const historyText = await page.textContent('[data-testid=release-history]')
  check('the history refreshed and shows the release', calls.history > historyBefore && historyText.includes('12345678_') && historyText.includes('Pharmacist reissues'))
  check('the released row now says already released, with no button', (await page.locator('[data-testid=release-open]').count()) === 0 && (await page.textContent('[data-testid=release-withheld]')).includes('already released'))

  // 3 — no polling.
  const detailCalls = calls.detail
  const historyCalls = calls.history
  await page.waitForTimeout(3000)
  check('no refetch on a timer', calls.detail === detailCalls && calls.history === historyCalls)
  await page.close()

  // 4 — without the release grant: the record, no button.
  reset({ access: { canOpenNphies: true, canReleaseApprovalNumber: false, contractVersion: '1.1' } })
  page = await open()
  await page.goto(PAGE_URL + '?id=AUTH-1')
  await page.waitForSelector('[data-testid=release-summary]')
  check('without the grant: the summary shows', true)
  check('without the grant: no button', (await page.locator('[data-testid=release-open]').count()) === 0)
  check('without the grant: a line says why', (await page.textContent('[data-testid=release-withheld]')).includes('grant'))
  await page.close()

  // 5 — a 1.0 door with no grant field: no button.
  reset({ access: { canOpenNphies: true } })
  page = await open()
  await page.goto(PAGE_URL + '?id=AUTH-1')
  await page.waitForSelector('[data-testid=release-summary]')
  check('a probe without the field shows no button', (await page.locator('[data-testid=release-open]').count()) === 0)
  await page.close()

  // 6 — dispensed / empty rows.
  for (const [name, over, words] of [
    ['dispensed', { isDispensed: true }, 'Undispense it first'],
    ['empty', { preAuthRef: '' }, 'no approval number'],
  ]) {
    reset({ auths: { 'AUTH-1': AUTH(over) } })
    page = await open()
    await page.goto(PAGE_URL + '?id=AUTH-1')
    await page.waitForSelector('[data-testid=release-summary]')
    check(`a ${name} row: no button`, (await page.locator('[data-testid=release-open]').count()) === 0)
    check(`a ${name} row: the line says why`, (await page.textContent('[data-testid=release-withheld]')).includes(words))
    await page.close()
  }

  // 7 — a refusal renders in the dialog in the page's words, and the row is re-read.
  reset({ releaseRefusal: [409, 'AUTH_ALREADY_DISPENSED'] })
  page = await open()
  await page.goto(PAGE_URL + '?id=AUTH-1')
  await page.waitForSelector('[data-testid=release-open]')
  await page.click('[data-testid=release-open]')
  await page.fill('[data-testid=release-note]', 'reissue')
  const detailBeforeRefusal = calls.detail
  await page.click('[data-testid=release-confirm]')
  await page.waitForFunction(() => document.querySelector('dialog')?.textContent?.includes('Undispense it first'))
  check('a dispensed refusal shows the page’s own sentence in the dialog', (await page.textContent('dialog')).includes('Undispense it first, then release'))
  await page.waitForTimeout(400)
  check('…and the authorization is read again', calls.detail > detailBeforeRefusal)
  await page.close()

  // 7b — review fixes: the canonical id, and no second release while one is in flight.
  reset({ releaseDelayMs: 1500 })
  page = await open()
  await page.goto(PAGE_URL + '?id=auth-1')
  await page.waitForSelector('[data-testid=release-open]')
  await page.waitForSelector('[data-testid=release-history]')
  check('the history is read under the server’s own id', (calls.historyIds ?? []).every((x) => x === 'AUTH-1'), JSON.stringify(calls.historyIds))
  await page.click('[data-testid=release-open]')
  await page.fill('[data-testid=release-note]', 'reissue')
  await page.click('[data-testid=release-confirm]')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('Escape does not close the dialog while the release is in flight', await page.isVisible('[data-testid=release-note]'))
  await page.waitForSelector('dialog', { state: 'detached' })
  check('the release posts the server’s own id, once', calls.release.length === 1 && calls.release[0].authId === 'AUTH-1', JSON.stringify(calls.release))
  await page.waitForFunction(() => document.querySelector('[data-testid=release-history] table'))
  check('…and the history under that id shows it', (await page.textContent('[data-testid=release-history]')).includes('12345678_'))
  await page.close()

  // 8 — the nav leaf, and Arabic RTL.
  reset()
  page = await open('rtl')
  await page.goto(PAGE_URL + '?id=AUTH-1')
  await page.waitForSelector('[data-testid=release-summary]')
  check('RTL: the document is dir=rtl', (await page.getAttribute('html', 'dir')) === 'rtl')
  // ⚠ The app never switches i18next's `lng` today: `oms.locale` sets only `<html dir>` (index.html), so every
  // `ar` bundle is registered but not yet rendered. The AR keys are proven by vitest (i18n-keys.test.ts); here
  // the RTL layout is: the summary's first fact sits at the reading start (the right edge).
  const facts = await page.locator('[data-testid=release-summary] > div').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().x))
  check('RTL: the summary reads right to left', facts[0] > facts[1], JSON.stringify(facts))
  check('the nav carries the leaf', (await page.locator('a[href="/nphies/approval-release"]').count()) > 0)
  check('RTL: the approval number is isolated ltr', (await page.locator('[data-testid=approval-number] bdi[dir=ltr]').count()) === 1)
  await page.screenshot({ path: process.env.SHOT || 'approval-release-rtl.png', fullPage: true })
  await page.close()

  check('no page errors', errors.length === 0, errors.join(' | '))
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
