// Insurance pattern manager — the drive's stubs for oms 924 (BackOffice spec 4050: 4055's settings and reveal log, 4056's
// block). They serve the REAL shapes of BackOffice 4055/4056 as built (`InsuranceRules/Patterns/Settings`, `…/Reveals`,
// `…/Cases/{caseNumber}/Block`), so a live walk and the drives agree. Chained AFTER 922's shared doors:
//
//   import { patternsState, patternsDoors, envelope } from './insurance-patterns-stubs.mjs'
//   import { managerState, managerDoors } from './insurance-patterns-manager-stubs.mjs'
//   const patterns = patternsState(); const mine = managerState()
//   const doors = [patternsDoors(patterns), managerDoors(patterns, mine)]
//   await page.route('**/api/**', (r) => r.fulfill(doors.reduce((a, d) => a ?? d(r.request()), null) ?? envelope({})))
//
// Every fixture is synthetic. A careless server is played on purpose: each reveal-log row and the block's answer carry
// the PLANTED identity below, and the page must never show it (the reader keeps only the agreed fields).

import { bareNotFound, businessRefusal, caseNotFound, CLEARED_CASE, envelope, generatedCase, TRAVEL_CASE } from './insurance-patterns-stubs.mjs'

/** A synthetic identity (not a real person: the reserved-looking test range) that must never reach the screen. */
export const PLANTED = Object.freeze({ patientKey: 'NI:1999999901', memberId: 'M-PLANTED-0042' })

/** BackOffice 4051's defaults, in the order the server lists them. */
export const DEFAULT_SETTINGS = Object.freeze([
  { key: 'WindowDays', value: 7 },
  { key: 'MinStores', value: 3 },
  { key: 'MaxKmPerHour', value: 120 },
  { key: 'MinTravelKm', value: 50 },
  { key: 'OverlapShare', value: 0.25 },
  { key: 'CaseQuietDays', value: 30 },
  { key: 'LookbackDays', value: 90 },
])

/** The server's own ranges and whole-number flags (BackOffice 4055), sent beside each value. The page must not need them. */
const RANGES = Object.freeze({
  WindowDays: [1, 30, true],
  MinStores: [2, 10, true],
  MaxKmPerHour: [30, 500, false],
  MinTravelKm: [1, 500, false],
  OverlapShare: [0.05, 0.9, false],
  CaseQuietDays: [7, 90, true],
  LookbackDays: [30, 365, true],
})

const INVESTIGATORS = ['investigator1', 'investigator2', 'investigator3']
const REASONS = [
  'Payer BUPA asked for the patient on this case.',
  'Matching the CCTV request from Buraydah Central.',
  'block',
  'المطالبة من الجهة الدافعة تتطلب التحقق من هوية المريض.',
  'Confirming the same patient as on case 99 before the call to the payer.',
]

/**
 * The log's rows (`{ caseNumber, revealedBy, revealedAt, reason, fieldsShown }`): 31 of them over November, so the log
 * has two pages. Row 0 is the newest. Every row carries the PLANTED identity, as a careless server might send it.
 */
export function revealRows() {
  const cases = [TRAVEL_CASE, CLEARED_CASE, generatedCase(4), generatedCase(11)]
  return Array.from({ length: 31 }, (_, i) => {
    const c = cases[i % cases.length]
    const day = String(19 - Math.floor(i / 2)).padStart(2, '0')
    const revealedAt = `2026-11-${day}T${String(17 - (i % 2) * 6).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`
    return {
      caseNumber: c.caseNumber,
      revealedBy: INVESTIGATORS[i % INVESTIGATORS.length],
      revealedAt,
      reason: REASONS[i % REASONS.length],
      fieldsShown: 'patientKey,memberId',
      ...PLANTED,
    }
  })
}

/**
 * The manager doors' state for one scenario. `settingsRefusal` / `blockRefusal`: `{ code, message }` to refuse the next
 * save or block. `blockAnswer`: a raw fulfil argument the block door answers instead while set (a bare 403). `putAnswer`:
 * `'changed-only'` answers a save with only the thresholds it changed (a server answering less than the GET).
 * `calls` records what the app sent.
 */
export function managerState(over = {}) {
  return {
    settings: DEFAULT_SETTINGS.map((s) => ({ ...s, updatedBy: 'system', updatedAt: '2026-10-01T00:00:00' })),
    changes: [
      { key: 'WindowDays', oldValue: 5, newValue: 7, changedBy: 'manager1', changedAt: '2026-11-02T09:30:00' },
      { key: 'MinStores', oldValue: 4, newValue: 3, changedBy: 'manager2', changedAt: '2026-11-10T14:05:00' },
    ],
    reveals: revealRows(),
    settingsRefusal: null,
    blockRefusal: null,
    blockAnswer: null,
    putAnswer: 'all',
    user: 'msartawi',
    clock: 0,
    calls: { settingsGet: 0, settingsPut: [], reveals: [], blocks: [] },
    ...over,
  }
}

const dayOf = (iso) => iso.slice(0, 10)
const newestFirst = (at) => (a, b) => (a[at] < b[at] ? 1 : a[at] > b[at] ? -1 : 0)
/** "Now" on the stub's clock: after every fixture row (the newest is 2026-11-19 17:00), one minute a write. */
const stamp = (mine) => `2026-11-19T18:${String(10 + mine.clock++).padStart(2, '0')}:00`

/** The settings answer as 4055 sends it: each value with its default, range and whole-number flag, and the log newest first. */
const settingsAnswer = (mine) => ({
  settings: mine.settings.map((s) => ({
    key: s.key,
    value: s.value,
    defaultValue: DEFAULT_SETTINGS.find((d) => d.key === s.key)?.value ?? null,
    min: RANGES[s.key]?.[0] ?? null,
    max: RANGES[s.key]?.[1] ?? null,
    wholeNumber: RANGES[s.key]?.[2] ?? false,
    updatedBy: s.updatedBy,
    updatedAt: s.updatedAt,
  })),
  changes: [...mine.changes].sort(newestFirst('changedAt')),
})

/** The flat PUT body's entries as the server binds them: case-insensitively, onto the seven keys. */
const sentSettings = (body) =>
  Object.entries(body).map(([k, value]) => ({ key: Object.keys(RANGES).find((name) => name.toLowerCase() === k.toLowerCase()) ?? k, value }))

/**
 * The manager doors (BackOffice 4055/4056 as built): `GET`/`PUT InsuranceRules/Patterns/Settings`,
 * `GET …/Reveals?from&to&user&case&page&pageSize`, `POST …/Cases/{caseNumber}/Block`. Returns
 * `(request) => fulfil argument | null`: null for a path it does not own. `patterns` is 922's `patternsState` (the block
 * reads the case's status from it).
 */
export function managerDoors(patterns, mine) {
  return (request) => {
    const url = new URL(request.url())
    const path = decodeURIComponent(url.pathname.split('/api/')[1] ?? '')
    const method = request.method()
    const csrf = request.headers()['x-web-client'] ?? null

    if (path === 'InsuranceRules/Patterns/Settings' && method === 'GET') {
      mine.calls.settingsGet++
      return envelope(settingsAnswer(mine))
    }
    if (path === 'InsuranceRules/Patterns/Settings' && method === 'PUT') {
      const body = JSON.parse(request.postData() || '{}')
      mine.calls.settingsPut.push({ body, csrf })
      if (mine.settingsRefusal) return businessRefusal(mine.settingsRefusal.code, mine.settingsRefusal.message)
      const sent = sentSettings(body)
      // The server's own check (4055): every value within its range, or the whole save is refused.
      for (const { key, value } of sent) {
        const range = RANGES[key]
        if (!range || typeof value !== 'number' || value < range[0] || value > range[1])
          return businessRefusal('INSPATTERN_BAD_REQUEST', `${key} must be between ${range?.[0]} and ${range?.[1]}.`)
      }
      for (const { key, value } of sent) {
        const s = mine.settings.find((x) => x.key === key)
        if (s.value === value) continue
        const at = stamp(mine)
        mine.changes.push({ key, oldValue: s.value, newValue: value, changedBy: mine.user, changedAt: at })
        Object.assign(s, { value, updatedBy: mine.user, updatedAt: at })
      }
      if (mine.putAnswer === 'changed-only') {
        const keys = new Set(sent.map((s) => s.key))
        const answer = settingsAnswer(mine)
        return envelope({ ...answer, settings: answer.settings.filter((s) => keys.has(s.key)) })
      }
      return envelope(settingsAnswer(mine))
    }
    if (path === 'InsuranceRules/Patterns/Reveals' && method === 'GET') {
      const q = Object.fromEntries(url.searchParams)
      mine.calls.reveals.push({ query: q, csrf })
      const rows = mine.reveals
        .filter((r) => (!q.from || dayOf(r.revealedAt) >= q.from) && (!q.to || dayOf(r.revealedAt) <= q.to))
        .filter((r) => !q.user || r.revealedBy.toLowerCase() === q.user.toLowerCase())
        .filter((r) => !q.case || r.caseNumber === Number(q.case))
        .sort(newestFirst('revealedAt'))
      const page = Math.max(1, Number(q.page ?? 1))
      const pageSize = Math.max(1, Number(q.pageSize ?? 25))
      return envelope({ page, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) })
    }
    const m = path.match(/^InsuranceRules\/Patterns\/Cases\/([^/]+)\/Block$/)
    if (m && method === 'POST') {
      if (!/^\d+$/.test(m[1])) return bareNotFound()
      const n = Number(m[1])
      const body = JSON.parse(request.postData() || '{}')
      mine.calls.blocks.push({ caseNumber: n, body, csrf })
      if (mine.blockAnswer) return mine.blockAnswer
      if (mine.blockRefusal) return businessRefusal(mine.blockRefusal.code, mine.blockRefusal.message)
      const d = patterns.details.get(n)
      if (!d) return caseNotFound(n)
      if (d.status !== 'confirmed') return businessRefusal('INSPATTERN_BAD_REQUEST', 'Only a confirmed case can add its patient to the blocked-patient list.')
      if (!['abuse', 'fraud'].includes(body.reasonKind)) return businessRefusal('INSPATTERN_BAD_REQUEST', 'Choose abuse or fraud.')
      const at = stamp(mine)
      // 4056: the block uses the identity, so it writes a reveal-log row with the reason "block".
      mine.reveals.push({ caseNumber: d.caseNumber, revealedBy: mine.user, revealedAt: at, reason: 'block', fieldsShown: 'patientKey', ...PLANTED })
      // The answer echoes the list entry it made — the patient key with it. The page must keep none of it.
      return envelope({ key: PLANTED.patientKey, reasonKind: body.reasonKind, payer: body.payer ?? '', reference: `Case ${d.caseNumber}`, startsOn: body.startsOn ?? dayOf(at), expiresOn: body.expiresOn ?? '' })
    }
    return null
  }
}
