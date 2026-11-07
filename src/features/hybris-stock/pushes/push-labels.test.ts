import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-pushes.json'
import { linesSwept, statusLabel, targetLabel, typeLabel } from './push-labels'

const at = (key: string) => key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], en)

describe('typeLabel', () => {
  it.each([
    ['D', 'type.delta'],
    ['F', 'type.full'],
    ['S', 'type.storeNow'],
    ['M', 'type.materialsNow'],
    ['X', 'type.unknown'],
    [null, 'type.unknown'],
  ])('%s → %s', (type, key) => expect(typeLabel(type)).toBe(key))
})

describe('statusLabel', () => {
  it('a sent push reads delivered to hot folder, never live on the website', () => {
    expect(statusLabel('S')).toEqual({ key: 'status.delivered', sev: 'ok' })
    expect(String(at('status.delivered'))).toBe('Delivered to hot folder')
    expect(JSON.stringify(en)).not.toMatch(/live on the website/i)
  })

  it('running, failed and an unknown letter', () => {
    expect(statusLabel('R')).toEqual({ key: 'status.running', sev: 'mute' })
    expect(statusLabel('E')).toEqual({ key: 'status.failed', sev: 'bad' })
    expect(statusLabel('Q').key).toBe('status.unknown')
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

describe('linesSwept', () => {
  const now = new Date('2026-11-07T12:00:00')
  it('the sweeper flag wins', () => {
    expect(linesSwept({ linesSwept: true, startedAt: '2026-11-07T10:00:00' }, 15, now)).toBe(true)
  })
  it('older than the retention window by the clock', () => {
    expect(linesSwept({ linesSwept: false, startedAt: '2026-10-22T11:00:00' }, 15, now)).toBe(true)
    expect(linesSwept({ linesSwept: false, startedAt: '2026-10-23T13:00:00' }, 15, now)).toBe(false)
  })
  it('an unreadable stamp is not swept', () => {
    expect(linesSwept({ linesSwept: false, startedAt: 'nope' }, 15, now)).toBe(false)
  })
})
