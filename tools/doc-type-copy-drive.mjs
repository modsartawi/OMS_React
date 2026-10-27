// Copy-a-document-type drive (BackOffice spec 3148, ticket 3153) — drives the REAL document type page and copy dialog
// in Chromium against STUBBED, STATEFUL `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice
// `SdDocTypeConfigAdminModels.Copy.cs` (spec3148). 🚩 NOTHING here is driven against a live SIS.Api. Never point this at
// a real host.
//
// It verifies, in LTR and RTL:
//   1. Copy shows only with the configuration grant;
//   2. copying BUPA (a listed code) shows the code-only-behaviour warning, its line in English AND Arabic; copying CASH
//      (unlisted) shows none;
//   3. the copy starts with a blank code and description; code, category and engine are EDITABLE (not locked);
//   4. Save is disabled without a code, for an existing code (CASH), without a description, without a reason — and
//      the warning never disables it;
//   5. the POST carries the code trimmed and upper-case, the edited category / engine and the trimmed reason; the page
//      moves to the new type; its edit dialog now shows code, category and engine locked;
//   6. a forced SDC-00042 (someone took the code meanwhile) shows its code;
//   7. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5263 --strictPort
//   2. DRIVE_PORT=5263 node tools/doc-type-copy-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5263}`
const RAW = /\b(fields|groups|edit|copy|blockers|list|detail|access|reason|dialog|value|effect|options)\.[a-zA-Z_]+\b/

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
  ['DocumentType', 'N'], ['Description', 'O'], ['DocumentCategory', 'O', ['O', 'R', 'X', 'E', 'Q']], ['ReferenceDocumentCategory', 'N'],
  ['NumberRangeNumber', 'N'], ['CustomerDeterminationType', 'N', ['', 'A', 'B', 'C', 'D']], ['DefaultCustomer', 'N'],
  ['IsReceivableCustomer', 'N'], ['ReceivableCustomer', 'N'], ['InsurancePayerCode', 'N'], ['EngineType', 'N', ['', 'LEGACY', 'SISPRICING']],
  ['DocumentPricingProcedure', 'O'], ['PromotionDetermination', 'O'], ['IsAlternativePriceCapped', 'O'], ['DefaultDeliveryType', 'O'],
  ['CreateDeliveryImmediately', 'O', ['', 'X']], ['PlantDeterminationType', 'N', ['', 'R']], ['IsCalculateDeliveryFees', 'O'],
  ['DeliveryFees', 'N'], ['OrderRelatedBillingType', 'O', null, true], ['DeliveryRelatedBillingType', 'O', null, true],
  ['CreateBillingImmediately', 'O', null, true], ['IsPickedOnOrder', 'O'], ['IsDeterminePickingFees', 'O'], ['IsQuantityAllocation', 'O'],
  ['NotifyOnCreation', 'N', ['', 'X']], ['NotifyOnCancellation', 'O', ['', 'X', 'O', 'D']], ['ControlType', 'O', ['', 'W', 'N']],
  ['ValidateItem', 'O'], ['PreOrderMaterialOnly', 'N'], ['CheckOrderNo', 'N'], ['CanChangeItems', 'O'], ['AutoClose', 'O'],
  ['DiagnosisRequired', 'N'], ['ApprovalProcess', 'O'], ['AcceptanceRequired', 'O'],
].map(([f, e, o = null, n = false]) => meta(f, e === 'O' ? 'OpenOrders' : 'NewOrdersOnly', o, n))
const LIST = [
  { documentType: 'BUPA', description: 'Bupa insurance', documentCategory: 'O', engineType: 'SISPRICING' },
  { documentType: 'CASH', description: 'Cash order', documentCategory: 'O', engineType: '' },
  { documentType: 'ORRT', description: 'Order return', documentCategory: 'R', engineType: '' },
]
// `GET SdDocTypeConfigWeb/CodeOnlyBehaviour` as BackOffice `SdCodeOnlyBehaviour` answers it.
const WARNING = {
  BUPA: [{
    entityType: 'DocumentType', code: 'BUPA',
    english: 'BUPA: no ready-for-pickup SMS, and the uncollected-prescriptions Insurance mode and prompt count only BUPA.',
    arabic: 'بوبا: بدون رسالة جاهزية الاستلام، ووضع التأمين في الوصفات غير المستلمة وتنبيهها يحتسبان بوبا فقط.',
  }],
}

const browser = await chromium.launch()

async function open(dir, { canEdit = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const force = new Map()
  const types = new Map([
    ['BUPA', settings()],
    ['CASH', settings({ documentType: 'CASH', description: 'Cash order', engineType: '', insurancePayerCode: '', isReceivableCustomer: false, receivableCustomer: '' })],
  ])
  const list = [...LIST]
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
    calls.push({ method, p, body, q: Object.fromEntries(url.searchParams) })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    // The shell's OMS probe expects an object; this session holds no other OMS screen.
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: false, canOpenDetail: false }))
    if (p === 'SdDocTypeConfigWeb/Access') return route.fulfill(envelope({ canViewDocTypeConfig: true, canEditDocTypeConfig: canEdit }))
    const forced = force.get(`${method} ${p}`)
    if (forced) {
      force.delete(`${method} ${p}`)
      return route.fulfill(forced)
    }
    if (p === 'SdDocTypeConfigWeb/DocumentTypes' && method === 'GET') return route.fulfill(envelope(list))
    if (p === 'SdDocTypeConfigWeb/DocumentTypeFields') return route.fulfill(envelope(FIELDS))
    if (p === 'SdDocTypeConfigWeb/CodeOnlyBehaviour') return route.fulfill(envelope(WARNING[url.searchParams.get('code')] ?? []))
    const copy = p.match(/^SdDocTypeConfigWeb\/DocumentTypes\/([^/]+)\/Copy$/)
    if (copy && method === 'POST') {
      const saved = { ...body.after }
      types.set(saved.documentType, saved)
      list.push({ documentType: saved.documentType, description: saved.description, documentCategory: saved.documentCategory, engineType: saved.engineType })
      return route.fulfill(envelope(saved))
    }
    const one = p.match(/^SdDocTypeConfigWeb\/DocumentTypes\/([^/]+)$/)
    if (one && method === 'GET') {
      const t = types.get(decodeURIComponent(one[1]))
      return route.fulfill(t ? envelope(t) : refuse('SDC-00001', 'Document type does not exist. / نوع المستند غير موجود.'))
    }
    if (/\/(ItemCategoryAssignments|PlantNetworks|History)$/.test(p) || /(ItemCategories|PlantNetworkIds)$/.test(p)) return route.fulfill(envelope([]))
    // Every other screen's probe answers "no grant" (an object, as the shell expects); anything else is empty.
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls, force }
}

const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '')
const dlg = (page) => page.locator('dialog[open] [data-copy-dialog]')
const field = (page, f) => page.locator(`dialog[open] [data-copy-dialog] [data-edit-field="${f}"]`)
const saveDisabled = (page) => page.locator('[data-copy-save]').isDisabled()

for (const dir of ['ltr', 'rtl']) {
  // 1. no grant, no Copy
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/admin/doc-types/BUPA`)
    await page.locator('[data-doc-type="BUPA"]').waitFor({ timeout: 20000 }).catch(async (e) => {
      console.log('DEBUG', errors.join(' | '), (await page.locator('body').innerText()).slice(0, 600))
      throw e
    })
    check(`${dir} 1. no Copy without the grant`, (await page.locator('[data-doc-type-copy]').count()) === 0)
    check(`${dir} 7. no page errors (read-only)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2-7. granted
  {
    const { context, page, errors, calls, force } = await open(dir)
    // 2. unlisted source: no warning
    await page.goto(`${BASE}/admin/doc-types/CASH`)
    await page.locator('[data-doc-type-copy]').waitFor({ timeout: 20000 })
    await page.locator('[data-doc-type-copy]').click()
    await dlg(page).waitFor({ timeout: 5000 })
    await page.waitForTimeout(400)
    check(`${dir} 2. copying CASH (unlisted) shows no warning`, (await page.locator('[data-copy-warning]').count()) === 0)
    await page.locator('[data-copy-cancel]').click()

    // 2. listed source
    await page.goto(`${BASE}/admin/doc-types/BUPA`)
    await page.locator('[data-doc-type-copy]').waitFor({ timeout: 20000 })
    await page.locator('[data-doc-type-copy]').click()
    await dlg(page).waitFor({ timeout: 5000 })
    await page.locator('[data-copy-warning]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 2. copying BUPA shows the warning`, (await page.locator('[data-copy-warning-line="BUPA"]').count()) === 1)
    check(`${dir} 2. …its line in English and Arabic`,
      (await text(page.locator('[data-copy-warning-en]'))).startsWith('BUPA:') && /[\u0600-\u06FF]/.test(await text(page.locator('[data-copy-warning-ar]'))))
    check(`${dir} 2. …asked for BUPA as a document type`,
      calls.some((c) => c.p === 'SdDocTypeConfigWeb/CodeOnlyBehaviour' && c.q.entityType === 'DocumentType' && c.q.code === 'BUPA'))

    // 3. blank code / description; nothing locked
    check(`${dir} 3. the code and description start blank`,
      (await field(page, 'documentType').locator('input').inputValue()) === '' && (await field(page, 'description').locator('input').inputValue()) === '')
    check(`${dir} 3. no field is locked in the copy`, (await page.locator('dialog[open] [data-copy-dialog] [data-edit-locked]').count()) === 0)
    check(`${dir} 3. category and engine are dropdowns you can change`,
      !(await field(page, 'documentCategory').locator('select').isDisabled()) && !(await field(page, 'engineType').locator('select').isDisabled()))

    // 4. blockers
    check(`${dir} 4. Save disabled without a code, and it says so`,
      (await saveDisabled(page)) && (await page.locator('[data-copy-blocker="codeRequired"]').count()) === 1)
    await field(page, 'documentType').locator('input').fill('cash')
    check(`${dir} 4. an existing code is refused on screen`, (await page.locator('[data-copy-blocker="codeExists"]').count()) === 1 && (await saveDisabled(page)))
    await field(page, 'documentType').locator('input').fill('bupb')
    check(`${dir} 4. no description → disabled`, (await page.locator('[data-copy-blocker="descriptionRequired"]').count()) === 1 && (await saveDisabled(page)))
    await field(page, 'description').locator('input').fill('Bupa copy نسخة')
    check(`${dir} 4. no reason → disabled`, await saveDisabled(page))
    await field(page, 'documentCategory').locator('select').selectOption('X')
    await field(page, 'engineType').locator('select').selectOption('LEGACY')
    await page.locator('[data-copy-reason]').fill('  new insurer  ')
    check(`${dir} 4. the warning never disables Save`, !(await saveDisabled(page)) && (await page.locator('[data-copy-warning]').count()) === 1)

    // 6. someone took the code meanwhile
    force.set('POST SdDocTypeConfigWeb/DocumentTypes/BUPA/Copy', refuse('SDC-00042', 'Document type BUPB already exists; choose another code. / نوع المستند BUPB موجود بالفعل'))
    await page.locator('[data-copy-save]').click()
    await page.locator('[data-copy-error="SDC-00042"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. SDC-00042 shows with its code`, (await page.locator('[data-copy-error="SDC-00042"]').count()) === 1)

    // 5. the real copy
    await page.locator('[data-copy-save]').click()
    await page.waitForURL('**/admin/doc-types/BUPB', { timeout: 5000 }).catch(() => {})
    const post = calls.filter((c) => c.method === 'POST' && c.p.endsWith('/Copy')).at(-1)
    check(`${dir} 5. the POST carries the new code upper-case, the edits and the trimmed reason`,
      post?.p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA/Copy' && post.body.reason === 'new insurer' && post.body.after.documentType === 'BUPB' &&
      post.body.after.documentCategory === 'X' && post.body.after.engineType === 'LEGACY' && post.body.after.description === 'Bupa copy نسخة' &&
      post.body.after.isPickedOnOrder === true, JSON.stringify(post?.body))
    await page.locator('[data-doc-type="BUPB"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5. the page moves to the new type`, page.url().endsWith('/admin/doc-types/BUPB') && (await page.locator('[data-doc-type="BUPB"]').count()) === 1)
    await page.locator('[data-doc-type-edit]').click()
    await page.locator('dialog[open] [data-edit-dialog]').waitFor({ timeout: 5000 })
    const lockedRows = await page.locator('dialog[open] [data-edit-dialog] [data-edit-locked]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edit-field')).sort())
    check(`${dir} 5. once saved, code, category and engine are locked`,
      JSON.stringify(lockedRows) === JSON.stringify(['documentCategory', 'documentType', 'engineType']), JSON.stringify(lockedRows))
    await page.locator('[data-edit-cancel]').click()
    check(`${dir} 7. no raw keys`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
