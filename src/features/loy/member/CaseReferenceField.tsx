import { useTranslation } from 'react-i18next'

import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

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
    <Field
      id={id}
      label={t('profile.caseReference.label')}
      hint={t('profile.caseReference.hint')}
      // 🚩 Said against the field that caused it — which is the half of the
      // message `removalProblem` carries as data, so the placement is a rule
      // under vitest rather than a JSX branch nothing can reach.
      error={problem ? <span role="alert">{problem}</span> : undefined}
    >
      <Input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        placeholder={t('profile.caseReference.placeholder')}
        className="w-full"
        data-testid={testId}
      />
    </Field>
  )
}
