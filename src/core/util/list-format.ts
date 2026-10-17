/**
 * A list of words as one sentence part, in the reader's language: "a, b and c" in English, the
 * Arabic list comma and "و" in Arabic. A list is copy, so its separator is never a literal `', '`
 * (i18n-zero-literal; spec 2737 standards review, ticket 503).
 */
export function listText(items: readonly string[], lang: string): string {
  return new Intl.ListFormat(lang, { type: 'conjunction' }).format(items)
}
