/**
 * The help's language (oms 951–954, BackOffice spec 4182; orchestrator decision 2): ONE helper every help surface reads
 * — the page, the drawer, the print page, the copilot's how-to row, the capture script's expectations.
 *
 * Arabic when the app's i18next language is Arabic, OR when the page boots right-to-left (`oms.locale = 'ar'`, read by
 * `index.html` into `<html dir>`, `@/core/theme/direction`). Today the app's i18n is pinned to `en` and Arabic only flips
 * the direction; the owner wants the Arabic guide readable now, and this stays right once Arabic chrome ships.
 */
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { bootDirection, type Direction } from '@/core/theme/direction'
import type { HelpLang } from '@/core/models/help'

/** Pure: the help language for an i18next language and a page direction. */
export function helpLangOf(language: string | undefined, direction: Direction): HelpLang {
  return (language ?? '').toLowerCase().startsWith('ar') || direction === 'rtl' ? 'ar' : 'en'
}

/** The help language now, outside React (a query function, a script). */
export function helpLang(): HelpLang {
  return helpLangOf(i18n.language, bootDirection)
}

/** The help language in a component — re-renders when i18next changes language. */
export function useHelpLang(): HelpLang {
  const { i18n: instance } = useTranslation()
  return helpLangOf(instance.language, bootDirection)
}

/** The writing direction of a help language. */
export const helpDir = (lang: HelpLang): Direction => (lang === 'ar' ? 'rtl' : 'ltr')
