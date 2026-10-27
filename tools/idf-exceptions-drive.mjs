// Insurance rules ▸ IDF exceptions drive (BackOffice spec 3157 / door 3166; oms ticket 624).
//
// Drives the REAL app in Chromium against a STUB of the exceptions door (and 619's masters door for the picker),
// on the REAL envelope. Fixtures and the handler are `tools/idf-stubs.mjs` (`// --- 624 ---`, `idfStub`):
//   GET    IdfPriority/exceptions         → `IDF_EXCEPTIONS` (the spec's seed shapes)
//   POST   IdfPriority/exceptions         { keyKind, key, handling, masterId, reason }
//   PUT    IdfPriority/exceptions/{id}    { keyKind, key, handling, masterId, reason }
//   DELETE IdfPriority/exceptions/{id}?reason=
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3166 is unbuilt. Ticket 628 swaps in the doors.
//
// It verifies, in LTR and RTL:
//   1. the IDF exceptions leaf is in the rail and lit; the rows as sent (key kind, key ltr, handling, master named);
//   2. add: a blank key and reason are refused in the dialog (nothing sent); a reminder row is added with its reason;
//   3. edit: switching it to "master" asks for a master and a NEW reason; then it saves with the picked master;
//   4. delete: a blank reason is refused; with a reason the row goes, the reason on the DELETE;
//   5. no raw keys, no page errors; a bare 403 is "You do not have access".
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. node tools/idf-exceptions-drive.mjs        (DRIVE_PORT overrides 5204)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const writes = []
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
    let body = null
    try {
      body = req.postDataJSON?.() ?? null
    } catch {
      body = null
    }
    const hit = idfStub(req.method(), p + url.search, body, { state, deny, reads, writes })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, writes, state }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|exceptions\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const rowIds = (page) => page.locator('[data-idf-exceptions] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-exception')}:${e.getAttribute('data-handling')}`))
const cell = async (row, col) => strip(await row.locator(`[data-col="${col}"]`).innerText())

// The RTL pass reads English words in a mirrored page (619's house pattern: `lng` stays `en`).
for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads, writes } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/exceptions`)
    await page.locator('[data-idf-exceptions] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator('a[href="/insurance-rules/idf/exceptions"]')
    check(`${dir} 1. the rail has the IDF exceptions leaf, lit`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'IDF exceptions')
    check(`${dir} 1. the rows as sent`, JSON.stringify(await rowIds(page)) === JSON.stringify(['X-1:skip', 'X-2:skip', 'X-3:skip', 'X-4:master']), JSON.stringify(await rowIds(page)))
    const x1 = page.locator('[data-exception="X-1"]')
    check(`${dir} 1. key kind word, key ltr, handling word`, (await cell(x1, 'keyKind')) === 'Document type' && (await x1.locator('[data-col="key"] bdi[dir="ltr"]').innerText()) === 'SABIC' && (await cell(x1, 'handling')) === 'Skip')
    check(`${dir} 1. reason in a bdi, by · at ltr`, strip(await x1.locator('[data-col="reason"] bdi').innerText()) === 'SABIC contract orders' && strip(await x1.locator('[data-col="changed"] bdi[dir="ltr"]').innerText()) === 'nalharbi · 2026-10-10 08:30', strip(await x1.locator('[data-col="changed"]').innerText()))
    const x4 = page.locator('[data-exception="X-4"]')
    check(`${dir} 1. master handling names the master from 619's list`, (await cell(x4, 'keyKind')) === 'Nphies claim type' && strip(await x4.locator('[data-master-name] bdi').innerText()) === 'Operation pharmacies')

    // 2. add a reminder row
    await page.locator('[data-idf-exception-add]').click()
    const dlg = page.locator('[data-idf-exception-dialog="new"]')
    await dlg.waitFor()
    await page.locator('[data-exception-save]').click()
    const probs = await dlg.locator('[data-problem]').evaluateAll((els) => els.map((e) => e.getAttribute('data-problem')).sort())
    check(`${dir} 2. a blank key and reason are refused, nothing sent`, JSON.stringify(probs) === JSON.stringify(['keyRequired', 'reasonRequired']) && writes.length === 0, JSON.stringify(probs))
    await dlg.locator('[data-field="keyKind"]').selectOption('subDocumentType')
    await dlg.locator('[data-field="key"]').fill('ZC-PILOT')
    await dlg.locator('[data-handling-option="reminder"]').check()
    check(`${dir} 2. no master picker for a reminder`, (await dlg.locator('[data-field="masterId"]').count()) === 0)
    await dlg.locator('[data-field="reason"]').fill('Pilot sub-document type')
    await page.locator('[data-exception-save]').click()
    await dlg.waitFor({ state: 'detached' })
    const added = writes[0]
    check(`${dir} 2. POST carries the row and its reason, no master`, added?.method === 'POST' && JSON.stringify(added.body) === JSON.stringify({ keyKind: 'subDocumentType', key: 'ZC-PILOT', handling: 'reminder', masterId: null, reason: 'Pilot sub-document type' }), JSON.stringify(added))
    await page.locator('[data-exception="X-104"]').waitFor()
    check(`${dir} 2. the list re-reads and shows the reminder row`, (await cell(page.locator('[data-exception="X-104"]'), 'handling')) === 'Reminder' && reads.exceptions === 2, JSON.stringify(reads))

    // 3. switch it to a master
    const added104 = page.locator('[data-exception="X-104"]')
    await added104.locator('[data-exception-edit]').click()
    const ed = page.locator('[data-idf-exception-dialog="X-104"]')
    await ed.waitFor()
    check(`${dir} 3. edit starts from the row with a blank reason`, (await ed.locator('[data-field="key"]').inputValue()) === 'ZC-PILOT' && (await ed.locator('[data-handling-option="reminder"]').isChecked()) && (await ed.locator('[data-field="reason"]').inputValue()) === '')
    await ed.locator('[data-handling-option="master"]').check()
    const opts = await ed.locator('[data-field="masterId"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 3. the master picker lists 619's masters`, JSON.stringify(opts) === JSON.stringify(['', 'M-BUPA', 'M-TAW-PILOT', 'M-OPS']), JSON.stringify(opts))
    await page.locator('[data-exception-save]').click()
    const probs2 = await ed.locator('[data-problem]').evaluateAll((els) => els.map((e) => e.getAttribute('data-problem')).sort())
    check(`${dir} 3. master handling asks for a master and a new reason`, JSON.stringify(probs2) === JSON.stringify(['masterRequired', 'reasonRequired']) && writes.length === 1, JSON.stringify(probs2))
    await ed.locator('[data-field="masterId"]').selectOption('M-BUPA')
    await ed.locator('[data-field="reason"]').fill('Use Bupa priorities')
    await page.locator('[data-exception-save]').click()
    await ed.waitFor({ state: 'detached' })
    const put = writes[1]
    check(`${dir} 3. PUT carries the master and the new reason`, put?.method === 'PUT' && put.path === 'IdfPriority/exceptions/X-104' && JSON.stringify(put.body) === JSON.stringify({ keyKind: 'subDocumentType', key: 'ZC-PILOT', handling: 'master', masterId: 'M-BUPA', reason: 'Use Bupa priorities' }), JSON.stringify(put))
    await page.locator('[data-exception="X-104"][data-handling="master"]').waitFor()
    check(`${dir} 3. the row now names its master`, strip(await added104.locator('[data-master-name] bdi').innerText()) === 'Bupa general' && strip(await added104.locator('[data-col="reason"] bdi').innerText()) === 'Use Bupa priorities')

    // 4. delete with a reason
    await added104.locator('[data-exception-delete]').click()
    const del = page.locator('[data-idf-exception-delete-dialog="X-104"]')
    await del.waitFor()
    await page.locator('[data-exception-delete-confirm]').click()
    check(`${dir} 4. a blank reason is refused, nothing sent`, (await del.locator('[data-problem="reasonRequired"]').count()) === 1 && writes.length === 2)
    await del.locator('[data-field="reason"]').fill('Pilot over')
    await page.locator('[data-exception-delete-confirm]').click()
    await del.waitFor({ state: 'detached' })
    const d = writes[2]
    check(`${dir} 4. DELETE carries the reason`, d?.method === 'DELETE' && d.path === 'IdfPriority/exceptions/X-104' && d.reason === 'Pilot over', JSON.stringify(d))
    await page.locator('[data-exception="X-104"]').waitFor({ state: 'detached' })
    check(`${dir} 4. the row is gone, the seed stays`, JSON.stringify(await rowIds(page)) === JSON.stringify(['X-1:skip', 'X-2:skip', 'X-3:skip', 'X-4:master']))

    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['exceptions'] })
    await page.goto(`${BASE}/insurance-rules/idf/exceptions`)
    await page.locator('[data-idf-exceptions-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. a bare 403 → "You do not have access", no add, no list`, (await page.locator('[data-idf-exceptions-denied]').count()) === 1 && strip(await page.locator('[data-idf-exceptions-denied]').innerText()).startsWith('You do not have access') && (await page.locator('[data-idf-exceptions], [data-idf-exception-add]').count()) === 0)
    check(`${dir} 5. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
