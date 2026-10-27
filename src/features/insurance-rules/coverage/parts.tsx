import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { CodeInput } from '@/core/insurance-rules/controls'
import type { CoverageEffect } from '@/core/insurance-rules/coverage-model'
import StatusBadge from '@/core/ui/StatusBadge'
import { payerMark } from './ruleset-edit'

// The Insurers / Categories / Coverage screens' own pieces (oms 617): codes typed comma-separated and the payer
// mark every coverage value carries. The controls, denied card and loading line are the area's (core/insurance-rules).


const parseCodes = (text: string): string[] =>
  text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

/** Codes typed comma-separated: the text is kept as typed, the condition gets the codes. */
export function CodesInput({ value, onCodes, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string[]; onCodes: (c: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  useEffect(() => {
    if (parseCodes(text).join(',') !== value.join(',')) setText(value.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(',')])
  return (
    <CodeInput
      {...rest}
      value={text}
      onValue={(s) => {
        setText(s)
        const codes = parseCodes(s)
        if (codes.join(',') !== value.join(',')) onCodes(codes)
      }}
    />
  )
}

/** "Fills what the payer left out" or "Overrides the payer" — shown on every coverage value (3146). */
export function PayerMark({ effect }: { effect: Pick<CoverageEffect, 'overridesPayer'> }) {
  const { t } = useTranslation('insurance-coverage')
  const mark = payerMark(effect)
  return (
    <span data-payer-mark={mark} title={t(`payerMark.${mark}Hint`)}>
      <StatusBadge sev={mark === 'overrides' ? 'warn' : 'mute'}>{t(`payerMark.${mark}`)}</StatusBadge>
    </span>
  )
}
