import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { codeListCount, normaliseCodeList } from '@/core/util/code-list'
import { fsi } from '@/core/util/bidi'
import { pastedMaterials } from './editor'

/**
 * A multi-line box to paste a list of materials into (a column from Excel, or codes separated by
 * commas, spaces or new lines). OK hands back the pasted text; the caller turns it into lines or
 * grouping rows. The box says how many materials it will add, and how many it skips because the
 * target already holds them or the paste repeats them.
 */
const PASTE_BOX =
  'w-full resize-y rounded-md border border-border/60 bg-background px-2.5 py-1.5 font-mono text-sm text-foreground ' +
  'focus:border-primary/50 focus:outline-none'

export default function PasteMaterialsDialog({
  open,
  title,
  existing,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  /** The materials the target already holds; a pasted one of these is skipped. */
  existing: readonly string[]
  onClose: () => void
  onConfirm: (text: string) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="28rem">
      {/* Mounted only while open, so each opening starts from an empty box. */}
      {open && <PasteForm existing={existing} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  )
}

function PasteForm({
  existing,
  onClose,
  onConfirm,
}: {
  existing: readonly string[]
  onClose: () => void
  onConfirm: (text: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [text, setText] = useState('')
  const added = pastedMaterials(text, existing).length
  const skipped = codeListCount(normaliseCodeList(text)) - added

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('paste.hint')}
        <textarea
          dir="ltr"
          rows={10}
          autoFocus
          className={PASTE_BOX}
          value={text}
          data-testid="bby-paste-box"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground" data-testid="bby-paste-meter">
        <span>{t('paste.added', { count: added, n: fsi(String(added)) })}</span>
        {skipped > 0 && <span>{t('paste.skipped', { count: skipped, n: fsi(String(skipped)) })}</span>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>
          {t('paste.cancel')}
        </Button>
        <Button variant="primary" disabled={added === 0} onClick={() => onConfirm(text)}>
          {t('paste.ok')}
        </Button>
      </div>
    </div>
  )
}
