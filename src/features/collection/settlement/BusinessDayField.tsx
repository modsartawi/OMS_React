import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * **The business day a theft names** (ticket 339) — required, and a closed day of the
 * branch. Drawn by the post dialog, and by the change form for a theft's day-move
 * (ticket 349, spec 342 W4): one field, so the two cannot drift.
 *
 * ⚠️ **The browser's own date box, and no clock of this screen's.** It enforces the
 * shape the door takes (`yyyy-MM-dd`); whether the day is *closed* is the server's
 * rule, and its refusal is drawn here rather than in a toast, because this is the box
 * that fixes it. `whitespace-pre-line` for the reason the description's error has it:
 * the server's sentence is English, a newline, then Arabic.
 *
 * `testId` names the box (`data-region` and `data-testid`), its error `${testId}-error`.
 */
export default function BusinessDayField({
  value,
  onValue,
  error,
  label,
  hint,
  testId,
}: {
  value: string
  onValue: (next: string) => void
  error: string | null
  label: string
  hint: string
  testId: string
}) {
  const { t } = useTranslation('settlement')
  const errorId = useId()

  return (
    <label className="flex flex-col gap-1" data-region={testId}>
      <span className="text-xs font-medium">
        {label}
        <span className="ms-1.5 font-normal text-muted-foreground">{t('reasonField.required')}</span>
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-testid={testId}
        className={
          'h-9 rounded-md border bg-card px-2 text-sm tabular-nums outline-none focus:border-primary/60 ' +
          (error ? 'border-attention-border' : 'border-border')
        }
      />
      {error && (
        <span
          id={errorId}
          dir="auto"
          className="whitespace-pre-line text-xs text-attention-800"
          data-testid={`${testId}-error`}
        >
          {error}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  )
}
