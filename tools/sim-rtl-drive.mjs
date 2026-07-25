// Simulation RTL / bidi audit (ticket 106, map 097) — the verification pass the
// ticket asks for, run against the APPROVED DEVICE rather than against the app,
// because the reworked screen is a spec-in-progress and does not exist in code
// yet. The device is the three prototypes 101 / 102 / 104 approved by their own
// tickets, so this measures the artifact the build will be authored from.
//
// Method is inherited from the 080 audit (`document-rtl-drive.mjs`): reasoning
// about bidi on paper is what 080 overturned twice, so every claim here is read
// off client rects or off rendered pixels.
//
//   node tools/sim-rtl-drive.mjs            # all three prototypes
//   node tools/sim-rtl-drive.mjs 104        # one of them
//
// No server needed — the prototypes are loaded over file://.
//
// Five passes:
//   1. BIDI, text nodes — every visible run on the device carrying a digit and a
//      space is measured in both directions. Reports what actually reorders, and
//      cross-checks 080's transferred predicate (breaks iff it contains a space
//      AND begins or ends with a digit) against the measurement instead of
//      assuming it holds on this screen's values.
//   2. BIDI, composed values — the same measurement one level up, for a value
//      built from several elements (`172.38` + `SAR`, a `disc` key + amount).
//      A whole-value wrapper is the fix; 080 proved fragment-wrapping CREATES a
//      fault, so the element granularity has to be measured too.
//   3. MIRRORING geometry — for each region, the visual order of its parts in
//      LTR vs RTL, plus the physical side each logical edge resolves to.
//   4. ICONS — every non-ASCII glyph on the device that carries a direction, and
//      whether it self-mirrors, measured by screenshotting the glyph under
//      `direction: ltr` and `direction: rtl` and diffing the pixels. This is
//      080's `‹` trap (U+2039 is Bidi_Mirrored, flips itself, and double-mirrors
//      the naive `scaleX(-1)` fix) made a measurement rather than a lookup.
//   5. OVERFLOW — the device must not gain a horizontal scrollbar under RTL.
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const ASSETS = '.issues/assets'
const ONLY = process.argv[2]
const FILES = readdirSync(ASSETS)
  .filter((f) => /^(101|102|104)-.*\.PROTOTYPE\.html$/.test(f))
  .filter((f) => !ONLY || f.startsWith(ONLY))

/** The dumb rule, node-side: every run the scan collected already satisfies it. */
const window_hasDigitSpace = (s) => /\d/.test(s) && /\s/.test(s)

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

/**
 * Visual order of a run: x of its first printing character minus x of its last.
 * `> 0` means it reads left-to-right on screen whatever the paragraph is doing.
 * Works on a text node or on an element (walks its text nodes in tree order).
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
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const a = at(first, first.data.search(/\S/))
  const b = at(last, last.data.replace(/\s+$/, '').length - 1)
  return b - a
}

const PRELUDE = `
window.READS_LTR = ${READS_LTR.toString()}

// A run is only a bidi HAZARD CANDIDATE if it could reorder at all: it needs a
// digit and a space. Everything else is measured too (as a control) but never
// reported as a candidate.
window.HAS_DIGIT_AND_SPACE = (s) => /\\d/.test(s) && /\\s/.test(s)

// 080's transferred predicate, stated as code so the measurement can agree or
// disagree with it: a value breaks iff it contains a space AND begins or ends
// with a digit.
window.PREDICTS_BREAK = (s) => {
  const t = s.trim()
  return /\\s/.test(t) && (/^\\d/.test(t) || /\\d$/.test(t))
}

window.VISIBLE = (el) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

// Several prototypes render their OWN commentary inside the device stage (a
// tally of "9 columns", a caption). That copy is not screen content and must not
// enter the bidi list — the list becomes call sites in the build.
window.NARRATION = '.tally, .caption, .foot, .controls, .eyebrow, .lede, .sl, .key, .sk, .sv'
window.IS_DEVICE_CONTENT = (el) => !el.closest(window.NARRATION)

/**
 * The green half, measured: isolate a candidate wrapper the way core/ui/Ltr
 * does (a bdi dir=ltr === direction:ltr + unicode-bidi:isolate) and see
 * whether the WHOLE value then reads left-to-right. Walks outward from the
 * broken run and returns the SHALLOWEST wrapper that repairs it, which is the
 * call site the build needs — 080 proved wrapping a fragment of a run creates a
 * fault, so the shallowest repair that holds for the whole value is the answer.
 */
window.SMALLEST_FIX = (node) => {
  const tried = []
  let el = node.nodeType === 3 ? node.parentElement : node
  for (let i = 0; i < 4 && el && !el.classList.contains('device'); i++, el = el.parentElement) {
    const prev = el.getAttribute('style') || ''
    el.style.direction = 'ltr'
    el.style.unicodeBidi = 'isolate'
    const own = window.READS_LTR(el)
    // The value is repaired only if the wrapper's own full text reads LTR AND
    // the run under test does too — a fragment fix can do the second alone.
    const run = window.READS_LTR(node)
    el.setAttribute('style', prev)
    tried.push({ where: window.WHERE(el), own: Math.round(own), run: Math.round(run) })
    if (own > 0 && run > 0) return { fixed: true, at: window.WHERE(el), depth: i, tried }
  }
  return { fixed: false, tried }
}

// Every visible text node inside the device stage(s), with a stable-ish label
// built from its ancestor classes so a finding can be found again in the source.
window.RUNS = () => {
  const out = []
  for (const device of document.querySelectorAll('.device')) {
    const w = document.createTreeWalker(device, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const text = n.data.replace(/\\s+/g, ' ').trim()
      if (!text || !window.HAS_DIGIT_AND_SPACE(text)) continue
      const el = n.parentElement
      if (!window.VISIBLE(el) || !window.IS_DEVICE_CONTENT(el)) continue
      const order = window.READS_LTR(n)
      out.push({
        text,
        where: window.WHERE(el),
        candidate: true,
        predicted: window.PREDICTS_BREAK(text),
        order,
        isolated: !!el.closest('bdi'),
        fix: order < 0 ? window.SMALLEST_FIX(n) : null,
      })
    }
  }
  return out
}

// Pass 2: a value COMPOSED of several inline children — money + currency, a key
// + its amount. Measured at element level, where a fragment-wrapping mistake
// would show up.
window.COMPOSED = () => {
  const out = []
  for (const device of document.querySelectorAll('.device')) {
    for (const el of device.querySelectorAll('*')) {
      const kids = [...el.children]
      // A single VALUE split across elements — money + its currency, a key + its
      // amount. Anything bigger is a CONTAINER, whose reordering under RTL is
      // correct mirroring rather than a bidi fault, so it is not measured here.
      if (kids.length < 1 || kids.length > 2) continue
      if (kids.some((k) => k.children.length)) continue
      const text = el.textContent.replace(/\\s+/g, ' ').trim()
      if (!text || text.length > 24 || !window.HAS_DIGIT_AND_SPACE(text)) continue
      if (!window.VISIBLE(el) || !window.IS_DEVICE_CONTENT(el)) continue
      const order = window.READS_LTR(el)
      out.push({
        text,
        where: window.WHERE(el),
        predicted: window.PREDICTS_BREAK(text),
        order,
        fix: order < 0 ? window.SMALLEST_FIX(el) : null,
      })
    }
  }
  return out
}

window.WHERE = (el) => {
  const parts = []
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const c = (n.className || '').toString().split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
    parts.unshift(c ? n.tagName.toLowerCase() + '.' + c : n.tagName.toLowerCase())
    if (n.classList && n.classList.contains('device')) break
  }
  return parts.join(' > ').slice(-120)
}
`

/** Iterate every state a prototype's radio switches expose (theme held light). */
async function states(page) {
  const groups = await page.evaluate(() => {
    const names = new Set()
    for (const r of document.querySelectorAll('.controls input[type=radio]')) names.add(r.name)
    return [...names].map((name) => ({
      name,
      ids: [...document.querySelectorAll(`.controls input[name="${name}"]`)].map((r) => r.id),
    }))
  })
  // Theme is irrelevant to order and geometry — hold it at the first option so
  // the cross-product stays small. Every other switch is exercised in full.
  const axes = groups.filter((g) => !g.ids.some((id) => id.startsWith('t-')))
  let combos = [[]]
  for (const axis of axes) combos = combos.flatMap((c) => axis.ids.map((id) => [...c, id]))
  return combos
}

const apply = (page, ids) =>
  page.evaluate((list) => {
    for (const id of list) document.getElementById(id).click()
  }, ids)

const setDir = async (page, dir) => {
  await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
  await page.waitForTimeout(60)
}

/** Pass 4 — does this glyph mirror itself? Measured off rendered pixels. */
async function selfMirrors(page, char) {
  const probe = await page.evaluateHandle((c) => {
    let host = document.getElementById('__glyphprobe')
    if (!host) {
      host = document.createElement('div')
      host.id = '__glyphprobe'
      host.style.cssText =
        'position:fixed;top:0;left:0;z-index:9999;background:#fff;display:flex;gap:0'
      host.innerHTML =
        '<span id="__g_ltr" style="direction:ltr;font-size:40px;width:52px;text-align:center;color:#000"></span>' +
        '<span id="__g_rtl" style="direction:rtl;font-size:40px;width:52px;text-align:center;color:#000"></span>'
      document.body.appendChild(host)
    }
    document.getElementById('__g_ltr').textContent = c
    document.getElementById('__g_rtl').textContent = c
    return host
  }, char)
  const a = await page.locator('#__g_ltr').screenshot()
  const b = await page.locator('#__g_rtl').screenshot()
  await probe.dispose()
  return !a.equals(b)
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  const hazards = new Map() // text -> record, unioned across files and states
  const composed = new Map()
  const glyphs = new Map() // char -> { chars, where[] }

  for (const file of FILES) {
    const url = 'file:///' + path.resolve(ASSETS, file).replace(/\\/g, '/')
    await page.goto(url)
    await page.addScriptTag({ content: PRELUDE })
    await page.waitForTimeout(150)
    const combos = await states(page)
    console.log(`\n── ${file} · ${combos.length} state combinations`)

    for (const combo of combos) {
      await apply(page, combo)
      for (const dir of ['ltr', 'rtl']) {
        await setDir(page, dir)
        await page.evaluate(PRELUDE) // re-hydrate helpers after any state re-render
        const runs = await page.evaluate(() => window.RUNS())
        for (const r of runs) {
          const rec = hazards.get(r.text) || { ...r, file, ltr: null, rtl: null, states: 0 }
          rec[dir] = r.order
          rec.states++
          rec.where = rec.where || r.where
          rec.fix = rec.fix || r.fix
          hazards.set(r.text, rec)
        }
        const comp = await page.evaluate(() => window.COMPOSED())
        for (const c of comp) {
          const rec = composed.get(c.text) || { ...c, file, ltr: null, rtl: null }
          rec[dir] = c.order
          composed.set(c.text, rec)
        }
      }
    }

    // Glyph inventory for this file's device (state-independent: scan the whole
    // device subtree including the state variants CSS is hiding).
    const found = await page.evaluate(() => {
      const out = []
      for (const device of document.querySelectorAll('.device, template')) {
        const html = device.innerHTML || (device.content && device.content.textContent) || ''
        const text = (device.textContent || '') + ' ' + html
        for (const ch of new Set(text.replace(/[\u0000-\u007F]/g, '')))
          out.push({ ch, where: 'device' })
      }
      return out
    })
    for (const { ch } of found) {
      const rec = glyphs.get(ch) || { ch, files: new Set() }
      rec.files.add(file.slice(0, 3))
      glyphs.set(ch, rec)
    }

    // ── Pass 3: mirroring geometry, per file ────────────────────────────────
    await apply(page, combos[0])
    const geo = {}
    for (const dir of ['ltr', 'rtl']) {
      await setDir(page, dir)
      geo[dir] = await page.evaluate(() => {
        const x = (sel, root = document) => {
          const el = root.querySelector(sel)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return r.width > 0 ? Math.round(r.x) : null
        }
        const dev = document.querySelector('.device')
        const strip = dev && dev.querySelector('.strip.flex, .strip')
        const line = dev && dev.querySelector('.line, .itemrow:not(.ihead)')
        const side = (el, prop) => {
          if (!el) return null
          const s = getComputedStyle(el)
          const w = (p) => parseFloat(s[p]) || 0
          return prop === 'border'
            ? { left: w('borderLeftWidth'), right: w('borderRightWidth') }
            : { left: s.paddingLeft, right: s.paddingRight }
        }
        return {
          runset: strip ? x('.runset', strip) : null,
          money: strip ? x('.money', strip) : null,
          runbtns: strip ? x('.runbtns', strip) : null,
          resultsPane: x('.split > *:first-child'),
          railPane: x('.split > *:last-child'),
          lineBorder: side(line, 'border'),
          moneyAlign: (() => {
            const el = document.querySelector('.mny, .lnet, .ltot')
            return el ? getComputedStyle(el).textAlign : null
          })(),
          deviceOverflow: (() => {
            const st = document.querySelector('.stage')
            return st ? st.scrollWidth - st.clientWidth : null
          })(),
        }
      })
    }

    const L = geo.ltr
    const R = geo.rtl
    const flips = (a, b) =>
      a[0] !== null && a[1] !== null && b[0] !== null && b[1] !== null
        ? a[0] < a[1] === b[0] > b[1]
        : null

    if (L.runset !== null && L.runbtns !== null) {
      const f = flips([L.runset, L.runbtns], [R.runset, R.runbtns])
      check(
        `${file}: the run strip mirrors — chips lead from the reading edge, controls trail`,
        f === true,
        `ltr chips@${L.runset} btns@${L.runbtns} · rtl chips@${R.runset} btns@${R.runbtns}`,
      )
    }
    if (L.money !== null && L.runset !== null && L.runbtns !== null) {
      const f = flips([L.runset, L.money], [R.runset, R.money])
      check(
        `${file}: the money readout stays on the strip’s far edge`,
        f === true,
        `ltr money@${L.money} · rtl money@${R.money}`,
      )
    }
    if (L.resultsPane !== null && L.railPane !== null) {
      const f = flips([L.resultsPane, L.railPane], [R.resultsPane, R.railPane])
      check(
        `${file}: the 66/34 split mirrors — results lead, promotions rail trails`,
        f === true,
        `ltr results@${L.resultsPane} rail@${L.railPane} · rtl results@${R.resultsPane} rail@${R.railPane}`,
      )
    }
    if (L.lineBorder && (L.lineBorder.left || L.lineBorder.right)) {
      check(
        `${file}: the line’s accent edge swaps physical sides (logical, not physical)`,
        L.lineBorder.left > 0 && R.lineBorder.right > 0,
        `ltr ${JSON.stringify(L.lineBorder)} · rtl ${JSON.stringify(R.lineBorder)}`,
      )
    }
    if (L.moneyAlign) {
      check(
        `${file}: the money column’s text-align follows direction (end, not right)`,
        L.moneyAlign !== R.moneyAlign || /end|start/.test(L.moneyAlign),
        `ltr=${L.moneyAlign} rtl=${R.moneyAlign}`,
      )
    }
    check(
      `${file}: no horizontal overflow appears under RTL`,
      R.deviceOverflow !== null ? R.deviceOverflow <= L.deviceOverflow + 1 : true,
      `ltr=${L.deviceOverflow} rtl=${R.deviceOverflow}`,
    )
  }

  // ── Pass 1 + 2 report ─────────────────────────────────────────────────────
  const rows = [...hazards.values()]
  const broke = rows.filter((r) => r.rtl !== null && r.rtl < 0)
  const safe = rows.filter((r) => r.rtl !== null && r.rtl > 0)
  console.log(`\n── bidi, text runs · ${rows.length} runs carry a digit and a space`)
  for (const r of rows.sort((a, b) => a.rtl - b.rtl)) {
    console.log(
      `  ${r.rtl < 0 ? 'BREAKS ' : 'ok     '} ${JSON.stringify(r.text).padEnd(34)} ` +
        `ltr=${Math.round(r.ltr)} rtl=${Math.round(r.rtl)} ` +
        `predicted=${r.predicted ? 'break' : 'safe '} ${r.file.slice(0, 3)} ${r.where}`,
    )
    if (r.fix)
      console.log(
        `          fix: ${r.fix.fixed ? 'isolate ' + r.fix.at + ` (depth ${r.fix.depth})` : 'NO WRAPPER REPAIRED IT — ' + JSON.stringify(r.fix.tried)}`,
      )
  }
  // 080's predicate is deliberately DUMB — "a value mixing digits and spaces gets
  // wrapped" — and over-application is free, so what has to hold is that it is a
  // SUPERSET of measured breakage, never that it is exact. It is measurably not
  // exact on this screen, in both directions:
  //
  //   under-fires: values whose numbers are preceded by Latin text in the same
  //     run do NOT reorder (bidi W7 — an EN after a strong L becomes L), so
  //     `Gross 182.52 · net 118.64` and `line 10` are safe while `268 ms` is not;
  //   over-fires: a leading or trailing NEUTRAL resolves from the surrounding
  //     line, not from the run (N1/N2), so `— 70% 2nd PCS` is safe next to Latin
  //     text and would break standing alone.
  //
  // No run-local predicate can be exact for that reason, which is precisely why
  // the shipped rule stays dumb rather than getting "corrected" into something
  // that under-fires. Asserted here so a future session cannot sharpen it.
  const escaped = rows.filter((r) => r.rtl !== null && r.rtl < 0 && !r.candidate)
  const overFires = rows.filter((r) => r.rtl > 0 && r.predicted)
  check(
    'no measured break escapes the dumb rule (digit + space ⇒ wrap) — it is a superset',
    escaped.length === 0,
    escaped.map((r) => JSON.stringify(r.text)).join(' | '),
  )
  check(
    'the dumb rule over-fires rather than under-fires — over-application is free',
    rows.filter((r) => r.rtl < 0 && !r.predicted).every((r) => window_hasDigitSpace(r.text)),
    `${overFires.length} safe values would also be wrapped: ` +
      overFires.map((r) => JSON.stringify(r.text)).join(', '),
  )
  check('every LTR run still reads left-to-right (control)', rows.every((r) => r.ltr > 0))
  console.log(`  ${broke.length} break under RTL · ${safe.length} measured safe`)

  const crows = [...composed.values()].filter((c) => c.rtl !== null)
  const cbroke = crows.filter((c) => c.rtl < 0)
  console.log(`\n── bidi, composed values · ${crows.length} multi-element values`)
  for (const c of crows.sort((a, b) => a.rtl - b.rtl)) {
    console.log(
      `  ${c.rtl < 0 ? 'BREAKS ' : 'ok     '} ${JSON.stringify(c.text).padEnd(34)} ` +
        `ltr=${Math.round(c.ltr)} rtl=${Math.round(c.rtl)} ` +
        `predicted=${c.predicted ? 'break' : 'safe '} ${c.file.slice(0, 3)} ${c.where}`,
    )
    if (c.fix)
      console.log(
        `          fix: ${c.fix.fixed ? 'isolate ' + c.fix.at + ` (depth ${c.fix.depth})` : 'NO WRAPPER REPAIRED IT'}`,
      )
  }
  console.log(`  ${cbroke.length} break under RTL`)

  // ── Pass 4 report ─────────────────────────────────────────────────────────
  console.log(`\n── glyphs · self-mirroring measured off rendered pixels`)
  for (const rec of glyphs.values()) {
    if (/[\p{L}\p{M}]/u.test(rec.ch)) continue
    const mirrors = await selfMirrors(page, rec.ch)
    console.log(
      `  ${rec.ch}  U+${rec.ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  ` +
        `self-mirrors=${mirrors ? 'YES' : 'no '}  in ${[...rec.files].join(',')}`,
    )
  }

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  process.exit(failed ? 1 : 0)
}

run()
