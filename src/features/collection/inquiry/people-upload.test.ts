import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PeopleUploadCommit, PeopleUploadPreview } from './people-upload'

const upload = vi.hoisted(() => vi.fn())

vi.mock('@/core/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), upload },
}))

const { ASSIGNMENT_OPTIONS_KEY, ASSIGNMENT_ROSTER_KEY, collectionApi, markRosterChanged } = await import('./api')
const { COMMIT_ROW_ERRORS, HASH_MISMATCH } = await import('./assignment-upload')
const {
  describePeopleIssue,
  peopleCommitOutcome,
  peopleFileRefusalKey,
  previewRole,
  reviewPeopleUpload,
  withPeopleCommitRowErrors,
} = await import('./people-upload')

/**
 * **The people file's preview and commit** — ticket 337 against BackOffice 2156's
 * `## Web contract`, whose samples are used VERBATIM below.
 *
 * 🔑 The dialog renders the server's reading of the file and decides almost nothing —
 * but what it does decide is the silent kind: whether Apply is offered, whether a
 * refused commit reads as a success, which row a refusal hangs on, and whether the
 * People list is told the roster changed.
 */

/** 2156's preview sample, verbatim. */
const SAMPLE: PeopleUploadPreview = {
  contentHash: '4b1d0f6a9c2e7d35a8f0c1b2e3d4f5a6978b6c5d4e3f2a1b0c9d8e7f6a5b4c3d',
  rowCount: 3,
  addedCount: 1,
  updatedCount: 1,
  unchangedCount: 1,
  canCommit: false,
  rows: [
    { rowNumber: 2, staffId: '4471', change: 'UNCHANGED',
      currentName: 'سارة العتيبي', name: 'سارة العتيبي', nameChanges: false,
      currentRole: 'ACCOUNTANT', role: 'ACCOUNTANT', roleChanges: false,
      currentSupervisorId: '4401', supervisorId: '4401', supervisorChanges: false },
    { rowNumber: 3, staffId: '5120', change: 'UPDATED',
      currentName: 'نورة', name: 'نورة القحطاني', nameChanges: true,
      currentRole: 'COLLECTOR', role: 'COLLECTOR', roleChanges: false,
      currentSupervisorId: '', supervisorId: '4401', supervisorChanges: true },
    { rowNumber: 4, staffId: '5133', change: 'ADDED',
      currentName: '', name: 'محمد ١٢', nameChanges: true,
      currentRole: '', role: 'COLLECTOR', roleChanges: true,
      currentSupervisorId: '', supervisorId: '4499', supervisorChanges: true },
  ],
  errors: [
    { rowNumber: 4, staffId: '5133', column: 'Name', code: 'NAME_NOT_STORABLE',
      message: 'The name holds characters the collection roster cannot store exactly, such as Arabic-Indic digits (١٢٣) — type them as 123, or remove them.\nيحتوي الاسم على رموز لا تحفظها قائمة موظفي التحصيل كما هي، مثل الأرقام الهندية (١٢٣) — اكتبها 123 أو احذفها.' },
    { rowNumber: 4, staffId: '5133', column: 'SupervisorId', code: 'SUPERVISOR_UNKNOWN',
      message: "Supervisor '4499' is neither on the collection roster nor a row of this file.\nالمشرف '4499' غير مسجل في قائمة موظفي التحصيل ولا مذكور في هذا الملف." },
  ],
}

/** The same file with the bad row fixed (dropped) — what finance uploads next. */
const CLEAN: PeopleUploadPreview = {
  ...SAMPLE,
  rowCount: 2,
  addedCount: 0,
  canCommit: true,
  rows: SAMPLE.rows.slice(0, 2),
  errors: [],
}

/** 2156's commit sample, verbatim. */
const ACCEPTED: PeopleUploadCommit = {
  accepted: true,
  refusalReason: '',
  added: 14,
  updated: 2,
  unchanged: 0,
  addedStaffIds: ['5133', '5134', '5135', '5136', '5137', '5138', '5139', '5140', '5141', '5142', '5143', '5144', '4498', '4499'],
  updatedStaffIds: ['4471', '5120'],
  errors: [],
  updatedBy: '4401',
  updatedAt: '2026-09-30T10:14:32.517',
}

const REFUSED: PeopleUploadCommit = {
  ...ACCEPTED,
  accepted: false,
  added: 0,
  updated: 0,
  addedStaffIds: [],
  updatedStaffIds: [],
  updatedBy: '',
  updatedAt: '0001-01-01T00:00:00',
}

describe('reviewPeopleUpload — what the preview shows', () => {
  it('preview shows added, updated, unchanged and refused rows with reasons', () => {
    const review = reviewPeopleUpload(SAMPLE)
    // Every row is listed, the refused one too — finance fixes the sheet against them.
    expect(review.rows.map((row) => [row.rowNumber, row.change])).toEqual([
      [2, 'UNCHANGED'],
      [3, 'UPDATED'],
      [4, 'ADDED'],
    ])
    expect(review.added).toBe(1)
    expect(review.updated).toBe(1)
    expect(review.unchanged).toBe(1)
    // Both of row 4's refusals hang on row 4, and it counts as ONE refused row.
    expect(Object.keys(review.issuesByRow)).toEqual(['4'])
    expect(review.issuesByRow[4].map((issue) => issue.code)).toEqual(['NAME_NOT_STORABLE', 'SUPERVISOR_UNKNOWN'])
    expect(review.refusedRows).toBe(1)
    // …and each carries a reason the screen can word.
    expect(describePeopleIssue(review.issuesByRow[4][1], review.rows)).toEqual({
      kind: 'known',
      code: 'SUPERVISOR_UNKNOWN',
      staffId: '5133',
      name: 'محمد ١٢',
      role: 'COLLECTOR',
      supervisorId: '4499',
    })
  })

  // Current and new values come from the server as-is — nothing here re-derives them.
  it('keeps each row’s current and new values and the server’s change flags', () => {
    const updated = reviewPeopleUpload(SAMPLE).rows[1]
    expect([updated.currentName, updated.name, updated.nameChanges]).toEqual(['نورة', 'نورة القحطاني', true])
    expect([updated.currentSupervisorId, updated.supervisorId, updated.supervisorChanges]).toEqual(['', '4401', true])
    expect(updated.roleChanges).toBe(false)
  })

  it('apply is disabled while any row is refused', () => {
    expect(reviewPeopleUpload(SAMPLE).canCommit).toBe(false)
    // ⚠️ The errors outrank the flag: a preview that names a bad row never commits,
    // whatever the boolean beside it says.
    expect(reviewPeopleUpload({ ...SAMPLE, canCommit: true }).canCommit).toBe(false)
    // The same file with the row fixed opens the door.
    expect(reviewPeopleUpload(CLEAN).canCommit).toBe(true)
  })

  // 🔑 `canCommit` is REQUIRED and read `=== true`.
  it('does not offer Apply when the server did not say canCommit: true', () => {
    const { canCommit: _dropped, ...rest } = CLEAN
    expect(reviewPeopleUpload(rest as PeopleUploadPreview).canCommit).toBe(false)
    expect(reviewPeopleUpload({ ...CLEAN, canCommit: 'true' as unknown as boolean }).canCommit).toBe(false)
  })

  // A file of the roster as it already stands is valid and writes nothing.
  it('does not offer Apply when every row is unchanged', () => {
    const same = { ...CLEAN, rows: [CLEAN.rows[0]], rowCount: 1, updatedCount: 0 }
    const review = reviewPeopleUpload(same)
    expect(review.canCommit).toBe(false)
    expect(review.nothingToApply).toBe(true)
  })

  it('holds a file-level issue (row 0) apart from the rows', () => {
    const fileIssue = { rowNumber: 0, staffId: '', column: '', code: HASH_MISMATCH, message: 'x' }
    const review = reviewPeopleUpload({ ...SAMPLE, errors: [fileIssue, ...SAMPLE.errors] })
    expect(review.fileIssues).toEqual([fileIssue])
    expect(review.issuesByRow[0]).toBeUndefined()
  })

  it('reads nothing as nothing', () => {
    const review = reviewPeopleUpload(null)
    expect(review.rows).toEqual([])
    expect(review.canCommit).toBe(false)
  })
})

describe('describePeopleIssue — the copy is keyed off the code', () => {
  it('names the person and the cell for each code it knows', () => {
    expect(describePeopleIssue(SAMPLE.errors[0], SAMPLE.rows)).toMatchObject({
      kind: 'known',
      code: 'NAME_NOT_STORABLE',
      staffId: '5133',
    })
  })

  // 🚩 A code this screen has not learned yet still says something true: the server's
  // own words — in English only, the web being English-only.
  it('falls back to the English line of the server message for a code it does not know', () => {
    const issue = { rowNumber: 2, staffId: '4471', column: 'Role', code: 'SOMETHING_NEW', message: 'New rule.\nقاعدة.' }
    expect(describePeopleIssue(issue, SAMPLE.rows)).toEqual({ kind: 'server', message: 'New rule.' })
  })

  it('still names the person when the row is not in the preview', () => {
    const issue = { rowNumber: 9, staffId: '7001', column: 'StaffId', code: 'REPEATED_STAFF', message: 'm' }
    expect(describePeopleIssue(issue, SAMPLE.rows)).toEqual({
      kind: 'known',
      code: 'REPEATED_STAFF',
      staffId: '7001',
      name: '',
      role: '',
      supervisorId: '',
    })
  })
})

describe('previewRole — a role cell in the preview', () => {
  it('labels the two roles and the blank one, and shows anything else as the file wrote it', () => {
    expect(previewRole('ACCOUNTANT')).toEqual({ kind: 'role', role: 'ACCOUNTANT' })
    expect(previewRole('COLLECTOR')).toEqual({ kind: 'role', role: 'COLLECTOR' })
    expect(previewRole('')).toEqual({ kind: 'role', role: '' })
    // A refused ROLE_UNKNOWN must not read as "Supervises only".
    expect(previewRole('MANAGER')).toEqual({ kind: 'raw', text: 'MANAGER' })
  })
})

describe('peopleCommitOutcome — a refusal must never read as a success', () => {
  it('reads the sample as applied', () => {
    expect(peopleCommitOutcome(ACCEPTED)).toBe('applied')
    expect(peopleCommitOutcome({ ...ACCEPTED, added: 0, addedStaffIds: [] })).toBe('applied')
  })

  // 🔑 The re-press: the same file again writes nothing and says so.
  it('reads a re-press (accepted, nothing written) as nothing applied', () => {
    expect(
      peopleCommitOutcome({ ...ACCEPTED, added: 0, updated: 0, addedStaffIds: [], updatedStaffIds: [], unchanged: 16 }),
    ).toBe('nothingApplied')
  })

  it('reads HASH_MISMATCH and ROW_ERRORS as the refusals they are', () => {
    expect(peopleCommitOutcome({ ...REFUSED, refusalReason: HASH_MISMATCH })).toBe('hashMismatch')
    expect(peopleCommitOutcome({ ...REFUSED, refusalReason: COMMIT_ROW_ERRORS })).toBe('rowErrors')
    expect(peopleCommitOutcome({ ...REFUSED, refusalReason: 'SOMETHING_NEW' })).toBe('refused')
  })

  it('reads an answer without accepted: true as refused', () => {
    const { accepted: _dropped, ...rest } = ACCEPTED
    expect(peopleCommitOutcome(rest as PeopleUploadCommit)).toBe('refused')
    expect(peopleCommitOutcome(null)).toBe('refused')
  })
})

describe('withPeopleCommitRowErrors — a row gone bad since the preview', () => {
  it('folds the commit’s rows onto the preview and shuts the door', () => {
    const errors = [
      { rowNumber: 3, staffId: '5120', column: 'SupervisorId', code: 'SUPERVISOR_UNKNOWN', message: 'm' },
    ]
    const folded = withPeopleCommitRowErrors(CLEAN, { ...REFUSED, refusalReason: COMMIT_ROW_ERRORS, errors })
    expect(folded?.errors).toEqual(errors)
    expect(reviewPeopleUpload(folded).canCommit).toBe(false)
    expect(reviewPeopleUpload(folded).issuesByRow[3]).toHaveLength(1)
  })

  it('leaves every other answer to the caller', () => {
    expect(withPeopleCommitRowErrors(CLEAN, ACCEPTED)).toBeNull()
    expect(withPeopleCommitRowErrors(CLEAN, { ...REFUSED, refusalReason: HASH_MISMATCH })).toBeNull()
    expect(withPeopleCommitRowErrors(CLEAN, { ...REFUSED, refusalReason: COMMIT_ROW_ERRORS, errors: [] })).toBeNull()
  })
})

describe('peopleFileRefusalKey — the 400s that cannot yield rows', () => {
  it('keys the refusals whose own words add nothing', () => {
    expect(peopleFileRefusalKey('PeopleUploadFileRequired')).toBe('fileRequired')
    expect(peopleFileRefusalKey('PeopleUploadFileTooLarge')).toBe('fileTooLarge')
    expect(peopleFileRefusalKey('PeopleUploadFileTypeUnsupported')).toBe('fileType')
    expect(peopleFileRefusalKey('PeopleUploadContentHashRequired')).toBe('hashRequired')
  })

  // The unreadable file's message names WHICH problem (a missing column, not UTF-8,
  // over 2000 rows) — a key would say less than the server did.
  it('leaves the unreadable file, and anything else, to the server’s words', () => {
    expect(peopleFileRefusalKey('PeopleUploadFileUnreadable')).toBeNull()
    expect(peopleFileRefusalKey('PeopleUploadNoRows')).toBeNull()
    expect(peopleFileRefusalKey('AssignmentUploadFileRequired')).toBeNull()
    expect(peopleFileRefusalKey(null)).toBeNull()
  })
})

describe('the commit — the same file, the preview’s hash, and the list told', () => {
  beforeEach(() => {
    upload.mockReset()
  })

  it('previews by sending the file alone', async () => {
    upload.mockResolvedValue(SAMPLE)
    const file = new File(['StaffId,Name,Role,SupervisorId\r\n'], 'people.csv', { type: 'text/csv' })

    expect(await collectionApi.peopleUploadPreview(file)).toBe(SAMPLE)
    const [path, form] = upload.mock.calls[0] as [string, FormData]
    expect(path).toBe('CollectionWeb/Assignment/People/Upload/Preview')
    expect([...form.keys()]).toEqual(['file'])
    expect((form.get('file') as File).name).toBe('people.csv')
  })

  it('commit sends the file with the preview hash and refreshes the list', async () => {
    upload.mockResolvedValue(ACCEPTED)
    const file = new File(['StaffId,Name,Role,SupervisorId\r\n'], 'people.csv', { type: 'text/csv' })

    const result = await collectionApi.peopleUploadCommit(file, SAMPLE.contentHash)
    const [path, form] = upload.mock.calls[0] as [string, FormData]
    expect(path).toBe('CollectionWeb/Assignment/People/Upload/Commit')
    expect((form.get('file') as File).name).toBe('people.csv')
    expect(await (form.get('file') as File).text()).toBe(await file.text())
    expect(form.get('contentHash')).toBe(SAMPLE.contentHash)

    // The People list and the four screens' picker both read the roster: a commit that
    // wrote anybody marks both stale, and the visible list refetches.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(ASSIGNMENT_ROSTER_KEY, [])
    client.setQueryData(ASSIGNMENT_OPTIONS_KEY, {})
    expect(markRosterChanged(client, result)).toBe(true)
    expect(client.getQueryState(ASSIGNMENT_ROSTER_KEY)?.isInvalidated).toBe(true)
    expect(client.getQueryState(ASSIGNMENT_OPTIONS_KEY)?.isInvalidated).toBe(true)
  })

  // A re-press wrote nobody, and a refusal wrote nothing: the list is left alone.
  it('leaves the list alone when the commit wrote nobody', () => {
    for (const result of [
      { ...ACCEPTED, added: 0, updated: 0, addedStaffIds: [], updatedStaffIds: [] },
      { ...REFUSED, refusalReason: HASH_MISMATCH },
    ]) {
      const client = new QueryClient()
      client.setQueryData(ASSIGNMENT_ROSTER_KEY, [])
      expect(markRosterChanged(client, result)).toBe(false)
      expect(client.getQueryState(ASSIGNMENT_ROSTER_KEY)?.isInvalidated).toBe(false)
    }
  })
})
