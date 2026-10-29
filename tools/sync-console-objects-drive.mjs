// Sync console Objects drive (ticket 662, BackOffice spec 2557 D10) — drives the REAL Objects page in Chromium
// against STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md, "Object enrolment doors").
// 🚩 NOTHING here is driven against a live SIS.Api: the live enrolment of a wave is the owner's.
//
// It verifies:
//   1. the nav carries Objects; the page opens on the objects not yet enrolled, in the door's order, with the counts;
//   2. "Show enrolled objects" adds the enrolled ones, each with its store count;
//   3. Enrol is offered only on a ready row (not on a row with no line number);
//   4. Enrol waits for a preview, and the preview needs a reason (the door checks it first);
//   5. the preview's sentence names the rows, stores, line and block; an empty table says so instead;
//   6. Enrol posts the same object with preview: false and the reason, toasts, and the list re-reads it as enrolled;
//   7. a refusal (ENROL_BUSY, a 409) keeps the dialog open with its code and words;
//   8. without canEnrol: no Enrol column, and the page says why.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-objects-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-objects-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads.
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
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

// The door's list, in the distributor's order: two legacy objects enrolled, one without a line number, the IDF wave.
const seedObjects = () => [
  { objectId: 'Item', table: 'Item', enrolled: true, storesEnrolled: 412, lineNumber: 1, hqRows: 98211 },
  { objectId: 'ItemVat', table: 'ItemVat', enrolled: false, storesEnrolled: 0, lineNumber: null, hqRows: 40 },
  { objectId: 'PaymentDiscountCampaign', table: 'PaymentDiscountCampaign', enrolled: true, storesEnrolled: 412, lineNumber: 7800, hqRows: 6 },
  { objectId: 'IdfPriorityMaster', table: 'IdfPriorityMaster', enrolled: false, storesEnrolled: 0, lineNumber: 7900, hqRows: 0 },
  { objectId: 'IdfStoreList', table: 'IdfStoreList', enrolled: false, storesEnrolled: 0, lineNumber: 7930, hqRows: 1 },
  { objectId: 'IdfIngredientMapping', table: 'IdfIngredientMapping', enrolled: false, storesEnrolled: 0, lineNumber: 7950, hqRows: 0 },
  { objectId: 'IdfException', table: 'IdfException', enrolled: false, storesEnrolled: 0, lineNumber: 7960, hqRows: 4 },
]

const STORES = 412
let nextAction = 88120401

const browser = await chromium.launch()

async function open({ canEnrol = true, busyOnce = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const posts = []
  const objects = seedObjects()
  let busy = busyOnce
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access')
      return route.fulfill(envelope({ screenAllowed: true, canOperate: true, canOnboard: false, canEnrol, canReplay: false }))
    if (p === 'ActionSync/Objects') return route.fulfill(envelope({ items: objects }))
    // The shell's notification bell polls on every page.
    if (p === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
    if (p === 'ActionSync/Audit') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    if (p === 'ActionSync/Objects/Enrol') {
      const body = route.request().postDataJSON()
      posts.push(body)
      if (!body.reason || !body.reason.trim())
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'A reason is required.', errorCode: 'REASON_REQUIRED' }))
      if (busy === body.objectId && !body.preview) {
        busy = null
        return route.fulfill(envelope(null, { status: 409, success: false, message: 'Another enrolment is running.', errorCode: 'ENROL_BUSY' }))
      }
      const o = objects.find((x) => x.objectId === body.objectId)
      if (!o || o.lineNumber === null)
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'No push for it.', errorCode: 'UNKNOWN_OBJECT' }))
      if (o.enrolled)
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Already enrolled.', errorCode: 'ALREADY_ENROLLED' }))
      const rows = o.hqRows ?? 0
      const blockStart = nextAction
      if (!body.preview) {
        nextAction += rows
        o.enrolled = true
        o.storesEnrolled = STORES
      }
      return route.fulfill(
        envelope({
          objectId: o.objectId,
          lineNumber: o.lineNumber,
          blockStart,
          blockEnd: blockStart + rows - 1,
          actionsMinted: rows,
          storesEnrolled: STORES,
          auditId: body.preview ? null : `A-${o.objectId}`,
        }),
      )
    }
    return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
  })
  await page.goto(`${BASE}/admin/sync/objects`)
  return { context, page, errors, posts, objects }
}

// One id per row, by row index (a row can render once per column container).
const rowIds = (page) =>
  page.locator('[data-objects-list] .ag-row[row-id]').evaluateAll((rows) => {
    const byIndex = new Map(rows.map((r) => [Number(r.getAttribute('row-index')), r.getAttribute('row-id')]))
    return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, id]) => id)
  })

// The text a reader sees, without the bidi isolates (FSI/PDI) `fsi()` wraps values in.
const plain = (s) => s.replace(/[⁦-⁩]/g, '')

const openEnrol = async (page, objectId) => {
  await page.locator(`[data-object-enrol="${objectId}"]`).click()
  await page.locator('[data-reason-dialog]').waitFor({ timeout: 10000 })
}

{
  const { context, page, errors, posts } = await open()
  await page.locator('[data-objects-list] .ag-row').first().waitFor({ timeout: 20000 })

  // 1.
  check('1. the console nav carries Objects', (await page.locator('[data-console-page="objects"]').count()) === 1)
  const opening = await rowIds(page)
  check(
    '1. opens on the objects not yet enrolled, in the door order',
    JSON.stringify(opening) === JSON.stringify(['ItemVat', 'IdfPriorityMaster', 'IdfStoreList', 'IdfIngredientMapping', 'IdfException']),
    opening.join(','),
  )
  check('1. the counts: 7 objects, 2 enrolled', (await page.locator('[data-objects-counts="2/7"]').count()) === 1)

  // 2.
  await page.locator('[data-objects-show-enrolled]').click()
  await page.locator('.ag-row[row-id="Item"]').waitFor({ timeout: 5000 })
  const all = await rowIds(page)
  check('2. Show enrolled adds them, still in the door order', all.length === 7 && all[0] === 'Item' && all[2] === 'PaymentDiscountCampaign', all.join(','))
  const itemState = await page.locator('.ag-row[row-id="Item"] [data-object-state]').innerText()
  check('2. an enrolled row shows its store count', /Enrolled/.test(itemState) && /412 stores/.test(itemState), itemState)
  await page.locator('[data-objects-show-enrolled]').click()

  // 3.
  check('3. no Enrol on a row with no line number', (await page.locator('[data-object-enrol="ItemVat"]').count()) === 0)
  check('3. Enrol on every ready row', (await page.locator('[data-object-enrol]').count()) === 4)

  // 4.
  await openEnrol(page, 'IdfException')
  check('4. Enrol is disabled before a preview', await page.locator('[data-reason-confirm]').isDisabled())
  check('4. Preview is disabled until a reason is typed', await page.locator('[data-enrol-preview-button]').isDisabled())
  await page.locator('[data-reason-input]').fill('IDF go-live, spec 3157')
  await page.locator('[data-enrol-preview-button]').click()
  await page.locator('[data-enrol-preview="fresh"]').waitFor({ timeout: 5000 })

  // 5.
  const sentence = plain(await page.locator('[data-enrol-sentence]').innerText())
  check('5. the preview names rows, stores, line and block', /Sends 4 rows to 412 stores at line 7960/.test(sentence) && /88120401 to 88120404/.test(sentence), sentence)
  check('5. the preview posted preview: true with the reason', posts.at(-1)?.preview === true && posts.at(-1)?.reason === 'IDF go-live, spec 3157')
  check('5. Enrol is enabled after the preview', !(await page.locator('[data-reason-confirm]').isDisabled()))
  await page.screenshot({ path: `${SHOTS}/enrol-preview.png`, fullPage: true })

  // 6.
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  const last = posts.at(-1)
  check('6. Enrol posted the same object, preview: false, with the reason', last?.objectId === 'IdfException' && last?.preview === false && last?.reason === 'IDF go-live, spec 3157', JSON.stringify(last))
  await page.getByText(/enrolled: .*412.* stores, .*4.* rows sent/).first().waitFor({ timeout: 5000 })
  const toast = plain(await page.getByText(/enrolled: .*412.* stores/).first().innerText())
  check('6. the toast reports the object, stores and rows', toast === 'IdfException enrolled: 412 stores, 4 rows sent.', toast)
  await page.waitForTimeout(400)
  check('6. the list re-read it: IdfException left the waiting list', !(await rowIds(page)).includes('IdfException'))
  check('6. the counts moved to 3/7', (await page.locator('[data-objects-counts="3/7"]').count()) === 1)

  // 5. (empty table)
  await openEnrol(page, 'IdfIngredientMapping')
  await page.locator('[data-reason-input]').fill('IDF go-live')
  await page.locator('[data-enrol-preview-button]').click()
  await page.locator('[data-enrol-preview="fresh"]').waitFor({ timeout: 5000 })
  const empty = plain(await page.locator('[data-enrol-sentence]').innerText())
  check('5. an empty table says it adds only the counter rows', /table is empty/.test(empty) && /7950/.test(empty) && !/0 rows/.test(empty), empty)
  await page.locator('[data-reason-cancel]').click()

  check('no page errors (enrol)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 7.
  const { context, page, errors } = await open({ busyOnce: 'IdfStoreList' })
  await page.locator('[data-objects-list] .ag-row').first().waitFor({ timeout: 20000 })
  await openEnrol(page, 'IdfStoreList')
  await page.locator('[data-reason-input]').fill('IDF go-live')
  await page.locator('[data-enrol-preview-button]').click()
  await page.locator('[data-enrol-preview="fresh"]').waitFor({ timeout: 5000 })
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error="ENROL_BUSY"]').waitFor({ timeout: 5000 })
  check('7. ENROL_BUSY keeps the dialog open with its code', (await page.locator('[data-reason-dialog]').count()) === 1)
  check('7. the refusal is worded', /Another enrolment is running/.test(await page.locator('[data-reason-error-label]').innerText()))
  check('7. the reason is kept', (await page.locator('[data-reason-input]').inputValue()) === 'IDF go-live')
  await page.screenshot({ path: `${SHOTS}/enrol-busy.png`, fullPage: true })
  check('no page errors (refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 8.
  const { context, page, errors } = await open({ canEnrol: false })
  await page.locator('[data-objects-list] .ag-row').first().waitFor({ timeout: 20000 })
  check('8. without canEnrol: no Enrol anywhere', (await page.locator('[data-object-enrol], [col-id="enrol"]').count()) === 0)
  check('8. without canEnrol: the page says why', (await page.locator('[data-objects-no-grant]').count()) === 1)
  check('no page errors (read only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
