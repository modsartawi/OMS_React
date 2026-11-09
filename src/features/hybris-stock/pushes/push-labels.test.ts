import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-pushes.json'
import { linesGone, statusLabel, targetLabel, typeLabel } from './push-labels'

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
