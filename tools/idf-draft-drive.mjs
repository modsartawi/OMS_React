// Insurance rules ▸ IDF master ▸ Draft drive (BackOffice spec 3185 / doors 3189 + 3190; oms tickets 645 + 646).
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
// 646 (door 3190: POST …/draft/rebase, POST …/draft/groups — `// --- 646 ---` in the stubs):
//   9. someone else's draft: "Draft open by X since …", no Start / edits / Publish; Discard confirms it is their work;
//  10. a Start refused because a draft opened meanwhile names its owner and last change;
//  11. my stale draft: Publish off, Rebase on; after the rebase the base version and the diff refresh; then it publishes;
//  12. a group add says how many were added and lists the two refused members with their rule and message; an unknown
//      group is refused inline.
// 3185 review:
//   4. a priority that is not a whole number of 1 or more (2.5, 0, 1e1) keeps the re-rank's Save off (nothing sent);
//  10. the refused Start re-reads the draft: someone else's draft and its Discard show at once, the refusal above it;
//  13. a rebase onto a live version published after the page was read names its number (the versions re-read), and the
//      header's live version follows;
//  14. a base version that cannot be read says so with Try again (no endless "comparing…"); the retry draws the diff;
//  15. a publish answered with no body still closes the draft and re-reads the master (no page error).
// 654 (doors as built):
//  11. a rebase that cannot replay a re-rank (the live version no longer holds the item) drops it and LISTS it: how
//      many edits re-applied, and the dropped edit's item, edit, rule word and message;
//  16. Start on a master with nothing live: an empty draft (`baseVersionId ''`), every row it gets marked Added, and no
//      entries read with an empty version id;
//  17. without `canEditIdf`: no Start, no edits, no Publish, no Discard (not even of someone else's draft), no row
//      Re-rank / Remove — the draft still reads, and the panel says it is view-only.
//
//   1. run the app:  npx vite --port 5213 --strictPort
//   2. node tools/idf-draft-drive.mjs        (DRIVE_PORT overrides 5213)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState, IDF_ENTRIES } from './idf-stubs.mjs'
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
    await panel(page, 'mine')
    await page.locator('[data-idf-items-section][data-version-shown="draft"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-items] [data-col="mark"] [data-mark]').first().waitFor({ timeout: 30000 })
    check(`${dir} 2. Start posts the draft door once`, JSON.stringify(draftWrites.map((w) => `${w.method} ${w.door}`)) === '["POST draft"]', JSON.stringify(draftWrites))
    check(`${dir} 2. the picker names the draft first and shows it`, (await page.locator('[data-idf-items-version]').inputValue()) === '' && strip(await page.locator('[data-idf-items-version] option').first().innerText()) === 'Draft (not published)')
    check(`${dir} 2. the draft holds the live items, all unchanged`, strip(await page.locator('[data-idf-items-total]').innerText()) === 'Items: 60' && (await markOf(page, '100110')) === 'unchanged' && (await counts(page)) === 'Added 0, re-ranked 0, moved 0, removed 0')
    check(`${dir} 2. the base version is read whole for the diff`, (reads.entries ?? []).some((r) => r.versionId === 'V-11' && /pageSize=500/.test(r.qs)), JSON.stringify(reads.entries))
    check(`${dir} 2. the header names the owner (me), free text, and the start, ltr`, strip(await page.locator('[data-idf-draft] [data-col="owner"] bdi').innerText()) === 'msartawi' && strip(await page.locator('[data-idf-draft] [data-col="owner"]').innerText()) .endsWith('(you)') && JSON.stringify(await ltr(page.locator('[data-idf-draft] [data-col="started"]'))) === '["2026-10-28 10:00"]')
    check(`${dir} 2. the header names the base version, its number ltr`, strip(await page.locator('[data-idf-draft] [data-col="base"]').innerText()) === 'Version 3' && JSON.stringify(await ltr(page.locator('[data-idf-draft] [data-col="base"]'))) === '["3"]')

    // 3. three edits, in group IDF-PARA (one page)
    await filterGroup(page, 'IDF-PARA')
    await page.waitForURL((u) => u.search === '?idf=IDF-PARA', { timeout: 30000 })
    const add = page.locator('[data-idf-draft-add]')
    await add.locator('[data-field="itemNumber"]').fill('100999')
    await add.locator('[data-field="idfNumber"]').fill('IDF-PARA')
    await add.locator('[data-field="priority"]').fill('11')
    await add.locator('[data-idf-draft-add-submit]').click()
    await row(page, '100999').waitFor({ timeout: 30000 })
    check(`${dir} 3. an added item is marked Added`, (await markOf(page, '100999')) === 'added' && strip(await row(page, '100999').locator('[data-col="mark"]').innerText()) === 'Added')
    check(`${dir} 3. the add form clears`, (await add.locator('[data-field="itemNumber"]').inputValue()) === '')

    await page.locator('[data-idf-draft-rerank="100110"]').click()
    const rr = page.locator('[data-idf-draft-rerank-dialog="100110"]')
    await rr.waitFor({ timeout: 30000 })
    check(`${dir} 3. the re-rank dialog names the item`, strip(await page.locator('dialog[open] h2, dialog[open] [id]').first().innerText()).includes('100110'))
    const offFor = []
    for (const p of ['2.5', '0', '1e1']) {
      await rr.locator('[data-field="priority"]').fill(p)
      if (await page.locator('[data-idf-draft-rerank-confirm]').isDisabled()) offFor.push(p)
    }
    check(`${dir} 4. a priority that is not a whole number of 1 or more keeps Save off, nothing sent`, offFor.length === 3 && !draftWrites.some((w) => w.method === 'PUT'), JSON.stringify(offFor))
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
    await add.locator('[data-field="idfNumber"]').fill('IDF-PARA')
    await add.locator('[data-field="priority"]').fill('3')
    await add.locator('[data-idf-draft-add-submit]').click()
    const refused = add.locator('[data-idf-draft-refused="itemNotInGroup"]')
    await refused.waitFor({ timeout: 30000 })
    check(`${dir} 4. a refused add shows the rule's word and the message inline`, strip(await refused.locator('[data-col="rule"]').innerText()) === 'Item not in the IDF group the line names' && strip(await refused.locator('[data-col="message"] bdi').innerText()) === 'Item 100302 is not in IDF group IDF-PARA.')
    check(`${dir} 4. a refusal is not an error toast`, (await errorToasts(page)) === 0)
    await page.waitForTimeout(300)
    const after = JSON.stringify(await page.locator('[data-idf-items] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-item')}:${e.getAttribute('data-priority')}`)))
    check(`${dir} 4. the draft is as it was`, before === after && (await counts(page)) === 'Added 1, re-ranked 1, moved 0, removed 1' && (await add.locator('[data-field="itemNumber"]').inputValue()) === '100302')

    // 5. reload
    await page.reload()
    await panel(page, 'mine')
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
    await panel(page, 'mine')
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

// --- 646 --- whose draft, stale → rebase, add a group
const seed = (state, d) => {
  state.drafts ??= {}
  state.drafts['M-BUPA'] = {
    draftId: 'D-M-BUPA',
    startedAt: '2026-10-27T08:00:00',
    changedAt: '2026-10-27T09:30:00',
    baseVersionId: 'V-11',
    isStale: false,
    rows: structuredClone(IDF_ENTRIES['V-11']),
    ...d,
  }
}
const editControls = (page) => page.locator('[data-idf-draft-start], [data-idf-draft-add], [data-idf-draft-group], [data-idf-draft-publish], [data-idf-draft-rerank], [data-idf-draft-remove]').count()

for (const dir of ['ltr', 'rtl']) {
  {
    // 9. someone else's draft
    const { context, page, errors, draftWrites, state } = await open(dir)
    seed(state, { by: 'nalharbi' })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(page, 'someoneElse')
    await page.locator('[data-idf-items] [data-col="mark"] [data-mark]').first().waitFor({ timeout: 60000 })
    const note = page.locator('[data-idf-draft-someone-else]')
    check(`${dir} 9. someone else's draft says whose and since when`, strip(await note.innerText()).startsWith('Draft open by nalharbi since 2026-10-27 08:00.') && strip(await note.locator('bdi:not([dir])').first().innerText()) === 'nalharbi' && JSON.stringify(await ltr(note)) === '["2026-10-27 08:00"]', strip(await note.innerText()))
    check(`${dir} 9. the header names the owner without "(you)"`, strip(await page.locator('[data-idf-draft] [data-col="owner"]').innerText()) === 'nalharbi')
    check(`${dir} 9. no Start, no edits, no group add, no Publish`, (await editControls(page)) === 0)
    check(`${dir} 9. the items still show the draft, marked`, (await page.locator('[data-idf-items-section]').getAttribute('data-version-shown')) === 'draft' && (await markOf(page, '100110')) === 'unchanged')
    await page.locator('[data-idf-draft-discard]').click()
    const dlg = page.locator('[data-idf-draft-discard-dialog="someone-else"]')
    await dlg.waitFor({ timeout: 30000 })
    check(`${dir} 9. Discard confirms it is someone else's work`, strip(await page.locator('dialog[open] h2, dialog[open] [id]').first().innerText()) === "Discard someone else's draft?" && strip(await dlg.innerText()).startsWith("This draft is nalharbi's work, open since 2026-10-27 08:00.") && !draftWrites.some((w) => w.method === 'DELETE'))
    await page.locator('[data-idf-draft-discard-confirm]').click()
    await panel(page, 'none')
    check(`${dir} 9. confirming discards it once`, draftWrites.filter((w) => w.method === 'DELETE' && w.door === 'draft').length === 1)
    check(`${dir} 9. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 10. a Start refused: someone opened a draft meanwhile
    const { context, page, errors, state } = await open(dir)
    await start(page)
    seed(state, { by: 'nalharbi' })
    await page.locator('[data-idf-draft-start]').click()
    const refused = page.locator('[data-idf-draft-start-refused="nalharbi"]')
    await refused.waitFor({ timeout: 30000 })
    check(`${dir} 10. a refused Start names the owner and the last change`, strip(await refused.innerText()) === 'A draft is already open by nalharbi, last changed 2026-10-27 09:30.' && JSON.stringify(await ltr(refused)) === '["2026-10-27 09:30"]', strip(await refused.innerText()))
    check(`${dir} 10. the refusal is not an error toast`, (await errorToasts(page)) === 0 && errors.length === 0, errors.join(' | '))
    await panel(page, 'someoneElse')
    check(
      `${dir} 10. the draft re-reads: someone else's draft and its Discard show, the refusal above it, no Start`,
      (await page.locator('[data-idf-draft-someone-else="nalharbi"]').count()) === 1 &&
        (await page.locator('[data-idf-draft-discard]').count()) === 1 &&
        (await page.locator('[data-idf-draft-start-refused="nalharbi"]').count()) === 1 &&
        (await page.locator('[data-idf-draft-start]').count()) === 0,
    )
    await context.close()
  }
  {
    // 11. my stale draft (copied from version 2, V-7; live is version 3, V-11): re-rank 200100, add 100999
    const { context, page, errors, draftWrites, published, state } = await open(dir)
    const rows = structuredClone(IDF_ENTRIES['V-7']).map((r) => (r.itemNumber === '200100' ? { ...r, priority: 3 } : r))
    rows.push({ itemNumber: '100999', descriptionEn: 'Item 100999', descriptionAr: '', idfNumber: 'IDF-PARA', priority: 11 })
    seed(state, { by: 'msartawi', baseVersionId: 'V-7', isStale: true, rows })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(page, 'stale')
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 1' }).waitFor({ timeout: 60000 })
    check(`${dir} 11. a stale draft says so and offers Rebase`, (await page.locator('[data-idf-draft-stale]').count()) === 1 && (await page.locator('[data-idf-draft-rebase]').count()) === 1)
    check(`${dir} 11. its base is version 2 and the diff is against it`, strip(await page.locator('[data-idf-draft] [data-col="base"]').innerText()) === 'Version 2' && (await counts(page)) === 'Added 1, re-ranked 1, moved 0, removed 0', await counts(page))
    await page.locator('[data-idf-draft-note]').fill('After rebase')
    check(`${dir} 11. Publish is off while stale, even with a note`, await page.locator('[data-idf-draft-publish]').isDisabled())
    await page.locator('[data-idf-draft-rebase]').click()
    await panel(page, 'mine')
    await page.locator('[data-idf-draft] [data-col="base"][data-base="V-11"]').waitFor({ timeout: 30000 })
    // 654: V-11 does not hold 200100, so its re-rank cannot be replayed — the rebase drops it (notInDraft) and says so.
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 1, re-ranked 0' }).waitFor({ timeout: 30000 })
    check(`${dir} 11. Rebase posts once (no body); the base and the diff refresh`, draftWrites.filter((w) => w.door === 'rebase').length === 1 && strip(await page.locator('[data-idf-draft] [data-col="base"]').innerText()) === 'Version 3' && (await counts(page)) === 'Added 1, re-ranked 0, moved 0, removed 0' && (await page.locator('[data-idf-draft-stale]').count()) === 0, await counts(page))
    const rebased = page.locator('[data-idf-draft-rebase-result]')
    const dropped = rebased.locator('[data-idf-draft-rebase-dropped] tbody tr')
    check(
      `${dir} 11. the rebase says how many edits re-applied (ltr) and lists the one it dropped: item, edit, rule word, message`,
      (await rebased.getAttribute('data-reapplied')) === '1' &&
        strip(await rebased.locator('[data-idf-draft-rebase-reapplied]').innerText()) === '1 edit re-applied on the live version.' &&
        JSON.stringify(await ltr(rebased.locator('[data-idf-draft-rebase-reapplied]'))) === '["1"]' &&
        (await dropped.count()) === 1 &&
        (await dropped.getAttribute('data-item')) === '200100' &&
        strip(await dropped.locator('[data-col="edit"]').innerText()) === 'Re-rank' &&
        strip(await dropped.locator('[data-col="rule"]').innerText()) === 'Item no longer ranked by the live version' &&
        /200100 is no longer in the live version/.test(await dropped.locator('[data-col="message"] bdi').innerText()),
      strip(await rebased.innerText().catch(() => '')),
    )
    await page.locator('[data-idf-draft-note]').fill('After rebase')
    await page.locator('[data-idf-draft-publish]').click()
    await panel(page, 'none')
    await page.locator('[data-idf-master] [data-live-number]').filter({ hasText: '4' }).waitFor({ timeout: 30000 })
    check(`${dir} 11. the rebased draft publishes as one version`, published.length === 1 && published[0].note === 'After rebase')
    check(`${dir} 11. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 12. a group add
    const { context, page, errors, draftWrites } = await open(dir)
    await start(page)
    await page.locator('[data-idf-draft-start]').click()
    await panel(page, 'mine')
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 0' }).waitFor({ timeout: 60000 })
    const grp = page.locator('[data-idf-draft-group]')
    await grp.locator('[data-field="idfNumber"]').fill('IDF-NOPE')
    await grp.locator('[data-field="priority"]').fill('2')
    await grp.locator('[data-idf-draft-group-submit]').click()
    await grp.locator('[data-idf-draft-refused="unknownGroup"]').waitFor({ timeout: 30000 })
    check(`${dir} 12. an unknown group is refused inline with its rule`, strip(await grp.locator('[data-idf-draft-refused] [data-col="rule"]').innerText()) === 'Unknown IDF group' && (await errorToasts(page)) === 0)
    await grp.locator('[data-field="idfNumber"]').fill('IDF-CETI')
    await grp.locator('[data-idf-draft-group-submit]').click()
    const result = grp.locator('[data-idf-draft-group-result]')
    await result.waitFor({ timeout: 30000 })
    check(`${dir} 12. the group add posts the group and priority`, JSON.stringify(draftWrites.filter((w) => w.door === 'groups').at(-1)?.body) === '{"idfNumber":"IDF-CETI","priority":2}')
    check(`${dir} 12. the result says how many were added, ltr`, strip(await result.locator('[data-idf-draft-group-added]').innerText()) === '3 items added.' && JSON.stringify(await ltr(result.locator('[data-idf-draft-group-added]'))) === '["3"]')
    const refusedRows = result.locator('[data-idf-draft-group-refused] tbody tr')
    const lines = await refusedRows.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-item')}|${e.querySelector('[data-col="rule"]').textContent}|${e.querySelector('[data-col="message"] bdi').textContent}`))
    check(`${dir} 12. the two refused members are listed with their rule and message`, JSON.stringify(lines) === JSON.stringify(["300130|Item not in the insurer's items|Item 300130 is not on the insurer item list.", '300140|Unknown item|Item 300140 does not exist.']), JSON.stringify(lines))
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 3' }).waitFor({ timeout: 30000 })
    await filterGroup(page, 'IDF-CETI')
    await row(page, '300100').waitFor({ timeout: 30000 })
    check(`${dir} 12. the added members show in the draft, marked Added`, (await markOf(page, '300100')) === 'added' && (await row(page, '300130').count()) === 0 && (await counts(page)) === 'Added 3, re-ranked 0, moved 0, removed 0')
    check(`${dir} 12. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// --- 3185 review --- rebase onto a newly published live version; an unreadable base; a publish with no body
for (const dir of ['ltr', 'rtl']) {
  {
    // 13. the live version moves after the page was read; the stale draft rebases onto it
    const { context, page, errors, state } = await open(dir)
    const rows = structuredClone(IDF_ENTRIES['V-11'])
    rows.push({ itemNumber: '100999', descriptionEn: 'Item 100999', descriptionAr: '', idfNumber: 'IDF-PARA', priority: 11 })
    seed(state, { by: 'msartawi', baseVersionId: 'V-11', isStale: true, rows })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(page, 'stale')
    await page.locator('[data-idf-draft] [data-col="base"]').filter({ hasText: 'Version 3' }).waitFor({ timeout: 60000 })
    // someone publishes version 4 meanwhile (not read by this page yet)
    IDF_ENTRIES['V-REB-4'] = structuredClone(IDF_ENTRIES['V-11'])
    state.masters.find((m) => m.masterId === 'M-BUPA').liveVersion = { versionId: 'V-REB-4', number: 4, by: 'nalharbi', at: '2026-10-28T09:00:00', note: 'Meanwhile', entryCount: 60, isLive: true }
    await page.locator('[data-idf-draft-rebase]').click()
    await page.locator('[data-idf-draft] [data-col="base"][data-base="V-REB-4"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-draft] [data-col="base"]').filter({ hasText: 'Version 4' }).waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 13. after the rebase the header names the new base by its number, not its id`, strip(await page.locator('[data-idf-draft] [data-col="base"]').innerText()) === 'Version 4', strip(await page.locator('[data-idf-draft] [data-col="base"]').innerText()))
    await page.locator('[data-idf-master] [data-live-number]').filter({ hasText: '4' }).waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 13. the master's live version re-reads too`, strip(await page.locator('[data-idf-master] [data-live-number]').innerText()) === '4')
    check(`${dir} 13. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 14. the base version's read fails once
    const { context, page, errors, state } = await open(dir)
    seed(state, { by: 'msartawi' })
    // Failing until the drive clears it: a second observer mounting re-reads an errored query.
    state.entriesFailures = 99
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(page, 'mine')
    const failedBase = page.locator('[data-idf-draft-base-failed]')
    await failedBase.waitFor({ timeout: 60000 }).catch(() => {})
    check(
      `${dir} 14. an unreadable base says so with Try again, and not "comparing…"`,
      (await failedBase.count()) === 1 && /could not be read/.test(await failedBase.innerText()) && !/Comparing/.test(await page.locator('[data-idf-draft-counts]').innerText()),
    )
    state.entriesFailures = 0
    await page.locator('[data-idf-draft-base-retry]').click()
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 0' }).waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 14. Try again reads it; the diff draws and the banner goes`, (await counts(page)) === 'Added 0, re-ranked 0, moved 0, removed 0' && (await failedBase.count()) === 0, await counts(page))
    check(`${dir} 14. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 15. a publish answered with no body
    const { context, page, errors, state, published } = await open(dir)
    await start(page)
    state.publishAnswersNull = true
    await page.locator('[data-idf-draft-start]').click()
    await panel(page, 'mine')
    await page.locator('[data-idf-draft-note]').fill('No body')
    await page.locator('[data-idf-draft-publish]').click()
    await panel(page, 'none')
    await page.locator('[data-idf-master] [data-live-number]').filter({ hasText: '4' }).waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 15. a publish with no body closes the draft and re-reads the master`, published.length === 1 && strip(await page.locator('[data-idf-master] [data-live-number]').innerText()) === '4')
    check(`${dir} 15. the success toast shows, without a version number`, (await page.locator('[data-sonner-toast][data-type="success"]', { hasText: 'Draft published' }).count()) === 1)
    check(`${dir} 15. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// --- 654 ---
for (const dir of ['ltr', 'rtl']) {
  {
    // 16. a master with nothing live (M-TAW-PILOT): Start makes an empty draft with no base
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-TAW-PILOT`)
    await panel(page, 'none')
    await page.locator('[data-idf-draft-start]').click()
    await panel(page, 'mine')
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 0' }).waitFor({ timeout: 30000 })
    check(`${dir} 16. the draft has no base: "No version", the diff drawn at once`, (await page.locator('[data-idf-draft] [data-col="base"][data-base=""]').count()) === 1 && (await counts(page)) === 'Added 0, re-ranked 0, moved 0, removed 0', await counts(page))
    const add = page.locator('[data-idf-draft-add]')
    await add.locator('[data-field="itemNumber"]').fill('100500')
    await add.locator('[data-field="idfNumber"]').fill('IDF-IBU')
    await add.locator('[data-field="priority"]').fill('1')
    await add.locator('[data-idf-draft-add-submit]').click()
    await page.locator('[data-idf-draft-counts]').filter({ hasText: 'Added 1' }).waitFor({ timeout: 30000 })
    check(`${dir} 16. its first row is marked Added`, (await markOf(page, '100500')) === 'added')
    check(`${dir} 16. no entries read with an empty version id`, !(reads.entries ?? []).some((r) => !r.versionId), JSON.stringify(reads.entries))
    check(`${dir} 16. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 17. without the IDF edit grant: my own draft, read-only
    const { context, page, errors, state, reads } = await open(dir)
    state.access = { canEditIdf: false }
    seed(state, { by: 'msartawi' })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(page, 'mine')
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(500)
    check(`${dir} 17. the probe is read`, (reads.access ?? 0) >= 1)
    check(`${dir} 17. my draft without canEditIdf: its header and rows show, no edits / Publish / Discard / row actions`, (await page.locator('[data-idf-draft]').count()) === 1 && (await editControls(page)) === 0 && (await page.locator('[data-idf-draft-discard]').count()) === 0)
    check(`${dir} 17. the panel says it is view-only`, (await page.locator('[data-idf-draft-view-only]').count()) === 1)
    await context.close()
  }
  {
    // 17. without the grant: no Start; someone else's draft offers no Discard
    const { context, page, errors, state } = await open(dir)
    state.access = { canEditIdf: false }
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(page, 'none')
    check(`${dir} 17. no draft and no grant: no Start, view-only`, (await page.locator('[data-idf-draft-start]').count()) === 0 && (await page.locator('[data-idf-draft-view-only]').count()) === 1)
    await context.close()
    const second = await open(dir)
    second.state.access = { canEditIdf: false }
    seed(second.state, { by: 'nalharbi' })
    await second.page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await panel(second.page, 'someoneElse')
    check(`${dir} 17. someone else's draft and no grant: no Discard`, (await second.page.locator('[data-idf-draft-discard]').count()) === 0 && (await editControls(second.page)) === 0)
    check(`${dir} 17. no raw keys; no page errors`, (await noRawKeys(second.page)) && errors.length === 0 && second.errors.length === 0, [...errors, ...second.errors].join(' | '))
    await second.context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
