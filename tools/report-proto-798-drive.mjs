// PROTOTYPE drive — wayfinder ticket 798 (map 793). Drives /analytics/prototype/report in Chromium against stubbed
// shell envelopes (Auth/Me + empty access probes); the prototype itself is in-memory. Never point it at a real host.
//
//   1. npx vite --port 5198 --strictPort
//   2. DRIVE_PORT=5198 SHOTS=<dir> node tools/report-proto-798-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5198}`
const SHOTS = process.env.SHOTS || 'C:/Playground/oms-react/.issues/assets/798-shots'
mkdirSync(SHOTS, { recursive: true })
const RAW = /\bproto798\.[a-zA-Z.]+/

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }) })

const browser = await chromium.launch()
async function open(dir, path) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'false')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    return route.fulfill(envelope(p.endsWith('/Access') ? {} : null))
  })
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 })
  // The lazy route compiles on its first visit: wait for the page, not a clock.
  await page.waitForSelector('[data-proto-designer], [data-proto-runner], [data-proto-413]', { timeout: 120000 })
  await page.waitForTimeout(400)
  return { context, page, errors }
}
const noRaw = async (page, name) => {
  const body = await page.locator('body').innerText()
  const m = body.match(RAW)
  check(`${name}: no raw keys`, !m, m?.[0])
}

for (const dir of ['ltr', 'rtl']) {
  // The three designers on the acceptance case.
  for (const v of ['A', 'B', 'C']) {
    const { context, page, errors } = await open(dir, `/analytics/prototype/report?variant=${v}&scenario=design`)
    check(`${dir} ${v}: designer mounts`, (await page.locator(`[data-proto-designer="${v}"]`).count()) === 1)
    if (v !== 'C') check(`${dir} ${v}: four panels drawn`, (await page.locator('[data-proto-panel]').count()) === 4)
    if (v === 'C') check(`${dir} C: binding matrix`, (await page.locator('[data-proto-matrix] tbody tr').count()) === 9)
    await noRaw(page, `${dir} ${v}`)
    await page.screenshot({ path: `${SHOTS}/${v}-design-${dir}.png`, fullPage: true })
    check(`${dir} ${v}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // Each author moment, in the variant that shows it best (and A for every one).
  for (const [v, sc] of [
    ['A', 'declare'],
    ['B', 'declare'],
    ['A', 'panel'],
    ['B', 'panel'],
    ['C', 'panel'],
    ['A', 'text'],
    ['C', 'text'],
    ['A', 'share'],
    ['A', 'refused'],
  ]) {
    const { context, page, errors } = await open(dir, `/analytics/prototype/report?variant=${v}&scenario=${sc}`)
    if (sc === 'declare') check(`${dir} ${v} declare: bindings pre-filled`, (await page.locator('[data-proto-bindings="region"] [data-proto-binding]').count()) === 4)
    if (sc === 'panel') check(`${dir} ${v} panel: two named series`, (await page.locator('[data-proto-series-row]').count()) === 2)
    if (sc === 'text') check(`${dir} ${v} text: live figures filled`, (await page.locator('[data-proto-text-editor] [data-proto-figure]').count()) >= 4)
    if (sc === 'share') check(`${dir} share: dialog open`, (await page.locator('[data-proto-share]').count()) === 1)
    if (sc === 'refused') {
      check(`${dir} refused: 411 shown`, (await page.locator('[data-proto-refused]').innerText()).includes('ANALYTICS-411'))
      check(`${dir} refused: missing figure marked`, (await page.locator('[data-proto-figure-missing]').count()) >= 2)
    }
    await noRaw(page, `${dir} ${v} ${sc}`)
    await page.screenshot({ path: `${SHOTS}/${v}-${sc}-${dir}.png`, fullPage: true })
    check(`${dir} ${v} ${sc}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // The runner.
  {
    const { context, page, errors } = await open(dir, `/analytics/prototype/report?scenario=run`)
    check(`${dir} run: no edit control`, (await page.locator('[data-proto-save], [data-proto-edit-param], [data-proto-add-param], [data-proto-share-open]').count()) === 0)
    const strip = page.locator('[data-proto-strip]')
    check(`${dir} run: all seven kinds in the strip`, (await strip.locator('[data-proto-param], [data-testid^="proto-param-"]').count()) >= 9)
    const before = await page.locator('[data-proto-panel="p2"]').innerText()
    await page.locator('[data-proto-param="period"]').selectOption('last-7-days')
    await page.waitForTimeout(300)
    const after = await page.locator('[data-proto-panel="p2"]').innerText()
    check(`${dir} run: changing the period re-runs`, before !== after)
    await page.locator('[data-proto-param="cancel-above"] select').selectOption('gt')
    await page.waitForTimeout(300)
    check(`${dir} run: threshold shown on the store table`, /5/.test(await page.locator('[data-proto-panel="p4"] figcaption').innerText()))
    check(`${dir} run: channel says it does not reach p2/p3`, (await page.locator('[data-proto-panel="p3"] [data-proto-not-reached]').count()) === 1)
    await page.locator('[data-proto-copy-link]').click()
    check(`${dir} run: permalink carries values`, /period=last-7-days/.test(await page.locator('body').innerText()))
    await noRaw(page, `${dir} run`)
    await page.screenshot({ path: `${SHOTS}/run-${dir}.png`, fullPage: true })
    check(`${dir} run: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  for (const sc of ['run-fallback', 'not-shared']) {
    const { context, page, errors } = await open(dir, `/analytics/prototype/report?scenario=${sc}`)
    if (sc === 'run-fallback') {
      check(`${dir} fallback notice`, (await page.locator('[data-proto-fallback]').count()) === 1)
      check(`${dir} summary unavailable`, (await page.locator('[data-proto-summary="unavailable"]').count()) === 1)
    } else check(`${dir} 413 page`, (await page.locator('[data-proto-413]').innerText()).includes('ANALYTICS-413'))
    await noRaw(page, `${dir} ${sc}`)
    await page.screenshot({ path: `${SHOTS}/${sc}-${dir}.png`, fullPage: true })
    check(`${dir} ${sc}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// An author adds a threshold parameter end to end in B, then saves.
{
  const { context, page, errors } = await open('ltr', `/analytics/prototype/report?variant=B&scenario=design`)
  await page.locator('[data-proto-add-param]').first().click()
  await page.locator('[data-proto-kind-picker] button', { hasText: 'Top N' }).click()
  await page.locator('[data-proto-param-name]').fill('top-cities')
  await page.locator('[data-proto-add-draft]').click()
  check('B add: parameter joins the strip', (await page.locator('[data-proto-strip] [data-proto-param="top-cities"]').count()) === 1)
  await page.locator('[data-proto-save]').click()
  check('B add: saves as revision 4', /4/.test(await page.locator('[role="status"]').first().innerText()))
  await page.locator('[data-proto-add-param]').first().click()
  await page.locator('[data-proto-param-name]').fill('tv')
  check('B add: reserved name refused before add', await page.locator('[data-proto-add-draft]').isDisabled())
  check('B add: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// Owner round 2: a section can be removed everywhere, and undo / redo bring it back.
{
  const { context, page, errors } = await open('ltr', `/analytics/prototype/report?variant=B&scenario=design`)
  const sections = () => page.locator('article [data-proto-section]').count()
  check('B: four sections to start', (await sections()) === 4)
  await page.locator('[data-proto-outline-remove="s2"]').click()
  check('B: outline removes a section', (await sections()) === 3)
  check('B: notice offers undo', (await page.locator('[data-proto-notice]').innerText()).includes('HungerStation against QC'))
  await page.locator('[data-proto-notice-undo]').click()
  check('B: undo brings it back', (await sections()) === 4 && (await page.locator('[data-proto-panel="p3"]').count()) === 1)
  await page.locator('[data-proto-outline-remove="s1"]').click()
  await page.locator('body').click({ position: { x: 5, y: 500 } })
  await page.keyboard.press('Control+z')
  check('B: Ctrl+Z undoes', (await sections()) === 4)
  await page.keyboard.press('Control+y')
  check('B: Ctrl+Y redoes', (await sections()) === 3)
  await page.locator('[data-proto-outline="section:s3"]').click()
  await page.locator('[data-proto-remove-section="s3"]').click()
  check('B: the section inspector removes too', (await sections()) === 2)
  check('B round 2: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open('ltr', `/analytics/prototype/report?variant=A&scenario=design`)
  await page.locator('[data-proto-section="s4"] button[aria-label^="Edit"]').first().click()
  await page.locator('[data-proto-remove-section="s4"]').click()
  check('A: sheet removes a section', (await page.locator('article [data-proto-section]').count()) === 3)
  await page.locator('[data-proto-undo]').click()
  check('A: undo button brings it back', (await page.locator('article [data-proto-section]').count()) === 4)
  check('A round 2: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// The tutorial: steps tick themselves; loading the finished report + saving ticks all ten.
for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors } = await open(dir, `/analytics/prototype/report?variant=A&scenario=tutorial`)
  const doneCount = () => page.locator('[data-proto-tutorial="floating"] [data-proto-tutorial-step][data-done="yes"]').count()
  check(`${dir} tutorial: starts at 0`, (await doneCount()) === 0)
  await page.locator('[data-proto-designer] input[lang="en"]').first().fill('Channel sales')
  await page.locator('[data-proto-designer] article button', { hasText: /Section|قسم/ }).last().click()
  check(`${dir} tutorial: the guide rides inside the open sheet`, (await page.locator('[data-proto-tutorial="inline"]').count()) === 1)
  check(`${dir} tutorial: title + section tick`, (await doneCount()) === 2)
  await page.screenshot({ path: `${SHOTS}/A-tutorial-${dir}.png`, fullPage: false })
  await page.keyboard.press('Escape')
  await page.locator('[data-proto-tutorial-load]').click()
  await page.locator('[data-proto-save]').click()
  check(`${dir} tutorial: finished report ticks all ten`, (await doneCount()) === 10 && (await page.locator('[data-proto-tutorial="floating"] [data-proto-tutorial-done]').count()) === 1)
  await noRaw(page, `${dir} tutorial`)
  await page.screenshot({ path: `${SHOTS}/A-tutorial-done-${dir}.png`, fullPage: false })
  check(`${dir} tutorial: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}
for (const v of ['B', 'C']) {
  const { context, page, errors } = await open('ltr', `/analytics/prototype/report?variant=${v}&scenario=tutorial`)
  await page.screenshot({ path: `${SHOTS}/${v}-tutorial-ltr.png`, fullPage: false })
  check(`${v} tutorial: mounts`, (await page.locator('[data-proto-tutorial]').count()) === 1 && errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
