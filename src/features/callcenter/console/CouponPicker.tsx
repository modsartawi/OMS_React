/**
 * PROTOTYPE (wayfinder ticket 159) — *has the caller got a coupon?*
 *
 * The coupon chip's modal, and the console's ONLY coupon surface. Owner ruling
 * (2026-07-29): the coupon is a chip in the header row, not a row in the live
 * receipt. So its money is drawn here, where there is room to label it, and the
 * receipt goes on reporting the engine's totals with no coupon line of its own —
 * which also keeps a coupon from reading as a fourth near-miss class beside
 * [138](.issues/138-near-miss-guidance-design.md)'s guidance cards.
 *
 * Three things this file exists to hold:
 *
 * 1. 🚩 **Applying is a one-way act, and the entry says so before it is one.**
 *    The redeem burns the customer's code at the coupon service *before* the
 *    engine sees it (`CallCenterSessionService.Verbs.cs` — redeem first, then
 *    add), so a mistyped-but-valid code spends something real. The read-back
 *    line is not decoration; it is the only cheap moment in the whole flow.
 * 2. 🚩 **Removing is not undoing.** `removeCoupon` reverses the burn and only
 *    then voids the line — issue 211's ordering, which the till already defends
 *    (*"never a line whose code stays burned, never a released code whose line
 *    the customer still pays for"*). Its refusal therefore means **nothing
 *    changed**, which is the opposite of what a failed remove usually means, and
 *    the wording has to carry that.
 * 3. **A refusal is sayable out loud.** `COUPON_REJECTED` carries the coupon
 *    service's own message and the agent is on the phone; the console shows that
 *    message rather than a code, and never dresses a transport fault as a bad
 *    coupon — the server already refuses to (§7).
 *
 * It decides nothing. Both verbs return the whole `SessionState`.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Ticket, X } from 'lucide-react'
import type { AppliedCoupon } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import ChipSection from './ChipSection'
import { NOTE } from './console-notes'
import type { CouponSurface } from './coupon-view'
import Money from './Money'

export default function CouponPicker({
  open,
  surface,
  /** The code currently being applied, or being removed. Only one of the two can
   *  be in flight — they are one act on one order. */
  pendingApply,
  pendingRemove,
  /** Whichever verb last failed, already worded by the caller. Drawn under the
   *  control that caused it, not at the top: a refused remove reported above the
   *  entry box reads as a refused apply. */
  applyError,
  removeError,
  onApply,
  onRemove,
  onClose,
}: {
  open: boolean
  surface: CouponSurface
  pendingApply: boolean
  pendingRemove: string | null
  applyError: string | null
  removeError: string | null
  onApply: (code: string) => void
  onRemove: (code: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [code, setCode] = useState('')
  const busy = pendingApply || pendingRemove !== null

  // The box empties when the modal closes, not when a code lands: an agent who
  // reopens it is starting a new question, and a code left standing is one
  // Enter away from a second burn.
  useEffect(() => {
    if (!open) setCode('')
  }, [open])

  const apply = (event: React.FormEvent) => {
    event.preventDefault()
    const value = code.trim()
    if (!value || busy) return
    onApply(value)
    setCode('')
  }

  return (
    <ChipSection
      open={open}
      onClose={() => !busy && onClose()}
      name="coupon"
      title={t('coupon.title')}
      width="32rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-coupon-close>
          {t('coupon.close')}
        </Button>
      }
    >
      <div className="space-y-3" data-cc-coupon-picker>
        {/* ---- what the order already holds ------------------------------- */}
        {surface.coupons.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-cc-coupon-none>
            {t('coupon.none')}
          </p>
        ) : (
          <ul className="space-y-1.5" data-cc-coupon-applied>
            {surface.coupons.map((coupon) => (
              <AppliedRow
                key={coupon.code}
                coupon={coupon}
                canRemove={surface.canRemove}
                pending={pendingRemove === coupon.code}
                busy={busy}
                onRemove={() => onRemove(coupon.code)}
              />
            ))}
          </ul>
        )}

        {/* 🚩 A refused REMOVE means nothing changed — the reverse is attempted
            first and the void never runs without it. So it sits with the applied
            list it did not alter, and its wording says the coupon is still on
            the order, which is the fact the agent has to relay. */}
        {removeError && (
          <p className={NOTE.danger} data-cc-coupon-remove-error>
            {removeError}
          </p>
        )}

        {/* ---- the way in --------------------------------------------------- */}
        {surface.canApply ? (
          <form onSubmit={apply} className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="cc-coupon-code">
              {t('coupon.codeLabel')}
            </label>
            <div className="flex gap-1.5">
              <input
                id="cc-coupon-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={t('coupon.codePlaceholder')}
                aria-label={t('coupon.codeLabel')}
                disabled={busy}
                data-cc-coupon-input
                className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-50"
              />
              <Button type="submit" disabled={!code.trim() || busy} data-cc-coupon-apply>
                {pendingApply ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  t('coupon.apply')
                )}
              </Button>
            </div>

            {/* 🚩 The read-back. The redeem burns the code before the engine ever
                sees it, and `removeCoupon` gives it back only when the coupon
                service agrees to — so the moment BEFORE the press is the cheap
                one, and this is the sentence that makes it cheap. */}
            <p className="text-xs text-muted-foreground" data-cc-coupon-readback>
              {t('coupon.readBack')}
            </p>

            {applyError && (
              <p className={NOTE.danger} data-cc-coupon-apply-error>
                {applyError}
              </p>
            )}
          </form>
        ) : (
          /* 153's rule: a control the door would refuse is worse than no control
             — but an empty answer teaches nothing, so the reason is stated. The
             live one in phase 1 is the opening gate: no caller, or a store the
             agent has not chosen, and burning a coupon against a seeded store
             writes it to a pharmacy the order will not ship from. */
          <p className={NOTE.quiet} data-cc-coupon-shut={surface.applyReason ?? ''}>
            {t(surface.applyReason ? `coupon.shut.${surface.applyReason}` : 'coupon.shut.unknown', {
              defaultValue: t('coupon.shut.unknown'),
            })}
          </p>
        )}
      </div>
    </ChipSection>
  )
}

function AppliedRow({
  coupon,
  canRemove,
  pending,
  busy,
  onRemove,
}: {
  coupon: AppliedCoupon
  canRemove: boolean
  pending: boolean
  busy: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <li
      className="flex items-center gap-2 rounded-md border border-border bg-muted p-2.5"
      data-cc-coupon-row={coupon.code}
    >
      <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{coupon.code}</div>
        {/* The campaign's own words. Null is ordinary — the code alone then, never
            a phrase the console invented for a promotion it does not model. */}
        {coupon.description && (
          <div className="truncate text-xs text-muted-foreground">{coupon.description}</div>
        )}
      </div>
      {/* Engine money, in the one place a coupon's amount is drawn. */}
      <Money value={coupon.amount} />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          data-cc-coupon-remove={coupon.code}
          aria-label={t('coupon.remove')}
          title={t('coupon.remove')}
          className="rounded-md border border-input p-1.5 hover:bg-accent disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <X className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    </li>
  )
}
