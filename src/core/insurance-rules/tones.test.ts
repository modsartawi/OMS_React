import { describe, expect, it } from 'vitest'
import { GUARD_SEVERITY_TONE, guardSeverityTone } from './tones'

describe('guardSeverityTone', () => {
  it('reads a severity in either casing', () => {
    expect(guardSeverityTone('refuse')).toBe(GUARD_SEVERITY_TONE.REFUSE)
    expect(guardSeverityTone('OVERRIDE')).toBe(GUARD_SEVERITY_TONE.OVERRIDE)
    expect(guardSeverityTone('Warn').fill).toBe('bg-attention')
  })
  it('mutes an unknown severity', () => {
    expect(guardSeverityTone('bogus').fill).toBe('bg-muted-foreground')
  })
})
