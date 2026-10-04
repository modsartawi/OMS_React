// The caller bar replaces the customer rail (spec 380 C2/C7/C8, ticket 409; 379's
// variant C) — drives the REAL app in Chromium, the wire stubbed at Playwright from the
// contract's open fixture with the caller, the requests and the link set by this file.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/callcenter-callerbar-drive.mjs
//
// Asserts ticket 409's Proof, in light, dark and RTL at 1280 (English strings under
// dir="rtl" and an Arabic stub caller — there is no Arabic locale file):
//   1. two columns plus a bar: no customer rail; the caller bar is the first thing in the
//      centre, and the centre is 904px at 1280 (1280 − the 56px rail − the 320px receipt);
//   2. the caret is on `cc-phone` when the console opens, and back there after ✕;
//   3. the lookup is two steps: the found member appears INLINE in the bar with Attach,
//      and nothing is bound until it is pressed;
//   4. 🚩 the bar takes the same pixels before and after attach, and the centre's width
//      and the sentence's top do not change across it;
//   5. attached: railFields' six in the bar's order — name · tier · points · mobile ·
//      member · email — then the requests chip and ✕, on ONE line; the name in a `<bdi>`,
//      the mobile and member id in `Ltr` and mono; an Arabic name mirrors with ✕ at the
//      inline end;
//   6. the requests chip says "2 open requests · View" and opens 194's picker;
//   7. a miss offers *Sign this caller up*, and the sign-up opens in the flow under the
//      bar — never a modal;
//   8. a linked request is a *Converting request ‹no› ↗* chip whose detail opens in the
//      flow under the bar: the reason, the store, the note, ↗ and Unlink — Esc closes it
//      and focus returns to the chip; Unlink opens 195's confirmation;
//   9. the rail's address doors are gone (the sentence's address word is the only one),
//      and the caller step's hint points at the caller bar.
// Screenshots → tools/.callcenter-callerbar-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5280}`
const SHOTS = 'tools/.callcenter-callerbar-shots'
mkdirSync(SHOTS, { recursive: true })

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.body.data

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

let pass = 0
let fail = 0
const ok = (c, m, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const OPENED = fixture('01-open-empty').state
const FOUND_MOBILE = '0501076360'
const MISS_MOBILE = '0500000000'

/** ⚠ STUB: the loyalty member the lookup finds — an Arabic name, as the prototypes did. */
const MEMBER = {
  loyId: 'C-1000000034',
  mobile: '966501076360',
  fullName: 'فاطمة بنت عبدالله العتيبي',
  tier: 'Gold',
  pointsBalance: 4120,
  email: 'fatimah@example.com',
}

/** ⚠ STUB: the order once the member is attached — the door opens the address book. */
const ATTACHED = {
  ...OPENED,
  version: OPENED.version + 1,
  header: {
    ...OPENED.header,
    customer: { customerId: MEMBER.loyId, name: MEMBER.fullName, mobile: MEMBER.mobile, loyaltyAttached: true },
  },
  capabilities: {
    ...OPENED.capabilities,
    canOpenAddressBook: true,
    canLinkRequest: true,
    capabilityReasons: {},
    submitBlockers: OPENED.capabilities.submitBlockers.filter((code) => code !== 'NO_CUSTOMER'),
  },
}

/** ⚠ STUB: after ✕ — the order without its caller, one save point later. */
const REMOVED = { ...OPENED, version: OPENED.version + 2 }

/** ⚠ STUB: the caller's two open requests (880 §3's shape). */
const REQUESTS = [
  {
    documentNo: '1000004417',
    documentDate: '2026-10-01',
    storeCode: '1101',
    reason: 'TMRA',
    reasonDescription: 'Tamara payment',
    note: 'اتصل قبل الوصول',
    lines: [{ itemNumber: '200021', description: '8X4 DEO SPRAY', quantity: 2, uom: 'EA' }],
  },
  {
    documentNo: '1000004418',
    documentDate: '2026-10-02',
    storeCode: '1102',
    reason: 'OOS',
    reasonDescription: null,
    note: null,
    lines: [],
  },
]

/** ⚠ STUB: an order that converts the first request. */
const LINKED = {
  ...ATTACHED,
  header: {
    ...ATTACHED.header,
    linkedRequest: {
      documentNo: '1000004417',
      reason: 'TMRA',
      reasonDescription: 'Tamara payment',
      storeCode: '1101',
      note: 'Call before arrival — the building gate is on the side street',
    },
  },
}

const MODES = [
  { theme: 'light', dir: 'ltr' },
  { theme: 'dark', dir: 'ltr' },
  { theme: 'light', dir: 'rtl' },
]

const browser = await chromium.launch()
const allErrors = []
const viewport = { width: 1280, height: 800 }

async function open({ theme, dir }, { openState = OPENED } = {}) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  const wire = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
  let state = openState
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    wire.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (p.startsWith('CallCenterWeb/MemberByMobile/'))
      return route.fulfill(envelope(decodeURIComponent(p.split('/').pop()) === FOUND_MOBILE ? MEMBER : null))
    if (p === 'CallCenterWeb/AttachCustomer') return route.fulfill(envelope((state = ATTACHED)))
    if (p === 'CallCenterWeb/RemoveCustomer') return route.fulfill(envelope((state = REMOVED)))
    if (p === 'CallCenterWeb/CustomerRequests') return route.fulfill(envelope(REQUESTS))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-caller-bar]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors, wire }
}

/** The furniture: the bar's row, the sentence's top and the centre's width. */
const furniture = (page) =>
  page.evaluate(() => {
    const centre = document.querySelector('[data-cc-centre]').getBoundingClientRect()
    const row = document.querySelector('[data-cc-caller-bar] > :first-child').getBoundingClientRect()
    const sentence = document.querySelector('[data-cc-chips]').getBoundingClientRect()
    return {
      centreWidth: Math.round(centre.width),
      rowTop: Math.round(row.top - centre.top),
      rowHeight: Math.round(row.height),
      sentenceTop: Math.round(sentence.top - centre.top),
    }
  })

const caretOnPhone = (page) => page.evaluate(() => document.activeElement?.id === 'cc-phone')

/** Whether `inner` sits in the caller bar's block but AFTER its one-line row — in the
 *  flow under the bar, not in it and not in a dialog. */
const underBar = (page, inner) =>
  page.evaluate((sel) => {
    const bar = document.querySelector('[data-cc-caller-bar]')
    const row = bar?.firstElementChild
    const el = document.querySelector(sel)
    return !!(
      el &&
      bar.contains(el) &&
      !row.contains(el) &&
      !el.closest('dialog') &&
      row.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
    )
  }, inner)

for (const mode of MODES) {
  const at = `${mode.theme}/${mode.dir}`
  console.log(`\n${at}`)

  // ---- the lookup, the attach and the remove ----
  {
    const { context, page, errors, wire } = await open(mode)
    ok((await page.evaluate(() => document.documentElement.dir || 'ltr')) === mode.dir, `${at}: the document is ${mode.dir}`)

    // 1. Two columns plus a bar.
    ok((await page.locator('[data-cc-rail]').count()) === 0, `${at}: the customer rail is gone`)
    ok(
      await page.evaluate(() => document.querySelector('[data-cc-centre]')?.firstElementChild?.matches('[data-cc-caller-bar]')),
      `${at}: the caller bar is the first thing in the centre`,
    )
    const opened = await furniture(page)
    ok(opened.centreWidth === 904, `${at}: the centre is 904px at 1280`, `${opened.centreWidth}px`)

    // 9. The rail's address doors went with it.
    ok(
      (await page.locator('[data-cc-pick-address], [data-cc-change-address], [data-cc-collection]').count()) === 0,
      `${at}: no address door outside the sentence`,
    )
    ok(
      /caller bar/.test(await page.locator('[data-cc-step="caller"]').innerText()),
      `${at}: the caller step points at the caller bar`,
      await page.locator('[data-cc-step="caller"]').innerText(),
    )

    // 2. The caret, on open.
    ok(await caretOnPhone(page), `${at}: the caret is on cc-phone when the console opens`)

    // 3. Two steps: find, then attach.
    await page.keyboard.type(FOUND_MOBILE)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-lookup-found]').waitFor({ timeout: 10_000 })
    ok(
      (await page.locator('[data-cc-caller-lookup] [data-cc-lookup-found] [data-cc-attach]').count()) === 1,
      `${at}: the found member appears inline in the bar, with Attach`,
    )
    ok(!wire.includes('CallCenterWeb/AttachCustomer'), `${at}: finding is not attaching`)
    const found = await furniture(page)
    ok(found.rowHeight === opened.rowHeight, `${at}: the found member does not grow the bar`, `${found.rowHeight}px`)
    await page.screenshot({ path: `${SHOTS}/${mode.theme}-${mode.dir}-found.png` })

    // 4. 🚩 The attach moves no furniture.
    await page.locator('[data-cc-attach]').click()
    await page.locator('[data-cc-caller]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-request-offer]').waitFor({ timeout: 10_000 })
    const attached = await furniture(page)
    ok(
      attached.rowTop === opened.rowTop && attached.rowHeight === opened.rowHeight,
      `${at}: the bar takes the same pixels before and after attach (${opened.rowHeight}px)`,
      `${opened.rowHeight}px → ${attached.rowHeight}px`,
    )
    ok(attached.centreWidth === opened.centreWidth, `${at}: the centre's width is unchanged across the attach`)
    ok(attached.sentenceTop === opened.sentenceTop, `${at}: the sentence has not moved`)

    // 5. The six fields, in the bar's order, on one line.
    const line = await page.evaluate(() => {
      const row = document.querySelector('[data-cc-caller]')
      const rowBox = row.getBoundingClientRect()
      const fields = [...row.querySelectorAll('[data-cc-rail-field]')]
      const box = (el) => el.getBoundingClientRect()
      const parts = [...fields, row.querySelector('[data-cc-request-offer]'), row.querySelector('[data-cc-remove-caller]')]
      const mid = (el) => box(el).top + box(el).height / 2
      const name = row.querySelector('[data-cc-rail-field="name"]')
      const remove = row.querySelector('[data-cc-remove-caller]')
      const mono = (sel) => getComputedStyle(row.querySelector(sel)).fontFamily
      return {
        ids: fields.map((f) => f.dataset.ccRailField),
        oneLine: parts.every((el) => el && Math.abs(mid(el) - mid(row)) < 3),
        inside: parts.every((el) => box(el).left >= rowBox.left - 0.5 && box(el).right <= rowBox.right + 0.5),
        nameIsolate: name.querySelector('bdi')?.getAttribute('dir') ?? 'auto',
        mobileLtr: !!row.querySelector('[data-cc-rail-field="mobile"] bdi[dir="ltr"]'),
        memberLtr: !!row.querySelector('[data-cc-rail-field="member"] bdi[dir="ltr"]'),
        mobileMono: /mono/i.test(mono('[data-cc-rail-field="mobile"]')),
        memberMono: /mono/i.test(mono('[data-cc-rail-field="member"] .font-mono')),
        removeAtEnd:
          getComputedStyle(row).direction === 'rtl'
            ? box(remove).right < box(name).left
            : box(remove).left > box(name).right,
        removeLabel: remove.getAttribute('aria-label'),
        removeText: remove.innerText.trim(),
        nameText: name.innerText,
        // Drawn whole, not clamped: at 1280 the email is what gives first.
        nameClamped: (() => {
          const bdi = name.querySelector('bdi')
          return bdi.scrollWidth > bdi.clientWidth + 1
        })(),
        offerText: row.querySelector('[data-cc-request-offer]').innerText.trim(),
      }
    })
    ok(
      line.ids.join(',') === 'name,tier,points,mobile,member,email',
      `${at}: railFields' six, in the bar's order`,
      line.ids.join(','),
    )
    ok(line.oneLine, `${at}: name · tier · points · mobile · member · email · chip · ✕ on ONE line at 1280`)
    ok(line.inside, `${at}: and nothing is clipped off the bar`)
    ok(line.nameIsolate === 'auto', `${at}: the name is in a <bdi> (dir auto)`)
    ok(line.mobileLtr && line.memberLtr, `${at}: the mobile and the member id are in Ltr`)
    ok(line.mobileMono && line.memberMono, `${at}: and set in mono`)
    ok(line.nameText.includes(MEMBER.fullName), `${at}: the Arabic name is whole`, line.nameText)
    ok(!line.nameClamped, `${at}: and drawn whole at 1280 — the email gives first`)
    ok(line.removeAtEnd, `${at}: ✕ is at the inline end${mode.dir === 'rtl' ? ' — the left, under RTL' : ''}`)
    ok(!!line.removeLabel && line.removeText === '', `${at}: ✕ is icon-only, with its aria label`, line.removeLabel)

    // 6. The requests chip, short and plural, opening 194's picker unchanged.
    ok(line.offerText === '2 open requests · View', `${at}: the chip reads "2 open requests · View"`, line.offerText)
    // Laid out, not just in the DOM: the count is the chip's first glyph in every mode.
    const chipVisual = await page.locator('[data-cc-request-offer]').evaluate((el) => {
      const chars = []
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        for (let i = 0; i < n.textContent.length; i++) {
          const range = document.createRange()
          range.setStart(n, i)
          range.setEnd(n, i + 1)
          const box = range.getBoundingClientRect()
          if (box.width > 0) chars.push({ ch: n.textContent[i], x: box.left + box.width / 2 })
        }
      return chars.sort((a, b) => a.x - b.x).map((c) => c.ch).join('').trim()
    })
    ok(chipVisual === '2 open requests · View', `${at}: and reads that way on screen`, chipVisual)
    await page.screenshot({ path: `${SHOTS}/${mode.theme}-${mode.dir}-attached.png` })
    await page.locator('[data-cc-request-view]').click()
    await page.locator('[data-cc-request-picker]').waitFor({ timeout: 10_000 })
    ok(
      (await page.locator('[data-cc-request-option], [data-cc-request-link]').count()) >= 2,
      `${at}: the chip opens 194's picker, listing the requests`,
    )
    await page.locator('[data-cc-request-close]').click()
    await page.locator('[data-cc-request-picker]').waitFor({ state: 'detached', timeout: 10_000 })

    // 2. The caret, after ✕.
    await page.locator('[data-cc-remove-caller]').click()
    await page.locator('#cc-phone').waitFor({ timeout: 10_000 })
    await page.waitForFunction(() => document.activeElement?.id === 'cc-phone', null, { timeout: 5_000 }).catch(() => {})
    ok(await caretOnPhone(page), `${at}: the caret is back on cc-phone after ✕`)
    const removed = await furniture(page)
    ok(
      removed.rowHeight === opened.rowHeight && removed.centreWidth === opened.centreWidth,
      `${at}: and the bar and the centre are where they started`,
    )
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }

  // ---- 7. a miss, and the sign-up in the flow ----
  {
    const { context, page, errors } = await open(mode)
    const opened = await furniture(page)
    await page.keyboard.type(MISS_MOBILE)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-lookup-miss]').waitFor({ timeout: 10_000 })
    ok(
      (await page.locator('[data-cc-caller-lookup] [data-cc-lookup-miss] [data-cc-signup-open]').count()) === 1,
      `${at}: a miss offers "Sign this caller up" in the bar`,
    )
    ok(
      (await page.locator('[data-cc-signup-open]').innerText()).trim() === 'Sign this caller up',
      `${at}: in those words`,
    )
    await page.locator('[data-cc-signup-open]').click()
    await page.locator('[data-cc-signup]').waitFor({ timeout: 10_000 })
    ok(await underBar(page, '[data-cc-signup]'), `${at}: the sign-up opens in the flow under the bar`)
    ok((await page.locator('dialog[open]').count()) === 0, `${at}: never as a modal`)
    const signing = await furniture(page)
    ok(
      signing.rowHeight === opened.rowHeight && signing.centreWidth === opened.centreWidth,
      `${at}: the bar keeps its row and the centre its width`,
    )
    await page.screenshot({ path: `${SHOTS}/${mode.theme}-${mode.dir}-signup.png` })
    ok(errors.length === 0, `${at}: no console errors (sign-up)`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }

  // ---- 8. the linked request: a chip, and its detail in the flow ----
  {
    const { context, page, errors } = await open(mode, { openState: LINKED })
    await page.locator('[data-cc-request-chip]').waitFor({ timeout: 10_000 })
    const chip = (await page.locator('[data-cc-request-card]').innerText()).replace(/\s+/g, ' ').trim()
    ok(/Converting request\s*1000004417/.test(chip), `${at}: the chip reads "Converting request 1000004417"`, chip)
    ok((await page.locator('[data-cc-request-chip-open]').count()) === 1, `${at}: with its ↗`)
    ok((await page.locator('[data-cc-request-offer]').count()) === 0, `${at}: and it replaces the count`)
    ok((await page.locator('[data-cc-section="linked-request"]').count()) === 0, `${at}: the detail does not open by itself`)

    await page.locator('[data-cc-request-chip]').click()
    await page.locator('[data-cc-section="linked-request"]').waitFor({ timeout: 5_000 })
    ok(await underBar(page, '[data-cc-section="linked-request"]'), `${at}: the detail opens in the flow under the bar`)
    ok(
      (await page.locator('[data-cc-request-chip]').getAttribute('aria-expanded')) === 'true',
      `${at}: and the chip says it is expanded`,
    )
    const detail = await page.evaluate(() => {
      const section = document.querySelector('[data-cc-section="linked-request"]')
      const text = (sel) => section.querySelector(sel)?.innerText.trim() ?? null
      return {
        reason: text('[data-cc-request-card-reason]'),
        store: text('[data-cc-request-card-store]'),
        note: text('[data-cc-request-card-note]'),
        href: section.querySelector('[data-cc-request-card-open]')?.getAttribute('href') ?? null,
        unlink: !!section.querySelector('[data-cc-request-unlink]'),
        text: section.innerText,
      }
    })
    ok(detail.reason === 'Tamara payment', `${at}: the reason, in words`, detail.reason)
    ok(detail.store === '1101' && /Raised at store/.test(detail.text), `${at}: raised at store 1101`, detail.store)
    ok(/building gate/.test(detail.note ?? ''), `${at}: the pharmacist's note`, detail.note)
    ok(detail.href === '/oms/document/1000004417', `${at}: the ↗ to the request`, detail.href)
    ok(!/TMRA/.test(detail.text), `${at}: and never the reason code`)
    ok(!/SAR|\d+\.\d{2}/.test(detail.text), `${at}: and no money`)
    await page.screenshot({ path: `${SHOTS}/${mode.theme}-${mode.dir}-linked.png` })

    // Esc closes it, and focus returns to the chip (175 §9's section).
    await page.keyboard.press('Escape')
    await page.locator('[data-cc-section="linked-request"]').waitFor({ state: 'detached', timeout: 5_000 })
    ok(
      await page.evaluate(() => document.activeElement?.hasAttribute('data-cc-request-chip')),
      `${at}: Esc closes the detail and focus returns to the chip`,
    )
    // The keyboard reopens it, and Unlink opens 195's confirmation unchanged.
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-section="linked-request"]').waitFor({ timeout: 5_000 })
    ok(true, `${at}: Enter on the chip reopens the detail`)
    await page.locator('[data-cc-request-unlink]').click()
    await page.locator('[data-cc-confirm-sheet="unlink"]').waitFor({ timeout: 5_000 })
    ok(
      /caller stays/i.test(await page.locator('[data-cc-confirm-sheet="unlink"]').innerText()),
      `${at}: Unlink opens 195's confirmation`,
    )
    await page.locator('[data-cc-confirm-decline]').click()
    await page.locator('[data-cc-confirm-sheet="unlink"]').waitFor({ state: 'detached', timeout: 5_000 })
    ok((await page.locator('[data-cc-request-chip]').count()) === 1, `${at}: declining keeps the link`)
    ok(errors.length === 0, `${at}: no console errors (linked)`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 && allErrors.length === 0 ? 0 : 1)
