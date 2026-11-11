/**
 * Ticket 890 (BackOffice spec 3632 Q44, Q45): the SQL editor. Run is `POST Analytics/Sql/Run` (BackOffice 3672), a
 * refusal is shown at its line and column; Save is `PUT Analytics/Item/{id}` with `{ statement, question, chart }` and
 * Restore is `…/Revert` (3675); a curator's Verify and Unverify are `…/Verify` and `…/Unverify` (3676). The network is
 * stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { ApiError } = await import('@/core/api')
const { analyticsApi } = await import('./api')
const { canEditSql } = await import('./access')
const { readSqlItem, refusalSpot, removesVerified, sqlCells, sqlItemActions, sqlRunRefusal, sqlSaveBody } = await import('./sql-editor')
const { revisionList } = await import('./revisions')

const refused = (code: string, data: unknown) =>
  new ApiError('business', 'The statement was refused.', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'The statement was refused.' }], data)

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})

describe('Run', () => {
  it('posts the statement alone to the editor door and reads the rows to the columns', async () => {
    api.post.mockResolvedValue({
      columns: ['store', 'net'],
      rows: [
        { store: 'B001', net: 1250.5 },
        { store: 'B002', net: null },
      ],
      rowCount: 2,
      isCut: false,
      durationMs: 41,
      statement: 'SELECT store, net\nFROM sales',
      tables: ['sales'],
    })
    const result = await analyticsApi.sqlRun('select store, net from sales')
    expect(api.post).toHaveBeenCalledWith('Analytics/Sql/Run', { statement: 'select store, net from sales' })
    expect(result.columns).toEqual(['store', 'net'])
    expect(result.rowCount).toBe(2)
    expect(result.tables).toEqual(['sales'])
    // A cell is drawn as text; SQL NULL stays null (the screen says NULL), a missing key too.
    expect(sqlCells(result)).toEqual([
      ['B001', '1250.5'],
      ['B002', null],
    ])
  })

  it('reads an absent or odd answer as an empty result, never undefined', async () => {
    api.post.mockResolvedValue({ rows: 'nope' })
    const result = await analyticsApi.sqlRun('select 1')
    expect(result).toEqual({ columns: [], rows: [], rowCount: 0, isCut: false, durationMs: 0, statement: '', tables: [] })
    expect(sqlCells(result)).toEqual([])
  })

  it('a not-parsed refusal (ANALYTICS-425) carries its line and column', () => {
    const r = sqlRunRefusal(refused('ANALYTICS-425', { reason: 'not-parsed', line: 2, column: 7 }))
    expect(r).toEqual({ code: 'ANALYTICS-425', reason: 'not-parsed', line: 2, column: 7, message: 'The statement was refused.' })
  })

  it('other refusals carry their reason and no place; 408 and 409 too; 428 is the missing grant', () => {
    expect(sqlRunRefusal(refused('ANALYTICS-425', { reason: 'table-not-allowed', line: null, column: null }))).toMatchObject({
      reason: 'table-not-allowed',
      line: null,
      column: null,
    })
    expect(sqlRunRefusal(refused('ANALYTICS-408', { reason: 'timed-out' }))).toMatchObject({ code: 'ANALYTICS-408', reason: 'timed-out', line: null })
    expect(sqlRunRefusal(refused('ANALYTICS-409', { reason: 'not-available' }))).toMatchObject({ reason: 'not-available' })
    expect(sqlRunRefusal(refused('ANALYTICS-428', null))).toMatchObject({ code: 'ANALYTICS-428', reason: 'needs-sql-grant' })
    // Not a SQL refusal: the caller words it as any analytics failure.
    expect(sqlRunRefusal(refused('ANALYTICS-403', null))).toBeNull()
    expect(sqlRunRefusal(new Error('boom'))).toBeNull()
  })

  it('the refusal is shown at its line: the line text, and where the column falls in it', () => {
    const statement = 'SELECT store\nFROM salez s\nWHERE 1 = 1'
    expect(refusalSpot(statement, 2, 6)).toEqual({ line: 2, column: 6, before: 'FROM ', at: 's', after: 'alez s' })
    // A column past the line's end points just after it.
    expect(refusalSpot(statement, 3, 40)).toEqual({ line: 3, column: 40, before: 'WHERE 1 = 1', at: '', after: '' })
    // No place (every reason but not-parsed), or a line the statement does not have: nothing to point at.
    expect(refusalSpot(statement, null, null)).toBeNull()
    expect(refusalSpot(statement, 9, 1)).toBeNull()
    // CRLF statements count lines the same way.
    expect(refusalSpot('SELECT 1\r\nFROM x', 2, 1)).toMatchObject({ before: '', at: 'F', after: 'ROM x' })
  })

  it('the editor shows only on the SQL grant, held beside the view grant', () => {
    expect(canEditSql({ canView: true, canAuthor: true, canCurate: false, canSql: true })).toBe(true)
    expect(canEditSql({ canView: true, canAuthor: true, canCurate: false })).toBe(false)
    expect(canEditSql({ canView: true, canAuthor: true, canCurate: false, canSql: 'true' as never })).toBe(false)
    expect(canEditSql({ canView: false, canAuthor: true, canCurate: true, canSql: true })).toBe(false)
    expect(canEditSql(undefined)).toBe(false)
  })
})

const SQL_ITEM = {
  id: 'q1',
  kind: 'view',
  engine: 'sql',
  verified: true,
  title: { en: 'Net by store', ar: 'الصافي حسب الفرع' },
  subtitle: { en: '', ar: '' },
  owner: 'u-owner',
  tier: 'personal',
  revision: 3,
  updatedAt: '2026-11-12T09:00:00',
  updatedBy: 'u-owner',
  definition: { statement: 'SELECT store, net FROM sales', question: 'Net by store?', chart: { type: 'bar', axis: 'store', values: [{ column: 'net', label: { en: 'Net', ar: 'الصافي' }, format: 'money' }] } },
  sql: { filtersApply: false, revision: 3, ranAt: '2026-11-12T09:01:00', result: { columns: ['store'], rows: [{ store: 'B001' }], rowCount: 1, isCut: false, durationMs: 9, statement: 'SELECT store' }, refusal: null },
  actions: ['edit', 'revisions', 'unverify'],
}

describe('Save and Restore', () => {
  it('reads a SQL item: its statement, question and chart, its kept run, the mark and the actions', async () => {
    api.get.mockResolvedValue(SQL_ITEM)
    const item = await analyticsApi.sqlItem('q1')
    expect(api.get).toHaveBeenCalledWith('Analytics/Item/q1')
    expect(item.engine).toBe('sql')
    expect(item.verified).toBe(true)
    expect(item.definition).toEqual(SQL_ITEM.definition)
    expect(item.sql?.result?.columns).toEqual(['store'])
    expect(item.sql?.refusal).toBeNull()
    expect(item.actions).toEqual(['edit', 'revisions', 'unverify'])
  })

  it('a kept refusal reads with its place; a chart left out reads as a table', async () => {
    api.get.mockResolvedValue({
      ...SQL_ITEM,
      definition: { statement: 'SELEC 1', question: '' },
      sql: { revision: 3, ranAt: null, result: null, refusal: { code: 'ANALYTICS-425', reason: 'not-parsed', line: 1, column: 1, message: 'Not read.' } },
    })
    const item = await analyticsApi.sqlItem('q1')
    expect(item.definition.chart).toEqual({ type: 'table', values: [] })
    expect(item.sql).toEqual({ revision: 3, ranAt: null, result: null, refusal: { code: 'ANALYTICS-425', reason: 'not-parsed', line: 1, column: 1, message: 'Not read.' } })
  })

  it('Save puts the new statement with the item question and chart at the revision it opened, a new revision back', async () => {
    api.get.mockResolvedValue(SQL_ITEM)
    api.put.mockResolvedValue({ ...SQL_ITEM, revision: 4, verified: false, definition: { ...SQL_ITEM.definition, statement: 'SELECT store FROM sales' } })
    const opened = await analyticsApi.sqlItem('q1')
    const saved = await analyticsApi.saveSqlItem('q1', sqlSaveBody(opened, 'SELECT store FROM sales'))
    expect(api.put).toHaveBeenCalledWith('Analytics/Item/q1', {
      definition: { statement: 'SELECT store FROM sales', question: 'Net by store?', chart: SQL_ITEM.definition.chart },
      baseRevision: 3,
    })
    expect(saved.revision).toBe(4)
    expect(saved.verified).toBe(false)
  })

  it('warns before a save that changes a verified statement removes the mark; the same statement keeps it', async () => {
    api.get.mockResolvedValue(SQL_ITEM)
    const item = await analyticsApi.sqlItem('q1')
    expect(removesVerified(item, 'SELECT store FROM sales')).toBe(true)
    expect(removesVerified(item, 'SELECT store, net FROM sales')).toBe(false)
    // The server compares ordinally: a change of case alone is a change.
    expect(removesVerified(item, 'select store, net from sales')).toBe(true)
    expect(removesVerified({ ...item, verified: false }, 'SELECT 1')).toBe(false)
  })

  it('Restore posts the revision to Revert and answers the SQL item at the new revision', async () => {
    api.post.mockResolvedValue({ ...SQL_ITEM, revision: 5 })
    const restored = await analyticsApi.sqlRevert('q1', 1)
    expect(api.post).toHaveBeenCalledWith('Analytics/Item/q1/Revert', { revision: 1 })
    expect(restored.revision).toBe(5)
    expect(restored.definition.statement).toBe('SELECT store, net FROM sales')
  })

  it('lists the revisions with their authors, as the server names them (savedBy, savedAt)', async () => {
    api.get.mockResolvedValue([
      { revision: 3, savedAt: '2026-11-12T09:00:00', savedBy: 'u-curator', action: 'update', revertedFrom: null },
      { revision: 2, savedAt: '2026-11-11T09:00:00', savedBy: 'u-owner', action: 'update', revertedFrom: null },
      { revision: 1, savedAt: '2026-11-10T09:00:00', savedBy: 'u-owner', action: 'create', revertedFrom: null },
    ])
    const rows = revisionList(await analyticsApi.revisions('q1'), 3)
    expect(api.get).toHaveBeenCalledWith('Analytics/Item/q1/Revisions')
    expect(rows.map((r) => [r.revision, r.by, r.at, r.canRevert])).toEqual([
      [3, 'u-curator', '2026-11-12T09:00:00', false],
      [2, 'u-owner', '2026-11-11T09:00:00', true],
      [1, 'u-owner', '2026-11-10T09:00:00', true],
    ])
  })

  it('a new statement (from the copilot) is saved as a new SQL item with its title and question', async () => {
    api.post.mockResolvedValue({ ...SQL_ITEM, id: 'q9', revision: 1, verified: false })
    const made = await analyticsApi.createSqlItem({ statement: 'SELECT 1', question: 'One?', title: { en: 'One', ar: 'واحد' } })
    expect(api.post).toHaveBeenCalledWith('Analytics/Item/Sql', { statement: 'SELECT 1', question: 'One?', title: { en: 'One', ar: 'واحد' } })
    expect(made.id).toBe('q9')
  })
})

describe('Verify', () => {
  const curator = { userId: 'u-curator', canView: true, canSql: true, canCurate: true }
  const owner = { userId: 'U-OWNER', canView: true, canSql: true, canCurate: false }
  const reader = { userId: 'u-reader', canView: true, canSql: false, canCurate: false }
  const item = (over: Record<string, unknown> = {}) => readSqlItem({ ...SQL_ITEM, actions: undefined, ...over })

  it('shows Verify to a curator on an unverified item and Unverify on a verified one, never both', () => {
    expect(sqlItemActions(item({ verified: false }), curator).verify).toBe('verify')
    expect(sqlItemActions(item({ verified: true }), curator).verify).toBe('unverify')
  })

  it('shows neither to the owner, nor to a reader', () => {
    expect(sqlItemActions(item(), owner).verify).toBeNull()
    expect(sqlItemActions(item(), reader).verify).toBeNull()
  })

  it('Edit (save, restore, revisions) is for its owner with the SQL grant, or a curator; a reader only reads', () => {
    expect(sqlItemActions(item(), owner).edit).toBe(true)
    expect(sqlItemActions(item(), curator).edit).toBe(true)
    expect(sqlItemActions(item(), { ...owner, canSql: false }).edit).toBe(false)
    expect(sqlItemActions(item(), reader).edit).toBe(false)
    expect(sqlItemActions(item(), { ...owner, userId: 'someone-else' }).edit).toBe(false)
  })

  it('the server\'s actions, when it sends them, can only take an action away', () => {
    expect(sqlItemActions(item({ verified: false, actions: ['edit', 'revisions'] }), curator)).toEqual({ edit: true, verify: null })
    expect(sqlItemActions(item({ verified: false, actions: ['verify'] }), curator)).toEqual({ edit: false, verify: 'verify' })
    // A server action the grants do not back is not offered.
    expect(sqlItemActions(item({ verified: false, actions: ['edit', 'verify'] }), reader)).toEqual({ edit: false, verify: null })
  })

  it('Verify and Unverify post to their doors with no body and answer the item with its mark', async () => {
    api.post.mockResolvedValueOnce({ ...SQL_ITEM, verified: true }).mockResolvedValueOnce({ ...SQL_ITEM, verified: false })
    expect((await analyticsApi.sqlVerify('q1')).verified).toBe(true)
    expect(api.post).toHaveBeenLastCalledWith('Analytics/Item/q1/Verify', {})
    const off = await analyticsApi.sqlUnverify('q1')
    expect(api.post).toHaveBeenLastCalledWith('Analytics/Item/q1/Unverify', {})
    expect(off.verified).toBe(false)
    expect(off.revision).toBe(3)
  })
})
