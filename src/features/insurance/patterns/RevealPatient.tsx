import { useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Eye, Loader2, ShieldAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { formatCount, fsi } from '@/core/util/bidi'
import { canRevealPatient } from './access'
import { patternsApi } from './api'
import { REASON_MAX, REASON_MIN, revealFailure, revealProblem, type RevealedPatient } from './reveal'

/**
 * **Show patient** on a case (oms 923; BackOffice spec 4050 story 15, door 4053 `POST …/Cases/{caseId}/Reveal` —
 * STUBBED, the door is not built): an investigator gives a reason, the server logs the reveal, and the patient key and
 * member id show in this dialog and nowhere else.
 *
 * 🔒 The answer lives in the dialog's own `useState` only. The door is called straight from the click: no `useQuery`,
 * and no `useMutation` either (TanStack's mutation cache keeps `data`). Nothing reaches the URL, storage, the console
 * or a toast. The dialog is mounted only while it is open, so closing it drops the patient with it; showing them again
 * is another logged reveal. (`./reveal-contract.test.ts` holds the source to this; the reveal drive reads the caches,
 * storage, the address and the console back on the running app.)
 *
 * The button shows with `canRevealPatient` only. An open dialog stays open if the grant is withdrawn under it (a 403
 * re-reads the permissions answer), so it can say why; the button is gone once it closes.
 */
export default function RevealPatient({ caseId, caseNumber }: { caseId: string; caseNumber: string }) {
  const { t } = useTranslation('insurance-patterns')
  const can = canRevealPatient(usePermissions())
  const [open, setOpen] = useState(false)
  return (
    <>
      {can && (
        <Button variant="secondary" onClick={() => setOpen(true)} data-testid="pattern-reveal-open">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {t('reveal.open')}
        </Button>
      )}
      {open && <RevealDialog caseId={caseId} caseNumber={caseNumber} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Where the dialog stands. Only the shown step holds a patient, so a failure never sits beside one. */
type Step =
  | { step: 'asking' }
  | { step: 'sending' }
  | { step: 'failed'; error: unknown }
  | { step: 'shown'; patient: RevealedPatient; reason: string }

function RevealDialog({ caseId, caseNumber, onClose }: { caseId: string; caseNumber: string; onClose: () => void }) {
  const { t } = useTranslation('insurance-patterns')
  const [reason, setReason] = useState('')
  // A problem shows once the investigator tried to send, not while they are still typing.
  const [tried, setTried] = useState(false)
  const [at, setAt] = useState<Step>({ step: 'asking' })
  // One reveal per click: a second click before the answer would write a second log row.
  const inFlight = useRef(false)
  const problem = revealProblem(reason)
  const sending = at.step === 'sending'

  const send = async () => {
    setTried(true)
    if (problem || inFlight.current) return
    const sent = reason.trim()
    inFlight.current = true
    setAt({ step: 'sending' })
    try {
      const patient = await patternsApi.reveal(caseId, sent)
      setAt({ step: 'shown', patient, reason: sent })
    } catch (error) {
      setAt({ step: 'failed', error })
    } finally {
      inFlight.current = false
    }
  }

  // The problem in words: the send button's reason while it is held (`title`), and the field's error once tried.
  const problemText =
    problem === 'short'
      ? t('reveal.problem.short', { min: fsi(REASON_MIN) })
      : problem === 'tooLong'
        ? t('reveal.problem.tooLong', { max: fsi(REASON_MAX) })
        : undefined
  const length = reason.trim().length

  return (
    <Modal
      open
      onClose={onClose}
      // A reveal in flight cannot be dismissed: its answer would arrive to a dialog that is gone.
      dismissable={!sending}
      title={t('reveal.title', { caseNumber: fsi(caseNumber) })}
      width="34rem"
      footer={
        at.step === 'shown' ? (
          // Keyed so it MOUNTS (unkeyed, React would reuse Cancel's button for it, and `autoFocus` acts on a mount only).
          <Button key="close" variant="primary" onClick={onClose} autoFocus data-testid="pattern-reveal-close">
            {t('reveal.close')}
          </Button>
        ) : (
          <>
            <Button variant="text" onClick={onClose} disabled={sending} data-testid="pattern-reveal-cancel">
              {t('reveal.cancel')}
            </Button>
            <Button
              variant="primary"
              aria-disabled={problem !== null || sending}
              title={problemText}
              onClick={() => void send()}
              data-testid="pattern-reveal-send"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              {t(sending ? 'reveal.sending' : 'reveal.send')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3" data-testid="pattern-reveal" data-step={at.step}>
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 p-2.5 text-xs text-attention-800"
          data-testid="pattern-reveal-logged"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t('reveal.logged')}</span>
        </p>
        {at.step === 'shown' ? (
          <ShownPatient patient={at.patient} reason={at.reason} />
        ) : (
          <>
            <Field label={t('reveal.reason')} hint={t('reveal.reasonHint', { min: fsi(REASON_MIN) })} error={tried ? problemText : undefined}>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={sending}
                autoFocus
                className="w-full"
                data-testid="pattern-reveal-reason"
              />
            </Field>
            <span className={`self-end text-xs ${length > REASON_MAX ? 'text-danger-800' : 'text-muted-foreground'}`} data-testid="pattern-reveal-count">
              <Ltr>{formatCount(length, REASON_MAX)}</Ltr>
            </span>
            {at.step === 'failed' && <ErrorBanner title={t('reveal.failed')} message={failureText(t, at.error)} className="p-2" />}
          </>
        )}
      </div>
    </Modal>
  )
}

/** A failed reveal in words: the grant for a bare 403, its own sentence for an empty answer, else the server's. */
function failureText(t: TFunction, error: unknown): string {
  switch (revealFailure(error)) {
    case 'denied':
      return t('reveal.failure.denied')
    case 'empty':
      return t('reveal.failure.empty')
    default:
      return apiErrorMessage(error, t('reveal.failure.unexpected'))
  }
}

/** The patient, as the door answered: two machine values, each isolated whole, and the reason the log keeps. */
function ShownPatient({ patient, reason }: { patient: RevealedPatient; reason: string }) {
  const { t } = useTranslation('insurance-patterns')
  return (
    <div className="flex flex-col gap-3">
      <dl
        className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 rounded-md border border-border/60 bg-muted p-3"
        aria-label={t('reveal.patient')}
        data-testid="pattern-reveal-patient"
      >
        <dt className="text-xs text-muted-foreground">{t('reveal.patientKey')}</dt>
        <dd className="select-all font-mono text-sm font-semibold" data-testid="pattern-reveal-patient-key">
          <Ltr>{patient.patientKey}</Ltr>
        </dd>
        <dt className="text-xs text-muted-foreground">{t('reveal.memberId')}</dt>
        <dd className="select-all font-mono text-sm font-semibold" data-testid="pattern-reveal-member-id">
          {patient.memberId ? <Ltr>{patient.memberId}</Ltr> : <span className="font-sans font-normal text-muted-foreground">{t('reveal.notGiven')}</span>}
        </dd>
      </dl>
      <div className="text-xs">
        <p className="text-muted-foreground">{t('reveal.loggedWith')}</p>
        <p className="mt-0.5 whitespace-pre-line" data-testid="pattern-reveal-sent-reason">
          <bdi>{reason}</bdi>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t('reveal.onlyHere')}</p>
    </div>
  )
}
