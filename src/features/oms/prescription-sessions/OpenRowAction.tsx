import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FileX2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import type { OpenGridRow } from './open-row'
import WriteOffDialog from './WriteOffDialog'
import { useWriteOffGrant } from './write-off-grant'

/**
 * The Open grid's row-action slot (ticket 545's seam): "Close without invoice" (ticket 548).
 *
 * The grid's `actions` column renders this for a row whose `view.rowAction` is true (a DISPENSED
 * row: `./open-row`). There is no write-off probe, so the button shows on every such row; a bare 403
 * on the POST hides it on every row for the rest of the visit (`./write-off-grant`) — the dialog that
 * met the 403 stays open to say so until it is closed.
 *
 * The dialog is portalled to `<body>`: inside the cell, AG Grid's own DOM key handlers would see the
 * keys typed into its note.
 */
export const OPEN_ROW_ACTION_ENABLED = true

export default function OpenRowAction({ row }: { row: OpenGridRow }) {
  const { t } = useTranslation('prescription-sessions')
  const notGranted = useWriteOffGrant((s) => s.notGranted)
  const [open, setOpen] = useState(false)

  if (notGranted && !open) return null

  return (
    <>
      <Button variant="danger-outlined" onClick={() => setOpen(true)} data-ps-write-off={row.sessionId}>
        <FileX2 className="h-3.5 w-3.5" aria-hidden />
        {t('writeOff.action')}
      </Button>
      {open && createPortal(<WriteOffDialog row={row} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
