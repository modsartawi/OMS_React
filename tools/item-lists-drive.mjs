// Item lists drive (oms 925, BackOffice spec 4057) — drives the REAL upload page and list page in Chromium against
// STUBBED `Analytics/ItemLists*` envelopes, shaped from the guesses in `src/features/analytics/item-lists/api.ts`.
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 4058 was not built; the walk on its local endpoints
// is what closes the live half.
//
// It verifies, in English (LTR) and Arabic (RTL):
//   1. the template downloads; a file that is not .xlsx/.csv is refused before it is sent;
//   2. the preview names each problem kind with its row numbers, and shows the matched rows;
//   3. Save is held without a name or audience, and enabled once named;
//   4. an expired token (Save's refusal) asks for the file again; after a fresh preview Save posts the token, name,
//      audience and folder and lands on the list page;
//   5. the list page shows members, periods with status chips and notes, unknown values, versions; Export downloads;
//   6. the re-upload goes through the same preview and PUTs the new token;
//   7. a preview where nothing matched holds Save; a preview whose clock runs out asks for the file again;
//   8. without the author grant there is no upload or re-upload, but the list page and Export still work;
//   9. the layout mirrors under Arabic (screenshots in tools/.item-lists-shots);
//  10. (review) a refused file after a preview clears the preview and Save; a server clock hours away from this
//      machine's keeps the 30-minute window; a save answering no list id lands on the library's item lists.
//
//   1. run the app:  npx vite --port 5231 --strictPort
//   2. DRIVE_PORT=5231 node tools/item-lists-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { envelope, refusal } from './analytics-stubs.mjs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.item-lists-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const READER = ['Analytics:03']
const AUTHOR = ['Analytics:03', 'Analytics:02']
const ARABIC_NOTE = 'سحب من المورد'

const inMinutes = (m) => new Date(Date.now() + m * 60_000).toISOString()
const PREVIEW = (over = {}) => ({
  token: 'tok-1',
  issuedAt: inMinutes(0),
  expiresAt: inMinutes(30),
  fileName: 'shortage-q3.xlsx',
  rows: 9,
  matched: [
    { row: 2, level: 'item', key: '100234', label: 'Panadol 500mg 24', from: '2026-09-03', to: null, status: 'unavailable', note: ARABIC_NOTE },
    { row: 4, level: 'brand', key: 'Brufen', label: 'Brufen', from: '2026-08-01', to: '2026-09-15', status: 'blocked', note: '' },
    { row: 5, level: 'item', key: '100777', label: 'Augmentin 1g', from: null, to: null, status: null, note: '' },
  ],
  unknown: [
    { row: 7, level: 'brand', value: 'Panadool' },
    { row: 3, level: 'item', value: '0099999' },
  ],
  duplicates: [{ rows: [8, 6], level: 'category', key: 'Analgesics' }],
  badDates: [{ row: 9, value: '31/02/2026' }],
  overlaps: [{ rows: [10, 2], level: 'item', key: '100234' }],
  refused: [{ row: 11, level: 'item', key: '100235', reason: 'The note holds a phone number.' }],
  ...over,
})

const LIST = {
  id: 'il-1',
  kind: 'itemlist',
  title: 'Shortage Q3',
  owner: 'msartawi',
  tier: 'shared',
  revision: 2,
  updatedAt: '2026-11-19T09:00:00',
  updatedBy: 'msartawi',
  audience: { everyone: true },
  folderId: null,
  definition: {
    version: 1,
    members: [
      { level: 'item', key: '100234', label: 'Panadol 500mg 24' },
      { level: 'brand', key: 'Brufen', label: 'Brufen' },
      { level: 'item', key: '100777', label: 'Augmentin 1g' },
    ],
    periods: [
      { level: 'item', member: '100234', from: '2026-09-03', status: 'unavailable', note: ARABIC_NOTE },
      { level: 'brand', member: 'Brufen', from: '2026-08-01', to: '2026-09-15', status: 'blocked', note: '' },
      { level: 'brand', member: 'Brufen', from: '2026-09-16', status: 'available', note: 'Back on shelves' },
    ],
    unknown: [
      { row: 3, level: 'item', value: '0099999' },
      { row: 7, level: 'brand', value: 'Panadool' },
    ],
    upload: { fileName: 'shortage-q3.xlsx', rows: 9, matched: 3, by: 'msartawi', at: '2026-11-19T09:00:00' },
  },
}
const VERSIONS = [
  { revision: 1, savedBy: 'msartawi', savedAt: '2026-11-18T10:00:00' },
  { revision: 2, savedBy: 'msartawi', savedAt: '2026-11-19T09:00:00' },
  { revision: 2, event: 'audience', savedBy: 'msartawi', savedAt: '2026-11-19T09:05:00' },
]
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const workbook = (name) => ({ status: 200, contentType: XLSX, headers: { 'content-disposition': `attachment; filename="${name}"` }, body: Buffer.from('PK-stub') })
const FILE = { name: 'shortage-q3.xlsx', mimeType: XLSX, buffer: Buffer.from('PK-stub-file') }

const browser = await chromium.launch()

async function open(dir, grants, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  let saveRefusals = opts.expireFirstSave ? 1 : 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    calls.push({ method: req.method(), p, body: req.postData() ?? '' })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: opts.userId ?? 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(grants))
    if (p === 'Analytics/ItemLists/Template') return route.fulfill(workbook('item-list-template.xlsx'))
    if (p === 'Analytics/ItemLists/Preview') return route.fulfill(envelope(opts.preview ? opts.preview() : PREVIEW()))
    if (p === 'Analytics/ItemLists' && req.method() === 'POST') {
      if (saveRefusals-- > 0) return route.fulfill(refusal('ANALYTICS-433', 'The preview expired. Upload the file again.', 410))
      return route.fulfill(envelope(opts.created ?? LIST))
    }
    if (p === 'Analytics/ItemLists/il-1/Export') return route.fulfill(workbook('Shortage Q3.xlsx'))
    if (p === 'Analytics/ItemLists/il-1') return route.fulfill(envelope(req.method() === 'PUT' ? { ...LIST, revision: 3 } : LIST))
    if (p === 'Analytics/Item/il-1/Revisions') return route.fulfill(envelope(VERSIONS))
    if (p === 'Analytics/Folders') return route.fulfill(envelope([{ id: 'f-2', name: 'مجلد النقص', order: 2, itemCount: 0 }, { id: 'f-1', name: 'Shortages', order: 1, itemCount: 3 }]))
    if (p === 'Analytics/AudienceCandidates') return route.fulfill(envelope([{ kind: 'role', name: 'CATEGORY_MGR', label: 'Category managers', removed: false }]))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const attr = (loc, name) => loc.getAttribute(name)

async function authorWalk(dir) {
  const L = dir.toUpperCase()
  const { context, page, errors, calls } = await open(dir, AUTHOR, { expireFirstSave: true })
  await page.goto(`${BASE}/analytics/itemlist/new`)
  await page.locator('[data-item-list-upload="create"]').waitFor()
  check(`${L}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

  // 1. template, and a wrong file refused before it is sent
  const download = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.locator('[data-item-list-template]').click()
  const d = await download
  check(`${L}: the template downloads under its name`, d?.suggestedFilename() === 'item-list-template.xlsx', d?.suggestedFilename())
  await page.locator('[data-item-list-file]').setInputFiles({ name: 'items.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await page.locator('[data-item-list-file-problem="type"]').waitFor()
  check(`${L}: a .txt is refused before it is sent`, !calls.some((c) => c.p === 'Analytics/ItemLists/Preview'))

  // 2. the preview
  await page.locator('[data-item-list-file]').setInputFiles(FILE)
  await page.locator('[data-item-list-preview]').waitFor()
  const sent = calls.find((c) => c.p === 'Analytics/ItemLists/Preview')
  check(`${L}: the file is posted as multipart`, !!sent && sent.method === 'POST' && sent.body.includes('filename="shortage-q3.xlsx"'))
  const kinds = await page.locator('[data-item-list-problem-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-item-list-problem-kind')))
  check(`${L}: every problem kind, in order`, kinds.join() === 'unknown,duplicate,badDate,overlap,refused', kinds.join())
  const rowsOf = async (kind) => page.locator(`[data-item-list-problem="${kind}"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-rows')))
  check(`${L}: unknown values by row, ascending`, (await rowsOf('unknown')).join('|') === '3|7')
  check(`${L}: a duplicate names both rows`, (await rowsOf('duplicate')).join('|') === '6 8')
  check(`${L}: a bad date names its row`, (await rowsOf('badDate')).join('|') === '9')
  check(`${L}: an overlap names both rows`, (await rowsOf('overlap')).join('|') === '2 10')
  check(`${L}: a refused row carries the server's reason`, (await page.locator('[data-item-list-problem="refused"]').innerText()).includes('phone number'))
  check(`${L}: the matched rows are in the grid`, (await page.locator('[data-item-list-grid="matched"] [role="gridcell"][col-id="key"]').count()) === 3)
  check(`${L}: an Arabic note reads exactly`, (await page.locator('[data-item-list-grid="matched"]').innerText()).includes(ARABIC_NOTE))
  check(`${L}: matched count`, (await page.locator('[data-item-list-count="matched"]').innerText()).includes('3'))

  // 3. Save's holds
  const save = page.locator('[data-item-list-save]')
  check(`${L}: Save held without a name`, (await save.isDisabled()) && (await attr(page.locator('[data-item-list-save-hold]'), 'data-item-list-save-hold')) === 'noName')
  await page.locator('[data-item-list-name]').fill('Shortage Q3')
  await page.locator('[data-analytics-share-chosen]').click()
  check(`${L}: Save held on an empty chosen audience`, (await save.isDisabled()) && (await attr(page.locator('[data-item-list-save-hold]'), 'data-item-list-save-hold')) === 'noAudience')
  await page.locator('[data-analytics-share-everyone]').click()
  check(`${L}: Save enabled once named and shared`, await save.isEnabled())
  const folders = await page.locator('[data-item-list-folder] option').allInnerTexts()
  check(`${L}: the folder picker lists my folders by order, after No folder`, folders.length === 3 && folders[1].includes('Shortages'), folders.join('|'))
  await page.locator('[data-item-list-folder]').selectOption('f-1')
  await page.screenshot({ path: `${SHOTS}/${dir}-preview.png`, fullPage: true })

  // 4. expired token on Save → file again; then a fresh preview saves
  await save.click()
  await page.locator('[data-item-list-expired]').waitFor()
  check(`${L}: an expired token asks for the file again`, (await page.locator('[data-item-list-preview]').count()) === 0)
  await page.locator('[data-item-list-file]').setInputFiles(FILE)
  await page.locator('[data-item-list-preview]').waitFor()
  check(`${L}: a fresh preview clears the expired note`, (await page.locator('[data-item-list-expired]').count()) === 0)
  check(`${L}: the name and audience are kept across the new preview`, (await page.locator('[data-item-list-name]').inputValue()) === 'Shortage Q3')
  await page.locator('[data-item-list-save]').click()
  await page.waitForURL(/\/analytics\/itemlist\/il-1$/)
  const posts = calls.filter((c) => c.p === 'Analytics/ItemLists' && c.method === 'POST')
  const body = JSON.parse(posts[posts.length - 1].body)
  check(`${L}: Save posts the token, name, audience and folder`, body.token === 'tok-1' && body.name === 'Shortage Q3' && body.audience?.everyone === true && body.folderId === 'f-1', JSON.stringify(body))

  // 5. the list page
  await page.locator('[data-item-list="il-1"]').waitFor()
  check(`${L}: the list's name`, (await page.locator('[data-item-list-name]').innerText()).trim() === 'Shortage Q3')
  check(`${L}: members with their level`, (await page.locator('[data-item-list-grid="members"] [role="gridcell"][col-id="key"]').count()) === 3)
  const periods = page.locator('[data-item-list-grid="periods"]')
  check(`${L}: periods with status chips`, (await periods.locator('[data-item-list-status]').evaluateAll((e) => e.map((x) => x.getAttribute('data-item-list-status')))).sort().join() === 'available,blocked,unavailable')
  // The app's language is English under either direction today (core/i18n `lng: 'en'`): Arabic is a direction switch.
  check(`${L}: an open period reads still`, (await periods.innerText()).includes('still'))
  check(`${L}: the period notes`, (await periods.innerText()).includes(ARABIC_NOTE))
  check(`${L}: unknown values by row`, (await page.locator('[data-item-list-unknown]').count()) === 2)
  check(`${L}: versions newest first, events left out`, (await page.locator('[data-item-list-version]').evaluateAll((e) => e.map((x) => x.getAttribute('data-item-list-version')))).join() === '2,1')
  const exported = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.locator('[data-item-list-export]').click()
  check(`${L}: Export downloads the list`, (await exported)?.suggestedFilename() === 'Shortage Q3.xlsx')
  // 9. the mirror: the name stands at the start, the actions at the end
  const nameBox = await page.locator('[data-item-list-name]').boundingBox()
  const exportBox = await page.locator('[data-item-list-export]').boundingBox()
  check(`${L}: header mirrors (name at the start, actions at the end)`, dir === 'rtl' ? nameBox.x > exportBox.x : nameBox.x < exportBox.x)
  await page.screenshot({ path: `${SHOTS}/${dir}-list.png`, fullPage: true })

  // 6. the re-upload
  await page.locator('[data-item-list-reupload]').click()
  await page.locator('[data-item-list-upload="replace"]').waitFor()
  check(`${L}: the re-upload asks for no name or audience`, (await page.locator('[data-item-list-name]').count()) === 0)
  await page.locator('[data-item-list-file]').setInputFiles(FILE)
  await page.locator('[data-item-list-preview]').waitFor()
  await page.locator('[data-item-list-save]').click()
  await page.waitForURL(/\/analytics\/itemlist\/il-1$/)
  const put = calls.find((c) => c.p === 'Analytics/ItemLists/il-1' && c.method === 'PUT')
  check(`${L}: the re-upload PUTs the new token`, !!put && JSON.parse(put.body).token === 'tok-1', put?.body)

  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function edgeWalk(dir) {
  const L = dir.toUpperCase()
  // 7a. nothing matched
  {
    const { context, page, errors } = await open(dir, AUTHOR, { preview: () => PREVIEW({ matched: [] }) })
    await page.goto(`${BASE}/analytics/itemlist/new`)
    await page.locator('[data-item-list-file]').setInputFiles(FILE)
    await page.locator('[data-item-list-preview]').waitFor()
    await page.locator('[data-item-list-name]').fill('Nothing')
    check(`${L}: nothing matched holds Save`, (await page.locator('[data-item-list-save]').isDisabled()) && (await attr(page.locator('[data-item-list-save-hold]'), 'data-item-list-save-hold')) === 'nothingMatched')
    check(`${L}: …and says why`, (await page.locator('[data-item-list-none-matched]').count()) === 1)
    check(`${L}: (nothing matched) no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 7b. the preview's own clock runs out
  {
    const { context, page, errors } = await open(dir, AUTHOR, { preview: () => PREVIEW({ issuedAt: inMinutes(0), expiresAt: new Date(Date.now() + 1500).toISOString() }) })
    await page.goto(`${BASE}/analytics/itemlist/new`)
    await page.locator('[data-item-list-file]').setInputFiles(FILE)
    await page.locator('[data-item-list-preview]').waitFor()
    await page.locator('[data-item-list-expired]').waitFor({ timeout: 6000 })
    check(`${L}: a lapsed preview asks for the file again by itself`, (await page.locator('[data-item-list-preview]').count()) === 0)
    await page.screenshot({ path: `${SHOTS}/${dir}-expired.png`, fullPage: true })
    check(`${L}: (clock) no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 10a. a refused file after a preview drops the preview and Save
  {
    const { context, page, errors } = await open(dir, AUTHOR)
    await page.goto(`${BASE}/analytics/itemlist/new`)
    await page.locator('[data-item-list-file]').setInputFiles(FILE)
    await page.locator('[data-item-list-preview]').waitFor()
    await page.locator('[data-item-list-file]').setInputFiles({ name: 'big.xlsx', mimeType: XLSX, buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
    await page.locator('[data-item-list-file-problem="size"]').waitFor()
    check(`${L}: a refused file clears the last preview`, (await page.locator('[data-item-list-preview]').count()) === 0)
    check(`${L}: …and its Save`, (await page.locator('[data-item-list-save]').count()) === 0)
    check(`${L}: (refused file) no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 10b. the server's clock three hours behind this machine's: the window is its 30 minutes from receipt
  {
    const { context, page, errors } = await open(dir, AUTHOR, { preview: () => PREVIEW({ issuedAt: inMinutes(-180), expiresAt: inMinutes(-150) }) })
    await page.goto(`${BASE}/analytics/itemlist/new`)
    await page.locator('[data-item-list-file]').setInputFiles(FILE)
    await page.locator('[data-item-list-preview]').waitFor()
    await page.locator('[data-item-list-name]').fill('Skewed')
    await page.waitForTimeout(1000)
    check(`${L}: a skewed server clock does not lapse the preview`, (await page.locator('[data-item-list-expired]').count()) === 0 && (await page.locator('[data-item-list-save]').isEnabled()))
    check(`${L}: (skew) no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 10c. a save that answers no readable id lands on the library's item lists
  {
    const { context, page, errors } = await open(dir, AUTHOR, { created: { ...LIST, id: '' } })
    await page.goto(`${BASE}/analytics/itemlist/new`)
    await page.locator('[data-item-list-file]').setInputFiles(FILE)
    await page.locator('[data-item-list-preview]').waitFor()
    await page.locator('[data-item-list-name]').fill('No id')
    await page.locator('[data-item-list-save]').click()
    await page.waitForURL(/\/analytics\/library\?kind=itemlist$/, { timeout: 10000 }).catch(() => null)
    check(`${L}: a save naming no list lands on the library's item lists`, /\/analytics\/library\?kind=itemlist$/.test(page.url()), page.url())
    check(`${L}: (no id) no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

async function readerWalk(dir) {
  const L = dir.toUpperCase()
  const { context, page, errors, calls } = await open(dir, READER)
  await page.goto(`${BASE}/analytics/itemlist/il-1`)
  await page.locator('[data-item-list="il-1"]').waitFor()
  check(`${L} reader: the list page opens`, (await page.locator('[data-item-list-grid="members"]').count()) === 1)
  check(`${L} reader: Export is offered`, (await page.locator('[data-item-list-export]').count()) === 1)
  check(`${L} reader: no re-upload`, (await page.locator('[data-item-list-reupload]').count()) === 0)
  const exported = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.locator('[data-item-list-export]').click()
  check(`${L} reader: Export works`, (await exported)?.suggestedFilename() === 'Shortage Q3.xlsx')
  await page.goto(`${BASE}/analytics/itemlist/new`)
  await page.locator('[role="alert"]').first().waitFor()
  check(`${L} reader: no upload page`, (await page.locator('[data-item-list-upload]').count()) === 0)
  await page.goto(`${BASE}/analytics/itemlist/il-1/upload`)
  await page.locator('[role="alert"]').first().waitFor()
  check(`${L} reader: no re-upload page`, (await page.locator('[data-item-list-upload]').count()) === 0 && !calls.some((c) => c.p === 'Analytics/ItemLists/Preview'))
  check(`${L} reader: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // An author who does not own the list reads and exports it, but is not offered a new version.
  const other = await open(dir, AUTHOR, { userId: 'nalharbi' })
  await other.page.goto(`${BASE}/analytics/itemlist/il-1`)
  await other.page.locator('[data-item-list="il-1"]').waitFor()
  check(`${L} other author: no re-upload on another's list`, (await other.page.locator('[data-item-list-reupload]').count()) === 0)
  await other.page.goto(`${BASE}/analytics/itemlist/il-1/upload`)
  await other.page.locator('[data-item-list-not-owner]').waitFor()
  check(`${L} other author: the re-upload page says only the owner may`, (await other.page.locator('[data-item-list-file]').count()) === 0)
  await other.context.close()
}

for (const dir of ['ltr', 'rtl']) {
  await authorWalk(dir)
  await edgeWalk(dir)
  await readerWalk(dir)
}
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
