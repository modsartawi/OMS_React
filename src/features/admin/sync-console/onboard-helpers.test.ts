import { describe, expect, it } from 'vitest'
import type { OnboardResult } from '@/core/models/sync-console'
import {
  LOCATION_COLUMNS,
  MASTER_COLUMNS,
  PASTE_CAP,
  codeIsValid,
  codeProblem,
  connectionTestVerdict,
  locationEditReady,
  locationRow,
  onboardRow,
  onboardResultSummary,
  parsePastedStores,
  pasteReady,
  storeEditReady,
  wizardStart,
} from './onboard-helpers'

describe('codeIsValid', () => {
  it('passes four capitals or digits', () => {
    expect(codeIsValid('A1B2')).toBe(true)
    expect(codeIsValid('P001')).toBe(true)
  })
  it('refuses lowercase, three characters and five', () => {
    expect(codeIsValid('a1b2')).toBe(false)
    expect(codeIsValid('ABC')).toBe(false)
    expect(codeIsValid('ABCDE')).toBe(false)
  })
  it('refuses a space, a dash and a non-Latin digit', () => {
    expect(codeIsValid('P00 ')).toBe(false)
    expect(codeIsValid('P-01')).toBe(false)
    expect(codeIsValid('P٠٠1')).toBe(false)
  })
})

describe('codeProblem', () => {
  it('names a lowercase code as lowercase, never upper-casing it', () => {
    expect(codeProblem('a1b2')).toBe('lowercase')
    expect(codeProblem('P00a')).toBe('lowercase')
  })
  it('names any other bad code as format, and an empty one as empty', () => {
    expect(codeProblem('ABC')).toBe('format')
    expect(codeProblem('abcde')).toBe('format')
    expect(codeProblem('')).toBe('empty')
  })
  it('is null for a good code', () => {
    expect(codeProblem('A1B2')).toBeNull()
  })
})

describe('wizardStart', () => {
  const both = { canOperate: true, canOnboard: true }
  it('starts at step 1 with canOnboard', () => {
    expect(wizardStart(both, null)).toBe('master')
    expect(wizardStart({ canOperate: false, canOnboard: true }, null)).toBe('master')
  })
  it('starts at step 2 without canOnboard', () => {
    expect(wizardStart({ canOperate: true, canOnboard: false }, null)).toBe('location')
  })
  it('starts at step 2 for a Finish, which names an existing store', () => {
    expect(wizardStart(both, 'P990')).toBe('location')
  })
  it('a Finish without canOperate falls back to the master wizard, never the location door', () => {
    expect(wizardStart({ canOperate: false, canOnboard: true }, 'P990')).toBe('master')
  })
  it('offers nothing to a view-only holder or before the probe answers', () => {
    expect(wizardStart({ canOperate: false, canOnboard: false }, null)).toBeNull()
    expect(wizardStart(undefined, 'P990')).toBeNull()
  })
})

describe('parsePastedStores', () => {
  const TSV = [
    'code\tdescription\tcity\tarea\taddress\tphone\tcr\tip',
    'P987\tRiyadh Yasmin 2\tRiyadh\tYasmin\tAnas Ibn Malik Rd\t0112345678\t1010998877\t10.23.237.11',
    '',
    'P988\tJeddah Obhur\tJeddah\tObhur\tPrince Abdullah Al Faisal\t0122223344\t4030112233\t10.23.238.11',
    '   ',
  ].join('\r\n')

  it('reads TSV, skips the header row and ignores blank lines', () => {
    const { rows, headerSkipped } = parsePastedStores(TSV, MASTER_COLUMNS)
    expect(headerSkipped).toBe(true)
    expect(rows.map((r) => r.fields.code)).toEqual(['P987', 'P988'])
    expect(rows[0].fields.address).toBe('Anas Ibn Malik Rd')
    expect(rows[1].fields.ip).toBe('10.23.238.11')
    expect(rows.every((r) => r.problems.length === 0)).toBe(true)
  })

  it('numbers each row by its line in the pasted text', () => {
    expect(parsePastedStores(TSV, MASTER_COLUMNS).rows.map((r) => r.line)).toEqual([2, 4])
  })

  it('reads CSV, with a quoted cell holding a comma', () => {
    const csv = 'Store code,Description,IP\nP990,"Madinah Quba, 2",10.1.1.1\nP991,Taif,10.1.1.2'
    const { rows, headerSkipped } = parsePastedStores(csv, LOCATION_COLUMNS)
    expect(headerSkipped).toBe(true)
    expect(rows.map((r) => r.fields)).toEqual([
      { code: 'P990', description: 'Madinah Quba, 2', ip: '10.1.1.1' },
      { code: 'P991', description: 'Taif', ip: '10.1.1.2' },
    ])
  })

  it('keeps a first row whose code is CODE: a valid store code, not a header', () => {
    const { rows, headerSkipped } = parsePastedStores('CODE\tStore code\t10.1.1.9\nP990\tQuba\t10.1.1.1', LOCATION_COLUMNS)
    expect(headerSkipped).toBe(false)
    expect(rows.map((r) => r.fields.code)).toEqual(['CODE', 'P990'])
  })

  it('skips a header that names the code column "Store"', () => {
    const { rows, headerSkipped } = parsePastedStores('Store,Name,IP\nP990,Quba,10.1.1.1', LOCATION_COLUMNS)
    expect(headerSkipped).toBe(true)
    expect(rows).toHaveLength(1)
  })

  it('keeps a first row that is data, not a header', () => {
    const { rows, headerSkipped } = parsePastedStores('P990,Quba,10.1.1.1', LOCATION_COLUMNS)
    expect(headerSkipped).toBe(false)
    expect(rows).toHaveLength(1)
  })

  it('flags a lowercase code and leaves it as written', () => {
    const { rows } = parsePastedStores('p989,Khobar,10.1.1.3', LOCATION_COLUMNS)
    expect(rows[0].fields.code).toBe('p989')
    expect(rows[0].problems).toEqual(['CODE_LOWERCASE'])
  })

  it('flags a bad code, a wrong cell count, a duplicate and a missing IP', () => {
    const text = ['P99,A,10.0.0.1', 'P992,B', 'P993,C,10.0.0.3', 'P993,D,10.0.0.4', 'P994,E,'].join('\n')
    expect(parsePastedStores(text, LOCATION_COLUMNS).rows.map((r) => r.problems)).toEqual([
      ['CODE_FORMAT'],
      ['COLUMN_COUNT', 'IP_MISSING'],
      [],
      ['DUPLICATE'],
      ['IP_MISSING'],
    ])
  })

  it('reads an empty paste as no rows', () => {
    expect(parsePastedStores(' \n\n', LOCATION_COLUMNS)).toEqual({ rows: [], headerSkipped: false })
  })
})

describe('pasteReady', () => {
  const row = (code: string, problems: string[] = []) => ({ line: 1, fields: { code }, problems }) as never
  it('needs at least one row and none marked', () => {
    expect(pasteReady([])).toBe(false)
    expect(pasteReady([row('P001')])).toBe(true)
    expect(pasteReady([row('P001'), row('p002', ['CODE_LOWERCASE'])])).toBe(false)
  })
  it('refuses more than 50 rows', () => {
    const rows = Array.from({ length: PASTE_CAP + 1 }, (_, i) => row(`P${String(i).padStart(3, '0')}`))
    expect(pasteReady(rows.slice(0, PASTE_CAP))).toBe(true)
    expect(pasteReady(rows)).toBe(false)
  })
})

describe('onboardResultSummary', () => {
  const r = (over: Partial<OnboardResult>): OnboardResult => ({
    code: 'P000',
    storeCreated: false,
    storeSkipped: false,
    locationCreated: false,
    ok: true,
    error: null,
    warning: null,
    ...over,
  })

  it('counts created, skipped and failed rows, with the failures coded', () => {
    const s = onboardResultSummary([
      r({ code: 'P987', storeCreated: true, locationCreated: true }),
      r({ code: 'P988', storeCreated: true, locationCreated: true, warning: 'CONNECTION_TEST_FAILED' }),
      r({ code: 'P134', storeSkipped: true, ok: false, error: 'LOCATION_EXISTS' }),
      r({ code: 'P135', storeSkipped: true, locationCreated: true }),
      r({ code: 'P136', ok: false, error: 'NO_TEMPLATE' }),
    ])
    expect([s.created, s.skipped, s.failed, s.ok, s.total, s.locations]).toEqual([2, 2, 2, 3, 5, 3])
    expect(s.outcome).toBe('someFailed')
    expect(s.failures).toEqual([
      { id: 'P134', code: 'LOCATION_EXISTS', labelKey: 'failures.LOCATION_EXISTS' },
      { id: 'P136', code: 'NO_TEMPLATE', labelKey: 'failures.NO_TEMPLATE' },
    ])
  })

  it('lists the warnings apart, without failing their rows', () => {
    const s = onboardResultSummary([r({ code: 'P988', storeCreated: true, warning: 'timeout 5 s' })])
    expect(s.warnings).toEqual([{ id: 'P988', warning: 'timeout 5 s' }])
    expect(s.outcome).toBe('allOk')
  })

  it('reads an unknown failure code as its raw code', () => {
    const s = onboardResultSummary([r({ code: 'P1', ok: false, error: 'SOMETHING_NEW' })])
    expect(s.failures[0].labelKey).toBeNull()
    expect(s.outcome).toBe('allFailed')
  })

  it('is empty for no rows', () => {
    expect(onboardResultSummary([]).outcome).toBe('empty')
  })
})

describe('connectionTestVerdict', () => {
  it('is testing while polled, OK when Done', () => {
    expect(connectionTestVerdict(undefined, false)).toBe('testing')
    expect(connectionTestVerdict({ status: 'Running' }, false)).toBe('testing')
    expect(connectionTestVerdict({ status: 'Done' }, false)).toBe('ok')
  })
  it('is a warning, never an error, for a failed test', () => {
    expect(connectionTestVerdict({ status: 'Failed' }, false)).toBe('warning')
    expect(connectionTestVerdict({ status: 'Expired' }, true)).toBe('warning')
  })
  it('is still running after the timeout', () => {
    expect(connectionTestVerdict({ status: 'Pending' }, true)).toBe('stillRunning')
  })
})

describe('locationEditReady', () => {
  const current = { description: 'Olaya', ip: '10.20.58.11', instance: 'SQLEXPRESS', dbName: 'POS' }
  it('needs a change', () => {
    expect(locationEditReady(current, current)).toBe(false)
    expect(locationEditReady(current, { ...current, ip: ' 10.20.58.11 ' })).toBe(false)
    expect(locationEditReady(current, { ...current, ip: '10.20.58.12' })).toBe(true)
  })
  it('does not count a stored value padded with spaces as a change', () => {
    const padded = { ...current, instance: 'SQLEXPRESS   ' }
    expect(locationEditReady(padded, { ...padded })).toBe(false)
  })
  it('refuses a blank field', () => {
    expect(locationEditReady(current, { ...current, ip: '10.20.58.12', dbName: '  ' })).toBe(false)
  })
})

describe('storeEditReady', () => {
  const edit = { description: 'Olaya', city: 'Riyadh', area: 'Olaya', address: 'Olaya St', phone: '011', cr: '1010' }
  it('needs every field filled', () => {
    expect(storeEditReady(edit)).toBe(true)
    expect(storeEditReady({ ...edit, phone: ' ' })).toBe(false)
  })
})

describe('result rows', () => {
  it('reads a skipped store master that still got its location', () => {
    expect(
      onboardRow({ code: 'P134', storeCreated: false, storeSkipped: true, locationCreated: true, ok: true, error: null, warning: 'NO_CONNECT' }),
    ).toEqual({ code: 'P134', store: 'skipped', locationCreated: true, ok: true, error: null, warning: 'NO_CONNECT', testCommandId: null })
  })
  it('reads a location row with its test to follow, and a refused one', () => {
    expect(locationRow({ code: 'P990', ok: true, error: null, host: 'Worker', connectionTestCommandId: 'C-9' })).toMatchObject({
      store: null,
      locationCreated: true,
      testCommandId: 'C-9',
    })
    expect(locationRow({ code: 'P991', ok: false, error: 'NO_STORE', host: null, connectionTestCommandId: null })).toMatchObject({
      locationCreated: false,
      error: 'NO_STORE',
    })
  })
})
