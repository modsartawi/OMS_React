import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Review 4063 #10: the phone bundle must not carry every OMS locale. The phone app's entry reaches its words through a
// phone-only i18n init holding just the namespaces it renders; nothing it imports at runtime reaches OMS's
// `@/core/i18n` (which imports every locale JSON). Proved on the import graph the bundler follows: every runtime import
// (static, dynamic, side-effect) from `src/app/minipos-main.tsx`, resolved the way the `@` alias resolves.

const root = process.cwd()
const SRC = path.join(root, 'src')

function resolve(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const p = base + ext
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

function runtimeGraph(entry: string) {
  const seen = new Set<string>()
  const namespaces = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    if (!/\.(ts|tsx)$/.test(file)) return
    const src = readFileSync(file, 'utf8')
    const specs = [
      ...[...src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
      ...[...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
      ...[...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ]
    for (const spec of specs) {
      const next = resolve(file, spec)
      if (next) visit(next)
    }
    // Code only: a comment that shows the `t('ns:key')` contract is not a call.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const m of code.matchAll(/useTranslation\(\s*['"]([^'"]+)['"]\s*\)/g)) namespaces.add(m[1])
    if (/useTranslation\(\s*\)/.test(code)) namespaces.add('common') // the default namespace
    for (const m of code.matchAll(/\bt\(\s*['"]([a-z-]+):/g)) namespaces.add(m[1])
  }
  visit(path.join(root, entry))
  const rel = [...seen].map((f) => path.relative(root, f).split(path.sep).join('/'))
  return { files: rel, namespaces }
}

describe('the phone bundle carries only the phone’s words', () => {
  const graph = runtimeGraph('src/app/minipos-main.tsx')

  it('never reaches OMS’s i18n init', () => {
    expect(graph.files).toContain('src/features/mini-pos/phone/MiniPosPhonePage.tsx')
    expect(graph.files).not.toContain('src/core/i18n.ts')
  })

  it('reaches only the locale files of the namespaces it renders, and renders every namespace it loads', async () => {
    const locales = graph.files.filter((f) => f.startsWith('src/locales/')).sort()
    const { PHONE_NAMESPACES } = await import('./minipos-i18n')
    expect([...graph.namespaces].sort()).toEqual([...PHONE_NAMESPACES].sort())
    expect(locales).toEqual(PHONE_NAMESPACES.flatMap((ns) => [`src/locales/ar/${ns}.json`, `src/locales/en/${ns}.json`]).sort())
  })

  it('the phone’s init answers its words, in both languages', async () => {
    const { default: i18n } = await import('./minipos-i18n')
    expect(i18n.t('mini-pos-phone:app.title')).not.toBe('app.title')
    expect(i18n.t('common:errors.network')).not.toBe('errors.network')
    expect(i18n.hasResourceBundle('ar', 'mini-pos-phone')).toBe(true)
    expect(i18n.hasResourceBundle('en', 'callcenter')).toBe(false)
  })
})
