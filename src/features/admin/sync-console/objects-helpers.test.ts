import { describe, expect, it } from 'vitest'
import type { EnrolObjectResponse, PushObject } from '@/core/models/sync-console'
import {
  ENROL_REFUSALS,
  OBJECT_STATES,
  enrolPreviewSentence,
  enrolRefusalKey,
  objectCounts,
  objectState,
  objectStateBadge,
  visibleObjects,
} from './objects-helpers'
import en from '@/locales/en/sync-console.json'

const obj = (objectId: string, over: Partial<PushObject> = {}): PushObject => ({
  objectId,
  table: objectId,
  enrolled: false,
  storesEnrolled: 0,
  lineNumber: 7900,
  hqRows: 3,
  ...over,
})

// The IDF wave as the door lists it, with one legacy object enrolled and one without a number.
const WAVE: PushObject[] = [
  obj('Item', { enrolled: true, storesEnrolled: 412, lineNumber: 1, hqRows: 98000 }),
  obj('ItemVat', { lineNumber: null, hqRows: 40 }),
  obj('IdfPriorityMaster', { lineNumber: 7900 }),
  obj('IdfStoreList', { lineNumber: 7930, hqRows: 1 }),
  obj('IdfException', { lineNumber: 7960, hqRows: 4 }),
]

describe('objectState', () => {
  it('reads enrolled before anything else, then a missing line number', () => {
    expect(objectState(obj('A', { enrolled: true, lineNumber: null }))).toBe('enrolled')
    expect(objectState(obj('A', { lineNumber: null }))).toBe('noLine')
    expect(objectState(obj('A', { lineNumber: 7960 }))).toBe('ready')
  })

  it('offers Enrol only on a ready row (the contract: not enrolled and a line number)', () => {
    expect(WAVE.filter((o) => objectState(o) === 'ready').map((o) => o.objectId)).toEqual([
      'IdfPriorityMaster',
      'IdfStoreList',
      'IdfException',
    ])
  })
})

describe('objectStateBadge', () => {
  it('labels every state from the bundle, with a severity', () => {
    const states = (en.objects as { states: Record<string, string> }).states
    for (const s of OBJECT_STATES) {
      const badge = objectStateBadge(s)
      expect(badge.labelKey).toBe(`objects.states.${s}`)
      expect(states[s]).toBeTruthy()
      expect(['ok', 'go', 'warn', 'bad', 'mute']).toContain(badge.sev)
    }
  })
})

describe('visibleObjects', () => {
  it('opens on the objects still to enrol, in the door order', () => {
    expect(visibleObjects(WAVE, false).map((o) => o.objectId)).toEqual([
      'ItemVat',
      'IdfPriorityMaster',
      'IdfStoreList',
      'IdfException',
    ])
  })

  it('shows every object, still in the door order, when enrolled ones are asked for', () => {
    expect(visibleObjects(WAVE, true).map((o) => o.objectId)).toEqual(WAVE.map((o) => o.objectId))
  })

  it('never reorders or mutates the read', () => {
    const before = WAVE.map((o) => o.objectId)
    visibleObjects(WAVE, true).reverse()
    expect(WAVE.map((o) => o.objectId)).toEqual(before)
  })
})

describe('objectCounts', () => {
  it('counts every pushed object, the enrolled, and the waiting', () => {
    expect(objectCounts(WAVE)).toEqual({ total: 5, enrolled: 1, waiting: 4 })
    expect(objectCounts([])).toEqual({ total: 0, enrolled: 0, waiting: 0 })
  })
})

describe('enrolPreviewSentence', () => {
  const answer = (over: Partial<EnrolObjectResponse> = {}): EnrolObjectResponse => ({
    objectId: 'IdfException',
    lineNumber: 7960,
    blockStart: 88120401,
    blockEnd: 88120404,
    actionsMinted: 4,
    storesEnrolled: 1312,
    auditId: null,
    ...over,
  })

  it('names the rows, the stores, the line and the action block', () => {
    const s = enrolPreviewSentence(answer())
    expect(s.key).toBe('enrol.preview.rows')
    expect(s.values).toEqual({ count: 4, rows: '4', stores: '1,312', line: '7960', from: '88120401', to: '88120404' })
  })

  it('says an empty table only adds the counter rows, never "0 rows"', () => {
    const s = enrolPreviewSentence(answer({ objectId: 'IdfIngredientMapping', lineNumber: 7950, actionsMinted: 0, blockEnd: 88120400 }))
    expect(s.key).toBe('enrol.preview.empty')
    expect(s.values.line).toBe('7950')
  })

  it('has both sentences in the bundle, with plural forms for the rows', () => {
    const preview = (en as unknown as { enrol: { preview: Record<string, string> } }).enrol.preview
    expect(preview.rows_one).toBeTruthy()
    expect(preview.rows_other).toBeTruthy()
    expect(preview.empty).toBeTruthy()
  })
})

describe('enrolRefusalKey', () => {
  it('words every refusal the door can answer after the request shape, from the bundle', () => {
    const codes = (en as unknown as { enrol: { codes: Record<string, string> } }).enrol.codes
    for (const c of ENROL_REFUSALS) {
      expect(enrolRefusalKey(c)).toBe(`enrol.codes.${c}`)
      expect(codes[c]).toBeTruthy()
    }
  })

  it('leaves an unknown code to show alone', () => {
    expect(enrolRefusalKey('EXPLODE')).toBeNull()
    expect(enrolRefusalKey('REASON_REQUIRED')).toBeNull()
  })
})
