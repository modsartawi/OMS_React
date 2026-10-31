// Insurance rules ▸ Decision inspector + the back-test window cap (BackOffice spec 3271, door 3298; oms ticket 710).
// Drives the REAL app against STUBS on the real envelope (`tools/fhir-rules-stubs-710.mjs`); nothing live.
//
// It verifies, in LTR and RTL:
//   1. a Review row opens its decision;
//   2. an old decision with no kept copy explains itself: rule, version, each fact state in words, the replay;
//   3. Show message says not found and the typed values still stand; match and differs each read, kept and re-fetched;
//   4. nothing of a message reaches browser storage, and showing it again is a new read of the door;
//   5. a bare 403 on the decision or on the message reads "no access"; on the message the facts stay;
//   6. the back-test offers only windows inside the limit, a deep link past it starts at the capped window, and with
//      no window or an unreadable limit nothing can start;
//   7. no raw keys and no page errors.
//
//   1. npx vite --port 5220 --strictPort
//   2. DRIVE_PORT=5220 node tools/insurance-fhir-710-drive.mjs
import { createRequire } from 'node:module'
import { createReviewStubs, envelope, insuranceRulesStub, newBacktestStore, simulatorStub } from './insurance-rules-stubs.mjs'
import { inspectorStub, SYNTHETIC_MARKER, windowLimitStub } from './fhir-rules-stubs-710.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5220}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [], limit = 180 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const store = newBacktestStore()
  const review = createReviewStubs({})
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
    const hit =
      inspectorStub(req.method(), p, { deny, reads }) ??
      windowLimitStub(req.method(), p, limit) ??
      review(req.method(), p, body, url.searchParams) ??
      simulatorStub(req.method(), p, body, { store }) ??
      insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(inspector|rules|simulator):|\b(message|fact|replay|summary|open|backtest)\.[a-z]/.test(await page.locator('main').innerText())
const go = async (page, path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
}
const showMessage = async (page) => {
  await page.locator('[data-message-show]').click()
  await page.locator('[data-message-check]').waitFor({ timeout: 5000 }).catch(() => {})
}
const checkWord = (page) => page.locator('[data-message-check]').getAttribute('data-message-check').catch(() => null)
// `lng` stays `en` (core/i18n): RTL is the direction, and the Arabic bundle is proved by the i18n test.
const W = { same: 'Same as decided', unknown: 'Unknown', unparsed: 'Unparsed', no: 'No', notFound: 'typed values above still stand', purged: 'purged', match: 'matches the hash', differs: 'differs from the hash', kept: 'kept copy', refetched: 'Re-fetched' }

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, reads } = await open(dir)
  try {
    // 1. from the Review list
    await go(page, '/insurance-rules/review')
    await page.locator('[data-inspect="D-9001"]').waitFor({ timeout: 60000 })
    check(`${dir} 1. a review row links to its decision`, (await page.locator('[data-inspect="D-9001"]').getAttribute('href')) === '/insurance-rules/decisions/D-9001')

    // 2. an old decision, no kept copy
    await go(page, '/insurance-rules/decisions/DEC-OLD')
    await page.locator('[data-decision="DEC-OLD"]').waitFor({ timeout: 30000 })
    check(`${dir} 2. page direction`, (await page.locator('html').getAttribute('dir')) === dir)
    check(`${dir} 2. its rule, isolated`, strip(await page.locator('[data-summary="rule"] bdi[dir="ltr"]').first().innerText()) === 'G-007')
    check(`${dir} 2. its version, isolated`, strip(await page.locator('[data-summary="version"] bdi[dir="ltr"]').innerText()) === '4')
    check(`${dir} 2. the patient key never shows whole`, strip(await page.locator('[data-summary="patient"] bdi').innerText()) === '1*******83')
    const fact = (k) => page.locator(`[data-fact="${k}"] [data-col="value"]`)
    check(`${dir} 2. a fact's key and path are shown`, (await page.locator('[data-fact="claim.total"]').innerText()).includes('Claim.total.value'))
    check(`${dir} 2. zero is a value, ltr`, strip(await fact('claim.total').locator('bdi[dir="ltr"]').innerText()) === '0')
    check(`${dir} 2. false is a word`, strip(await fact('claim.preAuth').innerText()) === W.no)
    check(`${dir} 2. free text in a dir-auto bdi`, (await fact('patient.name').locator('bdi:not([dir])').count()) === 1)
    check(`${dir} 2. unknown reads in words`, strip(await fact('coverage.class').innerText()).includes(W.unknown))
    check(`${dir} 2. unparsed reads in words`, strip(await fact('claim.created').innerText()).includes(W.unparsed))
    check(`${dir} 2. the replay reads same`, (await page.locator('[data-replay="same"]').innerText()).includes(W.same))
    check(`${dir} 2. the page says the copy is purged and the values explain it`, (await page.locator('[data-message-kept="purged"]').innerText()).includes(W.purged))
    check(`${dir} 2. the hash on record is shown`, strip(await page.locator('[data-message-hash] bdi').innerText()) === '9f2c41aa07de5b13')

    // 3a. not found
    await showMessage(page)
    check(`${dir} 3. not found reads`, (await checkWord(page)) === 'notFound' && (await page.locator('[data-message-check]').innerText()).includes(W.notFound))
    check(`${dir} 3. not found shows no message`, (await page.locator('[data-message-body]').count()) === 0)
    check(`${dir} 3. not found: the typed values are still on the page`, (await page.locator('[data-fact]').count()) === 5)

    // 3b. re-fetched and matches
    await go(page, '/insurance-rules/decisions/DEC-MATCH')
    await page.locator('[data-decision="DEC-MATCH"]').waitFor({ timeout: 30000 })
    await showMessage(page)
    let said = await page.locator('[data-message-check]').innerText()
    check(`${dir} 3. re-fetch + match says both`, (await checkWord(page)) === 'refetched.match' && said.includes(W.refetched) && said.includes(W.match), said)
    check(`${dir} 3. the message is shown, ltr`, (await page.locator('[data-message-body]').getAttribute('dir')) === 'ltr' && (await page.locator('[data-message-body]').innerText()).includes(SYNTHETIC_MARKER))

    // 4. never stored; Hide then Show is a new read
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
    check(`${dir} 4. nothing of the message in browser storage`, !stored.includes(SYNTHETIC_MARKER))
    const idb = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0))
    check(`${dir} 4. no IndexedDB`, idb === 0)
    await page.locator('[data-message-hide]').click()
    await page.locator('[data-message-body]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    check(`${dir} 4. Hide takes the message off the page`, (await page.locator('[data-message-body]').count()) === 0)
    await showMessage(page)
    check(`${dir} 4. showing it again is a new read of the door`, reads['DEC-MATCH'] === 2, JSON.stringify(reads))

    // 3c. re-fetched and differs; the replay differing too
    await go(page, '/insurance-rules/decisions/DEC-DIFF')
    await page.locator('[data-decision="DEC-DIFF"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. a replay that differs reads so`, (await page.locator('[data-replay="different"]').count()) === 1)
    await showMessage(page)
    said = await page.locator('[data-message-check]').innerText()
    check(`${dir} 3. re-fetch + differs says both`, (await checkWord(page)) === 'refetched.differs' && said.includes(W.refetched) && said.includes(W.differs), said)
    check(`${dir} 3. differs shows the copy's hash`, strip(await page.locator('[data-message-found-hash] bdi').innerText()) === '00aa77bb11cc22dd')

    // 3d. from the kept copy
    await go(page, '/insurance-rules/decisions/DEC-KEPT')
    await page.locator('[data-decision="DEC-KEPT"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. the page says a copy is held`, (await page.locator('[data-message-kept="kept"]').count()) === 1)
    await showMessage(page)
    said = await page.locator('[data-message-check]').innerText()
    check(`${dir} 3. kept + match says both`, (await checkWord(page)) === 'kept.match' && said.includes(W.kept) && said.includes(W.match), said)

    // 3e. no replay, no facts
    await go(page, '/insurance-rules/decisions/DEC-NOREPLAY')
    await page.locator('[data-decision="DEC-NOREPLAY"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. no replay and no facts each say so`, (await page.locator('[data-replay="none"]').count()) === 1 && (await page.locator('[data-facts-none]').count()) === 1)

    // Opening by id, and an id that is not there
    await go(page, '/insurance-rules/decisions')
    await page.locator('[data-inspector-id]').waitFor({ timeout: 30000 })
    await page.locator('[data-inspector-id]').fill('DEC-OLD')
    await page.locator('[data-inspector-go]').click()
    await page.locator('[data-decision="DEC-OLD"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 3. opens a decision by its id`, new URL(page.url()).pathname === '/insurance-rules/decisions/DEC-OLD' && (await page.locator('[data-decision="DEC-OLD"]').count()) === 1)
    check(`${dir} 7. no raw keys on the inspector`, await noRawKeys(page))
    if (process.env.DRIVE_SHOTS) await page.screenshot({ path: `${process.env.DRIVE_SHOTS}/${dir}-inspector.png`, fullPage: true })
    await go(page, '/insurance-rules/decisions/NOPE')
    await page.getByText('No such decision.').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 3. a missing decision shows the server's words`, (await page.getByText('No such decision.').count()) === 1)

    // 6. full limit: every window, no note; the start body asks the picked window
    await go(page, '/insurance-rules/simulator?tab=backtest')
    await page.locator('[data-days="180"]').waitFor({ timeout: 30000 })
    check(`${dir} 6. a limit of 180 offers all three, no note`, (await page.locator('[data-days]').count()) === 3 && (await page.locator('[data-backtest-capped]').count()) === 0)
    check(`${dir} 7. no raw keys on the back-test`, await noRawKeys(page))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
  } catch (e) {
    check(`${dir} the drive ran through`, false, String(e))
  } finally {
    await context.close()
  }

  // 5. no grant on the decision
  {
    const s = await open(dir, { deny: ['decision'] })
    await go(s.page, '/insurance-rules/decisions/DEC-OLD')
    await s.page.locator('[data-inspector-denied]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 5. a bare 403 on the decision reads no access`, (await s.page.locator('[data-inspector-denied]').count()) === 1)
    await s.context.close()
  }
  // 5. no grant on the message: the facts stay
  {
    const s = await open(dir, { deny: ['message'] })
    await go(s.page, '/insurance-rules/decisions/DEC-OLD')
    await s.page.locator('[data-decision="DEC-OLD"]').waitFor({ timeout: 30000 })
    await s.page.locator('[data-message-show]').click()
    await s.page.locator('[data-message-denied]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 5. a bare 403 on the message reads no access, the facts stay`, (await s.page.locator('[data-message-denied]').count()) === 1 && (await s.page.locator('[data-fact]').count()) === 5)
    await s.context.close()
  }
  // 6. limit 120 with a deep link to 180
  {
    const s = await open(dir, { limit: 120 })
    await go(s.page, '/insurance-rules/simulator?tab=backtest&days=180')
    await s.page.locator('[data-days="90"]').waitFor({ timeout: 30000 })
    const offered = await s.page.locator('[data-days]').evaluateAll((els) => els.map((e) => e.getAttribute('data-days')))
    check(`${dir} 6. a limit of 120 never offers 180`, JSON.stringify(offered) === '["30","90"]', JSON.stringify(offered))
    check(`${dir} 6. the deep link falls to the longest offered`, (await s.page.locator('[data-days="90"]').getAttribute('aria-pressed')) === 'true')
    check(`${dir} 6. the page says why, with the limit`, (await s.page.locator('[data-backtest-capped="120"] bdi').count()) === 0 && (await s.page.locator('[data-backtest-capped="120"]').innerText()).includes('120'))
    await s.page.locator('[data-start-backtest]').click()
    await s.page.locator('[data-backtest-running]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. the start asks for the capped window`, JSON.stringify(s.store.starts) === '[{"days":90}]', JSON.stringify(s.store.starts))
    await s.context.close()
  }
  // 6. limit below every window, then unreadable, then denied: nothing can start
  for (const [limit, name] of [[15, 'a limit under every window'], ['fail', 'an unreadable limit']]) {
    const s = await open(dir, { limit })
    await go(s.page, '/insurance-rules/simulator?tab=backtest')
    await s.page.locator('[data-backtest-start]').waitFor({ timeout: 30000 })
    if (limit === 'fail') await s.page.getByText('Settings are unreadable.').waitFor({ timeout: 5000 }).catch(() => {})
    else await s.page.locator('[data-backtest-capped="15"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. ${name}: no window, no start`, (await s.page.locator('[data-days]').count()) === 0 && (await s.page.locator('[data-start-backtest]').isDisabled()))
    if (limit === 'fail') check(`${dir} 6. ${name} says the server's words`, (await s.page.getByText('Settings are unreadable.').count()) === 1)
    else check(`${dir} 6. ${name} says why`, (await s.page.locator('[data-backtest-capped="15"]').count()) === 1)
    await s.context.close()
  }
  {
    const s = await open(dir, { limit: 'deny' })
    await go(s.page, '/insurance-rules/simulator?tab=backtest')
    await s.page.locator('[data-backtest-denied]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the limit reads no access`, (await s.page.locator('[data-backtest-denied]').count()) === 1)
    await s.context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
