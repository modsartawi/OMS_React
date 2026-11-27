/**
 * The command center's language (oms 946, BackOffice spec 4165 "English and Arabic with a switch; Arabic is right to
 * left"; decisions §3): page-only. The language lives in the URL (`?lang=en|ar`), so a link and Back keep it; the page's
 * own words come from a translator fixed to it (`i18n.getFixedT`), and the page root carries `dir`. The app's chrome
 * (rail, top bar) stays English and left to right. The server writes the brief in the asked language: the page
 * translates none of it. The profiles (948, 949) read the language the same way. The URL's language is read and its
 * direction named in core (`langOf`, `dirOf` in `@/core/command-center-routes`), which the copilot reads too.
 */
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { langOf } from '@/core/command-center-routes'
import i18n from '@/core/i18n'
import type { CcLang } from '@/core/models/command-center'

export const NS = 'command-center'

/** The same URL in another language, every other parameter kept (a scorecard open, a filter). */
export const withLang = (params: URLSearchParams, lang: CcLang): URLSearchParams => {
  const next = new URLSearchParams(params)
  next.set('lang', lang)
  return next
}

/** Where the language switch goes when `option` is chosen on a page in `current`: nowhere (null) for the pressed one. */
export const langSwitchTarget = (params: URLSearchParams, current: CcLang, option: CcLang): URLSearchParams | null =>
  option === current ? null : withLang(params, option)

/** The page language, its fixed translator and the switch. */
export function useCcLang() {
  const [params, setParams] = useSearchParams()
  const lang = langOf(params.get('lang'))
  const t = useMemo(() => i18n.getFixedT(lang, NS), [lang])
  const setLang = (option: CcLang) => {
    const next = langSwitchTarget(params, lang, option)
    if (next) setParams(next, { replace: true })
  }
  return { lang, t, setLang }
}

export type CcT = ReturnType<typeof useCcLang>['t']

/** What every command center page is handed by its frame. */
export type CcPageLang = ReturnType<typeof useCcLang>
