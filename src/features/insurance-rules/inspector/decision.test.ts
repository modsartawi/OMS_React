/**
 * Ticket 710 — an inspector reads a decision of any age: each fact's state and each hash outcome in words. A fact
 * that came back false or 0 is a value, not an unknown; a message is shown only under a check the screen understands.
 */
import { describe, expect, it } from 'vitest'
import { factReading, messageReading, messageText, replayReading } from './decision'

const fact = (o: Record<string, unknown>) => ({ key: 'claim.total', path: 'Claim.total.value', type: 'number', state: 'value', value: 12.5, ...o })

describe('a fact reads in words', () => {
  it('a typed value is shown exactly as logged; free text is isolated by its own script, a machine value ltr', () => {
    expect(factReading(fact({}))).toEqual({ state: 'value', text: '12.5', isolate: 'ltr' })
    expect(factReading(fact({ type: 'date', value: '2026-03-01' }))).toEqual({ state: 'value', text: '2026-03-01', isolate: 'ltr' })
    expect(factReading(fact({ type: 'text', value: 'بوبا العربية' }))).toEqual({ state: 'value', text: 'بوبا العربية', isolate: 'auto' })
  })

  it('zero and false are values, and a boolean is a word', () => {
    expect(factReading(fact({ value: 0 }))).toEqual({ state: 'value', text: '0', isolate: 'ltr' })
    expect(factReading(fact({ type: 'boolean', value: false }))).toEqual({ state: 'no' })
    expect(factReading(fact({ type: 'boolean', value: true }))).toEqual({ state: 'yes' })
  })

  it('unknown and unparsed are named, and never show a value', () => {
    expect(factReading(fact({ state: 'unknown', value: null }))).toEqual({ state: 'unknown' })
    expect(factReading(fact({ state: 'unparsed', value: 'garbage' }))).toEqual({ state: 'unparsed' })
  })

  it('a value state with no value, or a state the screen does not know, reads unknown', () => {
    expect(factReading(fact({ value: null }))).toEqual({ state: 'unknown' })
    expect(factReading(fact({ value: '' }))).toEqual({ state: 'unknown' })
    expect(factReading(fact({ state: 'later' }))).toEqual({ state: 'unknown' })
  })
})

describe('a message reads by its hash', () => {
  const reply = (o: Record<string, unknown>) => ({ source: 'kept', check: 'match', hash: 'aa', foundHash: 'aa', message: { resourceType: 'Bundle' }, ...o })

  it('says where it came from and whether it matches', () => {
    expect(messageReading(reply({})).words).toBe('kept.match')
    expect(messageReading(reply({ check: 'differs', foundHash: 'bb' })).words).toBe('kept.differs')
    expect(messageReading(reply({ source: 'refetched' })).words).toBe('refetched.match')
    expect(messageReading(reply({ source: 'refetched', check: 'differs', foundHash: 'bb' })).words).toBe('refetched.differs')
  })

  it('not found carries no message, and what it holds on to is the hash', () => {
    const r = messageReading(reply({ source: null, check: 'notFound', foundHash: null, message: null }))
    expect(r).toEqual({ words: 'notFound', check: 'notFound', body: null, hash: 'aa', foundHash: null })
  })

  it('a check it does not know, a message with no source, or a match with no message is never shown as verified', () => {
    for (const bad of [reply({ check: 'maybe' }), reply({ source: null }), reply({ source: 'cache' }), reply({ message: null }), reply({ message: '' })]) {
      const r = messageReading(bad)
      expect(r.check).toBe('notFound')
      expect(r.body).toBeNull()
    }
    expect(messageReading(null).check).toBe('notFound')
  })

  it('a differing message is still shown, with both hashes', () => {
    const r = messageReading(reply({ check: 'differs', foundHash: 'bb' }))
    expect(r.body).toEqual({ resourceType: 'Bundle' })
    expect([r.hash, r.foundHash]).toEqual(['aa', 'bb'])
  })

  it('the message is laid out as JSON, a string that is not JSON as it came', () => {
    expect(messageText({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(messageText('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(messageText('<xml/>')).toBe('<xml/>')
  })
})

describe('a replay', () => {
  it('reads same or different against what was decided', () => {
    expect(replayReading({ outcome: 'refuse', matches: true })).toEqual({ state: 'same', outcome: 'refuse' })
    expect(replayReading({ outcome: 'pass', matches: false })).toEqual({ state: 'different', outcome: 'pass' })
  })

  it('no replay, or none with an outcome, says it could not be replayed', () => {
    expect(replayReading(null)).toEqual({ state: 'none', outcome: null })
    expect(replayReading({ outcome: '', matches: true })).toEqual({ state: 'none', outcome: null })
  })
})
