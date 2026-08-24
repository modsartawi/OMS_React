import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Minus, Plus, Undo2 } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { mintRequestId } from '@/core/util/request-id'
import { formatMoney } from '@/core/util/number-format'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { documentApi } from './api'
import PickupAddressPanel from './PickupAddressPanel'
import NoteField from './NoteField'
import {
  buildCreateReturnRequest,
  clampReturnQuantity,
  pickupAddressFrom,
  refundableFees,
  returnableLines,
  submitGate,
  type PickupAddress,
  type ReturnableLine,
  type ReturnLineSelection,
  type ReturnReason,
} from './return-order'

/** The two reasons, in the order the build target draws them. */
const REASONS: ReturnReason[] = ['RTRF', 'RF']

/**
 * One line's state while the dialog is open.
 *
 * `draft` is what is IN the quantity box; `quantity` is what the gate reads. They
 * separate because a box being typed into passes through states no rule should
 * judge — `1` on the way to `12`, and empty on the way to anything. The clamp
 * lands on blur, exactly as 1270's build target does it, so the operator is
 * never fighting a value that rewrites itself under the caret.
 */
interface LineState extends ReturnLineSelection {
  draft: string
}

const UNPICKED: LineState = { picked: false, quantity: null, draft: '' }

/**
 * What a row's state becomes when it is ticked or unticked: ticking pre-fills
 * everything still returnable, unticking forgets the number entirely. One
 * function, because the select-all must not be able to drift from the per-row
 * tick it stands in for.
 */
function pickedState(row: ReturnableLine, picked: boolean): LineState {
  return picked
    ? { picked: true, quantity: row.remaining, draft: String(row.remaining) }
    : { ...UNPICKED }
}

/**
 * Screen 2 — the bonded return dialog (spec 289 D1, ticket 291).
 *
 * A return is **one decision taken about the delivery you are looking at**, so
 * it opens OVER Document Details rather than navigating away: the identity band,
 * status rail and summary rail stay behind it as the context the decision is
 * checked against. `Modal` already gives the wide max-width, the internally
 * scrolling body and the pinned footer — nothing new is built in `core/ui`.
 *
 * The line grid and the submit gate landed with 291, the reason fork and its
 * address panel with 292, the fee grid and the note with 293, and the create
 * call and its three outcomes with 294.
 *
 * **The dialog IS the confirmation** (D8) — the same rule `ChangeStoreDialog`
 * follows. There is no pre-confirm and `core/services/confirm` is not on this
 * path: a screen the operator has just filled in is not confirmed twice.
 *
 * The grid is a plain table rather than an AG Grid: 1270's approved build target
 * draws it as one, every row carries interactive controls rather than values,
 * and a virtualising grid would remove from the DOM the very rows the hidden /
 * absent distinction is about.
 */
export default function ReturnDialog({
  open,
  onClose,
  onCreated,
  document,
}: {
  open: boolean
  onClose: () => void
  /**
   * A return exists on the server. The page closes this dialog and **reloads**
   * the delivery beneath it, so the screen the operator comes back to shows the
   * newly-consumed quantities. It does NOT navigate to the created return —
   * whether Document Details can open an `ORRT` at all is unverified, and the
   * toast carries the number either way (D8).
   */
  onCreated: () => void
  document: SdDocumentHeaderModel
}) {
  const { t } = useTranslation('document')
  const [lineState, setLineState] = useState<Record<number, LineState>>({})
  /**
   * **Neither reason pre-selected** (D5). `null` is the gate's third missing
   * thing, not a state to be helpfully filled in: `RF` refunds immediately with
   * nothing coming back, and a default radio is how that gets clicked through.
   */
  const [reason, setReason] = useState<ReturnReason | null>(null)
  /**
   * The return's own reason in words — **optional**. Requiring it manufactures
   * the word "return" typed into a box; the structured reason above is what
   * actually drives behaviour. It is NOT the `add-note` action's note, which is
   * running commentary on a document.
   */
  const [note, setNote] = useState('')
  /** The delivery's own address — what the draft starts from and can return to. */
  const delivered = useMemo(
    () => pickupAddressFrom(document.shippingAddress),
    [document.shippingAddress],
  )
  const [address, setAddress] = useState<PickupAddress>(delivered)
  /**
   * Which fees carry back, keyed by the condition TYPE — the only part of a fee
   * row that ever reaches the wire (294). **Empty on open**, and it stays that
   * way until an operator ticks something: refunding a delivery fee is a
   * concession, the service having actually been performed.
   */
  const [feePicks, setFeePicks] = useState<Record<string, boolean>>({})
  /**
   * The idempotency key, **minted once per dialog OPENING and kept across
   * retries** (D7). That is what makes the key work: a double-click, a lost
   * response and a manual retry after a network failure all carry the same key
   * and replay onto the same return. A fresh key per press would create a second
   * one — precisely the failure the key exists to prevent.
   *
   * Cancelling and reopening mints a new one: a deliberate new attempt is a new
   * request.
   */
  const [requestId, setRequestId] = useState('')
  /**
   * The server's refusal, **kept after its toast has gone**. A refusal the
   * operator can act on must not cost them the form, and a sentence that
   * vanished four seconds ago is one they cannot act on.
   */
  const [refusal, setRefusal] = useState<{ message: string; code: string | null } | null>(null)

  const collecting = reason === 'RTRF'

  // Hiding is the projection's job (D3): the grid renders exactly what it is
  // handed, and the header states what was left out.
  const { rows, hiddenCount, notReturnableCount } = useMemo(
    () => returnableLines(document.lines),
    [document.lines],
  )
  const stateOf = (row: ReturnableLine): LineState => lineState[row.lineNumber] ?? UNPICKED

  // The fee projection (D3) — the header rows alone, at their `condAmount`
  // rate. The grid renders what it is handed and sums nothing.
  const fees = useMemo(() => refundableFees(document.conditions), [document.conditions])

  // The ticked fees, counted off the PROJECTION — a tick left behind by a fee
  // the grid no longer offers is stale state, and the summary must count what
  // would actually post.
  const pickedFees = fees.filter((fee) => feePicks[fee.condType] === true)
  const gate = useMemo(
    () => submitGate(rows.map(stateOf), reason, pickedFees.length),
    [rows, lineState, reason, pickedFees.length],
  )

  /**
   * ⚠ **A second guard on the in-flight state, and not a redundant one.**
   * `create.isPending` only disables the button on the next RENDER; a ref flips
   * synchronously, so two clicks landing before React re-renders still post
   * once. The customer is not refunded twice because of a double-click.
   */
  const inFlight = useRef(false)

  const create = useMutation({
    mutationFn: documentApi.createReturn,
    onSuccess: (created, body) => {
      // Replay is a SUCCESS, and reads as one: the same toast with one extra
      // clause. Showing an error about a return that WAS created is the
      // confusing half of the problem the key solves (D8).
      notify.success(
        t('returnDocument.created.title', { documentNo: created.documentNo }),
        [
          t(`returnDocument.created.next.${body.reason}`),
          created.replayed ? t('returnDocument.created.replayed') : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
      onCreated()
    },
    onError: (err: unknown) => {
      // ⚠ The screen branches on NO code: it renders whichever sentence and
      // code it is handed. BackOffice spec 1283 §8 mints the values and calls
      // them build detail — hard-coding one here is how this repo drifts from a
      // policy that moves. 401 is not ours either: `handle401` has already
      // cleared the session and redirected.
      const fallback = t('returnDocument.refused.fallback')
      setRefusal({ message: apiErrorMessage(err, fallback), code: apiErrorCode(err) })
      // `apiError` rather than a bare `error`: it reads the same sentence the
      // banner shows, and it clears the repeating auth/network toasts first.
      notify.apiError(t('returnDocument.refused.title'), err, fallback)
    },
    onSettled: () => {
      inFlight.current = false
    },
  })

  /**
   * Build the body and post it. The request builder is the one place that turns
   * this screen into a payload — and the one place a client-supplied amount
   * could reappear, which is why it is pure and tested rather than inline here.
   */
  function submit() {
    if (!gate.ok || reason === null || inFlight.current || create.isPending) return
    inFlight.current = true
    // The previous refusal goes when a new attempt starts: a banner about the
    // last try, left standing beside a running one, states something untrue.
    setRefusal(null)
    create.mutate(
      buildCreateReturnRequest({
        requestId,
        // The DELIVERY this dialog was opened on — never an order number. The
        // command is disabled on anything that is not a delivery (290).
        refDeliveryNo: document.documentNo,
        reason,
        rows,
        selections: lineState,
        fees,
        feePicks,
        address,
        note,
      }),
    )
  }

  /**
   * Every dismissal path is held shut while the request is in flight (D8), so
   * an impatient Escape cannot leave a return being created behind a screen that
   * says nothing about it.
   */
  function requestClose() {
    if (create.isPending) return
    onClose()
  }

  const pickedCount = rows.filter((row) => stateOf(row).picked).length
  const allPicked = rows.length > 0 && pickedCount === rows.length

  const patch = (row: ReturnableLine, next: LineState) =>
    setLineState((prev) => ({ ...prev, [row.lineNumber]: next }))

  /** Ticking a line wakes its stepper and pre-fills everything still returnable. */
  function pick(row: ReturnableLine, picked: boolean) {
    patch(row, pickedState(row, picked))
  }

  /** Select-all covers the VISIBLE rows — the hidden ones are not selectable at all. */
  function pickAll(picked: boolean) {
    setLineState(
      Object.fromEntries(rows.map((row) => [row.lineNumber, pickedState(row, picked)])),
    )
  }

  /** `−` and `+`. Both ends are also DISABLED, so zero is unreachable by pressing. */
  function step(row: ReturnableLine, delta: number) {
    const state = stateOf(row)
    if (!state.picked) return
    // A CLEARED box counts as zero here, not as the cap: `+` on an empty box
    // must step to 1 — the bottom of the range — rather than leap to everything
    // the line has left.
    const next = clampReturnQuantity((state.quantity ?? 0) + delta, row.remaining)
    patch(row, { ...state, quantity: next, draft: String(next) })
  }

  /**
   * The typed value lands in the same `[1, remaining]` range on blur — the
   * keyboard is not a way around the stepper. A box left EMPTY stays empty and
   * carries a `null` quantity: that is a missing thing the gate names, not
   * something to silently repair on the operator's behalf.
   */
  function commitDraft(row: ReturnableLine) {
    const state = stateOf(row)
    if (!state.picked) return
    if (state.draft.trim() === '') {
      patch(row, { ...state, quantity: null })
      return
    }
    const next = clampReturnQuantity(state.draft, row.remaining)
    patch(row, { ...state, quantity: next, draft: String(next) })
  }

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={t('returnDocument.title', { documentNo: document.documentNo })}
      width="62rem"
      onShow={() => {
        // Every opening starts clean, address included: an edit made in a
        // dialog that was cancelled is not a correction the next one inherits.
        setLineState({})
        setReason(null)
        setAddress(delivered)
        setFeePicks({})
        setNote('')
        setRefusal(null)
        create.reset()
        // A NEW opening is a new attempt, so it gets a new key. Within one
        // opening the key never changes — that is what makes a retry replay
        // onto the same return instead of creating a second one (D7).
        // ⚠ NOT `crypto.randomUUID()`: it is undefined outside a SECURE context,
        // and this app is served over plain http from IIS — the dialog would
        // throw as it opened. `mintRequestId` keeps the entropy and hand-rolls
        // only the formatting.
        setRequestId(mintRequestId())
      }}
      footer={
        <>
          {/*
            `Modal`'s footer is `justify-end`, so the gate sentence rides on
            `me-auto` — the build target's own arrangement. It states ONE missing
            thing at a time, in the order the operator must act, and flips to a
            plain summary once nothing is missing.
          */}
          <span
            data-return-gate={gate.ok ? 'ok' : 'blocked'}
            className={
              'me-auto self-center text-[0.75rem] ' +
              (gate.ok ? 'text-muted-foreground' : 'font-semibold text-danger-800')
            }
          >
            {t(gate.key, gate.params)}
            {/*
              The fee half of the summary. Two independent counts cannot plural
              through one key, so they are two — joined here with the same `·`
              the address summary is joined with.
            */}
            {gate.fees ? ' · ' + t(gate.fees.key, gate.fees.params) : ''}
          </span>
          <Button variant="text" onClick={requestClose} disabled={create.isPending}>
            {t('dialog.cancel')}
          </Button>
          {/*
            The submit IS the confirmation, and it is the only one. Disabled
            while the gate names a missing thing and while the request is in
            flight, so impatience cannot fire it twice.
          */}
          <Button
            variant="primary"
            disabled={!gate.ok || create.isPending}
            onClick={submit}
            data-return-submit
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {create.isPending ? t('returnDocument.submitting') : t('returnDocument.submit')}
          </Button>
        </>
      }
    >
      {/*
        ⚠ The refusal **STAYS** — the toast beside it does not. It carries the
        server's own sentence with the machine code beside it, so the operator
        can still read what went wrong after the toast has gone, and can quote
        the code when they ask someone. Every selection below it is untouched: a
        refusal the operator can act on must not cost them the form (D8).
      */}
      {refusal && (
        <div className="mb-3" data-return-refusal>
          <ErrorBanner className="p-2.5" title={t('returnDocument.refused.title')} message={refusal.message}>
            {refusal.code && (
              <p className="mt-0.5 font-mono text-[0.6875rem]" data-return-refusal-code>
                {refusal.code}
              </p>
            )}
          </ErrorBanner>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2">
          <h4 className="m-0 text-[0.8125rem] font-semibold tracking-tight">
            {t('returnDocument.lines.title')}
          </h4>
          {/*
            A missing line must never be something an operator has to wonder
            about: when the projection hid any, the header says how many.
          */}
          <span className="text-[0.75rem] text-muted-foreground" data-return-hidden={hiddenCount}>
            {hiddenCount > 0
              ? t('returnDocument.lines.hidden', { count: hiddenCount })
              : t('returnDocument.lines.capHint')}
          </span>
          {/*
            A struck line and a line delivered in no quantity left through the
            OTHER tally, and they say something different: nothing was returned
            off them, so they must not be counted as though it had been.
          */}
          {notReturnableCount > 0 && (
            <span
              className="text-[0.75rem] text-muted-foreground"
              data-return-not-returnable={notReturnableCount}
            >
              {t('returnDocument.lines.notReturnable', { count: notReturnableCount })}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="m-0 px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">
            {t('returnDocument.lines.empty')}
          </p>
        ) : (
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border/60 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                <th className="w-9 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={allPicked}
                    ref={(el) => {
                      if (el) el.indeterminate = pickedCount > 0 && !allPicked
                    }}
                    onChange={(e) => pickAll(e.target.checked)}
                    aria-label={t('returnDocument.lines.selectAll')}
                    data-return-select-all
                  />
                </th>
                <th className="w-10 px-2 py-1.5 text-start">
                  {t('returnDocument.lines.columns.lineNumber')}
                </th>
                <th className="px-2 py-1.5 text-start">
                  {t('returnDocument.lines.columns.itemNumber')}
                </th>
                <th className="px-2 py-1.5 text-start">
                  {t('returnDocument.lines.columns.itemDescription')}
                </th>
                <th className="w-14 px-2 py-1.5 text-start">
                  {t('returnDocument.lines.columns.uom')}
                </th>
                <th className="w-36 px-2 py-1.5 text-end">
                  {t('returnDocument.lines.columns.returnQuantity')}
                </th>
                <th className="w-24 px-2 py-1.5 text-end">
                  {t('returnDocument.lines.columns.unitPrice')}
                </th>
                <th className="w-24 px-2 py-1.5 text-end">
                  {t('returnDocument.lines.columns.lineValue')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = stateOf(row)
                return (
                  <tr
                    key={row.lineNumber}
                    className={
                      'border-b border-border/40 last:border-b-0 ' + (state.picked ? 'bg-accent' : '')
                    }
                    data-return-row={row.lineNumber}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={state.picked}
                        onChange={(e) => pick(row, e.target.checked)}
                        aria-label={t('returnDocument.lines.selectLine', {
                          lineNumber: row.lineNumber,
                        })}
                        data-return-pick={row.lineNumber}
                      />
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{row.lineNumber}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.itemNumber}</td>
                    <td className="px-2 py-1.5">{row.itemDescription}</td>
                    <td className="px-2 py-1.5">{row.uom}</td>
                    <td className="px-2 py-1.5">
                      {/*
                        Inert until the line is ticked: the screen never invites
                        a number that will not be sent. `−` stops at 1 and `+` at
                        the cap, so zero is unreachable by PRESSING rather than
                        refused after the fact.
                      */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border disabled:opacity-40"
                          disabled={!state.picked || (state.quantity ?? 0) <= 1}
                          onClick={() => step(row, -1)}
                          aria-label={t('returnDocument.lines.decrease', {
                            lineNumber: row.lineNumber,
                          })}
                          data-return-step={`${row.lineNumber}:-1`}
                        >
                          <Minus className="h-3 w-3" aria-hidden />
                        </button>
                        <input
                          className="h-6 w-12 rounded-md border border-border bg-card px-1 text-center tabular-nums disabled:opacity-40"
                          inputMode="numeric"
                          disabled={!state.picked}
                          value={state.draft}
                          onChange={(e) => patch(row, { ...state, draft: e.target.value })}
                          onBlur={() => commitDraft(row)}
                          aria-label={t('returnDocument.lines.quantityLabel', {
                            lineNumber: row.lineNumber,
                          })}
                          data-return-qty={row.lineNumber}
                        />
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border disabled:opacity-40"
                          disabled={!state.picked || (state.quantity ?? 0) >= row.remaining}
                          onClick={() => step(row, 1)}
                          aria-label={t('returnDocument.lines.increase', {
                            lineNumber: row.lineNumber,
                          })}
                          data-return-step={`${row.lineNumber}:1`}
                        >
                          <Plus className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                      {/*
                        Two different facts, phrased differently: a line something
                        has already come back from reads *of N left*, an untouched
                        one *of N delivered* — so a partial return is discovered
                        here rather than as a 400 after submitting.
                      */}
                      <div
                        className="mt-0.5 text-end text-[0.6875rem] text-muted-foreground"
                        data-return-of={row.lineNumber}
                      >
                        {t(
                          row.returned > 0
                            ? 'returnDocument.lines.ofLeft'
                            : 'returnDocument.lines.ofDelivered',
                          { count: row.remaining },
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{formatMoney(row.unitPrice)}</td>
                    {/*
                      Money as CONTEXT only, and there is no grand total: the
                      server recomputes discount and VAT pro-rata, so any total
                      this client added up would be a number it invented and an
                      operator would quote to a customer.
                    */}
                    <td className="px-2 py-1.5 text-end tabular-nums" data-return-value={row.lineNumber}>
                      {state.picked && state.quantity !== null
                        ? formatMoney(row.unitPrice * state.quantity)
                        : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>


      {/*
        ⚠ **Stacked below the line grid, never behind a tab** (D12). The fee grid
        is two rows and is not a peer of the line grid; a tab here would hide a
        SELECTION the submit is about to act on, not merely a reading — which is
        what Document Details' own tabs hide.
      */}
      <div className="mt-3 rounded-lg border border-border" data-return-fees={fees.length}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2">
          <h4 className="m-0 text-[0.8125rem] font-semibold tracking-tight">
            {t('returnDocument.fees.title')}
          </h4>
          {/*
            Why nothing is ticked, said out loud — so an empty column reads as
            the guard it is rather than as a step the operator forgot.
          */}
          <span className="text-[0.75rem] text-muted-foreground">
            {t('returnDocument.fees.hint')}
          </span>
        </div>
        {fees.length === 0 ? (
          <p className="m-0 px-3 py-4 text-center text-[0.8125rem] text-muted-foreground">
            {t('returnDocument.fees.empty')}
          </p>
        ) : (
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border/60 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                {/*
                  ⚠ **No select-all here, deliberately** — unlike the line grid
                  above. A tick-everything control beside a guard that exists on
                  purpose is a one-click way through it, and every fee refunded
                  is a service that was performed and is being given back anyway.
                */}
                <th className="w-9 px-2 py-1.5" />
                <th className="px-2 py-1.5 text-start">{t('returnDocument.fees.columns.fee')}</th>
                <th className="w-28 px-2 py-1.5 text-end">
                  {t('returnDocument.fees.columns.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => {
                const on = feePicks[fee.condType] === true
                return (
                  <tr
                    key={fee.condType}
                    className={
                      'border-b border-border/40 last:border-b-0 ' + (on ? 'bg-accent' : '')
                    }
                    data-return-fee-row={fee.condType}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setFeePicks((prev) => ({ ...prev, [fee.condType]: e.target.checked }))
                        }
                        aria-label={t('returnDocument.fees.selectFee', {
                          description: fee.description,
                        })}
                        data-return-fee={fee.condType}
                      />
                    </td>
                    <td className="px-2 py-1.5">{fee.description}</td>
                    {/*
                      The RATE, as context for the decision — `condAmount`, which
                      the projection read for exactly this reason. It is never on
                      the wire: 294 sends the fee's TYPE and nothing else.
                    */}
                    <td
                      className="px-2 py-1.5 text-end tabular-nums"
                      data-return-fee-amount={fee.condType}
                    >
                      {formatMoney(fee.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/*
        The most consequential control on the screen. The two options are CARDS
        carrying their consequence in the operator's language, not bare radio
        labels: Refund Only never touches the carrier — it refunds now and the
        customer keeps the goods — and that is a sentence, not a word.
      */}
      <div className="mt-3 rounded-lg border border-border p-3">
        <h4 className="m-0 mb-2 text-[0.8125rem] font-semibold tracking-tight">
          {t('returnDocument.reason.title')}
        </h4>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label={t('returnDocument.reason.title')}
          // A radiogroup is ARROWED, not tabbed through: a keyboard operator who
          // presses → on the first card expects the second, and a `role="radio"`
          // that ignores it is a claim the control does not honour. There are
          // exactly two, so any arrow moves to the other one.
          onKeyDown={(e) => {
            if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return
            e.preventDefault()
            const next: ReturnReason = reason === 'RTRF' ? 'RF' : 'RTRF'
            setReason(next)
            // Focus follows the selection, as it does in a real radiogroup.
            e.currentTarget
              .querySelector<HTMLButtonElement>(`[data-return-reason="${next}"]`)
              ?.focus()
          }}
        >
          {REASONS.map((option) => {
            const on = reason === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={on}
                // One tab stop for the group, as a radiogroup has: the chosen
                // card, or — with nothing chosen yet — the first.
                tabIndex={on || (reason === null && option === REASONS[0]) ? 0 : -1}
                onClick={() => setReason(option)}
                className={
                  'flex items-start gap-2 rounded-lg border p-2.5 text-start ' +
                  (on ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50')
                }
                data-return-reason={option}
                data-on={on ? 1 : 0}
              >
                <span
                  className={
                    'mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ' +
                    (on ? 'border-primary bg-primary' : 'border-border')
                  }
                  aria-hidden
                />
                <span>
                  <span className="block text-[0.8125rem] font-semibold">
                    {t(`returnDocument.reason.${option}.title`)}
                  </span>
                  <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                    {t(`returnDocument.reason.${option}.consequence`)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/*
        ⚠ Under Refund Only this panel is ABSENT — not disabled, not greyed.
        Nothing collects, so there is nothing to address, and removing it makes
        the two reasons visibly different screens rather than one form with an
        inert region. It is absent before a reason is chosen for the same reason:
        no collection has been decided on yet.
      */}
      {collecting && (
        <PickupAddressPanel delivered={delivered} address={address} onChange={setAddress} />
      )}

      {/*
        The last field, and an OPTIONAL one: the return's own reason in words,
        which the warehouse reads when the goods arrive. Requiring it only
        manufactures the word "return" typed into a box — the structured reason
        above is what drives behaviour.
      */}
      <div className="mt-3" data-return-note-field>
        <NoteField
          id="return-note"
          value={note}
          onChange={setNote}
          rows={2}
          label={t('returnDocument.note.label')}
          placeholder={t('returnDocument.note.placeholder')}
        />
      </div>
    </Modal>
  )
}
