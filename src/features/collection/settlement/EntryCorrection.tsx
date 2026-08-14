import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import Button from '@/core/ui/Button'
import type { AccountEntryRow } from './account-projection'
import { settlementApi } from './api'
import {
  afterRefusedCancel,
  afterRefusedCloseOut,
  correctionFor,
  type CancelRefusal,
  type CloseOutRefusal,
  type CorrectionOffer,
} from './correction'
import { REASON_MAX } from './posting'
import ReasonField, { invalidateSettlement } from './ReasonField'

/**
 * **The correction** — one button whose meaning the entry decides (ticket 272,
 * spec 267 D5).
 *
 * 🔑 **The screen never offers both acts.** Untouched ⇒ *Cancel this entry*. Partly
 * consumed ⇒ *Write off the remaining 400.000*, with the reason it cannot be
 * cancelled beside it. A menu offering both is a menu on which someone eventually
 * cancels a consumed entry, so `correction.ts` decides which single affordance
 * exists and this component renders whatever comes back — it never tests a status
 * itself.
 *
 * 🚩 **It is a panel above the journal, not a modal, and that is the ticket's
 * point.** What a write-off does *not* touch — a receipt already in a collector's
 * hands is never retro-voided — is more convincing **shown** than asserted, and a
 * journal that vanished behind a dialog the moment the act began could not show it.
 * The rows underneath stay on screen through the whole correction and are unchanged
 * after it.
 *
 * 🔑 **A cancel that loses the race is not an error.** The server's predicate is
 * inside its UPDATE, so a till consuming a millisecond earlier wins; that arrives as
 * a 200 with `accepted: false` and a true remaining, and this panel comes back with
 * *"a till consumed part of this — here is the new remaining"* and the write-off in
 * reach. An error toast there would teach an accountant to distrust a screen that is
 * working exactly as designed.
 *
 * ⚠️ *"Changing the amount is not offered at all"* is **said out loud** here, in
 * every state including the ones with no button, because the absence of an amend is
 * otherwise indistinguishable from an oversight.
 */
/** What a correction is sent WITH — the entry it is about and the words filed
 *  against it, both captured at the press rather than read back from whatever the
 *  grid is showing when the server answers. */
type CorrectionVars = { row: AccountEntryRow; reason: string }

export default function EntryCorrection({
  row,
  currencyKey,
}: {
  row: AccountEntryRow | null
  currencyKey: string
}) {
  const { t } = useTranslation('settlement')
  const queryClient = useQueryClient()

  /** Which act the accountant has opened a reason box for — `null` while the panel
   *  is only offering one. The reason is required, so the act is a two-step even
   *  though it is one button: a correction with no words is a row somebody reads
   *  months later with nothing to go on. */
  const [act, setAct] = useState<'cancel' | 'write-off' | null>(null)
  const [reason, setReason] = useState('')
  /** 🔑 What a refused cancel came back with. It **replaces** the affordance rather
   *  than sitting beside it: after a lost race the entry offers the write-off. */
  const [raced, setRaced] = useState<CancelRefusal | null>(null)
  /** A refused close-out, as a tagged union from the same pure module the cancel's
   *  refusal goes through. 🚩 It used to be a bare `number | null` with `-1` for
   *  *"no figure"* — a magic number on a panel where every other number is money,
   *  and the one refusal path that had no test behind it. */
  const [closeOutRefused, setCloseOutRefused] = useState<CloseOutRefusal | null>(null)

  // ⚠️ Every piece of local state is per ENTRY. A reason typed about entry 143 must
  // not be sitting in the box when 151 is selected, and a race lost on one entry
  // must not describe another one's remaining.
  const entryId = row?.settlementEntryId ?? ''
  useEffect(() => {
    setAct(null)
    setReason('')
    setRaced(null)
    setCloseOutRefused(null)
  }, [entryId])

  // The account (so the corrected entry's status and remaining are the server's
  // again — which is also what turns this panel's affordance into *none*) plus the
  // door's three lists. One shared call, so the feature's three writers cannot drift
  // apart on which lists go stale.
  const refreshAccount = (of: AccountEntryRow) => invalidateSettlement(queryClient, of.storeId)

  // ⚠️ **The entry and its words travel WITH the request.** TanStack calls the most
  // recently registered `onSuccess`, so a `row` read from the enclosing render is the
  // row selected when the answer LANDS, not the one the act was sent for — and a
  // selection change inside one request's latency is all it takes. That would toast
  // another entry's number, refresh another branch's account, and size a write-off
  // offer from a race this entry never ran. Passing the row as the mutation's
  // variable is what makes the invariant above structural rather than hopeful.
  const stillOn = (of: AccountEntryRow) => of.settlementEntryId === entryId

  const cancelEntry = useMutation({
    mutationFn: (v: CorrectionVars) => settlementApi.cancel(v.row.settlementEntryId, v.reason),
    onSuccess: (result, v) => {
      // Always: the act happened, so the branch it happened to is stale whether or
      // not the accountant is still looking at it.
      refreshAccount(v.row)
      if (result?.accepted) {
        toast.success(t('correction.done.cancelled', { number: v.row.entryNumber }))
        if (!stillOn(v.row)) return
        setAct(null)
        setReason('')
        // ⚠️ Every notice is cleared on a settled act, not only when the selection
        // changes. A refusal left on screen through a later success would be two
        // sentences about one entry contradicting each other, with the stale one on
        // top.
        setRaced(null)
        setCloseOutRefused(null)
        return
      }
      // 🔑 The race, lost — and it is not a failure. The same rule that chose the
      // button runs again over the server's newer truth, and whatever it offers is
      // what this panel now shows.
      //
      // ⚠️ …but only while this is still the entry on screen. A notice drawn under
      // another entry's header is a sentence about the wrong money; the refetch above
      // already carries the truth, so re-selecting the entry recomputes the affordance
      // from the account rather than from a stranded notice.
      if (!stillOn(v.row)) return
      setRaced(afterRefusedCancel(v.row, result))
      setCloseOutRefused(null)
      setAct(null)
      // 🔑 **The words go with the act, not with the entry.** *"Posted onto the wrong
      // branch"* is why an accountant wanted to CANCEL; it is not why they are
      // writing off what a till has already taken, and letting it ride into the
      // write-off would file a reason nobody chose against the act that actually
      // happened — on the one field whose whole purpose is to be read months later.
      setReason('')
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('correction.errors.cancelFailed'))),
  })

  const closeOut = useMutation({
    mutationFn: (v: CorrectionVars) => settlementApi.closeOut(v.row.settlementEntryId, v.reason),
    onSuccess: (result, v) => {
      refreshAccount(v.row)
      if (result?.accepted) {
        // ⚠️ **The toast names no figure, and that is deliberate.** D8 gives this
        // answer one number called `remainingAmount`, and on a *successful*
        // write-off its meaning is genuinely ambiguous: *what was forgiven* and
        // *what is left* are both readings of that name, and they differ by the
        // whole amount. Asserting the wrong one would say *"0.00 of entry 143 is
        // written off"* on a server that meant the second. The figure is on screen
        // a moment later anyway — the refetched audit pane draws `writtenOff`,
        // which is a number 269 already reads back unambiguously. Logged for 274.
        toast.success(t('correction.done.writtenOff', { number: v.row.entryNumber }))
        if (!stillOn(v.row)) return
        setAct(null)
        setReason('')
        setRaced(null)
        setCloseOutRefused(null)
        return
      }
      // A refusal is still a 200 (D8) — and here `remainingAmount` is unambiguous:
      // nothing was forgiven, so the only thing it can mean is what the entry has
      // left.
      if (!stillOn(v.row)) return
      setCloseOutRefused(afterRefusedCloseOut(result))
      setRaced(null)
      setAct(null)
      setReason('')
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('correction.errors.closeOutFailed'))),
  })

  if (!row) return null

  // 🔑 One affordance, from one rule — and where the server has had the last word
  // on this entry, **its word beats the row**.
  const fromRow = correctionFor(row)
  // ⚠️ The race offer stands in for a row the refetch has not caught up with, and
  // **only** for that. Once the account comes back saying the entry is settled
  // (`CONSUMED` by the till that won, or `CLOSED_OUT`), `fromRow` is the truth and
  // the offer is stale — a write-off button on a finished entry would be an act the
  // server can only refuse.
  const correction: CorrectionOffer =
    raced?.kind === 'partly-consumed' && fromRow.kind !== 'none' ? raced.offer : fromRow
  // 🚩 **A refusal that did not move the remaining, and an entry a till emptied
  // mid-dialog, offer NOTHING.** Falling through to `correctionFor(row)` here would
  // re-draw the identical *Cancel this entry* button under a notice saying it cannot
  // be cancelled — the press-refuse-press loop `correction.ts` documents as
  // forbidden, and in the `nothing-left` case a live button under the sentence
  // *"there is nothing left to cancel"*. The notice above carries the explanation;
  // the next read of the account carries the next affordance.
  const blocked =
    (raced !== null && raced.kind !== 'partly-consumed') || closeOutRefused !== null
  const busy = cancelEntry.isPending || closeOut.isPending
  const canCommit = reason.trim().length > 0 && !busy
  const money = (v: number | null | undefined) => formatMoneyIn(v, currencyKey)

  return (
    <section
      data-region="entry-correction"
      data-entry={row.entryNumber}
      data-correction={blocked ? 'none' : correction.kind}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('correction.title')}</h2>
        <span className="font-mono text-[12px] text-muted-foreground">
          {t('correction.forEntry', { number: row.entryNumber })}
        </span>
      </header>

      {/* 🔑 The race, reported as the good news it is: the entry moved under the
          reader, here is what it moved to, and here is the act that still works. */}
      {raced && raced.kind !== 'partly-consumed' && (
        <RaceNotice
          text={
            raced.kind === 'nothing-left'
              ? t('correction.raced.nothingLeft', { number: row.entryNumber })
              : raced.reason || t('correction.raced.refused')
          }
        />
      )}
      {raced?.kind === 'partly-consumed' && (
        <RaceNotice
          text={t('correction.raced.partlyConsumed', {
            remaining: money(raced.remaining),
            amount: money(row.amount),
          })}
        />
      )}
      {closeOutRefused !== null && (
        <RaceNotice
          text={
            closeOutRefused.kind === 'refused'
              ? t('correction.raced.closeOutRefused', { remaining: money(closeOutRefused.remaining) })
              : closeOutRefused.kind === 'nothing-left'
                ? t('correction.raced.nothingLeft', { number: row.entryNumber })
                : t('correction.raced.closeOutUnstated')
          }
        />
      )}

      {/* 🚩 **A way back.** `blocked` is the panel refusing to re-offer an act the
          server just refused — but an entry that is still `OPEN` is still
          correctable, and without this the accountant is stranded until they select
          another row and come back. The ticket forbids ERRORING on a refusal; it
          does not forbid recovering from one. Pressing it clears the notice and the
          affordance recomputes from the account that was refetched underneath. */}
      {blocked && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setRaced(null)
              setCloseOutRefused(null)
            }}
            data-testid="correction-dismiss"
          >
            {t('correction.dismiss')}
          </Button>
        </div>
      )}

      {/* Why this entry cannot be cancelled, wherever that is the case — said
          BESIDE the button rather than instead of one, so a write-off is an answer
          rather than a missing affordance (user story 21). */}
      {!blocked && correction.kind === 'write-off' && (
        <p className="text-sm text-muted-foreground" data-testid="correction-why">
          {t('correction.writeOff.why', {
            number: row.entryNumber,
            remaining: money(correction.remaining),
            amount: money(row.amount),
          })}
        </p>
      )}
      {!blocked && correction.kind === 'cancel' && (
        <p className="text-sm text-muted-foreground">
          {t('correction.cancel.why', { number: row.entryNumber, amount: money(correction.amount) })}
        </p>
      )}
      {/* ⚠️ Suppressed while a notice is up: the notice above is already the
          sentence explaining why nothing is offered, and two of them would read as
          two different reasons for one absence. */}
      {!blocked && correction.kind === 'none' && (
        <p className="text-sm text-muted-foreground" data-testid="correction-none">
          {t(`correction.none.${correction.because}`)}
        </p>
      )}

      {act === null
        ? !blocked &&
          correction.kind !== 'none' && (
            <div className="flex flex-wrap gap-2">
              {/* 🔑 ONE button. There is no second element in this row, and the
                  union above is what makes that structural rather than a habit. */}
              <Button
                variant="danger-outlined"
                onClick={() => setAct(correction.kind === 'cancel' ? 'cancel' : 'write-off')}
                data-testid="correction-act"
                data-act={correction.kind}
              >
                {correction.kind === 'cancel'
                  ? t('correction.cancel.button')
                  : t('correction.writeOff.button', { remaining: money(correction.remaining) })}
              </Button>
            </div>
          )
        : (
            <div className="flex flex-col gap-2">
              <ReasonField
                value={reason}
                onValue={setReason}
                label={t('correction.reasonLabel')}
                hint={t('correction.reasonHint', { max: REASON_MAX })}
                testId="correction-reason"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() =>
                    canCommit &&
                    (act === 'cancel' ? cancelEntry : closeOut).mutate({
                      row,
                      reason: reason.trim(),
                    })
                  }
                  aria-disabled={!canCommit || undefined}
                  data-testid="correction-commit"
                >
                  {act === 'cancel'
                    ? t('correction.cancel.commit', { number: row.entryNumber })
                    : t('correction.writeOff.commit', {
                        remaining: money(
                          correction.kind === 'write-off' ? correction.remaining : row.remainingAmount,
                        ),
                      })}
                </Button>
                <Button variant="text" onClick={() => setAct(null)} data-testid="correction-back">
                  {t('correction.back')}
                </Button>
              </div>
            </div>
          )}

      {/* ⚠️ In every state, including the ones with no button. Its absence is
          otherwise indistinguishable from an oversight — and an accountant who
          believes an amend exists somewhere will go looking for it. */}
      <p className="text-xs text-muted-foreground" data-testid="correction-no-amend">
        {t('correction.noAmend')}
      </p>
      {/* 🚩 …and what the act below it does NOT touch, named right where the journal
          begins. The rows themselves are the proof; this is the sentence that tells
          a reader to look at them. */}
      <p className="text-xs text-muted-foreground">{t('correction.journalUntouched')}</p>
    </section>
  )
}

/** The amber notice a lost race arrives in. ⚠️ Attention, never danger: nothing has
 *  gone wrong — a till did its job at the same moment an accountant did theirs. */
function RaceNotice({ text }: { text: string }) {
  return (
    <p
      role="status"
      data-testid="correction-race"
      className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  )
}
