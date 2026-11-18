/**
 * oms 909 (BackOffice spec 4002): the one `GET Auth/Permissions` answer replaced every per-area `*\/Access` probe. This
 * source contract keeps them gone: it walks `src/**\/*.{ts,tsx}` with comments stripped and fails on any probe call,
 * probe key, probe builder or per-area access query.
 *
 * The one allowed read (brief 3995, "Not covered by the answer"): the AuthzAdmin page's assignable / revocable role
 * lists, which are data rather than a menu fact, still come from `AuthzAdminWeb/Access` until BackOffice gives the page
 * its own call. Allowed by exact file and exact literal.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')

const ALLOWED_ACCESS_READ = { file: 'features/admin/authz-admin/api.ts', literal: "'AuthzAdminWeb/Access'" }

/** Line and block comments out, string contents kept (a probe path IS a string). */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    out += c
    i++
  }
  return out
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    // Tests too (a stubbed probe is a probe someone still expects), all but this file, whose fixtures spell them.
    else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'no-access-probes.test.ts') acc.push(full)
  }
  return acc
}

const RULES: [string, RegExp][] = [
  ["a '/Access' path", /['"`][^'"`\n]*\/Access['"`?]/],
  ["a 'CacheAccess' path", /['"`][^'"`\n]*CacheAccess['"`?]/],
  ['an *_ACCESS_KEY', /\b[A-Z][A-Z0-9_]*_ACCESS_KEY\b/],
  ['accessProbe(', /\baccessProbe\s*[(<]/],
  // A menu-probe object (key / run / visible), not any data field named `access` (a catalog mart's `access: { grant }`).
  ['an access: { … } menu probe', /\baccess\s*:\s*\{[^}]*\b(key|run|visible)\s*:/],
  ['an *AccessApi / *accessApi', /\b\w*[aA]ccessApi\b/],
  ['an .access() call', /\.access\s*\(\s*\)/],
  ['a per-area *AccessQuery()', /\b\w+AccessQuery\s*\(/],
]

/** Every violation in one source text, the allowed read excepted. */
function violations(relFile: string, source: string): string[] {
  let code = stripComments(source)
  if (relFile === ALLOWED_ACCESS_READ.file) code = code.split(ALLOWED_ACCESS_READ.literal).join("''")
  return RULES.filter(([, re]) => re.test(code)).map(([name]) => `${relFile}: ${name}`)
}

describe('no Access probe survives the one permissions answer', () => {
  it('no source under src/ calls, keys or builds a per-area access probe', () => {
    const found = walk(SRC).flatMap((file) =>
      violations(path.relative(SRC, file).split(path.sep).join('/'), readFileSync(file, 'utf8')),
    )
    expect(found).toEqual([])
  })

  it('the AuthzAdmin role-list read is the one allowed /Access call, and it is still there', () => {
    const source = readFileSync(path.join(SRC, ALLOWED_ACCESS_READ.file), 'utf8')
    expect(stripComments(source)).toContain(ALLOWED_ACCESS_READ.literal)
  })

  it.each([
    ['a probe call', "export const x = () => api.get('Nphies/Access')"],
    ['a template probe call', 'export const x = () => api.get(`Sd/CentralInvoice/Access`)'],
    ['the cache probe', "api.get('Pricing/CacheAccess')"],
    ['a probe key', "export const OMS_ACCESS_KEY = ['oms', 'access'] as const"],
    ['a probe builder', 'access: accessProbe({ key, run, visible })'],
    ['an inline menu probe', "{ labelKey: 'x', access: { key: ['a'], run, visible } }"],
    ['an access api', 'omsAccessApi.list()'],
    ['an access() call', 'bbyMaintainApi.access()'],
    ['a per-area access query', 'useQuery(holdDailyListAccessQuery())'],
  ])('catches %s', (_, source) => {
    expect(violations('features/x/api.ts', source)).not.toEqual([])
  })

  it.each([
    ['a comment naming a probe', "// the old GET Nphies/Access probe went in 909\nexport const x = 1"],
    ['a block comment naming a key', '/* OMS_ACCESS_KEY is gone */ export const x = 1'],
    ['the permissions call', "api.get<unknown>('Auth/Permissions')"],
    ['an Access-looking word that is not a probe', "const label = t('access.deniedTitle')"],
    ['a data field named access', 'const mart = { access: { grant: str(a.grant) } }'],
  ])('lets %s through', (_, source) => {
    expect(violations('features/x/api.ts', source)).toEqual([])
  })

  it('allows the AuthzAdmin role-list read only in its own file', () => {
    const source = "roleLists: () => api.get<RoleLists>('AuthzAdminWeb/Access')"
    expect(violations(ALLOWED_ACCESS_READ.file, source)).toEqual([])
    expect(violations('features/admin/ua-admin/api.ts', source)).not.toEqual([])
  })
})
