// Import-boundary gate for oms-react (issue 483 / rule: .claude/rules/feature-structure.md).
//
// Enforces mechanically what the feature-structure convention states, so a stray cross-feature
// import fails `npm run lint` instead of only being caught in review:
//   - a feature may NOT import another feature (including across areas: admin/* ↛ oms/*);
//   - `core/` may NOT import a feature (the shared layer must not depend on features).
// Explicitly allowed (never flagged): feature → @/core/*; feature → its own relative files;
//   app/ + layout/ → any feature (the composition root: router lazy-imports, menu accessProbes,
//   AppShell); anyone → core/app/layout.
//
// Deliberately dependency-free (no eslint toolchain) — it classifies by path prefix, so it needs
// no module resolution or type info. Swap for eslint-plugin-boundaries later if editor squiggles
// are wanted; the rules are the same. Features are discovered from the tree, so new features and
// new areas are covered automatically with no edit here.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'

const SRC = 'src'

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(toPosix(p))
  }
  return acc
}

const toPosix = (p) => p.split(sep).join('/')

// Normalize a posix path with `.`/`..` segments, no filesystem access.
function normalizePosix(p) {
  const out = []
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

// Classify a src-relative posix path (e.g. "src/features/oms/deliveries/api") into a layer.
// A feature's `id` is its area/feature (or just "auth"), so two different features never share one.
function classify(srcRel) {
  const m = srcRel.replace(/^src\//, '')
  if (m.startsWith('app/')) return { layer: 'app' }
  if (m.startsWith('layout/')) return { layer: 'layout' }
  if (m.startsWith('core/')) return { layer: 'core' }
  if (m.startsWith('features/')) {
    const parts = m.split('/') // ["features","auth",...] or ["features","oms","deliveries",...]
    if (parts[1] === 'auth') return { layer: 'feature', id: 'auth' }
    if (parts.length >= 3) return { layer: 'feature', id: `${parts[1]}/${parts[2]}` }
    return { layer: 'feature', id: parts[1] }
  }
  return { layer: 'other' } // locales, assets, vite-env, etc.
}

// Resolve an import specifier from a source file to a src-relative posix path, or null if it
// points outside src (an external package, or a relative path that escapes src — not our concern).
function resolveSpec(spec, fromFile) {
  if (spec.startsWith('@/')) return `src/${spec.slice(2)}`
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const resolved = normalizePosix(`${dirname(fromFile)}/${spec}`)
    return resolved.startsWith('src/') ? resolved : null
  }
  return null // bare specifier → external package
}

// Every import/export specifier in a file, with its 1-based line number.
const SPEC_RE = /(?:from|import|export)\s*\(?\s*['"]([^'"]+)['"]/g
function specifiers(content) {
  const hits = []
  let match
  while ((match = SPEC_RE.exec(content)) !== null) {
    const line = content.slice(0, match.index).split('\n').length
    hits.push({ spec: match[1], line })
  }
  return hits
}

const files = walk(SRC)
const violations = []

for (const file of files) {
  const from = classify(file)
  if (from.layer !== 'core' && from.layer !== 'feature') continue // only these two can offend
  for (const { spec, line } of specifiers(readFileSync(file, 'utf8'))) {
    const targetPath = resolveSpec(spec, file)
    if (!targetPath) continue
    const to = classify(targetPath)
    if (to.layer !== 'feature') continue // only feature targets can be a boundary breach here

    if (from.layer === 'core') {
      violations.push({ file, line, spec, why: `core/ must not import a feature (→ ${to.id})` })
    } else if (from.layer === 'feature' && from.id !== to.id) {
      violations.push({
        file,
        line,
        spec,
        why: `feature "${from.id}" must not import feature "${to.id}" — lift shared code to @/core/*`,
      })
    }
  }
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} import-boundary violation(s):\n`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}\n    ${v.spec}\n    ${v.why}\n`)
  console.error('See .claude/rules/feature-structure.md for the boundary rules.\n')
  process.exit(1)
}

console.log(`✓ import boundaries clean (${files.length} files checked)`)
