import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { REASON_MAX, type ReasonCheck } from '@/core/reason/reason'
import Ltr from '@/core/ui/Ltr'
import { formatCount, fsi } from '@/core/util/bidi'
import { DOC_TYPE_CONFIG_ERRORS } from './api'

/**
 * The required reason every configuration write carries (spec 3148), with its counter (the core 1-200 rule) — ONE
 * component for every dialog of the area. Invalid when too long, or when the server refused the save for having none
 * (`SDC-00002`). `attr` names the textarea's `data-<attr>` (and the counter's `data-<attr>-count`) for the drives.
 */
export default function ReasonField({
  value,
  reason,
  disabled,
  errorCode,
  onChange,
  attr,
  rows = 3,
}: {
  value: string
  reason: ReasonCheck
  disabled: boolean
  /** The save's refusal code, if any. */
  errorCode: string | null
  onChange: (text: string) => void
  attr: string
  rows?: number
}) {
  const { t } = useTranslation('doc-type-config')
  const invalid = reason.problem === 'tooLong' || errorCode === DOC_TYPE_CONFIG_ERRORS.reasonRequired
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-medium">
        <span className="flex items-baseline justify-between gap-2">
          {t('reason.label')}
          <span
            className={'font-normal tabular-nums ' + (reason.problem === 'tooLong' ? 'text-danger-800' : 'text-muted-foreground')}
            {...{ [`data-${attr}-count`]: '' }}
          >
            <Ltr>{formatCount(reason.length, REASON_MAX)}</Ltr>
          </span>
        </span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          required
          disabled={disabled}
          dir="auto"
          aria-invalid={invalid || undefined}
          className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
          {...{ [`data-${attr}`]: '' }}
        />
        <span className="font-normal text-muted-foreground">{t('reason.hint')}</span>
      </label>
      {reason.problem === 'tooLong' && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('reason.tooLong', { max: fsi(String(REASON_MAX)) })}
        </p>
      )}
    </>
  )
}
