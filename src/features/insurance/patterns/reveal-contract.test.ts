/**
 * Oms 923 — a source contract on the reveal. Ticket 923: the patient key and member id "are held in component state,
 * never cached by the query client, never written to the URL, local storage or logs, and cleared when the dialog
 * closes". React Testing Library is not installed (spec 083), so the component's promise is held here at its source,
 * and proven on the running app by `tools/insurance-patterns-reveal-drive.mjs`, which reads the query and mutation
 * caches, storage, the address and the console back after a reveal and after closing.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const here = new URL('./', import.meta.url)
const source = (name: string) => readFileSync(new URL(name, here), 'utf8')

/** The code without its comments: a doc comment that names a thing is not using it. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the reveal dialog holds the patient in its own state', () => {
  const dialog = code(source('RevealPatient.tsx'))

  it('calls the door itself and keeps the answer in useState (the scan sees the file)', () => {
    expect(dialog).toContain('patternsApi.reveal(')
    expect(dialog).toMatch(/\buseState\b/)
  })

  it('never through the query client: no query or mutation hook, no client', () => {
    expect(dialog).not.toMatch(/@tanstack\/react-query|\buse(Suspense)?(Query|Queries|InfiniteQuery|Mutation|QueryClient)\b/)
  })

  it('never into the address, storage, a log or a toast', () => {
    const sinks = [
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
      /\bdocument\.cookie\b/,
      /\bconsole\./,
      /\bsonner\b/,
      /\btoast\b/,
      /\buseSearchParams\b/,
      /\buseNavigate\b/,
      /\bnavigate\(/,
      /\bhistory\./,
      /\blocation\./,
    ]
    for (const sink of sinks) expect([String(sink), sink.test(dialog)]).toEqual([String(sink), false])
  })
})

describe('the patient is named in the reveal alone', () => {
  it('no other file of the feature reads a patient key or a member id', () => {
    const others = readdirSync(here).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'reveal.ts' && f !== 'RevealPatient.tsx')
    expect(others).toEqual(expect.arrayContaining(['api.ts', 'wire.ts', 'PatternCasePage.tsx']))
    expect(others.filter((f) => /\b(patientKey|memberId)\b/.test(code(source(f))))).toEqual([])
  })
})
