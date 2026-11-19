import { describe, expect, it } from 'vitest'
import type { StoreDbHealthCheck } from '@/core/models/store-database'
import fixture from './__fixtures__/health-check.json'
import { checkFailed, checkLabelKey, healthCheckOf, healthGroups, priorityBadge } from './health-helpers'

const health = fixture as StoreDbHealthCheck

describe('healthGroups', () => {
  it('groups the findings by priority, most urgent first, in the server\'s order within a priority', () => {
    const groups = healthGroups(health.findings)
    expect(groups.map((g) => g.priority)).toEqual([1, 2, 3])
    expect(groups.map((g) => g.findings.map((f) => f.check))).toEqual([
      ['NearSizeCap', 'LogLargerThanData'],
      ['NoFullBackup'],
      ['AutoShrinkOn', 'LastGoodCheckDb', 'ReplicaLagUnusual'],
    ])
  })

  it('no findings is no groups', () => {
    expect(healthGroups([])).toEqual([])
  })
})

describe('priorityBadge', () => {
  it('priority 1 is urgent, 2 a warning, anything after is advice — never green', () => {
    expect(priorityBadge(1)).toEqual({ labelKey: 'storeDb.health.priority', sev: 'bad' })
    expect(priorityBadge(2)).toEqual({ labelKey: 'storeDb.health.priority', sev: 'warn' })
    expect(priorityBadge(3)).toEqual({ labelKey: 'storeDb.health.priority', sev: 'go' })
    expect(priorityBadge(50)).toEqual({ labelKey: 'storeDb.health.priority', sev: 'go' })
  })
})

describe('checkLabelKey', () => {
  it('a known check has its words', () => {
    expect(checkLabelKey('AutoShrinkOn')).toBe('storeDb.health.checks.AutoShrinkOn')
    expect(checkLabelKey('NearSizeCap')).toBe('storeDb.health.checks.NearSizeCap')
    expect(checkLabelKey('NoFullBackup')).toBe('storeDb.health.checks.NoFullBackup')
  })

  it('a check this bundle does not know shows the server\'s own word', () => {
    expect(checkLabelKey('ReplicaLagUnusual')).toBeNull()
    expect(checkLabelKey('toString')).toBeNull()
    expect(checkLabelKey('NoRecentBackup')).toBeNull()
  })
})

describe('a check that failed to run', () => {
  it('is the server’s level CheckFailed, not a flag', () => {
    expect(health.findings.filter(checkFailed).map((f) => f.check)).toEqual(['LastGoodCheckDb'])
    expect(checkFailed({ priority: 1, level: 'Critical', check: 'NearSizeCap', detail: 'd', fix: '' })).toBe(false)
  })
})

describe('healthCheckOf', () => {
  it('fills what the door leaves out, and nothing else', () => {
    expect(healthCheckOf({ findings: [{ priority: 1, level: 'Critical', check: 'X', detail: 'd' }] } as never)).toEqual({
      takenAt: null,
      findings: [{ priority: 1, level: 'Critical', check: 'X', detail: 'd', fix: null }],
    })
    expect(healthCheckOf({ findings: [{ priority: 1, level: 'High', check: 'X', detail: 'd', fix: '' }] } as never).findings[0].fix).toBeNull()
    expect(healthCheckOf(null)).toEqual({ takenAt: null, findings: [] })
  })
})
