/**
 * The scope control's rules (ticket 270, spec 267 D2) — **narrowed to what the
 * client still decides**, after ticket 274 moved the scoping onto the wire.
 *
 * 270 tested four things here: reading the scope out of a URL, degrading *mine* to
 * the estate for a session with no staff row, separating the three states over each
 * row's `assignment`, and never locking the widest one.
 *
 * 🔑 **Three of the four are now the server's**, and are not this file's to assert:
 *
 * - *mine* is resolved from the **session** against map 1153's assignment tables — a
 *   union of own-plus-one-level-reports over an org chart no client can see;
 * - the unassigned-accountant degradation is the door's own `1 = 1` fallback, and is
 *   **silent** (§B4) — the client can no longer detect it, so it can no longer test
 *   it;
 * - `assignment` is not on the wire, so there is no per-row state to separate.
 *
 * ⚠️ What survives is the URL grammar — and it matters more than it did, because the
 * value now goes **on the wire** rather than into a client-side filter. This is the
 * one place a scope string is normalised before the server sees it.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCOPE, readScope } from './scope'

describe('reading the scope out of a URL', () => {
  it('opens on MY BRANCHES when nothing says otherwise', () => {
    expect(readScope(null)).toBe(DEFAULT_SCOPE)
    expect(readScope('')).toBe('mine')
    expect(DEFAULT_SCOPE).toBe('mine')
  })

  it('takes all three states, and reads a hand-edited value as the default', () => {
    expect(readScope('unassigned')).toBe('unassigned')
    expect(readScope(' ALL ')).toBe('all')
    // Nothing a bad value could unlock — the scope is not a permission.
    expect(readScope('everything')).toBe('mine')
  })
})

/**
 * ⚠️ **Three describe blocks stood here until 274 and are gone**, with the exports
 * they covered: `resolveScope`, `hasAssignment`, `isInScope` and `branchesInScope`.
 * Each tested a decision the client no longer makes — see this file's header. The
 * rules themselves did not go away; they moved to the door, where *mine* can be
 * resolved against the assignment tables rather than guessed from an answer.
 */
