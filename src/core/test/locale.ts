/**
 * Test-only: look a dotted key up in a locale bundle (`'history.columns.note'`), for the i18n tests that
 * prove every key the code builds has words. Not imported by app code.
 */

/** The node at a dotted key, or undefined. */
export const localeAt = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

/** Whether a dotted key is a string leaf (words), not missing and not a branch. */
export const hasLocaleKey = (bundle: unknown, key: string): boolean => typeof localeAt(bundle, key) === 'string'
