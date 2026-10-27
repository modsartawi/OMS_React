// Document-type configuration drive (BackOffice spec 3148, ticket 3149) — drives the REAL Document types pages in
// Chromium against STUBBED, STATEFUL `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice
// `SdDocTypeConfigAdminModels.cs` (spec3148). 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3149 is not
// deployed. Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. without the configuration grant (`canEditDocTypeConfig: false`): the list and the grouped detail read, and
//      there is no Edit;
//   2. the list filters by category and searches code or description; a row opens the type;
//   3. the detail shows all nine groups, code / category / engine marked locked;
//   4. edit: code, category and engine are read-only; nothing changed → no diff and Save disabled; a changed flag and
//      amount → the diff shows exactly those two; Save stays disabled without a reason; the PUT carries the loaded
//      before-state, the edited after-state and the trimmed reason; the detail shows the saved value;
//   5. a forced SDC-00004 (someone else saved) reads "changed by someone else", disables Save and re-reads the type;
//   6. no raw keys; no page errors;
//   7. (3150) coded settings are dropdowns of `DocumentTypeFields`' values; each changed field in the diff says open
//      orders / new orders only, the billing ones "not read by order processing"; a forced SDC-00010 shows each
//      refused field's message under that field.
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/doc-type-config-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`
const RAW = /\b(fields|groups|edit|list|detail|access|reason|dialog|value|effect|options)\.[a-zA-Z_]+\b/

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

const settings = (over = {}) => ({
  documentType: 'BUPA', description: 'Bupa insurance', documentCategory: 'O', referenceDocumentCategory: '',
  numberRangeNumber: '01', customerDeterminationType: 'C', defaultCustomer: '3795407', isReceivableCustomer: true,
  receivableCustomer: 'NOT-SET-UP', insurancePayerCode: 'BUPA', engineType: 'SISPRICING', documentPricingProcedure: '1',
  promotionDetermination: false, isAlternativePriceCapped: true, defaultDeliveryType: 'DL', createDeliveryImmediately: '',
  plantDeterminationType: '', isCalculateDeliveryFees: false, deliveryFees: 0, orderRelatedBillingType: '',
  deliveryRelatedBillingType: '', createBillingImmediately: '', isPickedOnOrder: true, isDeterminePickingFees: false,
  notifyOnCreation: 'X', notifyOnCancellation: 'X', isQuantityAllocation: true, controlType: '', validateItem: false, preOrderMaterialOnly: false, checkOrderNo: false,
  canChangeItems: true, autoClose: false, diagnosisRequired: false, approvalProcess: false, acceptanceRequired: false,
  ...over,
})
// `GET SdDocTypeConfigWeb/DocumentTypeFields` as BackOffice `SdDocumentTypeFieldCatalog` answers it (3150).
const meta = (field, effect, options = null, notReadByOrderProcessing = false) => ({ field, effect, options, notReadByOrderProcessing })
const FIELDS = [
  ['DocumentType', 'N'], ['Description', 'O'], ['DocumentCategory', 'O', ['O', 'R', 'X', 'E', 'Q']], ['ReferenceDocumentCategory', 'N', ['', 'O', 'R', 'X', 'E', 'Q', 'D', 'T']],
  ['NumberRangeNumber', 'N'], ['CustomerDeterminationType', 'N', ['', 'A', 'B', 'C', 'D']], ['DefaultCustomer', 'N'],
  ['IsReceivableCustomer', 'N'], ['ReceivableCustomer', 'N'], ['InsurancePayerCode', 'N'], ['EngineType', 'N', ['', 'LEGACY', 'SISPRICING']],
  ['DocumentPricingProcedure', 'O'], ['PromotionDetermination', 'O'], ['IsAlternativePriceCapped', 'O'], ['DefaultDeliveryType', 'O'],
  ['CreateDeliveryImmediately', 'O', ['', 'X']], ['PlantDeterminationType', 'N', ['', 'R']], ['IsCalculateDeliveryFees', 'O'],
  ['DeliveryFees', 'N'], ['OrderRelatedBillingType', 'O', null, true], ['DeliveryRelatedBillingType', 'O', null, true],
  ['CreateBillingImmediately', 'O', ['', 'X'], true], ['IsPickedOnOrder', 'O'], ['IsDeterminePickingFees', 'O'], ['IsQuantityAllocation', 'O'],
  ['NotifyOnCreation', 'N', ['', 'X']], ['NotifyOnCancellation', 'O', ['', 'X', 'O', 'D']], ['ControlType', 'O', ['', 'W', 'N']],
  ['ValidateItem', 'O'], ['PreOrderMaterialOnly', 'N'], ['CheckOrderNo', 'N'], ['CanChangeItems', 'O'], ['AutoClose', 'O'],
  ['DiagnosisRequired', 'N'], ['ApprovalProcess', 'O'], ['AcceptanceRequired', 'O'],
].map(([f, e, o = null, n = false]) => meta(f, e === 'O' ? 'OpenOrders' : 'NewOrdersOnly', o, n))
const LIST = [
  { documentType: 'BUPA', description: 'Bupa insurance', documentCategory: 'O', engineType: 'SISPRICING' },
  { documentType: 'CASH', description: 'Cash order', documentCategory: 'O', engineType: '' },
  { documentType: 'ORRT', description: 'Order return', documentCategory: 'R', engineType: '' },
  { documentType: 'WSFD', description: 'Wasfaty', documentCategory: 'X', engineType: '' },
]

const browser = await chromium.launch()

async function open(dir, { canEdit = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const force = new Map()
  const state = { bupa: settings() }
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
    // The shell's OMS probe expects an object; this session holds no other OMS screen.
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: false, canOpenDetail: false }))
    if (p === 'SdDocTypeConfigWeb/Access') return route.fulfill(envelope({ canViewDocTypeConfig: true, canEditDocTypeConfig: canEdit }))
    const forced = force.get(`${method} ${p}`)
    if (forced) {
      force.delete(`${method} ${p}`)
      return route.fulfill(forced)
    }
    if (p === 'SdDocTypeConfigWeb/DocumentTypes' && method === 'GET') return route.fulfill(envelope(LIST))
    if (p === 'SdDocTypeConfigWeb/DocumentTypeFields' && method === 'GET') return route.fulfill(envelope(FIELDS))
    if (p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA' && method === 'GET') return route.fulfill(envelope(state.bupa))
    if (p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA' && method === 'PUT') {
      state.bupa = { ...body.after }
      return route.fulfill(envelope(state.bupa))
    }
    // Every other screen's probe answers "no grant" (an object, as the shell expects); anything else is empty.
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls, force, state }
}

const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '')

for (const dir of ['ltr', 'rtl']) {
  // 1-3. read-only session
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/admin/doc-types`)
    await page.locator('[data-doc-types-grid] .ag-row').first().waitFor({ timeout: 20000 }).catch(async (e) => {
      console.log('DEBUG', errors.join(' | '), (await page.locator('body').innerText()).slice(0, 600))
      throw e
    })
    check(`${dir} 2. the list shows every type`, (await page.locator('[data-doc-types-grid] .ag-row').count()) === 4)
    await page.locator('[data-doc-types-category]').selectOption('O')
    check(`${dir} 2. category O keeps BUPA and CASH`, (await page.locator('[data-doc-types-grid] .ag-row').count()) === 2)
    await page.locator('[data-doc-types-search]').fill('bupa')
    check(`${dir} 2. search narrows to BUPA`, (await page.locator('[data-doc-types-grid] .ag-row').count()) === 1)
    await page.locator('[data-doc-types-grid] .ag-row').first().click()
    await page.locator('[data-doc-type="BUPA"]').waitFor({ timeout: 10000 })
    check(`${dir} 2. a row opens the type`, page.url().endsWith('/admin/doc-types/BUPA'))
    check(`${dir} 3. all nine groups`, (await page.locator('[data-doc-type-group]').count()) === 9)
    const locked = await page.locator('[data-doc-type-field] [data-locked]').evaluateAll((els) => els.map((e) => e.closest('[data-doc-type-field]').getAttribute('data-doc-type-field')))
    check(`${dir} 3. code, category and engine are marked locked`, JSON.stringify(locked.sort()) === JSON.stringify(['documentCategory', 'documentType', 'engineType']), JSON.stringify(locked))
    check(`${dir} 1. no Edit without the grant`, (await page.locator('[data-doc-type-edit]').count()) === 0)
    check(`${dir} 6. no raw keys (read-only)`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 6. no page errors (read-only)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 4-5. granted session
  {
    const { context, page, errors, calls, force, state } = await open(dir)
    await page.goto(`${BASE}/admin/doc-types/BUPA`)
    await page.locator('[data-doc-type-edit]').waitFor({ timeout: 20000 })
    await page.locator('[data-doc-type-edit]').click()
    const dlg = page.locator('dialog[open] [data-edit-dialog]')
    await dlg.waitFor({ timeout: 5000 })
    const lockedInputs = await page.locator('dialog[open] [data-edit-locked] input').count()
    const lockedRows = await page.locator('dialog[open] [data-edit-locked]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edit-field')).sort())
    check(`${dir} 4. code, category and engine are read-only`, lockedInputs === 0 && JSON.stringify(lockedRows) === JSON.stringify(['documentCategory', 'documentType', 'engineType']), JSON.stringify(lockedRows))
    check(`${dir} 4. nothing changed: no diff, Save disabled`, (await page.locator('[data-edit-no-changes]').count()) === 1 && (await page.locator('[data-edit-save]').isDisabled()))
    await page.locator('dialog[open] [data-edit-field="autoClose"] input').check()
    await page.locator('dialog[open] [data-edit-field="deliveryFees"] input').fill('12.5')
    const changed = await page.locator('[data-edit-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edit-change')))
    check(`${dir} 4. the diff shows only the two changed fields`, JSON.stringify(changed) === JSON.stringify(['deliveryFees', 'autoClose']), JSON.stringify(changed))
    check(`${dir} 4. the fee reads 0.00 → 12.50`, (await text(page.locator('[data-edit-change="deliveryFees"] [data-edit-before]'))) === '0.00' && (await text(page.locator('[data-edit-change="deliveryFees"] [data-edit-after]'))) === '12.50')
    check(`${dir} 4. Save disabled without a reason`, await page.locator('[data-edit-save]').isDisabled())
    await page.locator('[data-edit-reason]').fill('   ')
    check(`${dir} 4. …and with a blank one`, await page.locator('[data-edit-save]').isDisabled())
    await page.locator('[data-edit-reason]').fill('  طلب العميل ١٢٣  ')
    check(`${dir} 4. Save enabled with a change and a reason`, !(await page.locator('[data-edit-save]').isDisabled()))

    // 5. someone else saved first: refused, re-read, and the draft REBUILT from the fresh row (review A)
    const original = { ...state.bupa }
    state.bupa = { ...state.bupa, description: 'Bupa other' }
    force.set('PUT SdDocTypeConfigWeb/DocumentTypes/BUPA', refuse('SDC-00004', 'Document type BUPA was changed by someone else since you opened it. / تم تغيير نوع المستند'))
    const getsBefore = calls.filter((c) => c.method === 'GET' && c.p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA').length
    await page.locator('[data-edit-save]').click()
    await page.locator('dialog[open] [data-reread]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 5. …the type is re-read`, calls.filter((c) => c.method === 'GET' && c.p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA').length > getsBefore)
    check(`${dir} 5. the dialog says it was re-read and the edits must be made again`, (await page.locator('dialog[open] [data-reread]').count()) === 1)
    check(`${dir} 5. …the draft is the fresh row: the other user's description, my edits gone`,
      (await page.locator('dialog[open] [data-edit-field="description"] input').inputValue()) === 'Bupa other' &&
        !(await page.locator('dialog[open] [data-edit-field="autoClose"] input').isChecked()) &&
        (await page.locator('[data-edit-no-changes]').count()) === 1)
    check(`${dir} 5. …so Save is disabled until a change is made again`, await page.locator('[data-edit-save]').isDisabled())
    await page.locator('dialog[open] [data-edit-field="autoClose"] input').check()
    check(`${dir} 5. re-applying the edit clears the notice`, (await page.locator('dialog[open] [data-reread]').count()) === 0)
    await page.locator('[data-edit-save]').click()
    await page.locator('dialog[open] [data-edit-dialog]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const rebuilt = calls.filter((c) => c.method === 'PUT' && c.p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA').at(-1)
    check(`${dir} 5. the next save sends the fresh before AND an after built on it`,
      rebuilt?.body?.before?.description === 'Bupa other' && rebuilt?.body?.after?.description === 'Bupa other' && rebuilt?.body?.after?.autoClose === true,
      JSON.stringify({ before: rebuilt?.body?.before?.description, after: rebuilt?.body?.after?.description }))
    state.bupa = original
    await page.reload()
    await page.locator('[data-doc-type-edit]').waitFor({ timeout: 20000 })

    // 7. (3150) dropdowns, effect labels, a refusal on its field
    await page.locator('[data-doc-type-edit]').click()
    await dlg.waitFor({ timeout: 5000 })
    const controlOptions = await page.locator('dialog[open] [data-edit-field="controlType"] select option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 7. control type is a dropdown of its three values`, JSON.stringify(controlOptions) === JSON.stringify(['', 'W', 'N']), JSON.stringify(controlOptions))
    check(`${dir} 7. customer determination is a dropdown`, (await page.locator('dialog[open] [data-edit-field="customerDeterminationType"] select option').count()) === 5)
    check(`${dir} 7. create billing immediately and the reference category are dropdowns (review finding 2)`,
      (await page.locator('dialog[open] [data-edit-field="createBillingImmediately"] select option').count()) === 2 &&
        (await page.locator('dialog[open] [data-edit-field="referenceDocumentCategory"] select option').count()) === 8)
    check(`${dir} 7. a free field stays a text box`, (await page.locator('dialog[open] [data-edit-field="defaultCustomer"] select').count()) === 0)
    await page.locator('dialog[open] [data-edit-field="controlType"] select').selectOption('W')
    await page.locator('dialog[open] [data-edit-field="orderRelatedBillingType"] input').fill('ZZZ9')
    check(`${dir} 7. control type is labelled affects open orders`, (await page.locator('[data-edit-change="controlType"] [data-edit-effect="effect.OpenOrders"]').count()) === 1)
    check(`${dir} 7. the billing type is labelled not read by order processing`, (await page.locator('[data-edit-change="orderRelatedBillingType"] [data-edit-not-read]').count()) === 1)
    await page.locator('[data-edit-reason]').fill('bad billing type')
    force.set('PUT SdDocTypeConfigWeb/DocumentTypes/BUPA', refuse('SDC-00010', "OrderRelatedBillingType 'ZZZ9' is not a billing document type. / القيمة 'ZZZ9' ليست نوع مستند فوترة", {
      fields: [{ field: 'OrderRelatedBillingType', errorCode: 'SDC-00014', message: "OrderRelatedBillingType 'ZZZ9' is not a billing document type. / القيمة 'ZZZ9' ليست نوع مستند فوترة" }],
    }))
    await page.locator('[data-edit-save]').click()
    await page.locator('[data-edit-refusal="SDC-00014"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 7. the refusal shows under its field`, (await page.locator('dialog[open] [data-edit-field="orderRelatedBillingType"] [data-edit-refusal="SDC-00014"]').count()) === 1)
    check(`${dir} 7. …and only there`, (await page.locator('[data-edit-refusal]').count()) === 1)
    force.delete('PUT SdDocTypeConfigWeb/DocumentTypes/BUPA')
    await page.locator('[data-edit-cancel]').click()

    // 4. the real save
    await page.locator('[data-doc-type-edit]').click()
    await dlg.waitFor({ timeout: 5000 })
    await page.locator('dialog[open] [data-edit-field="autoClose"] input').check()
    await page.locator('[data-edit-reason]').fill('  customer asked  ')
    await page.locator('[data-edit-save]').click()
    await dlg.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const put = calls.filter((c) => c.method === 'PUT').at(-1)
    check(`${dir} 4. the PUT carries before, after and the trimmed reason`,
      put?.body?.reason === 'customer asked' && put.body.before.autoClose === false && put.body.after.autoClose === true &&
      put.body.before.documentType === 'BUPA' && put.body.after.engineType === 'SISPRICING', JSON.stringify(put?.body?.reason))
    check(`${dir} 4. the dialog closes and the detail shows the saved value`,
      (await dlg.count()) === 0 && (await page.locator('[data-doc-type-field="autoClose"] [data-flag-value]').getAttribute('data-flag-value')) === 'true')
    check(`${dir} 4. the stub holds the save`, state.bupa.autoClose === true)
    check(`${dir} 6. no raw keys`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
