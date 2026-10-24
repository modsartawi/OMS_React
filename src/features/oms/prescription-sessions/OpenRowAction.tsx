import { useTranslation } from 'react-i18next'
import { FileX2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import type { OpenGridRow } from './open-row'
import { useWriteOffGrant } from './write-off-grant'

/**
 * The Open grid's row-action slot (ticket 545's seam): "Close without invoice" (ticket 548).
 *
 * The grid's `actions` column renders this for a row whose `view.rowAction` is true (a DISPENSED
 * row: `./open-row`). There is no write-off probe, so the button shows on every such row; a bare 403
 * on the POST hides it on every row for the rest of the visit (`./write-off-grant`).
 *
 * The button only ASKS for the dialog (`onOpen`): the dialog, its typed note and its mutation live in
 * `OpenTab`, not in this cell, because AG Grid destroys and re-creates cells (a refresh, a sort, the
 * row scrolled away) and everything inside one would die with it.
 */
export default function OpenRowAction({ row, onOpen }: { row: OpenGridRow; onOpen: (row: OpenGridRow) => void }) {
  const { t } = useTranslation('prescription-sessions')
  const notGranted = useWriteOffGrant((s) => s.notGranted)

  if (notGranted) return null

  return (
    <Button variant="danger-outlined" onClick={() => onOpen(row)} data-ps-write-off={row.sessionId}>
      <FileX2 className="h-3.5 w-3.5" aria-hidden />
      {t('writeOff.action')}
    </Button>
  )
}
