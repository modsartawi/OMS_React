import { useTranslation } from 'react-i18next'

import { removalFieldClass } from './profile-controls'

/**
 * The **case reference** field, as both **contact removals** ask for it (tickets
 * 306 and 307).
 *
 * 🚩 **One field, because it is one promise.** ADR 0002 makes the reference the
 * whole of a removal's *why* — the removed value is recorded nowhere — so what it
 * is called, what it hints at, and what it refuses have to be the same on both
 * commands. Two copies would let the email removal ask for a *case reference* and
 * the mobile removal ask for something subtly else, and an auditor reading the
 * trail would have no way to tell which of the two a row came from.
 *
 * 🚩 **Labelled *case reference*, never *notes*.** An analyst can still type a
 * phone number into it and it will render on the Actions tab for every holder of
 * the read grant; no code can prevent that. The label and the hint are the only
 * levers the screen has, which is exactly why they live in one place.
 */
export default function CaseReferenceField({
  id,
  value,
  onChange,
  disabled,
  /** The over-long sentence, already worded, or null. */
  problem,
  testId,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  disabled: boolean
  problem?: string | null
  testId: string
}) {
  const { t } = useTranslation('loy')

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        {t('profile.caseReference.label')}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        placeholder={t('profile.caseReference.placeholder')}
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={removalFieldClass(!!problem)}
        data-testid={testId}
      />
      <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
        {t('profile.caseReference.hint')}
      </p>
      {/* 🚩 Said against the field that caused it — which is the half of the
          message `removalProblem` carries as data, so the placement is a rule
          under vitest rather than a JSX branch nothing can reach. */}
      {problem && (
        <p role="alert" className="text-[11px] text-danger-800">
          {problem}
        </p>
      )}
    </div>
  )
}
