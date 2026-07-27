// PROTOTYPE DRIVE — throwaway, ticket 138.
//
//   1. npx vite --port 5206
//   2. node tools/guidance-138-drive.mjs
//
// Flips all 3 variants × 9 states at 1440×900 (135's design width), asserting
// the two things a screenshot can't: nothing throws, and the guidance region
// never takes more of the centre column than 135's density budget allows —
// the basket is the only region allowed to grow, so a guidance surface that
// eats it has failed regardless of how it looks.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5206/prototype/near-miss-guidance'
const VARIANTS = ['1', '2', '3']
const STATES = ['three', 'bigSet', 'adding', 'didNotFire', 'firedOther', 'many', 'readyOnly', 'none', 'getSideLanded']

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const heights = {}

for (const v of VARIANTS) {
  console.log(`\nvariant ${v}`)
  heights[v] = {}
  for (const st of STATES) {
    await page.goto(`${BASE}?variant=${v}&state=${st}`)
    await page.waitForSelector('main')

    // the centre column's children: chip row, search, basket, guidance
    const m = await page.evaluate(() => {
      const main = document.querySelector('main')
      const kids = [...main.children]
      const guidance = kids[kids.length - 1]
      const basket = kids[kids.length - 2]
      return {
        main: main.getBoundingClientRect().height,
        guidance: guidance.getBoundingClientRect().height,
        basket: basket.getBoundingClientRect().height,
        overflowX: main.scrollWidth > main.clientWidth + 1,
      }
    })
    heights[v][st] = Math.round(m.guidance)

    const share = m.guidance / m.main
    ok(share <= 0.45, `${st} — guidance takes ${(share * 100).toFixed(0)}% of the centre (≤45%)`)
    ok(!m.overflowX, `${st} — the centre never scrolls sideways (135 amendment 2)`)
    ok(m.basket > 0, `${st} — the basket still has height`)
  }
}

// 135 amendment 2 again: no horizontal scroller anywhere in the region.
await page.goto(`${BASE}?variant=1&state=many`)
const sideways = await page.evaluate(() =>
  [...document.querySelectorAll('main *')].some((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible'),
)
ok(!sideways, 'seven offers — nothing in the region scrolls sideways')

// The promise rule: no engine-money currency word may appear inside guidance,
// and no estimate may carry one (135 amendment 1 + 130's no-wouldSave ruling).
for (const v of VARIANTS) {
  await page.goto(`${BASE}?variant=${v}&state=bigSet`)
  await page.waitForSelector('main')
  const txt = await page.evaluate(() => {
    const main = document.querySelector('main')
    return main.children[main.children.length - 1].textContent
  })
  // 135 amendment 1: `SAR` is reserved for engine money, and the guidance region
  // holds none — every figure in it is an ex-VAT estimate or a definition.
  // ⚠ NOT a bare `SAR` scan: server-supplied offer descriptions carry currency
  // words of their own ("SAR 29.95 for any 2"), which the console may not edit.
  // What the rule actually forbids is a figure FORMATTED AS MONEY — the
  // `12.00 SAR` shape the `Money` atom prints.
  ok(!/\d+\.\d\d\s*SAR/.test(txt), `variant ${v} — no figure formatted as engine money in the guidance region`)
  ok(/≈/.test(txt), `variant ${v} — the estimate is marked ≈`)
  ok(/997|994/.test(txt), `variant ${v} — the honest cardinality is on screen`)
}

console.log('\nguidance region height (px) by state:')
console.table(heights)
console.log(errors.length ? `\nPAGE ERRORS:\n${errors.join('\n')}` : '\nno page errors')
console.log(`\n${pass}/${pass + fail} assertions`)
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
