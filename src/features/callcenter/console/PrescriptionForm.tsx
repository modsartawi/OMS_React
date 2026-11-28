/**
 * The prescription section (ticket 1008, spec 1006 D4) — the patient's ID and the reference on a
 * Wasfaty or Nphies order, committed with `setPrescription`.
 *
 * - **Committed on blur or Enter**, never by a *Save* button: the agent is typing what the caller
 *   reads out. A blur sends only a whole pair (`prescriptionCommit`), so tabbing from the ID to an
 *   empty reference earns no refusal for the box the agent has not reached yet.
 * - **The ID box keeps digits only, ten at most** (`filterPatientId`). Whether ten is right is the
 *   server's to say: `PATIENT_ID_INVALID` is worded under the ID, `REFERENCE_REQUIRED` under the
 *   reference.
 * - **What was typed survives a switch.** The form stays mounted on every type and only its
 *   section is hidden on a phone order, so a draft the agent has not committed yet is still there
 *   when the order switches back (D10). What the order holds wins whenever it changes.
 */
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { OrderType, SessionHeader } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ChipSection from './ChipSection'
import { NOTE } from './console-notes'
import {
  filterPatientId,
  prescriptionCommit,
  prescriptionOf,
  referenceLabelKey,
  type PrescriptionDraft,
} from './prescription'

export interface PrescriptionApply {
  busy: boolean
  /** The last commit's failure, worded by the page; `field` places it under its box. */
  error: { field: 'patientId' | 'reference' | null; text: string } | null
  onCommit: (draft: PrescriptionDraft) => void
}

export default function PrescriptionForm({
  open,
  orderType,
  header,
  apply,
  onClose,
}: {
  open: boolean
  orderType: OrderType
  header: SessionHeader
  apply: PrescriptionApply
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const held = prescriptionOf(header)
  const [draft, setDraft] = useState<PrescriptionDraft>(held)

  // What the order holds wins when it changes (a commit, a resume); an empty field on the order
  // never wipes what the agent has typed and not yet committed.
  useEffect(() => {
    setDraft((current) => ({
      patientId: held.patientId || current.patientId,
      reference: held.reference || current.reference,
    }))
  }, [held.patientId, held.reference])

  const commit = (how: 'blur' | 'enter') => {
    if (apply.busy) return
    const outgoing = prescriptionCommit(header, draft, how)
    if (outgoing) apply.onCommit(outgoing)
  }
  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit('enter')
  }
  const fieldError = (field: 'patientId' | 'reference') =>
    // Possibly the server's own words, so isolated as free text (bidi rule), as `OrderTypePicker` does.
    apply.error?.field === field ? (
      <span data-cc-prescription-error={field}>
        <bdi>{apply.error.text}</bdi>
      </span>
    ) : undefined

  return (
    <ChipSection
      open={open}
      onClose={() => !apply.busy && onClose()}
      name="prescription"
      title={t('prescription.title')}
      width="28rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={apply.busy} data-cc-prescription-close>
          {apply.busy ? t('prescription.saving') : t('prescription.close')}
        </Button>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2" data-cc-prescription-form>
        <Field
          id="cc-prescription-id"
          label={t('prescription.patientId')}
          hint={t('prescription.patientIdHint')}
          error={fieldError('patientId')}
        >
          <Input
            value={draft.patientId}
            onChange={(e) => setDraft((d) => ({ ...d, patientId: filterPatientId(e.target.value) }))}
            onBlur={() => commit('blur')}
            onKeyDown={onEnter}
            // Read-only, not disabled, while a commit is in flight: a disabled box drops the caret.
            readOnly={apply.busy}
            inputMode="numeric"
            // No native `maxLength`: it would cut a pasted "102 345 6789" before the filter reads
            // its digits. `filterPatientId` keeps ten.
            autoComplete="off"
            // A machine value: it reads left-to-right under Arabic too (bidi rule).
            dir="ltr"
            placeholder={t('prescription.patientIdPlaceholder')}
            data-cc-prescription-id
            className="w-full font-mono"
          />
        </Field>
        <Field
          id="cc-prescription-reference"
          label={t(referenceLabelKey(orderType))}
          hint={t('prescription.referenceHint')}
          error={fieldError('reference')}
        >
          <Input
            value={draft.reference}
            onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
            onBlur={() => commit('blur')}
            onKeyDown={onEnter}
            // Read-only, not disabled, while a commit is in flight: a disabled box drops the caret.
            readOnly={apply.busy}
            autoComplete="off"
            dir="ltr"
            data-cc-prescription-reference
            className="w-full font-mono"
          />
        </Field>
        {apply.error && apply.error.field === null && (
          <p className={`${NOTE.danger} sm:col-span-2`} data-cc-prescription-error="">
            <bdi>{apply.error.text}</bdi>
          </p>
        )}
      </div>
    </ChipSection>
  )
}
