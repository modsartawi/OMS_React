/**
 * The location link on the web seat (574, BackOffice spec 2482; card rules: BackOffice 2468).
 *
 * While the caller is on the phone the agent texts them a 15-minute link; the caller drops a
 * pin on a public page and the pin reaches this console. This panel owns the three things 574
 * builds — **Send location link**, its dialog, and the **waiting strip** — and is where 575's
 * card and chip, and 576's Discard and Resend-over-a-card, land in the same place.
 *
 * - **Placement.** In the flow directly under the header sentence, whose address word is the
 *   console's *Change address* (the address book's only door, 166/379). The action sits on the
 *   address's own row there, never inside `AddressPicker`.
 * - **Hidden, never disabled.** The action is drawn only while `canSendLocationLink` is true
 *   (`showsSendAction`); a `CCL-00001` from Send hides it for the rest of the order.
 * - **The link is held here and nowhere else.** The page mounts this panel keyed by the
 *   transaction, so a new order starts with no link, and a reload starts with none either —
 *   the server keeps the link, and an un-read one simply lapses.
 * - **The poll** follows the LATEST token (`locationLinkKey(token)`), every 3 s, only while
 *   that link is live and the order is open; react-query pauses it while the tab is hidden.
 *   A failed poll retries quietly at the same pace; 30 s of continuous failure turns the
 *   countdown into the "can't reach the server" note (`stripView`).
 */
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import type { LocationLinkSendRequest, SessionState } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { useSecondClock } from '@/core/ui/second-clock'
import { callCenterApi, locationLinkKey } from './api'
import { LOCATION_POLL_MS, sendBody, sendRefusal, showsSendAction, stripView, type SendRefusal } from './location-link-view'

/** The link this order holds: the latest Send's answer, and the body that sent it (Resend
 *  re-sends that body, to the same number, without the dialog). */
interface HeldLink {
  token: string
  maskedMobile: string
  sentAt: number
  sentSecondsLeft: number
  body: LocationLinkSendRequest
}

export default function LocationLinkPanel({
  state,
  onSent,
}: {
  state: SessionState
  /** Told after every successful Send, so the page knows this order has a link to Retire. */
  onSent?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const now = useSecondClock()
  const [held, setHeld] = useState<HeldLink | null>(null)
  /** `CCL-00001` — the feature turned out not to be configured: the action goes for good. */
  const [hidden, setHidden] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mobile, setMobile] = useState('')
  const [refusal, setRefusal] = useState<SendRefusal | null>(null)
  /** When the current run of failed polls began; `null` while the last poll succeeded. */
  const [failingSince, setFailingSince] = useState<number | null>(null)

  const open = state.status === 'open'
  const customerMobile = state.header.customer?.mobile ?? null

  const send = useMutation({
    mutationFn: (body: LocationLinkSendRequest) => callCenterApi.sendLocationLink(body),
    onMutate: () => setRefusal(null),
    onSuccess: (sent, body) => {
      setHeld({
        token: sent.token,
        maskedMobile: sent.maskedMobile,
        sentAt: Date.now(),
        sentSecondsLeft: sent.secondsLeft,
        body,
      })
      setFailingSince(null)
      setDialogOpen(false)
      onSent?.()
    },
    onError: (err) => {
      const placed = sendRefusal(err)
      if (placed.at === 'hide') {
        setHidden(true)
        setHeld(null)
        setDialogOpen(false)
        return
      }
      setRefusal(placed)
    },
    retry: false,
  })

  const token = held?.token ?? null
  const status = useQuery({
    queryKey: locationLinkKey(token ?? ''),
    queryFn: async () => {
      try {
        const read = await callCenterApi.locationLinkStatus(token!)
        setFailingSince(null)
        return read
      } catch (err) {
        setFailingSince((since) => since ?? Date.now())
        throw err
      }
    },
    // Until Captured, Lapsed or Superseded, and only on an open order. The rule reads the
    // query's own answer: once the server has decided, nothing re-asks (not even a focus).
    enabled: (query) => open && token !== null && (query.state.data?.status ?? 'Live') === 'Live',
    refetchInterval: LOCATION_POLL_MS,
    // Failed polls retry quietly at the same pace — the interval IS the retry.
    retry: false,
    staleTime: 0,
  })
  const read = status.data
    ? { status: status.data.status, secondsLeft: status.data.secondsLeft, at: status.dataUpdatedAt }
    : null
  const view = held
    ? stripView({ sentAt: held.sentAt, sentSecondsLeft: held.sentSecondsLeft, read, failingSince, now })
    : null

  if (!open || hidden) return null
  if (!held && !showsSendAction(state.capabilities)) return null

  const openDialog = () => {
    setMobile(customerMobile ?? '')
    setRefusal(null)
    send.reset()
    setDialogOpen(true)
  }
  const resend = () => held && send.mutate(held.body)

  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-divider bg-card px-4 py-1.5" data-cc-location>
      {!held && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={openDialog} data-cc-location-send>
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t('location.send.action')}
          </Button>
        </div>
      )}
      {held && view && (
        <LocationStrip
          view={view}
          maskedMobile={held.maskedMobile}
          resending={send.isPending}
          onResend={resend}
          onSendAgain={openDialog}
          error={!dialogOpen && refusal ? refusalText(refusal, t) : null}
        />
      )}
      <Modal
        open={dialogOpen}
        onClose={() => !send.isPending && setDialogOpen(false)}
        title={t('location.send.title')}
        width="26rem"
        footer={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)} disabled={send.isPending} data-cc-location-cancel>
              {t('location.send.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => state.transactionId && send.mutate(sendBody(state.transactionId, customerMobile, mobile))}
              disabled={send.isPending || mobile.trim() === ''}
              data-cc-location-submit
            >
              {send.isPending ? t('location.send.sending') : t('location.send.confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm" data-cc-location-dialog>
          <p className="text-muted-foreground">{t('location.send.body')}</p>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('location.send.mobile')}</span>
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="off"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value)
                if (refusal?.at === 'mobile') setRefusal(null)
              }}
              aria-invalid={refusal?.at === 'mobile'}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-start aria-invalid:border-danger-border"
              data-cc-location-mobile
            />
          </label>
          {refusal?.at === 'mobile' && (
            <p className="text-xs text-danger-800" data-cc-location-mobile-error>
              <bdi>{refusalText(refusal, t)}</bdi>
            </p>
          )}
          {refusal?.at === 'dialog' && (
            <p
              className="rounded-md border border-danger-border bg-danger-050 p-2 text-danger-800"
              data-cc-location-send-error
            >
              <bdi>{refusalText(refusal, t)}</bdi>
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

/** A refusal's words: the server's own sentence, the console's key, or the generic line. */
function refusalText(refusal: SendRefusal, t: (key: string) => string): string {
  if (refusal.at === 'hide') return ''
  if ('key' in refusal) return t(refusal.key)
  return refusal.text || t('location.send.failed')
}

/** The waiting strip (2468): one line, its state, and the one act that state offers. */
function LocationStrip({
  view,
  maskedMobile,
  resending,
  onResend,
  onSendAgain,
  error,
}: {
  view: ReturnType<typeof stripView>
  maskedMobile: string
  resending: boolean
  onResend: () => void
  onSendAgain: () => void
  error: string | null
}) {
  const { t } = useTranslation('callcenter')
  const live = view.kind === 'waiting' || view.kind === 'unreachable'
  const tone =
    view.kind === 'expired' || view.kind === 'replaced'
      ? 'border-attention-border bg-attention-050 text-attention-800'
      : 'border-border bg-muted text-foreground'
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 text-[12.5px] ${tone}`}
      role="status"
      data-cc-location-strip={view.kind}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {/* `dir="auto"`: the line is PROSE, so it reads in its own language's direction — the
          header sentence's rule (408). An English line on an RTL page otherwise scatters. */}
      <span dir="auto" className="min-w-0 flex-1 text-start" data-cc-location-line>
        {view.kind === 'waiting' && (
          <Trans
            t={t}
            ns="callcenter"
            i18nKey="location.strip.waiting"
            values={{ mobile: maskedMobile, clock: view.clock }}
            components={{ mobile: <Ltr />, clock: <span data-cc-location-clock className="tabular-nums" /> }}
          />
        )}
        {view.kind === 'unreachable' && (
          <span data-cc-location-unreachable>
            <Trans
              t={t}
              ns="callcenter"
              i18nKey="location.strip.unreachable"
              values={{ mobile: maskedMobile }}
              components={{ mobile: <Ltr /> }}
            />
          </span>
        )}
        {view.kind === 'expired' && t('location.strip.expired')}
        {view.kind === 'replaced' && t('location.strip.replaced')}
        {view.kind === 'received' && t('location.strip.received')}
      </span>
      {live && (
        <Button
          variant="outlined"
          onClick={onResend}
          disabled={resending || view.resendIn > 0}
          data-cc-location-resend
          data-cc-location-resend-in={view.resendIn}
        >
          {view.resendIn > 0 ? (
            <span dir="auto">
              <Trans
                t={t}
                ns="callcenter"
                i18nKey="location.strip.resendIn"
                values={{ seconds: view.resendIn }}
                components={{ seconds: <Ltr /> }}
              />
            </span>
          ) : (
            t('location.strip.resend')
          )}
        </Button>
      )}
      {(view.kind === 'expired' || view.kind === 'replaced') && (
        <Button variant="secondary" onClick={onSendAgain} data-cc-location-again>
          {t('location.strip.sendAgain')}
        </Button>
      )}
      {error && (
        <p className="basis-full text-danger-800" data-cc-location-strip-error>
          <bdi>{error}</bdi>
        </p>
      )}
    </div>
  )
}
