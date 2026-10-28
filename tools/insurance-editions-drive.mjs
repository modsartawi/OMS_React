// Insurance rules ▸ Editions drive (BackOffice spec 3126 / door 3138; oms ticket 613).
//
// Drives the REAL app in Chromium against STUBS of the editions doors, on the REAL envelope. Fixtures and the
// handler are `tools/insurance-rules-stubs.mjs` (`// --- 613 ---`, `editionsStub`):
//   GET  InsuranceRules/Editions?list=          → the history (`EDITIONS`, then what the run uploads)
//   POST InsuranceRules/Editions (multipart)    → { id: 'ED-SFDA-59' }
//   GET  InsuranceRules/Editions/{id}/Diff      → `EDITION_DIFFS`
//   POST InsuranceRules/Editions/{id}/Publish   → refused for the uploader (403 EDITIONS_SELF_PUBLISH)
//   GET  InsuranceRules/Editions/{id}/Gaps      → `EDITION_GAPS`
//   GET  InsuranceRules/Editions/{id}/Gaps/Export → an .xlsx (guessed door)
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3138 is unbuilt. Ticket 618 swaps in the doors.
//
// It verifies, in LTR and RTL:
//   1. the Editions leaf; the SFDA list by default, its live edition and its history; the CHI tab in the URL;
//   2. upload: the button waits for a file; the multipart carries `list` and the file; it lands on the edition;
//   3. the diff: counts, against the live edition, items newly unmatched, rules affected with back-test fires;
//   4. the uploader cannot publish: the button is disabled with its reason, and clicking it writes nothing;
//   5. the gap report: counts by kind, the kind filter, the export downloads the file;
//   6. a SECOND user publishes (confirm), the edition turns live, the old live one old, and it is read-only;
//   7. a server refusal of a publish shows the server's words; an old edition is read-only; an unknown id says
//      so; a bare 403 is "You do not have access";
//   8. machine values in `bdi[dir=ltr]`, Arabic names in `bdi[dir=rtl]`; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5134 --strictPort
//   2. node tools/insurance-editions-drive.mjs        (DRIVE_PORT overrides 5134)
import { createRequire } from 'node:module'
import { UPLOADED_EDITION_ID, UPLOADED_FILE_NAME, editionsState, editionsStub, envelope } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5134}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

/** The multipart parts a POST carried: `{ list, fileName }`. */
function multipart(req) {
  const text = req.postDataBuffer()?.toString('utf8') ?? ''
  const list = /name="list"\r\n\r\n([^\r\n]*)/.exec(text)?.[1] ?? null
  const fileName = /name="file"; filename="([^"]*)"/.exec(text)?.[1] ?? null
  return { list, fileName }
}

async function open(dir, { user = 'msartawi', editions, deny = [], refusePublish = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const writes = []
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
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: user, currentStoreCode: 'P001' }))
    let upload = null
    if (req.method() !== 'GET') {
      upload = p === 'InsuranceRules/Editions' ? multipart(req) : null
      writes.push({ method: req.method(), path: p, upload })
    }
    const hit = editionsStub(req.method(), p + url.search, { deny, reads, user, editions, refusePublish, upload })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, writes }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|editions):|listName\.|gapKind\.|publish\.|diff\.|gaps\.|state\.|columns\./.test(await page.locator('main').innerText())
const historyIds = (page) => page.locator('[data-history] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-edition')}:${e.querySelector('[data-edition-state]').getAttribute('data-edition-state')}`))
const isDisabled = async (loc) => (await loc.getAttribute('aria-disabled')) === 'true' || (await loc.isDisabled())

for (const dir of ['ltr', 'rtl']) {
  const hq = editionsState() // one HQ for both users of this pass

  // ── 1–5: the uploader ─────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, reads, writes } = await open(dir, { editions: hq })
    await page.goto(`${BASE}/insurance-rules/editions`)
    await page.locator('[data-history] tbody tr').first().waitFor({ timeout: 30000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Editions leaf`, (await page.locator('a[href="/insurance-rules/editions"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'Editions')
    check(`${dir} 1. SFDA is the default tab`, (await page.locator('[data-list-tab="sfda"]').getAttribute('aria-selected')) === 'true')
    check(`${dir} 1. the live edition is named, an ltr isolate`, (await page.locator('[data-live-edition] bdi[dir="ltr"]').innerText()) === 'ED-SFDA-58')
    check(`${dir} 1. the SFDA history: live, then old`, JSON.stringify(await historyIds(page)) === JSON.stringify(['ED-SFDA-58:live', 'ED-SFDA-57:retired']), JSON.stringify(await historyIds(page)))
    const r58 = page.locator('[data-edition="ED-SFDA-58"]')
    check(`${dir} 1. a row: rows, uploaded and published, each one ltr isolate`, strip(await r58.locator('[data-col="rows"] bdi[dir="ltr"]').innerText()) === '9,412' && strip(await r58.locator('[data-col="uploaded"] bdi[dir="ltr"]').innerText()) === 'nalharbi · 2026-09-28 10:12' && strip(await r58.locator('[data-col="published"] bdi[dir="ltr"]').innerText()) === 'falotaibi · 2026-09-29 09:01', strip(await r58.innerText()))
    check(`${dir} 1. state words`, strip(await r58.locator('[data-edition-state]').innerText()) === 'Live' && strip(await page.locator('[data-edition="ED-SFDA-57"] [data-edition-state]').innerText()) === 'Old')
    await page.locator('[data-list-tab="chi"]').click()
    await page.locator('[data-edition="ED-CHI-7"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 1. the CHI tab lands in the URL and reads its own history`, new URL(page.url()).searchParams.get('list') === 'chi' && JSON.stringify(await historyIds(page)) === JSON.stringify(['ED-CHI-7:live']))
    check(`${dir} 1. the upload names the list`, strip(await page.locator('[data-upload] .font-medium').first().innerText()) === 'Upload a new edition of the CHI Drug Formulary')
    await page.locator('[data-list-tab="sfda"]').click()
    await page.locator('[data-edition="ED-SFDA-58"]').waitFor({ timeout: 10000 })
    check(`${dir} 1. no raw keys on the list`, await noRawKeys(page))

    // 2. upload
    const submit = page.locator('[data-upload-submit]')
    check(`${dir} 2. Upload waits for a file`, await isDisabled(submit))
    await page.locator('[data-upload-file]').setInputFiles({ name: UPLOADED_FILE_NAME, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK-fake-xlsx') })
    await submit.click()
    await page.waitForURL(`**/insurance-rules/editions/sfda/${UPLOADED_EDITION_ID}`, { timeout: 20000 }).catch(() => {})
    check(`${dir} 2. the upload lands on the new edition`, new URL(page.url()).pathname === `/insurance-rules/editions/sfda/${UPLOADED_EDITION_ID}`, page.url())
    const up = writes.filter((w) => w.path === 'InsuranceRules/Editions')
    check(`${dir} 2. one multipart POST with the list and the file`, up.length === 1 && up[0].method === 'POST' && up[0].upload.list === 'sfda' && up[0].upload.fileName === UPLOADED_FILE_NAME, JSON.stringify(up))

    // 3. the diff
    await page.locator('[data-diff-count="added"]').waitFor({ timeout: 20000 })
    const header = page.locator('[data-edition-header]')
    check(`${dir} 3. header: the list, the id an ltr isolate, waiting`, strip(await header.locator('[data-edition-id]').innerText()) === `SFDA Human Drug List ${UPLOADED_EDITION_ID}` && (await header.locator('[data-edition-id] bdi[dir="ltr"]').innerText()) === UPLOADED_EDITION_ID && (await header.locator('[data-edition-state]').getAttribute('data-edition-state')) === 'pending')
    check(`${dir} 3. header: the file and who uploaded it, when (local)`, strip(await header.locator('[data-edition-file]').innerText()) === UPLOADED_FILE_NAME && strip(await header.locator('[data-edition-uploaded] bdi[dir="ltr"]').innerText()) === 'msartawi · 2026-10-27 10:30')
    const counts = await page.locator('[data-diff-count]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-diff-count')}=${e.querySelector('bdi[dir="ltr"]').textContent}`))
    check(`${dir} 3. added / dropped / changed / newly unmatched`, JSON.stringify(counts) === JSON.stringify(['added=31', 'dropped=4', 'changed=118', 'newlyUnmatched=2']), JSON.stringify(counts))
    check(`${dir} 3. against the live edition`, (await page.locator('[data-diff-against] bdi[dir="ltr"]').innerText()) === 'ED-SFDA-58')
    const un = page.locator('[data-unmatched-row="100234"]')
    // 618: as built a newly unmatched row is `{ item, sfdaCode }` — HQ sends no item name.
    check(`${dir} 3. an item newly unmatched: item and SFDA code ltr`, (await un.locator('[data-col="item"] bdi[dir="ltr"]').innerText()) === '100234' && (await un.locator('[data-col="sfdaCode"] bdi[dir="ltr"]').innerText()) === '2412246474')
    const rules = await page.locator('[data-rule-affected]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-rule-affected')}=${e.querySelector('[data-col="fires"] bdi').textContent}`))
    check(`${dir} 3. the rules affected with their back-test fires`, JSON.stringify(rules) === JSON.stringify(['G-008=41', 'G-009=7']), JSON.stringify(rules))
    check(`${dir} 3. a rule links to its page`, (await page.locator('[data-rule-affected="G-008"] a').getAttribute('href')) === '/insurance-rules/guards/G-008')

    // 4. the uploader cannot publish
    const publish = page.locator('[data-publish-submit]')
    check(`${dir} 4. Publish is disabled for the uploader, with its reason`, (await publish.getAttribute('aria-disabled')) === 'true' && (await page.locator('[data-publish-why="uploader"]').count()) === 1 && strip(await page.locator('[data-publish-why]').innerText()) === 'You uploaded this edition, so a second user publishes it.')
    await publish.click({ force: true })
    await page.waitForTimeout(400)
    check(`${dir} 4. clicking it asks nothing and writes nothing`, (await page.locator('dialog[open]').count()) === 0 && !writes.some((w) => w.path.endsWith('/Publish')), JSON.stringify(writes))

    // 5. gaps
    await page.locator('[data-gaps-table]').waitFor({ timeout: 20000 })
    const chips = await page.locator('[data-gap-kind]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-gap-kind') || 'all'}=${e.querySelector('[data-count]').textContent.replace(/[\u2066-\u2069]/g, '')}`))
    check(`${dir} 5. counts by kind`, JSON.stringify(chips) === JSON.stringify(['all=5', 'noMatch=1', 'junk=2', 'gtinMismatch=1', 'withdrawn=1']), JSON.stringify(chips))
    check(`${dir} 5. every gap row at first`, (await page.locator('[data-gap-row]').count()) === 5)
    await page.locator('[data-gap-kind="junk"]').click()
    const junk = await page.locator('[data-gap-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-gap-row')}:${e.getAttribute('data-item')}`))
    check(`${dir} 5. the junk filter keeps the junk codes`, JSON.stringify(junk) === JSON.stringify(['junk:100512', 'junk:100513']) && (await page.locator('[data-gap-kind="junk"]').getAttribute('aria-pressed')) === 'true', JSON.stringify(junk))
    check(`${dir} 5. a junk code is an ltr isolate as sent`, (await page.locator('[data-gap-row][data-item="100512"] [data-col="sfdaCode"] bdi[dir="ltr"]').innerText()) === 'OLD DELISTED SFDA')
    await page.locator('[data-gap-kind="gtinMismatch"]').click()
    const g = page.locator('[data-gap-row="gtinMismatch"]')
    // 618: HQ sends the mismatch as its own words in `detail` ("edition GTIN …; item barcodes …"), isolated as text.
    check(`${dir} 5. a GTIN mismatch shows both GTINs in HQ's words`, strip(await g.locator('[data-col="detail"] bdi').innerText()) === 'edition GTIN 06281234500024; item barcodes 06281234500017' && strip(await g.locator('td').first().innerText()) === 'GTIN mismatch', strip(await g.innerText()))
    await page.locator('[data-gap-kind=""]').click()
    check(`${dir} 5. All gaps clears the filter`, (await page.locator('[data-gap-row]').count()) === 5)
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator('[data-gaps-export]').click()])
    check(`${dir} 5. the export downloads the server's file`, download?.suggestedFilename() === `${UPLOADED_EDITION_ID}-gaps.xlsx` && reads.export === 1, download?.suggestedFilename())
    check(`${dir} 8. no raw keys on the edition`, await noRawKeys(page))
    check(`${dir} 8. no page errors (uploader)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: a second user publishes ────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, writes } = await open(dir, { user: 'falotaibi', editions: hq })
    await page.goto(`${BASE}/insurance-rules/editions/sfda/${UPLOADED_EDITION_ID}`)
    const publish = page.locator('[data-publish-submit]')
    await publish.waitFor({ timeout: 30000 })
    await page.waitForFunction(() => document.querySelector('[data-publish-submit]')?.getAttribute('aria-disabled') === 'false', null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 6. a second user may publish: enabled, no reason`, (await publish.getAttribute('aria-disabled')) === 'false' && (await page.locator('[data-publish-why]').count()) === 0)
    await publish.click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. it asks first, naming the edition and the list`, strip(await dialog.innerText()).includes(`Edition ${UPLOADED_EDITION_ID} becomes the live SFDA Human Drug List, and the live one becomes old.`), strip(await dialog.innerText().catch(() => '')))
    await dialog.getByRole('button', { name: 'Yes' }).click()
    await page.locator('[data-read-only]').waitFor({ timeout: 20000 }).catch(() => {})
    const pub = writes.filter((w) => w.path.endsWith('/Publish'))
    check(`${dir} 6. one POST …/Publish for the edition`, pub.length === 1 && pub[0].path === `InsuranceRules/Editions/${UPLOADED_EDITION_ID}/Publish`, JSON.stringify(writes))
    check(`${dir} 6. it is live now, read-only, published by the second user`, (await page.locator('[data-edition-header] [data-edition-state]').getAttribute('data-edition-state')) === 'live' && strip(await page.locator('[data-read-only]').innerText()) === 'This edition is live. A published edition is read-only.' && (await page.locator('[data-publish]').count()) === 0 && strip(await page.locator('[data-edition-published] bdi[dir="ltr"]').innerText()) === 'falotaibi · 2026-10-27 10:30')
    await page.locator('[data-back]').click()
    await page.locator('[data-history] tbody tr').first().waitFor({ timeout: 20000 })
    await page.waitForFunction(() => document.querySelectorAll('[data-history] tbody tr').length === 3, null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 6. the history: the new one live, the old live one old`, JSON.stringify(await historyIds(page)) === JSON.stringify([`${UPLOADED_EDITION_ID}:live`, 'ED-SFDA-58:retired', 'ED-SFDA-57:retired']), JSON.stringify(await historyIds(page)))
    check(`${dir} 8. no page errors (approver)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: a server refusal, an old edition, an unknown id, a bare 403 ────────────────────────────
  {
    const st = editionsState()
    editionsStub('POST', 'InsuranceRules/Editions', { editions: st, user: 'msartawi' })
    const refusal = { status: 409, message: 'Edition ED-SFDA-58 changed after this one was diffed. Upload again.', errorCode: 'STALE_LIVE' }
    const { context, page, errors } = await open(dir, { user: 'falotaibi', editions: st, refusePublish: refusal })
    await page.goto(`${BASE}/insurance-rules/editions/sfda/${UPLOADED_EDITION_ID}`)
    await page.waitForFunction(() => document.querySelector('[data-publish-submit]')?.getAttribute('aria-disabled') === 'false', null, { timeout: 30000 }).catch(() => {})
    await page.locator('[data-publish-submit]').click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Yes' }).click()
    await page.locator('[data-publish-refused]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 7. a refused publish shows the server's words; still waiting`, strip(await page.locator('[data-publish-refused]').innerText().catch(() => '')).includes(refusal.message) && (await page.locator('[data-edition-header] [data-edition-state]').getAttribute('data-edition-state')) === 'pending')
    await page.goto(`${BASE}/insurance-rules/editions/sfda/ED-SFDA-57`)
    await page.locator('[data-read-only]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. an old edition is read-only: no Publish`, strip(await page.locator('[data-read-only]').innerText()) === 'This is an old edition, kept read-only.' && (await page.locator('[data-publish]').count()) === 0)
    await page.locator('[data-gaps-empty]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 7. no gaps says so, and the export waits`, (await page.locator('[data-gaps-empty]').count()) === 1 && (await isDisabled(page.locator('[data-gaps-export]'))))
    await page.goto(`${BASE}/insurance-rules/editions/sfda/ED-NOPE`)
    await page.locator('[data-edition-not-found]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. an unknown id says so`, strip(await page.locator('[data-edition-not-found]').innerText()) === 'No edition has this id: ED-NOPE')
    check(`${dir} 8. no page errors (refusal)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page } = await open(dir, { deny: ['editions'] })
    await page.goto(`${BASE}/insurance-rules/editions`)
    await page.locator('[data-editions-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. a bare 403 → "You do not have access", never an empty history`, (await page.locator('[data-editions-denied]').count()) === 1 && strip(await page.locator('[data-editions-denied]').innerText()).startsWith('You do not have access') && (await page.locator('[data-history], [data-history-empty]').count()) === 0)
    await page.goto(`${BASE}/insurance-rules/editions/sfda/ED-SFDA-58`)
    await page.locator('[data-edition-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. a bare 403 on an edition → "You do not have access"`, (await page.locator('[data-edition-denied]').count()) === 1)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
