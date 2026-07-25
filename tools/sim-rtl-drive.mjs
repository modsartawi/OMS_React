// Simulation RTL / bidi / hue drive (ticket 121, spec 110).
//
// **This file used to drive the three approved PROTOTYPES** (ticket 106's audit, when the
// reworked screen was a spec in progress and did not exist in code). It now drives the
// REAL app on port 5205, serving the 098 captures as the wire like every other
// `sim-*-drive.mjs`. That is the whole job of this slice: the audit's result is known and
// counted, and this is it going green against the rebuilt markup.
//
//   1. run the app:  npx vite --port 5205
//   2. node tools/sim-rtl-drive.mjs
//
// Method is inherited from the 080 / 106 audits: **bidi is never reasoned about on
// paper.** Every claim below is read off character client rects, off computed styles, or
// off a rendered transform — 080 overturned two of its own first-draft claims, and 106
// overturned three of its ticket's guesses, which is how that rule was earned.
//
// The state matrix is the ticket's: the strip COLLAPSED and EXPANDED, a line's expansion
// SHUT and OPEN, the arrangement BESIDE (1400) and STACKED (780), plus the pre-run
// screen and the whole-run 400 — each in both directions.
//
// Five passes:
//   1. MIRRORING — the arrangement's geometry in both directions, plus a source sweep
//      for physical Tailwind utilities. The audit found ZERO physical utilities and
//      zero mirroring faults; this keeps it that way, since a screen with no physical
//      spelling anywhere is the cheap half of RTL and the easy half to lose.
//   2. BIDI — every visible run in the work area that carries a digit and a space must
//      keep its internal order under RTL. Measured twice: as shipped (nothing may
//      reorder) and with every isolate NEUTRALISED, which is what makes the "the dumb
//      rule is a SUPERSET" assertion mean something after the wrappers are in.
//   3. ICONS — the twisty, the bonus-buy control and the buy→get arrow must point the
//      way the text runs, measured off the rendered transform; `▶ Process` must NOT
//      mirror (the ruled exception); and no directional glyph may be a punctuation
//      CHARACTER, which is the double-mirror trap's entry point.
//   4. HUE — the screen spends exactly two: `success` only on a fired promotion,
//      `attention` only where the engine flagged a line. Asserted on COMPUTED styles,
//      not by lint: `npm run lint`'s colour gates already guard which values may be
//      used, but which token is spent WHERE is only visible in a rendered tree.
//   5. UPPERCASE — the seven chip keys and the badges carry their case in the JSON
//      value, never a CSS `text-transform` (a no-op on Arabic script). The JSON half is
//      `tools/check-sim-keys.mjs`; the rendered half is here.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5205}`
const DIR = '.issues/assets/098-simulate-payloads/'
const FEATURE = 'src/features/pricing/simulation'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

/** The one whole-run 400 with a raw server message in it — the banner's bidi call site. */
const REJECTION = {
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 400,
    success: false,
    message: "UoM 'EA' is not valid for material '32423333'.",
    errors: [
      {
        errorCode: 'INVALID_UOM',
        internalErrorCode: null,
        errorMessage: "UoM 'EA' is not valid for material '32423333'.",
      },
    ],
    data: null,
  }),
}

const capture = (file) => JSON.parse(readFileSync(DIR + file, 'utf8')).response.data

/**
 * - `elements` — the only capture carrying a pricing-elements trace, and it fires a
 *   promotion too, so the expansion and the rail are measured on ONE basket.
 * - `both-kinds` — a fired card AND a near-miss, which is the only state where the
 *   near-miss card's own runs and its twisty exist at all.
 * - `w-line` — a line that did not price, whose `[070]` engine message rides the LINE.
 *   The longest digit-and-space run on the screen, and the `attention` spend's home.
 */
const CAPTURES = {
  elements: capture('05-pricing-elements.json'),
  'both-kinds': capture('03-applied-and-potential-owner-supplied.json'),
  'w-line': capture('04b-no-price.json'),
}

// ── page-side helpers ────────────────────────────────────────────────────────────
/**
 * Visual order of a run: x of its first CONTENT character minus x of its last.
 * `> 0` means the run reads left-to-right on screen whatever the paragraph is doing.
 * Inherited from the 106 audit — the measurement, not a re-derivation — with one
 * correction the audit's own findings require:
 *
 * **Content means alphanumeric.** A leading or trailing NEUTRAL (a comma, a quote, a
 * closing period, `%`, `▾`) resolves from the surrounding LINE and not from the run
 * (bidi N1/N2), so it legitimately relocates to the paragraph edge under RTL while the
 * value itself stays intact. 080 ruled that class **not a bug** and 106 re-measured it;
 * measuring from the punctuation would report `Vat %` and `Process a basket to see
 * results.` as scrambled values, which is exactly the false positive that would push a
 * later session into wrapping English prose. Runs of that class are reported separately
 * rather than hidden.
 */
const READS_LTR = (node) => {
  const doc = node.ownerDocument
  const nodes =
    node.nodeType === 3
      ? [node]
      : (() => {
          const w = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT)
          const out = []
          for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) out.push(n)
          return out
        })()
  if (!nodes.length) return null
  const at = (n, offset) => {
    const r = doc.createRange()
    r.setStart(n, offset)
    r.setEnd(n, offset + 1)
    return r.getBoundingClientRect().x
  }
  const CONTENT = /[\p{L}\p{N}]/u
  const first = nodes.find((n) => CONTENT.test(n.data))
  const last = [...nodes].reverse().find((n) => CONTENT.test(n.data))
  if (!first || !last) return null
  const i = [...first.data].findIndex((c) => CONTENT.test(c))
  const chars = [...last.data]
  let j = -1
  for (let k = 0; k < chars.length; k++) if (CONTENT.test(chars[k])) j = k
  // A one-character value has no internal order to lose.
  if (first === last && i === j) return 0
  return at(last, j) - at(first, i)
}

const PRELUDE = `
window.READS_LTR = ${READS_LTR.toString()}

// A run can only reorder at all if it carries a digit and a space — the dumb rule, kept
// dumb on purpose (106: no run-local predicate can be exact, because W7 under-fires it
// and N1/N2 over-fire it, so what must hold is that it is a SUPERSET of real breakage).
window.HAS_DIGIT_AND_SPACE = (s) => /\\d/.test(s) && /\\s/.test(s)

window.VISIBLE = (el) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

window.WHERE = (el) => {
  const parts = []
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const marker = [...n.attributes].find((a) => a.name.startsWith('data-') && a.name !== 'data-slot')
    parts.unshift(marker ? n.tagName.toLowerCase() + '[' + marker.name + ']' : n.tagName.toLowerCase())
    if (n.hasAttribute && n.hasAttribute('data-sim-work-area')) break
  }
  return parts.join('>').slice(-90)
}

/** Every visible text run in the work area, with its measured visual order. Text INSIDE
 *  a form control is skipped: an <input>'s value is not a run the paragraph can reorder,
 *  and the collapsed strip is where the values are actually read. */
window.RUNS = () => {
  const root = document.querySelector('[data-sim-work-area]') || document.body
  const out = []
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const text = n.data.replace(/\\s+/g, ' ').trim()
    if (!text) continue
    const el = n.parentElement
    if (!el || !window.VISIBLE(el)) continue
    if (el.closest('input, textarea, select, option')) continue
    const order = window.READS_LTR(n)
    if (order === null) continue
    out.push({
      text,
      where: window.WHERE(el),
      candidate: window.HAS_DIGIT_AND_SPACE(text),
      isolated: Boolean(el.closest('bdi')),
      order: Math.round(order),
    })
  }
  return out
}

/** Pass 2b: a value COMPOSED of several inline children — a figure and its unit across
 *  two elements (105.18 + SAR). 080 proved that wrapping a FRAGMENT of a run creates
 *  a fault, so the element granularity has to be measured too: the fix for a composed
 *  value is one isolate around the WHOLE of it.
 *
 *  Restricted to figure-and-unit on purpose. A LABEL and its amount (Net total +
 *  136.44, DISCOUNT + -105.18) is not one value — it is a container, and its two
 *  parts SHOULD swap under RTL so the label still leads from the reading edge. 106's
 *  composed pass conflated the two classes; measured against the built screen that
 *  reports the money foot's own correct mirroring as a bidi fault, and "isolate the
 *  label too" would be the wrong repair. */
window.IS_FIGURE_AND_UNIT = (s) =>
  /^[-−+]?[\\d.,]+\\s*[A-Za-z%×]{1,4}$/.test(s) || /^[A-Za-z%×]{1,4}\\s*[-−+]?[\\d.,]+$/.test(s)

window.COMPOSED = () => {
  const root = document.querySelector('[data-sim-work-area]') || document.body
  const out = []
  for (const el of root.querySelectorAll('*')) {
    const kids = [...el.children]
    if (kids.length < 1 || kids.length > 2) continue
    if (kids.some((k) => k.children.length)) continue
    if (el.closest('input, textarea, select')) continue
    const text = el.textContent.replace(/\\s+/g, ' ').trim()
    if (!text || text.length > 30 || !window.HAS_DIGIT_AND_SPACE(text)) continue
    if (!window.IS_FIGURE_AND_UNIT(text)) continue
    if (!window.VISIBLE(el)) continue
    const order = window.READS_LTR(el)
    if (order === null) continue
    out.push({ text, where: window.WHERE(el), isolated: Boolean(el.closest('bdi')), order: Math.round(order) })
  }
  return out
}

/** Turn every bidi isolate in the page off (or back on). What the screen would do
 *  WITHOUT its wrappers — the only way to keep asserting that the wrappers were owed
 *  once they are in place. */
window.SET_ISOLATION = (on) => {
  let style = document.getElementById('__noisolate')
  if (on) { if (style) style.remove(); return }
  if (!style) {
    style = document.createElement('style')
    style.id = '__noisolate'
    style.textContent = 'bdi { unicode-bidi: normal !important; direction: inherit !important }'
    document.head.appendChild(style)
  }
}
`

/**
 * The rendered horizontal direction of an icon: `-1` mirrored, `1` not.
 *
 * Composed from all THREE places a flip can live — `transform`, and Tailwind v4's
 * separate `scale` and `rotate` longhands — because reading only `transform` reports
 * every v4 utility as `none` and would pass a screen whose icons never flip. Multiplying
 * them is also what catches the **double mirror**: a character that self-mirrors plus an
 * explicit flip lands back on `1`, which is 080's trap and the reason this is measured.
 */
const flipOf = (page, selector) =>
  page.locator(selector).first().evaluate((el) => {
    const svg = el.tagName.toLowerCase() === 'svg' ? el : el.querySelector('svg')
    const target = svg || el
    const s = getComputedStyle(target)
    const m = s.transform && s.transform !== 'none' ? new DOMMatrix(s.transform) : { a: 1 }
    // `scale: -1 1` / `scale: -100% 100%` — the x factor is the first component.
    const scaleX =
      s.scale && s.scale !== 'none' ? parseFloat(s.scale) * (/%/.test(s.scale.split(' ')[0]) ? 0.01 : 1) : 1
    // A rotate of exactly 180deg mirrors a horizontally-symmetric glyph the same way a
    // scaleX does — the audit's `rtl:rotate-180` precedent — so it counts as a flip.
    const deg = s.rotate && s.rotate !== 'none' ? Math.abs(parseFloat(s.rotate)) % 360 : 0
    const rot = Math.abs(deg - 180) < 1 ? -1 : 1
    const sign = Math.sign((m.a || 1) * (scaleX || 1) * rot)
    return {
      a: sign,
      detail: `transform=${s.transform} scale=${s.scale} rotate=${s.rotate}`,
      tag: target.tagName.toLowerCase(),
    }
  })

/**
 * A file's CODE lines, with every comment blanked out and the original line numbers
 * kept. The source sweeps below (physical utilities, character icons) are about what the
 * screen renders, and both audits' prose names the very spellings they forbid — a sweep
 * that read comments would fail on its own explanation of why it exists.
 */
const codeLines = (file) => {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
  return src.split('\n').map((line, i) => ({ line, n: i + 1 }))
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1672, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // The 400 state is a state under test, so the browser's own "failed to load resource"
  // for it is expected noise — a REAL page error still lands here.
  page.on(
    'console',
    (m) => m.type() === 'error' && !/status of 400/.test(m.text()) && errors.push(m.text()),
  )

  let serving = 'elements'
  let failing = false

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    // `{ screenAllowed }`, the shape `bonusBuyAccessApi.access()` reads — a `canOpen`
    // here would probe as DENIED and the bonus-buy control would be absent, which is the
    // gate working correctly and the icon check measuring nothing.
    if (p === 'Bby/Access') return route.fulfill(envelope({ screenAllowed: true }))
    if (p === 'Pricing/Simulate')
      return route.fulfill(failing ? REJECTION : envelope(CAPTURES[serving]))
    return route.fulfill(envelope({}))
  })

  const workArea = () => page.locator('[data-sim-work-area]')
  const box = (locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON())

  /** Set the VIEWPORT so the WORK AREA measures `target` — the shell's chrome is
   *  calibrated by measurement, exactly as `sim-responsive-drive.mjs` does it. */
  async function setWorkArea(target) {
    for (let i = 0; i < 6; i++) {
      const w = await workArea().evaluate((el) => el.getBoundingClientRect().width)
      if (Math.abs(w - target) < 1) return w
      const vw = page.viewportSize().width
      await page.setViewportSize({ width: Math.round(vw + (target - w)), height: 1100 })
      await page.waitForTimeout(150)
    }
    return workArea().evaluate((el) => el.getBoundingClientRect().width)
  }

  const setDir = async (dir) => {
    await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
    await page.waitForTimeout(80)
  }

  const runProcess = async () => {
    await page.getByRole('button', { name: /Process/ }).first().click()
    await page.waitForTimeout(450)
  }

  const hydrate = () => page.evaluate(PRELUDE)

  await page.goto(`${BASE}/pricing/simulation`)
  await page.locator('[data-run-strip]').waitFor()
  await page.addScriptTag({ content: PRELUDE })
  await page.waitForTimeout(250)

  /**
   * The state matrix. Each entry leaves the screen in one state; every pass below runs
   * over all of them in both directions. `basket` fills the items grid; `after` does the
   * per-state opening (expand the strip, open a line, stack the arrangement).
   */
  const STATES = [
    {
      name: 'pre-run · nothing processed yet',
      async setup() {
        await page.reload()
        await page.locator('[data-run-strip]').waitFor()
        await page.waitForTimeout(250)
        await setWorkArea(1400)
      },
    },
    {
      name: 'the strip COLLAPSED over a priced run · beside · expansion shut',
      async setup() {
        serving = 'elements'
        failing = false
        await setWorkArea(1400)
        await page.locator('table').first().locator('tbody input').first().fill('107255')
        await page.locator('table').first().locator('tbody input').nth(1).fill('1')
        await runProcess()
      },
    },
    {
      name: 'the same run with a line EXPANDED — rules, money foot and elements trace',
      async setup() {
        await page.locator('[data-result-line]').first().click()
        await page.waitForTimeout(200)
      },
      async teardown() {
        await page.locator('[data-result-line]').first().click()
        await page.waitForTimeout(150)
      },
    },
    {
      name: 'the strip EXPANDED — the form in place of the collapsed row',
      async setup() {
        await page.locator('[data-chip-set]').click()
        await page.waitForTimeout(200)
      },
      async teardown() {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(200)
      },
    },
    {
      name: 'a fired card AND a near-miss · beside · the near-miss OPEN',
      async setup() {
        serving = 'both-kinds'
        await runProcess()
        await page.locator('[data-promo-card="missed"] button[aria-expanded]').first().click()
        await page.waitForTimeout(200)
      },
    },
    {
      name: 'the same cards STACKED at a 780 px work area',
      async setup() {
        await setWorkArea(780)
      },
      async teardown() {
        await setWorkArea(1400)
      },
    },
    {
      name: 'a `W` line that did not price — its [070] engine message on the line',
      async setup() {
        serving = 'w-line'
        await runProcess()
      },
    },
    {
      name: 'the whole-run 400 — the server message in the banner',
      async setup() {
        failing = true
        await runProcess()
      },
      async teardown() {
        failing = false
      },
    },
  ]

  // ── pass 1 + 2 + 5 accumulate across the matrix ─────────────────────────────────
  const runsByText = new Map() // as-shipped: text -> { ltr, rtl, ... }
  const bareByText = new Map() // isolation neutralised: what the screen would do unwrapped
  const composedByText = new Map() // as-shipped, multi-element values
  const bareComposed = new Map()
  const geo = [] // per-state mirroring geometry
  const hues = [] // per-state hue spends
  const caps = [] // per-state uppercase readings

  for (const state of STATES) {
    await state.setup()
    await hydrate()

    for (const dir of ['ltr', 'rtl']) {
      await setDir(dir)
      await hydrate()

      // ---- 2 · bidi, as shipped -------------------------------------------------
      for (const r of await page.evaluate(() => window.RUNS())) {
        const rec = runsByText.get(r.text) || { ...r, states: [], ltr: null, rtl: null }
        rec[dir] = r.order
        rec.isolated = rec.isolated || r.isolated
        if (!rec.states.includes(state.name)) rec.states.push(state.name)
        runsByText.set(r.text, rec)
      }

      for (const c of await page.evaluate(() => window.COMPOSED())) {
        const rec = composedByText.get(c.text) || { ...c, ltr: null, rtl: null }
        rec[dir] = c.order
        composedByText.set(c.text, rec)
      }

      // ---- 2b · bidi, with every isolate turned OFF ------------------------------
      await page.evaluate(() => window.SET_ISOLATION(false))
      await page.waitForTimeout(30)
      for (const r of await page.evaluate(() => window.RUNS())) {
        const rec = bareByText.get(r.text) || { ...r, ltr: null, rtl: null }
        rec[dir] = r.order
        bareByText.set(r.text, rec)
      }
      for (const c of await page.evaluate(() => window.COMPOSED())) {
        const rec = bareComposed.get(c.text) || { ...c, ltr: null, rtl: null }
        rec[dir] = c.order
        bareComposed.set(c.text, rec)
      }
      await page.evaluate(() => window.SET_ISOLATION(true))
      await page.waitForTimeout(30)

      // ---- 1 · mirroring geometry ------------------------------------------------
      geo.push({
        state: state.name,
        dir,
        ...(await page.evaluate(() => {
          const x = (sel) => {
            const el = document.querySelector(sel)
            if (!el) return null
            const r = el.getBoundingClientRect()
            return r.width > 0 ? Math.round(r.x) : null
          }
          const line = document.querySelector('[data-result-line]')
          const border = line
            ? (() => {
                const s = getComputedStyle(line)
                return {
                  left: Math.round(parseFloat(s.borderLeftWidth) || 0),
                  right: Math.round(parseFloat(s.borderRightWidth) || 0),
                }
              })()
            : null
          const moneyCell = document.querySelector('[data-result-line] td:last-child')
          const doc = document.documentElement
          return {
            head: x('[data-strip-group="head"]'),
            tail: x('[data-strip-group="tail"]'),
            results: x('[data-work-area="results"]'),
            rail: x('[data-promotions-rail]'),
            lineBorder: border,
            moneyAlign: moneyCell ? getComputedStyle(moneyCell).textAlign : null,
            overflowX: doc.scrollWidth - doc.clientWidth,
          }
        })),
      })

      // ---- 4 · hue, on computed styles ------------------------------------------
      hues.push({
        state: state.name,
        dir,
        ...(await page.evaluate(() => {
          const root = getComputedStyle(document.documentElement)
          const hex = (name) => root.getPropertyValue(name).trim().toLowerCase()
          const rgb = (h) => {
            const m = /^#?([0-9a-f]{6})$/.exec(h)
            if (!m) return null
            const n = parseInt(m[1], 16)
            return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
          }
          // Every SEVERITY family the design system offers, so a third one shows up as a
          // family this screen was not supposed to have rather than as a silent pass.
          //
          // `primary` is deliberately NOT in the list. The budget under test is the
          // severity budget — "hue on this screen is reserved for severity" (100 §2) —
          // and `primary` is the interface accent every screen in the app is built on:
          // the Process button, the open line's 3 px edge, the fired count, the
          // bonus-buy control. Counting it would make the assertion fail on the design
          // system rather than on this screen, and would say nothing about whether
          // success and attention are spent where they were ruled to be.
          const FAMILIES = ['success', 'attention', 'danger', 'destructive', 'go']
          const paint = new Map() // family -> Set of computed values
          for (const family of FAMILIES) {
            const values = new Set()
            for (const suffix of ['', '-050', '-100', '-border', '-800', '-900']) {
              const v = rgb(hex(`--${family}${suffix}`))
              if (v) values.add(v)
            }
            if (values.size) paint.set(family, values)
          }
          const area = document.querySelector('[data-sim-work-area]')
          const spends = []
          if (area) {
            for (const el of area.querySelectorAll('*')) {
              const s = getComputedStyle(el)
              const r = el.getBoundingClientRect()
              if (r.width === 0 || r.height === 0) continue
              for (const [family, values] of paint) {
                const props = []
                for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderInlineStartColor'])
                  if (values.has(s[prop])) props.push(prop)
                if (!props.length) continue
                // Which of the two RULED homes is this spend in?
                //
                // ⚠️ The ticket words the second home as "attention on a `W` line". The
                // built screen has one more place carrying it: the line expansion's
                // advisory `Pricing messages` panel, which appears on a line that DID
                // price and still has engine messages (116 shipped it that way). This
                // drive counts that as the same home — the engine flagging something —
                // and the widening is recorded in the ticket's close-out rather than
                // being buried here, because a passing assertion must not read as proof
                // of a stricter rule than the one being checked. The alternative was to
                // neutralise a real signal this ticket was not asked to change.
                const home =
                  el.closest('[data-fired-mark]') || el.closest('[data-promo-card="fired"]')
                    ? 'fired-promotion'
                    : el.closest('[data-line-priced="no"]') ||
                        el.closest('[data-pricing-messages]') ||
                        el.closest('[data-sim-failure]')
                      ? 'engine-flagged'
                      : 'UNRULED',
                  where = (() => {
                    const parts = []
                    for (let n = el; n && n !== area; n = n.parentElement) {
                      const marker = [...n.attributes].find((a) => a.name.startsWith('data-'))
                      parts.unshift(marker ? `${n.tagName.toLowerCase()}[${marker.name}]` : n.tagName.toLowerCase())
                    }
                    return parts.join('>').slice(-80)
                  })()
                spends.push({ family, props, home, where, text: el.textContent.slice(0, 30) })
              }
            }
          }
          return { spends }
        })),
      })

      // ---- 5 · the uppercase keys, rendered -------------------------------------
      caps.push({
        state: state.name,
        dir,
        ...(await page.evaluate(() => {
          const read = (sel) =>
            [...document.querySelectorAll(sel)].map((el) => ({
              text: el.textContent.replace(/\s+/g, ' ').trim(),
              transform: getComputedStyle(el).textTransform,
            }))
          return {
            // Every mark 121's ledger requires to be authored uppercase — the seven
            // `strip.key.*`, the three `detail.badge.*`, `detail.stat` and `promo.free`
            // — carries `data-upper-mark`. Selected by marker, not by position:
            // `[data-chip] span:first-child` would also collect the pricing-date value
            // and `PROMO on`, neither of which is in the ledger, and would MISS the
            // badges and `FREE`, which are.
            marks: read('[data-upper-mark]'),
          }
        })),
      })
    }

    await setDir('ltr')
    if (state.teardown) await state.teardown()
  }

  // ── pass 1 · report the mirroring geometry ──────────────────────────────────────
  const pairs = []
  for (let i = 0; i < geo.length; i += 2) pairs.push([geo[i], geo[i + 1]])
  const flips = (a, b) =>
    a[0] !== null && a[1] !== null && b[0] !== null && b[1] !== null ? a[0] < a[1] === b[0] > b[1] : null

  const stripPairs = pairs.filter(([l]) => l.head !== null && l.tail !== null)
  const stripBad = stripPairs.filter(([l, r]) => flips([l.head, l.tail], [r.head, r.tail]) !== true)
  check(
    `the run strip mirrors in every state — chips lead from the reading edge, the money-and-controls tail trails (${stripPairs.length} states)`,
    stripPairs.length >= 6 && stripBad.length === 0,
    stripBad.map(([l, r]) => `${l.state}: ltr ${l.head}/${l.tail} rtl ${r.head}/${r.tail}`).join(' | ') ||
      stripPairs.map(([l, r]) => `ltr ${l.head}→${l.tail} · rtl ${r.head}→${r.tail}`)[1],
  )

  const splitPairs = pairs.filter(([l]) => l.results !== null && l.rail !== null)
  const beside = splitPairs.filter(([l]) => !/STACKED/.test(l.state))
  const besideBad = beside.filter(
    ([l, r]) => flips([l.results, l.rail], [r.results, r.rail]) !== true,
  )
  check(
    `the 66/34 split mirrors — results lead, promotions rail trails (${beside.length} beside states)`,
    beside.length >= 2 && besideBad.length === 0,
    besideBad.map(([l, r]) => `${l.state}: ltr ${l.results}/${l.rail} rtl ${r.results}/${r.rail}`).join(' | '),
  )
  const stacked = splitPairs.filter(([l]) => /STACKED/.test(l.state))
  check(
    'and STACKED it mirrors by not moving — one column, so both frames share an inline start in both directions',
    stacked.length > 0 && stacked.every(([l, r]) => l.results === l.rail && r.results === r.rail),
    stacked.map(([l, r]) => `ltr ${l.results}/${l.rail} · rtl ${r.results}/${r.rail}`).join(' | '),
  )

  const borderPairs = pairs.filter(([l]) => l.lineBorder && (l.lineBorder.left || l.lineBorder.right))
  check(
    'the result line’s accent edge swaps physical sides — a logical border, never a box-shadow (080’s F4 shape)',
    borderPairs.length > 0 &&
      borderPairs.every(([l, r]) => l.lineBorder.left > 0 && r.lineBorder.right > 0 && r.lineBorder.left === 0),
    borderPairs.map(([l, r]) => `ltr ${JSON.stringify(l.lineBorder)} rtl ${JSON.stringify(r.lineBorder)}`)[0],
  )
  // The money columns are spelled `end`, which RESOLVES per direction — never `right`,
  // which would pin them to the physical right under RTL. The computed value stays the
  // logical keyword in this engine, so the spelling IS the measurement here; the visual
  // half is covered by the split and the accent-edge checks above.
  const alignPairs = pairs.filter(([l]) => l.moneyAlign)
  check(
    'the money column’s alignment is logical — `end`/`start` in both directions, never `right`/`left`',
    alignPairs.length > 0 &&
      alignPairs.every(([l, r]) => /^(end|start)$/.test(l.moneyAlign) && l.moneyAlign === r.moneyAlign),
    alignPairs.map(([l, r]) => `ltr=${l.moneyAlign} rtl=${r.moneyAlign}`)[0],
  )
  const overflowBad = pairs.filter(([l, r]) => r.overflowX > Math.max(l.overflowX, 0) + 1)
  check(
    'no state gains a horizontal scrollbar under RTL',
    overflowBad.length === 0,
    overflowBad.map(([l, r]) => `${l.state}: ltr ${l.overflowX} rtl ${r.overflowX}`).join(' | '),
  )

  // The mirroring half of this ticket is EMPTY, and the assertion is what keeps it that
  // way: the vocabulary shipped before these regions were authored, so nothing here is
  // named for the `dir`-switch effort. A single physical utility would silently re-open
  // that debt.
  // Every physical spelling the rule tabulates, with NO character-class guard after the
  // dash: an earlier version required a digit there and would have waved through
  // `ml-auto`, `rounded-l-lg` and `border-l-border` — the exact shapes 080's F1 and F4
  // were. `-ms-[3px]`-style negatives are matched by the same alternation, since the
  // token still begins `ml`/`mr`/`pl`/`pr` after the `-`.
  // `text-left` / `text-right` take NO suffix, so they are their own alternative — an
  // earlier version required one after every token and missed them entirely. Over-firing
  // is deliberate: a false hit here is a line for review, a false pass is RTL debt.
  const PHYSICAL =
    /(?:^|[\s"'`{(:-])(?:(?:ml|mr|pl|pr|rounded-l|rounded-r|border-l|border-r|left|right)-[a-z0-9[]|text-(?:left|right)\b)/
  const physical = []
  for (const file of readdirSync(FEATURE).filter((f) => /\.tsx?$/.test(f))) {
    codeLines(path.join(FEATURE, file)).forEach(({ line, n }) => {
      if (PHYSICAL.test(line)) physical.push(`${file}:${n} ${line.trim().slice(0, 70)}`)
    })
  }
  check(
    'no physical Tailwind utility anywhere in the feature — the sweep the audit found empty is still empty',
    physical.length === 0,
    physical.join(' | '),
  )

  // ── pass 2 · report bidi ────────────────────────────────────────────────────────
  const shipped = [...runsByText.values()].filter((r) => r.rtl !== null && r.ltr !== null)
  const broken = shipped.filter((r) => r.rtl < 0 && r.ltr > 0)
  const bare = [...bareByText.values()].filter((r) => r.rtl !== null && r.ltr !== null)
  const wouldBreak = bare.filter((r) => r.rtl < 0 && r.ltr > 0)

  console.log(`\n── bidi · ${shipped.length} visible runs measured in both directions`)
  for (const r of wouldBreak.sort((a, b) => a.rtl - b.rtl)) {
    const now = runsByText.get(r.text)
    console.log(
      `  ${now && now.rtl > 0 ? 'repaired' : 'BREAKS  '} ${JSON.stringify(r.text.slice(0, 44)).padEnd(48)} ` +
        `bare ltr=${r.ltr} rtl=${r.rtl} → shipped rtl=${now ? now.rtl : '?'}  ${r.where}`,
    )
  }
  check(
    `every digit-and-space run keeps its internal order under RTL — ${shipped.length} runs across ${STATES.length} states`,
    broken.length === 0,
    broken.map((r) => `${JSON.stringify(r.text.slice(0, 40))} @${r.where}`).join(' | '),
  )
  check(
    `and ${wouldBreak.length} of them WOULD have reordered unwrapped — the wrappers are owed, not decorative`,
    wouldBreak.length >= 8,
    wouldBreak
      .slice(0, 6)
      .map((r) => JSON.stringify(r.text.slice(0, 28)))
      .join(', '),
  )
  // The raw server promotion title and money-with-currency are the two the 106 audit
  // named specifically: the title because it CANNOT be re-worded (it is server data
  // passed through as data), money because it breaks only when a literal space separates
  // the figure from the unit. Named here so a future basket cannot quietly drop them.
  const titleRuns = wouldBreak.filter((r) => /^[\d]/.test(r.text) && /[A-Za-z]/.test(r.text))
  const moneyRuns = wouldBreak.filter((r) => /\d[\d.,]*\s+(SAR|SR)\b/.test(r.text))
  check(
    'including the raw server promotion title — the offender that cannot be re-worded, because it is server data',
    titleRuns.length > 0 && titleRuns.every((r) => (runsByText.get(r.text) || {}).rtl > 0),
    titleRuns.map((r) => JSON.stringify(r.text.slice(0, 32))).join(', '),
  )
  check(
    'and money-with-currency, which breaks only when a literal space separates the figure from the unit',
    moneyRuns.length > 0 && moneyRuns.every((r) => (runsByText.get(r.text) || {}).rtl > 0),
    moneyRuns.map((r) => JSON.stringify(r.text.slice(0, 24))).join(', '),
  )
  const escaped = wouldBreak.filter((r) => !r.candidate)
  check(
    'the dumb rule is a SUPERSET of measured breakage — no break escapes "a digit and a space ⇒ wrap"',
    escaped.length === 0,
    escaped.map((r) => JSON.stringify(r.text.slice(0, 40))).join(' | '),
  )
  const overFires = bare.filter((r) => r.candidate && r.rtl > 0)
  check(
    'and it OVER-fires rather than under-fires — over-application is free, so the predicate must stay dumb',
    overFires.length > 0,
    `${overFires.length} safe values also satisfy the rule: ` +
      overFires
        .slice(0, 5)
        .map((r) => JSON.stringify(r.text.slice(0, 24)))
        .join(', '),
  )
  // Composed values — a figure and its currency across two elements. The fix is one
  // isolate around the whole pair; a fragment fix passes the text-node pass and fails
  // here, which is why the element granularity is measured at all.
  const comp = [...composedByText.values()].filter((c) => c.rtl !== null && c.ltr !== null)
  const compBroken = comp.filter((c) => c.rtl < 0 && c.ltr > 0)
  const compBare = [...bareComposed.values()].filter((c) => c.rtl < 0 && c.ltr > 0)
  console.log(`\n── bidi, composed values · ${comp.length} multi-element values measured`)
  for (const c of compBare) {
    const now = composedByText.get(c.text)
    console.log(
      `  ${now && now.rtl > 0 ? 'repaired' : 'BREAKS  '} ${JSON.stringify(c.text).padEnd(30)} bare rtl=${c.rtl} → shipped rtl=${now ? now.rtl : '?'}  ${c.where}`,
    )
  }
  check(
    `every composed value keeps its order too — the fix is one isolate around the WHOLE pair (${comp.length} values, ${compBare.length} owed)`,
    compBroken.length === 0,
    compBroken.map((c) => `${JSON.stringify(c.text)} @${c.where}`).join(' | '),
  )

  const fragments = shipped.filter((r) => r.isolated && r.ltr <= 0)
  check(
    'no isolate reads backwards under LTR — a wrapper is byte-identical under LTR or it is wrapping a fragment',
    fragments.length === 0,
    fragments.map((r) => JSON.stringify(r.text.slice(0, 40))).join(' | '),
  )

  // ── pass 3 · icons ──────────────────────────────────────────────────────────────
  serving = 'both-kinds'
  failing = false
  await setWorkArea(1400)
  await runProcess()
  await page.locator('[data-promotions-rail]').waitFor()

  const ICONS = [
    { name: 'the result line’s disclosure twisty', sel: '[data-line-twisty="closed"]', mirrors: true },
    { name: 'the near-miss card’s twisty', sel: '[data-card-twisty="closed"]', mirrors: true },
    { name: 'the `Bonus buy details ▸` control', sel: '[data-bby-details] svg', mirrors: true },
    {
      name: 'the `buy → get` arrow',
      sel: '[data-buy-get-arrow] svg',
      mirrors: true,
      unprovable: { file: 'SimPromoBlocks.tsx', needle: '<ArrowRight' },
    },
    { name: '`▶ Process`', sel: 'button:has-text("Process") svg', mirrors: false },
  ]
  for (const icon of ICONS) {
    await setDir('ltr')
    const l = await flipOf(page, icon.sel).catch(() => null)
    await setDir('rtl')
    const r = await flipOf(page, icon.sel).catch(() => null)
    // The `buy → get` arrow only exists on the SPLIT path, and no capture in the corpus
    // carries one: the structural `Applications[]` / `DiscountKind` projection is ticket
    // 044, still open, so every captured promotion renders degraded (one undivided items
    // box, no arrow). Rather than assert nothing, fall back to the SPELLING and say so —
    // the same honesty ticket 117 used for the unprovable prerequisite meter.
    if (icon.unprovable && l === null) {
      const spelled = codeLines(path.join(FEATURE, icon.unprovable.file)).some(
        ({ line }) => line.includes(icon.unprovable.needle) && /rtl:-scale-x-100/.test(line),
      )
      check(
        `${icon.name} carries the explicit flip in source — UNPROVABLE on the corpus: no capture produces the buy→get split (ticket 044)`,
        spelled,
        `${icon.unprovable.file} · looked for \`${icon.unprovable.needle}\` with rtl:-scale-x-100`,
      )
      continue
    }
    check(
      icon.mirrors
        ? `${icon.name} points the way the text runs — flipped under RTL, and flipped ONCE`
        : `${icon.name} does NOT mirror — a transport glyph, not a direction indicator (the ruled exception)`,
      l !== null && r !== null && (icon.mirrors ? l.a > 0 && r.a < 0 : l.a === r.a),
      `ltr ${l ? l.a : 'absent'} · rtl ${r ? r.a : 'absent'} — rtl ${r && r.detail}`,
    )
  }
  await setDir('ltr')
  // The double-mirror trap's entry point: `›` and `‹` are Bidi_Mirrored and flip
  // THEMSELVES, so a character used as a directional icon plus an explicit flip lands
  // back on wrong. The rule is that a mirroring icon is always an SVG.
  const charIcons = []
  for (const file of readdirSync(FEATURE).filter((f) => /\.tsx$/.test(f))) {
    codeLines(path.join(FEATURE, file)).forEach(({ line, n }) => {
      if (/[›‹▸◂→←]/.test(line)) charIcons.push(`${file}:${n} ${line.trim().slice(0, 50)}`)
    })
  }
  check(
    'no directional glyph is a punctuation CHARACTER — a mirroring icon is always an SVG, or the explicit flip double-mirrors it',
    charIcons.length === 0,
    charIcons.join(', '),
  )

  // ── pass 4 · the hue budget ─────────────────────────────────────────────────────
  const allSpends = hues.flatMap((h) => h.spends.map((s) => ({ ...s, state: h.state, dir: h.dir })))
  // The whole-run 400 is not a result state: ticket 120 ruled that it REPLACES the work
  // area, and what it puts there is core's `ErrorBanner`, whose `danger` ground is the
  // banner's own severity idiom (088), not a readout hue this screen chose to spend. So
  // the two-hue census is over the states that render RESULTS, and the banner's family is
  // asserted separately and by name rather than quietly folded in.
  const resultSpends = allSpends.filter((s) => !s.where.includes('data-sim-failure'))
  const bannerSpends = allSpends.filter((s) => s.where.includes('data-sim-failure'))
  const families = [...new Set(resultSpends.map((s) => s.family))].sort()
  const unruled = resultSpends.filter((s) => s.home === 'UNRULED')
  const successOutside = resultSpends.filter((s) => s.family === 'success' && s.home !== 'fired-promotion')
  const attentionOutside = resultSpends.filter(
    (s) => s.family === 'attention' && s.home !== 'engine-flagged',
  )
  console.log(`\n── hue · ${allSpends.length} token spends across the matrix`)
  for (const key of [...new Set(allSpends.map((s) => `${s.family} · ${s.home} · ${s.where}`))])
    console.log(`  ${key}`)
  check(
    'the screen spends exactly two hues — success and attention, and no third family anywhere in a result state',
    families.length === 2 && families.every((f) => f === 'success' || f === 'attention'),
    families.join(', ') || 'none',
  )
  check(
    'and the whole-run 400’s danger ground is the ErrorBanner’s own severity, inside the banner and nowhere else',
    bannerSpends.length > 0 && bannerSpends.every((s) => s.family === 'danger'),
    [...new Set(bannerSpends.map((s) => s.family))].join(', '),
  )
  check(
    'success is spent ONLY on a fired promotion',
    successOutside.length === 0,
    successOutside.map((s) => `${s.where} (${s.props.join('/')})`).join(' | '),
  )
  check(
    'attention is spent ONLY where the engine flagged something — a `W` line, and the advisory panel carrying the engine’s messages on a priced one (the recorded widening)',
    attentionOutside.length === 0,
    attentionOutside.map((s) => `${s.where} (${s.props.join('/')})`).join(' | '),
  )
  check(
    'and no hue is spent outside those two homes — the elements trace’s flag cells carry none',
    unruled.length === 0,
    unruled.map((s) => `${s.family} @${s.where}`).join(' | '),
  )
  // The specific contradiction 121 came to fix, asserted where it lived rather than only
  // in the aggregate: the trace's boolean flag cells painted their true-flag check
  // `success`, which spent the budget's first hue on "this row is statistical".
  serving = 'elements'
  await runProcess()
  await page.locator('[data-result-line]').first().click()
  await page.waitForTimeout(250)
  const flagInk = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-elements-trace] svg')]
    return cells.map((el) => getComputedStyle(el).color)
  })
  const successInk = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const rgb = (h) => {
      const m = /^#?([0-9a-f]{6})$/.exec(h.trim().toLowerCase())
      if (!m) return null
      const n = parseInt(m[1], 16)
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
    }
    return ['--success', '--success-800'].map((v) => rgb(root.getPropertyValue(v))).filter(Boolean)
  })
  check(
    'the elements trace’s flag checks render with NO hue — "this row is statistical" is not a success',
    flagInk.length > 0 && flagInk.every((c) => !successInk.includes(c)),
    `${flagInk.length} flag glyph(s) at ${[...new Set(flagInk)].join(', ')} · success=${successInk.join(', ')}`,
  )

  // ── pass 5 · the uppercase keys, rendered ───────────────────────────────────────
  const marks = caps.flatMap((c) => c.marks)
  const transformed = marks.filter((m) => m.transform !== 'none')
  const notAuthored = marks.filter((m) => m.text !== m.text.toUpperCase())
  check(
    `the uppercase marks carry their case in the value, never a CSS transform — ${marks.length} rendered marks`,
    marks.length > 0 && transformed.length === 0 && notAuthored.length === 0,
    [...transformed.map((m) => `${m.text}:${m.transform}`), ...notAuthored.map((m) => `${m.text} not authored upper`)].join(
      ' | ',
    ),
  )

  check('no page errors while driving both directions', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
