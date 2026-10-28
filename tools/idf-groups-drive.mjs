// Insurance rules ▸ IDF groups drive (BackOffice spec 3185 / door 3196; oms ticket 652, extended by 653).
//
// Drives the REAL app in Chromium against a STUB of the groups doors, on the REAL envelope. Fixtures and the handler
// are `tools/idf-stubs.mjs` (`// --- 652 ---`, `idfGroupsStub`):
//   GET    IdfPriority/groups?search=&page=   → `IDF_GROUPS`, paged
//   POST   IdfPriority/groups                 { idfNumber, description, dosageForm }
//   PUT    IdfPriority/groups/{idfNumber}     { description, dosageForm }
//   DELETE IdfPriority/groups/{idfNumber}     refused while items point at it (`data.itemCount`)
//   GET    IdfPriority/groups/export          → `.xlsx`
//
// It verifies, in LTR and RTL:
//   1. the IDF groups leaf is in the rail and lit; title + the WPF help text; the rows (number ltr, description bdi,
//      item count ltr); Remove offered only on the empty groups;
//   2. search by description and by number rides the URL (`?q=`) and the door's `search=`;
//   3. add: blank / too-long number and blank description are refused in the dialog (nothing sent); then added;
//   4. edit: the number is fixed; the PUT carries only description + dosage form;
//   5. a refused remove (the WPF added members since the list was read) shows its message and the count, and the
//      row re-reads with its real count and no Remove;
//   6. remove of an empty group; 7. export saves the server's file; a refused export toasts the message;
//   8. no raw keys, no page errors; a bare 403 is "You do not have access".
//
//   1. run the app:  npx vite --port 5217 --strictPort
//   2. node tools/idf-groups-drive.mjs        (DRIVE_PORT overrides 5217)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState, IDF_GROUPS_EXPORT_NAME } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5217}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
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
const noRawKeys = async (page) => !/insurance-(rules|idf):|groups\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const rowIds = (page) => page.locator('[data-idf-groups] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))
const removable = (page) => page.locator('[data-group-remove]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group-remove')))
const lastRead = (reads) => (reads.groups ?? []).at(-1) ?? ''
const SEED = ['IDF-0101', 'IDF-0102', 'IDF-0207', 'IDF-0310', 'IDF-0399']

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads, writes } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator('a[href="/insurance-rules/idf/groups"]')
    check(`${dir} 1. the rail has the IDF groups leaf, lit`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')
    check(
      `${dir} 1. the title and the WPF help text`,
      strip(await page.locator('h1').first().innerText()) === 'IDF groups' && /WPF IDF Import screen still writes groups, unchecked/.test(await page.locator('[data-idf-groups-help]').innerText()),
    )
    check(`${dir} 1. the rows as sent`, JSON.stringify(await rowIds(page)) === JSON.stringify(SEED), JSON.stringify(await rowIds(page)))
    const r101 = page.locator('[data-group="IDF-0101"]')
    check(
      `${dir} 1. number ltr, description bdi, dosage form, item count ltr`,
      (await r101.locator('[data-col="number"] bdi[dir="ltr"]').innerText()) === 'IDF-0101' &&
        strip(await r101.locator('[data-col="description"] bdi').innerText()) === 'Paracetamol 500 mg' &&
        strip(await r101.locator('[data-col="dosageForm"]').innerText()) === 'Tablet' &&
        (await r101.locator('[data-col="itemCount"] bdi[dir="ltr"]').innerText()) === '6',
    )
    check(`${dir} 1. the Arabic description is isolated`, strip(await page.locator('[data-group="IDF-0310"] [data-col="description"] bdi').innerText()) === 'أوميبرازول 20 ملغ')
    check(`${dir} 1. Remove is offered only on the empty groups`, JSON.stringify(await removable(page)) === JSON.stringify(['IDF-0310', 'IDF-0399']), JSON.stringify(await removable(page)))
    check(`${dir} 1. the total`, strip(await page.locator('[data-idf-groups-total]').innerText()) === 'Groups found: 5')

    // 2. search
    const search = page.locator('[data-idf-groups-search]')
    await search.fill('ibupro')
    await search.press('Enter')
    await page.waitForURL(/[?&]q=ibupro/)
    await page.locator('[data-group="IDF-0101"]').waitFor({ state: 'detached' })
    check(`${dir} 2. search by description: the URL and the door's search=`, JSON.stringify(await rowIds(page)) === JSON.stringify(['IDF-0102']) && /search=ibupro/.test(lastRead(reads)), lastRead(reads))
    await search.fill('IDF-02')
    await search.press('Enter')
    await page.waitForURL(/[?&]q=IDF-02/)
    await page.locator('[data-group="IDF-0207"]').waitFor()
    check(`${dir} 2. search by number`, JSON.stringify(await rowIds(page)) === JSON.stringify(['IDF-0207']))
    await search.fill('')
    await search.press('Enter')
    await page.locator('[data-group="IDF-0101"]').waitFor()
    check(`${dir} 2. a cleared search drops q from the URL`, !/[?&]q=/.test(page.url()) && JSON.stringify(await rowIds(page)) === JSON.stringify(SEED))

    // 3. add
    await page.locator('[data-idf-group-add]').click()
    const dlg = page.locator('[data-idf-group-dialog="new"]')
    await dlg.waitFor()
    await page.locator('[data-group-save]').click()
    const probs = await dlg.locator('[data-problem]').evaluateAll((els) => els.map((e) => e.getAttribute('data-problem')).sort())
    check(`${dir} 3. a blank number and description are refused, nothing sent`, JSON.stringify(probs) === JSON.stringify(['descriptionRequired', 'numberRequired']) && writes.length === 0, JSON.stringify(probs))
    await dlg.locator('[data-field="idfNumber"]').fill('X'.repeat(27))
    await dlg.locator('[data-field="description"]').fill('Loratadine 10 mg')
    check(`${dir} 3. a 27-character number is too long`, (await dlg.locator('[data-problem="numberTooLong"]').count()) === 1 && writes.length === 0)
    await dlg.locator('[data-field="idfNumber"]').fill('IDF-0500')
    await dlg.locator('[data-field="dosageForm"]').fill('Tablet')
    await page.locator('[data-group-save]').click()
    await dlg.waitFor({ state: 'detached' })
    const post = writes[0]
    check(`${dir} 3. POST carries number, description, dosage form`, post?.method === 'POST' && JSON.stringify(post.body) === JSON.stringify({ idfNumber: 'IDF-0500', description: 'Loratadine 10 mg', dosageForm: 'Tablet' }), JSON.stringify(post))
    await page.locator('[data-group="IDF-0500"]').waitFor()
    check(`${dir} 3. the new group is listed, empty, removable`, strip(await page.locator('[data-group="IDF-0500"] [data-col="itemCount"]').innerText()) === '0' && (await page.locator('[data-group-remove="IDF-0500"]').count()) === 1)

    // 4. edit
    await page.locator('[data-group-edit="IDF-0102"]').click()
    const ed = page.locator('[data-idf-group-dialog="IDF-0102"]')
    await ed.waitFor()
    const num = ed.locator('[data-field="idfNumber"]')
    check(`${dir} 4. the number is shown fixed`, (await num.inputValue()) === 'IDF-0102' && (await num.isDisabled()) && /cannot change/.test(await ed.innerText()))
    await ed.locator('[data-field="description"]').fill('Ibuprofen 400 mg film-coated')
    await page.locator('[data-group-save]').click()
    await ed.waitFor({ state: 'detached' })
    const put = writes[1]
    check(
      `${dir} 4. PUT carries only description + dosage form, under the number`,
      put?.method === 'PUT' && put.path === 'IdfPriority/groups/IDF-0102' && JSON.stringify(put.body) === JSON.stringify({ description: 'Ibuprofen 400 mg film-coated', dosageForm: 'Tablet' }),
      JSON.stringify(put),
    )
    await page.locator('[data-group="IDF-0102"] [data-col="description"]', { hasText: 'film-coated' }).waitFor()
    check(`${dir} 4. the row shows the new description`, strip(await page.locator('[data-group="IDF-0102"] [data-col="description"] bdi').innerText()) === 'Ibuprofen 400 mg film-coated')

    // 5. a refused remove
    await page.locator('[data-group-remove="IDF-0399"]').click()
    const rm = page.locator('[data-idf-group-remove-dialog="IDF-0399"]')
    await rm.waitFor()
    await page.locator('[data-group-remove-confirm]').click()
    await rm.locator('[data-idf-group-remove-refusal]').waitFor()
    check(`${dir} 5. DELETE sent with no body`, writes[2]?.method === 'DELETE' && writes[2].path === 'IdfPriority/groups/IDF-0399' && writes[2].body == null, JSON.stringify(writes[2]))
    const refusal = strip(await rm.locator('[data-idf-group-remove-refusal]').innerText())
    check(
      `${dir} 5. the refusal shows its message and the count (ltr)`,
      /Items still point at this IDF group/.test(refusal) && (await rm.locator('[data-refused-count="2"] bdi[dir="ltr"]').innerText()) === '2' && /2 items still point at this group/.test(refusal),
      refusal,
    )
    check(`${dir} 5. the confirm is not offered again`, await page.locator('[data-group-remove-confirm]').isDisabled())
    await page.keyboard.press('Escape')
    await rm.waitFor({ state: 'detached' })
    await page.locator('[data-group="IDF-0399"][data-item-count="2"]').waitFor()
    check(`${dir} 5. the row re-reads its real count and Remove is gone`, (await page.locator('[data-group-remove="IDF-0399"]').count()) === 0)

    // 6. remove an empty group
    await page.locator('[data-group-remove="IDF-0500"]').click()
    const rm2 = page.locator('[data-idf-group-remove-dialog="IDF-0500"]')
    await rm2.waitFor()
    await page.locator('[data-group-remove-confirm]').click()
    await rm2.waitFor({ state: 'detached' })
    await page.locator('[data-group="IDF-0500"]').waitFor({ state: 'detached' })
    check(`${dir} 6. the empty group is removed`, writes[3]?.method === 'DELETE' && writes[3].path === 'IdfPriority/groups/IDF-0500' && JSON.stringify(await rowIds(page)) === JSON.stringify(SEED))

    // 7. export
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('[data-idf-groups-export]').click()])
    check(`${dir} 7. export saves the server's file under the server's name`, dl.suggestedFilename() === IDF_GROUPS_EXPORT_NAME && (await dl.path()) != null && reads.groupsExport === 1, dl.suggestedFilename())

    check(`${dir} 8. no raw keys`, await noRawKeys(page))
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['groupsExport'] })
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups] tbody tr').first().waitFor({ timeout: 60000 })
    let downloaded = false
    page.on('download', () => (downloaded = true))
    await page.locator('[data-idf-groups-export]').click()
    const toast = page.locator('[data-sonner-toast]', { hasText: 'The groups could not be exported' })
    await toast.waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 7. a refused export toasts the server's message, no file`, (await toast.count()) === 1 && /The groups file could not be built/.test(await toast.innerText()) && !downloaded)
    check(`${dir} 7. no page errors (refused export)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['groups'] })
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(
      `${dir} 8. a bare 403 → "You do not have access", no add, no export, no list`,
      (await page.locator('[data-idf-groups-denied]').count()) === 1 &&
        strip(await page.locator('[data-idf-groups-denied]').innerText()).startsWith('You do not have access') &&
        (await page.locator('[data-idf-groups], [data-idf-group-add], [data-idf-groups-export]').count()) === 0,
    )
    check(`${dir} 8. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
