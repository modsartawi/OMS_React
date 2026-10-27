// Action-types drive (BackOffice spec 3148, ticket 3155) — drives the REAL Action types page and its save dialog in
// Chromium against STUBBED, stateful `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice
// `SdDocTypeConfigAdminModels.ActionTypes.cs` (spec3148). 🚩 NOTHING here is driven against a live SIS.Api. Never point
// this at a real host.
//
// It verifies, in LTR and RTL:
//   1. no category picked: the picker and a hint; picking O writes `?category=O` and shows its action types with their
//      five options, and EVERY document type and delivery type in the category, grouped by kind;
//   2. without the edit grant there is no Edit; with it, Edit opens the dialog: code and category locked, the
//      description and five options editable, Save disabled until a change AND a reason; an Arabic description is
//      refused here; the diff shows only what changed; the dialog repeats the page's affected types;
//   3. Save sends `{ before, after, reason }` (before = the row as loaded, reason trimmed) to
//      `PUT ActionTypes/{code}`, the page re-reads, the option shows on; a stale save (SDC-00004) says so;
//   4. the History tab (`?tab=history`) reads the category's History door and shows the action-type row;
//   5. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5263 --strictPort
//   2. DRIVE_PORT=5263 node tools/action-types-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5263}`
const RAW = /\b(fields|actionTypes|affected|kinds|tabs|entityTypes|actions|access|value|edit|reason|dialog)\.[a-zA-Z]+\b/

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const at = (code, description, over = {}) => ({
  actionType: code, description, documentCategory: 'O', updateLastAction: false, deactivateDocument: false,
  activateDocument: false, completeDocument: false, allowedWhenCompleted: false, ...over,
})
const AFFECTED_O = [
  { documentType: 'WSFD', description: 'Wasfaty delivery', kind: 'DocumentType' },
  { documentType: 'BUPA', description: 'بوبا للتأمين', kind: 'DocumentType' },
  { documentType: 'CASH', description: 'Cash sale', kind: 'DocumentType' },
]
const HISTORY = [
  {
    changeId: '01', entityType: 'ActionType', entityKey: 'OCAN|O', documentType: '', action: 'Update', copiedFrom: '',
    reason: 'سبب التغيير', changedBy: 'msartawi', changedAt: '2026-10-27T10:15:00',
    beforeJson: JSON.stringify({ ActionType: 'OCAN', Description: 'Order cancel', DocumentCategory: 'O', CompleteDocument: false }),
    afterJson: JSON.stringify({ ActionType: 'OCAN', Description: 'Order cancel', DocumentCategory: 'O', CompleteDocument: true }),
  },
]

const browser = await chromium.launch()

async function open(dir, { canEdit = true, stale = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const rows = { OADN: at('OADN', 'Order Add Note', { allowedWhenCompleted: true }), OCAN: at('OCAN', 'Order cancel', { updateLastAction: true, deactivateDocument: true }) }
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
    const body = req.postData() ? JSON.parse(req.postData()) : null
    calls.push({ method: req.method(), p, body })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: false, canOpenDetail: false }))
    if (p === 'SdDocTypeConfigWeb/Access') return route.fulfill(envelope({ canViewDocTypeConfig: true, canEditDocTypeConfig: canEdit }))
    if (p === 'SdDocTypeConfigWeb/ActionTypeCategories') return route.fulfill(envelope(['D', 'O', 'T', 'X']))
    if (p === 'SdDocTypeConfigWeb/ActionTypeCategories/O')
      return route.fulfill(envelope({ category: 'O', actionTypes: Object.values(rows), affectedTypes: AFFECTED_O }))
    if (p === 'SdDocTypeConfigWeb/ActionTypeCategories/D')
      return route.fulfill(envelope({ category: 'D', actionTypes: [at('DLAS', 'Delivery assigned', { documentCategory: 'D' })],
        affectedTypes: [{ documentType: 'DL', description: 'Delivery', kind: 'DeliveryDocumentType' }] }))
    if (p === 'SdDocTypeConfigWeb/ActionTypeCategories/O/History') return route.fulfill(envelope(HISTORY))
    if (req.method() === 'PUT' && p.startsWith('SdDocTypeConfigWeb/ActionTypes/')) {
      if (stale)
        return route.fulfill(envelope(null, { status: 400, success: false, errorCode: 'SDC-00004', message: 'changed by someone else / تم التغيير' }))
      const code = decodeURIComponent(p.split('/').at(-1))
      rows[code] = { ...body.after }
      return route.fulfill(envelope(rows[code]))
    }
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls }
}

const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '').trim()
const codes = (loc) => loc.evaluateAll((els) => els.map((e) => e.getAttribute('data-affected-type')))

for (const dir of ['ltr', 'rtl']) {
  // 1 + 2 + 3: the page, the dialog, the save
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/admin/action-types`)
    await page.locator('[data-action-types-pick]').waitFor({ timeout: 20000 }).catch(async (e) => {
      console.log('DEBUG', errors.join(' | '), (await page.locator('body').innerText()).slice(0, 600))
      throw e
    })
    check(`${dir} 1. no category: the picker and a hint`, (await page.locator('[data-action-types-category] option').count()) === 5)
    check(`${dir} 5. no raw keys (picker)`, !RAW.test(await page.locator('main').innerText()))
    await page.locator('[data-action-types-category]').selectOption('O')
    await page.locator('[data-action-type="OCAN"]').waitFor({ timeout: 5000 })
    check(`${dir} 1. picking O writes ?category=O`, new URL(page.url()).search === '?category=O', page.url())
    check(`${dir} 1. its action types`, (await page.locator('[data-action-type]').count()) === 2)
    check(`${dir} 1. …with their five options`,
      (await page.locator('[data-action-type="OCAN"] [data-option]').count()) === 5 &&
      (await page.locator('[data-action-type="OCAN"] [data-option="deactivateDocument"]').getAttribute('data-on')) === 'true' &&
      (await page.locator('[data-action-type="OCAN"] [data-option="completeDocument"]').getAttribute('data-on')) === 'false')
    const pageList = page.locator('[data-affected-types="page"]')
    check(`${dir} 1. the page names every type in the category, by code`,
      JSON.stringify(await codes(pageList.locator('[data-affected-type]'))) === JSON.stringify(['BUPA', 'CASH', 'WSFD']) &&
      (await pageList.getAttribute('data-affected-count')) === '3', JSON.stringify(await codes(pageList.locator('[data-affected-type]'))))
    check(`${dir} 1. …an Arabic description reads as written`, (await text(pageList.locator('[data-affected-type="BUPA"] bdi').last())) === 'بوبا للتأمين')
    await page.locator('[data-action-types-category]').selectOption('D')
    await page.locator('[data-action-type="DLAS"]').waitFor({ timeout: 5000 })
    check(`${dir} 1. a delivery category names its delivery types`,
      (await page.locator('[data-affected-types="page"] [data-affected-kind="DeliveryDocumentType"] [data-affected-type="DL"]').count()) === 1)
    await page.locator('[data-action-types-category]').selectOption('O')
    await page.locator('[data-action-type="OCAN"]').waitFor({ timeout: 5000 })

    await page.locator('[data-action-type-edit="OCAN"]').click()
    const dialog = page.locator('[data-action-edit-dialog]')
    await dialog.waitFor({ timeout: 5000 })
    check(`${dir} 2. code and category locked`,
      (await dialog.locator('[data-action-edit-locked="actionType"]').count()) === 1 &&
      (await dialog.locator('[data-action-edit-locked="documentCategory"]').count()) === 1 &&
      (await dialog.locator('[data-action-edit-locked] input').count()) === 0)
    check(`${dir} 2. the description and five options are editable`,
      (await dialog.locator('[data-action-edit-description]').count()) === 1 && (await dialog.locator('input[type="checkbox"]').count()) === 5)
    const save = page.locator('[data-action-edit-save]')
    check(`${dir} 2. Save waits for a change`, await save.isDisabled())
    check(`${dir} 2. the dialog repeats the page's affected types`,
      JSON.stringify(await codes(dialog.locator('[data-affected-types="dialog"] [data-affected-type]'))) === JSON.stringify(['BUPA', 'CASH', 'WSFD']))
    await dialog.locator('[data-action-edit-field="completeDocument"] input').check()
    check(`${dir} 2. …and a reason`, await save.isDisabled())
    check(`${dir} 2. the diff shows only what changed`,
      JSON.stringify(await dialog.locator('[data-action-edit-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action-edit-change')))) ===
        JSON.stringify(['completeDocument']))
    await dialog.locator('[data-action-edit-description]').fill('إلغاء')
    await dialog.locator('[data-action-edit-reason]').fill('  الطلب مكتمل  ')
    check(`${dir} 2. an Arabic description is refused here`,
      (await dialog.locator('[data-action-edit-description-problem="notPlainText"]').count()) === 1 && (await save.isDisabled()))
    await dialog.locator('[data-action-edit-description]').fill('Order cancel')
    check(`${dir} 2. a change and a reason enable Save`, await save.isEnabled())
    check(`${dir} 5. no raw keys (dialog)`, !RAW.test(await page.locator('body').innerText()))
    await save.click()
    await dialog.waitFor({ state: 'detached', timeout: 5000 })
    const put = calls.find((c) => c.method === 'PUT')
    check(`${dir} 3. the save sends before, after and the trimmed reason`,
      put?.p === 'SdDocTypeConfigWeb/ActionTypes/OCAN' &&
      put.body.before.completeDocument === false && put.body.before.deactivateDocument === true &&
      put.body.after.completeDocument === true && put.body.after.description === 'Order cancel' && put.body.reason === 'الطلب مكتمل',
      JSON.stringify(put))
    await page.waitForTimeout(300)
    check(`${dir} 3. the page re-reads: the option shows on`,
      (await page.locator('[data-action-type="OCAN"] [data-option="completeDocument"]').getAttribute('data-on')) === 'true')

    // 4. History
    await page.locator('[data-tab="history"]').click()
    await page.locator('[data-history-tab]').waitFor({ timeout: 5000 })
    check(`${dir} 4. History writes ?tab=history and keeps the category`, new URL(page.url()).search === '?category=O&tab=history', page.url())
    check(`${dir} 4. it reads the category's History door`, calls.some((c) => c.p === 'SdDocTypeConfigWeb/ActionTypeCategories/O/History'))
    check(`${dir} 4. …and shows the action-type row with its diff`,
      (await page.locator('[data-change="01"]').count()) === 1 &&
      (await text(page.locator('[data-change="01"] [data-change-key]'))).includes('OCAN|O') &&
      (await page.locator('[data-change="01"] [data-diff-field="CompleteDocument"]').count()) === 1)
    check(`${dir} 5. no raw keys (history)`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2. without the grant: no Edit
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/admin/action-types?category=O`)
    await page.locator('[data-action-type="OCAN"]').waitFor({ timeout: 20000 })
    check(`${dir} 2. without the grant there is no Edit`, (await page.locator('[data-action-type-edit]').count()) === 0)
    check(`${dir} 2. …but the affected types are still named`, (await page.locator('[data-affected-types="page"] [data-affected-type]').count()) === 3)
    check(`${dir} 5. no page errors (read-only)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 3. a stale save
  {
    const { context, page, errors } = await open(dir, { stale: true })
    await page.goto(`${BASE}/admin/action-types?category=O`)
    await page.locator('[data-action-type-edit="OADN"]').click()
    const dialog = page.locator('[data-action-edit-dialog]')
    await dialog.locator('[data-action-edit-field="updateLastAction"] input').check()
    await dialog.locator('[data-action-edit-reason]').fill('why')
    await page.locator('[data-action-edit-save]').click()
    await dialog.locator('[data-action-edit-error="SDC-00004"]').waitFor({ timeout: 5000 })
    check(`${dir} 3. a stale save says so and stays open, Save disabled`,
      (await dialog.count()) === 1 && (await page.locator('[data-action-edit-save]').isDisabled()))
    check(`${dir} 5. no page errors (stale)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
