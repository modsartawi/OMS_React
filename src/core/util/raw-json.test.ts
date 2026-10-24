/**
 * Tickets 478 / 556 — a raw webhook body is re-indented for reading without one value changing,
 * and a body that is not JSON is shown exactly as received.
 */
import { describe, expect, it } from 'vitest'
import { rawView } from './raw-json'

describe('rawView', () => {
  it('re-indents a body that parses', () => {
    expect(rawView('{"a":1,"b":[1,2],"c":{}, "d":[]}')).toEqual({
      text: '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ],\n  "c": {},\n  "d": []\n}',
      pretty: true,
    })
  })

  it('🚩 never alters a value: 1.10, a 20-digit number, an escape and spaces inside a string survive', () => {
    const body = '{"price":1.10,"id":12345678901234567890,"name":"\\u0041 b  \\"q\\" , : {"}'
    const { text, pretty } = rawView(body)
    expect(pretty).toBe(true)
    expect(text).toContain('"price": 1.10')
    expect(text).toContain('"id": 12345678901234567890')
    expect(text).toContain('"name": "\\u0041 b  \\"q\\" , : {"')
    // White space aside, the text is the body byte for byte.
    const strip = (s: string) => {
      let out = ''
      let inString = false
      for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (inString) {
          out += c
          if (c === '\\') out += s[++i]
          else if (c === '"') inString = false
        } else if (c === '"') {
          inString = true
          out += c
        } else if (!/\s/.test(c)) out += c
      }
      return out
    }
    expect(strip(text)).toBe(strip(body))
  })

  it('a body that does not parse is shown exactly as received', () => {
    expect(rawView('not json {')).toEqual({ text: 'not json {', pretty: false })
  })
})
