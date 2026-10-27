// Config-changes drive (BackOffice spec 3148, ticket 3152) — drives the REAL History tab and Config changes page in
// Chromium against STUBBED `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice `SdConfigChangeLogModels.cs`
// (spec3148). 🚩 NOTHING here is driven against a live SIS.Api. Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. the document type's History tab (`?tab=history`): the rows newest first, a copy names its source, an update
//      shows only its changed fields (before → after), a create has no Before column and a delete no After column,
//      a child row shows its kind; Settings switches back to the groups;
//   2. the Config changes page: the rows and the total; the filters go out trimmed as kind / key / user / from / to
//      with page 1; From after To is refused here (Search disabled); Next asks page 2; Export asks the SAME filter
//      (no page) and saves the server's file;
//   3. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/config-changes-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`
const RAW = /\b(fields|groups|change|changes|history|tabs|entityTypes|actions|access|value)\.[a-zA-Z]+\b/

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

const settings = {
  documentType: 'BUPA', description: 'Bupa insurance', documentCategory: 'O', referenceDocumentCategory: '',
  numberRangeNumber: '01', customerDeterminationType: 'C', defaultCustomer: '3795407', isReceivableCustomer: true,
  receivableCustomer: 'NOT-SET-UP', insurancePayerCode: 'BUPA', engineType: 'SISPRICING', documentPricingProcedure: '1',
  promotionDetermination: false, isAlternativePriceCapped: true, defaultDeliveryType: 'DL', createDeliveryImmediately: '',
  plantDeterminationType: '', isCalculateDeliveryFees: false, deliveryFees: 0, orderRelatedBillingType: '',
  deliveryRelatedBillingType: '', createBillingImmediately: '', isPickedOnOrder: true, isDeterminePickingFees: false,
  notifyOnCreation: 'X', controlType: '', validateItem: false, preOrderMaterialOnly: false, checkOrderNo: false,
  canChangeItems: true, autoClose: false, diagnosisRequired: false, approvalProcess: false, acceptanceRequired: false,
}
const pascal = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v]))
const row = (over) => ({ entityType: 'DocumentType', entityKey: 'BUPA', documentType: 'BUPA', copiedFrom: '', reason: 'سبب التغيير', changedBy: 'msartawi', beforeJson: '', afterJson: '', ...over })
const HISTORY = [
  row({ changeId: '04', action: 'Update', changedAt: '2026-10-27T10:15:00', reason: 'طلب العميل ١٢٣',
    beforeJson: JSON.stringify(pascal(settings)), afterJson: JSON.stringify(pascal({ ...settings, description: 'Bupa insurance B', autoClose: true })) }),
  row({ changeId: '03', entityType: 'PlantNetwork', entityKey: 'BUPA|N1', action: 'Delete', changedAt: '2026-10-26T09:00:00',
    beforeJson: JSON.stringify({ DocumentType: 'BUPA', PlantNetworkId: 'N1', PlantCode: 'E001' }) }),
  row({ changeId: '02', entityType: 'ItemCategoryAssignment', entityKey: 'BUPA||', action: 'Create', changedAt: '2026-10-25T08:00:00',
    afterJson: JSON.stringify({ DocumentType: 'BUPA', ItemCategoryGroup: '', DefaultItemCategory: 'NORM' }) }),
  row({ changeId: '01', action: 'Copy', copiedFrom: 'CASH', changedAt: '2026-10-24T08:00:00', afterJson: JSON.stringify(pascal(settings)) }),
]

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
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
    calls.push({ method: req.method(), p, q: Object.fromEntries(url.searchParams) })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: false, canOpenDetail: false }))
    if (p === 'SdDocTypeConfigWeb/Access') return route.fulfill(envelope({ canViewDocTypeConfig: true, canEditDocTypeConfig: false }))
    if (p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA') return route.fulfill(envelope(settings))
    if (p === 'SdDocTypeConfigWeb/DocumentTypes/BUPA/History') return route.fulfill(envelope(HISTORY))
    if (p === 'SdDocTypeConfigWeb/ConfigChanges') {
      const pg = Number(url.searchParams.get('page') || 1)
      return route.fulfill(envelope({ rows: pg === 1 ? HISTORY.slice(0, 2) : HISTORY.slice(2), total: 120, page: pg, pageSize: 50 }))
    }
    if (p === 'SdDocTypeConfigWeb/ConfigChanges/Export')
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename=config-changes-20261001-20261027.xlsx' },
        body: Buffer.from('PK-stub'),
      })
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls }
}

const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '').trim()

for (const dir of ['ltr', 'rtl']) {
  // 1. the History tab
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/admin/doc-types/BUPA?tab=history`)
    await page.locator('[data-history-tab]').waitFor({ timeout: 20000 }).catch(async (e) => {
      console.log('DEBUG', errors.join(' | '), (await page.locator('body').innerText()).slice(0, 600))
      throw e
    })
    const ids = await page.locator('[data-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-change')))
    check(`${dir} 1. the rows, newest first`, JSON.stringify(ids) === JSON.stringify(['04', '03', '02', '01']), JSON.stringify(ids))
    const upd = page.locator('[data-change="04"]')
    const fields = await upd.locator('[data-diff-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-diff-field')))
    check(`${dir} 1. an update shows only its changed fields`, JSON.stringify(fields) === JSON.stringify(['Description', 'AutoClose']), JSON.stringify(fields))
    check(`${dir} 1. …before and after`,
      (await text(upd.locator('[data-diff-field="Description"] [data-diff-before]'))) === 'Bupa insurance' &&
      (await text(upd.locator('[data-diff-field="Description"] [data-diff-after]'))) === 'Bupa insurance B' &&
      (await upd.locator('[data-diff-field="AutoClose"] [data-diff-after] [data-flag-value]').getAttribute('data-flag-value')) === 'true')
    check(`${dir} 1. the Arabic reason reads as written`, (await text(upd.locator('[data-change-reason] bdi'))) === 'طلب العميل ١٢٣')
    check(`${dir} 1. a copy names its source`, (await page.locator('[data-change="01"] [data-change-copied-from="CASH"]').count()) === 1)
    check(`${dir} 1. a copy has no Before column`, (await page.locator('[data-change="01"] [data-diff-before]').count()) === 0 && (await page.locator('[data-change="01"] [data-diff-after]').count()) > 10)
    const created = await page.locator('[data-change="02"] [data-diff-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-diff-field')))
    check(`${dir} 1. a create shows what it set (blank left out)`, JSON.stringify(created) === JSON.stringify(['DocumentType', 'DefaultItemCategory']), JSON.stringify(created))
    check(`${dir} 1. a delete has no After column`, (await page.locator('[data-change="03"] [data-diff-after]').count()) === 0 && (await page.locator('[data-change="03"] [data-diff-before]').count()) === 3)
    check(`${dir} 3. no raw keys (history)`, !RAW.test(await page.locator('main').innerText()))
    await page.locator('[data-tab="settings"]').click()
    await page.locator('[data-doc-type-group]').first().waitFor({ timeout: 5000 })
    check(`${dir} 1. Settings switches back to the groups`, (await page.locator('[data-doc-type-group]').count()) === 9 && !page.url().includes('tab='))
    check(`${dir} 3. no page errors (history)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2. the Config changes page
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/admin/config-changes`)
    await page.locator('[data-change]').first().waitFor({ timeout: 20000 })
    check(`${dir} 2. the rows and the total`, (await page.locator('[data-change]').count()) === 2 && (await page.locator('[data-changes-total="120"]').count()) === 1)
    check(`${dir} 2. a type's row opens its History`, (await page.locator('[data-change="04"] [data-change-open]').getAttribute('href')) === '/admin/doc-types/BUPA?tab=history')
    await page.locator('[data-filter="entityType"]').selectOption('DocumentType')
    await page.locator('[data-filter="entityKey"]').fill(' BUPA ')
    await page.locator('[data-filter="user"]').fill(' msartawi ')
    await page.locator('[data-filter="from"]').fill('2026-10-28')
    await page.locator('[data-filter="to"]').fill('2026-10-27')
    check(`${dir} 2. From after To is refused here`, (await page.locator('[data-changes-bad-range]').count()) === 1 && (await page.locator('[data-changes-apply]').isDisabled()))
    await page.locator('[data-filter="from"]').fill('2026-10-01')
    await page.locator('[data-changes-apply]').click()
    await page.waitForTimeout(400)
    const asked = calls.filter((c) => c.p === 'SdDocTypeConfigWeb/ConfigChanges').at(-1)?.q
    check(`${dir} 2. the filters go out trimmed, page 1`,
      JSON.stringify(asked) === JSON.stringify({ entityType: 'DocumentType', entityKey: 'BUPA', user: 'msartawi', from: '2026-10-01', to: '2026-10-27', page: '1', pageSize: '50' }), JSON.stringify(asked))
    await page.locator('nav button').last().click()
    await page.waitForTimeout(400)
    check(`${dir} 2. Next asks page 2`, calls.filter((c) => c.p === 'SdDocTypeConfigWeb/ConfigChanges').at(-1)?.q.page === '2')
    const download = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    await page.locator('[data-changes-export]').click()
    const file = await download
    const exp = calls.filter((c) => c.p === 'SdDocTypeConfigWeb/ConfigChanges/Export').at(-1)?.q
    check(`${dir} 2. Export asks the same filter, no page`,
      JSON.stringify(exp) === JSON.stringify({ entityType: 'DocumentType', entityKey: 'BUPA', user: 'msartawi', from: '2026-10-01', to: '2026-10-27' }), JSON.stringify(exp))
    check(`${dir} 2. …and saves the server's file`, file?.suggestedFilename() === 'config-changes-20261001-20261027.xlsx', file?.suggestedFilename())
    check(`${dir} 3. no raw keys (page)`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 3. no page errors (page)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
