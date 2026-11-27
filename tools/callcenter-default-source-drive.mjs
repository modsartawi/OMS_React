// The agent's default source applies when an order opens (ticket 993, spec 983 D14) — drives
// the REAL app (dev build, so React StrictMode's double effects are in play) in Chromium, the
// wire stubbed at Playwright from the contract's open fixture (`documentSource: null`).
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/callcenter-default-source-drive.mjs
//
// Asserts:
//   1. a default + an order with no source → exactly ONE SetDocumentSource, carrying the
//      default and an empty reference; the source settles on the order;
//   2. the default refused SOURCE_REFERENCE_REQUIRED → still one send; the Source section
//      opens on that source, the caret in the reference box, the refusal worded;
//   3. no default (the owner's login) → no SetDocumentSource at all;
//   4. an order that already holds a source → no SetDocumentSource at all.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.body.data

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const refusal = (code, status) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success: false,
    message: 'Source reference is required.',
    errors: [{ errorCode: code, internalErrorCode: '', errorMessage: '' }],
    data: null,
  }),
})

let pass = 0
let fail = 0
const ok = (c, m, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const OPENED = fixture('01-open-empty').state
const row = (documentSource, description, isDefault) => ({
  documentSource,
  description,
  documentSourceCategory: 'C',
  isDefault,
})
const WITH_DEFAULT = [row('CLCN', 'Call centre', false), row('TMRA', 'Tamara campaign', true)]
const NO_DEFAULT = [row('CLCN', 'Call centre', false), row('TMRA', 'Tamara campaign', false)]

const browser = await chromium.launch()

async function run({ sources, opened = OPENED, refuse = null }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const sends = []
  let served = opened
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    if (p === 'CallCenterWeb/MyDocumentSources') return route.fulfill(envelope(sources))
    if (p === 'CallCenterWeb/SetDocumentSource') {
      const body = route.request().postDataJSON()
      sends.push(body)
      if (refuse) return route.fulfill(refusal(refuse, 400))
      served = {
        ...served,
        version: served.version + 1,
        header: { ...served.header, documentSource: body.documentSource, sourceReference: body.sourceReference },
      }
      return route.fulfill(envelope(served))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`, { timeout: 120_000 })
  await page.locator('[data-cc-console]').waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  return { context, page, errors, sends }
}

console.log('\n1. a default, an order with no source')
{
  const { context, page, errors, sends } = await run({ sources: WITH_DEFAULT })
  ok(sends.length === 1, 'exactly one SetDocumentSource (StrictMode double effects included)', String(sends.length))
  ok(
    sends[0]?.documentSource === 'TMRA' && sends[0]?.sourceReference === '' && !!sends[0]?.requestId,
    'it carries the default, an empty reference and a requestId',
    JSON.stringify(sends[0]),
  )
  const chip = (await page.locator('[data-cc-chip="source"]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok(chip.includes('TMRA'), 'the source settles on the order', chip)
  ok((await page.locator('[data-cc-section="source"]').count()) === 0, 'no section is opened on success')
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

console.log('\n2. the default needs a reference')
{
  const { context, page, errors, sends } = await run({ sources: WITH_DEFAULT, refuse: 'SOURCE_REFERENCE_REQUIRED' })
  ok(sends.length === 1, 'still exactly one send — the refusal is not retried', String(sends.length))
  await page.locator('[data-cc-section="source"]').waitFor({ timeout: 10_000 }).catch(() => {})
  ok((await page.locator('[data-cc-section="source"]').count()) === 1, 'the Source section opens')
  ok((await page.locator('[data-cc-source-select]').inputValue().catch(() => '')) === 'TMRA', 'pre-filled with the default')
  ok(
    await page.evaluate(() => document.activeElement?.hasAttribute('data-cc-source-reference') ?? false),
    'the caret is in the reference box',
  )
  const said = (await page.locator('[data-cc-source-error]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok(said.includes('TMRA') && !/[A-Z]{3,}_[A-Z_]+/.test(said), 'the refusal is worded, naming the source', said)
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

console.log('\n3. no default (the owner login)')
{
  const { context, errors, sends } = await run({ sources: NO_DEFAULT })
  ok(sends.length === 0, 'no SetDocumentSource', String(sends.length))
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

console.log('\n4. an order that already holds a source')
{
  const held = { ...OPENED, header: { ...OPENED.header, documentSource: 'CLCN', sourceReference: null } }
  const { context, errors, sends } = await run({ sources: WITH_DEFAULT, opened: held })
  ok(sends.length === 0, 'no SetDocumentSource — what the order holds wins', String(sends.length))
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
