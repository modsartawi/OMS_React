import { useState } from 'react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { codeListCount, normaliseCodeList, pastedCodes } from '@/core/util/code-list'

/** The words of a paste box, translated by the caller (each feature owns its namespace). */
export interface PasteCodesLabels {
  title: string
  hint: string
  /** "N to add", from the count of codes the paste adds. */
  added: (count: number) => string
  /** "N skipped", from the count of codes already held or repeated. */
  skipped: (count: number) => string
  ok: string
  cancel: string
}

/**
 * A multi-line box to paste a list of codes into (a column from Excel, or codes separated by commas, spaces or new
 * lines): bonus-buy materials (ticket 420) and an insurance item list's codes (655). It says how many codes it will
 * add and how many it skips because the target already holds them or the paste repeats them; OK hands back the
 * codes to add (`pastedCodes`).
 */
export default function PasteCodesDialog({
  open,
  labels,
  existing,
  testId,
  onClose,
  onConfirm,
}: {
  open: boolean
  labels: PasteCodesLabels
  /** The codes the target already holds; a pasted one of these is skipped. */
  existing: readonly string[]
  /** The `data-testid` prefix of the box and its meter (`<prefix>-box`, `<prefix>-meter`). */
  testId: string
  onClose: () => void
  onConfirm: (codes: string[]) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={labels.title} width="28rem">
      {/* Mounted only while open, so each opening starts from an empty box. */}
      {open && <PasteForm labels={labels} existing={existing} testId={testId} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  )
}

function PasteForm({
  labels,
  existing,
  testId,
  onClose,
  onConfirm,
}: {
  labels: PasteCodesLabels
  existing: readonly string[]
  testId: string
  onClose: () => void
  onConfirm: (codes: string[]) => void
}) {
  const [text, setText] = useState('')
  const codes = pastedCodes(text, existing)
  const skipped = codeListCount(normaliseCodeList(text)) - codes.length

  return (
    <div className="flex flex-col gap-3">
      <Field label={labels.hint}>
        <Textarea
          dir="ltr"
          rows={10}
          autoFocus
          className="w-full resize-y font-mono"
          value={text}
          data-testid={`${testId}-box`}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground" data-testid={`${testId}-meter`}>
        <span>{labels.added(codes.length)}</span>
        {skipped > 0 && <span>{labels.skipped(skipped)}</span>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>
          {labels.cancel}
        </Button>
        <Button variant="primary" disabled={codes.length === 0} onClick={() => onConfirm(codes)} data-testid={`${testId}-ok`}>
          {labels.ok}
        </Button>
      </div>
    </div>
  )
}
