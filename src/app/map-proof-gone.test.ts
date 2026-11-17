/**
 * The map panel's development proof page (879) is gone (883, BackOffice spec 3630): the real report print page, with a
 * map block, takes its place in the local PDF proof. Read from the router's source: importing the router pulls every
 * screen into a node test run.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const here = path.resolve(__dirname)

describe('the map proof page', () => {
  it('is no longer a route, and its page and drive are gone', () => {
    const router = readFileSync(path.join(here, 'router.tsx'), 'utf8')
    expect(router).not.toMatch(/map-proof/i)
    expect(router).not.toMatch(/MapProofPage/)
    expect(existsSync(path.join(here, 'MapProofPage.tsx'))).toBe(false)
    expect(existsSync(path.join(here, '..', '..', 'tools', 'map-proof-drive.mjs'))).toBe(false)
  })
})
