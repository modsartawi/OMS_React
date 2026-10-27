// Delivery document types drive (BackOffice spec 3148, ticket 3154) — drives the REAL delivery type pages and dialog,
// and the document type edit dialog's default delivery type, in Chromium against STUBBED, STATEFUL
// `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice `SdDocTypeConfigAdminModels.DeliveryTypes.cs` (spec3148).
// 🚩 NOTHING here is driven against a live SIS.Api. Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. the list shows every delivery type and opens one; without the grant there is no Edit / Copy;
//   2. the detail shows both groups, code + category marked locked, and the courier assignments (every-plant row named);
//   3. Edit: code + category read-only; Save waits for a change and a reason; the PUT carries before / after / trimmed
//      reason; the diff names the changed field;
//   4. a refused setting (SDC-00010, ServingListId SDC-00052) shows on its field; a stale save (SDC-00004) says so;
//   5. Copy: blank code + description, category editable; an existing code blocks Save; the POST carries the code
//      upper-case; the page moves to the new type;
//   6. the History tab reads the delivery type's own door and labels a courier row's kind;
//   7. the document type edit dialog's default delivery type is a dropdown of the delivery types;
//   8. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5274 --strictPort
//   2. DRIVE_PORT=5274 node tools/delivery-types-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5274}`
const RAW = /\b(fields|groups|edit|copy|blockers|deliveryTypes|couriers|categories|columns|detail|access|reason|dialog|value|entityTypes)\.[a-zA-Z_]+\b/

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
const refuse = (errorCode, message, data = null) => envelope(data, { status: 400, success: false, message, errorCode })

const delivery = (over = {}) => ({
  documentType: 'QC', description: 'Quick Commerce', documentCategory: 'D', numberRangeNumber: '', defaultDocumentType: '',
  isCompeted: true, calloutRadiusKm: 3, calloutStockCheck: false, calloutLocksDelivery: false, calloutLifetimeMinutes: 5,
  calloutDutyCheck: false, servingListId: '', ...over,
})
const docType = {
  documentType: 'CASH', description: 'Cash order', documentCategory: 'O', referenceDocumentCategory: '', numberRangeNumber: '01',
  customerDeterminationType: '', defaultCustomer: '', isReceivableCustomer: false, receivableCustomer: '', insurancePayerCode: '',
  engineType: '', documentPricingProcedure: '1', promotionDetermination: false, isAlternativePriceCapped: false,
  defaultDeliveryType: 'DL', createDeliveryImmediately: '', plantDeterminationType: '', isCalculateDeliveryFees: false, deliveryFees: 0,
  orderRelatedBillingType: '', deliveryRelatedBillingType: '', createBillingImmediately: '', isPickedOnOrder: false,
  isDeterminePickingFees: false, isQuantityAllocation: true, notifyOnCreation: 'X', notifyOnCancellation: 'X', controlType: '',
  validateItem: false, preOrderMaterialOnly: false, checkOrderNo: false, canChangeItems: true, autoClose: false,
  diagnosisRequired: false, approvalProcess: false, acceptanceRequired: false,
}
const HISTORY = [
  {
    changeId: '01K0000000000000000000002', entityType: 'CourierAssignment', entityKey: 'QC|', documentType: 'QC', action: 'Copy',
    copiedFrom: 'DL', reason: 'new lane', changedBy: 'msartawi', changedAt: '2026-10-27T10:00:00',
    beforeJson: '', afterJson: '{"DocumentType":"QC","DeliveringPlant":"","CourierCode":"OTOX"}',
  },
  {
    changeId: '01K0000000000000000000001', entityType: 'DeliveryDocumentType', entityKey: 'QC', documentType: 'QC', action: 'Update',
    copiedFrom: '', reason: 'callouts on', changedBy: 'msartawi', changedAt: '2026-10-27T09:00:00',
    beforeJson: '{"IsCompeted":false}', afterJson: '{"IsCompeted":true}',
  },
]

const browser = await chromium.launch()

async function open(dir, { canEdit = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const force = new Map()
  const types = new Map([
    ['DL', delivery({ documentType: 'DL', description: 'Delivery', isCompeted: false, calloutRadiusKm: 0, calloutLifetimeMinutes: 0 })],
    ['QC', delivery()],
  ])
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
    const method = req.method()
    let body = null
    try {
      body = req.postData() ? JSON.parse(req.postData()) : null
    } catch {
      body = req.postData()
    }
    calls.push({ method, p, body })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: false, canOpenDetail: false }))
    if (p === 'SdDocTypeConfigWeb/Access') return route.fulfill(envelope({ canViewDocTypeConfig: true, canEditDocTypeConfig: canEdit }))
    const forced = force.get(`${method} ${p}`)
    if (forced) {
      force.delete(`${method} ${p}`)
      return route.fulfill(forced)
    }
    const BASE_P = 'SdDocTypeConfigWeb/DeliveryDocumentTypes'
    if (p === BASE_P && method === 'GET')
      return route.fulfill(envelope([...types.values()].map((t) => ({ documentType: t.documentType, description: t.description, documentCategory: t.documentCategory, isCompeted: t.isCompeted }))))
    const sub = p.match(/^SdDocTypeConfigWeb\/DeliveryDocumentTypes\/([^/]+)(?:\/(\w+))?$/)
    if (sub) {
      const code = decodeURIComponent(sub[1])
      if (sub[2] === 'CourierAssignments')
        return route.fulfill(envelope(code === 'QC' ? [{ documentType: 'QC', deliveringPlant: '', courierCode: 'OTOX' }, { documentType: 'QC', deliveringPlant: 'E001', courierCode: 'FREY' }] : []))
      if (sub[2] === 'History') return route.fulfill(envelope(code === 'QC' ? HISTORY : []))
      if (sub[2] === 'Copy' && method === 'POST') {
        const saved = { ...body.after }
        types.set(saved.documentType, saved)
        return route.fulfill(envelope(saved))
      }
      if (method === 'PUT') {
        const saved = { ...body.after }
        types.set(code, saved)
        return route.fulfill(envelope(saved))
      }
      const t = types.get(code)
      return route.fulfill(t ? envelope(t) : refuse('SDC-00050', `Delivery type ${code} does not exist. / نوع التوصيل غير موجود.`))
    }
    if (p === 'SdDocTypeConfigWeb/DocumentTypes' && method === 'GET')
      return route.fulfill(envelope([{ documentType: 'CASH', description: 'Cash order', documentCategory: 'O', engineType: '' }]))
    if (p === 'SdDocTypeConfigWeb/DocumentTypes/CASH' && method === 'GET') return route.fulfill(envelope(docType))
    if (p === 'SdDocTypeConfigWeb/DocumentTypeFields') return route.fulfill(envelope([]))
    if (/\/(ItemCategoryAssignments|PlantNetworks|History)$/.test(p) || /(ItemCategories|PlantNetworkIds|CodeOnlyBehaviour)$/.test(p)) return route.fulfill(envelope([]))
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls, force }
}

const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '')
const dlg = (page, mode) => page.locator(`dialog[open] [data-delivery-dialog="${mode}"]`)
const field = (page, f) => page.locator(`dialog[open] [data-delivery-dialog] [data-edit-field="${f}"]`)
const saveDisabled = (page) => page.locator('[data-delivery-save]').isDisabled()

for (const dir of ['ltr', 'rtl']) {
  // 1. read-only
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/admin/delivery-types`)
    await page.locator('[data-delivery-types]').waitFor({ timeout: 20000 }).catch(async (e) => {
      console.log('DEBUG', errors.join(' | '), (await page.locator('body').innerText()).slice(0, 600))
      throw e
    })
    check(`${dir} 1. the list shows every delivery type`, (await page.locator('[data-delivery-type-row]').count()) === 2)
    await page.locator('[data-delivery-type-link="QC"]').click()
    await page.locator('[data-delivery-type="QC"]').waitFor({ timeout: 10000 })
    check(`${dir} 1. a code opens the type`, page.url().endsWith('/admin/delivery-types/QC'))
    check(`${dir} 1. no Edit / Copy without the grant`,
      (await page.locator('[data-delivery-type-edit]').count()) === 0 && (await page.locator('[data-delivery-type-copy]').count()) === 0)
    check(`${dir} 2. both groups`, (await page.locator('[data-delivery-type-group]').count()) === 2)
    const locked = await page.locator('[data-delivery-type-field] [data-locked]').count()
    check(`${dir} 2. code and category marked locked`, locked === 2, String(locked))
    await page.locator('[data-courier-row]').first().waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 2. the courier assignments, the every-plant row named`,
      (await page.locator('[data-courier-row]').count()) === 2 && (await text(page.locator('[data-courier-row=""]'))).length > 4)
    check(`${dir} 8. no page errors (read-only)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 3-8. granted
  {
    const { context, page, errors, calls, force } = await open(dir)
    await page.goto(`${BASE}/admin/delivery-types/QC`)
    await page.locator('[data-delivery-type-edit]').waitFor({ timeout: 20000 })

    // 3. edit
    await page.locator('[data-delivery-type-edit]').click()
    await dlg(page, 'edit').waitFor({ timeout: 5000 })
    const lockedRows = await page.locator('dialog[open] [data-delivery-dialog] [data-edit-locked]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edit-field')).sort())
    check(`${dir} 3. code and category read-only`, JSON.stringify(lockedRows) === JSON.stringify(['documentCategory', 'documentType']), JSON.stringify(lockedRows))
    check(`${dir} 3. Save disabled with no change`, await saveDisabled(page))
    check(`${dir} 3. the number range is labelled not read by order processing, and only it (review finding 3)`,
      (await field(page, 'numberRangeNumber').locator('[data-edit-not-read]').count()) === 1 &&
        (await page.locator('dialog[open] [data-delivery-dialog] [data-edit-not-read]').count()) === 1)
    await field(page, 'calloutRadiusKm').locator('input').fill('4.5')
    check(`${dir} 3. the diff names the changed field`, (await page.locator('[data-edit-change="calloutRadiusKm"]').count()) === 1)
    check(`${dir} 3. Save disabled with no reason`, await saveDisabled(page))
    await page.locator('[data-delivery-reason]').fill('  wider radius  ')

    // 4. refusals
    force.set('PUT SdDocTypeConfigWeb/DeliveryDocumentTypes/QC', refuse('SDC-00010', 'refused', {
      fields: [{ field: 'ServingListId', errorCode: 'SDC-00052', message: "ServingListId 'X' is not a serving list. / ليست قائمة خدمة" }],
    }))
    await field(page, 'servingListId').locator('input').fill('X')
    await page.locator('[data-delivery-save]').click()
    await page.locator('[data-edit-refusal="SDC-00052"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. a refused setting shows on its field`, (await field(page, 'servingListId').locator('[data-edit-refusal="SDC-00052"]').count()) === 1)
    await field(page, 'servingListId').locator('input').fill('')
    force.set('PUT SdDocTypeConfigWeb/DeliveryDocumentTypes/QC', refuse('SDC-00004', 'Delivery type QC was changed by someone else. / تم تغيير'))
    await page.locator('[data-delivery-save]').click()
    await page.locator('[data-delivery-error="SDC-00004"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. a stale save says so and stops`, (await page.locator('[data-delivery-error="SDC-00004"]').count()) === 1 && (await saveDisabled(page)))
    await page.locator('[data-delivery-cancel]').click()
    await page.locator('[data-delivery-type-edit]').click()
    await dlg(page, 'edit').waitFor({ timeout: 5000 })
    await field(page, 'calloutRadiusKm').locator('input').fill('4.5')
    await page.locator('[data-delivery-reason]').fill('  wider radius  ')
    await page.locator('[data-delivery-save]').click()
    await dlg(page, 'edit').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const put = calls.filter((c) => c.method === 'PUT').at(-1)
    check(`${dir} 3. the PUT carries before, after and the trimmed reason`,
      put?.body.reason === 'wider radius' && put.body.before.calloutRadiusKm === 3 && put.body.after.calloutRadiusKm === 4.5 &&
      put.body.after.documentType === 'QC', JSON.stringify(put?.body))

    // 5. copy
    await page.locator('[data-delivery-type-copy]').click()
    await dlg(page, 'copy').waitFor({ timeout: 5000 })
    check(`${dir} 5. the copy starts with a blank code and description`,
      (await field(page, 'documentType').locator('input').inputValue()) === '' && (await field(page, 'description').locator('input').inputValue()) === '')
    check(`${dir} 5. nothing is locked in the copy; category is a dropdown`,
      (await page.locator('dialog[open] [data-delivery-dialog] [data-edit-locked]').count()) === 0 &&
      !(await field(page, 'documentCategory').locator('select').isDisabled()))
    await field(page, 'documentType').locator('input').fill('dl')
    check(`${dir} 5. an existing code blocks Save`, (await page.locator('[data-copy-blocker="codeExists"]').count()) === 1 && (await saveDisabled(page)))
    await field(page, 'documentType').locator('input').fill('qn')
    await field(page, 'description').locator('input').fill('Quick lane نسخة')
    await page.locator('[data-delivery-reason]').fill(' new lane ')
    await page.locator('[data-delivery-save]').click()
    await page.waitForURL('**/admin/delivery-types/QN', { timeout: 5000 }).catch(() => {})
    const post = calls.filter((c) => c.method === 'POST' && c.p.endsWith('/Copy')).at(-1)
    check(`${dir} 5. the POST carries the code upper-case and the trimmed reason`,
      post?.p === 'SdDocTypeConfigWeb/DeliveryDocumentTypes/QC/Copy' && post.body.after.documentType === 'QN' && post.body.reason === 'new lane' &&
      post.body.after.isCompeted === true, JSON.stringify(post?.body))
    await page.locator('[data-delivery-type="QN"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5. the page moves to the new type`, (await page.locator('[data-delivery-type="QN"]').count()) === 1)

    // 6. history
    await page.goto(`${BASE}/admin/delivery-types/QC?tab=history`)
    await page.locator('[data-history-tab]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 6. History reads the delivery type's own door`, calls.some((c) => c.p === 'SdDocTypeConfigWeb/DeliveryDocumentTypes/QC/History'))
    check(`${dir} 6. …and shows its rows, the courier row's kind labelled`,
      (await page.locator('[data-change]').count()) === 2 && !/CourierAssignment/.test(await page.locator('[data-history-tab]').innerText()))
    check(`${dir} 8. no raw keys (delivery pages)`, !RAW.test(await page.locator('main').innerText()))

    // 7. the document type form's default delivery type
    await page.goto(`${BASE}/admin/doc-types/CASH`)
    await page.locator('[data-doc-type-edit]').waitFor({ timeout: 20000 })
    await page.locator('[data-doc-type-edit]').click()
    await page.locator('dialog[open] [data-edit-dialog]').waitFor({ timeout: 5000 })
    const ddt = page.locator('dialog[open] [data-edit-field="defaultDeliveryType"] select[data-code-choice]')
    await ddt.waitFor({ timeout: 5000 }).catch(() => {})
    const values = await ddt.locator('option').evaluateAll((els) => els.map((e) => e.value))
    const labels = await ddt.locator('option').evaluateAll((els) => els.slice(1).map((e) => e.textContent))
    check(`${dir} 7. each code choice is ONE isolate around the whole pair (review F)`,
      labels.length > 0 && labels.every((l) => l.startsWith('⁨') && l.endsWith('⁩') && (l.match(/⁨/g) ?? []).length === 1), JSON.stringify(labels))
    check(`${dir} 7. default delivery type is a dropdown of the delivery types`,
      JSON.stringify(values) === JSON.stringify(['', 'DL', 'QC', 'QN']) && (await ddt.inputValue()) === 'DL', JSON.stringify(values))
    await page.locator('[data-edit-cancel]').click()
    check(`${dir} 8. no raw keys`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
