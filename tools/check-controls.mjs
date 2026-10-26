// The control ratchet — the fifth lint gate (ticket 596, spec 590 Testing Decisions §3).
//
//   node tools/check-controls.mjs                  check every feature against the baseline
//   node tools/check-controls.mjs --list <feature> list the feature's hand-styled controls (file:line)
//   node tools/check-controls.mjs --lower [<feature> …]
//                                                  lower ceilings to today's counts (never up)
//   node tools/check-controls.mjs --init           write the first baseline (refuses if one exists)
//
// Counts the hand-written <button>/<input>/<select>/<textarea> of every feature under
// `src/features/` (outside `__prototype__`) and holds each feature to `tools/control-baseline.txt`:
// no feature may rise, a feature missing from the baseline may hold none, and a SWEPT feature (one
// with an allowlist) may hold only the controls its allowlist names. The rules and the file format
// live in `tools/control-ratchet.mjs`; vitest proves them (`tools/control-ratchet.test.mjs`).
//
// Parser: oxc, via `parseSync` from `vite` (already a pinned dev dependency) — no global install,
// no added dependency (the repo's own TypeScript 7 ships no JS API; see control-ratchet.mjs).
//
// Same shape as `tools/check-boundaries.mjs`: a plain node script, `file:line` hits, exit non-zero.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { checkRatchet, featureOf, formatBaseline, lowerBaseline, parseBaseline, scanSource } from './control-ratchet.mjs'

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
for (const file of walk('src/features').sort()) {
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

const HEADER = `# The control ratchet's baseline (ticket 596, spec 590). Checked by \`npm run lint\`
# (tools/check-controls.mjs). One block per feature, sorted, a blank line between blocks.
#
# \`<area>/<feature> <ceiling>\` — the most hand-written <button>/<input>/<select>/<textarea> the
# feature may hold (checkbox/radio/hidden/file inputs and __prototype__ folders are not counted).
# A ceiling only ever falls. An indented line under a feature allowlists ONE control:
#   \`  <repo path> <button|input|select|textarea>: <one-line reason>\`
# A feature with an allowlist is SWEPT: its ceiling equals its allowlist's length and each file
# may hold only the controls its lines name.
#
# Lowering: \`node tools/check-controls.mjs --lower <feature>\` after a sweep; then, for what stays,
# replace the count with the allowlist (\`--list <feature>\` prints file:line for each).`

if (mode === '--init') {
  if (existsSync(BASELINE)) {
    console.error(`${BASELINE} already exists — lower it with --lower; a baseline is never regenerated`)
    process.exit(1)
  }
  writeFileSync(BASELINE, formatBaseline(counts, HEADER))
  console.log(`wrote ${BASELINE}: ${counts.size} features, ${total} controls`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error(`${BASELINE} is missing (node tools/check-controls.mjs --init writes the first one)`)
  process.exit(1)
}
const text = readFileSync(BASELINE, 'utf8')

if (mode === '--lower') {
  const out = lowerBaseline(text, counts, args.length ? args : undefined)
  if (out.text !== text) writeFileSync(BASELINE, out.text)
  for (const l of out.lowered) console.log(`lowered ${l}`)
  for (const f of out.skipped)
    console.log(`${f} is swept: edit its allowlist by hand (${counts.get(f) ?? 0} controls today)`)
  if (!out.lowered.length && !out.skipped.length) console.log('nothing to lower')
  process.exit(0)
}

if (mode) {
  console.error(`unknown option ${mode} (--list, --lower, --init)`)
  process.exit(2)
}

const { entries, errors } = parseBaseline(text)
for (const e of errors) console.error(`${BASELINE}:${e.line}: ${e.message}`)
const { failures, lowerable } = checkRatchet(rowsByFeature, entries)
for (const f of failures) console.error(f)
for (const l of lowerable)
  console.log(`note: ${l.feature} fell ${l.from} → ${l.to}; lower it: node tools/check-controls.mjs --lower ${l.feature}`)

if (errors.length || failures.length) {
  console.error(`\ncontrol ratchet: ${failures.length} feature(s) above the baseline, ${errors.length} baseline error(s)`)
  process.exit(1)
}
console.log(`control ratchet: ${counts.size} features, ${total} hand-styled controls, none above the baseline`)
