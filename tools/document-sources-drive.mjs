// Document-sources drive (BackOffice spec 3148, ticket 3156) — drives the REAL Document sources page and its edit and
// copy dialogs in Chromium against STUBBED, stateful `SdDocTypeConfigWeb/*` envelopes shaped from BackOffice
// `SdDocTypeConfigAdminModels.DocumentSources.cs` (spec3148). 🚩 NOTHING here is driven against a live SIS.Api. Never
// point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. the list: every source with its description and category (blank / C); picking one writes `?source=` and shows it;
//   2. without the edit grant there is no Edit and no Copy; with it, Edit opens the dialog: the code locked, the
//      description and category editable, Save disabled until a change AND a reason; the diff shows only what changed;
//      Save sends `{ before, after, reason }` to `PUT DocumentSources/{code}` and the list re-reads; a stale save
//      (SDC-00004) says so;
//   3. Copy on a listed code (WSFD) shows the code-only-behaviour warning (EN + AR) and still saves; Save waits for a free
//      code, a description and a reason; the copy POSTs `{ after, reason }` to `DocumentSources/WSFD/Copy`, the new
//      source appears and is selected; an unlisted code (CINB) shows no warning;
//   4. the History tab (`?tab=history`) reads the source's History door and shows its row with its diff;
//   5. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5276 --strictPort
//   2. DRIVE_PORT=5276 node tools/document-sources-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5276}`
const RAW = /\b(fields|documentSources|categories|blockers|tabs|entityTypes|actions|access|value|edit|copy|reason|dialog)\.[a-zA-Z_]+\b/

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

const src = (documentSource, description, documentSourceCategory = '') => ({ documentSource, description, documentSourceCategory })
const WSFD_LINES = [
  {
    entityType: 'DocumentSource', code: 'WSFD',
    english: 'Wasfaty delivery source: delivery only (the fulfilment-mode policy).',
    arabic: 'مصدر توصيل وصفتي: توصيل فقط (سياسة نمط التنفيذ).',
  },
]
const HISTORY = [
  {
    changeId: '01', entityType: 'DocumentSource', entityKey: 'CINB', documentType: 'CINB', action: 'Update', copiedFrom: '',
    reason: 'سبب التغيير', changedBy: 'msartawi', changedAt: '2026-10-27T10:15:00',
    beforeJson: JSON.stringify({ DocumentSource: 'CINB', Description: 'Call Center Inbound', DocumentSourceCategory: '' }),
    afterJson: JSON.stringify({ DocumentSource: 'CINB', Description: 'Call Center Inbound', DocumentSourceCategory: 'C' }),
  },
]

const browser = await chromium.launch()

async function open(dir, { canEdit = true, stale = false, mixed = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const rows = {
    CINB: src('CINB', 'Call Center Inbound', 'C'),
    CLCN: src('CLCN', 'Call Center'),
    WSFD: src('WSFD', 'Wasfaty'),
    // A legacy mixed-case code (the server matches codes case-blind; the address upper-cases them).
    ...(mixed ? { Mx1: src('Mx1', 'Mixed case') } : {}),
  }
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
    calls.push({ method: req.method(), p, q: url.search, body })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: false, canOpenDetail: false }))
    if (p === 'SdDocTypeConfigWeb/Access') return route.fulfill(envelope({ canViewDocTypeConfig: true, canEditDocTypeConfig: canEdit }))
    if (p === 'SdDocTypeConfigWeb/DocumentSources' && req.method() === 'GET')
      return route.fulfill(envelope(Object.values(rows).sort((a, b) => (a.documentSource < b.documentSource ? -1 : 1))))
    if (p === 'SdDocTypeConfigWeb/CodeOnlyBehaviour')
      return route.fulfill(envelope(url.searchParams.get('entityType') === 'DocumentSource' && url.searchParams.get('code') === 'WSFD' ? WSFD_LINES : []))
    if (/^SdDocTypeConfigWeb\/DocumentSources\/[^/]+\/History$/.test(p)) return route.fulfill(envelope(HISTORY))
    if (req.method() === 'PUT' && p.startsWith('SdDocTypeConfigWeb/DocumentSources/')) {
      if (stale)
        return route.fulfill(envelope(null, { status: 400, success: false, errorCode: 'SDC-00004', message: 'changed by someone else / تم التغيير' }))
      const code = decodeURIComponent(p.split('/').at(-1))
      rows[code] = { ...body.after }
      return route.fulfill(envelope(rows[code]))
    }
    if (req.method() === 'POST' && p.endsWith('/Copy')) {
      rows[body.after.documentSource] = { ...body.after }
      return route.fulfill(envelope(body.after))
    }
    if (p.endsWith('/Access')) return route.fulfill(envelope({}))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors, calls }
}

const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '').trim()
const listed = (page) => page.locator('[data-document-source]').evaluateAll((els) => els.map((e) => e.getAttribute('data-document-source')))

for (const dir of ['ltr', 'rtl']) {
  // 1 + 2: the list, the edit
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/admin/document-sources`)
    await page.locator('[data-document-sources-table]').waitFor({ timeout: 20000 }).catch(async (e) => {
      console.log('DEBUG', errors.join(' | '), (await page.locator('body').innerText()).slice(0, 600))
      throw e
    })
    check(`${dir} 1. every source, by code`, JSON.stringify(await listed(page)) === JSON.stringify(['CINB', 'CLCN', 'WSFD']))
    check(`${dir} 1. …with its category`,
      (await page.locator('[data-document-source="CINB"] [data-document-source-category="C"]').count()) === 1 &&
      (await page.locator('[data-document-source="CLCN"] [data-document-source-category=""]').count()) === 1)
    check(`${dir} 5. no raw keys (list)`, !RAW.test(await page.locator('main').innerText()))
    await page.locator('[data-document-source-open="CINB"]').click()
    await page.locator('[data-document-source-detail="CINB"]').waitFor({ timeout: 5000 })
    check(`${dir} 1. picking one writes ?source=`, new URL(page.url()).search === '?source=CINB', page.url())

    await page.locator('[data-document-source-edit="CLCN"]').click()
    const dialog = page.locator('[data-source-edit-dialog]')
    await dialog.waitFor({ timeout: 5000 })
    check(`${dir} 2. the code is locked`,
      (await dialog.locator('[data-source-edit-locked="documentSource"]').count()) === 1 && (await dialog.locator('[data-source-edit-locked] input').count()) === 0)
    check(`${dir} 2. description and category editable`,
      (await dialog.locator('[data-source-description]').count()) === 1 && (await dialog.locator('[data-source-category] option').count()) === 2)
    const save = page.locator('[data-source-edit-save]')
    check(`${dir} 2. Save waits for a change`, await save.isDisabled())
    await dialog.locator('[data-source-category]').selectOption('C')
    check(`${dir} 2. …and a reason`, await save.isDisabled())
    check(`${dir} 2. the diff shows only what changed`,
      JSON.stringify(await dialog.locator('[data-source-edit-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-source-edit-change')))) ===
        JSON.stringify(['documentSourceCategory']))
    await dialog.locator('[data-source-reason]').fill('  قناة مركز الاتصال  ')
    check(`${dir} 2. a change and a reason enable Save`, await save.isEnabled())
    check(`${dir} 5. no raw keys (edit)`, !RAW.test(await page.locator('body').innerText()))
    await save.click()
    await dialog.waitFor({ state: 'detached', timeout: 5000 })
    const put = calls.find((c) => c.method === 'PUT')
    check(`${dir} 2. the save sends before, after and the trimmed reason`,
      put?.p === 'SdDocTypeConfigWeb/DocumentSources/CLCN' && put.body.before.documentSourceCategory === '' &&
      put.body.after.documentSourceCategory === 'C' && put.body.after.documentSource === 'CLCN' && put.body.reason === 'قناة مركز الاتصال',
      JSON.stringify(put))
    await page.waitForTimeout(300)
    check(`${dir} 2. the list re-reads`, (await page.locator('[data-document-source="CLCN"] [data-document-source-category="C"]').count()) === 1)

    // 3. copy with the warning
    await page.locator('[data-document-source-copy="CINB"]').click()
    let copy = page.locator('[data-source-copy-dialog]')
    await copy.waitFor({ timeout: 5000 })
    await page.waitForTimeout(300)
    check(`${dir} 3. an unlisted code shows no warning`, (await copy.locator('[data-source-copy-warning]').count()) === 0)
    await page.locator('[data-source-copy-cancel]').click()
    await copy.waitFor({ state: 'detached', timeout: 5000 })

    await page.locator('[data-document-source-copy="WSFD"]').click()
    copy = page.locator('[data-source-copy-dialog]')
    await copy.waitFor({ timeout: 5000 })
    await copy.locator('[data-source-copy-warning]').waitFor({ timeout: 5000 })
    const line = copy.locator('[data-source-copy-warning-line="WSFD"]')
    check(`${dir} 3. a listed code warns in English and Arabic`,
      (await text(line)).includes('delivery only') && /[\u0600-\u06FF]/.test(await text(line)))
    check(`${dir} 3. it asked about the SOURCE kind`, calls.some((c) => c.p === 'SdDocTypeConfigWeb/CodeOnlyBehaviour' && c.q.includes('entityType=DocumentSource') && c.q.includes('code=WSFD')))
    const copySave = page.locator('[data-source-copy-save]')
    check(`${dir} 3. Save waits for a code`, (await copySave.isDisabled()) && (await copy.locator('[data-source-copy-blocker="codeRequired"]').count()) === 1)
    await copy.locator('[data-source-copy-code]').fill('cinb')
    check(`${dir} 3. …a free one`, (await copy.locator('[data-source-copy-blocker="codeExists"]').count()) === 1)
    await copy.locator('[data-source-copy-code]').fill('wsf2')
    check(`${dir} 3. …a description`, (await copy.locator('[data-source-copy-blocker="description"]').count()) === 1)
    await copy.locator('[data-source-description]').fill('Wasfaty two')
    await copy.locator('[data-source-category]').selectOption('C')
    check(`${dir} 3. …and a reason`, await copySave.isDisabled())
    await copy.locator('[data-source-reason]').fill('new channel')
    check(`${dir} 3. the warning never blocks`, await copySave.isEnabled())
    check(`${dir} 5. no raw keys (copy)`, !RAW.test(await page.locator('body').innerText()))
    await copySave.click()
    await copy.waitFor({ state: 'detached', timeout: 5000 })
    const post = calls.find((c) => c.method === 'POST' && c.p.endsWith('/Copy'))
    check(`${dir} 3. the copy POSTs the new code, description and category`,
      post?.p === 'SdDocTypeConfigWeb/DocumentSources/WSFD/Copy' && post.body.after.documentSource === 'WSF2' &&
      post.body.after.description === 'Wasfaty two' && post.body.after.documentSourceCategory === 'C' && post.body.reason === 'new channel',
      JSON.stringify(post))
    await page.locator('[data-document-source-detail="WSF2"]').waitFor({ timeout: 5000 })
    check(`${dir} 3. the new source appears and is selected`,
      (await listed(page)).includes('WSF2') && new URL(page.url()).search === '?source=WSF2', page.url())

    // 4. History
    await page.locator('[data-document-source-open="CINB"]').click()
    await page.locator('[data-document-source-detail="CINB"]').waitFor({ timeout: 5000 })
    await page.locator('[data-tab="history"]').click()
    await page.locator('[data-history-tab]').waitFor({ timeout: 5000 })
    check(`${dir} 4. History writes ?tab=history and keeps the source`, new URL(page.url()).search === '?source=CINB&tab=history', page.url())
    check(`${dir} 4. it reads the source's History door`, calls.some((c) => c.p === 'SdDocTypeConfigWeb/DocumentSources/CINB/History'))
    check(`${dir} 4. …and shows the row with its diff`,
      (await page.locator('[data-change="01"]').count()) === 1 &&
      (await page.locator('[data-change="01"] [data-diff-field="DocumentSourceCategory"]').count()) === 1)
    check(`${dir} 5. no raw keys (history)`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2. without the grant: no Edit, no Copy
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/admin/document-sources?source=CINB`)
    await page.locator('[data-document-source-detail="CINB"]').waitFor({ timeout: 20000 })
    check(`${dir} 2. without the grant there is no Edit and no Copy`,
      (await page.locator('[data-document-source-edit]').count()) === 0 && (await page.locator('[data-document-source-copy]').count()) === 0)
    check(`${dir} 5. no page errors (read-only)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 1. a mixed-case code still selects (review D)
  {
    const { context, page, errors } = await open(dir, { canEdit: false, mixed: true })
    await page.goto(`${BASE}/admin/document-sources?source=Mx1`)
    await page.locator('[data-document-source-detail="Mx1"]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 1. a mixed-case code opens its source`,
      (await page.locator('[data-document-source-detail="Mx1"]').count()) === 1 && (await page.locator('[data-document-source-missing]').count()) === 0)
    check(`${dir} 5. no page errors (mixed case)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 2. a stale save
  {
    const { context, page, errors } = await open(dir, { stale: true })
    await page.goto(`${BASE}/admin/document-sources`)
    await page.locator('[data-document-source-edit="WSFD"]').click()
    const dialog = page.locator('[data-source-edit-dialog]')
    await dialog.waitFor({ timeout: 5000 })
    await dialog.locator('[data-source-description]').fill('Wasfaty renamed')
    await dialog.locator('[data-source-reason]').fill('rename')
    await page.locator('[data-source-edit-save]').click()
    await dialog.locator('[data-source-edit-error="SDC-00004"]').waitFor({ timeout: 5000 })
    check(`${dir} 2. a stale save says so and stays open`, (await page.locator('[data-source-edit-save]').isDisabled()) && (await dialog.count()) === 1)
    check(`${dir} 5. no page errors (stale)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
