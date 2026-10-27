import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy, RefreshCw } from 'lucide-react'
import type { PickSupportFixRequest, PickSupportShapeMatch } from '@/core/models/pick-support'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { copyText } from '@/core/util/copy-text'
import { pickSupportApi, pickSupportKeys } from './api'
import { Code, PickSupportFailureBanner } from './bits'
import { FIX_REASON_MAX, FIX_REFERENCE_MAX, canConfirmFix, fixBody, fixOutcome, type FixOutcome } from './fix'
import ShapeBody from './ShapeBody'


/**
 * **Apply fix** (ticket 497, brief 2691 "The fix dialog"): a stuck shape's ONE fix, for one
 * delivery. It shows the shape code, the server's explanation and fix sentence (EN beside AR) and
 * what the fix touches, and asks for a reason and a complaint reference (rule 4).
 *
 * 🚩 The server re-checks (rule 3). Confirm sends `POST …/Fix` once — disabled while in flight, and
 * held by a ref too, which a double click cannot slip past the way it slips past a re-render —
 * and the dialog shows the answer:
 * - **fixed** — the panel takes the returned diagnosis; when it is `null` the delivery is read
 *   again. Either way the fix stood: the dialog shows the store's instructions (EN beside AR, each
 *   with its own copy button) and offers only Close, never a second press.
 * - **refused** — the dialog stays open with the input kept, showing the code beside the server's
 *   sentence. `PICK-00224` (no longer in that shape) offers Refresh diagnosis instead of Confirm.
 * - **denied** — a bare 403: "You do not have access to apply fixes".
 *
 * The delivery's own read takes the answer at once. Every other read of Pick support (a lookup's
 * stuck marker, a census) is refreshed only when the dialog closes: refreshed while it is open, a
 * lookup that no longer names this delivery would unmount the dialog before the store's
 * instructions are copied.
 */
export default function FixDialog({
  deliveryNo,
  card,
  onClose,
  onFixed,
}: {
  deliveryNo: string
  card: PickSupportShapeMatch
  onClose: () => void
  /** Told once a fix stood, so a host whose own load the fix changed reads it again (Document Details, 499). */
  onFixed?: () => void
}) {
  const { t } = useTranslation('pick-support')
  const queryClient = useQueryClient()
  const reasonId = useId()
  const referenceId = useId()
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [answer, setAnswer] = useState<{ outcome: FixOutcome; error: unknown } | null>(null)
  const inFlight = useRef(false)

  const fix = useMutation({
    mutationFn: (body: PickSupportFixRequest) => pickSupportApi.fix(deliveryNo, body),
    onSuccess: (result) => {
      const outcome = fixOutcome({ result }, '')
      if (outcome.kind === 'fixed') {
        const own = pickSupportKeys.delivery(deliveryNo)
        // `null`: the fix stood but its re-read failed — the delivery is read again.
        if (outcome.reread) void queryClient.invalidateQueries({ queryKey: own })
        else queryClient.setQueryData(own, outcome.diagnosis)
        onFixed?.()
      }
      setAnswer({ outcome, error: null })
    },
    onError: (error) => setAnswer({ outcome: fixOutcome({ error }, t('fix.failed')), error }),
    onSettled: () => {
      inFlight.current = false
    },
  })

  const pending = fix.isPending
  const outcome = answer?.outcome ?? null
  const fixed = outcome?.kind === 'fixed' ? outcome : null
  const blocked = outcome !== null && (outcome.kind === 'denied' || (outcome.kind === 'refused' && !outcome.canResend))
  const ready = canConfirmFix(reason, reference) && !pending && !blocked && fixed === null

  const confirm = () => {
    if (!ready || inFlight.current) return
    inFlight.current = true
    setAnswer(null)
    fix.mutate(fixBody(card.shape, reason, reference))
  }
  // After a fix, the rest of Pick support (not this delivery: it already holds the answer) is read
  // again as the dialog closes, whichever way it closes.
  const close = () => {
    if (fixed) {
      const own = pickSupportKeys.delivery(deliveryNo)
      const notThisDelivery = (key: readonly unknown[]) => own.some((part, i) => key[i] !== part)
      void queryClient.invalidateQueries({ queryKey: pickSupportKeys.all, predicate: (q) => notThisDelivery(q.queryKey) })
    }
    onClose()
  }
  const dismiss = () => {
    if (!pending) close()
  }
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: pickSupportKeys.all })
    onClose()
  }

  // A repeated Escape may still close a modal natively however its cancel is refused; while the
  // request is in flight the dialog is shown again, otherwise React state is told it closed
  // (`AttachmentWithdrawDialog`'s guard).
  const content = useRef<HTMLDivElement>(null)
  const latest = useRef({ pending, close })
  latest.current = { pending, close }
  useEffect(() => {
    const dialog = content.current?.closest('dialog')
    if (!dialog) return
    const onNativeClose = () => {
      if (dialog.open) return
      if (latest.current.pending) dialog.showModal()
      else latest.current.close()
    }
    dialog.addEventListener('close', onNativeClose)
    return () => dialog.removeEventListener('close', onNativeClose)
  }, [])

  async function copy(text: string) {
    // Inside a modal the fallback's textarea must sit in the dialog to be selectable.
    const result = await copyText(text, { container: content.current?.closest('dialog') })
    if (result === 'copied') notify.success(t('fix.copied'))
    else notify.error(t('fix.copyFailed'), t('copy.failedDetail'))
  }

  const footer = fixed ? (
    <Button variant="secondary" onClick={close} data-ps-fix-close="">
      {t('fix.close')}
    </Button>
  ) : (
    <>
      <Button variant="text" onClick={dismiss} disabled={pending} data-ps-fix-cancel="">
        {t('fix.cancel')}
      </Button>
      {outcome?.kind === 'refused' && outcome.offerRefresh && (
        <Button variant="outlined" onClick={refresh} data-ps-fix-refresh="">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {t('fix.refresh')}
        </Button>
      )}
      <Button onClick={confirm} disabled={!ready} data-ps-fix-confirm="">
        {pending ? t('fix.sending') : t('fix.confirm')}
      </Button>
    </>
  )

  return (
    <Modal open onClose={dismiss} title={t('fix.title')} width="56rem" footer={footer}>
      <div ref={content} className="flex flex-col gap-3 text-sm" data-ps-fix-dialog={card.shape} data-ps-fix-state={fixed ? 'fixed' : (outcome?.kind ?? 'form')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('fix.shape')}</span>
          <Code>{card.shape}</Code>
        </div>

        {fixed ? (
          <>
            <p className="flex items-center gap-2 font-medium text-success-800" role="status" data-ps-fix-done="">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {t('fix.done')}
            </p>
            <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-ps-tell="">
              <h3 className="text-sm font-semibold">{t('fix.tellTheStore')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <TellTheStore lang="en" label={t('lang.en')} text={fixed.tellTheStoreEn} copyLabel={t('fix.copyEn')} onCopy={copy} />
                <TellTheStore lang="ar" label={t('lang.ar')} text={fixed.tellTheStoreAr} copyLabel={t('fix.copyAr')} onCopy={copy} />
              </div>
            </section>
          </>
        ) : (
          <>
            <ShapeBody card={card} />

            <div className="flex flex-col gap-1">
              <label htmlFor={reasonId} className="text-xs font-medium text-muted-foreground">
                {t('fix.reason')}
              </label>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={FIX_REASON_MAX}
                disabled={pending}
                required
                dir="auto"
                rows={3}
                className="w-full"
                data-ps-fix-reason=""
              />
              <span className="text-xs text-muted-foreground" data-ps-fix-reason-hint="">
                {t('fix.reasonHint')}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={referenceId} className="text-xs font-medium text-muted-foreground">
                {t('fix.reference')}
              </label>
              <Input
                id={referenceId}
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={FIX_REFERENCE_MAX}
                disabled={pending}
                required
                dir="auto"
                className="w-full max-w-sm"
                data-ps-fix-reference=""
              />
            </div>

            {answer && answer.outcome.kind !== 'fixed' && (
              <div data-ps-fix-error={answer.outcome.kind === 'refused' ? (answer.outcome.code ?? '') : 'denied'}>
                <PickSupportFailureBanner error={answer.error} title={t('fix.failedTitle')} fallback={t('fix.failed')} denied={t('fix.denied')} />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

/** One language of the store's instructions, as sent, with its own copy button (copied verbatim). */
function TellTheStore({
  lang,
  label,
  text,
  copyLabel,
  onCopy,
}: {
  lang: 'en' | 'ar'
  label: string
  text: string
  copyLabel: string
  onCopy: (text: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5" data-ps-tell-lang={lang}>
      <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <bdi lang={lang} className="block text-sm whitespace-pre-wrap" data-ps-tell-text="">
        {text}
      </bdi>
      {/* Nothing sent in this language: nothing to copy, rather than a "Copied" over an empty clipboard. */}
      {text.trim() !== '' && (
        <div>
          <Button variant="outlined" onClick={() => onCopy(text)} data-ps-tell-copy={lang}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copyLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
