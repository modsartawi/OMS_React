// Insurance pattern manager drive (oms 924; BackOffice spec 4050, doors 4055 + 4056) — drives the REAL app in Chromium
// against MOCKED envelopes: 922's shared pattern doors (`./insurance-patterns-stubs.mjs`) chained with this slice's own
// (`./insurance-patterns-manager-stubs.mjs`). BackOffice 4055/4056 are not built, so every shape is the guessed contract.
//
// Proves, on the running app: the manager's two nav leaves show only with the manager grant, and both pages say "no
// access" without it; the settings page reads the seven thresholds with their ranges, says a change applies from the
// next run, refuses an out-of-range value ON THE PAGE (no PUT is made), sends only what changed, and lists the change
// log; the reveal log pages, filters (period, user, case) and links to the case, and never shows an identity — not even
// the one a careless server planted in every row; the block action is hidden unless the case is confirmed AND both
// grants are held, asks for the kind of finding, refuses a start after the end, posts the right body, keeps nothing of
// the answer, and its reveal-log row appears; and the Arabic, right-to-left layout (screenshots to SHOT_DIR).
//
//   1. run the app:  npx vite --port 5232 --strictPort
//   2. DRIVE_PORT=5232 SHOT_DIR=<dir> node tools/insurance-patterns-manager-drive.mjs
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { permissions } from './permissions-stub.mjs'
import { CLEARED_CASE, envelope, generatedCase, KEYS, patternsDoors, patternsState, TRAVEL_CASE } from './insurance-patterns-stubs.mjs'
import { managerDoors, managerState, PLANTED } from './insurance-patterns-manager-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOT_DIR = process.env.SHOT_DIR || '.'
const SETTINGS = BASE + '/insurance/patterns/settings'
const REVEALS = BASE + '/insurance/patterns/reveals'
const CASE = (id) => `${BASE}/insurance/patterns/${id}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const planted = (text) => text.includes(PLANTED.patientKey) || text.includes(PLANTED.memberId) || text.includes(PLANTED.patientKey.slice(3))

async function run() {
  // A loaded machine (parallel worktrees driving their own browsers) can take minutes to start Chromium.
  const browser = await chromium.launch({ timeout: 600000 })
  const errors = []

  /** A page signed in with `keys`, 922's doors and this slice's chained over `patterns` and `mine`. */
  const open = async (patterns, mine, { keys = [KEYS.manager], dir = 'ltr' } = {}) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultNavigationTimeout(90000)
    page.setDefaultTimeout(60000)
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await page.addInitScript((d) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    }, dir)
    const doors = [patternsDoors(patterns), managerDoors(patterns, mine)]
    await page.route(`${BASE}/api/**`, async (route) => {
      const req = route.request()
      const path = decodeURIComponent(new URL(req.url()).pathname.split('/api/')[1])
      if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
      if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
      return route.fulfill(doors.reduce((answer, door) => answer ?? door(req), null) ?? envelope({}))
    })
    return page
  }
  const waitUntil = async (fn, ms = 8000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (fn()) return true
      await new Promise((r) => setTimeout(r, 50))
    }
    return fn()
  }
  /**
   * Waits until an element's text, its bidi isolates stripped, includes `text`. An interpolated value is wrapped in
   * FSI…PDI (`.claude/rules/bidi.md`), which a `text=` selector does not strip.
   */
  const waitText = (page, selector, text, timeout = 30000) =>
    page.waitForFunction(
      ([sel, want]) => [...document.querySelectorAll(sel)].some((e) => (e.textContent ?? '').replace(/[⁦-⁩]/g, '').includes(want)),
      [selector, text],
      { timeout },
    )
  const lastReveals = (mine) => mine.calls.reveals.at(-1)?.query ?? {}
  const field = (name) => `[data-testid=pattern-setting][data-setting=${name}]`
  const fieldBox = (page, name) => page.locator(`div:has(> ${field(name)})`)
  const navHas = (page, href) => page.locator(`nav a[href="${href}"]`).count().then((n) => n > 0)

  // ── 1. The nav and the gates: the manager's two leaves and pages need the manager grant ────────────────────────────
  for (const [label, keys] of [
    ['the analyst alone', [KEYS.analyst]],
    ['the investigator and the block grant', [KEYS.analyst, KEYS.investigator, KEYS.block]],
  ]) {
    const patterns = patternsState()
    const mine = managerState()
    const page = await open(patterns, mine, { keys })
    await page.goto(SETTINGS)
    await page.waitForSelector('text=No access to pattern settings')
    check(`without the manager grant (${label}): settings say "no access"`, true)
    check(`…(${label}): the nav carries neither manager leaf`, !(await navHas(page, '/insurance/patterns/settings')) && !(await navHas(page, '/insurance/patterns/reveals')))
    await page.goto(REVEALS)
    await page.waitForSelector('text=No access to the reveal log')
    check(`…(${label}): the reveal log says "no access" too`, true)
    check(`…(${label}): no manager door was asked`, mine.calls.settingsGet === 0 && mine.calls.reveals.length === 0, JSON.stringify(mine.calls))
    await page.close()
  }
  {
    const page = await open(patternsState(), managerState(), { keys: [KEYS.manager] })
    await page.goto(SETTINGS)
    await page.waitForSelector('[data-testid=pattern-settings-form]')
    check('the manager grant: the nav carries Pattern settings and Reveal log', (await navHas(page, '/insurance/patterns/settings')) && (await navHas(page, '/insurance/patterns/reveals')))
    check('…and not the cases leaf, which is the analyst’s', !(await navHas(page, '/insurance/patterns')))
    await page.close()
  }

  // ── 2. The settings: read, the next-run copy, the ranges, the change log ─────────────────────────────────────────────
  let patterns = patternsState()
  let mine = managerState()
  let page = await open(patterns, mine)
  await page.goto(SETTINGS)
  await page.waitForSelector('[data-testid=pattern-settings-form]')
  const values = await page.locator('[data-testid=pattern-setting]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-setting'), e.value]))
  check('the seven thresholds open on the saved values, in the table’s order', same(values, [['WindowDays', '7'], ['MinStores', '3'], ['MaxKmPerHour', '120'], ['MinTravelKm', '50'], ['OverlapShare', '0.25'], ['CaseQuietDays', '30'], ['LookbackDays', '90']]), JSON.stringify(values))
  const ranges = (await page.locator('[data-testid=pattern-setting-range]').allTextContents()).map(strip)
  check('each shows the range it is checked against', same(ranges, ['Allowed: 1–30', 'Allowed: 2–10', 'Allowed: 30–500', 'Allowed: 1–500', 'Allowed: 0.05–0.9', 'Allowed: 7–90', 'Allowed: 30–365']), JSON.stringify(ranges))
  const nextRun = strip(await page.textContent('[data-testid=pattern-settings-next-run]'))
  check('the page says a change applies from the next run, and closed cases are never re-scored', nextRun.includes('A change applies from the next run') && nextRun.includes('never re-scored'), nextRun)
  const logRows = (await page.locator('[data-testid=pattern-settings-change]').allTextContents()).map(strip)
  check('the change log lists who changed what, from what to what, newest first', logRows.length === 2 && ['Pharmacies for hopping', '4', '3', 'manager2', '2026-11-10 14:05'].every((w) => logRows[0].includes(w)) && logRows[1].includes('Window (days)'), JSON.stringify(logRows))
  check('the save is held while nothing changed, its reason in its title', (await page.getAttribute('[data-testid=pattern-settings-save]', 'aria-disabled')) === 'true' && (await page.getAttribute('[data-testid=pattern-settings-save]', 'title')) === 'Nothing has changed.')

  // ── 3. An out-of-range value is refused on the page: no PUT is made ──────────────────────────────────────────────────
  await page.fill(field('WindowDays'), '31')
  await waitText(page, '[data-testid=pattern-settings-form]', 'Out of range: allowed 1–30.')
  check('WindowDays 31 says it is out of range as it is typed', strip(await fieldBox(page, 'WindowDays').textContent()).includes('Out of range: allowed 1–30.'))
  check('…the save is held, saying why', (await page.getAttribute('[data-testid=pattern-settings-save]', 'aria-disabled')) === 'true' && (await page.getAttribute('[data-testid=pattern-settings-save]', 'title')) === 'Fix the values marked first.')
  await page.click('[data-testid=pattern-settings-save]', { force: true })
  await page.waitForTimeout(500)
  check('…and pressing Save anyway makes NO PUT', mine.calls.settingsPut.length === 0, JSON.stringify(mine.calls.settingsPut))
  await page.fill(field('WindowDays'), '10')
  await page.fill(field('MinStores'), '1')
  await page.fill(field('OverlapShare'), '0.91')
  await waitText(page, '[data-testid=pattern-settings-form]', 'Out of range: allowed 0.05–0.9.')
  check('MinStores 1 (below 2) and OverlapShare 0.91 (above 0.9) are refused beside a valid change', strip(await fieldBox(page, 'MinStores').textContent()).includes('Out of range: allowed 2–10.'))
  await page.click('[data-testid=pattern-settings-save]', { force: true })
  await page.waitForTimeout(500)
  check('…one value out of range holds the whole save: still no PUT', mine.calls.settingsPut.length === 0)
  await page.fill(field('LookbackDays'), '90.5')
  await page.waitForSelector('text=Enter a whole number.')
  check('a fraction where days are counted asks for a whole number', true)
  await page.fill(field('LookbackDays'), '90')
  await page.fill(field('MinStores'), '3')
  await page.fill(field('OverlapShare'), '0.3')

  // ── 4. A save sends only what changed, and the log grows ─────────────────────────────────────────────────────────────
  await waitText(page, '[data-testid=pattern-settings-changed]', '2 thresholds changed')
  check('the page counts what changed and shows each one’s saved value', strip(await fieldBox(page, 'WindowDays').textContent()).includes('Saved value: 7'))
  await page.click('[data-testid=pattern-settings-save]')
  await page.waitForSelector('[data-sonner-toast]:has-text("Settings saved")')
  check('one PUT, carrying only the two changed thresholds as numbers — and no actor', mine.calls.settingsPut.length === 1 && same(mine.calls.settingsPut[0].body, { settings: [{ name: 'WindowDays', value: 10 }, { name: 'OverlapShare', value: 0.3 }] }), JSON.stringify(mine.calls.settingsPut))
  check('…with the X-Web-Client header', !!mine.calls.settingsPut[0]?.csrf)
  check('the toast says they apply from the next run', strip(await page.textContent('[data-sonner-toast]')).includes('They apply from the next run.'))
  await page.waitForFunction(() => document.querySelector('[data-setting=WindowDays]')?.getAttribute('data-changed') === 'false')
  check('the fields now read the saved values, nothing marked changed', (await page.inputValue(field('WindowDays'))) === '10' && (await page.inputValue(field('OverlapShare'))) === '0.3')
  const grown = (await page.locator('[data-testid=pattern-settings-change]').allTextContents()).map(strip)
  check('the change log shows the save at the top: both changes, by the session’s user', grown.length === 4 && grown.slice(0, 2).every((r) => r.includes('msartawi')) && grown.some((r) => r.includes('Supply still left (share)') && r.includes('0.25') && r.includes('0.3')), JSON.stringify(grown))

  // ── 5. A refused save: the server's sentence, and the draft stays; Discard goes back ─────────────────────────────────
  mine.settingsRefusal = { code: 'SETTINGS_LOCKED', message: 'The nightly job is running; try again once it ends.' }
  await page.fill(field('LookbackDays'), '120')
  await page.click('[data-testid=pattern-settings-save]')
  await page.waitForSelector('text=The nightly job is running; try again once it ends.')
  check('a refused save shows the server’s sentence under "The settings were not saved"', strip(await page.textContent('[data-testid=pattern-settings-form]')).includes('The settings were not saved'))
  check('…and keeps the draft', (await page.inputValue(field('LookbackDays'))) === '120')
  await page.click('[data-testid=pattern-settings-discard]')
  check('Discard changes puts the saved value back and holds the save', (await page.inputValue(field('LookbackDays'))) === '90' && (await page.getAttribute('[data-testid=pattern-settings-save]', 'aria-disabled')) === 'true')
  mine.settingsRefusal = null
  await page.close()

  // ── 6. The reveal log: newest first, paged, links to the case, NO identity ───────────────────────────────────────────
  patterns = patternsState()
  mine = managerState()
  page = await open(patterns, mine, { keys: [KEYS.manager, KEYS.analyst] })
  await page.goto(REVEALS)
  await page.waitForSelector('[data-testid=reveals-table]')
  check('the opening read asks page 1 of 25, no filter', same(lastReveals(mine), { skip: '0', take: '25' }), JSON.stringify(lastReveals(mine)))
  check('…with the X-Web-Client header', !!mine.calls.reveals[0]?.csrf)
  check('the caption counts every reveal', strip(await page.textContent('[data-testid=reveals-count]')) === '31 reveals')
  const heads = (await page.locator('[data-testid=reveals-table] th').allTextContents()).map(strip)
  check('four columns — when, case, who, why — and no identity column', same(heads, ['When', 'Case', 'Revealed by', 'Reason']), JSON.stringify(heads))
  check('the identity the server planted in every row is nowhere on the page', !planted(strip(await page.textContent('body'))))
  const rows = page.locator('[data-testid=reveals-row]')
  check('25 rows on page 1', (await rows.count()) === 25)
  const first = strip(await rows.nth(0).textContent())
  check('newest first: the first row reads its time, case, user and reason', ['2026-11-19 17:00', 'PC-000123', 'investigator1', 'Payer BUPA asked for the patient on this case.'].every((w) => first.includes(w)), first)
  check('an Arabic reason reads as written', strip(await page.textContent('[data-testid=reveals-table]')).includes('المطالبة من الجهة الدافعة تتطلب التحقق من هوية المريض.'))
  check('each case links to its screen', (await page.getAttribute('[data-testid=reveals-row-case] >> nth=0', 'href')) === `/insurance/patterns/${TRAVEL_CASE.caseId}`)
  await page.click('nav[aria-label="Result pages"] button:has-text("Next")')
  await waitUntil(() => lastReveals(mine).skip === '25')
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=reveals-row]').length === 6)
  check('Next asks skip=25 and shows the last 6', lastReveals(mine).skip === '25')

  // ── 7. The filters: user, period, case — each sent under the door's name, kept in the address ───────────────────────
  await page.fill('[data-testid=reveals-filter-user]', 'investigator2')
  await waitUntil(() => lastReveals(mine).user === 'investigator2')
  check('a user typed is sent as user once typing stops, back on page 1', lastReveals(mine).user === 'investigator2' && lastReveals(mine).skip === '0', JSON.stringify(lastReveals(mine)))
  await page.waitForFunction(() => new URL(location.href).search === '?user=investigator2')
  const byUser = await page.locator('[data-testid=reveals-row] td:nth-child(3)').allTextContents()
  check('…and every row is theirs', byUser.length > 0 && byUser.every((u) => strip(u) === 'investigator2'), JSON.stringify(byUser))
  await page.fill('[data-testid=reveals-filter-user]', '')
  await waitUntil(() => lastReveals(mine).user === undefined)
  const before = mine.calls.reveals.length
  await page.fill('[data-testid=reveals-filter-from]', '2026-11-18')
  await page.fill('[data-testid=reveals-filter-to]', '2026-11-10')
  await page.waitForSelector('text=The period ends before it starts.')
  await page.waitForTimeout(400)
  check('a period that ends before it starts is refused on the page, and never asked for', !mine.calls.reveals.slice(before).some((c) => c.query.from === '2026-11-18' && c.query.to === '2026-11-10'))
  await page.fill('[data-testid=reveals-filter-from]', '2026-11-10')
  await page.fill('[data-testid=reveals-filter-to]', '2026-11-18')
  await waitUntil(() => lastReveals(mine).from === '2026-11-10' && lastReveals(mine).to === '2026-11-18')
  check('a period is sent as from and to', same(lastReveals(mine), { from: '2026-11-10', to: '2026-11-18', skip: '0', take: '25' }), JSON.stringify(lastReveals(mine)))
  await page.click('[data-testid=reveals-filter-clear]')
  await page.waitForFunction(() => new URL(location.href).search === '')
  await page.waitForSelector('[data-testid=reveals-row-only-case]')
  await page.locator('[data-testid=reveals-row]', { hasText: 'PC-000123' }).first().locator('[data-testid=reveals-row-only-case]').click()
  await waitUntil(() => lastReveals(mine).caseId === TRAVEL_CASE.caseId)
  check('"Only this case" asks caseId and keeps it in the address', lastReveals(mine).caseId === TRAVEL_CASE.caseId && new URL(page.url()).searchParams.get('case') === TRAVEL_CASE.caseId)
  await waitText(page, '[data-testid=reveals-filter-case]', 'Case PC-000123')
  const caseCells = await page.locator('[data-testid=reveals-row-case]').allTextContents()
  check('…the filter names the case by number, and every row is that case', caseCells.length > 0 && caseCells.every((c) => strip(c) === 'PC-000123'), JSON.stringify(caseCells))
  await page.click('[data-testid=reveals-filter-case]')
  await waitUntil(() => lastReveals(mine).caseId === undefined && mine.calls.reveals.length > 0)
  check('the case filter clears with one press', (await page.locator('[data-testid=reveals-filter-case]').count()) === 0)
  await page.goto(REVEALS + `?case=${CLEARED_CASE.caseId}&page=1`)
  await waitUntil(() => lastReveals(mine).caseId === CLEARED_CASE.caseId)
  check('a pasted address is read back as the case filter', lastReveals(mine).caseId === CLEARED_CASE.caseId)
  await page.click('[data-testid=reveals-row-case] >> nth=0')
  await page.waitForURL(`**/insurance/patterns/${CLEARED_CASE.caseId}`)
  await page.waitForSelector('[data-testid=pattern-case]')
  check('a case number opens the case’s screen', strip(await page.textContent('[data-testid=pattern-case-number]')).includes('PC-000099'))
  await page.close()

  // ── 8. The block action: only on a confirmed case, only with BOTH grants ────────────────────────────────────────────
  const OPEN_CASE = generatedCase(1)
  const blockScenario = () => {
    const p = patternsState()
    p.details.get(TRAVEL_CASE.caseId).status = 'confirmed'
    return p
  }
  for (const [label, keys, caseId, offered] of [
    ['confirmed, investigator + block grant', [KEYS.analyst, KEYS.investigator, KEYS.block], TRAVEL_CASE.caseId, true],
    ['confirmed, investigator without the block grant', [KEYS.analyst, KEYS.investigator], TRAVEL_CASE.caseId, false],
    ['confirmed, block grant without the investigator', [KEYS.analyst, KEYS.block], TRAVEL_CASE.caseId, false],
    ['confirmed, the manager and the block grant', [KEYS.analyst, KEYS.manager, KEYS.block], TRAVEL_CASE.caseId, false],
    ['open, both grants', [KEYS.analyst, KEYS.investigator, KEYS.block], OPEN_CASE.caseId, false],
    ['cleared, both grants', [KEYS.analyst, KEYS.investigator, KEYS.block], CLEARED_CASE.caseId, false],
  ]) {
    const p = blockScenario()
    const pg = await open(p, managerState(), { keys })
    await pg.goto(CASE(caseId))
    // Attached, not visible: with nothing offered the actions' place is empty (no size). The case renders only once the
    // permissions answer is in (its gate), so by then the action is decided.
    await pg.waitForSelector('[data-testid=pattern-case-actions]', { state: 'attached' })
    const shown = (await pg.locator('[data-testid=pattern-block-open]').count()) === 1
    check(`the block action is ${offered ? 'offered' : 'hidden'}: ${label}`, shown === offered)
    await pg.close()
  }

  patterns = blockScenario()
  mine = managerState()
  page = await open(patterns, mine, { keys: [KEYS.analyst, KEYS.investigator, KEYS.block, KEYS.manager] })
  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.click('[data-testid=pattern-block-open]')
  await page.waitForSelector('[data-testid=pattern-block-dialog]')
  const said = strip(await page.textContent('[data-testid=pattern-block-dialog]'))
  check('the dialog says what happens: the case’s patient, every store and payer, the reference and the reveal log', said.includes('The patient of case PC-000123 is added to the blocked-patient list.') && said.includes('under every payer') && said.includes('reference names case PC-000123') && said.includes('written to the reveal log'), said)
  check('Confirm is held until a kind of finding is chosen, saying why', (await page.getAttribute('[data-testid=pattern-block-confirm]', 'aria-disabled')) === 'true' && (await page.getAttribute('[data-testid=pattern-block-confirm]', 'title')) === 'Choose the kind of finding: abuse or fraud.')
  await page.click('[data-testid=pattern-block-confirm]', { force: true })
  await page.waitForSelector('[data-testid=pattern-block-dialog] >> text=Choose the kind of finding: abuse or fraud.')
  await page.waitForTimeout(300)
  check('confirming with no kind says so, and posts nothing', mine.calls.blocks.length === 0)
  await page.selectOption('[data-testid=pattern-block-kind]', 'fraud')
  await page.fill('[data-testid=pattern-block-starts]', '2027-06-01')
  await page.fill('[data-testid=pattern-block-ends]', '2027-05-19')
  await page.waitForSelector('text=The start is after the end.')
  await page.click('[data-testid=pattern-block-confirm]', { force: true })
  await page.waitForTimeout(300)
  check('a start after the end is refused in the dialog, and nothing is posted', mine.calls.blocks.length === 0)
  await page.fill('[data-testid=pattern-block-starts]', '')
  await page.fill('[data-testid=pattern-block-ends]', '2026-01-01')
  await page.waitForSelector('text=The end cannot be before today.')
  check('an end before today is refused too', mine.calls.blocks.length === 0)
  await page.fill('[data-testid=pattern-block-ends]', '2027-05-19')
  await page.fill('[data-testid=pattern-block-payer]', '  BUPA ')
  await page.click('[data-testid=pattern-block-confirm]')
  await page.waitForSelector('[data-sonner-toast]:has-text("Added to the blocked-patient list")')
  check('the block posts the kind, the payer trimmed and the end — no start given, no patient, no actor', mine.calls.blocks.length === 1 && mine.calls.blocks[0].caseId === TRAVEL_CASE.caseId && same(mine.calls.blocks[0].body, { reasonKind: 'fraud', payer: 'BUPA', endsOn: '2027-05-19' }), JSON.stringify(mine.calls.blocks))
  check('…with the X-Web-Client header', !!mine.calls.blocks[0]?.csrf)
  check('…the dialog closes, and the toast names the case', (await page.locator('[data-testid=pattern-block-dialog]').count()) === 0 && strip(await page.textContent('[data-sonner-toast]')).includes('PC-000123'))
  check('the patient key the answer echoed is nowhere on the page', !planted(strip(await page.textContent('body'))))
  await page.goto(REVEALS)
  await page.waitForSelector('[data-testid=reveals-table]')
  const top = strip(await page.textContent('[data-testid=reveals-row] >> nth=0'))
  check('the block’s own reveal-log row is at the top: the case, the session’s user, "block"', ['PC-000123', 'msartawi', 'block'].every((w) => top.includes(w)), top)
  await page.goto(CASE(TRAVEL_CASE.caseId))
  mine.blockRefusal = { code: 'CASE_NOT_CONFIRMED', message: 'Only a confirmed case can add its patient to the blocked-patient list.' }
  await page.click('[data-testid=pattern-block-open]')
  await page.selectOption('[data-testid=pattern-block-kind]', 'abuse')
  await page.click('[data-testid=pattern-block-confirm]')
  await page.waitForSelector('[data-testid=pattern-block-dialog] >> text=Only a confirmed case can add its patient to the blocked-patient list.')
  check('a refused block shows the server’s sentence under "The patient was not added", in the dialog', strip(await page.textContent('[data-testid=pattern-block-dialog]')).includes('The patient was not added'))
  check('…and the dialog stays open with its choice', (await page.inputValue('[data-testid=pattern-block-kind]')) === 'abuse')
  mine.blockRefusal = null
  await page.close()

  // ── 9. RTL, in Arabic words ─────────────────────────────────────────────────────────────────────────────────────────
  // `oms.locale=ar` flips the direction at boot; the app's `lng` stays `en` until Arabic is switched on (core/i18n), so
  // the drive switches the SAME i18next instance the app uses to Arabic, as 922's drive does.
  const toArabic = (p) => p.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  const rawKey = /(settings|revealLog|block)\.[a-zA-Z]+/
  patterns = blockScenario()
  mine = managerState()
  page = await open(patterns, mine, { keys: [KEYS.analyst, KEYS.investigator, KEYS.block, KEYS.manager], dir: 'rtl' })
  await page.goto(SETTINGS)
  await page.waitForSelector('[data-testid=pattern-settings-form]')
  await toArabic(page)
  await page.waitForSelector('text=إعدادات الأنماط')
  check('RTL: the document is dir=rtl', (await page.getAttribute('html', 'dir')) === 'rtl')
  const settingsText = strip(await page.textContent('main'))
  check('RTL: the settings read in Arabic, the next-run copy too, no raw key', settingsText.includes('يسري التغيير من التشغيل التالي') && settingsText.includes('النافذة (أيام)') && !rawKey.test(settingsText), settingsText.slice(0, 300))
  check('RTL: a range keeps its order in Latin digits', strip(await page.textContent('[data-testid=pattern-setting-range] >> nth=0')) === 'المسموح: 1–30')
  const boxes = await page.locator('[data-testid=pattern-settings-form] > div:first-child > div').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().x))
  check('RTL: the thresholds read right to left (the window first, at the right)', boxes[0] > boxes[1], JSON.stringify(boxes))
  await page.fill(field('WindowDays'), '31')
  await waitText(page, '[data-testid=pattern-settings-form]', 'خارج النطاق: المسموح 1–30.')
  check('RTL: an out-of-range value is refused in Arabic words', true)
  await page.click('[data-testid=pattern-settings-save]', { force: true })
  await page.waitForTimeout(400)
  check('RTL: …and still makes no PUT', mine.calls.settingsPut.length === 0)
  await page.screenshot({ path: join(SHOT_DIR, '924-pattern-settings-rtl-ar.png'), fullPage: true })

  await page.goto(REVEALS)
  await page.waitForSelector('[data-testid=reveals-table]')
  await toArabic(page)
  await page.waitForSelector('text=سجل الكشف')
  const revealText = strip(await page.textContent('main'))
  check('RTL: the reveal log reads in Arabic, its count too, no raw key', strip(await page.textContent('[data-testid=reveals-count]')) === '31 عملية كشف' && !rawKey.test(revealText), strip(await page.textContent('[data-testid=reveals-count]')))
  const arHeads = (await page.locator('[data-testid=reveals-table] th').allTextContents()).map(strip)
  check('RTL: still four columns and no identity column', same(arHeads, ['الوقت', 'الحالة', 'كشفه', 'السبب']), JSON.stringify(arHeads))
  const cols = await page.locator('[data-testid=reveals-table] th').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the first column (when) is rightmost', cols[0] > cols[1] && cols[1] > cols[2], JSON.stringify(cols))
  const filterBoxes = await page.locator('[data-testid=reveals-filters] > *').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the filters read right to left (from first)', filterBoxes[0] > filterBoxes[1], JSON.stringify(filterBoxes))
  check('RTL: a time keeps its order', strip(await page.textContent('[data-testid=reveals-row] td >> nth=0')) === '2026-11-19 17:00')
  check('RTL: no planted identity in Arabic either', !planted(strip(await page.textContent('body'))))
  await page.screenshot({ path: join(SHOT_DIR, '924-reveal-log-rtl-ar.png'), fullPage: true })

  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.waitForSelector('[data-testid=pattern-block-open]')
  await toArabic(page)
  await page.waitForSelector('text=إضافة إلى قائمة المرضى المحظورين')
  await page.click('[data-testid=pattern-block-open]')
  await page.waitForSelector('[data-testid=pattern-block-dialog]')
  const dialogText = strip(await page.textContent('dialog'))
  check('RTL: the block dialog reads in Arabic, the case number kept whole', dialogText.includes('إضافة المريض إلى قائمة المرضى المحظورين') && dialogText.includes('يضاف مريض الحالة PC-000123') && !rawKey.test(dialogText), dialogText.slice(0, 300))
  const dateBoxes = await page.locator('[data-testid=pattern-block-dialog] input[type=date]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the start stands right of the end', dateBoxes[0] > dateBoxes[1], JSON.stringify(dateBoxes))
  await page.screenshot({ path: join(SHOT_DIR, '924-block-dialog-rtl-ar.png') })
  await page.close()

  check('no page errors', errors.length === 0, errors.join(' | '))
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
