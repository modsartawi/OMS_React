import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { saysIn } from '@/core/rules/sentence'
import { formatPair } from '@/core/util/bidi'
import type { GuardReasonCode } from '@/core/insurance-rules/guard-check'

// Small pieces both pages of the Review feature draw (ticket 614).


/** A reason code with its words, `code · words`, one isolate (a pair led by a machine value). */
export function ReasonText({ code, reasons }: { code: string | null; reasons: readonly GuardReasonCode[] | undefined }) {
  const { i18n } = useTranslation()
  if (!code) return null
  const word = reasons?.find((r) => r.code === code)
  const words = word ? saysIn(word, i18n.language) : ''
  return (
    <span data-reason={code}>
      <Ltr>{formatPair(code, words)}</Ltr>
    </span>
  )
}

/** A machine value (store, pharmacist, patient key, item code): isolated, monospaced. */
export function Code({ value, hook }: { value: string; hook?: string }) {
  return (
    <span className="font-mono text-[12px]" {...(hook ? { [`data-${hook}`]: '' } : {})}>
      <Ltr>{value}</Ltr>
    </span>
  )
}
