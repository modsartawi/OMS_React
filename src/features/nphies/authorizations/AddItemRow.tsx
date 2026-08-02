import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, TriangleAlert } from 'lucide-react'

import Button from '@/core/ui/Button'
import type { AddItemRefusal } from './auth-session'

/**
 * The inline add-row above the grid (ticket 217, spec 209 story 26).
 *
 * 🚩 **This is the piece with no counterpart in the old screen at all.** WPF's
 * authorization dialog read the till's live basket — the cashier had already
 * scanned everything — so there was nothing to build. Here the agent has no
 * basket, and building the request has to feel like building one rather than
 * like filling in a table.
 *
 * 🚩 **It sends an item number and a quantity, and never a price** (law 1). What
 * the line costs is decided by the engine at the acting store and arrives in the
 * projection; there is no field here that could influence it and there is not
 * going to be one.
 *
 * ⚠️ **It is a code field, not a typeahead.** Contract §1.2 says item search is
 * "not a verb, deliberately — the existing item lookup is reused", but names no
 * route, and the only item search this repo has is `CallCenterWeb/ItemSearch`:
 * another feature's door, behind another grant, and scoped to a call-centre
 * transaction. Inventing a lookup endpoint is the one thing this wave's brief
 * forbids outright, so the row takes the number and the door answers
 * `ITEM_NOT_FOUND` for one that does not exist — a refusal the row states in
 * place. Logged as a contract gap in `.afk/HITL-217.md`.
 */
export default function AddItemRow({
  onAdd,
  busy,
  refusal,
  refusalDetail,
  disabled,
}: {
  onAdd: (itemNumber: string, qty: number) => void
  /** An add is in flight. The row stays mounted and keeps what was typed — a
   *  cleared field mid-add is how an agent loses the number they were reading
   *  off a prescription. */
  busy: boolean
  /** Why the last add was refused, from `auth-session`. `null` once it is fixed. */
  refusal: AddItemRefusal | null
  /** The server's own sentence, when the refusal came from the door rather than
   *  from the forward check. Passed through as data — it needs no key. */
  refusalDetail: string | null
  /** The session is not accepting items (still opening, closed, or hard-stopped). */
  disabled: boolean
}) {
  const { t } = useTranslation('authorizations')
  const [itemNumber, setItemNumber] = useState('')
  const [qty, setQty] = useState('1')
  const itemInput = useRef<HTMLInputElement>(null)
  const qtyInput = useRef<HTMLInputElement>(null)

  // 🚩 The refusal names a control, so the refusal moves the cursor to it. A
  // sentence that says "use the quantity control" while the caret sits in the item
  // field is asking the agent to do the pointing.
  useEffect(() => {
    if (!refusal) return
    if (refusal.remedy === 'quantity') qtyInput.current?.focus()
    else itemInput.current?.focus()
  }, [refusal])

  function submit() {
    if (busy || disabled) return
    onAdd(itemNumber.trim(), Number(qty))
  }

  /**
   * The row clears itself on its own success and on nothing else.
   *
   * 🚩 It keeps what was typed through a **refusal**: the number came off a
   * prescription, and re-typing it is exactly the cost moving the duplicate rule
   * forward is supposed to save. So the field empties only on the transition out
   * of `busy` with nothing refused, and the caret returns to the item field for
   * the next one.
   */
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !busy && !refusal) {
      setItemNumber('')
      setQty('1')
      itemInput.current?.focus()
    }
    wasBusy.current = busy
  }, [busy, refusal])

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('form.add.itemNumber')}
          <input
            ref={itemInput}
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            disabled={disabled}
            placeholder={t('form.add.itemNumberPlaceholder')}
            aria-describedby={refusal ? 'nphies-add-refusal' : undefined}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('form.add.quantity')}
          <input
            ref={qtyInput}
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={disabled}
            aria-describedby={refusal ? 'nphies-add-refusal' : undefined}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        {/* 🚩 `type="submit"` and NOTHING else. An `onClick` beside it would fire
            alongside the form's own submit, and two adds one keystroke apart put
            the second on the wire before the first has answered — where the door
            refuses it as a duplicate of the line the agent just added. */}
        <Button type="submit" variant="primary" className="h-8" disabled={disabled || busy}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden />
          )}
          {busy ? t('form.add.adding') : t('form.add.action')}
        </Button>
      </form>

      {refusal && (
        <div
          id="nphies-add-refusal"
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-2.5 text-[0.8125rem] text-attention-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {/* 🚩 The duplicate refusal NAMES THE QUANTITY CONTROL as the remedy
                (§2.3). WPF refused at submit; moving the rule to the add is worth
                nothing unless the sentence says what to do instead. */}
            {refusal.kind === 'duplicate'
              ? t('form.add.refusal.duplicate', {
                  itemNumber: refusal.itemNumber,
                  sequence: refusal.sequence ?? '',
                })
              : t(`form.add.refusal.${refusal.kind}`)}
            {refusalDetail ? ` ${refusalDetail}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
