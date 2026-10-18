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
//   POST Rules/Authoring/Uploads/ConvertBby (multipart `file`, 2838) → the pre-filled workbook, a BINARY body
//        with Content-Disposition `<DealCode>.xlsx` (`convert: 'named'`), 400 RULES_BAD_UPLOAD (`'bad'`), or
//        a bare 403 (`'denied'`); each after READ_DELAY ms
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
// ── 531 ── in LTR and RTL, it asserts:
//   8. "Convert a SAP BBy file" sits in step 1 beside the template; its picker accepts `.txt` only;
//   9. a picked .txt goes to Uploads/ConvertBby as the multipart part `file`, with a busy state, and
//      the workbook is saved under the stubbed Content-Disposition name (`<DealCode>.xlsx`);
//  10. after it, the next step in words (open it, review DealCode / names / PRICE, read Convert notes,
//      upload it below) and that the conversion stored nothing — and no report;
//  11. a 400 RULES_BAD_UPLOAD shows the server's message and no next step; a bare 403 reads
//      "You do not have access…"; no raw key and no page error.
//
// ── 532 ── the approver's screens, against stubs of Uploads/List, Load, Activate and SendBack:
//   POST Rules/Authoring/Uploads/List → five summaries newest first (two pending, sentBack, activated, and an
//        unlisted `archived`), or a bare 403 (`list: 'denied'`)
//   POST Rules/Authoring/Uploads/Load { dealCode } → the pending upload at revision 3: new, changed and unchanged
//        (the live JSON's keys in another order) campaigns, two disabling rows; `load: 'refuse'` adds two
//        would-refuse lines (stale order first); an unknown deal is 404 RULES_UPLOAD_NOT_FOUND; `'denied'` a bare
//        403. After a successful Activate or Send back it answers the new state.
//   POST Rules/Authoring/Uploads/Activate → `activate: 'ok' | 'self' | 'stale' | 'invalid' | 'denied'`
//   POST Rules/Authoring/Uploads/SendBack → `sendBack: 'ok' | 'reason'`
// In LTR and RTL it asserts:
//  12. the Campaigns group carries a Campaign uploads leaf that opens /campaigns/uploads;
//  13. the list: pending by default (the URL bare), newest upload first; sentBack / activated / all held in the
//      URL (`?state=`) and read back from it; an unlisted state listed under All as sent; the window inclusive;
//  14. a bare 403 on the list reads "You do not have access…", never an empty list;
//  15. an opened upload: the summary, every mechanic's tile, the generated-names flag, the read's warnings;
//      new / changed / unchanged campaigns; two disabling rows in red; no would-refuse lines;
//  16. a campaign opens uploaded beside live as read-only JSON;
//  17. Activate: the dialog repeats the counts and the disabling list, sends the LOADED revision, and shows
//      "Version 42 is live: 3 campaigns activated, 2 disabled." with the checker's warnings; the upload reloads;
//  18. Send back: no note, no send; HQ's RULES_REASON_REQUIRED read in the dialog; a noted Send back shows
//      sentBack and the note;
//  19. RULES_SELF_APPROVAL, RULES_UPLOAD_STALE (with a reload), RULES_INVALID_CAMPAIGN (its lines, and Send back
//      offered) and a bare 403, each in the dialog with the upload unchanged;
//  20. would-refuse lines above the buttons, the stale-order line first; Load's 404 and bare 403;
//  21. no raw key and no page error.
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
const BAD_BBY = 'The file holds more than one SAP deal number: 0001000048, 0001000051.'
const NEXT_STEP =
  'Next: open it and review it — the proposed DealCode, the names, and every PRICE value. Read its Convert notes sheet if it has one, then upload it below.'
const BBY_TXT = Buffer.from('BBY\t0001000048\t20261009\t20261015\n')

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

async function open(dir, { template = 'named', read = 'accepted', convert = 'named' } = {}) {
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
    if (p === 'Rules/Authoring/Uploads/ConvertBby') {
      await new Promise((r) => setTimeout(r, READ_DELAY))
      if (convert === 'denied') return route.fulfill(BARE_403)
      if (convert === 'bad') return route.fulfill(envelope(null, { status: 400, success: false, message: BAD_BBY, errorCode: 'RULES_BAD_UPLOAD' }))
      return route.fulfill({
        status: 200,
        contentType: XLSX,
        headers: { 'Content-Disposition': `attachment; filename=${DEAL}.xlsx; filename*=UTF-8''${DEAL}.xlsx` },
        body: Buffer.from('PK\u0003\u0004 the converted deal'),
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

const pickBby = (page, name = 'Same GRP - 50 Pct.txt') =>
  page.locator('[data-upload-bby-file]').setInputFiles({ name, mimeType: 'text/plain', buffer: BBY_TXT })

const rawKey = async (page) => /campaign-uploads:|\b(outcome|report|issues|template|convert|upload|campaigns|json)\.[a-z]+[A-Za-z.]*\b/.test(await page.locator('main').innerText())

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

  // ════════════════════════ 531: convert a SAP BBy file ════════════════════════
  {
    const { context, page, errors, calls } = await open(dir)
    const button = page.locator('[data-upload-step="1"] [data-upload-convert]')
    check(
      `${tag} 8: "Convert a SAP BBy file" sits in step 1, beside the template`,
      (await button.count()) === 1 && (await text(button)) === 'Convert a SAP BBy file' && (await page.locator('[data-upload-step="1"] [data-upload-template]').count()) === 1,
    )
    check(`${tag} 8: its picker accepts .txt only`, (await page.locator('[data-upload-bby-file]').getAttribute('accept')) === '.txt')
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()])
    check(`${tag} 8: the button opens the .txt picker, one file`, !chooser.isMultiple() && (await chooser.element().getAttribute('data-upload-bby-file')) === '')
    check(`${tag} 10: no next step before a conversion`, (await page.locator('[data-upload-next-step]').count()) === 0)

    const downloaded = page.waitForEvent('download')
    await chooser.setFiles({ name: 'Same GRP - 50 Pct.txt', mimeType: 'text/plain', buffer: BBY_TXT })
    await page.waitForFunction(() => document.querySelector('[data-upload-convert]')?.textContent?.includes('Converting'), null, { timeout: 5000 })
    check(`${tag} 9: a busy state while HQ converts, the button held`, (await text(button)) === 'Converting…' && (await button.isDisabled()))
    const download = await downloaded
    const sent = calls.find((c) => c.p === 'Rules/Authoring/Uploads/ConvertBby')
    check(
      `${tag} 9: the .txt goes to Uploads/ConvertBby as the multipart part "file"`,
      sent?.method === 'POST' && /^multipart\/form-data; boundary=/.test(sent.type) && /name="file"; filename="Same GRP - 50 Pct\.txt"/.test(sent.body),
      sent?.type,
    )
    check(`${tag} 9: the workbook is saved under the reply's name`, download.suggestedFilename() === `${DEAL}.xlsx`, download.suggestedFilename())

    const done = page.locator('[data-upload-converted]')
    await done.waitFor({ timeout: 5000 })
    const saved = done.locator('p').first()
    check(`${tag} 10: it names the file it saved, isolated once`, (await text(saved)) === `Saved as ${DEAL}.xlsx.` && (await saved.locator('bdi[dir="ltr"]').count()) === 1, await text(saved))
    check(`${tag} 10: the next step, in words`, (await text(page.locator('[data-upload-next-step]'))) === NEXT_STEP, await text(page.locator('[data-upload-next-step]')))
    check(`${tag} 10: it says the conversion stored nothing`, (await text(done)).endsWith('The conversion stored nothing, and its notes are only in the workbook.'), await text(done))
    check(
      `${tag} 10: …and shows nothing else (no report, no read)`,
      (await page.locator('[data-upload-outcome], [data-upload-report]').count()) === 0 && !calls.some((c) => c.p === 'Rules/Authoring/Uploads/Read'),
    )
    check(`${tag} 11: no raw key, no page error (converted)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/531-${dir}-converted.png`, fullPage: true })

    // The box is cleared after each pick, so the same .txt picked again (fixed in SAP) converts again.
    const again = page.waitForEvent('download')
    await pickBby(page)
    await again
    check(`${tag} 9: the same .txt picked again converts again`, calls.filter((c) => c.p === 'Rules/Authoring/Uploads/ConvertBby').length === 2)
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { convert: 'bad' })
    await pickBby(page, 'Two deals.txt')
    const refusal = page.locator('[data-upload-convert-error]')
    await refusal.waitFor({ timeout: 10000 })
    check(`${tag} 11: 400 RULES_BAD_UPLOAD shows the server's message`, (await text(refusal)) === BAD_BBY, await text(refusal))
    check(`${tag} 11: …and no next step`, (await page.locator('[data-upload-next-step], [data-upload-converted]').count()) === 0)
    check(`${tag} 11: the button is free again`, !(await page.locator('[data-upload-convert]').isDisabled()))
    check(`${tag} 11: no raw key, no page error (bad BBy file)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/531-${dir}-refused.png`, fullPage: true })
    await context.close()
  }
  {
    const { context, page } = await open(dir, { convert: 'denied' })
    await pickBby(page)
    const refusal = page.locator('[data-upload-convert-error]')
    await refusal.waitFor({ timeout: 10000 })
    check(
      `${tag} 11: a bare 403 on the conversion reads "${DENIED}", no next step`,
      (await text(refusal)) === DENIED && (await refusal.locator('[data-upload-denied]').count()) === 1 && (await page.locator('[data-upload-next-step]').count()) === 0,
      await text(refusal),
    )
    await context.close()
  }
}

// ════════════════════════ 532: the approver activates or sends back ════════════════════════

const UPLOADS = '/campaigns/uploads'
const ME = 'approver2'
/** A refusal on the real envelope: the code first, then one error per detail line under the same code. */
const refusal = (status, code, message, details = []) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success: false,
    message,
    errors: [message, ...details].map((errorMessage) => ({ errorCode: code, internalErrorCode: '', errorMessage })),
    data: null,
  }),
})

const NEVER = '0001-01-01T00:00:00'
const summaryOf = (dealCode, state, over = {}) => ({
  dealCode,
  state,
  revision: 3,
  stacking: 'compete',
  note: NOTE,
  fileName: `${dealCode}.xlsx`,
  uploadedBy: 'author1',
  uploadedAt: '2026-10-18T09:30:00',
  campaignCount: 3,
  skuCount: 41,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  summary: {
    mechanics: { percentOff: 1, buyNGetMFree: 1, futureMechanic: 1 },
    skuCount: 41,
    windowFrom: '2026-10-09',
    windowUntil: '2026-10-15',
    generatedNames: 1,
    warnings: [{ at: 'Campaigns!4:NameAr', message: 'The Arabic name of OF3 was generated.' }],
  },
  reviewedBy: '',
  reviewedAt: NEVER,
  reviewNote: '',
  versionNo: 0,
  ...over,
})
const LIST = [
  summaryOf(DEAL, 'pending'),
  summaryOf('0001000051-261012-261018', 'archived'),
  summaryOf('0001000050-261010-261016', 'activated', { reviewedBy: 'approver1', reviewedAt: '2026-10-17T14:00:00', versionNo: 41 }),
  summaryOf('0001000049-261001-261007', 'pending'),
  summaryOf('0001000047-260920-260926', 'sentBack', { reviewedBy: 'approver1', reviewedAt: '2026-10-16T11:00:00', reviewNote: 'The window is a week late.' }),
]

const OF2_LIVE = { ...campaignJson('OF2', 'percentOff'), name: { en: 'Sunscreen OF2', ar: 'واقي الشمس القديم' } }
/** OF3 as live: the same JSON, its keys in another order — unchanged. */
const OF3_LIVE = (() => {
  const c = campaignJson('OF3', 'buyNGetMFree')
  return { rules: c.rules, window: { until: c.window.until, from: c.window.from }, name: { ar: c.name.ar, en: c.name.en }, id: c.id, schema: 1 }
})()
const STALE_LINE = 'The live evaluation order was changed by hand since this upload was read (version 40 → 41).'
const detailOf = (state, { refuse = false, over = {} } = {}) => ({
  upload: summaryOf(DEAL, state, over),
  campaigns: [
    { id: `${DEAL}-OF1`, competes: true, campaign: campaignJson('OF1', 'percentOff'), live: null },
    { id: `${DEAL}-OF2`, competes: true, campaign: campaignJson('OF2', 'percentOff'), live: OF2_LIVE },
    { id: `${DEAL}-OF3`, competes: false, campaign: campaignJson('OF3', 'buyNGetMFree'), live: OF3_LIVE },
  ],
  disabling: [
    { id: `${DEAL}-OF8`, competes: false, campaign: null, live: campaignJson('OF8', 'percentOff') },
    { id: `${DEAL}-OF9`, competes: false, campaign: null, live: campaignJson('OF9', 'amountOff') },
  ],
  errors: refuse ? [STALE_LINE, `${DEAL}-OF2: rules[0]: a percent of 100 or more needs a cap (rules[0].effects[0])`] : [],
})
const ACTIVATION = {
  versionNo: 42,
  dealCode: DEAL,
  revision: 3,
  publishedAt: '2026-10-19T10:00:00',
  publishedBy: ME,
  activated: [`${DEAL}-OF1`, `${DEAL}-OF2`, `${DEAL}-OF3`],
  disabled: [`${DEAL}-OF8`, `${DEAL}-OF9`],
  warnings: [`${DEAL}-OF1: percentOff: a percent of 100 or more (rules[0].effects[0].value)`],
}
const INVALID_LINES = [`${DEAL}-OF2: rules[0]: the item scope is empty (rules[0].scope)`, `${DEAL}-OF9: an id differs only in case from a live one`]

async function open532(dir, path, { list = 'ok', load = 'ok', activate = 'ok', sendBack = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  let state = 'pending'
  let review = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    let body = null
    try {
      body = req.postData() ? JSON.parse(req.postData()) : null
    } catch {
      body = null
    }
    calls.push({ p, method: req.method(), body })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: ME, currentStoreCode: 'P001' }))
    if (p === 'Rules/Authoring/Uploads/List') {
      if (list === 'denied') return route.fulfill(BARE_403)
      return route.fulfill(envelope(LIST))
    }
    if (p === 'Rules/Authoring/Uploads/Load') {
      if (load === 'denied') return route.fulfill(BARE_403)
      if (body?.dealCode !== DEAL) return route.fulfill(refusal(404, 'RULES_UPLOAD_NOT_FOUND', `No campaign upload of deal ${body?.dealCode}.`))
      return route.fulfill(envelope(detailOf(state, { refuse: load === 'refuse', over: review })))
    }
    if (p === 'Rules/Authoring/Uploads/Activate') {
      if (activate === 'denied') return route.fulfill(BARE_403)
      if (activate === 'self') return route.fulfill(refusal(403, 'RULES_SELF_APPROVAL', 'The uploader cannot activate their own upload.'))
      if (activate === 'stale') return route.fulfill(refusal(409, 'RULES_UPLOAD_STALE', 'Revision 4 of this deal was uploaded since revision 3.'))
      if (activate === 'invalid') return route.fulfill(refusal(400, 'RULES_INVALID_CAMPAIGN', 'The checker refuses the upload on version 41.', INVALID_LINES))
      state = 'activated'
      review = { reviewedBy: ME, reviewedAt: '2026-10-19T10:00:00', versionNo: 42 }
      return route.fulfill(envelope(ACTIVATION))
    }
    if (p === 'Rules/Authoring/Uploads/SendBack') {
      if (sendBack === 'reason') return route.fulfill(refusal(400, 'RULES_REASON_REQUIRED', 'Say why the upload goes back: its uploader reads the note.'))
      state = 'sentBack'
      review = { reviewedBy: ME, reviewedAt: '2026-10-19T10:05:00', reviewNote: body?.note ?? '' }
      return route.fulfill(envelope(summaryOf(DEAL, 'sentBack', review)))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, calls }
}

const rawKey532 = async (page) => /campaign-uploads:|\b(review|uploads|compare|state|stacking)\.[a-z]+[A-Za-z.]*\b/.test(await page.locator('main').innerText())
/** The list's rows once the grid has drawn the filter asked for (`until`), or as they are after 5 s. */
const listRows = async (page, until = () => true) => {
  let rows = []
  for (let i = 0; i < 25; i++) {
    rows = await gridRows(page, 'data-uploads-grid')
    if (rows.length && until(rows)) break
    await page.waitForTimeout(200)
  }
  return rows
}
const openUpload = async (dir, opts) => {
  const o = await open532(dir, `${UPLOADS}/${DEAL}`, opts)
  await o.page.locator('[data-review-summary], [data-review-failed]').first().waitFor({ timeout: 20000 })
  return o
}
const loadsOf = (calls) => calls.filter((c) => c.p === 'Rules/Authoring/Uploads/Load').length
const stateFact = (page) => text(page.locator('[data-review-header] [data-upload-fact="state"] dd'))

async function drive532(dir) {
  const tag = dir.toUpperCase()

  // ── 12 + 13: the leaf, and the list with its filter in the URL ──
  {
    const { context, page, errors, calls } = await open532(dir, UPLOADS)
    await page.locator('[data-uploads-grid] .ag-row').first().waitFor({ timeout: 20000 })
    check(`${tag} 12: the document is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator(`nav a[href="${UPLOADS}"]`)
    check(`${tag} 12: the Campaigns group carries a Campaign uploads leaf`, (await leaf.count()) === 1 && (await text(leaf.first())) === 'Campaign uploads')
    check(`${tag} 12: the page names itself`, (await text(page.locator('[data-campaign-uploads] h1'))) === 'Campaign uploads')
    check(`${tag} 13: List is asked as a POST`, calls.some((c) => c.p === 'Rules/Authoring/Uploads/List' && c.method === 'POST'))
    check(`${tag} 13: the filter is pending by default, the URL bare`, (await page.locator('[data-uploads-filter]').inputValue()) === 'pending' && new URL(page.url()).search === '')
    let rows = await listRows(page)
    check(`${tag} 13: pending lists the two pending uploads, newest first`, rows.map((r) => r.cells.dealCode).join(',') === `${DEAL},0001000049-261001-261007`, rows.map((r) => r.cells.dealCode).join(','))
    const first = rows[0]?.cells ?? {}
    check(`${tag} 13: the row's state badge, revision and counts`, first.state === 'Pending' && first.revision === '3' && first.campaignCount === '3' && first.skuCount === '41', JSON.stringify(first))
    check(`${tag} 13: the window is the inclusive days sent`, first.window === '2026-10-09 – 2026-10-15', first.window)
    check(
      `${tag} 13: uploader and time; a pending upload has no review yet`,
      first.uploadedBy === 'author1' && first.uploadedAt === '2026-10-18 09:30' && first.reviewedBy === '' && first.reviewedAt === '' && first.versionNo === '',
      JSON.stringify(first),
    )
    check(`${tag} 13: the status bar counts the rows`, (await text(page.locator('[data-status-count]'))) === '2 campaign uploads', await text(page.locator('[data-status-count]')))

    await page.locator('[data-uploads-filter]').selectOption('sentBack')
    rows = await listRows(page, (r) => r.every((x) => x.cells.state === 'Sent back'))
    check(`${tag} 13: sentBack goes into the URL`, new URL(page.url()).searchParams.get('state') === 'sentBack')
    check(`${tag} 13: a sent-back row with its reviewer`, rows.length === 1 && rows[0].cells.state === 'Sent back' && rows[0].cells.reviewedBy === 'approver1' && rows[0].cells.versionNo === '', JSON.stringify(rows[0]?.cells))
    await page.locator('[data-uploads-filter]').selectOption('activated')
    rows = await listRows(page, (r) => r.every((x) => x.cells.state === 'Activated'))
    check(`${tag} 13: an activated row with its version`, rows.length === 1 && rows[0].cells.state === 'Activated' && rows[0].cells.versionNo === '41' && rows[0].cells.reviewedAt === '2026-10-17 14:00', JSON.stringify(rows[0]?.cells))
    await page.locator('[data-uploads-filter]').selectOption('all')
    rows = await listRows(page, (r) => r.length === 5)
    check(`${tag} 13: All lists every upload, newest first, the unlisted state as sent`, rows.length === 5 && rows[1].cells.state === 'archived' && rows[4].cells.state === 'Sent back', rows.map((r) => r.cells.state).join(','))
    check(`${tag} 13: all goes into the URL`, new URL(page.url()).searchParams.get('state') === 'all')
    check(`${tag} 21: no raw key, no page error (list)`, !(await rawKey532(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-list.png`, fullPage: true })

    await page.locator(`[data-uploads-open="${DEAL}"]`).click()
    await page.locator('[data-review-summary]').waitFor({ timeout: 10000 })
    check(`${tag} 13: the deal code opens its upload`, new URL(page.url()).pathname === `${UPLOADS}/${DEAL}`)
    await context.close()
  }
  {
    const { context, page } = await open532(dir, `${UPLOADS}?state=activated`)
    await page.locator('[data-uploads-grid] .ag-row').first().waitFor({ timeout: 20000 })
    const rows = await listRows(page)
    check(`${tag} 13: the filter is read back from the URL`, (await page.locator('[data-uploads-filter]').inputValue()) === 'activated' && rows.length === 1, String(rows.length))
    await context.close()
  }

  // ── 14: no grant ──
  {
    const { context, page } = await open532(dir, UPLOADS, { list: 'denied' })
    const failed = page.locator('[data-uploads-failed]')
    await failed.waitFor({ timeout: 20000 })
    check(`${tag} 14: a bare 403 on the list reads "${DENIED}", never an empty list`, (await text(failed)) === DENIED && (await page.locator('[data-uploads-grid]').count()) === 0, await text(failed))
    await context.close()
  }

  // ── 15 + 16 + 17: an opened upload, compared, then activated ──
  {
    const { context, page, errors, calls } = await openUpload(dir)
    const fact = (k) => text(page.locator(`[data-review-header] [data-upload-fact="${k}"] dd`))
    check(`${tag} 15: Load is asked { dealCode }`, calls.some((c) => c.p === 'Rules/Authoring/Uploads/Load' && c.body?.dealCode === DEAL))
    check(`${tag} 15: the summary: deal, state, revision, stacking`, (await fact('deal')) === DEAL && (await fact('state')) === 'Pending' && (await fact('revision')) === '3' && (await fact('stacking')) === 'compete')
    check(`${tag} 15: …note, file, uploader and time`, (await fact('note')) === NOTE && (await fact('file')) === `${DEAL}.xlsx` && (await fact('uploadedBy')) === 'author1' && (await fact('uploadedAt')) === '2026-10-18 09:30')
    const tiles = await page
      .locator('[data-review-tiles] [data-upload-tile^="mechanic:"]')
      .evaluateAll((t) => t.map((x) => `${x.getAttribute('data-upload-tile')}=${x.querySelector('span:last-child').innerText.replace(/[⁦-⁩]/g, '')}`))
    check(`${tag} 15: a tile for every mechanic, an unknown one included`, tiles.join(',') === 'mechanic:percentOff=1,mechanic:buyNGetMFree=1,mechanic:futureMechanic=1', tiles.join(','))
    check(
      `${tag} 15: generated Arabic names counted and flagged`,
      (await text(page.locator('[data-review-tiles] [data-upload-tile="generated"] bdi').first())) === '1' && (await page.locator('[data-review-generated-flag]').count()) === 1,
    )
    const win = page.locator('[data-review-tiles] [data-upload-tile="window"] span').last()
    check(`${tag} 15: the window inclusive, isolated once`, (await text(win)) === '2026-10-09 – 2026-10-15' && (await win.locator('bdi[dir="ltr"]').count()) === 1, await text(win))
    check(
      `${tag} 15: the read's warnings as a list`,
      (await page.locator('[data-review-warning]').count()) === 1 && (await text(page.locator('[data-review-warning]'))) === 'Campaigns!4:NameAr The Arabic name of OF3 was generated.',
    )
    check(`${tag} 15: no last review on a pending upload`, (await page.locator('[data-review-last]').count()) === 0)

    await page.locator('[data-review-campaigns-grid] .ag-row').first().waitFor({ timeout: 10000 })
    const camps = await page.locator('[data-review-campaigns-grid] .ag-row').evaluateAll((rows) =>
      rows
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
        .map((r) => {
          const cell = (id) => r.querySelector(`[col-id="${id}"]`).innerText.replace(/[⁦-⁩]/g, '').trim()
          return `${cell('id').split('-').pop()}:${cell('stacking')}:${r.querySelector('[data-review-change]')?.getAttribute('data-review-change')}`
        }),
    )
    check(`${tag} 15: new, changed and unchanged (keys reordered), compete / stacks`, camps.join(',') === 'OF1:compete:new,OF2:compete:changed,OF3:stacks:unchanged', camps.join(','))
    const disabling = page.locator('[data-review-disabling]').first()
    check(`${tag} 15: two disabling rows, red`, (await disabling.getAttribute('data-review-disabling')) === '2' && /danger/.test(await disabling.getAttribute('class')))
    check(
      `${tag} 15: "Activating disables these 2 live campaigns."`,
      (await text(page.locator('[data-review-disabling-title]'))) === 'Activating disables these 2 live campaigns.',
      await text(page.locator('[data-review-disabling-title]')),
    )
    check(`${tag} 20: no would-refuse lines when HQ sends none`, (await page.locator('[data-review-would-refuse]').count()) === 0)
    // AG Grid's own widget inputs (its focus and filter plumbing) are not the upload's.
    const editable = await page.evaluate(
      () => [...document.querySelectorAll('[data-campaign-upload-review] input, [data-campaign-upload-review] textarea, [data-campaign-upload-review] [contenteditable="true"]')].filter((e) => !e.closest('.ag-root-wrapper')).length,
    )
    check(`${tag} 15: nothing of the upload is editable`, editable === 0, String(editable))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-opened.png`, fullPage: true })

    // 16: side by side
    await page.locator('[data-review-campaigns-grid] .ag-row[row-index="1"] [col-id="id"]').click()
    const sheet = page.locator(`[data-upload-json="${DEAL}-OF2"]`)
    await sheet.waitFor({ timeout: 5000 })
    const up = JSON.parse(await sheet.locator('[data-upload-json-side="uploaded"] [data-upload-json-body]').innerText())
    const live = JSON.parse(await sheet.locator('[data-upload-json-side="live"] [data-upload-json-body]').innerText())
    check(`${tag} 16: a changed campaign opens uploaded beside live`, up.name.ar === 'واقي الشمس OF2' && live.name.ar === 'واقي الشمس القديم')
    check(`${tag} 16: both JSON panels are LTR islands, read only`, (await sheet.locator('pre[dir="ltr"]').count()) === 2 && (await sheet.locator('input, textarea, [contenteditable="true"]').count()) === 0)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-compare.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.locator(`[data-review-compare="${DEAL}-OF1"]`).click()
    await page.locator(`[data-upload-json="${DEAL}-OF1"]`).waitFor({ timeout: 5000 })
    check(`${tag} 16: a new campaign: nothing live beside it`, (await text(page.locator('[data-upload-json-side="live"] [data-upload-json-none]'))) === 'Not live: the activation adds it.')
    await page.locator('[data-upload-json-close]').click()
    await page.waitForTimeout(200)
    await page.locator(`[data-review-disabling-view="${DEAL}-OF8"]`).click()
    await page.locator(`[data-upload-json="${DEAL}-OF8"]`).waitFor({ timeout: 5000 })
    check(
      `${tag} 16: a disabling row: the live campaign, nothing uploaded`,
      (await text(page.locator('[data-upload-json-side="uploaded"] [data-upload-json-none]'))) === 'Not in the upload: the activation disables it.' &&
        JSON.parse(await page.locator('[data-upload-json-side="live"] [data-upload-json-body]').innerText()).id === `${DEAL}-OF8`,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // 17: Activate
    await page.locator('[data-review-action="activate"]').click()
    const dialog = page.locator('[data-review-dialog="activate"]')
    await dialog.waitFor({ timeout: 5000 })
    check(
      `${tag} 17: the dialog names the deal and the revision`,
      (await text(dialog.locator('p').first())) === `Activate deal ${DEAL}, revision 3, as one version: every campaign of it goes live together.`,
      await text(dialog.locator('p').first()),
    )
    check(`${tag} 17: it repeats the counts`, (await text(page.locator('[data-review-counts]'))) === '3 campaigns: 1 new, 1 changed, 1 unchanged.', await text(page.locator('[data-review-counts]')))
    const ids = await dialog.locator('[data-review-disabling-id]').evaluateAll((l) => l.map((x) => x.getAttribute('data-review-disabling-id')))
    check(`${tag} 17: …and the disabling list`, ids.join(',') === `${DEAL}-OF8,${DEAL}-OF9`, ids.join(','))
    check(`${tag} 17: the note is optional`, !(await page.locator('[data-review-confirm]').isDisabled()))
    const loadsBefore = loadsOf(calls)
    await page.locator('[data-review-confirm]').click()
    const done = page.locator('[data-review-activated-line]')
    await done.waitFor({ timeout: 10000 })
    const asked = calls.find((c) => c.p === 'Rules/Authoring/Uploads/Activate')
    check(`${tag} 17: Activate sends the loaded revision, no blank note`, JSON.stringify(asked?.body) === JSON.stringify({ dealCode: DEAL, revision: 3 }), JSON.stringify(asked?.body))
    check(`${tag} 17: "Version 42 is live: 3 campaigns activated, 2 disabled."`, (await text(done)) === 'Version 42 is live: 3 campaigns activated, 2 disabled.', await text(done))
    check(`${tag} 17: each number isolated`, (await done.locator('bdi[dir="ltr"]').count()) === 3)
    check(`${tag} 17: who published it, and when`, (await text(page.locator('[data-review-activated-by]'))) === `Published by ${ME} at 2026-10-19 10:00.`, await text(page.locator('[data-review-activated-by]')))
    check(`${tag} 17: the checker's warnings`, (await page.locator('[data-review-activated-warnings]').getAttribute('data-review-activated-warnings')) === '1')
    await page.waitForFunction(() => document.querySelector('[data-review-header] [data-upload-state]')?.getAttribute('data-upload-state') === 'activated', null, { timeout: 10000 })
    check(`${tag} 17: the upload is loaded again and reads activated`, loadsOf(calls) > loadsBefore && (await page.locator('[data-review-dialog]').count()) === 0)
    check(
      `${tag} 17: the last review shows the version; no buttons on an activated upload`,
      (await text(page.locator('[data-review-last] [data-upload-fact="versionNo"] dd'))) === '42' && (await page.locator('[data-review-actions]').count()) === 0,
    )
    check(`${tag} 21: no raw key, no page error (activated)`, !(await rawKey532(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-activated.png`, fullPage: true })
    await context.close()
  }

  // ── 18: Send back ──
  {
    const { context, page, calls } = await openUpload(dir, { sendBack: 'reason' })
    await page.locator('[data-review-action="sendBack"]').click()
    const dialog = page.locator('[data-review-dialog="sendBack"]')
    await dialog.waitFor({ timeout: 5000 })
    check(
      `${tag} 18: Send back names who reads the note`,
      (await text(dialog.locator('p').first())) === `Send deal ${DEAL}, revision 3, back to author1. Nothing is published; the deal's next upload replaces it.`,
      await text(dialog.locator('p').first()),
    )
    check(`${tag} 18: without a note it is not sent`, (await page.locator('[data-review-confirm]').isDisabled()) && (await text(page.locator('[data-review-note-required]'))) === 'A note is required.')
    await page.locator('[data-review-note]').fill('   ')
    check(`${tag} 18: spaces are no note`, await page.locator('[data-review-confirm]').isDisabled())
    const loadsBefore = loadsOf(calls)
    await page.locator('[data-review-note]').fill('x')
    await page.locator('[data-review-confirm]').click()
    const refused = page.locator('[data-review-refusal="sendBack"]')
    await refused.waitFor({ timeout: 10000 })
    check(
      `${tag} 18: HQ's RULES_REASON_REQUIRED reads in the dialog`,
      (await refused.getAttribute('data-review-refusal-reason')) === 'reasonRequired' && (await refused.locator('[data-review-refusal-code="RULES_REASON_REQUIRED"]').count()) === 1,
    )
    check(`${tag} 18: …the upload left as it was`, (await stateFact(page)) === 'Pending' && loadsOf(calls) === loadsBefore)
    await context.close()
  }
  {
    const { context, page, calls } = await openUpload(dir)
    await page.locator('[data-review-action="sendBack"]').click()
    await page.locator('[data-review-note]').fill(' The window is a week late. ')
    await page.locator('[data-review-confirm]').click()
    await page.locator('[data-review-sent-back]').waitFor({ timeout: 10000 })
    const asked = calls.find((c) => c.p === 'Rules/Authoring/Uploads/SendBack')
    check(
      `${tag} 18: Send back sends the loaded revision and the note`,
      JSON.stringify(asked?.body) === JSON.stringify({ dealCode: DEAL, revision: 3, note: 'The window is a week late.' }),
      JSON.stringify(asked?.body),
    )
    await page.locator('[data-review-last]').waitFor({ timeout: 10000 })
    check(
      `${tag} 18: the upload shows sentBack and the note`,
      (await stateFact(page)) === 'Sent back' && (await text(page.locator('[data-review-last] [data-upload-fact="reviewNote"] dd'))) === 'The window is a week late.',
    )
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-sent-back.png`, fullPage: true })
    await context.close()
  }

  // ── 19: refusals in the dialog, the upload unchanged ──
  const refuse = async (mode, run) => {
    const o = await openUpload(dir, { activate: mode })
    await o.page.locator('[data-review-action="activate"]').click()
    await o.page.locator('[data-review-confirm]').click()
    const r = o.page.locator('[data-review-refusal="activate"]')
    await r.waitFor({ timeout: 10000 })
    const unchanged =
      (await o.page.locator('[data-review-dialog="activate"]').count()) === 1 &&
      (await stateFact(o.page)) === 'Pending' &&
      (await o.page.locator('[data-review-activated]').count()) === 0 &&
      loadsOf(o.calls) === 1
    await run(o, r, unchanged)
    await o.context.close()
  }
  await refuse('self', async ({ page }, r, unchanged) => {
    check(
      `${tag} 19: RULES_SELF_APPROVAL in the dialog`,
      (await r.getAttribute('data-review-refusal-reason')) === 'selfApproval' &&
        (await text(r)).includes('You made this revision of the upload: another approver must activate it or send it back.') &&
        (await r.locator('[data-review-refusal-code="RULES_SELF_APPROVAL"]').count()) === 1,
      await text(r),
    )
    check(`${tag} 19: …with HQ's own message under our words`, (await text(r.locator('[data-review-refusal-message]'))) === 'The uploader cannot activate their own upload.')
    check(`${tag} 19: …the upload unchanged`, unchanged)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-self.png` })
  })
  await refuse('stale', async ({ page, calls }, r, unchanged) => {
    check(`${tag} 19: RULES_UPLOAD_STALE in the dialog, with a reload`, (await r.getAttribute('data-review-refusal-reason')) === 'uploadStale' && (await r.locator('[data-review-reload]').count()) === 1, await text(r))
    check(`${tag} 19: …the upload unchanged`, unchanged)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-stale.png` })
    await r.locator('[data-review-reload]').click()
    await page.waitForTimeout(500)
    check(`${tag} 19: Load it again closes the dialog and loads the upload`, (await page.locator('[data-review-dialog]').count()) === 0 && loadsOf(calls) === 2)
  })
  await refuse('invalid', async ({ page }, r, unchanged) => {
    const lines = (await r.locator('[data-review-refusal-details] li').allInnerTexts()).map((l) => l.replace(/[⁦-⁩]/g, ''))
    check(`${tag} 19: RULES_INVALID_CAMPAIGN lists HQ's lines, one each`, lines.join('|') === INVALID_LINES.join('|'), lines.join('|'))
    check(`${tag} 19: …and HQ's message`, (await text(r.locator('[data-review-refusal-message]'))) === 'The checker refuses the upload on version 41.')
    check(`${tag} 19: …the upload unchanged`, unchanged)
    await r.locator('[data-review-send-back]').click()
    check(`${tag} 19: Send it back opens the Send back dialog`, (await page.locator('[data-review-dialog="sendBack"]').count()) === 1)
  })
  await refuse('denied', async (_o, r, unchanged) => {
    check(`${tag} 19: a bare 403 on Activate reads "${DENIED}"`, (await text(r)).includes(DENIED) && (await r.getAttribute('data-upload-denied')) === '' && unchanged, await text(r))
  })

  // ── 20: would-refuse lines, Load refused ──
  {
    const { context, page, errors } = await openUpload(dir, { load: 'refuse' })
    const lines = (await page.locator('[data-review-would-refuse-line]').allInnerTexts()).map((l) => l.replace(/[⁦-⁩]/g, ''))
    check(`${tag} 20: the would-refuse lines, the stale-order line first`, lines.length === 2 && lines[0] === STALE_LINE, lines.join('|'))
    const above = await page.evaluate(() => {
      const r = document.querySelector('[data-review-would-refuse]')
      const b = document.querySelector('[data-review-actions]')
      return !!(r && b && r.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    check(`${tag} 20: …above the buttons`, above)
    check(`${tag} 21: no raw key, no page error (would refuse)`, !(await rawKey532(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/532-${dir}-would-refuse.png`, fullPage: true })
    await context.close()
  }
  {
    const { context, page } = await open532(dir, `${UPLOADS}/0009999999-000000-000000`)
    const failed = page.locator('[data-review-failed]')
    await failed.waitFor({ timeout: 20000 })
    check(
      `${tag} 20: a stale link reads RULES_UPLOAD_NOT_FOUND in our words`,
      (await failed.getAttribute('data-review-failed')) === 'notFound' && (await text(failed)) === 'There is no campaign upload of this deal: the link may be stale.',
      await text(failed),
    )
    await context.close()
  }
  {
    const { context, page } = await openUpload(dir, { load: 'denied' })
    const failed = page.locator('[data-review-failed]')
    check(`${tag} 20: a bare 403 on Load reads "${DENIED}", never an empty upload`, (await text(failed)) === DENIED && (await page.locator('[data-review-summary]').count()) === 0, await text(failed))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await drive532('ltr')
await drive532('rtl')
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
