import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { apiErrorMessage } from '@/core/api'
import type { SettlementChase } from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { formatDateTime } from '@/core/util/date-format'
import { settlementApi } from './api'
import { CHASE_NOTE_MAX, type ChaseTarget } from './open-lane'
/** 🚩 The box itself, shared since 272 extracted it at its third copy — so a note is
 *  typed into the same control an entry's reason is, with the same `dir="auto"` these
 *  boxes are routinely filled in Arabic through. Only the LIMIT differs, and it differs
 *  because the server's does (`CHASE_NOTE_MAX`). */
import ReasonField from './ReasonField'

/**
 * **Record a chase** — ticket 287, spec 282 D7, contract 278.
 *
 * 🔑 **Opened from the row, and the list is never left.** A session of twenty calls
 * must not become twenty navigations: the accountant is holding a phone, working down
 * an ordered list, and the one act this screen offers has to happen where they already
 * are. That is the whole reason this is a dialog and not the branch account's tab.
 *
 * 🔑 **A note belongs to the BRANCH**, and the subject only says what the call happened
 * to be about — so one call covering four open shortages leaves four rows saying the
 * same thing rather than three still reading *never chased*.
 *
 * 🚩 **Append-only, and the UI says so rather than enforcing it silently.** No edit, no
 * delete, no supersede: a typo is corrected by adding another note. The hint says that
 * at the point of entry, because a reader who does not know it will go looking for an
 * edit button that is not there.
 *
 * ⚠️ **The text is INTERNAL, and the field says so where it is typed — not in a
 * tooltip.** Every other free text on this screen (an entry's reason, a cancellation's,
 * a correction's) is quoted back to the branch verbatim; this one is an accountant's
 * memo for colleagues. Saying it here is what stops somebody later putting it in front
 * of a store manager.
 */
export default function ChaseDialog({
  target,
  onClose,
  onChased,
}: {
  target: ChaseTarget | null
  onClose: () => void
  /** 🔑 Handed the note **the server wrote** — with the server's stamp and the server's
   *  name on it — never the text that was typed. See `applyChase`. */
  onChased: (chase: SettlementChase) => void
}) {
  const { t } = useTranslation('settlement')
  const [note, setNote] = useState('')

  // A fresh box per branch: a sentence written about 0611 must not be sitting in it
  // when the next row is opened. Keyed on the branch, because that is what a note
  // belongs to.
  useEffect(() => setNote(''), [target?.storeId])

  const chase = useMutation({
    mutationFn: () =>
      settlementApi.chase({
        storeId: target!.storeId,
        subject: target!.subject,
        subjectId: target!.subjectId,
        entryNumber: target!.entryNumber,
        note: note.trim(),
      }),
    onSuccess: (result) => {
      // ⚠️ **A refusal is a 200 and is not an error** — unknown branch, blank note,
      // over-length, unrecognised subject. It is said in the server's own words where
      // it sent any, and the dialog stays open with the text still in it: the note has
      // not been recorded, and throwing away what was typed would make a refusal cost
      // the accountant the call they just had.
      if (!result?.accepted || !result.chase) {
        toast.warning(result?.refusalReason || t('open.chase.refused'))
        return
      }
      toast.success(t('open.chase.done', { store: target?.storeName ?? '' }))
      onChased(result.chase)
      onClose()
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('open.chase.failed'))),
  })

  if (!target) return null
  const canSave = note.trim().length > 0 && !chase.isPending

  return (
    <Modal
      open
      onClose={onClose}
      title={t('open.chase.title')}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('open.chase.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => canSave && chase.mutate()}
            aria-disabled={!canSave || undefined}
            data-testid="chase-save"
          >
            {t('open.chase.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {/* Who this is about, in the row's own words — the branch, then the entry it
            was opened from and the person to ring. */}
        <div className="flex flex-col gap-0.5">
          <span className="flex items-baseline gap-1.5">
            <strong className="font-medium">{target.storeName}</strong>
            <span className="font-mono text-[11px] text-muted-foreground">{target.storeId}</span>
          </span>
          {/**
           * 🚩 **Three cases, exactly as the column beside it has three** — and the
           * middle one is the reason this is not a truthiness check. 1,255 of 1,394
           * branches are paired to nobody, so *"ring "* followed by nothing is worse
           * than saying there is nobody to ring; but a door that never sent `servedBy`
           * at all (§6 unbuilt) has said **nothing**, and printing *nobody is assigned
           * to this branch* there would be this ticket's own mistake made about the
           * neighbouring field. Absent is silent; `''` is a fact.
           */}
          <span className="text-xs text-muted-foreground" data-testid="chase-about">
            {target.servedBy === undefined
              ? t('open.chase.aboutOnly', { entryNumber: target.entryNumber })
              : target.servedBy
                ? t('open.chase.about', {
                    entryNumber: target.entryNumber,
                    servedBy: target.servedBy,
                  })
                : t('open.chase.aboutUnassigned', { entryNumber: target.entryNumber })}
          </span>
        </div>

        {/* 🔑 What was last said, before the phone is picked up. `never` is a named
            state here too — a dialog that showed nothing would leave the accountant
            unable to tell *nobody has rung* from *this box has not loaded*. */}
        <div
          className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs"
          data-testid="chase-last"
        >
          {target.last.kind === 'chased' ? (
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-muted-foreground">{t('open.chase.lastLabel')}</span>
              <span>
                {t('open.chase.line', {
                  date: formatDateTime(target.last.at),
                  note: target.last.note,
                })}
              </span>
              <span className="text-muted-foreground">{target.last.by}</span>
            </span>
          ) : (
            <span className="italic text-muted-foreground">{t('open.chase.never')}</span>
          )}
        </div>

        <ReasonField
          value={note}
          onValue={setNote}
          label={t('open.chase.noteLabel')}
          /* ⚠️ Both halves of the hint are load-bearing and neither is a tooltip: the
             note is internal, and it cannot be edited afterwards. */
          hint={t('open.chase.internalHint')}
          maxLength={CHASE_NOTE_MAX}
          testId="chase-note"
        />
      </div>
    </Modal>
  )
}
