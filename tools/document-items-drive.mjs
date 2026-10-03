// Items-grid + tab-count drive (ticket 093, spec 083 D-9) — drives the REAL app
// in Chromium and serves the five captured payloads from
// `.issues/assets/078-document-payloads/` as the `SdDocumentWeb/Document/{no}`
// response, exactly as `tools/document-cards-drive.mjs` does. The app is not
// stubbed, only the wire is.
//
// Asserts the ticket's Done-when:
//   1. the items grid opens with Description as its FIRST column;
//   2. a pinned totals row reads `1 line · 1 unit` and the four column sums;
//   3. `-1.50` renders in amber WITH ITS SIGN on 2000000551, and a zero discount
//      elsewhere is not flagged;
//   4. a deleted line renders muted and struck through;
//   5. clicking a row selects it and paints the leading accent bar;
//   6. the tabs count their rows in the neutral pill; a FAILED job is no longer a
//      Jobs tab count but a banner at the top of the activity spine (ticket 403).
//
// Two of those cannot be driven from the corpus verbatim and say so at their
// call site: no captured line is `deleted`, and Log/Jobs come from endpoints the
// captures do not include. Both are synthesised from a real payload — the
// mutation is the fixture, the rule under test is the app's.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-items-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

/** Outbox rows per document — the spine's two states, healthy and failed. */
const OUTBOX = {
  // Three jobs, one failed: the spine draws ONE banner.
  '2000000551': [
    { outboxId: '1', actionTypeDescription: 'Create', outboxStatus: 'S', attemptCount: 1 },
    { outboxId: '2', actionTypeDescription: 'Update', outboxStatus: 'F', attemptCount: 4 },
    { outboxId: '3', actionTypeDescription: 'Notify', outboxStatus: 'S', attemptCount: 1 },
  ],
  // Two jobs, none failed: the count must read the total.
  '8000000121': [
    { outboxId: '1', actionTypeDescription: 'Create', outboxStatus: 'S', attemptCount: 1 },
    { outboxId: '2', actionTypeDescription: 'Update', outboxStatus: 'S', attemptCount: 1 },
  ],
}

async function run() {
  const browser = await chromium.launch()
  // 1920 wide: since 403 the activity spine shares the row with the summary rail and the
  // tabs, and AG Grid only renders the columns in view, so at 1600 the last columns this
  // drive reads are virtualised away. 404 turns the end side into one facts column.
  const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  let currentDoc = ''
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    // Ticket 125 put the OMS screens behind SdDocumentWeb/Access; the detail page
    // guards on canOpenDetail, so this drive must answer the probe or every
    // assertion below meets the denied card instead of the screen.
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) {
      currentDoc = doc[1]
      return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    }
    if (/\/Outbox$/.test(p)) return route.fulfill(envelope(OUTBOX[currentDoc] ?? []))
    if (/\/Logs$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const grid = () => page.locator('[role="tabpanel"]:not([hidden]) .ag-root-wrapper')
  const open = async (documentNo) => {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await grid().waitFor()
    await page.waitForTimeout(200)
  }

  /**
   * A token's value as the browser resolves it, in `rgb(…)` form — so a painted
   * colour can be asserted to BE `--attention-800` / `--danger-800` rather than
   * merely to differ from its neighbour. The probe is a throwaway element: the
   * token is authored as a hex in `global.css` and only `getComputedStyle` of a
   * real `color` property normalises it.
   */
  const token = (name) =>
    page.evaluate((varName) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${varName})`
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    }, name)

  const headers = () =>
    grid().evaluate((el) =>
      [...el.querySelectorAll('.ag-header-cell-text')].map((h) => h.innerText.trim()),
    )

  await open('2000000551')

  // --- 1 · description first --------------------------------------------------
  const cols = await headers()
  check('the items grid opens with Description as its first column', cols[0] === 'Description', cols.slice(0, 4).join(' | '))
  check('the dropped Stock column never appears, and needTransaction has its slot', !cols.includes('Stock') && cols.includes('Need Transaction'), cols.join(' | '))

  // --- 2 · the pinned totals row ---------------------------------------------
  // `[col-id]`, not a positional index: AG Grid renders only the columns in view.
  const cellsOf = (selector) =>
    grid().evaluate((el, sel) => {
      const row = el.querySelector(sel)
      if (!row) return null
      const out = {}
      for (const cell of row.querySelectorAll('.ag-cell')) {
        const style = getComputedStyle(cell)
        out[cell.getAttribute('col-id')] = {
          text: cell.innerText.trim(),
          colour: style.color,
          weight: style.fontWeight,
        }
      }
      return out
    }, selector)

  const FOOTER = '.ag-grid-pinned-bottom-rows .ag-row'
  const FIRST_LINE = '.ag-grid-scrolling-rows .ag-row'
  const footer = await cellsOf(FOOTER)
  check('a totals row is pinned to the bottom of the items grid', footer !== null)
  check(
    'it labels itself on the first column, pluralised for a one-line document',
    footer?.itemDescription?.text === '1 line · 1 unit',
    footer?.itemDescription?.text,
  )
  const read = (o, key) => o?.[key]?.text
  check(
    'and carries the four column sums, money to two decimals',
    read(footer, 'quantity') === '1' &&
      read(footer, 'grossAmount') === '5.70' &&
      read(footer, 'vatAmount') === '0.00' &&
      read(footer, 'netAmount') === '5.70',
    `qty=${read(footer, 'quantity')} gross=${read(footer, 'grossAmount')} vat=${read(footer, 'vatAmount')} net=${read(footer, 'netAmount')}`,
  )
  check(
    'and leaves unit price and discount blank — neither sums to anything meaningful',
    read(footer, 'unitPrice') === '' && read(footer, 'discount') === '',
    `unitPrice=${JSON.stringify(read(footer, 'unitPrice'))} discount=${JSON.stringify(read(footer, 'discount'))}`,
  )

  // --- 3 · the signed, amber discount ----------------------------------------
  const line = await cellsOf(FIRST_LINE)
  check(
    'the promotional discount renders as the payload carries it, sign included',
    line?.discount?.text === '-1.50',
    line?.discount?.text,
  )
  const amber = line?.discount?.colour
  check(
    'and takes the --attention-800 ink, which the line beside it does not',
    amber === (await token('--attention-800')) && amber !== line?.netAmount?.colour,
    `${amber} vs ${line?.netAmount?.colour}`,
  )

  await open('8000000253')
  const zeroLine = await cellsOf(FIRST_LINE)
  check(
    'a zero discount is not flagged',
    zeroLine?.discount?.text === '0.00' && zeroLine?.discount?.colour !== amber,
    `${zeroLine?.discount?.text} ${zeroLine?.discount?.colour}`,
  )

  // --- 5 · click selection + the leading accent bar --------------------------
  await grid().locator('.ag-grid-scrolling-rows .ag-row').first().click()
  await page.waitForTimeout(120)
  const selected = await grid().evaluate((el) => {
    const row = el.querySelector('.ag-row-selected')
    if (!row) return null
    const bar = getComputedStyle(row, '::before')
    return { width: bar.width, insetStart: bar.insetInlineStart, ground: getComputedStyle(row).backgroundColor }
  })
  check('clicking a line selects it', selected !== null)
  check(
    'and 082\u2019s accent bar paints on its leading edge',
    selected?.width === '3px' && selected?.insetStart === '0px',
    JSON.stringify(selected),
  )

  // --- 4 · the deleted line ---------------------------------------------------
  // No captured line is `deleted` — the corpus cannot show this treatment, so a
  // real payload's single line is copied and flagged.
  const live = DOCUMENTS['8000000253'].lines[0]
  DOCUMENTS['8000000253'] = {
    ...DOCUMENTS['8000000253'],
    lines: [live, { ...live, itemNumber: '999999', itemDescription: 'A deleted line', deleted: true }],
  }
  await open('8000000253')
  const rows = await grid().evaluate((el) =>
    [...el.querySelectorAll('.ag-grid-scrolling-rows .ag-row')].map((r) => {
      const s = getComputedStyle(r)
      return { text: r.innerText.replace(/\s+/g, ' ').trim().slice(0, 24), colour: s.color, strike: s.textDecorationLine }
    }),
  )
  const deleted = rows.find((r) => r.text.startsWith('A deleted line'))
  const kept = rows.find((r) => !r.text.startsWith('A deleted line'))
  check('a deleted line renders struck through', deleted?.strike === 'line-through', JSON.stringify(deleted))
  check('and muted — a different ink from a live line', deleted && kept && deleted.colour !== kept.colour, `${deleted?.colour} vs ${kept?.colour}`)
  check('while the live line keeps its ink and no strike', kept?.strike === 'none', JSON.stringify(kept))
  check(
    'the totals row counts the deleted line rather than silently disagreeing with the grid',
    (await grid().evaluate((el) => el.querySelector('.ag-grid-pinned-bottom-rows .ag-row .ag-cell').innerText.trim())) === '2 lines · 2 units',
  )

  // --- 6 · the tab counts; a failed job is the spine's banner since 403 --------
  const tabText = async (id) =>
    (await page.locator(`#tab-${id}`).innerText()).replace(/\s+/g, ' ').trim()
  // The badge itself — the `[title]` wrapper carries the label, its child span is
  // the `StatusBadge` that carries the severity ground and ink.
  const tabPill = async (id) =>
    page
      .locator(`#tab-${id} [title] > span`)
      .first()
      .evaluate((el) => ({
        ground: getComputedStyle(el).backgroundColor,
        ink: getComputedStyle(el).color,
      }))

  await open('2000000551')
  await page.locator('[data-job-banner="failed"]').first().waitFor({ timeout: 10000 }).catch(() => {})
  check('there is no Jobs or Log tab any more', (await page.locator('#tab-jobs, #tab-log').count()) === 0)
  check(
    'the one FAILED job of three is one banner at the top of the spine',
    (await page.locator('[data-spine] [data-job-banner="failed"]').count()) === 1,
    String(await page.locator('[data-spine] [data-job-banner="failed"]').count()),
  )
  check('the Items tab counts its rows', (await tabText('items')) === 'Items 1', await tabText('items'))
  const itemsPill = await tabPill('items')
  const conditionsPill = await tabPill('conditions')
  check(
    'in the neutral pill, the same on every tab',
    itemsPill.ink !== (await token('--danger-800')) && conditionsPill.ground === itemsPill.ground && conditionsPill.ink === itemsPill.ink,
    `${itemsPill.ground}/${itemsPill.ink}`,
  )
  check(
    'and its title pluralises — `1 row`, not `1 rows`',
    (await page.locator('#tab-items [title]').getAttribute('title')) === '1 row',
    await page.locator('#tab-items [title]').getAttribute('title'),
  )

  await open('8000000121')
  await page.waitForTimeout(250)
  check('with no failed job there is no banner', (await page.locator('[data-job-banner="failed"]').count()) === 0)

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
