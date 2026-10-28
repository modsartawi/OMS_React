// Insurance rules ▸ IDF masters ▸ General ▸ Upload drive (BackOffice spec 3185 / door 3193; oms ticket 649).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. Fixtures and handlers are `tools/idf-stubs.mjs`
// (`// --- 647 ---`, `// --- 649 ---`, `idfStub`):
//   GET  IdfPriority/general/items                        → `state.general` (647)
//   POST IdfPriority/general/uploads                      multipart file → report + preview, by the file's NAME
//   POST IdfPriority/general/uploads/{uploadId}/apply     { reason } → { applied, failedBatches }
//
// It verifies, in LTR and RTL:
//   1. a dirty file: the multipart part names the file; its row report (lines, items ltr, rule words, messages);
//      no preview; Apply stays off and nothing is applied. A not-ok file says so, Apply off;
//   2. a clean file: "every row passed", lines ltr; the preview counts per kind; the table lists each change, before →
//      after as ONE ltr string per side (an added item "Not ranked"); a kind chip filters it;
//   3. Apply asks for a reason (a blank one is refused in the dialog, nothing sent); with one it posts `{ reason }`,
//      shows how many items were written, clears the report, and the general items re-read with the new ranks;
//   4. a file whose apply fails a batch: the result lists it, its lines as one ltr range and its message in a bdi;
//      (3185 review) it is not a success: "Applied in part", a warning toast (no success toast), the file's report stays
//      on screen and Apply stays off; a file that writes nothing says "Nothing was applied" with an error toast;
//   5. a refused apply stays in the dialog as the server's message;
//   6. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5215 --strictPort
//   2. node tools/idf-general-upload-drive.mjs        (DRIVE_PORT overrides 5215)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5215}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { refuseGeneralApply = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const writes = []
  const generalUploads = {}
  const calls = []
  const state = newIdfState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const multipart = /multipart\/form-data/.test(req.headers()['content-type'] ?? '')
    let body = null
    try {
      body = multipart ? req.postData() : (req.postDataJSON?.() ?? null)
    } catch {
      body = null
    }
    calls.push({ method: req.method(), path: p, multipart, body })
    const hit = idfStub(req.method(), p + url.search, body, { state, reads, writes, generalUploads, refuseGeneralApply })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/idf/general`)
  await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
  return { context, page, errors, reads, writes, calls }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|generalUpload\.|general\.|items\.|upload\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent.replace(/[\u2066-\u2069]/g, '')))
const attrs = (loc, a) => loc.evaluateAll((els, name) => els.map((e) => e.getAttribute(name)), a)
const csv = 'item,group,priority\n300700,IDF-IBU,5\n300110,IDF-PARA-500,1\n300230,IDF-AMOX,1\n300120,IDF-PARA-500,3\n'
const UP = '[data-idf-general-upload]'

async function uploadFile(page, name) {
  await page.locator(`${UP} [data-idf-general-upload-file]`).setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.locator(`${UP} [data-idf-general-upload-submit]`).click()
  await page.locator(`${UP} [data-idf-report]`).waitFor({ timeout: 30000 })
}
async function applyWith(page, reason) {
  await page.locator('[data-idf-general-upload-apply]').click()
  await page.locator('[data-idf-general-upload-dialog]').waitFor({ timeout: 30000 })
  await page.locator('[data-idf-general-upload-dialog] [data-field="reason"]').fill(reason)
  await page.locator('[data-idf-general-upload-confirm]').click()
}
const applyOff = async (page) => (await page.locator('[data-idf-general-upload-apply]').isDisabled())

for (const dir of ['ltr', 'rtl']) {
  // 1. dirty + not-ok
  {
    const { context, page, errors, writes, calls } = await open(dir)
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 0. the Upload block sits on the General page; Apply off before any file`, (await page.locator(UP).count()) === 1 && (await applyOff(page)))
    await uploadFile(page, 'general-dirty.csv')
    const up = calls.find((c) => c.method === 'POST' && c.path === 'IdfPriority/general/uploads')
    check(`${dir} 1. the file goes multipart, the part names it`, !!up && up.multipart && /name="file"; filename="general-dirty.csv"/.test(String(up.body)))
    const rep = page.locator(`${UP} [data-idf-report]`)
    check(`${dir} 1. the dirty report says two rows failed`, (await rep.getAttribute('data-idf-report')) === 'failed' && /^2 rows failed\./.test(strip(await page.locator(`${UP} [data-idf-report-summary]`).innerText())), strip(await rep.innerText()))
    const rows = page.locator(`${UP} [data-idf-report-rows] tbody tr`)
    check(`${dir} 1. lines and rules as sent`, JSON.stringify(await attrs(rows, 'data-line')) === '["3","4"]' && JSON.stringify(await attrs(rows, 'data-rule')) === '["unknownItem","badPriority"]')
    check(
      `${dir} 1. line + item ltr, the rule's word, the message in a bdi`,
      JSON.stringify(await ltr(rows.first())) === '["3","999999"]' &&
        strip(await rows.first().locator('[data-col="rule"]').innerText()) === 'Unknown item' &&
        strip(await rows.first().locator('[data-col="message"] bdi').innerText()) === 'Item 999999 is not a known item.',
      JSON.stringify(await ltr(rows.first())),
    )
    check(`${dir} 1. no preview; Apply stays off`, (await page.locator('[data-idf-general-preview]').count()) === 0 && (await applyOff(page)))
    await uploadFile(page, 'general-notok.csv')
    await page.locator(`${UP} [data-idf-report="failed"]`).waitFor({ timeout: 30000 })
    check(`${dir} 1. a not-ok file says so; Apply off`, /did not pass this file/.test(strip(await page.locator(`${UP} [data-idf-report-summary]`).innerText())) && (await applyOff(page)))
    check(`${dir} 1. nothing applied`, writes.length === 0)
    check(`${dir} 6. no page errors (dirty)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2 + 3. clean → preview → apply with a reason
  {
    const { context, page, errors, reads, writes } = await open(dir)
    await uploadFile(page, 'general-oct.csv')
    check(`${dir} 2. a clean file passes`, (await page.locator(`${UP} [data-idf-report]`).getAttribute('data-idf-report')) === 'clean')
    check(`${dir} 2. lines in the file ltr`, strip(await page.locator(`${UP} [data-idf-report-lines]`).innerText()) === 'Lines in the file: 5' && JSON.stringify(await ltr(page.locator(`${UP} [data-idf-report-lines]`))) === '["5"]')
    const chips = page.locator('[data-idf-general-preview-kinds] [data-kind]')
    check(
      `${dir} 2. a count per kind`,
      JSON.stringify(await attrs(chips, 'data-kind')) === '["all","added","reRanked","moved","unchanged"]' && JSON.stringify(await attrs(chips, 'data-count')) === '["4","1","1","1","1"]',
      JSON.stringify(await attrs(chips, 'data-count')),
    )
    check(`${dir} 2. the chip's count is ltr`, strip(await chips.nth(3).innerText()) === 'Moved 1' && JSON.stringify(await ltr(chips.nth(3))) === '["1"]', strip(await chips.nth(3).innerText()))
    const prow = (item) => page.locator(`[data-idf-general-preview-rows] tbody tr[data-item="${item}"]`)
    check(`${dir} 2. every change listed, in the server's order`, JSON.stringify(await attrs(page.locator('[data-idf-general-preview-rows] tbody tr'), 'data-item')) === '["300700","300110","300230","300120"]')
    check(
      `${dir} 2. moved: before and after each ONE ltr string`,
      strip(await prow('300230').locator('[data-col="change"]').innerText()) === 'Moved' &&
        JSON.stringify(await ltr(prow('300230').locator('[data-col="before"]'))) === '["IDF-IBU · 4"]' &&
        JSON.stringify(await ltr(prow('300230').locator('[data-col="after"]'))) === '["IDF-AMOX · 1"]',
      JSON.stringify(await ltr(prow('300230'))),
    )
    check(`${dir} 2. added: before is "Not ranked"`, strip(await prow('300700').locator('[data-col="before"]').innerText()) === 'Not ranked' && (await prow('300700').locator('[data-col="before"] bdi').count()) === 0)
    await page.locator('[data-idf-general-preview-kinds] [data-kind="reRanked"]').click()
    check(`${dir} 2. the Re-ranked chip filters the table`, JSON.stringify(await attrs(page.locator('[data-idf-general-preview-rows] tbody tr'), 'data-change')) === '["reRanked"]' && (await page.locator('[data-idf-general-preview-kinds] [data-kind="reRanked"]').getAttribute('aria-pressed')) === 'true')
    await page.locator('[data-idf-general-preview-kinds] [data-kind="all"]').click()
    check(`${dir} 2. All shows every change again`, (await page.locator('[data-idf-general-preview-rows] tbody tr').count()) === 4)
    check(`${dir} 3. Apply is on for a clean file`, !(await applyOff(page)))

    await page.locator('[data-idf-general-upload-apply]').click()
    await page.locator('[data-idf-general-upload-dialog]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-general-upload-confirm]').click()
    check(`${dir} 3. a blank reason is refused in the dialog, nothing sent`, (await page.locator('[data-idf-general-upload-dialog] [data-problem="reasonRequired"]').count()) === 1 && writes.length === 0)
    const before = (reads.generalItems ?? []).length
    await page.locator('[data-idf-general-upload-dialog] [data-field="reason"]').fill('October price list')
    await page.locator('[data-idf-general-upload-confirm]').click()
    await page.locator('[data-idf-general-upload-result]').waitFor({ timeout: 30000 })
    check(`${dir} 3. it posts { reason } for the upload`, writes.length === 1 && writes[0].path === 'IdfPriority/general/uploads/GU-1/apply' && JSON.stringify(writes[0].body) === '{"reason":"October price list"}', JSON.stringify(writes))
    const res = page.locator('[data-idf-general-upload-result]')
    check(`${dir} 3. the result says four items written, ltr; no failed batch`, strip(await res.innerText()) === 'Applied. Items written: 4' && JSON.stringify(await ltr(res)) === '["4"]' && (await page.locator('[data-idf-general-upload-batches]').count()) === 0, strip(await res.innerText()))
    check(`${dir} 3. the dialog closes, the report clears, Apply off`, (await page.locator('[data-idf-general-upload-dialog]').count()) === 0 && (await page.locator(`${UP} [data-idf-report]`).count()) === 0 && (await applyOff(page)))
    await page.waitForFunction(() => document.querySelector('[data-idf-items] tbody tr[data-item="300230"]')?.getAttribute('data-idf') === 'IDF-AMOX', null, { timeout: 30000 }).catch(() => {})
    check(`${dir} 3. the general items re-read with the new ranks`, (reads.generalItems ?? []).length > before && (await page.locator('[data-idf-items] tbody tr[data-item="300230"]').getAttribute('data-idf')) === 'IDF-AMOX')
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. no page errors (clean)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 4. a failed batch
  {
    const { context, page, errors } = await open(dir)
    await uploadFile(page, 'general-batch.csv')
    await applyWith(page, 'Trial')
    await page.locator('[data-idf-general-upload-result]').waitFor({ timeout: 30000 })
    const res = page.locator('[data-idf-general-upload-result]')
    check(`${dir} 4. two items written, one batch failed`, (await res.getAttribute('data-applied')) === '2' && strip(await page.locator('[data-idf-general-upload-batches-summary]').innerText()).startsWith('1 batch failed'), strip(await res.innerText()))
    const b = page.locator('[data-idf-general-upload-batches] tbody tr')
    check(
      `${dir} 4. the batch's lines as ONE ltr range, its message in a bdi`,
      (await b.count()) === 1 &&
        JSON.stringify(await ltr(b.locator('[data-col="lines"]'))) === '["3–4"]' &&
        strip(await b.locator('[data-col="message"] bdi').innerText()) === 'Lines 3–4 could not be written: the items changed while applying.',
      JSON.stringify(await ltr(b)),
    )
    check(
      `${dir} 4. a partial apply is not a success: its wording, a warning toast, no success toast`,
      (await res.getAttribute('data-outcome')) === 'partial' &&
        strip(await res.locator('[data-idf-general-upload-outcome]').innerText()) === 'Applied in part. Items written: 2' &&
        (await page.locator('[data-sonner-toast][data-type="warning"]', { hasText: 'General file applied in part' }).count()) === 1 &&
        (await page.locator('[data-sonner-toast][data-type="success"]').count()) === 0,
      strip(await res.innerText()),
    )
    check(`${dir} 4. the file's report stays on screen; Apply stays off`, (await page.locator(`${UP} [data-idf-report="clean"]`).count()) === 1 && (await applyOff(page)))
    check(`${dir} 6. no raw keys (batch)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (batch)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 4. (3185 review) a file that writes nothing
  {
    const { context, page, errors } = await open(dir)
    await uploadFile(page, 'general-nothing.csv')
    await applyWith(page, 'Trial')
    const res = page.locator('[data-idf-general-upload-result]')
    await res.waitFor({ timeout: 30000 })
    check(
      `${dir} 4. nothing written: "Nothing was applied", an error toast, the batch listed, the report kept`,
      (await res.getAttribute('data-outcome')) === 'failed' &&
        strip(await res.locator('[data-idf-general-upload-outcome]').innerText()) === 'Nothing was applied. Items written: 0' &&
        (await page.locator('[data-sonner-toast][data-type="error"]', { hasText: 'Nothing was applied' }).count()) === 1 &&
        (await page.locator('[data-idf-general-upload-batches] tbody tr').count()) === 1 &&
        (await page.locator(`${UP} [data-idf-report="clean"]`).count()) === 1 &&
        (await applyOff(page)),
      strip(await res.innerText()),
    )
    check(`${dir} 6. no page errors (nothing)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 5. a refused apply
  {
    const { context, page, errors, writes } = await open(dir, { refuseGeneralApply: true })
    await uploadFile(page, 'general-oct.csv')
    await applyWith(page, 'October price list')
    await page.locator('[data-idf-general-upload-apply-refused]').waitFor({ timeout: 30000 }).catch(() => {})
    check(
      `${dir} 5. a refused apply stays in the dialog as the server's message`,
      writes.length === 1 &&
        (await page.locator('[data-idf-general-upload-dialog]').count()) === 1 &&
        /The general master changed since this file was checked/.test(await page.locator('[data-idf-general-upload-apply-refused]').innerText()) &&
        (await page.locator('[data-idf-general-upload-result]').count()) === 0,
    )
    check(`${dir} 6. no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
