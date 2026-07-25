// The simulation key ledger, checkable (ticket 121, spec 110 — the contract half of
// the expand–contract 123 opened).
//
//   node tools/check-sim-keys.mjs
//
// A manual-run gate beside the other `tools/` gates, deliberately NOT wired into
// `npm run lint` (121's boundary: promoting it is a separate decision). No server and
// no browser — it reads the locale JSON and the feature's sources off disk.
//
// The whole argument for the ledger is that it is *checkable*, so this asserts all four
// halves of it at once:
//
//   1. every RETIRED key is gone from the locale JSON **and** from every call site —
//      the five money keys named explicitly, because a rename onto an occupied key is
//      the one shape zero-literal cannot protect: a half-swept state leaves a key that
//      resolves, renders plausible English, and is about the wrong number, which is
//      strictly worse than a raw key (at least that one is visibly broken). No
//      partially-swept state can satisfy this;
//   2. no `t()` call site in the feature resolves to a missing key;
//   3. no key in the namespace is unreferenced — allowing for the dynamic families,
//      which are reached by prefix (`strip.key.${chip.key}`) and for i18next's plural
//      suffixes (`manual.count_one` is reached as `manual.count`);
//   4. the uppercase keys carry their case in the JSON VALUE rather than in a CSS
//      `uppercase` transform — a transform is a no-op on Arabic script, so it would
//      leave these looking un-keyed rather than visibly needing a translator's decision.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { RETIRED, RETIRED_MONEY, UPPERCASE } from './sim-key-ledger.mjs'

const LOCALE = 'src/locales/en/simulation.json'
const FEATURE = 'src/features/pricing/simulation'
/** Files outside the feature that address the namespace explicitly (`simulation:key`). */
const OUTSIDE = ['src/layout/menu-model.ts']

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// ── the ledger ───────────────────────────────────────────────────────────────────
// ONE list, imported: `i18n-keys.test.ts` reads the same module. A ledger maintained in
// two places can go green on a stale copy, which is the one failure the expand–contract
// argument cannot survive.

// ── the locale file ──────────────────────────────────────────────────────────────
const json = JSON.parse(readFileSync(LOCALE, 'utf8'))

/** Every leaf path in the namespace, dotted. */
const leaves = (node, prefix = '') =>
  Object.entries(node).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, prefix + k + '.') : [prefix + k],
  )
const LEAVES = leaves(json)

const resolve = (p) =>
  p.split('.').reduce((n, s) => (n && typeof n === 'object' ? n[s] : undefined), json)

// ── the call sites ───────────────────────────────────────────────────────────────
const sources = [
  ...readdirSync(FEATURE)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => path.join(FEATURE, f)),
  ...OUTSIDE,
]

/** `t('a.b')` / `t("a.b")` — a static key. The namespace prefix is optional inside the
 *  feature (`useTranslation('simulation')`) and mandatory outside it. */
const STATIC = /\bt\(\s*['"]([A-Za-z0-9_.+:-]+)['"]/g
/** `t(\`a.b.${x}\`)` — a dynamic family, recorded as the PREFIX up to the hole. */
const DYNAMIC = /\bt\(\s*`([A-Za-z0-9_.+:-]*)\$\{/g
/** `t(cond ? 'a' : 'b')` and `t(SOME_MAP[x])` — a key in a ternary or a lookup table
 *  reads as a bare string literal elsewhere on the line, so the whole file is also
 *  scanned for quoted strings that LOOK like keys of this namespace. That is a
 *  deliberate over-collection: a false "referenced" is a key that stays, which is safe,
 *  where a false "unreferenced" would delete a live key. */
const LOOSE = /['"`](?:simulation:)?([a-z][A-Za-z0-9_+]*(?:\.[A-Za-z0-9_+]+)+)['"`]/g

const staticKeys = new Set()
const dynamicPrefixes = new Set()
const looseKeys = new Set()
const byFile = new Map()

for (const file of sources) {
  const src = readFileSync(file, 'utf8')
  for (const [, key] of src.matchAll(STATIC)) {
    const bare = key.replace(/^simulation:/, '')
    if (key.includes(':') && !key.startsWith('simulation:')) continue
    staticKeys.add(bare)
    if (!byFile.has(bare)) byFile.set(bare, file)
  }
  for (const [, prefix] of src.matchAll(DYNAMIC)) {
    const bare = prefix.replace(/^simulation:/, '')
    if (bare) dynamicPrefixes.add(bare)
  }
  for (const [, key] of src.matchAll(LOOSE)) looseKeys.add(key.replace(/^simulation:/, ''))
}

/** i18next reaches `x_one` / `x_other` from the base key `x`. */
const PLURAL = /_(one|other|zero|two|few|many)$/
const referenced = (leaf) => {
  const base = leaf.replace(PLURAL, '')
  if (staticKeys.has(leaf) || staticKeys.has(base)) return true
  if (looseKeys.has(leaf) || looseKeys.has(base)) return true
  return [...dynamicPrefixes].some((p) => leaf.startsWith(p))
}

// ── 1 · every retirement is gone, from the JSON and from the call sites ──────────
const survivingJson = RETIRED.filter((k) => resolve(k) !== undefined)
check(
  `no retired simulation key remains in the locale file — all ${RETIRED.length} of the ledger`,
  survivingJson.length === 0,
  survivingJson.join(', '),
)
const survivingCalls = RETIRED.filter((k) => staticKeys.has(k) || dynamicPrefixes.has(k))
check(
  'and none of them survives as a call site either — a JSON-only sweep is not a sweep',
  survivingCalls.length === 0,
  survivingCalls.map((k) => `${k} (${byFile.get(k) ?? 'dynamic'})`).join(', '),
)
const money = RETIRED_MONEY.filter((k) => resolve(k) !== undefined || staticKeys.has(k))
check(
  'the five retired money keys appear in neither the JSON nor any call site — the anti-collision assertion no partial sweep can satisfy',
  money.length === 0,
  money.join(', '),
)
check(
  'summary.elapsed is gone — the orphan that was already dead before the rework began',
  resolve('summary.elapsed') === undefined,
)

// ── 2 · every call site resolves ─────────────────────────────────────────────────
const unresolved = [...staticKeys].filter((k) => {
  if (typeof resolve(k) === 'string') return false
  // A plural key is authored as `x_one`/`x_other` and called as `x`.
  if (typeof resolve(k + '_other') === 'string') return false
  // A parent node addressed with `returnObjects` is not a miss either.
  return typeof resolve(k) !== 'object'
})
check(
  `no t() call site in the feature resolves to a missing key — ${staticKeys.size} static keys checked`,
  unresolved.length === 0,
  unresolved.map((k) => `${k} (${byFile.get(k)})`).join(', '),
)
const deadPrefixes = [...dynamicPrefixes].filter(
  (p) => !LEAVES.some((leaf) => leaf.startsWith(p)),
)
check(
  `and every dynamic key family has leaves behind it — ${dynamicPrefixes.size} families`,
  deadPrefixes.length === 0,
  deadPrefixes.join(', '),
)

// ── 3 · no key is unreferenced ───────────────────────────────────────────────────
const orphans = LEAVES.filter((leaf) => !referenced(leaf))
check(
  `no simulation key is unreferenced — ${LEAVES.length} keys, ${dynamicPrefixes.size} dynamic families reached by prefix`,
  orphans.length === 0,
  orphans.join(', '),
)

// ── 4 · the uppercase keys are authored, not transformed ─────────────────────────
const notUpper = UPPERCASE.filter((k) => {
  const v = resolve(k)
  return typeof v !== 'string' || !/[A-Za-z]/.test(v) || v !== v.toUpperCase()
})
check(
  'the uppercase keys carry their case in the JSON value — a CSS transform is a no-op on Arabic script',
  notUpper.length === 0,
  notUpper.map((k) => `${k}=${JSON.stringify(resolve(k))}`).join(', '),
)
// The other half of the same claim — *no call site re-uppercases them with a CSS
// transform* — is asserted in `tools/sim-rtl-drive.mjs` instead, off
// `getComputedStyle(...).textTransform` on the rendered chip. It cannot be checked
// honestly from here: a `uppercase` class three elements up still transforms the value,
// and a source-text heuristic either misses that or fires on the word appearing in a
// comment. Which token is spent where is only visible in a rendered tree.

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exitCode = failed.length ? 1 : 0
