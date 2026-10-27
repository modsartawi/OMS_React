// The control ratchet — the fifth lint gate (ticket 596, spec 590 Testing Decisions §3).
//
//   node tools/check-controls.mjs                  check every feature against the baseline
//   node tools/check-controls.mjs --list <feature> list the feature's hand-styled controls (file:line)
//
// Counts the hand-written <button>/<input>/<select>/<textarea> of every feature under
// `src/features/` and every core module under `src/core/` except `core/ui` (outside
// `__prototype__`), and holds each to `tools/control-baseline.txt`: a feature holds exactly the
// controls its allowlist names, each with its reason, and one missing from the baseline holds none.
// (`--init` and `--lower` served the sweep, 596–605; since 606 every ceiling IS its allowlist, edited
// by hand, so they were removed in the code review of spec 590.) The rules and the file format
// live in `tools/control-ratchet.mjs`; vitest proves them (`tools/control-ratchet.test.mjs`).
//
// Parser: oxc, via `parseSync` from `vite` (already a pinned dev dependency) — no global install,
// no added dependency (the repo's own TypeScript 7 ships no JS API; see control-ratchet.mjs).
//
// Same shape as `tools/check-boundaries.mjs`: a plain node script, `file:line` hits, exit non-zero.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { checkRatchet, featureOf, parseBaseline, scanSource } from './control-ratchet.mjs'

const BASELINE = 'tools/control-baseline.txt'
const toPosix = (p) => p.split(path.sep).join('/')

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.tsx')) out.push(toPosix(p))
  }
  return out
}

const rowsByFeature = new Map()
for (const file of [...walk('src/features'), ...walk('src/core')].sort()) {
  const feature = featureOf(file)
  if (!feature) continue
  const rows = scanSource(readFileSync(file, 'utf8'), file).map((r) => ({ ...r, file }))
  if (!rows.length) continue
  if (!rowsByFeature.has(feature)) rowsByFeature.set(feature, [])
  rowsByFeature.get(feature).push(...rows)
}
const counts = new Map([...rowsByFeature].map(([f, rs]) => [f, rs.length]))
const total = [...counts.values()].reduce((a, b) => a + b, 0)

const [mode, ...args] = process.argv.slice(2)

if (mode === '--list') {
  for (const feature of args.length ? args : [...rowsByFeature.keys()].sort()) {
    const rows = rowsByFeature.get(feature) ?? []
    console.log(`${feature} ${rows.length}`)
    for (const r of rows) console.log(`  ${r.file}:${r.line} ${r.tag}${r.kind !== r.tag ? ` (${r.kind})` : ''}`)
  }
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error(`${BASELINE} is missing`)
  process.exit(1)
}
const text = readFileSync(BASELINE, 'utf8')

if (mode) {
  console.error(`unknown option ${mode} (--list)`)
  process.exit(2)
}

const { entries, errors } = parseBaseline(text)
for (const e of errors) console.error(`${BASELINE}:${e.line}: ${e.message}`)
const { failures } = checkRatchet(rowsByFeature, entries)
for (const f of failures) console.error(f)

if (errors.length || failures.length) {
  console.error(`\ncontrol ratchet: ${failures.length} feature(s) off the baseline, ${errors.length} baseline error(s)`)
  process.exit(1)
}
console.log(`control ratchet: ${counts.size} features, ${total} hand-styled controls, each one allowlisted with its reason`)
