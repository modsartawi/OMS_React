/**
 * The order note (ticket 183, v1.3) — what the caller told the agent, in the
 * agent's own words, travelling with the order.
 *
 * Three properties this surface exists to hold:
 *
 * 1. 🚩 **Clearing is a real act, and it is offered as one.** `setOrderNote(null)`
 *    is what stops a stale instruction travelling to the store on an order the
 *    caller has since changed their mind about, so *Clear* is its own control
 *    beside *Save* rather than a save of an emptied box that the agent has to
 *    discover. Emptying the box and saving reaches the same verb with the same
 *    `null` — one act, two doors into it.
 * 2. 🚩 **No length rule of the console's own.** The column is `NVARCHAR(MAX)`
 *    (§1.1's verb table, capture 11), so nothing here caps, counts down or
 *    truncates what an agent types. A client-side limit would be this console
 *    inventing a refusal the door does not have.
 * 3. **Free text, and nothing else.** It is never price-affecting and no
 *    `submitBlocker` names it, so this form has no gate to draw and no
 *    completeness to assert — an order with no note is an ordinary order.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { NOTE } from './console-notes'

export interface NoteApply {
  busy: boolean
  /** The failure, already worded by the caller. */
  error: string | null
  /** 🚩 `null` CLEARS — *empty but present* is not the same fact as *no
   *  instruction*, and the difference is what reaches the picker. */
  onApply: (note: string | null) => void
}

export default function NoteForm({
  open,
  current,
  apply,
  onClose,
}: {
  open: boolean
  current: string | null | undefined
  apply: NoteApply
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [text, setText] = useState('')

  // Seeded from what the ORDER holds, every time the form opens — a re-opened
  // section shows what is settled, not what was typed into it last time.
  useEffect(() => {
    if (!open) return
    setText(current ?? '')
  }, [open, current])

  const trimmed = text.trim()
  // 🚩 The one rule this form owns, and it is about the ACT rather than the
  // value: a save that would send what the order already holds is not a
  // correction, and the ledger should not carry it (§4).
  const changed = trimmed !== (current?.trim() ?? '')
  const holdsNote = (current?.trim() ?? '') !== ''

  return (
    <Modal
      open={open}
      onClose={() => !apply.busy && onClose()}
      title={t('note.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={apply.busy} data-cc-note-close>
            {t('note.close')}
          </Button>
          {/* 🚩 Offered only where there is something to clear — a *Clear* on an
              order with no note is a control that would send an act changing
              nothing. */}
          {holdsNote && (
            <Button
              variant="outlined"
              onClick={() => apply.onApply(null)}
              disabled={apply.busy}
              data-cc-note-clear
            >
              {t('note.clear')}
            </Button>
          )}
          <Button
            variant="primary"
            // Emptied and saved is the same act as *Clear*: one verb, one `null`.
            onClick={() => apply.onApply(trimmed === '' ? null : trimmed)}
            disabled={apply.busy || !changed}
            data-cc-note-apply
          >
            {apply.busy ? t('note.saving') : t('note.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm" data-cc-note-form>
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="cc-order-note">
          {t('note.field')}
        </label>
        <textarea
          id="cc-order-note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={apply.busy}
          rows={4}
          placeholder={t('note.placeholder')}
          data-cc-note-text
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <p className="text-[11px] text-muted-foreground">{t('note.hint')}</p>
        {apply.error && (
          <p className={NOTE.danger} data-cc-note-error>
            {apply.error}
          </p>
        )}
      </div>
    </Modal>
  )
}
