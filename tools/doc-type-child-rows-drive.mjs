// Document-type child-row drive (BackOffice spec 3148, ticket 3151) — drives the REAL document type page in Chromium
// against STUBBED, STATEFUL `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice
// `SdDocTypeConfigAdminModels.ChildRows.cs` (spec3148). 🚩 NOTHING here is driven against a live SIS.Api. Never point
// this at a real host.
//
// It verifies, in LTR and RTL:
//   1. without the configuration grant: both tables read, and there is no Add, Edit or Remove;
//   2. add an item-category assignment: categories are picked from the list; a key the type already has is refused
//      before sending; Save waits for a reason; the POST carries `after` + the trimmed reason; the row appears;
//   3. change it: the key columns are locked; the diff shows only the changed column; the PUT carries before + after;
//   4. a forced SDC-00004 shows its code and re-reads the table;
//   5. remove a plant network row: the POST …/Remove carries the loaded row as `before` and the reason; the row goes;
//   6. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/doc-type-child-rows-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`
const RAW = /\b(childRows|fields|groups|edit|detail|access|reason|dialog|value)\.[a-zA-Z]+\b/

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
const refuse = (errorCode, message) => envelope(null, { status: 400, success: false, message, errorCode })

const settings = {
  documentType: 'BUPA', description: 'Bupa insurance', documentCategory: 'O', referenceDocumentCategory: '',
  numberRangeNumber: '01', customerDeterminationType: 'C', defaultCustomer: '3795407', isReceivableCustomer: true,
  receivableCustomer: 'NOT-SET-UP', insurancePayerCode: 'BUPA', engineType: 'SISPRICING', documentPricingProcedure: '1',
  promotionDetermination: false, isAlternativePriceCapped: true, defaultDeliveryType: 'DL', createDeliveryImmediately: '',
  plantDeterminationType: 'R', isCalculateDeliveryFees: false, deliveryFees: 0, orderRelatedBillingType: '',
  deliveryRelatedBillingType: '', createBillingImmediately: '', isPickedOnOrder: true, isDeterminePickingFees: false,
  notifyOnCreation: 'X', controlType: '', validateItem: false, preOrderMaterialOnly: false, checkOrderNo: false,
  canChangeItems: true, autoClose: false, diagnosisRequired: false, approvalProcess: false, acceptanceRequired: false,
}
const ica = (over = {}) => ({
  documentType: 'BUPA', itemCategoryGroup: '', itemUsage: '', defaultItemCategory: 'STND',
  manualItemCategory1: '', manualItemCategory2: '', manualItemCategory3: '', manualItemCategory4: '', ...over,
})
const CATEGORIES = [
  { itemCategory: 'CASH', description: 'Internal Item' },
  { itemCategory: 'STND', description: 'Internal Item' },
  { itemCategory: 'TEXT', description: 'Text Item' },
]
const ICA = 'SdDocTypeConfigWeb/DocumentTypes/BUPA/ItemCategoryAssignments'
const PN = 'SdDocTypeConfigWeb/DocumentTypes/BUPA/PlantNetworks'
const icaKey = (r) => `${r.itemCategoryGroup}|${r.itemUsage}`

const browser = await chromium.launch()

async function open(dir, { canEdit = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const force = new Map()
  const state = { ica: [ica()], pn: [{ documentType: 'BUPA', plantNetworkId: 'NT0049', plantCode: '1000' }] }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
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
    if (p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA' && method === 'GET') return route.fulfill(envelope(settings))
    if (p === 'SdDocTypeConfigWeb/ItemCategories') return route.fulfill(envelope(CATEGORIES))
    if (p === 'SdDocTypeConfigWeb/PlantNetworkIds') return route.fulfill(envelope(['NT0000', 'NT0049']))
    if (p === ICA && method === 'GET') return route.fulfill(envelope(state.ica))
    if (p === ICA && method === 'POST') {
      state.ica = [...state.ica, body.after]
      return route.fulfill(envelope(body.after))
    }
    if (p === ICA && method === 'PUT') {
      state.ica = state.ica.map((r) => (icaKey(r) === icaKey(body.before) ? body.after : r))
      return route.fulfill(envelope(body.after))
    }
    if (p === PN && method === 'GET') return route.fulfill(envelope(state.pn))
    if (p === `${PN}/Remove` && method === 'POST') {
      state.pn = state.pn.filter((r) => r.plantNetworkId !== body.before.plantNetworkId)
      return route.fulfill(envelope(true))
    }
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls, force, state }
}

const icaTable = '[data-child-table="itemCategoryAssignments"]'
const pnTable = '[data-child-table="plantNetworks"]'
const dialog = '[data-child-dialog]'
const field = (f) => `${dialog} [data-child-field="${f}"]`

for (const dir of ['ltr', 'rtl']) {
  // 1. read-only session
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/admin/doc-types/BUPA`)
    await page.locator(`${icaTable} [data-child-row]`).first().waitFor({ timeout: 20000 })
    await page.locator(`${pnTable} [data-child-row]`).first().waitFor({ timeout: 10000 })
    check(`${dir} 1. both tables read`, (await page.locator(`${icaTable} [data-child-row]`).count()) === 1 && (await page.locator(`${pnTable} [data-child-row]`).count()) === 1)
    check(`${dir} 1. no Add, Edit or Remove without the grant`,
      (await page.locator('[data-child-add], [data-child-edit], [data-child-remove]').count()) === 0)
    check(`${dir} 6. no raw keys (read-only)`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 6. no page errors (read-only)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2-5. granted session
  {
    const { context, page, errors, calls, force, state } = await open(dir)
    await page.goto(`${BASE}/admin/doc-types/BUPA`)
    await page.locator(`${icaTable} [data-child-row]`).first().waitFor({ timeout: 20000 })
    check(`${dir} 2. Add, Edit and Remove are offered with the grant`,
      (await page.locator('[data-child-add]').count()) === 2 && (await page.locator('[data-child-edit]').count()) === 2)

    // 2. add
    await page.locator('[data-child-add="itemCategoryAssignments"]').click()
    await page.locator(`${dialog}[data-child-dialog="add"]`).waitFor({ timeout: 5000 })
    await page.locator(`${field('defaultItemCategory')} select`).selectOption('TEXT')
    check(`${dir} 2. the same group + usage is refused before sending`, (await page.locator('[data-child-duplicate]').count()) === 1 && (await page.locator('[data-child-save]').isDisabled()))
    await page.locator(`${field('itemUsage')} input`).fill('text')
    check(`${dir} 2. a new key clears it; Save waits for a reason`, (await page.locator('[data-child-duplicate]').count()) === 0 && (await page.locator('[data-child-save]').isDisabled()))
    const options = await page.locator(`${field('manualItemCategory1')} option`).count()
    check(`${dir} 2. item categories are chosen from the existing ones`, options === CATEGORIES.length + 1, String(options))
    await page.locator('[data-child-reason]').fill('  سطور نصية ١  ')
    await page.locator('[data-child-save]').click()
    await page.locator(dialog).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const post = calls.filter((c) => c.method === 'POST' && c.p === ICA).at(-1)
    check(`${dir} 2. the POST carries after + the trimmed reason`,
      post?.body?.reason === 'سطور نصية ١' && post.body.after.itemUsage === 'TEXT' && post.body.after.defaultItemCategory === 'TEXT' && !post.body.before,
      JSON.stringify(post?.body))
    await page.locator(`${icaTable} [data-child-row="|TEXT"]`).waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 2. the row appears`, (await page.locator(`${icaTable} [data-child-row]`).count()) === 2)

    // 3. change
    await page.locator(`${icaTable} [data-child-row="|TEXT"] [data-child-edit]`).click()
    await page.locator(`${dialog}[data-child-dialog="edit"]`).waitFor({ timeout: 5000 })
    const locked = await page.locator(`${dialog} [data-child-locked]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-child-field')).sort())
    check(`${dir} 3. the key columns are locked`, JSON.stringify(locked) === JSON.stringify(['itemCategoryGroup', 'itemUsage']), JSON.stringify(locked))
    await page.locator(`${field('manualItemCategory2')} select`).selectOption('CASH')
    const changed = await page.locator('[data-child-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-child-change')))
    check(`${dir} 3. the diff shows only the changed column`, JSON.stringify(changed) === JSON.stringify(['manualItemCategory2']), JSON.stringify(changed))

    // 4. stale
    force.set(`PUT ${ICA}`, refuse('SDC-00004', 'Row BUPA||TEXT was changed by someone else since you opened it. / تم تغيير السطر'))
    const getsBefore = calls.filter((c) => c.method === 'GET' && c.p === ICA).length
    await page.locator('[data-child-reason]').fill('cash too')
    await page.locator('[data-child-save]').click()
    await page.locator('[data-child-error="SDC-00004"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. SDC-00004 shows with its code`, (await page.locator('[data-child-error="SDC-00004"]').count()) === 1)
    await page.waitForTimeout(300)
    check(`${dir} 4. …and the table is re-read`, calls.filter((c) => c.method === 'GET' && c.p === ICA).length > getsBefore)

    // 3. the real change
    await page.locator('[data-child-save]').click()
    await page.locator(dialog).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const put = calls.filter((c) => c.method === 'PUT' && c.p === ICA).at(-1)
    check(`${dir} 3. the PUT carries before + after`,
      put?.body?.before?.manualItemCategory2 === '' && put.body.after.manualItemCategory2 === 'CASH' && put.body.reason === 'cash too', JSON.stringify(put?.body))
    check(`${dir} 3. the stub holds the change`, state.ica.some((r) => r.itemUsage === 'TEXT' && r.manualItemCategory2 === 'CASH'))

    // 5. remove a plant network row
    await page.locator(`${pnTable} [data-child-row="NT0049"] [data-child-remove]`).click()
    await page.locator(`${dialog}[data-child-dialog="remove"]`).waitFor({ timeout: 5000 })
    check(`${dir} 5. Remove waits for a reason`, await page.locator('[data-child-save]').isDisabled())
    await page.locator('[data-child-reason]').fill(' network retired ')
    await page.locator('[data-child-save]').click()
    await page.locator(dialog).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const removed = calls.filter((c) => c.method === 'POST' && c.p === `${PN}/Remove`).at(-1)
    check(`${dir} 5. the remove carries the loaded row and the reason`,
      removed?.body?.before?.plantNetworkId === 'NT0049' && removed.body.before.plantCode === '1000' && removed.body.reason === 'network retired' && !removed.body.after,
      JSON.stringify(removed?.body))
    await page.locator(`${pnTable} [data-child-empty]`).waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 5. the row is gone`, (await page.locator(`${pnTable} [data-child-row]`).count()) === 0)

    check(`${dir} 6. no raw keys`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
