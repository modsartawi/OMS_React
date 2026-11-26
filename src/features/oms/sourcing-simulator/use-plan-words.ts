import { useTranslation } from 'react-i18next'
import type { Bilingual } from '@/core/models/sourcing-run'
import { fsi } from '@/core/util/bidi'
import { formatMoney3 } from '@/core/util/number-format'

/**
 * The simulator's ways of putting the reply's figures into words (ticket 962). Amounts are riyals to three decimals as
 * sent (4281 decision 19), km to one. A value interpolated into a sentence is isolated whole (`fsi`, the bidi rule).
 * A server sentence is picked in the screen's language, English when the Arabic is missing.
 */
export function usePlanWords() {
  const { t, i18n } = useTranslation('sourcing-simulator')
  const ar = i18n.language?.split('-')[0] === 'ar'
  return {
    t,
    ar,
    money: (v: number | null | undefined) => (typeof v === 'number' ? t('money', { amount: fsi(formatMoney3(v)) }) : t('dash')),
    km: (v: number | null | undefined) => (typeof v === 'number' ? t('card.km', { km: fsi(v.toFixed(1)) }) : t('dash')),
    mode: (code: string) => t(`mode.${code}`, { defaultValue: code }),
    goal: (code: string) => t(`goal.${code}`, { defaultValue: code }),
    /** A server sentence in the screen's language. */
    said: (x: Bilingual) => (ar ? x.ar || x.en : x.en),
    /** The same sentence in the other language, shown beside it on a card. */
    other: (x: Bilingual) => (ar ? x.en : x.ar),
  }
}
