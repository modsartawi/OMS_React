import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import {
  TASK_REASON_CODE_VALUE_SET,
  codeSystemKey,
  nphiesLookupApi,
} from '@/core/nphies/api'
import type { AuthListRow } from '@/core/models/nphies'

/**
 * The cancel act's one question (ticket 215): **which reason**.
 *
 * A cancellation carries a `reasonCode` all the way to NPHIES — it becomes the
 * cancel task's `reasonCode` coding against
 * `http://nphies.sa/terminology/CodeSystem/task-reason-code`
 * (`CancellationTaskEntry.cs:77`). So the reason is not decoration and it cannot
 * be defaulted: a client that sent a constant would be putting words in the
 * agent's mouth on the record the payer keeps.
 *
 * 🚩 The reasons are **fetched, not listed here** — `GET Nphies/CodeSystem?valueSet=TaskReasonCode`
 * (`ValueSetConstants.TaskReasonCode`). Spelling a value set's members into the
 * client is exactly the guessed shape spec 209 warns against; when the lookup
 * answers nothing, the dialog says so and the cancel cannot proceed, which is
 * honest in a way an invented code would not be.
 *
 * The dialog is also the confirmation step a terminal act deserves — a cancel is
 * not undoable and the row is identified in the prompt by its own preauth
 * reference.
 */
export interface CancelDialogProps {
  row: AuthListRow | null
  busy: boolean
  /**
   * 🚩 A refused cancellation renders **here**, not as a toast. The modal is a
   * native `showModal()` dialog, so it and its backdrop sit in the browser's top
   * layer — a toast raised while it is open is painted under a 50% black scrim
   * and cannot be clicked, whatever its z-index. A business refusal
   * (`AUTH_ALREADY_DISPENSED` is the one this act exists to meet) has to be
   * readable beside the control that raised it, and the dialog stays open so the
   * agent can act on it.
   */
  error: unknown
  onClose: () => void
  onConfirm: (reasonCode: string) => void
}

export default function CancelDialog({ row, busy, error, onClose, onConfirm }: CancelDialogProps) {
  const { t } = useTranslation('authorizations')
  const [reasonCode, setReasonCode] = useState('')

  const reasons = useQuery({
    queryKey: codeSystemKey(TASK_REASON_CODE_VALUE_SET),
    queryFn: () => nphiesLookupApi.codeSystem(TASK_REASON_CODE_VALUE_SET),
    enabled: row !== null,
  })

  // ⚠ `Blocked` is a string upstream, not a boolean, and it is carried as
  // declared. A blocked code is one NPHIES no longer accepts, so it is not
  // offered — but the test is on the value being truthy and not `'false'`,
  // because that is what the column actually holds.
  const options = (reasons.data ?? []).filter(
    (r) => !r.blocked || r.blocked.toLowerCase() === 'false',
  )
  const ready = reasonCode !== '' && !busy

  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      title={t('cancel.title')}
      // Every open starts with no reason chosen. Carrying the last one over would
      // make the second cancellation of an evening a single click on a record
      // the payer keeps.
      onShow={() => setReasonCode('')}
      width="26rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('cancel.back')}
          </Button>
          <Button
            variant="danger"
            aria-disabled={!ready}
            title={reasonCode === '' ? t('cancel.reasonRequired') : t('cancel.confirmHint')}
            onClick={() => ready && onConfirm(reasonCode)}
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {t('cancel.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>{t('cancel.body', { reference: row?.preAuthRef || (row?.id ?? '') })}</p>

        {/* The server's own sentence, passed through as data — a guardrail
            refusal is a designed outcome, not a crash and not an "unexpected". */}
        {error !== null && error !== undefined && (
          <ErrorBanner
            title={t('acts.results.refused')}
            message={apiErrorMessage(error, t('acts.results.refused'))}
            className="p-2"
          />
        )}

        {reasons.isError && (
          <ErrorBanner
            message={apiErrorMessage(reasons.error, t('errors.reasonsFailed'))}
            className="p-2"
          />
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('cancel.reason')}</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={reasons.isPending || options.length === 0}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          >
            {/* No default pick: the code reaches the payer, so it is chosen or the
                act does not fire. */}
            <option value="">{t('cancel.chooseReason')}</option>
            {options.map((r) => (
              <option key={r.code} value={r.code}>
                {r.display || r.code}
              </option>
            ))}
          </select>
        </label>

        {!reasons.isPending && !reasons.isError && options.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('cancel.noReasons')}</p>
        )}
      </div>
    </Modal>
  )
}
