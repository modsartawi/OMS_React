// The control ratchet's pure core (ticket 596, spec 590 Testing Decisions §3).
//
// Counts the hand-written <button>, <input>, <select> and <textarea> of each feature and holds
// every feature to a checked-in baseline that may only fall. The CLI is `tools/check-controls.mjs`;
// the baseline is `tools/control-baseline.txt`; this module is the part vitest proves
// (`tools/control-ratchet.test.mjs`).
//
// Parser: oxc, through `parseSync` from `vite` — Vite 8 re-exports rolldown's oxc parser, and
// `vite` is already a pinned dev dependency, so the gate adds none. The repo's own `typescript` is
// 7.x (the native compiler), which ships no JS API; 583's inventory fell back to a global
// TypeScript 5, and pinning TypeScript 5 here (an npm alias) was tried and dropped: its `tsc` bin
// replaced TypeScript 7's in node_modules/.bin, so `npm run typecheck` ran the wrong compiler.
//
// What counts (583's rules, tuned):
//   - only lowercase JSX tags — the shared `Button`/`IconButton`/`Chip`/`Input`/`Select`/
//     `Textarea`/`Field` (594, 595) are capitalised components, so they are never counted;
//   - every `<button>`, whatever 583 bucket it falls in (variant look-alike, icon button, chip,
//     row/tile picker, grid-cell action, menu item, one-off, unstyled): a picker or a grid-cell
//     action restyled in place is exactly what an area ticket documents in its allowlist;
//   - every `<input>`/`<select>`/`<textarea>` EXCEPT the inputs spec 590 keeps native:
//     `checkbox` and `radio` (native + accent-color), `hidden`, and `file` (a hidden picker that a
//     Button opens);
//   - only `src/features/**/*.tsx`, outside any `__prototype__` folder (spec 590 story 47).

import { parseSync } from 'vite'

export const CONTROL_TAGS = ['button', 'input', 'select', 'textarea']
const NATIVE_KINDS = new Set(['checkbox', 'radio', 'hidden', 'file'])

/** `src/features/<area>/<feature>/…tsx` → `<area>/<feature>`; a file directly under an area → `<area>`. */
export function featureOf(relPath) {
  const p = relPath.split('\\').join('/')
  if (!p.startsWith('src/features/') || !p.endsWith('.tsx')) return null
  const parts = p.slice('src/features/'.length).split('/')
  if (parts.includes('__prototype__')) return null
  return parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0]
}

/** A JSX attribute's value as text: a literal as itself, an expression as `{…}`, a bare flag as `true`. */
function attrText(open, text, name) {
  const a = open.attributes.find((x) => x.type === 'JSXAttribute' && x.name.type === 'JSXIdentifier' && x.name.name === name)
  if (!a) return undefined
  const v = a.value
  if (!v) return 'true'
  if (v.type === 'Literal') return String(v.value)
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression
    if (e.type === 'Literal' && typeof e.value === 'string') return e.value
    if (e.type === 'TemplateLiteral' && !e.expressions.length) return e.quasis[0].value.cooked
    return '{' + text.slice(e.start, e.end) + '}'
  }
  return '?'
}

/** 583's field kinds, from the tag and `type`. */
function kindOf(tag, open, text) {
  if (tag === 'button' || tag === 'select' || tag === 'textarea') return tag
  const ty = attrText(open, text, 'type')
  if (!ty || ty === 'text') return 'text'
  if (ty.startsWith('{')) return 'dynamic type'
  if (['datetime-local', 'time', 'month', 'week'].includes(ty)) return 'date'
  if (['password', 'email', 'tel', 'url'].includes(ty)) return 'text'
  return ty
}

/** Every counted control in one .tsx source: `{ tag, kind, line }`, in source order. */
export function scanSource(text, fileName) {
  const { program, errors } = parseSync(fileName, text, { lang: 'tsx' })
  if (errors.length) throw new Error(`${fileName}: cannot parse — ${errors[0].message}`)
  const lineStarts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (pos) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  const rows = []
  const visit = (n) => {
    if (Array.isArray(n)) return n.forEach(visit)
    if (!n || typeof n !== 'object') return
    if (n.type === 'JSXOpeningElement' && n.name.type === 'JSXIdentifier' && CONTROL_TAGS.includes(n.name.name)) {
      const tag = n.name.name
      const kind = kindOf(tag, n, text)
      if (!NATIVE_KINDS.has(kind)) rows.push({ tag, kind, line: lineOf(n.start) })
    }
    for (const k in n) if (k !== 'parent' && typeof n[k] === 'object') visit(n[k])
  }
  visit(program)
  return rows.sort((a, b) => a.line - b.line)
}

// ---------------------------------------------------------------- the baseline file
//
// `tools/control-baseline.txt`, one block per feature, sorted, a blank line between blocks so two
// tickets lowering two different features never touch adjacent lines (git merges them cleanly):
//
//   campaigns/workspace 92
//
//   oms/deliveries 2
//     src/features/oms/deliveries/ViewsRail.tsx button: my-views rows are a row picker
//     src/features/oms/deliveries/QueryBar.tsx input: <one-line reason>
//
// `<feature> <ceiling>` at column 0. Indented lines under it are the feature's ALLOWLIST, one line
// per allowed control: `<repo path> <tag>: <reason>` — the reason is required (606). A feature
// with an allowlist is SWEPT: its ceiling must equal its allowlist's length, and each (file, tag)
// holds exactly the controls the allowlist names for it — no more (a rise) and no fewer (a stale
// line). Since 606 every feature is swept: a non-zero ceiling without an allowlist is a baseline
// error, so a feature holds a hand-styled control only by name. `#` lines are comments.

const FEATURE_LINE = /^(\S+)\s+(\d+)\s*$/
const ALLOW_LINE = /^\s+(\S+)\s+(button|input|select|textarea)\s*(?::\s*(.*?))?\s*$/

export function parseBaseline(text) {
  const entries = new Map()
  const errors = []
  let current = null
  const close = () => {
    if (current && current.allow.length && current.allow.length !== current.ceiling) {
      errors.push({
        line: current.line,
        message: `${current.feature}: ceiling ${current.ceiling} but its allowlist names ${current.allow.length} controls — a swept feature's ceiling is its allowlist`,
      })
    }
    // 606: the ratchet equals the allowlist everywhere — a feature may hold a control only by name.
    if (current && !current.allow.length && current.ceiling > 0) {
      errors.push({
        line: current.line,
        message: `${current.feature}: ceiling ${current.ceiling} with no allowlist — name each control it may hold (\`  <path> <tag>: <reason>\`), or lower it to 0`,
      })
    }
  }
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    if (!raw.trim() || raw.trim().startsWith('#')) return
    if (/^\s/.test(raw)) {
      const m = ALLOW_LINE.exec(raw)
      if (!m) errors.push({ line, message: `not an allowlist line (\`  <path> <button|input|select|textarea>[: reason]\`): ${raw.trim()}` })
      else if (!current) errors.push({ line, message: `allowlist line outside a feature block: ${raw.trim()}` })
      else if (!m[3]) errors.push({ line, message: `an allowlisted control needs its reason (\`  <path> <tag>: <reason>\`): ${raw.trim()}` })
      else current.allow.push({ file: m[1], tag: m[2], reason: m[3] })
      return
    }
    close()
    current = null
    const m = FEATURE_LINE.exec(raw)
    if (!m) return errors.push({ line, message: `not a feature line (\`<area>/<feature> <count>\`): ${raw}` })
    if (entries.has(m[1])) return errors.push({ line, message: `${m[1]} appears twice` })
    current = { feature: m[1], ceiling: Number(m[2]), allow: [], line }
    entries.set(m[1], current)
  })
  close()
  // the `line`/`feature` bookkeeping stays internal
  for (const e of entries.values()) Object.defineProperties(e, { line: { enumerable: false }, feature: { enumerable: false } })
  return { entries, errors }
}

// ---------------------------------------------------------------- the check

/**
 * rowsByFeature: Map<feature, [{ file, tag, kind, line }]>; baseline: parseBaseline(...).entries.
 * → { failures: string[], lowerable: [{ feature, from, to }] }. A rise fails. In a swept feature a
 * fall fails too (606: the allowlist line naming a control that is gone is stale). An unswept
 * ceiling that fell (only a baseline that already errors can hold one) is reported as lowerable.
 */
export function checkRatchet(rowsByFeature, baseline) {
  const failures = []
  const lowerable = []
  const features = [...new Set([...rowsByFeature.keys(), ...baseline.keys()])].sort()
  for (const feature of features) {
    const rows = rowsByFeature.get(feature) ?? []
    const entry = baseline.get(feature)
    const ceiling = entry?.ceiling ?? 0
    if (entry?.allow.length) {
      const allowed = new Map()
      for (const a of entry.allow) allowed.set(a.file + ' ' + a.tag, (allowed.get(a.file + ' ' + a.tag) ?? 0) + 1)
      const actual = new Map()
      for (const r of rows) {
        const k = r.file + ' ' + r.tag
        if (!actual.has(k)) actual.set(k, [])
        actual.get(k).push(r)
      }
      // 606: a swept feature holds exactly what its allowlist names — a line naming a control
      // that is gone is stale, and is deleted in the change that removed the control.
      for (const [k, may] of [...allowed].sort(([a], [b]) => a.localeCompare(b))) {
        const has = actual.get(k)?.length ?? 0
        if (has < may) {
          const [file, tag] = k.split(' ')
          failures.push(
            `${feature}: its allowlist names ${may} <${tag}> in ${file} but the file holds ${has} — delete the stale allowlist line(s) and lower the ceiling`,
          )
        }
      }
      for (const [k, rs] of [...actual].sort(([a], [b]) => a.localeCompare(b))) {
        const may = allowed.get(k) ?? 0
        if (rs.length > may) {
          const [file, tag] = k.split(' ')
          failures.push(
            `${feature}: ${rs.length} hand-styled <${tag}> in ${file}, its allowlist names ${may} — ` +
              rs.map((r) => `${r.file}:${r.line}`).join(', '),
          )
        }
      }
    } else if (rows.length > ceiling) {
      failures.push(
        `${feature}: ${rows.length} > ${ceiling} hand-styled controls` +
          (entry ? '' : ' (not in the baseline, so its ceiling is 0)') +
          ` — use the shared controls in @/core/ui; \`node tools/check-controls.mjs --list ${feature}\` lists them`,
      )
    }
    if (rows.length < ceiling) lowerable.push({ feature, from: ceiling, to: rows.length })
  }
  return { failures, lowerable }
}

// ---------------------------------------------------------------- writing the baseline

/** A fresh baseline: `header`, then one `<feature> <count>` block per feature, sorted. */
export function formatBaseline(counts, header) {
  const blocks = [...counts.keys()].sort().map((f) => `${f} ${counts.get(f)}`)
  return [header, ...blocks].join('\n\n') + '\n'
}

/**
 * Lower each unswept feature's ceiling to its count (never up), in place, touching nothing else —
 * so the edit is one line and merges beside any other feature's. A feature swept to nothing stays
 * as `<feature> 0` (deleting its block would touch its neighbours' lines). A swept feature (one
 * with an allowlist) is only reported in `skipped`: its ceiling IS its allowlist, edited by hand.
 * `only`: limit to these features (an area ticket lowers its own).
 */
export function lowerBaseline(text, counts, only) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const { entries } = parseBaseline(text)
  const lowered = []
  const skipped = []
  lines.forEach((raw, i) => {
    const m = FEATURE_LINE.exec(raw)
    if (!m) return
    const [, feature, ceilingText] = m
    if (only && !only.includes(feature)) return
    const ceiling = Number(ceilingText)
    const count = counts.get(feature) ?? 0
    if (count >= ceiling) return
    if (entries.get(feature)?.allow.length) return void skipped.push(feature)
    lines[i] = `${feature} ${count}`
    lowered.push(`${feature} ${ceiling} → ${count}`)
  })
  return { text: lines.join(eol), lowered, skipped }
}
