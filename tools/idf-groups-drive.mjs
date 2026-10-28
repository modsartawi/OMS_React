// Insurance rules ▸ IDF groups drive (BackOffice spec 3185 / door 3196; oms ticket 652, extended by 653).
//
// Drives the REAL app in Chromium against a STUB of the groups doors, on the REAL envelope. Fixtures and the handler
// are `tools/idf-stubs.mjs` (`// --- 652 ---`, `idfGroupsStub`):
//   GET    IdfPriority/groups?search=&page=   → `IDF_GROUPS`, paged
//   POST   IdfPriority/groups                 { idfNumber, description, dosageForm }
//   PUT    IdfPriority/groups/{idfNumber}     { description, dosageForm }
//   DELETE IdfPriority/groups/{idfNumber}     refused while items point at it (`data.itemCount`)
//   GET    IdfPriority/groups/export          → `.xlsx`
//   GET    IdfPriority/groups/template        → `.xlsx` (653)
//   POST   IdfPriority/groups/uploads         multipart file → every row with its action (653, `idfGroupsImportStub`)
//   POST   IdfPriority/groups/uploads/{id}/apply → { added, updated }, refused unless ok (653)
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
//   653: 9. Template saves the server's blank file;
//   10. a dirty file: the report lists every row with its action (number ltr), the failing rows' rule in words and
//       message in a bdi, the count of failing rows; Apply stays off and nothing is applied;
//   11. `ok: false` with every row passing also keeps Apply off;
//   12. a clean file with an update: counts add 1 / update 1, Apply applies, the result shows added + updated, the
//       list re-reads (the new group listed, the updated description shown); 13. a refused apply shows its message.
//
//   3185 review: 14. a remove that fails for a passing reason (a 500, no count) keeps Remove on, and a retry removes;
//       removing the last group of the last page falls back to the new last page (never an empty page with no pager).
//
//   654 (doors as built): the number is at most 8; a remove refused because a master's LIVE version still ranks the
//       group (IDF-00047, `entryCount`) says so and keeps Remove off (15); an import whose line matches the group as it
//       stands reports it unchanged (16); without `canEditGeneral` no Add, Import, Edit or Remove shows — Export and
//       Template still do (17).
//
//   1. run the app:  npx vite --port 5217 --strictPort
//   2. node tools/idf-groups-drive.mjs        (DRIVE_PORT overrides 5217)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState, IDF_GROUPS, IDF_GROUPS_EXPORT_NAME } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5217}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [], refuseGroupsApply = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const writes = []
  const groupUploads = {}
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
    const hit = idfStub(req.method(), p + url.search, body, { state, deny, reads, writes, groupUploads, refuseGroupsApply })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, writes, state, calls, groupUploads }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|groups(Import)?\.|menu\.idf|access\./.test(await page.locator('main').innerText())
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
    await dlg.locator('[data-field="idfNumber"]').fill('X'.repeat(9))
    await dlg.locator('[data-field="description"]').fill('Loratadine 10 mg')
    check(`${dir} 3. a 9-character number is too long (the door's 8)`, (await dlg.locator('[data-problem="numberTooLong"]').count()) === 1 && writes.length === 0)
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
      /IDF-0399 still has 2 item\(s\)/.test(refusal) && (await rm.locator('[data-refused-count="2"] bdi[dir="ltr"]').innerText()) === '2' && /2 items still point at this group/.test(refusal) && (await rm.locator('[data-refused-entries]').count()) === 0,
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
    check(`${dir} 7. a failed export (a 500: the real door never refuses it) toasts, no file`, (await toast.count()) === 1 && !downloaded)
    check(`${dir} 7. no page errors (refused export)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 653 · Template + Import
    const { context, page, errors, reads, writes, calls } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups] tbody tr').first().waitFor({ timeout: 60000 })

    // 9. template
    const [tdl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('[data-idf-groups-template]').click()])
    check(`${dir} 9. Template saves the server's blank file`, tdl.suggestedFilename() === 'idf-groups-template.xlsx' && (await tdl.path()) != null && reads.groupsTemplate === 1, tdl.suggestedFilename())

    // 10. a dirty file
    await page.locator('[data-idf-groups-import]').click()
    const dlg = page.locator('[data-idf-groups-import-dialog]')
    await dlg.waitFor()
    const applyBtn = page.locator('[data-idf-groups-import-apply]')
    check(`${dir} 10. before a file: Upload and Apply are off`, (await page.locator('[data-idf-groups-import-submit]').isDisabled()) && (await applyBtn.isDisabled()))
    const file = (name) => ({ name, mimeType: 'text/csv', buffer: Buffer.from('idf,description,dosage form\nIDF-0600,Loratadine 10 mg,Tablet\n') })
    await dlg.locator('[data-idf-groups-import-file]').setInputFiles(file('groups-dirty.csv'))
    await page.locator('[data-idf-groups-import-submit]').click()
    await dlg.locator('[data-idf-report="failed"]').waitFor({ timeout: 30000 })
    check(`${dir} 10. the file went as multipart`, calls.some((c) => c.method === 'POST' && c.path === 'IdfPriority/groups/uploads' && c.multipart && /filename="groups-dirty.csv"/.test(String(c.body))))
    const rows = dlg.locator('[data-idf-report-rows] tbody tr')
    const shape = await rows.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-line')}:${e.getAttribute('data-action')}:${e.getAttribute('data-rule')}`))
    check(
      `${dir} 10. every row is listed with its action, in the server's order`,
      JSON.stringify(shape) === JSON.stringify(['2:add:', '3:update:', '4::missingNumber', '5:update:duplicateNumber', '6:add:missingDescription']),
      JSON.stringify(shape),
    )
    check(`${dir} 10. the summary counts the failing rows`, strip(await dlg.locator('[data-idf-report-summary]').innerText()).startsWith('3 rows failed.'), strip(await dlg.locator('[data-idf-report-summary]').innerText()))
    const r5 = dlg.locator('[data-idf-report-rows] tbody tr[data-line="5"]')
    check(
      `${dir} 10. line and group ltr, action and rule in words, the message in a bdi`,
      (await r5.locator('[data-col="line"] bdi[dir="ltr"]').innerText()) === '5' &&
        (await r5.locator('[data-col="group"] bdi[dir="ltr"]').innerText()) === 'IDF-0101' &&
        strip(await r5.locator('[data-col="action"]').innerText()) === 'Update' &&
        strip(await r5.locator('[data-col="rule"]').innerText()) === 'Group number listed twice' &&
        strip(await r5.locator('[data-col="message"] bdi').innerText()) === 'Group IDF-0101 is listed twice (lines 3 and 5).',
    )
    const r2 = dlg.locator('[data-idf-report-rows] tbody tr[data-line="2"]')
    check(`${dir} 10. a passing row: its action, no rule, no message`, strip(await r2.locator('[data-col="action"]').innerText()) === 'Add' && strip(await r2.locator('[data-col="rule"]').innerText()) === '' && strip(await r2.locator('[data-col="message"]').innerText()) === '')
    check(`${dir} 10. a dirty file: Apply stays off, nothing applied`, (await applyBtn.isDisabled()) && !writes.some((w) => /\/apply$/.test(w.path)))

    // 11. ok:false, all rows passing
    await dlg.locator('[data-idf-groups-import-file]').setInputFiles(file('groups-notok.csv'))
    check(`${dir} 11. picking a new file clears the report`, (await dlg.locator('[data-idf-report]').count()) === 0)
    await page.locator('[data-idf-groups-import-submit]').click()
    await dlg.locator('[data-idf-report-summary]').filter({ hasText: 'did not pass' }).waitFor({ timeout: 30000 })
    check(`${dir} 11. ok:false with every row passing: Apply off`, (await applyBtn.isDisabled()) && !writes.some((w) => /\/apply$/.test(w.path)))

    // 12. a clean file with an update
    await dlg.locator('[data-idf-groups-import-file]').setInputFiles(file('groups.csv'))
    await page.locator('[data-idf-groups-import-submit]').click()
    await dlg.locator('[data-idf-report="clean"]').waitFor({ timeout: 30000 })
    const counts = dlg.locator('[data-idf-groups-import-counts]')
    check(
      `${dir} 12. clean: the add / update counts (ltr), every row still listed`,
      (await counts.getAttribute('data-add')) === '1' && (await counts.getAttribute('data-update')) === '1' &&
        JSON.stringify(await counts.locator('bdi[dir="ltr"]').allInnerTexts()) === '["1","1"]' && (await rows.count()) === 2,
    )
    check(`${dir} 12. clean: Apply is on`, await applyBtn.isEnabled())
    await applyBtn.click()
    const result = dlg.locator('[data-idf-groups-import-result]')
    await result.waitFor({ timeout: 30000 })
    const applied = writes.filter((w) => /\/apply$/.test(w.path))
    check(`${dir} 12. one apply, under the clean upload's id`, applied.length === 1 && applied[0].path === 'IdfPriority/groups/uploads/G-3/apply', JSON.stringify(applied))
    check(`${dir} 12. the result shows added, updated and unchanged`, (await result.getAttribute('data-added')) === '1' && (await result.getAttribute('data-updated')) === '1' && /Groups added: 1 · updated: 1 · unchanged: 0/.test(strip(await result.innerText())), strip(await result.innerText()))
    check(`${dir} 12. the applied report is gone, Apply off again`, (await dlg.locator('[data-idf-report]').count()) === 0 && (await applyBtn.isDisabled()))
    await page.locator('[data-idf-groups-import-close]').click()
    await dlg.waitFor({ state: 'detached' })
    await page.locator('[data-group="IDF-0600"]').waitFor({ timeout: 30000 })
    check(
      `${dir} 12. the list re-read: the new group listed, the update shown`,
      strip(await page.locator('[data-group="IDF-0600"] [data-col="description"] bdi').innerText()) === 'Loratadine 10 mg' &&
        strip(await page.locator('[data-group="IDF-0101"] [data-col="description"] bdi').innerText()) === 'Paracetamol 500 mg (film-coated)',
    )
    check(`${dir} 12. no raw keys`, await noRawKeys(page))
    check(`${dir} 12. no page errors (import)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 653 · 13. a refused apply
    const { context, page, errors, state } = await open(dir, { refuseGroupsApply: true })
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups] tbody tr').first().waitFor({ timeout: 60000 })
    await page.locator('[data-idf-groups-import]').click()
    const dlg = page.locator('[data-idf-groups-import-dialog]')
    await dlg.waitFor()
    await dlg.locator('[data-idf-groups-import-file]').setInputFiles({ name: 'groups.csv', mimeType: 'text/csv', buffer: Buffer.from('x') })
    await page.locator('[data-idf-groups-import-submit]').click()
    await dlg.locator('[data-idf-report="clean"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-groups-import-apply]').click()
    await dlg.locator('[data-idf-groups-import-apply-refused]').waitFor({ timeout: 30000 })
    check(
      `${dir} 13. a refused apply shows the server's message; nothing written, no result`,
      /can no longer be applied/.test(await dlg.locator('[data-idf-groups-import-apply-refused]').innerText()) &&
        (await dlg.locator('[data-idf-groups-import-result]').count()) === 0 && !state.groups.some((g) => g.idfNumber === 'IDF-0600'),
    )
    check(`${dir} 13. no page errors (refused apply)`, errors.length === 0, errors.join(' | '))
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

// --- 3185 review --- a transient remove failure is retried; an emptied last page falls back
for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, state } = await open(dir)
  state.groups = structuredClone(IDF_GROUPS).filter((g) => g.idfNumber !== 'IDF-0399')
  state.groupsPageSize = 3
  state.groupRemoveFailures = 1
  await page.goto(`${BASE}/insurance-rules/idf/groups?page=2`)
  await page.locator('[data-idf-groups] tbody tr[data-group="IDF-0310"]').waitFor({ timeout: 60000 })
  check(`${dir} 14. page 2 holds one group`, JSON.stringify(await rowIds(page)) === '["IDF-0310"]', JSON.stringify(await rowIds(page)))
  await page.locator('[data-group-remove="IDF-0310"]').click()
  const rm = page.locator('[data-idf-group-remove-dialog="IDF-0310"]')
  await rm.waitFor()
  await page.locator('[data-group-remove-confirm]').click()
  await rm.locator('[data-idf-group-remove-refusal]').waitFor({ timeout: 30000 })
  check(
    `${dir} 14. a passing failure shows its message and leaves Remove on`,
    (await rm.locator('[data-idf-group-remove-refusal]').count()) === 1 && (await rm.locator('[data-refused-count], [data-refused-entries]').count()) === 0 && (await page.locator('[data-group-remove-confirm]').isEnabled()),
  )
  await page.locator('[data-group-remove-confirm]').click()
  await rm.waitFor({ state: 'detached', timeout: 30000 })
  await page.waitForURL((u) => !u.searchParams.has('page'), { timeout: 30000 }).catch(() => {})
  await page.locator('[data-idf-groups] tbody tr').first().waitFor({ timeout: 30000 }).catch(() => {})
  check(
    `${dir} 14. the retry removes; the emptied page 2 falls back to page 1 with its rows`,
    !state.groups.some((g) => g.idfNumber === 'IDF-0310') &&
      !new URL(page.url()).searchParams.has('page') &&
      JSON.stringify(await rowIds(page)) === '["IDF-0101","IDF-0102","IDF-0207"]' &&
      (await page.locator('[data-idf-groups-empty]').count()) === 0,
    `${page.url()} ${JSON.stringify(await rowIds(page))}`,
  )
  check(`${dir} 14. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
  await context.close()
}

// --- 654 --- doors as built: live rankings hold a group; an unchanged import line; the general edit grant
for (const dir of ['ltr', 'rtl']) {
  {
    // 15. IDF-0310 has no item, but 3 entries of masters' live versions rank it
    const { context, page, errors, state, writes } = await open(dir)
    state.groups = structuredClone(IDF_GROUPS).map((g) => (g.idfNumber === 'IDF-0310' ? { ...g, liveEntries: 3 } : g))
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-group-remove="IDF-0310"]').click()
    const rm = page.locator('[data-idf-group-remove-dialog="IDF-0310"]')
    await rm.waitFor()
    await page.locator('[data-group-remove-confirm]').click()
    await rm.locator('[data-idf-group-remove-refusal]').waitFor({ timeout: 30000 })
    const refusal = strip(await rm.innerText())
    check(
      `${dir} 15. a group still ranked by live versions: the refusal says so with the count (ltr), not items`,
      (await rm.locator('[data-refused-entries="3"] bdi[dir="ltr"]').innerText()) === '3' &&
        /3 entries of masters’ live versions still rank this group/.test(refusal) &&
        (await rm.locator('[data-refused-count]').count()) === 0,
      refusal,
    )
    check(`${dir} 15. and Remove stays off`, (await page.locator('[data-group-remove-confirm]').isDisabled()) && writes.filter((w) => w.method === 'DELETE').length === 1)
    check(`${dir} 15. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 16. an import line that matches the group as it stands
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups-import]').click()
    const dlg = page.locator('[data-idf-groups-import-dialog]')
    await dlg.waitFor()
    await dlg.locator('[data-idf-groups-import-file]').setInputFiles({ name: 'groups-same.csv', mimeType: 'text/csv', buffer: Buffer.from('IDF-0102,Ibuprofen 400 mg,Tablet\n') })
    await page.locator('[data-idf-groups-import-submit]').click()
    await dlg.locator('[data-idf-report="clean"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-groups-import-apply]').click()
    const result = dlg.locator('[data-idf-groups-import-result]')
    await result.waitFor({ timeout: 30000 })
    check(
      `${dir} 16. the result counts the unchanged line (ltr)`,
      (await result.getAttribute('data-unchanged')) === '1' && /Groups added: 0 · updated: 0 · unchanged: 1/.test(strip(await result.innerText())) && JSON.stringify(await result.locator('bdi[dir="ltr"]').allInnerTexts()) === '["0","0","1"]',
      strip(await result.innerText()),
    )
    check(`${dir} 16. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 17. without the general edit grant
    const { context, page, errors, reads, state } = await open(dir)
    state.access = { canEditGeneral: false }
    await page.goto(`${BASE}/insurance-rules/idf/groups`)
    await page.locator('[data-idf-groups] tbody tr').first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(500)
    check(`${dir} 17. the probe is read`, (reads.access ?? 0) >= 1)
    check(
      `${dir} 17. without canEditGeneral: no Add, Import, Edit or Remove, no actions column`,
      (await page.locator('[data-idf-group-add], [data-idf-groups-import], [data-group-edit], [data-group-remove]').count()) === 0 &&
        (await page.locator('[data-idf-groups] thead th').count()) === 4,
    )
    check(`${dir} 17. Export and Template still show (reads, on the view grant)`, (await page.locator('[data-idf-groups-export]').count()) === 1 && (await page.locator('[data-idf-groups-template]').count()) === 1)
    check(`${dir} 17. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
