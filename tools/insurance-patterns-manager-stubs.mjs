// Insurance pattern manager — the drive's stubs for oms 924 (BackOffice spec 4050: 4055's settings and reveal log, 4056's
// block). BackOffice 4055/4056 are NOT built: these envelopes are the contract the spec 4050 implementers agreed (see
// src/core/models/insurance-pattern-manager.ts), to reconcile when the doors land. Chained AFTER 922's shared doors:
//
//   import { patternsState, patternsDoors, envelope } from './insurance-patterns-stubs.mjs'
//   import { managerState, managerDoors } from './insurance-patterns-manager-stubs.mjs'
//   const patterns = patternsState(); const mine = managerState()
//   const doors = [patternsDoors(patterns), managerDoors(patterns, mine)]
//   await page.route('**/api/**', (r) => r.fulfill(doors.reduce((a, d) => a ?? d(r.request()), null) ?? envelope({})))
//
// Every fixture is synthetic. A careless server is played on purpose: each reveal-log row and the block's answer carry
// the PLANTED identity below, and the page must never show it (the reader keeps only the agreed fields).

import { businessRefusal, CLEARED_CASE, envelope, generatedCase, TRAVEL_CASE } from './insurance-patterns-stubs.mjs'

/** A synthetic identity (not a real person: the reserved-looking test range) that must never reach the screen. */
export const PLANTED = Object.freeze({ patientKey: 'NI:1999999901', memberId: 'M-PLANTED-0042' })

/** BackOffice 4051's defaults, in the order the server lists them. */
export const DEFAULT_SETTINGS = Object.freeze([
  { name: 'WindowDays', value: 7 },
  { name: 'MinStores', value: 3 },
  { name: 'MaxKmPerHour', value: 120 },
  { name: 'MinTravelKm', value: 50 },
  { name: 'OverlapShare', value: 0.25 },
  { name: 'CaseQuietDays', value: 30 },
  { name: 'LookbackDays', value: 90 },
])

/** The server's own ranges (BackOffice 4055), sent beside each value. The page must not need them. */
const RANGES = Object.freeze({
  WindowDays: [1, 30],
  MinStores: [2, 10],
  MaxKmPerHour: [30, 500],
  MinTravelKm: [1, 500],
  OverlapShare: [0.05, 0.9],
  CaseQuietDays: [7, 90],
  LookbackDays: [30, 365],
})

const INVESTIGATORS = ['investigator1', 'investigator2', 'investigator3']
const REASONS = [
  'Payer BUPA asked for the patient on this case.',
  'Matching the CCTV request from Buraydah Central.',
  'block',
  'المطالبة من الجهة الدافعة تتطلب التحقق من هوية المريض.',
  'Confirming the same patient as on PC-000099 before the call to the payer.',
]

/**
 * The log's rows: 31 of them over November, so the log has two pages. Row 0 is the newest. Every row carries the
 * PLANTED identity, as a careless server might send it.
 */
export function revealRows() {
  const cases = [TRAVEL_CASE, CLEARED_CASE, generatedCase(4), generatedCase(11)]
  return Array.from({ length: 31 }, (_, i) => {
    const c = cases[i % cases.length]
    const day = String(19 - Math.floor(i / 2)).padStart(2, '0')
    const at = `2026-11-${day}T${String(17 - (i % 2) * 6).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`
    return { caseId: c.caseId, caseNumber: c.caseNumber, by: INVESTIGATORS[i % INVESTIGATORS.length], at, reason: REASONS[i % REASONS.length], ...PLANTED }
  })
}

/**
 * The manager doors' state for one scenario. `settingsRefusal` / `blockRefusal`: `{ code, message }` to refuse the next
 * save or block. `calls` records what the app sent.
 */
export function managerState(over = {}) {
  return {
    settings: DEFAULT_SETTINGS.map((s) => ({ ...s })),
    changes: [
      { name: 'WindowDays', oldValue: 5, newValue: 7, by: 'manager1', at: '2026-11-02T09:30:00' },
      { name: 'MinStores', oldValue: 4, newValue: 3, by: 'manager2', at: '2026-11-10T14:05:00' },
    ],
    reveals: revealRows(),
    settingsRefusal: null,
    blockRefusal: null,
    user: 'msartawi',
    clock: 0,
    calls: { settingsGet: 0, settingsPut: [], reveals: [], blocks: [] },
    ...over,
  }
}

const dayOf = (iso) => iso.slice(0, 10)
const newestFirst = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)
/** "Now" on the stub's clock: after every fixture row (the newest is 2026-11-19 17:00), one minute a write. */
const stamp = (mine) => `2026-11-19T18:${String(10 + mine.clock++).padStart(2, '0')}:00`

/** The settings answer: each value with the server's own min and max (which the page never reads), and the log. */
const settingsAnswer = (mine) => ({
  settings: mine.settings.map((s) => ({ ...s, min: RANGES[s.name]?.[0] ?? null, max: RANGES[s.name]?.[1] ?? null })),
  changes: mine.changes,
})

/**
 * The manager doors (BackOffice 4055/4056, guessed): `GET`/`PUT Insurance/Patterns/Settings`, `GET …/Reveals`,
 * `POST …/Cases/{caseId}/Block`. Returns `(request) => fulfil argument | null`: null for a path it does not own.
 * `patterns` is 922's `patternsState` (the block reads the case's status from it).
 */
export function managerDoors(patterns, mine) {
  return (request) => {
    const url = new URL(request.url())
    const path = decodeURIComponent(url.pathname.split('/api/')[1] ?? '')
    const method = request.method()
    const csrf = request.headers()['x-web-client'] ?? null

    if (path === 'Insurance/Patterns/Settings' && method === 'GET') {
      mine.calls.settingsGet++
      return envelope(settingsAnswer(mine))
    }
    if (path === 'Insurance/Patterns/Settings' && method === 'PUT') {
      const body = JSON.parse(request.postData() || '{}')
      mine.calls.settingsPut.push({ body, csrf })
      if (mine.settingsRefusal) return businessRefusal(mine.settingsRefusal.code, mine.settingsRefusal.message)
      // The server's own check (4055): every value within its range, or the whole save is refused.
      for (const { name, value } of body.settings ?? []) {
        const range = RANGES[name]
        if (!range || typeof value !== 'number' || value < range[0] || value > range[1])
          return businessRefusal('SETTING_OUT_OF_RANGE', `${name} must be between ${range?.[0]} and ${range?.[1]}.`)
      }
      for (const { name, value } of body.settings ?? []) {
        const s = mine.settings.find((x) => x.name === name)
        if (s.value === value) continue
        mine.changes.push({ name, oldValue: s.value, newValue: value, by: mine.user, at: stamp(mine) })
        s.value = value
      }
      return envelope(settingsAnswer(mine))
    }
    if (path === 'Insurance/Patterns/Reveals' && method === 'GET') {
      const q = Object.fromEntries(url.searchParams)
      mine.calls.reveals.push({ query: q, csrf })
      const rows = mine.reveals
        .filter((r) => (!q.from || dayOf(r.at) >= q.from) && (!q.to || dayOf(r.at) <= q.to))
        .filter((r) => !q.user || r.by.toLowerCase() === q.user.toLowerCase())
        .filter((r) => !q.caseId || r.caseId === q.caseId)
        .sort(newestFirst)
      const skip = Number(q.skip ?? 0)
      const take = Number(q.take ?? 25)
      return envelope({ items: rows.slice(skip, skip + take), totalMatches: rows.length })
    }
    const m = path.match(/^Insurance\/Patterns\/Cases\/([^/]+)\/Block$/)
    if (m && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}')
      mine.calls.blocks.push({ caseId: m[1], body, csrf })
      if (mine.blockRefusal) return businessRefusal(mine.blockRefusal.code, mine.blockRefusal.message)
      const d = patterns.details.get(m[1])
      if (!d) return businessRefusal('CASE_NOT_FOUND', 'No case has this id.', 404)
      if (d.status !== 'confirmed') return businessRefusal('CASE_NOT_CONFIRMED', 'Only a confirmed case can add its patient to the blocked-patient list.')
      if (!['abuse', 'fraud'].includes(body.reasonKind)) return businessRefusal('REASON_KIND_REQUIRED', 'Choose abuse or fraud.')
      const at = stamp(mine)
      // 4056: the block uses the identity, so it writes a reveal-log row with the reason "block".
      mine.reveals.push({ caseId: d.caseId, caseNumber: d.caseNumber, by: mine.user, at, reason: 'block', ...PLANTED })
      // The answer echoes the list entry it made — the patient key with it. The page must keep none of it.
      return envelope({ key: PLANTED.patientKey, reasonKind: body.reasonKind, payer: body.payer ?? '', reference: `Case ${d.caseNumber}`, startsOn: body.startsOn ?? dayOf(at), expiresOn: body.endsOn ?? '' })
    }
    return null
  }
}
