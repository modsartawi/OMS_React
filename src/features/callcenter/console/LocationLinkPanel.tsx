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
 *   countdown into the "can't reach the server" note (`stripView`). A poll REFUSED with
 *   `CCL-00006` is not a failed poll: the link is gone, and the strip offers Send again (575).
 * - **The card** (575) replaces the strip, in the same place, when the poll answers
 *   `Captured`: one row per field with its tick (`location-card.ts`), compared against the
 *   order's address as it stands now. **Apply** is a session verb, so it is the PAGE's
 *   (`onApply`, through `runGuarded`); the panel only builds its body — the ticks, never the
 *   values — and words its refusals (`applyRefusal`).
 * - **The chip** (575) — *Location applied hh:mm · Open in Google Maps* — stays until the
 *   order in progress ends, which is when this panel is unmounted. 576: when the order's
 *   address changes after it (`chipAfter`, by `addressNumber`), it reads *Location cleared -
 *   address changed* — `setAddress` refilled the pin from the new book row (861).
 * - **Discard** (576) stamps the capture with no confirmation; the strip then reads *Location
 *   discarded* with Send again. **Never two cards**: Resend over an unapplied card asks first,
 *   then discards, then sends (`resendSteps`) — the send's success resets every card state, so
 *   the discard must land before it. Resend over the chip is free.
 * - **Create address from this location** (576): the page opens `AddressPicker` on a create
 *   pre-filled from the capture (`onCreateAddress`); once the created address is on the order,
 *   the capture is stamped through `ApplyLocation` (`stampAfterCreate`).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import type {
  AddressBookAddress,
  ApplyLocationRequest,
  CustomerAddressBookEntry,
  LocationCapture,
  LocationLinkSendRequest,
  SessionState,
} from '@/core/models/callcenter'
import { newRequestId } from '@/core/engine-session/request-id'
import { formatTimeOfDay } from '@/core/util/date-format'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { useSecondClock } from '@/core/ui/second-clock'
import { callCenterApi, locationLinkKey } from './api'
import { addressFormFromCapture, type AddressFormValues } from './address-capture'
import {
  applyBody,
  applyRefusal,
  captureStamp,
  locationCard,
  mapsUrl,
  stampAfterCreate,
  type ApplyRefusal,
  type LocationTicks,
} from './location-card'
import LocationCardView from './LocationCardView'
import {
  chipAfter,
  discardRefusal,
  LOCATION_POLL_MS,
  pollRefusal,
  resendCooldownSeconds,
  resendSteps,
  sendBody,
  sendRefusal,
  showsSendAction,
  stripAct,
  stripView,
  type AppliedChip,
  type DiscardRefusal,
  type LocationFace,
  type SendRefusal,
  type StripView,
} from './location-link-view'
import ResendButton from './ResendButton'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

/** The link this order holds: the latest Send's answer, and the body that sent it (Resend
 *  re-sends that body, to the same number, without the dialog). */
interface HeldLink {
  token: string
  maskedMobile: string
  sentAt: number
  sentSecondsLeft: number
  body: LocationLinkSendRequest
}

/**
 * What became of the held link, when the panel learned it from something other than the
 * status: `applied` (this press's Apply landed — `at` is the console's clock), `gone`
 * (`CCL-00006`: no such link for this agent), or `discarded` (this press's Discard landed).
 */
type LinkOutcome = { kind: 'applied'; at: string } | { kind: 'gone' } | { kind: 'discarded' }

/** A card's text error: the server's sentence or the console's key. */
type CardError = { text: string } | { key: string }

export default function LocationLinkPanel({
  state,
  onSent,
  onApply,
  onRefresh,
  onCreateAddress,
}: {
  state: SessionState
  /** Told after every successful Send, so the page knows this order has a link to Retire. */
  onSent?: () => void
  /** `ApplyLocation` through the page's verb path (`runGuarded`: the busy strip, the
   *  `SESSION_BUSY` retry, the dead-order faults), its answer written into the session. */
  onApply: (body: ApplyLocationRequest) => Promise<SessionState>
  /** Re-read the order (`CCL-00031`: the capture was already stamped). */
  onRefresh: () => void
  /** 576 — open the address book on a create pre-filled from the capture. Resolves with the
   *  created book row once the create lands, or `null` when the book closes without one.
   *  Absent when the book cannot be opened on this order. */
  onCreateAddress?: (prefill: AddressFormValues) => Promise<CustomerAddressBookEntry | null>
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
  /** What became of the link outside the poll — an Apply, a `CCL-00006`. */
  const [outcome, setOutcome] = useState<LinkOutcome | null>(null)
  /** The agent's ticks, for the token they were made on; a new capture starts from the
   *  card's defaults. */
  const [ticked, setTicked] = useState<{ token: string; ticks: LocationTicks } | null>(null)
  const [cardError, setCardError] = useState<CardError | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** `CCL-00030`'s one retry: the body waiting for the next poll, and whether it was spent. */
  const [retryBody, setRetryBody] = useState<ApplyLocationRequest | null>(null)
  const [retried, setRetried] = useState(false)
  /** 576 — Resend over an unapplied card is asking *Discard … and send a new link?* */
  const [confirmingResend, setConfirmingResend] = useState(false)
  /** 576 — the chip's memory (the address it was first shown on), for the token it is about. */
  const [chip, setChip] = useState<{ token: string; chip: AppliedChip } | null>(null)
  /** 576 — a create from this capture landed: stamp it once the order holds that address,
   *  ticking only what the created row still holds as captured (`stampAfterCreate`). */
  const [stampOn, setStampOn] = useState<{
    token: string
    capture: LocationCapture
    addressNumber: string
    created: AddressBookAddress | null
  } | null>(null)
  /** When a Send failed in a way that may still have sent the text (a server or network
   *  error): the 30 s cooldown runs from here too, on the dialog's Send and on Resend. */
  const [maySentAt, setMaySentAt] = useState<number | null>(null)

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
      setOutcome(null)
      setTicked(null)
      setCardError(null)
      setSaveError(null)
      setRetryBody(null)
      setRetried(false)
      setStampOn(null)
      setMaySentAt(null)
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
      // The text may already be on its way (spec 2482): wait the cooldown out before the
      // next send, which then supersedes the orphan link.
      if ('cooldown' in placed && placed.cooldown) setMaySentAt(Date.now())
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
        // 575 — a REFUSAL is an answer, not an outage: `CCL-00006` would be answered again
        // on every poll, so the link is dropped rather than counted toward the note.
        const why = pollRefusal(err)
        if (why === 'gone') setOutcome({ kind: 'gone' })
        else if (why === 'hide') setHidden(true)
        else setFailingSince((since) => since ?? Date.now())
        throw err
      }
    },
    // Until Captured, Lapsed or Superseded, and only on an open order. The rule reads the
    // query's own answer: once the server has decided, nothing re-asks (not even a focus).
    enabled: (query) =>
      open && token !== null && outcome === null && (query.state.data?.status ?? 'Live') === 'Live',
    refetchInterval: LOCATION_POLL_MS,
    // Failed polls retry quietly at the same pace — the interval IS the retry.
    retry: false,
    staleTime: 0,
  })
  const read = status.data
    ? { status: status.data.status, secondsLeft: status.data.secondsLeft, at: status.dataUpdatedAt }
    : null
  const capture: LocationCapture | null =
    status.data?.status === 'Captured' ? (status.data.capture ?? null) : null
  // A capture the server already stamped (an Apply that landed, `CCL-00031`'s re-read) is
  // the chip or the strip, never a card.
  const stamp = capture ? captureStamp(capture) : null
  const applied = outcome?.kind === 'applied' ? outcome.at : stamp?.kind === 'applied' ? stamp.at : null
  const settled: StripView['kind'] | null =
    outcome?.kind === 'gone'
      ? 'gone'
      : outcome?.kind === 'discarded' || stamp?.kind === 'discarded'
        ? 'discarded'
        : null
  const view: StripView | null = held
    ? settled
      ? { kind: settled, clock: null, resendIn: 0, polling: false }
      : stripView({ sentAt: held.sentAt, sentSecondsLeft: held.sentSecondsLeft, read, failingSince, now })
    : null
  const card =
    capture && !applied && !settled
      ? locationCard(capture, state.header.address, state.header.customer !== null)
      : null
  const ticks = card ? (ticked && ticked.token === token ? ticked.ticks : card.ticks) : null
  const face: LocationFace = applied && capture ? 'chip' : card ? 'card' : 'strip'
  const addressNumber = state.header.address?.addressNumber ?? null
  const shownChip = chip && chip.token === token ? chip.chip : null

  /** A card act's refusal (Apply's or Discard's), placed: the shared link fates, or the card. */
  const placeCardRefusal = (placed: DiscardRefusal) => {
    switch (placed.at) {
      case 'refetch':
        // Already applied or discarded (another press, another tab): the order and the
        // capture are re-read, and the capture's own stamp draws the chip or the strip.
        onRefresh()
        void status.refetch()
        return
      case 'gone':
        setOutcome({ kind: 'gone' })
        return
      case 'hide':
        setHidden(true)
        setHeld(null)
        return
      case 'card':
        setCardError('key' in placed ? { key: placed.key } : { text: placed.text })
    }
  }

  const apply = useMutation({
    mutationFn: (body: ApplyLocationRequest) => onApply(body),
    onMutate: () => {
      setCardError(null)
      setSaveError(null)
    },
    onSuccess: () => {
      setRetryBody(null)
      setOutcome({ kind: 'applied', at: new Date().toISOString() })
    },
    onError: (err, body) => {
      const placed: ApplyRefusal = applyRefusal(err)
      if (placed.at === 'retry') {
        // Nothing captured yet: the card stays, and the same press is tried once more on
        // the next poll. A second "not yet" is said on the card.
        if (!retried) {
          setRetried(true)
          setRetryBody(body)
        } else setCardError({ key: 'location.card.notYet' })
        return
      }
      if (placed.at === 'save') {
        setSaveError(placed.key)
        return
      }
      placeCardRefusal(placed)
    },
    retry: false,
  })

  /**
   * 576 — Discard, and (`thenSend`) Resend's send after it. The send waits for the discard to
   * LAND: a refused discard is drawn like any other and nothing is sent, so a capture is never
   * left unstamped behind a new link.
   */
  const discard = useMutation({
    mutationFn: ({ token: tok }: { token: string; thenSend?: LocationLinkSendRequest }) =>
      callCenterApi.discardLocation(tok),
    onMutate: () => {
      setCardError(null)
      setSaveError(null)
    },
    onSuccess: (_stamped, { thenSend }) => {
      setRetryBody(null)
      setStampOn(null)
      setOutcome({ kind: 'discarded' })
      if (thenSend) send.mutate(thenSend)
    },
    onError: (err) => placeCardRefusal(discardRefusal(err)),
    retry: false,
  })

  // 576 — the chip remembers the address it was first shown on; a different one clears it.
  useEffect(() => {
    if (face !== 'chip' || !token) return
    setChip((cur) => {
      const prev = cur && cur.token === token ? cur.chip : null
      const next = chipAfter(prev, addressNumber)
      return prev && prev.addressNumber === next.addressNumber && prev.cleared === next.cleared
        ? cur
        : { token, chip: next }
    })
  }, [face, token, addressNumber])

  // 576 — Create address from this location: once the order holds the created address, the
  // capture is stamped (open question 1's recommended option, an overrulable ruling).
  const { mutate: applyNow } = apply
  const transactionId = state.transactionId
  useEffect(() => {
    if (!stampOn || !transactionId) return
    if (stampOn.token !== token) {
      setStampOn(null)
      return
    }
    if (addressNumber !== stampOn.addressNumber) return
    setStampOn(null)
    applyNow(stampAfterCreate(transactionId, newRequestId(), stampOn.token, stampOn.capture, stampOn.created))
  }, [stampOn, token, addressNumber, transactionId, applyNow])

  // `CCL-00030`'s retry, one poll interval on — the same press (the same `requestId`: it
  // was refused, so nothing was recorded against it). An unmount (the order ended) clears it.
  const { mutate: applyMutate } = apply
  useEffect(() => {
    if (!retryBody) return
    const timer = setTimeout(() => {
      setRetryBody(null)
      applyMutate(retryBody)
    }, LOCATION_POLL_MS)
    return () => clearTimeout(timer)
  }, [retryBody, applyMutate])

  if (!open || hidden) return null
  if (!held && !showsSendAction(state.capabilities)) return null

  const openDialog = () => {
    setMobile(customerMobile ?? '')
    setRefusal(null)
    send.reset()
    setDialogOpen(true)
  }
  /** Resend from whichever face is showing (`resendSteps`): over an unapplied card it asks. */
  const resend = () => {
    if (!held) return
    if (resendSteps(face)[0] === 'confirm') setConfirmingResend(true)
    else send.mutate(held.body)
  }
  const confirmResend = () => {
    setConfirmingResend(false)
    if (held && token) discard.mutate({ token, thenSend: held.body })
  }
  const createAddress =
    onCreateAddress && capture && token
      ? () => {
          const tok = token
          void onCreateAddress(addressFormFromCapture(capture)).then((created) => {
            if (created)
              setStampOn({ token: tok, capture, addressNumber: created.addressNumber, created: created.address })
          })
        }
      : undefined
  /** The dialog's wait: the 30 s cooldown from a failed send that may still have sent. */
  const sendIn = maySentAt !== null ? resendCooldownSeconds(maySentAt, now) : 0
  /** Resend's: from the latest send, or from such a failed one, whichever is later. */
  const resendIn = Math.max(held ? resendCooldownSeconds(held.sentAt, now) : 0, sendIn)
  /** Resend and Send again are drawn only while the order may send a link (§1): hidden,
   *  never disabled — an order that flipped to collection keeps its strip but loses them. */
  const canSend = showsSendAction(state.capabilities)
  const strayRefusal = refusal && !dialogOpen ? refusalText(refusal, t) : null

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
      {held && applied && capture && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1 self-start rounded-full border border-border bg-muted px-3 py-1 text-[12.5px]"
            role="status"
            data-cc-location-chip={shownChip?.cleared ? 'cleared' : 'applied'}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {shownChip?.cleared ? (
              <span dir="auto">{t('location.chip.cleared')}</span>
            ) : (
              <span dir="auto">
                <Trans
                  t={t}
                  ns="callcenter"
                  i18nKey="location.chip.applied"
                  values={{ time: formatTimeOfDay(applied) }}
                  components={{
                    time: <Ltr />,
                    map: (
                      <a
                        href={mapsUrl(capture.gpsLat, capture.gpsLon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        data-cc-location-maps
                      />
                    ),
                  }}
                />
              </span>
            )}
          </div>
          {/* Resend after Apply is free (2468): the new card compares against the order's
              current values, which already hold this capture. */}
          {canSend && <ResendButton variant="text" onClick={resend} resendIn={resendIn} disabled={send.isPending} />}
          <StripError text={strayRefusal} className="basis-full text-[12.5px]" />
        </div>
      )}
      {held && card && ticks && token && (
        <LocationCardView
          card={card}
          ticks={ticks}
          onTick={(next) => {
            setTicked({ token, ticks: next })
            if (!next.saveToCustomer) setSaveError(null)
          }}
          applying={apply.isPending || retryBody !== null || stampOn !== null}
          onApply={() =>
            state.transactionId && apply.mutate(applyBody(state.transactionId, newRequestId(), token, card, ticks))
          }
          error={cardError ? ('key' in cardError ? t(cardError.key) : cardError.text) : null}
          saveError={saveError ? t(saveError) : null}
          onDiscard={() => discard.mutate({ token })}
          discarding={discard.isPending}
          onResend={canSend ? resend : undefined}
          resendIn={resendIn}
          resending={send.isPending}
          onCreateAddress={createAddress}
        />
      )}
      {held && card && <StripError text={strayRefusal} className="text-[12.5px]" />}
      {held && view && !applied && !card && (
        <LocationStrip
          view={view}
          maskedMobile={held.maskedMobile}
          resendIn={resendIn}
          resending={send.isPending}
          onResend={canSend ? resend : undefined}
          onSendAgain={canSend ? openDialog : undefined}
          error={strayRefusal}
        />
      )}
      <Modal
        open={confirmingResend}
        onClose={() => setConfirmingResend(false)}
        title={t('location.resendConfirm.title')}
        width="26rem"
        footer={
          <>
            <Button variant="text" onClick={() => setConfirmingResend(false)} data-cc-location-resend-keep>
              {t('location.resendConfirm.keep')}
            </Button>
            <Button variant="primary" onClick={confirmResend} data-cc-location-resend-yes>
              {t('location.resendConfirm.yes')}
            </Button>
          </>
        }
      >
        <p className="text-sm" data-cc-location-resend-confirm>
          {t('location.resendConfirm.body')}
        </p>
      </Modal>
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
              disabled={send.isPending || mobile.trim() === '' || sendIn > 0}
              data-cc-location-submit
              data-cc-location-submit-in={sendIn}
            >
              {send.isPending ? (
                t('location.send.sending')
              ) : sendIn > 0 ? (
                // The cooldown after a send that may have gone (or a link sent seconds ago).
                <span dir="auto">
                  <Trans
                    t={t}
                    ns="callcenter"
                    i18nKey="location.send.confirmIn"
                    values={{ seconds: sendIn }}
                    components={{ seconds: <Ltr /> }}
                  />
                </span>
              ) : (
                t('location.send.confirm')
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm" data-cc-location-dialog>
          <p className="text-muted-foreground">{t('location.send.body')}</p>
          <Field
            label={t('location.send.mobile')}
            error={
              refusal?.at === 'mobile' ? (
                <span data-cc-location-mobile-error>
                  <bdi>{refusalText(refusal, t)}</bdi>
                </span>
              ) : undefined
            }
          >
            <Input
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="off"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value)
                if (refusal?.at === 'mobile') setRefusal(null)
              }}
              className="w-full text-start"
              data-cc-location-mobile
            />
          </Field>
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

/** A refusal drawn outside the dialog (a Resend's, under the strip, card or chip). */
function StripError({ text, className = '' }: { text: string | null; className?: string }) {
  if (!text) return null
  return (
    <p className={`text-danger-800 ${className}`} data-cc-location-strip-error>
      <bdi>{text}</bdi>
    </p>
  )
}

/** The countdown's slot: a machine value (`mm:ss`), isolated whole (bidi rule), in tabular
 *  figures so the line does not jitter as it ticks. */
function Clock({ children }: { children?: ReactNode }) {
  return (
    <Ltr>
      <span data-cc-location-clock className="tabular-nums">
        {children}
      </span>
    </Ltr>
  )
}

/** The waiting strip (2468): one line, its state, and the one act that state offers — none
 *  when the order may no longer send a link (`onResend` / `onSendAgain` absent). */
function LocationStrip({
  view,
  maskedMobile,
  resendIn,
  resending,
  onResend,
  onSendAgain,
  error,
}: {
  view: StripView
  maskedMobile: string
  /** Seconds left on the Resend cooldown. */
  resendIn: number
  resending: boolean
  onResend?: () => void
  onSendAgain?: () => void
  error: string | null
}) {
  const { t } = useTranslation('callcenter')
  const act = stripAct(view.kind)
  const live = act === 'resend'
  /** A link that can no longer bring a location: Send again is the one act left. */
  const dead = act === 'sendAgain'
  const tone = dead
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
            components={{ mobile: <Ltr />, clock: <Clock /> }}
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
        {view.kind === 'gone' && t('location.strip.gone')}
        {view.kind === 'discarded' && t('location.strip.discarded')}
      </span>
      {live && onResend && <ResendButton variant="outlined" onClick={onResend} resendIn={resendIn} disabled={resending} />}
      {dead && onSendAgain && (
        <Button variant="secondary" onClick={onSendAgain} data-cc-location-again>
          {t('location.strip.sendAgain')}
        </Button>
      )}
      <StripError text={error} className="basis-full" />
    </div>
  )
}
