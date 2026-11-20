import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-pushes.json'
import { filesSoFar, linesGone, statusLabel, targetLabel, typeLabel } from './push-labels'

const at = (key: string) => key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], en)

describe('typeLabel', () => {
  it.each([
    ['delta', 'type.delta'],
    ['full', 'type.full'],
    ['now-store', 'type.storeNow'],
    ['now-materials', 'type.materialsNow'],
    // The guessed letters are not the log's words.
    ['D', 'type.unknown'],
    [null, 'type.unknown'],
  ])('%s → %s', (type, key) => expect(typeLabel(type)).toBe(key))
})

describe('statusLabel', () => {
  it('a sent push reads delivered to hot folder, never live on the website', () => {
    expect(statusLabel('sent')).toEqual({ key: 'status.delivered', sev: 'ok' })
    expect(String(at('status.delivered'))).toBe('Delivered to hot folder')
    expect(JSON.stringify(en)).not.toMatch(/live on the website/i)
  })

  it('running, failed and an unknown word', () => {
    expect(statusLabel('running')).toEqual({ key: 'status.running', sev: 'mute' })
    expect(statusLabel('failed')).toEqual({ key: 'status.failed', sev: 'bad' })
    expect(statusLabel('S').key).toBe('status.unknown')
  })
})

describe('targetLabel', () => {
  it('shadow says Hybris does not import it', () => {
    expect(targetLabel('shadow')).toEqual({ key: 'target.shadow', sev: 'warn' })
    expect(String(at('target.shadow'))).toMatch(/not imported/i)
  })

  it('only an exact live reads live', () => {
    expect(targetLabel('live').key).toBe('target.live')
    expect(targetLabel('LIVE').key).toBe('target.unknown')
    expect(targetLabel(null).key).toBe('target.unknown')
    expect(String(at('target.live'))).toMatch(/hot folder/i)
  })
})

describe('linesGone', () => {
  it('the server says whether the lines are kept; only an explicit false is gone', () => {
    expect(linesGone({ linesKept: false })).toBe(true)
    expect(linesGone({ linesKept: true })).toBe(false)
    expect(linesGone(null)).toBe(false)
    expect(linesGone({ linesKept: undefined as never })).toBe(false)
  })
})

describe('filesSoFar', () => {
  const push = (status: string, fileNames: string[], fileCount: number, parts: { uploaded: number; total: number } | null) =>
    ({ status, fileNames, fileCount, parts }) as Parameters<typeof filesSoFar>[0]

  it('a running split push before its first part is up is 0 of its parts, not "no file written"', () => {
    expect(filesSoFar(push('running', [], 3, { uploaded: 0, total: 3 }))).toEqual({ written: 0, total: 3 })
  })

  it('names grow as parts are uploaded', () => {
    const one = ['aldawaastockfull-oms-20261110030000.csv']
    expect(filesSoFar(push('running', one, 3, { uploaded: 1, total: 3 }))).toEqual({ written: 1, total: 3 })
  })

  it('falls back to fileCount when the row carries no parts', () => {
    expect(filesSoFar(push('running', [], 2, null))).toEqual({ written: 0, total: 2 })
  })

  it('a finished push, or one whose files are all named, has no progress line', () => {
    expect(filesSoFar(push('sent', ['a.csv'], 1, null))).toBeNull()
    expect(filesSoFar(push('failed', [], 3, { uploaded: 1, total: 3 }))).toBeNull()
    expect(filesSoFar(push('running', ['a.csv', 'b.csv'], 2, { uploaded: 2, total: 2 }))).toBeNull()
    expect(filesSoFar(push('running', [], 0, null))).toBeNull()
  })

  it('reads in English and Arabic', () => {
    expect(String(at('lines.filesSoFar'))).toBe('{{written}} of {{total}} files written so far')
  })
})
