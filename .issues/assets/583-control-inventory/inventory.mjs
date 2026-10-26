// Ticket 583 — inventory the hand-styled controls in src/features/**/*.tsx.
//
// Run from the repo root:   node .issues/assets/583-control-inventory/inventory.mjs
// Writes inventory.json (raw rows) and inventory.md (tables) next to this script.
//
// It parses every .tsx with the TypeScript compiler API (no regex over JSX), finds each
// hand-written <button>/<input>/<select>/<textarea> plus <a>/<Link>/<NavLink>, resolves its
// className to the class tokens it can carry (inline literals, cn()/template/ternary branches,
// file-local constants, constants imported from sibling files or @/core), and puts it in exactly
// one bucket. Shape tokens (rounded-md/lg/xl, border-input, shadow-*) are counted per JSX element
// that carries them and landed as control / dialog / card / badge / other.
//
// Read-only over src/. Facts only; the decisions are 588's.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../..')
// The repo's own `typescript` is 7.x (the native compiler), which ships no JS compiler API.
// Fall back to a 5.x install: $TS_PATH, else the global npm one (`npm root -g`).
import { execSync } from 'node:child_process'
function loadTs() {
  const tryReq = (from) => { try { const t = createRequire(from)('typescript'); return t && t.createSourceFile ? t : null } catch { return null } }
  const candidates = [
    process.env.TS_PATH && path.join(process.env.TS_PATH, 'x.js'),
    path.join(repo, 'package.json'),
  ]
  try { candidates.push(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js')) } catch { /* no npm */ }
  for (const c of candidates.filter(Boolean)) { const t = tryReq(c); if (t) return t }
  throw new Error('No TypeScript 5.x compiler API found; set TS_PATH to a folder containing node_modules/typescript')
}
const ts = loadTs()

const SRC = path.join(repo, 'src')
const FEATURES = path.join(SRC, 'features')

// ---------------------------------------------------------------- files

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}
const files = walk(FEATURES).sort()
const rel = (p) => path.relative(repo, p).split(path.sep).join('/')

/** features/<area>/<feature>/… → "<area>/<feature>"; a file directly under an area → "<area>". */
function featureOf(file) {
  const parts = path.relative(FEATURES, file).split(path.sep)
  return parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0]
}

// ---------------------------------------------------------------- module cache + resolution

const sfCache = new Map()
function sourceFile(file) {
  if (!sfCache.has(file)) {
    const text = fs.readFileSync(file, 'utf8')
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    sfCache.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind))
  }
  return sfCache.get(file)
}

function resolveModule(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  for (const c of [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

/** Every top-level-or-nested declaration in a file, by name (first wins at top level). */
const declCache = new Map()
function declarations(file) {
  if (declCache.has(file)) return declCache.get(file)
  const sf = sourceFile(file)
  const decls = new Map() // name -> [{node, kind}]
  const add = (name, entry) => {
    if (!decls.has(name)) decls.set(name, [])
    decls.get(name).push(entry)
  }
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) add(n.name.text, { init: n.initializer, node: n })
    else if (ts.isFunctionDeclaration(n) && n.name) add(n.name.text, { fn: n, node: n })
    else if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
      const spec = n.moduleSpecifier.text
      const nb = n.importClause.namedBindings
      if (nb && ts.isNamedImports(nb))
        for (const el of nb.elements) add(el.name.text, { importFrom: spec, importName: (el.propertyName ?? el.name).text, node: el })
      if (n.importClause.name) add(n.importClause.name.text, { importFrom: spec, importName: 'default', node: n })
    } else if (ts.isParameter(n) && ts.isIdentifier(n.name)) add(n.name.text, { param: true, node: n })
    else if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) add(n.name.text, { param: true, node: n })
    ts.forEachChild(n, visit)
  }
  visit(sf)
  declCache.set(file, decls)
  return decls
}

/** Pick the declaration of `name` visible from `at` (nearest enclosing scope wins, crude but sound here). */
function lookup(file, name, at) {
  const list = declarations(file).get(name)
  if (!list) return null
  if (list.length === 1 || !at) return list[0]
  // prefer a declaration whose enclosing block contains `at`, the deepest one
  let best = null
  let bestDepth = -1
  for (const d of list) {
    const scope = enclosingScope(d.node)
    if (scope.pos <= at.pos && at.end <= scope.end) {
      const depth = depthOf(scope)
      if (depth > bestDepth) { best = d; bestDepth = depth }
    }
  }
  return best ?? list[0]
}
function enclosingScope(n) {
  let p = n.parent
  while (p && !ts.isBlock(p) && !ts.isSourceFile(p) && !ts.isFunctionLike(p)) p = p.parent
  return p ?? n.getSourceFile()
}
function depthOf(n) { let d = 0; while (n.parent) { d++; n = n.parent } return d }

function exportedDecl(file, name) {
  const decls = declarations(file)
  const list = decls.get(name)
  if (list) {
    const top = list.find((d) => enclosingScope(d.node) === sourceFile(file)) ?? list[0]
    return top
  }
  // re-export: export { X } from './y'
  for (const st of sourceFile(file).statements) {
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) if (el.name.text === name) {
        const target = resolveModule(file, st.moduleSpecifier.text)
        if (target) return { reexport: target, name: (el.propertyName ?? el.name).text }
      }
    }
  }
  return null
}

/**
 * Collect the class-string fragments an expression can evaluate to.
 * ctx: { refs: [{name, origin}], unresolved: bool, seen: Set }
 * origin: 'local' | 'sibling' | 'core' | 'param'
 */
function collect(expr, file, ctx, out = []) {
  if (!expr) return out
  const key = file + ':' + expr.pos + ':' + expr.end
  if (ctx.seen.has(key)) return out
  ctx.seen.add(key)
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) out.push(expr.text)
  else if (ts.isTemplateExpression(expr)) {
    out.push(expr.head.text)
    for (const s of expr.templateSpans) { collect(s.expression, file, ctx, out); out.push(s.literal.text) }
  } else if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) || ts.isSatisfiesExpression?.(expr)) collect(expr.expression, file, ctx, out)
  else if (ts.isConditionalExpression(expr)) { collect(expr.whenTrue, file, ctx, out); collect(expr.whenFalse, file, ctx, out) }
  else if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) collect(expr.right, file, ctx, out)
    else { collect(expr.left, file, ctx, out); collect(expr.right, file, ctx, out) }
  } else if (ts.isArrayLiteralExpression(expr)) for (const e of expr.elements) collect(e, file, ctx, out)
  else if (ts.isObjectLiteralExpression(expr)) {
    for (const p of expr.properties) {
      if (ts.isPropertyAssignment(p)) {
        // cn({ 'a b': cond }) — keys are classes; also plain maps of name -> classes
        if (ts.isStringLiteral(p.name)) out.push(p.name.text)
        collect(p.initializer, file, ctx, out)
      }
    }
  } else if (ts.isCallExpression(expr)) {
    const callee = expr.expression
    if (ts.isPropertyAccessExpression(callee) && ['join', 'trim', 'concat', 'filter'].includes(callee.name.text)) collect(callee.expression, file, ctx, out)
    if (ts.isIdentifier(callee) && !['cn', 'clsx', 'twMerge', 'cx'].includes(callee.text)) {
      // a local class-builder function: walk its body
      const d = resolveIdent(callee, file, ctx)
      if (d) collectDecl(d, file, ctx, out)
    }
    for (const a of expr.arguments) collect(a, file, ctx, out)
  } else if (ts.isIdentifier(expr)) {
    if (expr.text === 'undefined') return out
    const d = resolveIdent(expr, file, ctx)
    if (d) collectDecl(d, file, ctx, out)
  } else if (ts.isPropertyAccessExpression(expr)) {
    // NOTE.danger, styles.input
    const objDecl = ts.isIdentifier(expr.expression) ? resolveIdent(expr.expression, file, ctx) : null
    if (objDecl && objDecl.init) {
      let init = objDecl.init
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || ts.isSatisfiesExpression?.(init)) init = init.expression
      if (ts.isObjectLiteralExpression(init)) {
        const prop = init.properties.find((p) => p.name && (p.name.text === expr.name.text))
        if (prop && ts.isPropertyAssignment(prop)) collect(prop.initializer, objDecl.file, ctx, out)
        else ctx.unresolved = true
      } else collectDecl(objDecl, file, ctx, out)
    } else if (!objDecl) ctx.unresolved = true
  } else if (ts.isElementAccessExpression(expr)) {
    const objDecl = ts.isIdentifier(expr.expression) ? resolveIdent(expr.expression, file, ctx) : null
    if (objDecl) collectDecl(objDecl, file, ctx, out)
    else ctx.unresolved = true
  } else if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) collectFnBody(expr, file, ctx, out)
  else if (ts.isJsxExpression(expr)) collect(expr.expression, file, ctx, out)
  else ctx.unresolved = true
  return out
}

function collectFnBody(fn, file, ctx, out) {
  if (!fn.body) return
  if (!ts.isBlock(fn.body)) return collect(fn.body, file, ctx, out)
  const visit = (n) => {
    if (ts.isReturnStatement(n) && n.expression) collect(n.expression, file, ctx, out)
    else if (!ts.isFunctionLike(n)) ts.forEachChild(n, visit)
  }
  ts.forEachChild(fn.body, visit)
}

function collectDecl(d, file, ctx, out) {
  if (d.init) {
    if (ts.isArrowFunction(d.init) || ts.isFunctionExpression(d.init)) collectFnBody(d.init, d.file, ctx, out)
    else collect(d.init, d.file, ctx, out)
  } else if (d.fn) collectFnBody(d.fn, d.file, ctx, out)
  else ctx.unresolved = true
}

/** Resolve an identifier to { init|fn, file } following imports; records the ref + its origin. */
function resolveIdent(id, file, ctx) {
  const d = lookup(file, id.text, id)
  if (!d) { ctx.unresolved = true; ctx.refs.push({ name: id.text, origin: 'unknown' }); return null }
  if (d.param) { ctx.unresolved = true; ctx.refs.push({ name: id.text, origin: 'param' }); return null }
  if (d.importFrom) {
    const target = resolveModule(file, d.importFrom)
    const origin = d.importFrom.startsWith('@/core') ? 'core' : d.importFrom.startsWith('.') ? 'sibling' : 'package'
    ctx.refs.push({ name: id.text, origin, from: d.importFrom })
    if (!target) { ctx.unresolved = true; return null }
    let e = exportedDecl(target, d.importName)
    let tf = target
    while (e && e.reexport) { tf = e.reexport; e = exportedDecl(tf, e.name) }
    if (!e || e.param || e.importFrom) { ctx.unresolved = true; return null }
    return { ...e, file: tf }
  }
  const scope = enclosingScope(d.node)
  ctx.refs.push({ name: id.text, origin: ts.isSourceFile(scope) ? 'local' : 'local-scoped' })
  return { ...d, file }
}

// ---------------------------------------------------------------- jsx helpers

const tagName = (n) => n.tagName.getText()
function attrs(open) {
  const m = new Map()
  for (const p of open.attributes.properties) {
    if (ts.isJsxAttribute(p)) m.set(p.name.getText(), p.initializer ?? true)
    else if (ts.isJsxSpreadAttribute(p)) m.set('...' + p.expression.getText(), true)
  }
  return m
}
function attrString(a) {
  if (a === undefined) return undefined
  if (a === true) return 'true'
  if (ts.isStringLiteral(a)) return a.text
  if (ts.isJsxExpression(a) && a.expression) {
    const e = a.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
    return '{' + e.getText() + '}'
  }
  return '?'
}

function classesOf(open, file) {
  const a = attrs(open)
  const ctx = { refs: [], unresolved: false, seen: new Set() }
  const init = a.get('className')
  let fragments = []
  let form = 'none'
  if (init !== undefined && init !== true) {
    if (ts.isStringLiteral(init)) { fragments = [init.text]; form = 'inline' }
    else if (ts.isJsxExpression(init) && init.expression) {
      fragments = collect(init.expression, file, ctx)
      form = ctx.refs.length ? 'ref' : 'inline'
    }
  }
  const spread = [...a.keys()].some((k) => k.startsWith('...'))
  const tokens = [...new Set(fragments.join(' ').split(/\s+/).filter(Boolean))]
  return { tokens, form, refs: ctx.refs, unresolved: ctx.unresolved, spread, text: init && init !== true ? init.getText() : '' }
}

/** Does the element render readable text (vs only an icon)? */
function childrenProfile(el, file) {
  const isIcon = (tn) => {
    const d = declarations(file).get(tn.split('.')[0])
    const imp = d && d.find((x) => x.importFrom)
    return imp ? /lucide|icon/i.test(imp.importFrom) : /Icon$/.test(tn)
  }
  if (!ts.isJsxElement(el)) return { text: false, icon: false }
  let text = false
  let icon = false
  const visit = (c) => {
    if (ts.isJsxText(c)) { if (c.text.trim()) text = true }
    else if (ts.isJsxExpression(c)) {
      if (!c.expression) return
      const e = c.expression
      const jsxIn = []
      const scan = (n) => { if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) jsxIn.push(n); else ts.forEachChild(n, scan) }
      scan(e)
      if (jsxIn.length) jsxIn.forEach(visit)
      // a bare value or t() — text; a conditional/logical expression that only gates JSX is not
      if (!jsxIn.length) text = true
      else if (ts.isConditionalExpression(e) && (!isJsx(e.whenTrue) || !isJsx(e.whenFalse))) {
        if (!isJsx(e.whenTrue) && !isNullish(e.whenTrue)) text = true
        if (!isJsx(e.whenFalse) && !isNullish(e.whenFalse)) text = true
      }
    } else if (ts.isJsxSelfClosingElement(c)) {
      const tn = c.tagName.getText()
      if (/^[A-Z]/.test(tn)) { if (isIcon(tn)) icon = true; else text = true }
    } else if (ts.isJsxElement(c) || ts.isJsxFragment(c)) {
      c.children.forEach(visit)
    }
  }
  el.children.forEach(visit)
  return { text, icon }
}
const isJsx = (e) => { while (ts.isParenthesizedExpression(e)) e = e.expression; return ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e) }
const isNullish = (e) => e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined')

/** Name of the enclosing function-ish things, innermost first. */
function enclosingNames(n) {
  const names = []
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) names.push(p.name.text)
    else if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent) {
      if (ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) names.push(p.parent.name.text)
      else if (ts.isPropertyAssignment(p.parent)) names.push('prop:' + p.parent.name.getText())
    } else if (ts.isPropertyAssignment(p)) names.push('prop:' + p.name.getText())
    else if (ts.isMethodDeclaration(p)) names.push(p.name.getText())
  }
  return names
}

/** Ancestor jsx elements' roles (to spot menu/listbox/tablist containers). */
function ancestorRoles(n) {
  const roles = []
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isJsxElement(p)) {
      const r = attrString(attrs(p.openingElement).get('role'))
      if (r) roles.push(r)
    }
  }
  return roles
}

// ---------------------------------------------------------------- Button variants (from src/core/ui/Button.tsx)

const VARIANT_SIGS = [
  ['danger-outlined', ['border-danger-border']],
  ['cancel-request', ['bg-fam-cancel-request']],
  ['fulfilment', ['bg-fam-fulfilment']],
  ['danger', ['bg-danger', 'text-primary-foreground']],
  ['primary', ['bg-primary', 'text-primary-foreground']],
  ['ghost', ['border-border-strong', 'text-muted-foreground']],
  ['secondary', ['bg-card', 'hover:bg-accent']],
  ['outlined', ['bg-transparent', 'hover:bg-accent']],
  ['outlined', ['border', 'hover:bg-accent']],
  ['text', ['text-muted-foreground', 'hover:bg-accent']],
]
const BASE_SHAPE = ['h-7', 'rounded-md', 'px-3', 'text-xs']

function variantOf(tokens) {
  for (const [name, sig] of VARIANT_SIGS) if (sig.every((s) => tokens.includes(s))) return name
  return null
}

// ---------------------------------------------------------------- classification

const has = (tokens, re) => tokens.some((t) => re.test(t))
const looksButtonShaped = (tk) =>
  has(tk, /^(px|ps|pe)-/) && (has(tk, /^h-/) || has(tk, /^py-/)) && (has(tk, /^rounded/) || has(tk, /^border$/))
const hasFill = (tk) => has(tk, /^bg-(?!transparent$)/)
const looksLinky = (tk) => has(tk, /^(underline|hover:underline)$/) || (has(tk, /^text-primary$/) && !hasFill(tk) && !tk.includes('border'))
const refName = (c) => c.refs.map((r) => r.name).join(',')

function classifyButton(row, el, open, file, cls) {
  const a = attrs(open)
  const tk = cls.tokens
  const role = attrString(a.get('role'))
  const roles = ancestorRoles(el)
  const names = enclosingNames(el)
  const base = path.basename(file)
  const rn = refName(cls)

  if (!tk.length && cls.unresolved) return 'unclassified'
  // grid-cell actions: in a column file / cell renderer / row-actions component
  if (/columns?\.tsx$|Column\.tsx$|Cell\.tsx$|Renderer\.tsx$|RowActions\.tsx$/i.test(base) ||
      names.some((x) => /cell|renderer|rowaction/i.test(x)))
    return 'grid-cell action'
  // menu items
  if (['menuitem', 'menuitemradio', 'menuitemcheckbox', 'option'].includes(role) ||
      roles.some((r) => ['menu', 'listbox'].includes(r)) || /menu|option/i.test(rn))
    return 'menu item'
  // chips / toggles / tabs / segmented
  if (['tab', 'radio', 'switch', 'checkbox'].includes(role) || a.has('aria-pressed') || a.has('aria-selected') ||
      a.has('aria-checked') || roles.includes('tablist') || roles.includes('radiogroup') ||
      /chip|toggle|pill|tab|seg|filter/i.test(rn) || (tk.includes('rounded-full') && has(tk, /^border/) && cls.text.includes('?')))
    return 'chip/toggle'
  const kids = childrenProfile(el, file)
  if (!kids.text) return 'icon button'
  if (looksLinky(tk) && !looksButtonShaped(tk)) return 'text-link / bare text button'
  if (!hasFill(tk) && !has(tk, /^border(-[setb])?$/) && !has(tk, /^(p|px|py|ps|pe)-([2-9]|1\.5)/) && !has(tk, /^h-/) && tk.length)
    return 'text-link / bare text button'
  // full-width list rows and selectable tiles/cards (pickers, results, nav lists)
  if ((tk.includes('w-full') || tk.includes('flex-1')) && tk.includes('text-start') ||
      (tk.includes('text-start') && (has(tk, /^p-[2-9]/) || tk.includes('flex-col') || tk.includes('items-start'))) ||
      (has(tk, /^p-[2-9]/) && has(tk, /^border$/) && has(tk, /^rounded/)))
    return 'row/tile picker'
  const v = variantOf(tk)
  if (v && has(tk, /^(px|ps|pe|p)-/)) {
    row.variant = v
    row.baseShape = BASE_SHAPE.every((s) => tk.includes(s))
    return 'matches a Button variant'
  }
  if (!tk.length) { row.note = cls.spread ? 'className only via spread' : 'no className'; return 'unstyled/structural' }
  // a neutral bordered (or borderless-quiet) button shape whose tokens differ from every Button variant
  // (e.g. `border-border/60 hover:bg-muted rounded-full h-9`) — a look-alike of secondary/outlined
  if (has(tk, /^border(-(border|input)(\/\d+)?)?$/) && !has(tk, /^bg-(primary|danger|attention|success|fam-|login)/) &&
      has(tk, /^(px|ps|pe)-/) && (has(tk, /^h-/) || has(tk, /^py-/)))
    return 'outlined look-alike'
  return 'one-off'
}

function linkStyledAsButton(tk) {
  return (hasFill(tk) || has(tk, /^border$/)) && has(tk, /^(px|ps|pe)-/) && (has(tk, /^h-/) || has(tk, /^py-/))
}

function fieldKind(tag, a) {
  if (tag === 'select') return 'select'
  if (tag === 'textarea') return 'textarea'
  const ty = attrString(a.get('type'))
  const lbl = [attrString(a.get('placeholder')), attrString(a.get('aria-label')), attrString(a.get('name'))].join(' ')
  if (!ty || ty === 'text') return /search|find|filter/i.test(lbl) ? 'search' : 'text'
  if (ty === 'search') return 'search'
  if (['number', 'date', 'file', 'checkbox', 'radio'].includes(ty)) return ty
  if (['datetime-local', 'time', 'month', 'week'].includes(ty)) return 'date'
  if (['password', 'email', 'tel', 'url'].includes(ty)) return 'text'
  if (ty === 'hidden') return 'hidden'
  if (ty.startsWith('{')) return 'dynamic type'
  return 'other:' + ty
}

// shape tokens
const SHAPE_FAMILIES = [
  ['rounded-md/lg/xl', /^(?:[a-z0-9-]+:)*rounded(?:-[setblrxy]{1,2})?-(md|lg|xl)$/],
  ['border-input', /^(?:[a-z0-9-]+:)*border-input$/],
  ['shadow-*', /^(?:[a-z0-9-]+:)*shadow(?:-|$)/],
]
function landShape(tag, a, tk, file, el) {
  if (['button', 'input', 'select', 'textarea', 'a', 'Link', 'NavLink', 'label', 'summary'].includes(tag)) return 'control'
  const role = attrString(a.get('role'))
  if (['dialog', 'alertdialog'].includes(role) || a.has('aria-modal') || (tk.includes('fixed') && has(tk, /^shadow/)) ||
      (has(tk, /^z-/) && has(tk, /^shadow-(lg|xl|2xl)/)))
    return 'dialog/popover'
  if (['menu', 'listbox', 'tooltip'].includes(role) || (tk.includes('absolute') && has(tk, /^shadow/))) return 'dialog/popover'
  const small = has(tk, /^text-(\[1[01]px\]|xs|\[10px\])$/) && has(tk, /^(px-(0\.5|1|1\.5|2)|py-0\.5|py-px)$/)
  if (tag === 'span' && (small || tk.includes('inline-flex') || tk.includes('inline-block'))) return 'badge'
  if (small && !has(tk, /^p-[3-9]/)) return 'badge'
  if (['div', 'section', 'article', 'aside', 'fieldset', 'form', 'li', 'ul', 'table', 'details', 'header'].includes(tag) &&
      (has(tk, /^border/) || has(tk, /^shadow/) || has(tk, /^bg-(card|background|muted|popover)/)))
    return 'card/panel'
  return 'other'
}

// ---------------------------------------------------------------- scan

const rows = []
const shapeRows = []
let coreButtonUses = 0

for (const file of files) {
  const sf = sourceFile(file)
  const feature = featureOf(file)
  const visit = (n) => {
    const isOpen = ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)
    if (isOpen) {
      const tag = tagName(n)
      const el = ts.isJsxOpeningElement(n) ? n.parent : n
      const a = attrs(n)
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
      const cls = classesOf(n, file)
      const tk = cls.tokens
      const shared = cls.refs.length
        ? [...new Set(cls.refs.map((r) => (r.origin === 'local-scoped' ? 'local' : r.origin)))].join('+')
        : null
      if (tag === 'Button') coreButtonUses++
      let row = null
      if (tag === 'button') {
        row = { group: 'button', tag, file: rel(file), feature, line }
        row.bucket = classifyButton(row, el, n, file, cls)
      } else if (tag === 'a' || tag === 'Link' || tag === 'NavLink') {
        if (linkStyledAsButton(tk)) row = { group: 'button', tag, file: rel(file), feature, line, bucket: 'link styled as button' }
        else row = { group: 'link', tag, file: rel(file), feature, line, bucket: cls.unresolved && !tk.length ? 'unclassified' : 'plain link' }
      } else if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        const kind = fieldKind(tag, a)
        row = { group: 'field', tag, file: rel(file), feature, line, bucket: kind, kind }
      }
      if (row) {
        row.classForm = cls.form
        row.shared = shared
        row.refs = cls.refs.map((r) => r.name + '@' + r.origin)
        row.partlyUnresolved = cls.unresolved
        row.classKey = tk.length ? [...tk].sort().join(' ') : cls.form === 'none' ? '(none)' : '(unresolved:' + refName(cls) + ')'
        row.className = cls.text.length > 400 ? cls.text.slice(0, 400) + '…' : cls.text
        rows.push(row)
      }
      // shape tokens on any element
      for (const [fam, re] of SHAPE_FAMILIES) {
        const hits = tk.filter((t) => re.test(t))
        if (hits.length) {
          shapeRows.push({ family: fam, tokens: hits, tag, landing: landShape(tag, a, tk, file, el), file: rel(file), feature, line, shared })
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

// ---------------------------------------------------------------- tables

const count = (arr, f) => arr.reduce((m, r) => { const k = f(r); m.set(k, (m.get(k) ?? 0) + 1); return m }, new Map())
const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
const table = (head, body) => ['| ' + head.join(' | ') + ' |', '| ' + head.map((h, i) => (i ? '---:' : '---')).join(' | ') + ' |', ...body.map((r) => '| ' + r.join(' | ') + ' |')].join('\n')

const buttons = rows.filter((r) => r.group === 'button')
const fields = rows.filter((r) => r.group === 'field')
const links = rows.filter((r) => r.group === 'link')
const rawButtons = rows.filter((r) => r.tag === 'button')
const tagCounts = count(rows, (r) => r.tag)

const BUTTON_ORDER = ['matches a Button variant', 'icon button', 'link styled as button', 'text-link / bare text button', 'chip/toggle', 'menu item', 'row/tile picker', 'grid-cell action', 'outlined look-alike', 'one-off', 'unstyled/structural', 'unclassified']
const bBuckets = count(buttons, (r) => r.bucket)
const fBuckets = count(fields, (r) => r.bucket)
const FIELD_ORDER = ['text', 'search', 'number', 'date', 'file', 'checkbox', 'radio', 'select', 'textarea', 'hidden', 'dynamic type']

const checks = []
const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0)
checks.push(['buttons: bucket sum = <button> + button-styled links', sum(bBuckets), rawButtons.length + buttons.filter((r) => r.tag !== 'button').length])
checks.push(['fields: bucket sum = <input>+<select>+<textarea>', sum(fBuckets), (tagCounts.get('input') ?? 0) + (tagCounts.get('select') ?? 0) + (tagCounts.get('textarea') ?? 0)])
checks.push(['links: plain + styled-as-button = all <a>/<Link>/<NavLink>', links.length + buttons.filter((r) => r.tag !== 'button').length, (tagCounts.get('a') ?? 0) + (tagCounts.get('Link') ?? 0) + (tagCounts.get('NavLink') ?? 0)])
const shapeLand = count(shapeRows, (r) => r.family + '|' + r.landing)
checks.push(['shape: landings sum = shape-token element hits', sum(shapeLand), shapeRows.length])
const unclassified = rows.filter((r) => r.bucket === 'unclassified')
const allOk = checks.every(([, a, b]) => a === b)

const md = []
md.push('# 583 — control inventory')
md.push('')
md.push(`Generated by [\`inventory.mjs\`](inventory.mjs) on ${new Date().toISOString().slice(0, 10)} over \`src/features/**/*.tsx\` (${files.length} files), parsed with the TypeScript compiler API. Raw rows: [\`inventory.json\`](inventory.json). Re-run: \`node .issues/assets/583-control-inventory/inventory.mjs\`.`)
md.push('')
md.push('**How a className is read.** Every string fragment the expression can produce is collected: inline literals, both branches of a ternary, `cn()`/template/`.join()` parts, file-local constants, object-map members (`NOTE.danger`), class-builder functions\' return values, and constants imported from sibling files or `@/core` (followed to their declaration). Tokens are the union, so a conditional class string counts all its branches.')
md.push('')
md.push('## Totals')
md.push('')
md.push(table(['Element', 'Count'], [...['button', 'input', 'select', 'textarea', 'a', 'Link', 'NavLink'].map((t) => [`\`<${t}>\``, tagCounts.get(t) ?? 0]), ['`<Button>` (core/ui, for reference)', coreButtonUses]]))
md.push('')
md.push('**Checks** (every occurrence lands in exactly one bucket):')
md.push('')
md.push(table(['Check', 'Buckets', 'Total', 'OK'], checks.map(([n, a, b]) => [n, a, b, a === b ? 'yes' : '**NO**'])))
md.push('')
md.push(`Unclassified: **${unclassified.length}**.` + (unclassified.length ? ' ' + unclassified.map((r) => `\`${r.file}:${r.line}\``).join(', ') : ''))
md.push('')
md.push('## Buttons')
md.push('')
md.push('Rules, first match wins: className unresolvable → *unclassified*; in a `*columns.tsx`/`*Cell.tsx`/`RowActions.tsx` file or a `*Cell*`/`*Renderer*` function → *grid-cell action*; `role=menuitem|option` or inside `role=menu|listbox` (or a `*MENU*`/`*OPTION*` constant) → *menu item*; `role=tab|radio|switch`, `aria-pressed|selected|checked`, inside a tablist/radiogroup, a `*CHIP*/*TOGGLE*/*PILL*/*TAB*/*SEG*/*FILTER*` constant, or a conditional `rounded-full` bordered pill → *chip/toggle* (tabs included); no readable text child (only lucide icons) → *icon button*; underline / bare `text-primary`, or no fill, no border, no padding ≥1.5 and no height → *text-link / bare text button*; full-width `text-start` rows and padded bordered tiles → *row/tile picker*; a `core/ui/Button` variant\'s colour signature plus padding → *matches a Button variant*; no className → *unstyled/structural*; a neutral-bordered button shape with no variant signature → *outlined look-alike*; otherwise *one-off*. `<a>`/`<Link>`/`<NavLink>` with a fill or border plus button padding → *link styled as button* (the rest are plain links, counted separately). The variant match reads colour tokens only; *Exact BASE shape* below says whether the size/shape tokens match too.')
md.push('')
md.push(table(['Bucket', 'Count', 'Shared className', 'Distinct class strings'], BUTTON_ORDER.filter((b) => bBuckets.has(b)).map((b) => {
  const rs = buttons.filter((r) => r.bucket === b)
  return [b, rs.length, rs.filter((r) => r.shared).length, new Set(rs.map((r) => r.classKey)).size]
}).concat([['**total**', buttons.length, buttons.filter((r) => r.shared).length, new Set(buttons.map((r) => r.classKey)).size]])))
md.push('')
const vm = buttons.filter((r) => r.bucket === 'matches a Button variant')
md.push('Variant matches by variant (and how many also carry `Button`\'s exact BASE shape `h-7 rounded-md px-3 text-xs`):')
md.push('')
md.push(table(['Variant', 'Count', 'Exact BASE shape'], sorted(count(vm, (r) => r.variant)).map(([v, c]) => [v, c, vm.filter((r) => r.variant === v && r.baseShape).length])))
md.push('')
md.push('Most-repeated class strings among *outlined look-alike* and *one-off* buttons (top 10; a repeat means a pattern spelt out more than once):')
md.push('')
md.push(table(['Class string (sorted tokens)', 'Uses', 'Files'], sorted(count(buttons.filter((r) => ['outlined look-alike', 'one-off'].includes(r.bucket)), (r) => r.classKey)).slice(0, 10).map(([k, c]) => ['`' + k + '`', c, new Set(buttons.filter((r) => r.classKey === k).map((r) => r.file)).size])))
md.push('')
md.push('## Fields')
md.push('')
md.push(`Parser counts differ slightly from the ticket's grep (422 \`<button\`, 550 fields): the grep also matched tag names inside comments and strings.`)
md.push('')
md.push('Kind from the tag and `type`; a text input whose placeholder/aria-label/name mentions search/find/filter counts as *search*. Distinct class strings = distinct sorted token sets (an unresolvable className counts as one string per reference).')
md.push('')
const LAYOUT = /^(?:[a-z0-9-]+:)*(w|min-w|max-w|m|mt|mb|ms|me|mx|my|flex|shrink|grow|basis|col-span|row-span|self|order|justify-self)(-|$)/
const shapeKey = (r) => r.classKey.startsWith('(') ? r.classKey : r.classKey.split(' ').filter((t) => !LAYOUT.test(t)).join(' ')
md.push(table(['Kind', 'Count', 'Distinct class strings', 'Distinct ignoring width/margin/flex', 'Shared className', 'No className'], FIELD_ORDER.concat([...fBuckets.keys()].filter((k) => !FIELD_ORDER.includes(k))).filter((k) => fBuckets.has(k)).map((k) => {
  const rs = fields.filter((r) => r.bucket === k)
  return [k, rs.length, new Set(rs.map((r) => r.classKey)).size, new Set(rs.map(shapeKey)).size, rs.filter((r) => r.shared).length, rs.filter((r) => r.classForm === 'none').length]
}).concat([['**total**', fields.length, new Set(fields.map((r) => r.classKey)).size, new Set(fields.map(shapeKey)).size, fields.filter((r) => r.shared).length, fields.filter((r) => r.classForm === 'none').length]])))
md.push('')
const fieldPairs = (k) => fields.filter((r) => r.bucket === k)
md.push('Most-repeated text/number/date/search/select/textarea class strings (top 8):')
md.push('')
md.push(table(['Class string (sorted tokens)', 'Uses'], sorted(count(fields.filter((r) => ['text', 'search', 'number', 'date', 'select', 'textarea'].includes(r.bucket)), (r) => r.classKey)).slice(0, 8).map(([k, c]) => ['`' + k + '`', c])))
md.push('')
md.push('## Shape tokens — where they land')
md.push('')
md.push('One row per JSX element carrying the token family (in any branch of its className). Landing: *control* = button/input/select/textarea/a/Link/label; *dialog/popover* = `role=dialog|menu|listbox`, `aria-modal`, or fixed/absolute/z-indexed with a shadow; *badge* = a small inline span or tiny-text tight-padding element; *card/panel* = a block container with border/shadow/surface fill; *other* = the rest.')
md.push('')
const LANDS = ['control', 'card/panel', 'dialog/popover', 'badge', 'other']
md.push(table(['Family', ...LANDS, 'total'], SHAPE_FAMILIES.map(([fam]) => [fam, ...LANDS.map((l) => shapeLand.get(fam + '|' + l) ?? 0), shapeRows.filter((r) => r.family === fam).length])))
md.push('')
md.push('Token mix: ' + sorted(count(shapeRows.flatMap((r) => r.tokens.map((t) => t.replace(/^(?:[a-z0-9-]+:)+/, ''))), (t) => t)).map(([t, c]) => `\`${t}\` ${c}`).join(', ') + '.')
md.push('')
md.push('## Per screen — heaviest 20 features')
md.push('')
const perFeature = sorted(count(rows.filter((r) => r.group !== 'link'), (r) => r.feature))
md.push(table(['Feature', 'Buttons', 'Fields', 'Total', 'Shared className', 'One-off buttons', 'Distinct class strings'], perFeature.slice(0, 20).map(([f]) => {
  const rs = rows.filter((r) => r.feature === f && r.group !== 'link')
  return [f, rs.filter((r) => r.group === 'button').length, rs.filter((r) => r.group === 'field').length, rs.length, rs.filter((r) => r.shared).length, rs.filter((r) => r.bucket === 'one-off').length, new Set(rs.map((r) => r.classKey)).size]
})))
md.push('')
md.push(`${perFeature.length} features carry at least one hand-written control. Full per-feature list in the JSON (\`perFeature\`).`)
md.push('')
md.push('## Per file — heaviest 20')
md.push('')
const perFile = sorted(count(rows.filter((r) => r.group !== 'link'), (r) => r.file))
md.push(table(['File', 'Buttons', 'Fields', 'Total', 'Shared className'], perFile.slice(0, 20).map(([f]) => {
  const rs = rows.filter((r) => r.file === f && r.group !== 'link')
  return ['`' + f.replace('src/features/', '') + '`', rs.filter((r) => r.group === 'button').length, rs.filter((r) => r.group === 'field').length, rs.length, rs.filter((r) => r.shared).length]
})))
md.push('')
md.push('## Shared-constant users')
md.push('')
const sharedRows = rows.filter((r) => r.group !== 'link' && r.shared)
md.push(`${sharedRows.length} of ${rows.filter((r) => r.group !== 'link').length} controls take their className (wholly or in part) from a named constant/function rather than an inline string. By where the constant lives:`)
md.push('')
md.push(table(['Origin', 'Controls'], sorted(count(sharedRows, (r) => r.shared))))
md.push('')
md.push('*local* = declared in the same file; *sibling* = imported from another file of the feature; *core* = imported from `@/core`; *param* = a prop/parameter (the caller decides). Top constants by use:')
md.push('')
const refUse = sorted(count(sharedRows.flatMap((r) => [...new Set(r.refs)].map((x) => ({ x, f: r.feature }))), (o) => o.x))
md.push(table(['Constant@origin', 'Controls', 'Features'], refUse.slice(0, 25).map(([k, c]) => ['`' + k + '`', c, new Set(sharedRows.filter((r) => r.refs.includes(k)).map((r) => r.feature)).size])))
md.push('')
md.push('Features where most controls (≥50%) go through a constant: ' + perFeature.filter(([f, c]) => rows.filter((r) => r.feature === f && r.group !== 'link' && r.shared).length / c >= 0.5).map(([f]) => '`' + f + '`').join(', ') + '.')
md.push('')
md.push('## What this means for the sweep (588)')
md.push('')
const oneOff = bBuckets.get('one-off') ?? 0
const vmc = vm.length
const exact = vm.filter((r) => r.baseShape).length
const fieldKeys = new Set(fields.filter((r) => ['text', 'search', 'number', 'date', 'select', 'textarea'].includes(r.bucket)).map((r) => r.classKey)).size
const fieldTyped = fields.filter((r) => ['text', 'search', 'number', 'date', 'select', 'textarea'].includes(r.bucket)).length
const top5 = perFeature.slice(0, 5)
const top5Share = top5.reduce((a, [, c]) => a + c, 0)
const totalControls = rows.filter((r) => r.group !== 'link').length
const ctrlShape = shapeRows.filter((r) => r.landing === 'control').length
md.push(`Facts only. Of ${buttons.length} button-like occurrences, ${vmc} already carry a \`core/ui/Button\` variant's colour signature (${exact} with its exact BASE shape too), ${bBuckets.get('icon button') ?? 0} are icon buttons, ${bBuckets.get('chip/toggle') ?? 0} chips/toggles, ${bBuckets.get('menu item') ?? 0} menu items, ${bBuckets.get('grid-cell action') ?? 0} grid-cell actions, ${bBuckets.get('row/tile picker') ?? 0} row/tile pickers, ${bBuckets.get('outlined look-alike') ?? 0} neutral outlined look-alikes of secondary/outlined that differ in tokens (mostly \`border-border/60 hover:bg-muted\` pills), ${(bBuckets.get('text-link / bare text button') ?? 0)} text-link or bare text buttons, ${bBuckets.get('link styled as button') ?? 0} links styled as buttons and ${oneOff} one-offs. The ${fieldTyped} text-like fields (text/search/number/date/select/textarea) use ${fieldKeys} distinct class strings (${new Set(fields.filter((r) => ['text', 'search', 'number', 'date', 'select', 'textarea'].includes(r.bucket)).map(shapeKey)).size} once width/margin/flex tokens are set aside); ${fields.filter((r) => r.shared).length} of ${fields.length} fields already route through a named constant, against ${buttons.filter((r) => r.shared).length} of ${buttons.length} buttons. ${ctrlShape} of ${shapeRows.length} shape-token elements are controls; the rest sit on cards, popovers, badges and other containers, which a control primitive would not reach. The five heaviest features (${top5.map(([f]) => '`' + f + '`').join(', ')}) hold ${top5Share} of ${totalControls} controls (${Math.round((100 * top5Share) / totalControls)}%), spread over ${perFeature.length} features in all. Prototype folders (\`__prototype__\`) hold ${rows.filter((r) => r.group !== 'link' && r.file.includes('__prototype__')).length} of those controls.`)
md.push('')

fs.writeFileSync(path.join(here, 'inventory.md'), md.join('\n'))
// one row per line keeps the file diffable without ballooning it
const NL = '\n'
const lines = (arr) => '[' + NL + arr.map((r) => '  ' + JSON.stringify(r)).join(',' + NL) + NL + ' ]'
fs.writeFileSync(path.join(here, 'inventory.json'), '{' + NL + [
  ['generated', JSON.stringify(new Date().toISOString().slice(0, 10))],
  ['files', files.length],
  ['totals', JSON.stringify(Object.fromEntries(tagCounts))],
  ['coreButtonUses', coreButtonUses],
  ['checks', lines(checks.map(([name, buckets, total]) => ({ name, buckets, total, ok: buckets === total })))],
  ['perFeature', lines(perFeature.map(([feature, controls]) => ({ feature, controls })))],
  ['controls', lines(rows)],
  ['shapeTokens', lines(shapeRows)],
].map(([k, v]) => ` "${k}": ${v}`).join(',' + NL) + NL + '}' + NL)

// console summary
console.log('files', files.length, 'tags', Object.fromEntries(tagCounts), 'core <Button>', coreButtonUses)
console.log('buttons', Object.fromEntries(sorted(bBuckets)))
console.log('fields', Object.fromEntries(sorted(fBuckets)))
console.log('links plain', links.length)
for (const [n, a, b] of checks) console.log((a === b ? 'OK  ' : 'FAIL') + ' ' + n + ': ' + a + ' vs ' + b)
console.log('unclassified', unclassified.length, unclassified.map((r) => r.file + ':' + r.line + ' ' + r.className).join('\n  '))
if (!allOk) process.exitCode = 1
