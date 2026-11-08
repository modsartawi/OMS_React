/**
 * A bilingual record's name in the UI language: `nameAr` under any `ar*` language, `nameEn` otherwise,
 * falling back to the other name when that one is blank (absent, empty or whitespace); `''` when both are.
 *
 * The picked name is returned **as stored** — no trim, no digit folding (loyalty groups show Arabic names
 * as stored). A caller that wants the name trimmed trims the result.
 */
export interface BilingualName {
  nameEn?: string | null
  nameAr?: string | null
}

const blank = (s: string | null | undefined): boolean => (s ?? '').trim() === ''

export function localizedName(names: BilingualName, lang: string | null | undefined): string {
  const [first, other] = (lang ?? '').startsWith('ar') ? [names.nameAr, names.nameEn] : [names.nameEn, names.nameAr]
  if (!blank(first)) return first!
  return blank(other) ? '' : other!
}
