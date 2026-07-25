// Capture live POST Pricing/Simulate payloads for wayfinder ticket 098 (map 097).
//
// Manual-run tool, not a CI gate. Talks DIRECTLY to SIS.Api (the /api prefix is the
// Vite dev proxy only — SIS.Api itself serves at the root), so no dev server needed.
//
//   1. bring SIS.Api up on :5111  (dotnet run --project ... --launch-profile http)
//   2. log into the app once in a browser, copy the `sis_session` cookie value
//   3. fill the TODO material numbers in tools/sim-capture-baskets.json
//   4. SIS_COOKIE=<value> node tools/sim-payload-capture.mjs
//
// Writes one pretty-printed JSON per basket to .issues/assets/098-simulate-payloads/,
// each carrying a `_capture` block (request, endpoint, status, redaction note) the way
// 078's document payloads do, then prints the census 098 asks for.
//
// Flags: --only <slug,slug>   capture a subset
//        --api <base>         override http://localhost:5111
//        --allow-todo         run even with unfilled TODO materials (expect E lines)

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.issues', 'assets', '098-simulate-payloads')
const CONFIG = path.join(ROOT, 'tools', 'sim-capture-baskets.json')

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : (argv[i + 1] ?? '')
}
const API = flag('--api') ?? 'http://localhost:5111'
const ONLY = (flag('--only') ?? '').split(',').filter(Boolean)
const ALLOW_TODO = argv.includes('--allow-todo')

// Two ways in, both keeping the token out of the repo:
//   • SIS_COOKIE=<value>            — a cookie value copied from a browser session
//   • SIS_USER=<id> SIS_PASS=<pw>   — mint one via POST Auth/Login (dev instances
//                                     run the stub credential validator)
let cookie = process.env.SIS_COOKIE ?? flag('--cookie')
if (!cookie && process.env.SIS_USER) {
  const res = await fetch(`${API.replace(/\/$/, '')}/Auth/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' },
    body: JSON.stringify({ userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' }),
  })
  const body = await res.json().catch(() => null)
  // The raw token never rides the response body — it lands only in Set-Cookie.
  const setCookie = res.headers.getSetCookie?.() ?? []
  const match = setCookie.map((c) => /(?:^|;\s*)sis_session=([^;]+)/.exec(c)).find(Boolean)
  cookie = match?.[1]
  if (!cookie) {
    console.error(
      `Login did not set a session cookie (HTTP ${res.status}).\n` +
        JSON.stringify(body?.data ?? body, null, 2),
    )
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
}
if (!cookie) {
  console.error(
    'Missing session. Either copy the `sis_session` cookie value from a browser:\n' +
      '  SIS_COOKIE=<value> node tools/sim-payload-capture.mjs\n' +
      'or mint one:\n' +
      '  SIS_USER=<id> SIS_PASS=<pw> node tools/sim-payload-capture.mjs',
  )
  process.exit(2)
}

// The owner's evidenced request (01-near-miss) sends `pricingDate` as a midnight
// DATETIME (`2026-07-25T00:00:00`), not the date-only string SimHeaderForm builds.
// Mirror the evidenced form so a capture cannot fail on a format the server may
// or may not accept — whether date-only also works is a separate question.
const todayIso = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00:00`
}

const config = JSON.parse(readFileSync(CONFIG, 'utf-8'))
const baskets = config.baskets.filter((b) => !ONLY.length || ONLY.includes(b.slug))

const hasTodo = (b) =>
  JSON.stringify(b).includes('TODO')
const blocked = baskets.filter(hasTodo).map((b) => b.slug)
if (blocked.length && !ALLOW_TODO) {
  console.error(
    `These baskets still hold TODO placeholders: ${blocked.join(', ')}\n` +
      'Fill the material / condition-type values in tools/sim-capture-baskets.json, or pass --allow-todo.',
  )
  process.exit(2)
}

function buildRequest(basket) {
  const header = { ...config.defaultHeader, ...(basket.header ?? {}) }
  if (!header.pricingDate) header.pricingDate = todayIso()
  const req = {
    header,
    items: basket.items,
    includeConditions: basket.includeConditions ?? true,
    includePricingElements: basket.includePricingElements ?? false,
  }
  if (basket.manualConditions) req.manualConditions = basket.manualConditions
  return req
}

// --- the census 098 asks for, computed over whatever came back ----------------
function census(result) {
  const lines = result?.items ?? []
  const conditionCounts = lines.map((l) => (l.conditions ?? []).length)
  const statistical = lines.map(
    (l) => (l.conditions ?? []).filter((c) => c.isStatistics).length,
  )
  const statuses = {}
  for (const l of lines) statuses[l.pricingStatus ?? ''] = (statuses[l.pricingStatus ?? ''] ?? 0) + 1
  return {
    lines: lines.length,
    conditionsPerLine: conditionCounts,
    statisticalPerLine: statistical,
    pricingStatusTally: statuses,
    // pricingElements is PER LINE (populated only when the request asked for it)
    pricingElementsPerLine: lines.map((l) => (l.pricingElements ?? []).length),
    appliedBonusBuys: (result?.appliedBonusBuys ?? []).length,
    potentialBonusBuys: (result?.potentialBonusBuys ?? []).length,
    topLevelKeys: result && typeof result === 'object' ? Object.keys(result) : [],
    emptyTopLevelKeys:
      result && typeof result === 'object'
        ? Object.entries(result)
            .filter(([, v]) => v === null || v === '' || (Array.isArray(v) && v.length === 0))
            .map(([k]) => k)
        : [],
  }
}

mkdirSync(OUT_DIR, { recursive: true })

const summary = []
for (const basket of baskets) {
  const request = buildRequest(basket)
  const url = `${API.replace(/\/$/, '')}/Pricing/Simulate`
  process.stdout.write(`→ ${basket.slug} … `)

  let res, body
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Web-Client': '1',
        Cookie: `sis_session=${cookie}`,
      },
      body: JSON.stringify(request),
    })
    body = await res.json()
  } catch (err) {
    console.log(`FAILED (${err.message})`)
    summary.push({ slug: basket.slug, error: err.message })
    continue
  }

  const file = path.join(OUT_DIR, `${basket.slug}.json`)
  const envelope = {
    _capture: {
      ticket: '098',
      map: '097',
      purpose: basket.purpose,
      endpoint: 'POST Pricing/Simulate',
      api: API,
      httpStatus: res.status,
      capturedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      request,
      redaction:
        'No customer-identifying fields are present in a Simulate request or response ' +
        '(materials, plant, org, quantities and money only). Nothing redacted.',
    },
    response: body,
  }
  writeFileSync(file, JSON.stringify(envelope, null, 2) + '\n', 'utf-8')

  const c = census(body?.data ?? body)
  console.log(
    `HTTP ${res.status} · success=${body?.success} · ${c.lines} line(s) · ` +
      `conditions [${c.conditionsPerLine.join(', ')}] · applied ${c.appliedBonusBuys} / ` +
      `potential ${c.potentialBonusBuys} · elements [${c.pricingElementsPerLine.join(', ')}]`,
  )
  summary.push({ slug: basket.slug, httpStatus: res.status, success: body?.success, ...c })
}

console.log('\n--- census ---')
console.log(JSON.stringify(summary, null, 2))
console.log(`\nFiles: ${path.relative(ROOT, OUT_DIR)}`)
