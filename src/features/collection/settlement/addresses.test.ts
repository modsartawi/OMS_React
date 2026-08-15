/**
 * This screen's URL grammar (ticket 270, re-cut to paths by 283).
 *
 * 🚩 The rule worth a test: **every link keeps the scope and drops the view.** The
 * defect it pins is quiet and expensive — an accountant who widened to the estate,
 * opened a branch and came back would find the ageing count had fallen from 140 to
 * 47, with nothing on screen to explain it, because a hand-written `?store=0142`
 * replaces the whole query string.
 *
 * 🔑 And 283's own rule, tested twice over: **a path segment names which screen; a
 * parameter names what that screen is looking at** — so the builders return
 * `path?search`, and every address written under the old `?view=` grammar still
 * lands where it meant to.
 */
import { describe, expect, it } from 'vitest'
import {
  branchSearch,
  doorSearch,
  isOverviewPath,
  legacyViewRedirect,
  openSearch,
  readBatch,
  readQuery,
  readStore,
  scopeSearch,
  uploadSearch,
  writeQuery,
} from './addresses'

const params = (search: string) => new URLSearchParams(search)

const DOOR = '/collection/settlement'
const OPEN = '/collection/settlement/open'
const LEDGER = '/collection/settlement/ledger'
const UPLOAD = '/collection/settlement/upload'

describe('🚩 every link keeps the scope', () => {
  it('carries a widened scope into a branch account', () => {
    expect(branchSearch(params('scope=all&q=0142'), '0142')).toBe(`${DOOR}?scope=all&store=0142`)
  })

  it('carries it back out to the door, and drops what took the reader away', () => {
    expect(doorSearch(params('scope=all&store=0142'))).toBe(`${DOOR}?scope=all`)
    expect(doorSearch(params('scope=unassigned&batch=01J9B'))).toBe(`${DOOR}?scope=unassigned`)
  })

  it('moves the scope without disturbing what the screen is looking at', () => {
    const widened = new URL(scopeSearch(params('batch=01J9B'), 'all', UPLOAD), 'http://x')
    expect(widened.pathname).toBe(UPLOAD)
    expect(widened.searchParams.get('batch')).toBe('01J9B')
    expect(widened.searchParams.get('scope')).toBe('all')
    // ...and the default is the ABSENCE of the parameter, on the screen you are on.
    expect(scopeSearch(params('scope=all'), 'mine', DOOR)).toBe(DOOR)
  })

  it('leaves the DEFAULT scope out of the address entirely', () => {
    // The plain route and *my branches* are one address, not two spellings of one.
    expect(doorSearch(params(''))).toBe(DOOR)
    expect(branchSearch(params(''), '0331')).toBe(`${DOOR}?store=0331`)
  })
})

/**
 * 283 — the four screens are **paths**, and every builder names one.
 *
 * ⚠️ Absolute, deliberately: a relative `?scope=all` link out of the ledger would
 * land back on the ledger, so a builder that omitted the path would be correct only
 * from the one address this screen used to have.
 */
describe('🔑 the four screens are addresses, and every builder names one', () => {
  it('names its own path and keeps only the scope', () => {
    const busy = params('scope=all&q=Nakheel&store=0455&status=OPEN&tab=owed')
    expect(doorSearch(busy)).toBe(`${DOOR}?scope=all`)
    expect(openSearch(busy)).toBe(`${OPEN}?scope=all`)
    expect(uploadSearch(busy)).toBe(`${UPLOAD}?scope=all`)
    expect(uploadSearch(busy, '01J9BATCH')).toBe(`${UPLOAD}?scope=all&batch=01J9BATCH`)
  })

  it('writes no bare ? when there is nothing to say', () => {
    expect(openSearch(params(''))).toBe(OPEN)
    expect(uploadSearch(params(''))).toBe(UPLOAD)
  })

  it('drops the search, the leftover filters and yesterday’s view flag', () => {
    const busy = params('scope=all&q=Nakheel&view=batch&batch=01J9B&branch=0455&status=OPEN')
    const next = new URL(branchSearch(busy, '0142'), 'http://x')
    for (const key of ['q', 'view', 'batch', 'branch', 'kind', 'status'])
      expect(next.searchParams.get(key)).toBeNull()
    expect(next.pathname).toBe(DOOR)
    expect(next.searchParams.get('store')).toBe('0142')
    expect(next.searchParams.get('scope')).toBe('all')
  })
})

/**
 * ⚠️ Which screen is the Overview — the one address with two faces, and therefore the
 * one the shared chrome has to recognise. A trailing slash is the same address, and a
 * comparison that missed it would draw the door with no scope control above it and a
 * *back to the door* link pointing at the door.
 */
describe('the Overview is the only screen with two faces', () => {
  it('recognises itself with or without a trailing slash, and nothing else', () => {
    expect(isOverviewPath(DOOR)).toBe(true)
    expect(isOverviewPath(`${DOOR}/`)).toBe(true)
    expect(isOverviewPath(OPEN)).toBe(false)
    expect(isOverviewPath(LEDGER)).toBe(false)
    expect(isOverviewPath(UPLOAD)).toBe(false)
    expect(isOverviewPath('/collection/settlements')).toBe(false)
  })
})

describe('reading the address', () => {
  it('reads a branch, and treats an empty one as no branch', () => {
    expect(readStore(params('store=0142'))).toBe('0142')
    expect(readStore(params('store=  '))).toBe('')
    expect(readStore(params(''))).toBe('')
  })

  it('writes a query, and REMOVES it rather than leaving ?q= behind', () => {
    expect(writeQuery(params('scope=all'), 'Nakheel').toString()).toBe('scope=all&q=Nakheel')
    expect(writeQuery(params('scope=all&q=Nakheel'), '').toString()).toBe('scope=all')
    expect(readQuery(params('q=Nakheel'))).toBe('Nakheel')
  })

  /**
   * 🚩 The batch is reachable an hour and a reload later because it is an **address**,
   * not state inside the dialog that committed it (273).
   *
   * ⚠️ And 283 dissolved the both-halves rule: `?batch=` is read on the upload path
   * and by nobody else, so the id no longer needs a second parameter vouching for it.
   */
  it('reads the batch id as a plain parameter, trimmed', () => {
    expect(readBatch(params('batch=01J9B'))).toBe('01J9B')
    expect(readBatch(params('batch= 01J9B '))).toBe('01J9B')
    expect(readBatch(params('batch=  '))).toBe('')
    expect(readBatch(params(''))).toBe('')
  })
})

/**
 * ⚠️ The compatibility shim (283, kept indefinitely).
 *
 * 🚩 Table-driven over every legacy address that can be typed, **including the
 * hand-edited half-addresses**, because the ones a reader edits by hand are exactly
 * the ones no builder ever produced and no author thought about.
 */
describe('⚠️ every legacy ?view= address redirects to its path', () => {
  const cases: [string, string, string | null][] = [
    ['the plain ledger', `${DOOR}?view=ledger`, LEDGER],
    [
      'the ledger, criteria and all, carried through untouched',
      `${DOOR}?scope=all&view=ledger&status=OPEN&store=0142&entry=143&from=2026-03-01`,
      `${LEDGER}?scope=all&status=OPEN&store=0142&entry=143&from=2026-03-01`,
    ],
    [
      'a ledger address whose criteria were emptied by hand',
      `${DOOR}?view=ledger&store=&batch=`,
      `${LEDGER}?store=&batch=`,
    ],
    ['273’s shareable batch withdrawal', `${DOOR}?view=batch&batch=01J9B`, `${UPLOAD}?batch=01J9B`],
    [
      'a batch withdrawal at a widened scope',
      `${DOOR}?scope=all&view=batch&batch=01J9B`,
      `${UPLOAD}?scope=all&batch=01J9B`,
    ],
    // 🚩 …stays on the door, which is exactly where it landed before 283. The
    // both-halves rule is dead as *grammar*, but a truncated WITHDRAWAL link must not
    // hand its reader a form for POSTING a month of entries — the opposite act.
    ['a half-address: ?view=batch with no batch', `${DOOR}?view=batch`, null],
    ['a half-address: ?view=batch&batch= emptied by hand', `${DOOR}?view=batch&batch=`, null],
    // …and the other half is not a redirect at all: a leftover `?batch=` is a
    // parameter no view on the Overview reads.
    ['a half-address: ?batch= with no view', `${DOOR}?batch=01J9B`, null],
    ['an unrecognised view is not a screen', `${DOOR}?view=other`, null],
    ['an ordinary Overview address', `${DOOR}?scope=all&q=Nakheel`, null],
    // 🚩 269's addresses — by far the most-pasted on this screen — are UNMOVED, and
    // the test says so rather than leaving it to be inferred from an absence.
    ['269’s branch account, which never moved', `${DOOR}?store=0142&entry=143`, null],
    // Only the Overview could ever carry the old grammar; a stray `?view=` typed onto
    // one of the new paths is a parameter nobody reads, not a redirect loop.
    ['a stray ?view= on a new path', `${LEDGER}?view=batch&status=OPEN`, null],
    ['a stray ?view= on the lane', `${OPEN}?view=ledger`, null],
  ]

  for (const [name, from, expected] of cases) {
    it(name, () => {
      const url = new URL(from, 'http://x')
      expect(legacyViewRedirect(url.pathname, url.searchParams)).toBe(expected)
    })
  }

  it('treats a trailing slash as the same address', () => {
    expect(legacyViewRedirect(`${DOOR}/`, params('view=ledger'))).toBe(LEDGER)
  })

  it('never redirects to an address that would redirect again', () => {
    for (const [, from] of cases) {
      const url = new URL(from, 'http://x')
      const once = legacyViewRedirect(url.pathname, url.searchParams)
      if (!once) continue
      const then = new URL(once, 'http://x')
      expect(legacyViewRedirect(then.pathname, then.searchParams)).toBeNull()
    }
  })
})
