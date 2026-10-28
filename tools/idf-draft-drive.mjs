// Insurance rules ▸ IDF master ▸ Draft drive (BackOffice spec 3185 / door 3189; oms ticket 645).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. Fixtures and handlers are `tools/idf-stubs.mjs`
// (`// --- 619 ---`, `// --- 623 ---`, `// --- 643 ---`, `// --- 645 ---`, `idfStub`):
//   GET/POST/DELETE IdfPriority/masters/{id}/draft          → `state.drafts[id]`
//   POST/PUT/DELETE  …/draft/items[/{itemNumber}]            → re-checked against the upload rules
//   POST             …/draft/publish { note }                → one new live version
//   GET              …/versions/{vid}/entries                → the base version's rows for the diff (643's door)
//
// It verifies, in LTR and RTL:
//   1. no draft: the panel offers Start; the items are the live version's, unmarked;
//   2. Start copies the live items: the items show the draft (picker "Draft" first), every row marked Unchanged;
//   3. three edits — add, re-rank, remove — each mark their row; the removed row is listed struck through; the counts
//      follow, each figure ltr;
//   4. a refused add shows the rule's word and the server's message inline (no error toast) and leaves the draft as
//      it was; a refused re-rank shows its rule in the dialog;
//   5. the draft survives a reload (it is read from the server);
//   6. Publish wants a note; it makes exactly ONE new live version (header, versions list, items) and closes the draft;
//   7. a second run discards: Discard asks first, the draft closes and the live version is untouched;
//   8. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5213 --strictPort
//   2. node tools/idf-draft-drive.mjs        (DRIVE_PORT overrides 5213)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5213}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const state = newIdfState()
  const reads = {}
  const draftWrites = []
  const published = []
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
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = idfStub(req.method(), p + url.search, body, { state, reads, draftWrites, published })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, draftWrites, published, state }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|draft\.|items\.|upload\.|versions\.|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const row = (page, item) => page.locator(`[data-idf-items] tbody tr[data-item="${item}"]:not([data-removed])`)
const markOf = (page, item) => row(page, item).locator('[data-col="mark"] [data-mark]').getAttribute('data-mark')
const counts = async (page) => strip(await page.locator('[data-idf-draft-counts]').innerText())
const errorToasts = (page) => page.locator('[data-sonner-toast][data-type="error"]').count()
const panel = (page, view) => page.locator(`[data-idf-draft-panel="${view}"]`).waitFor({ timeout: 30000 })

async function filterGroup(page, idf) {
  await page.locator('[data-idf-items-filter] [data-filter="idf"]').fill(idf)
  await page.locator('[data-idf-items-filter] [data-filter="idf"]').press('Enter')
}

async function start(page) {
  await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
  await panel(page, 'none')
  await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
}

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, draftWrites, published, reads } = await open(dir)
    await start(page)
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. no draft: Start is offered`, (await page.locator('[data-idf-draft-start]').count()) === 1 && strip(await page.locator('[data-idf-draft-none]').innerText()).startsWith('No draft is open for this master.'))
    check(`${dir} 1. the items are the live version's, unmarked`, (await page.locator('[data-idf-items-section]').getAttribute('data-version-shown')) === 'V-11' && (await page.locator('[data-idf-items] [data-col="mark"]').count()) === 0)

    // 2. start
    await page.locator('[data-idf-draft-start]').click()
    await panel(page, 'open')
    await page.locator('[data-idf-items-section][data-version-shown="draft"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-items] [data-col="mark"] [data-mark]').first().waitFor({ timeout: 30000 })
    check(`${dir} 2. Start posts the draft door once`, JSON.stringify(draftWrites.map((w) => `${w.method} ${w.door}`)) === '["POST draft"]', JSON.stringify(draftWrites))
    check(`${dir} 2. the picker names the draft first and shows it`, (await page.locator('[data-idf-items-version]').inputValue()) === '' && strip(await page.locator('[data-idf-items-version] option').first().innerText()) === 'Draft (not published)')
    check(`${dir} 2. the draft holds the live items, all unchanged`, strip(await page.locator('[data-idf-items-total]').innerText()) === 'Items: 60' && (await markOf(page, '100110')) === 'unchanged' && (await counts(page)) === 'Added 0, re-ranked 0, moved 0, removed 0')
    check(`${dir} 2. the base version is read whole for the diff`, (reads.entries ?? []).some((r) => r.versionId === 'V-11' && /pageSize=500/.test(r.qs)), JSON.stringify(reads.entries))
    check(`${dir} 2. the draft's start is shown by whom and when, ltr`, strip(await page.locator('[data-idf-draft] [data-col="started"]').innerText()).startsWith('msartawi') && (await ltr(page.locator('[data-idf-draft] [data-col="started"]'))).length === 1)

    // 3. three edits, in group IDF-PARA-500 (one page)
    await filterGroup(page, 'IDF-PARA-500')
    await page.waitForURL((u) => u.search === '?idf=IDF-PARA-500', { timeout: 30000 })
    const add = page.locator('[data-idf-draft-add]')
    await add.locator('[data-field="itemNumber"]').fill('100999')
    await add.locator('[data-field="idfNumber"]').fill('IDF-PARA-500')
    await add.locator('[data-field="priority"]').fill('11')
    await add.locator('[data-idf-draft-add-submit]').click()
    await row(page, '100999').waitFor({ timeout: 30000 })
    check(`${dir} 3. an added item is marked Added`, (await markOf(page, '100999')) === 'added' && strip(await row(page, '100999').locator('[data-col="mark"]').innerText()) === 'Added')
    check(`${dir} 3. the add form clears`, (await add.locator('[data-field="itemNumber"]').inputValue()) === '')

    await page.locator('[data-idf-draft-rerank="100110"]').click()
    const rr = page.locator('[data-idf-draft-rerank-dialog="100110"]')
    await rr.waitFor({ timeout: 30000 })
    check(`${dir} 3. the re-rank dialog names the item`, strip(await page.locator('dialog[open] h2, dialog[open] [id]').first().innerText()).includes('100110'))
    await rr.locator('[data-field="priority"]').fill('2.5')
    await page.locator('[data-idf-draft-rerank-confirm]').click()
    await rr.locator('[data-idf-draft-refused="badPriority"]').waitFor({ timeout: 30000 })
    check(`${dir} 4. a refused re-rank shows its rule in the dialog`, strip(await rr.locator('[data-idf-draft-refused] [data-col="rule"]').innerText()) === 'Priority not a whole number of 1 or more' && (await errorToasts(page)) === 0)
    await rr.locator('[data-field="priority"]').fill('5')
    await page.locator('[data-idf-draft-rerank-confirm]').click()
    await rr.waitFor({ state: 'detached', timeout: 30000 })
    await page.locator('[data-idf-items] tbody tr[data-item="100110"][data-priority="5"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. a re-ranked row is marked Re-ranked with its new priority`, (await markOf(page, '100110')) === 'reRanked')

    await page.locator('[data-idf-draft-remove="100100"]').click()
    await page.locator('[data-idf-draft-remove-dialog="100100"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-draft-remove-confirm]').click()
    const removed = page.locator('[data-idf-items] tbody tr[data-item="100100"][data-removed]')
    await removed.waitFor({ timeout: 30000 })
    check(`${dir} 3. a removed row is listed, struck through, marked Removed`, (await row(page, '100100').count()) === 0 && strip(await removed.locator('[data-col="mark"]').innerText()) === 'Removed' && /line-through/.test((await removed.getAttribute('class')) ?? ''))
    check(`${dir} 3. the counts follow, each figure ltr`, (await counts(page)) === 'Added 1, re-ranked 1, moved 0, removed 1' && JSON.stringify(await ltr(page.locator('[data-idf-draft-counts]'))) === '["1","1","0","1"]', await counts(page))

    // 4. a refused add
    const before = JSON.stringify(await page.locator('[data-idf-items] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-item')}:${e.getAttribute('data-priority')}`)))
    await add.locator('[data-field="itemNumber"]').fill('100302')
    await add.locator('[data-field="idfNumber"]').fill('IDF-PARA-500')
    await add.locator('[data-field="priority"]').fill('3')
    await add.locator('[data-idf-draft-add-submit]').click()
    const refused = add.locator('[data-idf-draft-refused="itemNotInGroup"]')
    await refused.waitFor({ timeout: 30000 })
    check(`${dir} 4. a refused add shows the rule's word and the message inline`, strip(await refused.locator('[data-col="rule"]').innerText()) === 'Item not in the IDF group the line names' && strip(await refused.locator('[data-col="message"] bdi').innerText()) === 'Item 100302 is not in IDF group IDF-PARA-500.')
    check(`${dir} 4. a refusal is not an error toast`, (await errorToasts(page)) === 0)
    await page.waitForTimeout(300)
    const after = JSON.stringify(await page.locator('[data-idf-items] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-item')}:${e.getAttribute('data-priority')}`)))
    check(`${dir} 4. the draft is as it was`, before === after && (await counts(page)) === 'Added 1, re-ranked 1, moved 0, removed 1' && (await add.locator('[data-field="itemNumber"]').inputValue()) === '100302')

    // 5. reload
    await page.reload()
    await panel(page, 'open')
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 1' }).waitFor({ timeout: 30000 })
    check(`${dir} 5. the draft survives a reload`, (await counts(page)) === 'Added 1, re-ranked 1, moved 0, removed 1' && (await markOf(page, '100999')) === 'added')

    // 6. publish
    check(`${dir} 6. Publish is off without a note`, await page.locator('[data-idf-draft-publish]').isDisabled())
    await page.locator('[data-idf-draft-note]').fill('Three edits')
    await page.locator('[data-idf-draft-publish]').click()
    await panel(page, 'none')
    await page.locator('[data-idf-master] [data-live-number]').filter({ hasText: '4' }).waitFor({ timeout: 30000 })
    check(`${dir} 6. publish sends the note once and makes one version`, published.length === 1 && published[0].note === 'Three edits' && draftWrites.filter((w) => w.door === 'publish').length === 1)
    await page.locator('[data-idf-versions-rows] tbody tr').nth(3).waitFor({ timeout: 30000 })
    check(`${dir} 6. the versions list shows exactly one new version, live`, (await page.locator('[data-idf-versions-rows] tbody tr').count()) === 4 && (await page.locator('[data-idf-versions-rows] tbody tr[data-live="true"]').getAttribute('data-number')) === '4')
    await page.locator('[data-idf-items-section][data-version-shown="V-M-BUPA-4"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 30000 })
    check(`${dir} 6. the items show the new live version, unmarked, with the edits`, (await page.locator('[data-idf-items] [data-col="mark"]').count()) === 0 && (await row(page, '100999').count()) === 1 && (await row(page, '100100').count()) === 0 && (await page.locator('[data-idf-items] tbody tr[data-item="100110"][data-priority="5"]').count()) === 1)
    check(`${dir} 8. no raw keys`, await noRawKeys(page))
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, draftWrites, published } = await open(dir)
    await start(page)
    await page.locator('[data-idf-draft-start]').click()
    await panel(page, 'open')
    await page.locator('[data-idf-draft-remove="100100"]').click()
    await page.locator('[data-idf-draft-remove-confirm]').click()
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'removed 1' }).waitFor({ timeout: 30000 })
    await page.locator('[data-idf-draft-discard]').click()
    await page.locator('[data-idf-draft-discard-dialog]').waitFor({ timeout: 30000 })
    check(`${dir} 7. Discard asks first and changes nothing yet`, !draftWrites.some((w) => w.method === 'DELETE' && w.door === 'draft'))
    await page.locator('[data-idf-draft-discard-confirm]').click()
    await panel(page, 'none')
    await page.locator('[data-idf-items-section][data-version-shown="V-11"]').waitFor({ timeout: 30000 })
    check(`${dir} 7. confirming discards the draft; nothing is published`, draftWrites.filter((w) => w.method === 'DELETE' && w.door === 'draft').length === 1 && published.length === 0)
    check(`${dir} 7. the live version is untouched`, strip(await page.locator('[data-idf-master] [data-live-number]').innerText()) === '3' && (await row(page, '100100').count()) === 1 && (await page.locator('[data-idf-items] [data-col="mark"]').count()) === 0)
    check(`${dir} 8. no raw keys (discard)`, await noRawKeys(page))
    check(`${dir} 8. no page errors (discard)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
