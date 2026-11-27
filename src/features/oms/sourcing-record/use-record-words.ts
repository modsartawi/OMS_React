import { useTranslation } from 'react-i18next'
import { fsi } from '@/core/util/bidi'
import { formatMoney3 } from '@/core/util/number-format'

/**
 * A rate (a fraction) as a percent to two decimals, as the model reads it (review 2 #7): a machine value, isolated by
 * the caller (`Ltr`).
 */
export const percent = (rate: number | null | undefined): string => (typeof rate === 'number' ? `${(rate * 100).toFixed(2)}%` : '')

/**
 * The store record list's words (ticket 969). Codes the door sends (modes, measures, channels, bands, neutral reasons)
 * fall back to the code itself when the screen has no word for it yet.
 */
export function useRecordWords() {
  const { t } = useTranslation('sourcing-record')
  return {
    t,
    money: (v: number) => t('money', { amount: fsi(formatMoney3(v)) }),
    mode: (code: string) => t(`mode.${code}`, { defaultValue: code }),
    measure: (code: string) => t(`measure.${code}`, { defaultValue: code }),
    // The door sends the channel codes (`IOS`, `ROID`, `WEB`) and the categories as `category C` (BackOffice 4373).
    channel: (code: string) => t(`channel.${code.replace(/^category /, 'category_')}`, { defaultValue: code }),
    band: (code: string | null) => (code ? t(`band.${code}`, { defaultValue: code }) : ''),
    neutral: (code: string) => t(`neutral.${code}`, { defaultValue: code }),
  }
}
