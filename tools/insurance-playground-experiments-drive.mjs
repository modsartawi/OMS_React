// Insurance rules ▸ Playground ▸ experiments drive (BackOffice spec 3243 stories 49, 50; oms ticket 687).
//
// No door: experiments are kept in browser storage and travel as a versioned `.json` file. Evaluate is stubbed as in
// the 677 drive (`tools/insurance-rules-stubs.mjs`, section 677) so the page runs. It verifies, in LTR and RTL:
//   1. save: no name → said in words; name + save → "saved", the name is in the saved list;
//   2. reload → the page opens seeded; Open restores the saved rule and name, and the auto-run sends it;
//   3. rename and delete by name;
//   4. a Raw experiment exports as `<name>.json` (format + version 1, the raw text as it is); after a reload,
//      importing the downloaded file brings back the Raw tab, its text and the name, and sends `raw`;
//   5. a newer-version file and a malformed file are refused in words and nothing is loaded;
//   6. storage off (every access throws): the page still runs, the save controls say storage is off, export works;
//   7. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5387 --strictPort
//   2. node tools/insurance-playground-experiments-drive.mjs        (DRIVE_PORT overrides 5387)
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5387}`
const URL_ = `${BASE}/insurance-rules/playground`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
const tmp = await mkdtemp(join(tmpdir(), 'pg687-'))

async function open(dir, { storageOff = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newPlaygroundStore()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(
    ({ d, off }) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
      if (off) {
        // Blocked site data for the playground's keys: every read and write throws, as in a locked-down browser.
        const deny = (k) => String(k).startsWith('oms.insurance-playground')
        for (const m of ['getItem', 'setItem', 'removeItem']) {
          const real = Storage.prototype[m]
          Storage.prototype[m] = function (k, ...rest) {
            if (deny(k)) throw new DOMException('The operation is insecure.', 'SecurityError')
            return real.call(this, k, ...rest)
          }
        }
      }
    },
    { d: dir, off: storageOff },
  )
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
    const hit = playgroundStub(req.method(), p, body, { store }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit).catch(() => {})
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|access|experiments)\.\w/.test(await page.locator('main').innerText())
const docBox = (page) => page.locator('textarea[data-json-box="document"]')
const rawBox = (page) => page.locator('textarea[data-raw-box]')
const tab = (page, k) => page.locator(`[data-pane="data"] [data-data-tab="${k}"]`)
const nameBox = (page) => page.locator('[data-experiment-name]')
const said = async (page) => page.locator('[data-experiment-said]').getAttribute('data-experiment-said').catch(() => null)
const savedNames = (page) => page.locator('[data-experiment-saved] option').evaluateAll((os) => os.filter((o) => o.value).map((o) => o.value))
const goto = async (page, store) => {
  const before = store.evaluates.length
  await page.goto(URL_)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  for (let i = 0; i < 50 && store.evaluates.length === before; i++) await sleep(100)
  await page.locator('[data-outcome-line="1"]').first().waitFor({ timeout: 10000 }).catch(() => {})
}
/** Wait for the auto-run that the last action started; the body it sent (or null). */
const nextSent = async (store, before) => {
  for (let i = 0; i < 40 && store.evaluates.length === before; i++) await sleep(100)
  await sleep(300)
  return store.evaluates.length > before ? store.evaluates.at(-1) : null
}
const docWith = async (page, above) => {
  const d = JSON.parse(await docBox(page).inputValue())
  d.rules[0].when[0].above = above
  return JSON.stringify(d, null, 2)
}

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, store } = await open(dir)
    await goto(page, store)
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 0. the bar is there and storage is on`, (await page.locator('[data-experiment-bar][data-storage="on"]').count()) === 1)

    // 1. save (a command disabled with a reason stays focusable and says why; Playwright needs force for aria-disabled)
    check(`${dir} 1. save without a name is disabled with its reason`, (await page.locator('[data-experiment-save]').getAttribute('title')) === 'Name the experiment first.')
    await page.locator('[data-experiment-save]').click({ force: true })
    check(`${dir} 1. save with no name is said in words`, (await said(page)) === 'noName' && strip(await page.locator('[data-experiment-said]').innerText()) === 'Name the experiment first.')
    await docBox(page).fill(await docWith(page, 200))
    await nameBox(page).fill('Long supply')
    await page.locator('[data-experiment-save]').click()
    check(`${dir} 1. saved`, (await said(page)) === 'saved' && strip(await page.locator('[data-experiment-said]').innerText()) === 'Saved as Long supply.', strip(await page.locator('[data-experiment-said]').innerText()))
    check(`${dir} 1. the name is in the saved list`, JSON.stringify(await savedNames(page)) === '["Long supply"]')

    // 2. reload, open
    await goto(page, store)
    const seeded = JSON.parse(await docBox(page).inputValue()).rules[0].when[0].above
    check(`${dir} 2. after a reload the page opens seeded`, seeded === 90 && (await nameBox(page).inputValue()) === '', String(seeded))
    check(`${dir} 2. the saved experiment survived the reload`, JSON.stringify(await savedNames(page)) === '["Long supply"]')
    let before = store.evaluates.length
    await page.locator('[data-experiment-open]').click()
    const sentOpen = await nextSent(store, before)
    check(`${dir} 2. open restores the rule and the name`, JSON.parse(await docBox(page).inputValue()).rules[0].when[0].above === 200 && (await nameBox(page).inputValue()) === 'Long supply')
    check(`${dir} 2. and the opened experiment runs`, sentOpen?.document?.rules?.[0]?.when?.[0]?.above === 200 && 'data' in (sentOpen ?? {}), JSON.stringify(sentOpen?.document))
    check(`${dir} 2. said opened`, (await said(page)) === 'opened')

    // 3. rename, delete
    await nameBox(page).fill('Renamed')
    await page.locator('[data-experiment-rename]').click()
    check(`${dir} 3. renamed by name`, (await said(page)) === 'renamed' && JSON.stringify(await savedNames(page)) === '["Renamed"]')
    await page.locator('[data-experiment-delete]').click()
    check(`${dir} 3. deleted by name`, (await said(page)) === 'deleted' && JSON.stringify(await savedNames(page)) === '[]')
    check(`${dir} 3. an empty list says so`, strip(await page.locator('[data-experiment-saved]').innerText()) === 'No saved experiments')

    // 4. a Raw experiment: export, reload, import
    const RAW = '{"lines":[{"qty":2}'
    await tab(page, 'raw').click()
    await rawBox(page).fill(RAW)
    await nameBox(page).fill('Raw / near miss')
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-experiment-export]').click()])
    check(`${dir} 4. exported as <name>.json`, download.suggestedFilename() === 'Raw - near miss.json', download.suggestedFilename())
    const path = join(tmp, `${dir}-raw.json`)
    await download.saveAs(path)
    const fileText = await readFile(path, 'utf8')
    let parsed = null
    try {
      parsed = JSON.parse(fileText)
    } catch {
      parsed = null
    }
    check(`${dir} 4. the file is format + version 1 with the raw text as it is`, parsed?.format === 'oms.insurance-playground.experiment' && parsed?.version === 1 && parsed?.raw === RAW && !('data' in parsed) && parsed?.kind === 'guard', fileText.slice(0, 200))

    await goto(page, store)
    check(`${dir} 4. after a reload the page is on JSON`, (await tab(page, 'json').getAttribute('aria-selected')) === 'true')
    before = store.evaluates.length
    await page.locator('[data-experiment-file]').setInputFiles(path)
    const sentImport = await nextSent(store, before)
    check(`${dir} 4. import brings back Raw, its text and the name`, (await tab(page, 'raw').getAttribute('aria-selected')) === 'true' && (await rawBox(page).inputValue()) === RAW && (await nameBox(page).inputValue()) === 'Raw / near miss')
    check(`${dir} 4. and sends raw`, sentImport?.raw === RAW && !('data' in (sentImport ?? {})), JSON.stringify(sentImport))
    check(`${dir} 4. said imported`, (await said(page)) === 'imported')

    // 5. refusals: nothing is loaded
    const newer = join(tmp, `${dir}-newer.json`)
    await writeFile(newer, JSON.stringify({ ...parsed, version: 2, raw: 'NEWER' }))
    await page.locator('[data-experiment-file]').setInputFiles(newer)
    await page.locator('[data-import-refused]').waitFor({ timeout: 5000 }).catch(() => {})
    const banner = strip(await page.locator('[data-experiment-bar] [role="alert"]').innerText().catch(() => ''))
    check(`${dir} 5. a newer file is refused in words`, (await page.locator('[data-import-refused="newerVersion"]').count()) === 1 && banner.includes('The file was made by a newer playground. Nothing was loaded.'), banner)
    check(`${dir} 5. and nothing was loaded`, (await rawBox(page).inputValue()) === RAW)
    const bad = join(tmp, `${dir}-bad.json`)
    await writeFile(bad, '{ "format": "oms.insurance-playground.experiment", ')
    await page.locator('[data-experiment-file]').setInputFiles(bad)
    await sleep(300)
    check(`${dir} 5. a malformed file is refused with its own words`, (await page.locator('[data-import-refused="malformed"]').count()) === 1 && (await rawBox(page).inputValue()) === RAW)

    check(`${dir} 7. no raw keys`, await noRawKeys(page))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 6. storage off
  {
    const { context, page, errors, store } = await open(dir, { storageOff: true })
    await goto(page, store)
    check(`${dir} 6. storage off: the page still runs`, (await page.locator('[data-outcome-line="1"]').count()) >= 1)
    check(`${dir} 6. the save controls say storage is off`, (await page.locator('[data-experiment-bar][data-storage="off"]').count()) === 1 && strip(await page.locator('[data-storage-off]').innerText()).startsWith('Storage is off in this browser'))
    await nameBox(page).fill('Kept nowhere')
    await page.locator('[data-experiment-save]').click({ force: true })
    check(`${dir} 6. save says off and throws nothing`, (await said(page)) === 'off')
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-experiment-export]').click()])
    check(`${dir} 6. export still works`, download.suggestedFilename() === 'Kept nowhere.json')
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
