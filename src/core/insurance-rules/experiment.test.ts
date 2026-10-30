/**
 * Ticket 687 — the experiment codec: one versioned `.json` shape (v1) for the file, browser storage, 688's hand-off
 * and 689's lessons. Encode → decode is identical; a file that is not JSON, has no version, or a version this
 * playground does not know (an older unknown one or a newer one) is refused with its own code, never half-read.
 */
import { describe, expect, it } from 'vitest'
import {
  decodeExperiment,
  encodeExperiment,
  EXPERIMENT_FORMAT,
  EXPERIMENT_VERSION,
  experimentBody,
  experimentFileName,
  experimentFromBody,
  type PlaygroundExperiment,
} from './experiment'
import { PLAYGROUND_KINDS } from './playground'

const DOC = (kind: string) => ({ schema: 1, kind, revision: 0, fields: [], lists: [], rules: [{ id: 'R-1', when: [{ check: 'line', field: 'daysSupply', above: 90 }] }] })
const DATA = { request: { channel: 'nphies' }, lines: [{ line: 1, daysSupply: 120 }] }
const AS_OF = '2026-10-30T14:05:00'

const dataExperiment = (kind: PlaygroundExperiment['kind']): PlaygroundExperiment => ({ name: `Long supply ${kind}`, kind, asOf: AS_OF, data: DATA, document: DOC(kind) })
const RAW: PlaygroundExperiment = { name: 'صرف طويل', kind: 'guard', asOf: AS_OF, raw: '{"lines":[{"qty":2}', document: DOC('guard') }

const file = (over: Record<string, unknown>) => JSON.stringify({ format: EXPERIMENT_FORMAT, version: 1, name: 'x', kind: 'guard', asOf: AS_OF, data: {}, document: {}, ...over })

describe('experimentCodec — round trip', () => {
  it.each(PLAYGROUND_KINDS)('a %s experiment with data decodes to itself', (kind) => {
    const e = dataExperiment(kind)
    expect(decodeExperiment(encodeExperiment(e))).toEqual({ ok: true, experiment: e })
  })

  it('a raw experiment keeps its text as it is, even when it is not JSON, and carries no data', () => {
    const r = decodeExperiment(encodeExperiment(RAW))
    expect(r).toEqual({ ok: true, experiment: RAW })
    expect(r.ok && 'data' in r.experiment).toBe(false)
  })

  it('the file names its format and version 1', () => {
    const v = JSON.parse(encodeExperiment(RAW)) as Record<string, unknown>
    expect([v.format, v.version, EXPERIMENT_VERSION]).toEqual([EXPERIMENT_FORMAT, 1, 1])
  })
})

describe('experimentCodec — refusals, each with its own code', () => {
  it('malformed JSON', () => {
    expect(decodeExperiment('{ "format": ')).toEqual({ ok: false, code: 'malformed' })
    expect(decodeExperiment('')).toEqual({ ok: false, code: 'malformed' })
  })

  it('JSON that is not an experiment file', () => {
    expect(decodeExperiment('[1, 2]')).toEqual({ ok: false, code: 'notExperiment' })
    expect(decodeExperiment(JSON.stringify(DATA))).toEqual({ ok: false, code: 'notExperiment' })
    expect(decodeExperiment(file({ format: 'something.else' }))).toEqual({ ok: false, code: 'notExperiment' })
  })

  it('a missing version', () => {
    expect(decodeExperiment(file({ version: undefined }))).toEqual({ ok: false, code: 'noVersion' })
  })

  it('an unknown version, and a newer one', () => {
    for (const version of [0, -1, 1.5, '1', null]) expect([version, decodeExperiment(file({ version }))]).toEqual([version, { ok: false, code: 'unknownVersion' }])
    expect(decodeExperiment(file({ version: 2 }))).toEqual({ ok: false, code: 'newerVersion' })
  })

  it('a v1 file whose fields do not hold is refused whole, never half-loaded', () => {
    const bad = [
      { name: '' },
      { name: '   ' },
      { kind: 'formula' },
      { asOf: '2026-10-30T14:05:00Z' },
      { asOf: 7 },
      { document: [1] },
      { document: undefined },
      { data: [1] },
      { data: undefined },
      { raw: 'text' }, // both data and raw
      { data: undefined, raw: 5 },
    ]
    for (const over of bad) expect([over, decodeExperiment(file(over))]).toEqual([over, { ok: false, code: 'invalid' }])
  })

  it('the name is trimmed', () => {
    const r = decodeExperiment(file({ name: '  Mine  ' }))
    expect(r.ok && r.experiment.name).toBe('Mine')
  })
})

describe('the experiment → the door and the file name', () => {
  it('experimentBody sends exactly one of data | raw', () => {
    expect(experimentBody(dataExperiment('coverage'))).toEqual({ kind: 'coverage', data: DATA, document: DOC('coverage'), asOf: AS_OF })
    expect(experimentBody(RAW)).toEqual({ kind: 'guard', raw: RAW.raw, document: DOC('guard'), asOf: AS_OF })
  })

  it('experimentFromBody is experimentBody undone, with the name', () => {
    for (const e of [dataExperiment('category'), RAW]) expect(experimentFromBody(` ${e.name} `, experimentBody(e))).toEqual(e)
  })

  it('experimentFileName is <name>.json with the characters a file name cannot hold replaced', () => {
    expect(experimentFileName('Long supply')).toBe('Long supply.json')
    expect(experimentFileName(' a/b:c*?"<>|d ')).toBe('a-b-c------d.json')
    expect(experimentFileName('صرف طويل')).toBe('صرف طويل.json')
  })
})
