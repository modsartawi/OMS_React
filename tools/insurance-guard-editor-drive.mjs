// Guard editor drive (BackOffice spec 3126; oms ticket 608).
//
// Drives the REAL app in Chromium against STUBS of the guard editor's doors, on the REAL envelope
// (`tools/insurance-rules-stubs.mjs`, its `// --- 608 ---` section):
//   GET  InsuranceRules/Guards/Draft    → the drive's own draft (a copy of RULESET, revision 12)
//   PUT  InsuranceRules/Guards/Draft    → the saved document, revision + 1; a stale revision → 409 STALE_REVISION
//   POST InsuranceRules/Guards/Validate → HQ's checks as the stub reads them (`validateGuards`)
// 🚩 NOTHING here is driven against a live SIS.Api: the doors (BackOffice 3139) are unbuilt. Ticket 618 swaps
// in the live doors.
//
// It verifies, in LTR and RTL:
//   1. "New guard" on the list opens /insurance-rules/guards/new with the next free id;
//   2. G-007 is built from the palette: an All of group; in it a line-in-list block, a NOT formulary block and
//      a NOT Any of group holding a patient-list and a policy-list block;
//   3. a 4th group level is offered disabled and never added;
//   4. the codes default from the first block (line daysSupply → MX / CV-4-2), follow it (line in list → none)
//      until the author types them (DC / CV-4-5 → "edited");
//   5. the checks pill: HQ's errors pinned on the rule, the block and the field; all pass once fixed;
//   6. Undo / Redo step the draft; the placeholder chip types `{name}` at the caret; no `{lastStore}` chip;
//   7. Save PUTs the WHOLE draft with its revision; the saved rule's conditions ARE G-007's; the page moves to
//      the rule's edit URL with nothing unsaved; a stale revision says so and offers a reload;
//   8. no raw keys and no page errors;
//  10. (oms 657) the ƒx helper on a formula block: Fields grouped Patient / Request / Line / Eligibility, a
//      field and an operator go in at the caret, a keyed eligibility field leaves `<code>` selected for the
//      code typed over it, a recipe writes the whole formula, and the formula is stored as the engine's expr;
//  11. (oms 658) the tree is rearranged: two top-level conditions selected → Group as Any of, a third dragged
//      into the group (a group dropped into itself is refused), one moved out with its tools menu, Undo / Redo
//      of a move, Ungroup; the saved `when` is the rearranged tree.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. node tools/insurance-guard-editor-drive.mjs        (DRIVE_PORT overrides 5201)
import { createRequire } from 'node:module'
import { RULES, WIRE_RULESET, envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const store = newGuardStore()
  // 617: the palette reads the Fields registry and the patient / policy lists (610's doors).
  const registry = newListsState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit =
      guardEditorStub(req.method(), p, body, { store, reads }) ??
      insuranceListsStub(req.method(), p, body, { state: registry, query: new URL(req.url()).searchParams }) ??
      insuranceRulesStub(req.method(), p, body, { reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
/** JSON with sorted keys: two conditions are the same whatever order their keys were written in. */
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const add = (page, parent, check) => page.locator(`select[data-add-condition="${parent}"]`).selectOption(check)
const block = (page, path) => page.locator(`[data-block="${path}"]`)
const group = (page, path) => page.locator(`[data-group="${path}"]`)
const input = (scope, name) => scope.locator(`[data-input="${name}"]`).first()
const effect = (page) => page.locator('[data-effect-editor="0"]')
/** A native HTML5 drag from a handle onto a drop zone, through one DataTransfer (oms 658). */
async function drag(page, handle, zone) {
  await page.evaluate((h) => {
    window.__dt = new DataTransfer()
    document.querySelector(h).dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: window.__dt }))
  }, handle)
  await page.locator(`${zone}[data-drop-state]`).waitFor({ timeout: 5000 })
  const state = await page.locator(zone).getAttribute('data-drop-state')
  await page.evaluate((z) => {
    const el = document.querySelector(z)
    for (const type of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: window.__dt }))
  }, zone)
  await page.evaluate((h) => document.querySelector(h)?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt })), handle)
  return state
}
const checksOf = (page) => page.locator('[data-condition-root] [data-check], [data-condition-root] [data-group]').evaluateAll((els) => els.map((e) => (e.hasAttribute('data-group') ? `group:${e.getAttribute('data-mode')}@${e.getAttribute('data-group')}` : `${e.getAttribute('data-check')}@${e.getAttribute('data-block')}`)))
const noRawKeys = async (page) => !/insurance-(rules|guards):|editor\.|sentence\.|\bstate\.|severity\./.test(await page.locator('main').innerText())

const G007 = RULES.find((r) => r.id === 'G-007')
const NEXT_ID = `G-${String(Math.max(...RULES.map((r) => Number(r.id.slice(2)))) + 1).padStart(3, '0')}`

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, reads, store } = await open(dir)

  // ── 1: New guard ─────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards`)
  await page.locator('[data-new-guard]').waitFor({ timeout: 30000 })
  await page.locator('[data-new-guard]').click()
  await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 20000 })
  check(`${dir} 1. New guard opens /insurance-rules/guards/new`, new URL(page.url()).pathname === '/insurance-rules/guards/new', page.url())
  const header = page.locator('[data-editor-header]')
  check(`${dir} 1. the next free id, an ltr isolate; a draft`, (await header.locator('[data-rule-id] bdi[dir="ltr"]').innerText()) === NEXT_ID && (await header.locator('[data-state]').getAttribute('data-state')) === 'draft', NEXT_ID)
  check(`${dir} 1. no condition yet`, (await page.locator('[data-conditions-empty]').count()) === 1)

  // ── 5a: the checks pill on the empty rule ───────────────────────────────────────────────────
  await page.locator('[data-checks-pill]').click()
  await page.waitForFunction(() => document.querySelector('[data-checks-pill]')?.getAttribute('data-checks-pill') === 'errors', null, { timeout: 10000 }).catch(() => {})
  check(`${dir} 5. the pill counts HQ's errors`, (await page.locator('[data-checks-pill]').getAttribute('data-checks-pill')) === 'errors' && (await page.locator('[data-checks-pill] [data-errors]').getAttribute('data-errors')) === '5', await page.locator('[data-checks-pill]').innerText())
  check(`${dir} 5. one Validate of the draft on screen, the new rule in it`, reads.validate === 1 && store.validates[0]?.rules?.some((r) => r.id === NEXT_ID))
  const ruleIssues = await page.locator('[data-issues="rule"] [data-issue-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-issue-field')))
  check(`${dir} 5. rule issues pinned on the rule`, JSON.stringify(ruleIssues) === JSON.stringify(['name.en', 'name.ar', 'when']), JSON.stringify(ruleIssues))
  check(`${dir} 5. the name boxes are marked`, (await input(page, 'name.en').getAttribute('aria-invalid')) === 'true')
  check(`${dir} 5. an issue reads in the reader's language`, strip(await page.locator('[data-issues="rule"] [data-issue-field="when"]').innerText()) === 'The rule has no condition.', strip(await page.locator('[data-issues="rule"] [data-issue-field="when"]').innerText()))
  check(`${dir} 5. effect issues pinned on the effect and its message fields`, (await effect(page).locator('[data-issue-field="says.en"]').count()) === 1 && (await input(effect(page), 'says.ar').getAttribute('aria-invalid')) === 'true')

  // ── 2: build G-007 from the palette ─────────────────────────────────────────────────────────
  await input(page, 'name.en').fill(G007.name.en)
  await input(page, 'name.ar').fill(G007.name.ar)
  await add(page, '', 'group')
  await group(page, '0').waitFor()
  check(`${dir} 2. a group from the palette is All of, level 1`, (await group(page, '0').getAttribute('data-mode')) === 'all' && (await group(page, '0').getAttribute('data-level')) === '1')
  await add(page, '0', 'line')
  await block(page, '0.0').waitFor()
  // 4. the codes default from the first block
  check(`${dir} 4. codes default from the first block (line days supply)`, (await input(effect(page), 'conflict').inputValue()) === 'MX' && (await input(effect(page), 'nphies').inputValue()) === 'CV-4-2' && (await effect(page).locator('[data-codes-source]').getAttribute('data-codes-source')) === 'default')
  check(`${dir} 2. a typed field shows its unit`, strip(await block(page, '0.0').locator('label').last().innerText()).endsWith('days'), strip(await block(page, '0.0').locator('label').last().innerText()))
  await input(block(page, '0.0'), 'lineMode').selectOption('inList')
  await page.waitForFunction(() => document.querySelector('[data-block="0.0"] [data-input="inList"]'), null, { timeout: 5000 }).catch(() => {})
  check(`${dir} 2. line in list picks the first list, glp1`, (await input(block(page, '0.0'), 'inList').inputValue()) === 'glp1')
  check(`${dir} 4. the codes follow the first block (line in list → none)`, (await input(effect(page), 'conflict').inputValue()) === '' && (await input(effect(page), 'nphies').inputValue()) === '')
  await add(page, '0', 'formulary')
  await input(block(page, '0.1'), 'formulary').selectOption('listed')
  await page.locator('[data-not-toggle="0.1"]').click()
  check(`${dir} 2. NOT on a condition`, (await block(page, '0.1').getAttribute('data-not')) === 'true' && (await page.locator('[data-not-toggle="0.1"]').getAttribute('aria-pressed')) === 'true')
  await add(page, '0', 'group')
  await group(page, '0.2').waitFor()
  await group(page, '0.2').locator('[data-mode-pick="any"]').first().click()
  await page.locator('[data-not-toggle="0.2"]').click()
  check(`${dir} 2. a nested NOT Any of, level 2`, (await group(page, '0.2').getAttribute('data-mode')) === 'any' && (await group(page, '0.2').getAttribute('data-not')) === 'true' && (await group(page, '0.2').getAttribute('data-level')) === '2')
  await add(page, '0.2', 'patient')
  await input(block(page, '0.2.0'), 'inList').selectOption('PL-VIP')
  await add(page, '0.2', 'policy')
  await input(block(page, '0.2.1'), 'inList').selectOption('PO-EXT')

  // ── 3: a 4th level ──────────────────────────────────────────────────────────────────────────
  await add(page, '0.2', 'group')
  await group(page, '0.2.2').waitFor()
  check(`${dir} 3. a 3rd level is allowed`, (await group(page, '0.2.2').getAttribute('data-level')) === '3')
  const deepOpt = page.locator('select[data-add-condition="0.2.2"] option[value="group"]')
  check(`${dir} 3. a 4th level is offered disabled`, (await deepOpt.isDisabled()) && (await group(page, '0.2.2').locator('[data-too-deep]').count()) === 1)
  check(`${dir} 3. the 3rd level's palette still offers blocks`, !(await page.locator('select[data-add-condition="0.2.2"] option[value="line"]').isDisabled()))
  check(`${dir} 3. the top's palette still offers a group`, !(await page.locator('select[data-add-condition=""] option[value="group"]').isDisabled()))
  await page.locator('[data-remove="0.2.2"]').click()
  check(`${dir} 3. the 3rd-level group removed`, (await group(page, '0.2.2').count()) === 0)

  // ── THEN ────────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-on-unknown="warn"]').check()
  await effect(page).locator('[data-severity-pick="OVERRIDE"]').click()
  check(`${dir} 6. no {lastStore} chip`, (await effect(page).locator('[data-placeholder="lastStore"]').count()) === 0 && (await effect(page).locator('[data-placeholder="remaining"]').count()) === 2)
  const en = input(effect(page), 'says.en')
  await en.fill('GLP-1 ')
  await en.evaluate((el) => el.setSelectionRange(6, 6))
  await effect(page).locator('[data-placeholders="en"] [data-placeholder="count"]').click()
  check(`${dir} 6. a chip types {name} at the caret`, (await en.inputValue()) === 'GLP-1 {count}', await en.inputValue())
  await en.fill(G007.then[0].says.en)
  await input(effect(page), 'says.ar').fill(G007.then[0].says.ar)
  await input(effect(page), 'conflict').fill('DC')
  await input(effect(page), 'nphies').fill('CV-4-5')
  check(`${dir} 4. typed codes are the author's, not the default`, (await effect(page).locator('[data-codes-source]').getAttribute('data-codes-source')) === 'author' && (await effect(page).locator('[data-codes-reset]').count()) === 1)

  // ── 6: Undo / Redo ──────────────────────────────────────────────────────────────────────────
  await page.locator('[data-editor-then]').click({ position: { x: 5, y: 5 } }) // blur → seal the typing
  await page.locator('[data-undo]').click()
  check(`${dir} 6. Undo steps back the last edit (the NPHIES code)`, (await input(effect(page), 'nphies').inputValue()) === '' && (await input(effect(page), 'conflict').inputValue()) === 'DC', await input(effect(page), 'nphies').inputValue())
  await page.locator('[data-redo]').click()
  check(`${dir} 6. Redo steps it again`, (await input(effect(page), 'nphies').inputValue()) === 'CV-4-5')

  // ── 5b: all pass ────────────────────────────────────────────────────────────────────────────
  check(`${dir} 5. an edit marks the checks stale`, (await page.locator('[data-checks-pill]').getAttribute('data-checks-pill')) === 'stale')
  await page.locator('[data-checks-pill]').click()
  await page.waitForFunction(() => document.querySelector('[data-checks-pill]')?.getAttribute('data-checks-pill') === 'pass', null, { timeout: 10000 }).catch(() => {})
  check(`${dir} 5. all checks pass once fixed`, (await page.locator('[data-checks-pill]').getAttribute('data-checks-pill')) === 'pass' && (await page.locator('[data-issue]').count()) === 0)
  const readsAs = await page.locator('[data-reads-as] li').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-check')}:${e.getAttribute('data-not')}`))
  check(`${dir} 2. Reads as: the tree read as sentences`, JSON.stringify(readsAs) === JSON.stringify(['group:false', 'line:false', 'formulary:true', 'group:true', 'patient:false', 'policy:false']), JSON.stringify(readsAs))
  check(`${dir} 8. no raw keys in the editor`, await noRawKeys(page))

  // ── 7: Save ────────────────────────────────────────────────────────────────────────────────
  check(`${dir} 7. unsaved changes are flagged`, (await page.locator('[data-unsaved]').count()) === 1)
  await page.locator('[data-save]').click()
  await page.waitForFunction((id) => location.pathname.endsWith(`/guards/${id}/edit`), NEXT_ID, { timeout: 15000 }).catch(() => {})
  check(`${dir} 7. one PUT of the whole draft at revision 12`, store.puts.length === 1 && store.puts[0].revision === 12 && store.puts[0].rules.length === RULES.length + 1, `${store.puts.length} / ${store.puts[0]?.revision}`)
  const saved = store.puts[0]?.rules.find((r) => r.id === NEXT_ID)
  check(`${dir} 7. the saved conditions ARE G-007's`, saved && canon(saved.when) === canon(G007.when), canon(saved?.when))
  check(`${dir} 7. the policy-list block goes out as { check: "request", field: "policy", inList }`, canon(saved?.when?.[0]?.conditions?.[2]?.conditions?.[1]) === canon({ check: 'request', field: 'policy', inList: 'PO-EXT' }), canon(saved?.when?.[0]?.conditions?.[2]?.conditions?.[1]))
  // 618: HQ stores no `filters` — the line block names the ruleset list itself (`inList: "glp1"`).
  check(`${dir} 7. no filters on the wire; the line names G-007's list`, saved && !('filters' in saved) && saved.when?.[0]?.conditions?.[0]?.inList === 'glp1', canon(saved?.filters))
  check(
    `${dir} 7. its name, onUnknown and THEN are G-007's`,
    saved && canon(saved.name) === canon(G007.name) && saved.onUnknown === 'warn' && saved.then.length === 1 && saved.then[0].severity === 'OVERRIDE' && canon(saved.then[0].says) === canon(G007.then[0].says) && canon(saved.then[0].codes) === canon(G007.then[0].codes),
    canon(saved?.then),
  )
  check(`${dir} 7. the other rules go back as they were read`, store.puts[0] && canon(store.puts[0].rules.filter((r) => r.id !== NEXT_ID)) === canon(WIRE_RULESET.rules), canon(store.puts[0]?.rules.filter((r) => r.id !== NEXT_ID)).slice(0, 400))
  check(`${dir} 7. the page moves to the rule's edit URL`, new URL(page.url()).pathname === `/insurance-rules/guards/${NEXT_ID}/edit`, page.url())
  await page.waitForFunction(() => document.querySelector('[data-editor-header] h1')?.getAttribute('data-mode') === 'edit', null, { timeout: 10000 }).catch(() => {})
  check(`${dir} 7. the same editor carries on as the rule's editor`, (await page.locator('[data-editor-header] h1').getAttribute('data-mode')) === 'edit' && (await page.locator('[data-back]').getAttribute('href')) === `/insurance-rules/guards/${NEXT_ID}`)
  check(`${dir} 7. nothing unsaved; Save off`, (await page.locator('[data-unsaved]').count()) === 0 && (await page.locator('[data-save]').isDisabled()))
  check(`${dir} 7. the saved rule is on screen`, (await input(page, 'name.en').inputValue()) === G007.name.en && (await group(page, '0.2').getAttribute('data-not')) === 'true')

  // a stale revision: someone else saved since
  store.draft = { ...store.draft, revision: store.draft.revision + 1 }
  await input(page, 'name.en').fill(`${G007.name.en} (2)`)
  await page.locator('[data-save]').click()
  await page.locator('[data-reload]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 7. a stale revision says so and offers a reload`, store.puts.length === 2 && (await page.locator('[data-reload]').count()) === 1)
  await page.locator('[data-reload]').click()
  await page.waitForFunction(() => !document.querySelector('[data-reload]'), null, { timeout: 10000 }).catch(() => {})
  check(`${dir} 7. Reload takes HQ's draft`, (await input(page, 'name.en').inputValue()) === G007.name.en && (await page.locator('[data-unsaved]').count()) === 0)

  // Cancel: an edit, then Cancel goes back to the saved draft
  await input(page, 'name.en').fill('Scratch')
  await page.locator('[data-cancel]').click()
  check(`${dir} 6. Cancel goes back to the saved draft`, (await input(page, 'name.en').inputValue()) === G007.name.en && (await page.locator('[data-unsaved]').count()) === 0)

  check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // ── 9: WHEN, history narrowing, refill days per list (review 3126 P3/P4; stories 8, 11, 16) ────────
  {
    const { context, page, errors, store } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/guards/new`)
    await page.locator('[data-audience-editor]').waitFor({ timeout: 30000 })
    check(`${dir} 9. a new rule starts on every channel`, JSON.stringify(await page.locator('[data-audience-editor] [data-channel]').evaluateAll((els) => els.filter((e) => e.checked).map((e) => e.getAttribute('data-channel')))) === JSON.stringify(['nphies', 'waseel', 'oms', 'bupa']))
    await input(page, 'name.en').fill('Refill too soon, Bupa only')
    await input(page, 'name.ar').fill('صرف مبكر، بوبا فقط')
    await page.locator('[data-audience-editor] [data-channel="bupa"]').uncheck()
    await input(page, 'stores').fill('P001, P019')
    await page.locator('[data-exclude="patient"] [data-input="inList"]').selectOption('PL-VIP')
    await input(page, 'window.from').fill('2026-11-01')
    check(`${dir} 9. the excluded list shows as a chip, an ltr isolate`, (await page.locator('[data-exclude="patient"] [data-excluded="PL-VIP"] bdi[dir="ltr"]').count()) === 1)
    await add(page, '', 'history')
    await block(page, '0').waitFor()
    await block(page, '0').locator('[data-narrow="payer"]').check()
    await block(page, '0').locator('[data-narrow="store"]').check()
    await add(page, '', 'supply')
    await block(page, '1').waitFor()
    await block(page, '1').locator('[data-days-for-add]').click()
    await input(block(page, '1'), 'daysFor.0.value').fill('7')
    const readsAs = strip(await page.locator('[data-reads-as]').innerText())
    check(`${dir} 9. Reads as names the narrowing and the list's days`, dir === 'rtl' || (readsAs.includes('counting only dispenses with the same payer and store') && readsAs.includes('7 days for GLP-1')), readsAs)
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => /\/guards\/G-\d+\/edit$/.test(location.pathname), null, { timeout: 15000 }).catch(() => {})
    const saved = store.puts[0]?.rules.find((r) => r.name.en === 'Refill too soon, Bupa only')
    check(
      `${dir} 9. the saved WHEN: channels, stores, the excluded patient list, the window`,
      saved && canon(saved.audience) === canon({ channels: ['nphies', 'waseel', 'oms'], stores: ['P001', 'P019'], excludePatientLists: ['PL-VIP'] }) && canon(saved.window) === canon({ from: '2026-11-01', until: null }),
      canon({ a: saved?.audience, w: saved?.window }),
    )
    check(`${dir} 9. the saved history narrows to payer and store`, saved && canon(saved.when[0].narrowTo) === canon(['payer', 'store']), canon(saved?.when[0]))
    check(`${dir} 9. the saved supply carries the list's own days`, saved && canon(saved.when[1].eligibleDaysBeforeDueFor) === canon([{ list: 'glp1', value: 7 }]), canon(saved?.when[1]))
    check(`${dir} 9. no raw keys`, await noRawKeys(page))
    check(`${dir} 9. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 10: the ƒx helper on a formula block (oms 657) ───────────────────────────────────────────────
  {
    const { context, page, errors, store } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/guards/new`)
    await page.locator('[data-audience-editor]').waitFor({ timeout: 30000 })
    await input(page, 'name.en').fill('Child with a large quantity')
    await input(page, 'name.ar').fill('طفل بكمية كبيرة')
    await add(page, '', 'formula')
    await block(page, '0').waitFor()
    const box = block(page, '0').locator('[data-fx-input]')
    const fx = block(page, '0').locator('[data-fx-helper]')
    await block(page, '0').locator('[data-fx-toggle]').click()
    await fx.waitFor({ timeout: 5000 })
    check(`${dir} 10. ƒx opens the helper under the formula box`, (await block(page, '0').locator('[data-fx-toggle]').getAttribute('aria-expanded')) === 'true')
    const groups = await fx.locator('[data-fx-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-fx-group')))
    check(`${dir} 10. Fields grouped Patient / Request / Line / Eligibility`, JSON.stringify(groups) === JSON.stringify(['patient', 'request', 'line', 'eligibility']), JSON.stringify(groups))
    check(`${dir} 10. each field wears its type badge`, (await fx.locator('[data-fx-item="line.price"] [data-fx-type="money"]').count()) === 1 && (await fx.locator('[data-fx-item="eligibility.coverage.inForce"] [data-fx-type="bool"]').count()) === 1)
    check(`${dir} 10. no date path is offered (the engine reads dates in a block only)`, (await fx.locator('[data-fx-item="line.supplyEndsOn"], [data-fx-item="eligibility.coverage.periodEnd"]').count()) === 0)
    await fx.locator('[data-fx-item="patient.age"]').click()
    await fx.locator('[data-fx-op="<"]').click()
    await page.keyboard.type('12')
    check(`${dir} 10. a field and an operator go in at the caret`, (await box.inputValue()) === 'patient.age < 12', await box.inputValue())
    await fx.locator('[data-fx-op="and"]').click()
    await fx.locator('[data-fx-search]').fill('tob')
    await fx.locator('[data-fx-item="eligibility.tob[<code>]"]').click()
    const selected = await box.evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd))
    check(`${dir} 10. a keyed field leaves <code> selected`, (await box.inputValue()) === 'patient.age < 12 and eligibility.tob[<code>]' && selected === '<code>', `${await box.inputValue()} / ${selected}`)
    check(`${dir} 10. until its code is typed it does not read`, (await block(page, '0').locator('[data-fx-status="bad"]').count()) === 1 && (await box.getAttribute('aria-invalid')) === 'true')
    await page.keyboard.type('PH')
    await page.keyboard.press('End') // the caret is still inside the brackets: past them first
    await fx.locator('[data-fx-op=">"]').click()
    await page.keyboard.type('0')
    check(`${dir} 10. the code typed over it reads`, (await box.inputValue()) === 'patient.age < 12 and eligibility.tob[PH] > 0' && (await block(page, '0').locator('[data-fx-status="ok"]').count()) === 1, await box.inputValue())
    await fx.locator('[data-fx-tab="functions"]').click()
    check(`${dir} 10. Functions: the guard's (in, if, round …), none that needs an item filter`, (await fx.locator('[data-fx-function="in"]').count()) === 1 && (await fx.locator('[data-fx-function="sum"], [data-fx-function="items"], [data-fx-function="count"]').count()) === 0)
    await fx.locator('[data-fx-tab="recipes"]').click()
    await fx.locator('[data-fx-use="childQuantity"]').click()
    check(`${dir} 10. a recipe writes the whole formula`, (await box.inputValue()) === 'patient.age < 12 and line.quantity > 2', await box.inputValue())
    await fx.locator('[data-fx-done]').click()
    check(`${dir} 10. Done closes the helper`, (await block(page, '0').locator('[data-fx-helper]').count()) === 0)
    check(`${dir} 10. no raw keys`, await noRawKeys(page))
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => /\/guards\/G-\d+\/edit$/.test(location.pathname), null, { timeout: 15000 }).catch(() => {})
    const saved = store.puts[0]?.rules.find((r) => r.name.en === 'Child with a large quantity')
    check(
      `${dir} 10. the formula is stored as the engine's expr`,
      saved && canon(saved.when) === canon([{ check: 'formula', expr: ['and', ['<', '$patient.age', 12], ['>', '$line.quantity', 2]] }]),
      canon(saved?.when),
    )
    check(`${dir} 10. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 11: rearranging the tree (oms 658) ──────────────────────────────────────────────────────────
  {
    const { context, page, errors, store } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/guards/new`)
    await page.locator('[data-audience-editor]').waitFor({ timeout: 30000 })
    await input(page, 'name.en').fill('Rearranged tree')
    await input(page, 'name.ar').fill('شجرة معاد ترتيبها')
    await add(page, '', 'line')
    await add(page, '', 'formulary')
    await add(page, '', 'patient')
    await input(block(page, '2'), 'inList').selectOption('PL-VIP')
    check(`${dir} 11. three top-level conditions`, JSON.stringify(await checksOf(page)) === JSON.stringify(['line@0', 'formulary@1', 'patient@2']), JSON.stringify(await checksOf(page)))
    await page.locator('[data-select-mode]').click()
    await page.locator('[data-select-condition="0"]').check()
    await page.locator('[data-select-condition="1"]').check()
    check(`${dir} 11. the toolbar counts the selection`, (await page.locator('[data-selected-count]').getAttribute('data-selected-count')) === '2')
    await page.locator('[data-group-selected="any"]').click()
    check(`${dir} 11. Group as Any of wraps the two selected`, JSON.stringify(await checksOf(page)) === JSON.stringify(['group:any@0', 'line@0.0', 'formulary@0.1', 'patient@1']), JSON.stringify(await checksOf(page)))
    // A group dropped into itself is refused, and nothing moves.
    const self = await drag(page, '[data-drag-handle="0"]', '[data-drop="0@1"]')
    check(`${dir} 11. a group dropped into itself is refused`, self === 'refused' && JSON.stringify(await checksOf(page)) === JSON.stringify(['group:any@0', 'line@0.0', 'formulary@0.1', 'patient@1']), self)
    const into = await drag(page, '[data-drag-handle="1"]', '[data-drop="0@2"]')
    check(`${dir} 11. a third condition dragged into the group`, into === 'allowed' && JSON.stringify(await checksOf(page)) === JSON.stringify(['group:any@0', 'line@0.0', 'formulary@0.1', 'patient@0.2']), `${into} ${JSON.stringify(await checksOf(page))}`)
    await page.locator('[data-tools="0.0"]').selectOption('out')
    check(`${dir} 11. Move out of the group puts it after the group`, JSON.stringify(await checksOf(page)) === JSON.stringify(['group:any@0', 'formulary@0.0', 'patient@0.1', 'line@1']), JSON.stringify(await checksOf(page)))
    await page.locator('[data-undo]').click()
    check(`${dir} 11. Undo takes the move back`, JSON.stringify(await checksOf(page)) === JSON.stringify(['group:any@0', 'line@0.0', 'formulary@0.1', 'patient@0.2']), JSON.stringify(await checksOf(page)))
    await page.locator('[data-redo]').click()
    await page.locator('[data-not-toggle="0"]').click()
    const negated = await page.locator('[data-tools="0"] option[value="ungroup"]').isDisabled()
    await page.locator('[data-not-toggle="0"]').click()
    check(`${dir} 11. a NOT group cannot be ungrouped`, negated)
    await page.locator('[data-tools="0"]').selectOption('ungroup')
    check(`${dir} 11. Ungroup puts its conditions in its place`, JSON.stringify(await checksOf(page)) === JSON.stringify(['formulary@0', 'patient@1', 'line@2']), JSON.stringify(await checksOf(page)))
    check(`${dir} 11. no raw keys`, await noRawKeys(page))
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => /\/guards\/G-\d+\/edit$/.test(location.pathname), null, { timeout: 15000 }).catch(() => {})
    const saved = store.puts[0]?.rules.find((r) => r.name.en === 'Rearranged tree')
    check(
      `${dir} 11. the saved when is the rearranged tree`,
      saved && canon(saved.when) === canon([{ check: 'formulary', indication: 'notListed' }, { check: 'patient', inList: 'PL-VIP' }, { check: 'line', field: 'daysSupply', above: 90 }]),
      canon(saved?.when),
    )
    check(`${dir} 11. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
