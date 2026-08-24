import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, Undo2 } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { formatMoney } from '@/core/util/number-format'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import PickupAddressPanel from './PickupAddressPanel'
import {
  clampReturnQuantity,
  pickupAddressFrom,
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
 * This slice carries the line grid and the first two outcomes of the submit
 * gate. The reason fork and its address panel (292), the fee grid and the note
 * (293) and the create call itself (294) land after it — **Create return is
 * disabled by construction here**, because there is nothing to post yet.
 *
 * The grid is a plain table rather than an AG Grid: 1270's approved build target
 * draws it as one, every row carries interactive controls rather than values,
 * and a virtualising grid would remove from the DOM the very rows the hidden /
 * absent distinction is about.
 */
export default function ReturnDialog({
  open,
  onClose,
  document,
}: {
  open: boolean
  onClose: () => void
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
  /** The delivery's own address — what the draft starts from and can return to. */
  const delivered = useMemo(
    () => pickupAddressFrom(document.shippingAddress),
    [document.shippingAddress],
  )
  const [address, setAddress] = useState<PickupAddress>(delivered)

  const collecting = reason === 'RTRF'

  // Hiding is the projection's job (D3): the grid renders exactly what it is
  // handed, and the header states what was left out.
  const { rows, hiddenCount, notReturnableCount } = useMemo(
    () => returnableLines(document.lines),
    [document.lines],
  )
  const stateOf = (row: ReturnableLine): LineState => lineState[row.lineNumber] ?? UNPICKED

  const gate = useMemo(() => submitGate(rows.map(stateOf), reason), [rows, lineState, reason])

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
      onClose={onClose}
      title={t('returnDocument.title', { documentNo: document.documentNo })}
      width="62rem"
      onShow={() => {
        // Every opening starts clean, address included: an edit made in a
        // dialog that was cancelled is not a correction the next one inherits.
        setLineState({})
        setReason(null)
        setAddress(delivered)
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
          </span>
          <Button variant="text" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          {/*
            Disabled by construction until 294 builds the request and posts it.
            The gate above is already live, so the bar reports the next thing to
            do even while the button it guards cannot yet be taken.
          */}
          <Button variant="primary" disabled data-return-submit>
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {t('returnDocument.submit')}
          </Button>
        </>
      }
    >
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
    </Modal>
  )
}
