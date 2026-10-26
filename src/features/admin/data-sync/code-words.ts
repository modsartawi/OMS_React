/**
 * The Data sync screen's ONE "code → word, else the raw code" idiom (review fix, 2026-10-24). A
 * machine code from the door (mode, status, phase, strategy, kind, …) shows as its word when this
 * bundle has one under `<prefix>.<code>`; a code newer than the bundle shows as itself — never an
 * invented word, never a raw key. Three sinks, three spellings:
 *
 * - `codeWord` — the word or `null` (the JSX `<CodeWord>` isolates the raw fallback in `Ltr`);
 * - `codeText` — a grid `valueFormatter`: word or bare code (the grid base isolates its cells, and
 *   `fsi` must never reach a cell, Ctrl+C or an export);
 * - `codeValue` — a string sink (a toast, a `t()` interpolation): word or the code under `fsi`.
 *
 * No React — pinned by `code-words.test.ts`.
 */
import { fsi } from '@/core/util/bidi'

/** The slice of `t` this needs: a key and a `defaultValue`. */
export type WordLookup = (key: string, opts?: { defaultValue?: string }) => string

/** The word for `code` under `prefix`, or `null` when the bundle has none. */
export function codeWord(t: WordLookup, prefix: string, code: string): string | null {
  return t(`${prefix}.${code}`, { defaultValue: '' }) || null
}

/** For a grid value: the word, else the bare raw code. */
export const codeText = (t: WordLookup, prefix: string, code: string): string => codeWord(t, prefix, code) ?? code

/** For a string-only sink: the word, else the raw code isolated whole (`fsi`). */
export const codeValue = (t: WordLookup, prefix: string, code: string): string => codeWord(t, prefix, code) ?? fsi(code)
