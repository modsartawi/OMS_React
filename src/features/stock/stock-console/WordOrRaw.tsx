import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'

/** A value the console says in its words when it knows it (a locale key), or as it came. The pure modules return these. */
export type Worded = { key: string } | { raw: string }

/** The words as one string, for a string-only sink (a grid's value formatter, which the base cell isolates). */
export const wordText = (t: TFunction, word: Worded): string => ('key' in word ? t(word.key) : word.raw)

/**
 * A known value in the console's words; an unknown one as it came, isolated by its kind (`bidi`): a code — a state, a
 * stage, a mark, a feed — left to right (`'code'`, the default), free text in its own direction (`'text'`).
 */
export default function WordOrRaw({ word, kind = 'code' }: { word: Worded; kind?: 'code' | 'text' }) {
  const { t } = useTranslation('stock-console')
  if ('key' in word) return <>{t(word.key)}</>
  return kind === 'code' ? <Ltr>{word.raw}</Ltr> : <bdi>{word.raw}</bdi>
}
