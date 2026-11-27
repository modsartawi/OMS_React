import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'

/**
 * The advisor's code words (BO 4393 `Results/Codes`, the same list as `Advise/Codes`, under the view grant): every code
 * the results doors send, worded in English and Arabic. The page words a code in its own words where it has them, else
 * in the server's (data: isolated as free text), else shows the code itself (a machine value).
 */
export function useCodeWords(): (family: string, code: string) => string | null {
  const { i18n } = useTranslation('sourcing-results')
  const codes = useQuery({ queryKey: ['sourcing-results', 'codes'], queryFn: sourcingResultsApi.codes, staleTime: Infinity, retry: false })
  const byKey = useMemo(() => new Map((codes.data ?? []).map((c) => [`${c.family}|${c.code}`, c])), [codes.data])
  const arabic = i18n.language.startsWith('ar')
  return (family, code) => {
    const c = byKey.get(`${family}|${code}`)
    return c ? (arabic && c.ar) || c.en : null
  }
}

/** A code in words: the page's key if it has one, else the server's words, else the code. */
export function Word({ k, family, code }: { k?: string; family: string; code: string }) {
  const { t, i18n } = useTranslation('sourcing-results')
  const words = useCodeWords()
  if (k && i18n.exists(k, { ns: 'sourcing-results' })) return <>{t(k)}</>
  const server = words(family, code)
  if (server) return <bdi>{server}</bdi>
  return <Ltr>{code}</Ltr>
}

/** The same, for a string-only sink (`title`, `<option>`, a `t()` value): data isolated with `fsi`. */
export function useWordString(): (family: string, code: string, k?: string) => string {
  const { t, i18n } = useTranslation('sourcing-results')
  const words = useCodeWords()
  return (family, code, k) => {
    if (k && i18n.exists(k, { ns: 'sourcing-results' })) return t(k)
    return fsi(words(family, code) ?? code)
  }
}
