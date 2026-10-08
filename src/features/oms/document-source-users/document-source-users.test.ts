import { describe, expect, it } from 'vitest'
import { parseImport, sendableLines } from '@/core/import/parse-import'
import { SOURCE_USER_IMPORT_COLUMNS, SOURCE_USERS_KEY, sourceUserLines, sourceUsersQuery } from './document-source-users'

const read = (text: string) => sendableLines(parseImport(text, SOURCE_USER_IMPORT_COLUMNS))

describe('sourceUserLines — what the import sends (ticket 438, spec 430 D7)', () => {
  it("maps a WPF line (user ID, document source) to the body's fields, a pin as isDeleted false", () => {
    expect(sourceUserLines(read('12345\tWEB')!)).toEqual([{ userId: '12345', documentSource: 'WEB', isDeleted: false }])
  })

  it('maps a trailing X, either case, to isDeleted true', () => {
    expect(sourceUserLines(read('12345\tWEB\tX\n67890\tAPP\tx')!).map((l) => l.isDeleted)).toEqual([true, true])
  })

  it("sends isDeleted — the server's name — and never isDelete", () => {
    const [line] = sourceUserLines(read('12345\tWEB\tX')!)
    expect(Object.keys(line)).toEqual(['userId', 'documentSource', 'isDeleted'])
    expect(line).not.toHaveProperty('isDelete')
  })

  it('keeps every line in file order, values as written', () => {
    expect(sourceUserLines(read('UserId\tDocumentSource\n 0042 \tweb')!)).toEqual([
      { userId: 'UserId', documentSource: 'DocumentSource', isDeleted: false },
      { userId: ' 0042 ', documentSource: 'web', isDeleted: false },
    ])
  })
})

describe("SOURCE_USER_IMPORT_COLUMNS — WPF's file", () => {
  it('reads user ID then document source, and errors a line with neither two columns nor two plus X', () => {
    const lines = parseImport('12345\n12345\tWEB\tY\n12345\tWEB\tX', SOURCE_USER_IMPORT_COLUMNS)
    expect(lines.map((l) => (l.error ? `error:${l.error.found}` : l.action))).toEqual(['error:1', 'error:3', 'delete'])
    expect(read('12345\nAB\tWEB')).toBeNull()
  })
})

describe('sourceUsersQuery — the list, on open (D16)', () => {
  it('is one key the import reloads, and does not retry a refusal', () => {
    const q = sourceUsersQuery()
    expect(q.queryKey).toEqual([...SOURCE_USERS_KEY])
    expect(q.retry).toBe(false)
  })
})
