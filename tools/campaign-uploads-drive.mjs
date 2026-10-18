// Campaign uploads drive (BackOffice ADR 0097, brief 2839; ticket 530 creates it — 531 and 532 each
// ADD a section of their own below the previous one, and leave earlier checks unchanged).
//
// Drives the REAL app in Chromium against STUBS of the campaign upload doors, on the REAL envelope
// { statusCode, success, message, errors: [{ errorCode, internalErrorCode, errorMessage }], data },
// the fields exactly as the 2737 brief's section "HQ contract: campaign uploads (2836-2838)" names
// them (checked against SIS.Api's RuleCampaignUploadWebEndpoints.cs reply types):
//   POST Rules/Authoring/Uploads/Template → the blank workbook, a BINARY body with Content-Disposition
//        (`template: 'named'`), the same with no Content-Disposition (`'unnamed'`), or a bare 403 (`'denied'`)
//   POST Rules/Authoring/Uploads/Read (multipart `file`) → the read report in `data`:
//        `read: 'refused'`  200, accepted:false — errors on all three sheets, and warnings
//        `read: 'accepted'` 200, accepted:true, stored:true, revision 3 — three mechanics, a generated Arabic name
//        `read: 'bad'`      400 RULES_BAD_UPLOAD — the JSON refusal envelope
//        `read: 'denied'`   a bare 403 with no body
// Every Read answers after READ_DELAY ms, so the busy state can be seen. Never a live SIS.Api: the
// doors are built (BackOffice 2836) but not deployed anywhere this drive can reach; ticket 533 walks them.
//
// ── 530 ── in LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; the namespace is English only), it asserts:
//   1. the Campaigns group carries a Campaign upload leaf that opens /campaigns/upload;
//   2. Download the template POSTs, and the file is saved under the reply's name; with no
//      Content-Disposition under campaign-upload.xlsx; a bare 403 reads "You do not have access…";
//   3. Upload sends the picked .xlsx as the multipart part `file`, with a busy state while HQ reads;
//   4. a refused read: the all-or-none message with N = 3, the issues grid errors first (red) then
//      warnings (amber), `Upload` reading "Whole sheet" and `Items!40` "Whole row", the sheet filter
//      narrowing it; no waiting line;
//   5. an accepted read: "Waiting for approval — deal …, revision 3. An approver activates it as one
//      version.", the note, the link to the upload's page; a tile for every mechanic; the window as
//      the INCLUSIVE days sent (…-15, never the JSON's exclusive …-16), isolated once; the generated
//      Arabic badge on the right row; a row opens its JSON read-only in a side panel;
//   6. a 400 RULES_BAD_UPLOAD: the message and nothing else; a bare 403: "You do not have access…";
//   7. no raw key and no page error.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/campaign-uploads-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/campaigns/upload'
/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''
const READ_DELAY = 700

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope.
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [],
    data,
  }),
})
const BARE_403 = { status: 403, body: '' }
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const DEAL = '0001000048-261009-261015'
const NOTE = 'SAP deal 0001000048, 9 to 15 October, from Same GRP - 50 Pct.txt'
const BAD_UPLOAD = 'The file is not a campaign upload workbook (.xlsx).'
const DENIED = 'You do not have access to this action.'

/** A campaign in the rule language, as HQ composed it: `window.until` is the EXCLUSIVE day after. */
const campaignJson = (code, mechanic) => ({
  schema: 1,
  id: `${DEAL}-${code}`,
  name: { en: `Sunscreen ${code}`, ar: `واقي الشمس ${code}` },
  window: { from: '2026-10-09', until: '2026-10-16' },
  rules: [{ id: 'r1', mechanic }],
})
const campaign = (code, row, mechanic, nameArGenerated = false, stacking = 'compete') => ({
  code,
  id: `${DEAL}-${code}`,
  row,
  mechanic,
  stacking,
  nameArGenerated,
  campaign: campaignJson(code, mechanic),
})
const issue = (at, sheet, row, column, message) => ({ at, sheet, row, column, message })

const REFUSED = {
  accepted: false,
  stored: false,
  dealCode: DEAL,
  stacking: 'compete',
  note: NOTE,
  revision: 0,
  mechanics: { percentOff: 1, buyNGetMFree: 1 },
  skuCount: 12,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  campaigns: [campaign('OF1', 2, 'percentOff'), campaign('OF2', 3, 'buyNGetMFree', true)],
  errors: [
    issue('Upload', 'Upload', 0, '', 'The Note is required: the approver reads it.'),
    issue('Campaigns!12:Value', 'Campaigns', 12, 'Value', 'A percentOff campaign needs a Value.'),
    issue('Items!40', 'Items', 40, '', 'Material 100234 is not in the master.'),
  ],
  warnings: [
    issue('Campaigns!3:NameAr', 'Campaigns', 3, 'NameAr', 'The Arabic name of OF2 was generated: واقي الشمس OF2.'),
    issue('Items!7', 'Items', 7, '', 'Material 100111 is live in campaign 0001000031-260901-260930-OF4 of another deal.'),
  ],
}

const ACCEPTED = {
  accepted: true,
  stored: true,
  dealCode: DEAL,
  stacking: 'compete',
  note: NOTE,
  revision: 3,
  mechanics: { percentOff: 2, buyNGetMFree: 1, buyXGetY: 1 },
  skuCount: 41,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  campaigns: [
    campaign('OF1', 2, 'percentOff'),
    campaign('OF2', 3, 'percentOff'),
    campaign('OF3', 4, 'buyNGetMFree', true),
    campaign('OF4', 5, 'buyXGetY', false, 'stacks'),
  ],
  errors: [],
  warnings: [issue('Campaigns!4:NameAr', 'Campaigns', 4, 'NameAr', 'The Arabic name of OF3 was generated.')],
}

const browser = await chromium.launch()

async function open(dir, { template = 'named', read = 'accepted' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    // A stubbed 4xx is the drive's own doing.
    (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()),
  )
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    calls.push({ p, method: req.method(), body: req.postDataBuffer()?.toString('latin1') ?? '', type: req.headers()['content-type'] ?? '' })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Rules/Authoring/Uploads/Template') {
      if (template === 'denied') return route.fulfill(BARE_403)
      return route.fulfill({
        status: 200,
        contentType: XLSX,
        headers:
          template === 'named'
            ? { 'Content-Disposition': "attachment; filename=campaign-upload-template.xlsx; filename*=UTF-8''campaign-upload-template.xlsx" }
            : {},
        body: Buffer.from('PK\u0003\u0004 a workbook'),
      })
    }
    if (p === 'Rules/Authoring/Uploads/Read') {
      await new Promise((r) => setTimeout(r, READ_DELAY))
      if (read === 'denied') return route.fulfill(BARE_403)
      if (read === 'bad') return route.fulfill(envelope(null, { status: 400, success: false, message: BAD_UPLOAD, errorCode: 'RULES_BAD_UPLOAD' }))
      return route.fulfill(envelope(read === 'refused' ? REFUSED : ACCEPTED))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}${ROUTE}`)
  await page.locator('[data-campaign-upload]').waitFor({ timeout: 20000 })
  return { context, page, errors, calls }
}

/** Visible text with the isolates dropped, so a check reads what a person reads. */
const text = async (loc) => (await loc.innerText()).replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()

/** The rows of a grid in their drawn order, each as { colId: text }. */
const gridRows = (page, grid) =>
  page.locator(`[${grid}] .ag-row`).evaluateAll((rows) =>
    rows
      .map((r) => ({
        index: Number(r.getAttribute('row-index')),
        cells: Object.fromEntries(
          [...r.querySelectorAll('.ag-cell')].map((c) => [c.getAttribute('col-id'), c.innerText.replace(/[⁦-⁩]/g, '').trim()]),
        ),
        kind: r.querySelector('[data-issue-kind]')?.getAttribute('data-issue-kind') ?? null,
        generated: !!r.querySelector('[data-upload-generated]'),
      }))
      .sort((a, b) => a.index - b.index),
  )

const pick = (page, name = 'deal.xlsx') =>
  page.locator('[data-upload-file]').setInputFiles({ name, mimeType: XLSX, buffer: Buffer.from('PK\u0003\u0004 the deal') })

const rawKey = async (page) => /campaign-uploads:|\b(outcome|report|issues|template|upload|campaigns|json)\.[a-z]+[A-Za-z.]*\b/.test(await page.locator('main').innerText())

async function drive(dir) {
  const tag = dir.toUpperCase()

  // ── 1 + 2: the leaf, and the template ──
  {
    const { context, page, errors, calls } = await open(dir)
    check(`${tag} 1: the document is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator('nav a[href="/campaigns/upload"]')
    check(`${tag} 1: the Campaigns group carries a Campaign upload leaf`, (await leaf.count()) === 1 && (await text(leaf.first())) === 'Campaign upload')
    check(`${tag} 1: the page names itself`, (await text(page.locator('[data-campaign-upload] h1'))) === 'Campaign upload')

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-upload-template]').click()])
    const asked = calls.find((c) => c.p === 'Rules/Authoring/Uploads/Template')
    check(`${tag} 2: Download the template POSTs to Uploads/Template`, asked?.method === 'POST', asked?.method)
    check(`${tag} 2: the template is saved under the reply's name`, download.suggestedFilename() === 'campaign-upload-template.xlsx', download.suggestedFilename())
    check(`${tag} 7: no raw key, no page error (template)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/530-${dir}-empty.png`, fullPage: true })
    await context.close()
  }
  {
    const { context, page } = await open(dir, { template: 'unnamed' })
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-upload-template]').click()])
    check(`${tag} 2: with no Content-Disposition the template is saved as campaign-upload.xlsx`, download.suggestedFilename() === 'campaign-upload.xlsx', download.suggestedFilename())
    await context.close()
  }
  {
    const { context, page } = await open(dir, { template: 'denied' })
    await page.locator('[data-upload-template]').click()
    const refusal = page.locator('[data-upload-template-error]')
    await refusal.waitFor({ timeout: 10000 })
    check(`${tag} 2: a bare 403 on the template reads "${DENIED}"`, (await text(refusal)) === DENIED && (await refusal.locator('[data-upload-denied]').count()) === 1, await text(refusal))
    await context.close()
  }

  // ── 3 + 4: a refused read ──
  {
    const { context, page, errors, calls } = await open(dir, { read: 'refused' })
    check(`${tag} 3: Upload waits for a file`, await page.locator('[data-upload-send]').isDisabled())
    await pick(page)
    await page.locator('[data-upload-send]').click()
    await page.locator('[data-upload-busy]').waitFor({ timeout: 5000 })
    check(`${tag} 3: a busy state while HQ reads, the button held`, (await text(page.locator('[data-upload-busy]'))) === 'Reading the workbook…' && (await page.locator('[data-upload-send]').isDisabled()))
    const sent = calls.find((c) => c.p === 'Rules/Authoring/Uploads/Read')
    check(
      `${tag} 3: the workbook goes as the multipart part "file"`,
      sent?.method === 'POST' && /^multipart\/form-data; boundary=/.test(sent.type) && /name="file"; filename="deal\.xlsx"/.test(sent.body),
      sent?.type,
    )
    const banner = page.locator('[data-upload-all-or-none]')
    await banner.waitFor({ timeout: 10000 })
    check(
      `${tag} 4: the all-or-none message, N = 3`,
      (await text(banner)) === 'Nothing was stored: the file has 3 errors. Fix every one and upload the whole file again.',
      await text(banner),
    )
    check(`${tag} 4: no waiting line on a refused read`, (await page.locator('[data-upload-waiting]').count()) === 0)
    check(`${tag} 4: the report follows (deal, no revision)`, (await text(page.locator('[data-upload-fact="deal"] dd'))) === DEAL && (await page.locator('[data-upload-fact="revision"]').count()) === 0)

    await page.locator('[data-upload-issues-grid] .ag-row').first().waitFor({ timeout: 10000 })
    const rows = await gridRows(page, 'data-upload-issues-grid')
    check(`${tag} 4: every error and warning is a row`, rows.length === 5, String(rows.length))
    check(`${tag} 4: errors first, then warnings`, rows.map((r) => r.kind).join(',') === 'error,error,error,warning,warning', rows.map((r) => r.kind).join(','))
    const sevOf = async (kind) => page.locator(`[data-upload-issues-grid] [data-issue-kind="${kind}"] span`).first().getAttribute('class')
    check(`${tag} 4: errors are red, warnings amber`, /danger/.test(await sevOf('error')) && /attention/.test(await sevOf('warning')))
    const upload = rows.find((r) => r.cells.at === 'Upload')
    check(`${tag} 4: row 0 reads "Whole sheet"`, upload?.cells.row === 'Whole sheet' && upload?.cells.column === 'Whole sheet', JSON.stringify(upload?.cells))
    const items40 = rows.find((r) => r.cells.at === 'Items!40')
    check(`${tag} 4: an empty column reads "Whole row"`, items40?.cells.row === '40' && items40?.cells.column === 'Whole row', JSON.stringify(items40?.cells))
    const cell = rows.find((r) => r.cells.at === 'Campaigns!12:Value')
    check(`${tag} 4: Campaigns!12:Value is sheet Campaigns, row 12, column Value`, cell?.cells.sheet === 'Campaigns' && cell?.cells.row === '12' && cell?.cells.column === 'Value')

    const filter = page.locator('[data-upload-sheet-filter]')
    const options = await filter.locator('option').evaluateAll((o) => o.map((x) => x.value))
    check(`${tag} 4: the sheet filter offers every sheet named`, options.join(',') === ',Upload,Campaigns,Items', options.join(','))
    await filter.selectOption('Items')
    await page.waitForTimeout(200)
    const items = await gridRows(page, 'data-upload-issues-grid')
    check(`${tag} 4: filtered to Items, an error and a warning`, items.length === 2 && items.every((r) => r.cells.sheet === 'Items') && items[0].kind === 'error', JSON.stringify(items.map((r) => r.cells.at)))
    await filter.selectOption('')
    await page.waitForTimeout(200)
    check(`${tag} 4: All sheets shows them all again`, (await gridRows(page, 'data-upload-issues-grid')).length === 5)
    check(`${tag} 7: no raw key, no page error (refused)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/530-${dir}-refused.png`, fullPage: true })
    await context.close()
  }

  // ── 5: an accepted read ──
  {
    const { context, page, errors } = await open(dir, { read: 'accepted' })
    await pick(page)
    await page.locator('[data-upload-send]').click()
    const waiting = page.locator('[data-upload-waiting]')
    await waiting.waitFor({ timeout: 10000 })
    check(
      `${tag} 5: the waiting line`,
      (await text(waiting.locator('p').first())) === `Waiting for approval — deal ${DEAL}, revision 3. An approver activates it as one version.`,
      await text(waiting.locator('p').first()),
    )
    check(`${tag} 5: the note it carries`, (await text(page.locator('[data-upload-waiting-note]'))) === `Its note ${NOTE}`)
    check(`${tag} 5: a link to the upload's page`, (await page.locator('[data-upload-open]').getAttribute('href')) === `/campaigns/uploads/${DEAL}`)
    check(`${tag} 5: no all-or-none message`, (await page.locator('[data-upload-all-or-none]').count()) === 0)
    check(`${tag} 5: the header holds the revision`, (await text(page.locator('[data-upload-fact="revision"] dd'))) === '3' && (await text(page.locator('[data-upload-fact="stacking"] dd'))) === 'compete')

    const tiles = await page.locator('[data-upload-tile^="mechanic:"]').evaluateAll((t) => t.map((x) => `${x.getAttribute('data-upload-tile')}=${x.querySelector('span:last-child').innerText.replace(/[⁦-⁩]/g, '')}`))
    check(`${tag} 5: a tile for every mechanic, with its count`, tiles.join(',') === 'mechanic:percentOff=2,mechanic:buyNGetMFree=1,mechanic:buyXGetY=1', tiles.join(','))
    check(`${tag} 5: the generated Arabic names are counted`, (await text(page.locator('[data-upload-tile="generated"] span').last())) === '1')
    check(`${tag} 3: after a read the box is cleared, so the fixed file is picked afresh`, (await page.locator('[data-upload-file]').inputValue()) === '' && (await page.locator('[data-upload-send]').isDisabled()))
    check(`${tag} 5: campaigns and SKUs`, (await text(page.locator('[data-upload-tile="campaigns"] span').last())) === '4' && (await text(page.locator('[data-upload-tile="skus"] span').last())) === '41')
    const win = page.locator('[data-upload-tile="window"] span').last()
    check(`${tag} 5: the window is the inclusive days sent, never the JSON's exclusive day`, (await text(win)) === '2026-10-09 – 2026-10-15', await text(win))
    check(`${tag} 5: the window is isolated once`, (await win.locator('bdi[dir="ltr"]').count()) === 1)

    await page.locator('[data-upload-campaigns-grid] .ag-row').first().waitFor({ timeout: 10000 })
    const camps = await gridRows(page, 'data-upload-campaigns-grid')
    check(`${tag} 5: every campaign is a row`, camps.length === 4 && camps[0].cells.id === `${DEAL}-OF1` && camps[3].cells.stacking === 'stacks', JSON.stringify(camps.map((c) => c.cells.id)))
    check(`${tag} 5: the generated Arabic badge on OF3 alone`, camps.filter((c) => c.generated).map((c) => c.cells.code).join(',') === 'OF3' && (await text(page.locator('[data-upload-generated]'))) === 'Generated Arabic')

    await page.locator(`[data-upload-campaigns-grid] .ag-row[row-index="3"] [col-id="mechanic"]`).click()
    const panel = page.locator(`[data-upload-json="${DEAL}-OF4"]`)
    await panel.waitFor({ timeout: 5000 })
    const json = await panel.locator('[data-upload-json-body]').innerText()
    check(`${tag} 5: a row opens its JSON, pretty-printed, read-only`, JSON.parse(json).id === `${DEAL}-OF4` && json.includes('\n  "rules": [') && (await panel.locator('input, textarea, [contenteditable="true"]').count()) === 0)
    check(`${tag} 5: the JSON is one LTR island`, (await panel.locator('[data-upload-json-body]').getAttribute('dir')) === 'ltr')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/530-${dir}-json.png` })
    await page.locator('[data-upload-json-close]').click()
    await page.waitForTimeout(200)
    check(`${tag} 5: the panel closes`, (await page.locator('[data-upload-json]').count()) === 0)
    await page.locator(`[data-upload-view="${DEAL}-OF1"]`).click()
    await page.locator(`[data-upload-json="${DEAL}-OF1"]`).waitFor({ timeout: 5000 })
    check(`${tag} 5: the row's View button opens it too, once`, (await page.locator('[data-upload-json]').count()) === 1)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    check(`${tag} 5: Escape closes it`, (await page.locator('[data-upload-json]').count()) === 0)
    check(`${tag} 7: no raw key, no page error (accepted)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/530-${dir}-accepted.png`, fullPage: true })
    await context.close()
  }

  // ── 6: the file could not be read, or the grant is missing ──
  {
    const { context, page, errors } = await open(dir, { read: 'bad' })
    await pick(page, 'deal.xls')
    await page.locator('[data-upload-send]').click()
    const refusal = page.locator('[data-upload-refusal]')
    await refusal.waitFor({ timeout: 10000 })
    check(`${tag} 6: 400 RULES_BAD_UPLOAD shows its message`, (await text(refusal)) === BAD_UPLOAD, await text(refusal))
    check(`${tag} 6: …and nothing else`, (await page.locator('[data-upload-outcome], [data-upload-report]').count()) === 0)
    check(`${tag} 7: no page error (bad upload)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page } = await open(dir, { read: 'denied' })
    await pick(page)
    await page.locator('[data-upload-send]').click()
    const refusal = page.locator('[data-upload-refusal]')
    await refusal.waitFor({ timeout: 10000 })
    check(`${tag} 6: a bare 403 on the read reads "${DENIED}", never an empty report`, (await text(refusal)) === DENIED && (await page.locator('[data-upload-report]').count()) === 0, await text(refusal))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
