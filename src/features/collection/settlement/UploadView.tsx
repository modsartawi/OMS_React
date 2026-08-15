import { useNavigate, useSearchParams } from 'react-router'
import BatchWithdraw from './BatchWithdraw'
import BulkUploadDialog from './BulkUploadDialog'
import { doorSearch, readBatch } from './addresses'

/**
 * **Bulk upload** — `/collection/settlement/upload` (spec 282 D3, ticket 283): the
 * month's audit sheet posted as one act (273), and one committed batch's
 * **withdrawal** when `?batch=` names it.
 *
 * 🚩 **One path for both, because they are one screen.** *"Finance sent the wrong
 * file"* is a discovery made an hour and a reload later, and it is answered on the
 * screen the file was sent from — which is exactly why 273 made the withdrawal an
 * address rather than state inside the dialog that committed it. What 283 changed is
 * only the spelling: `?view=batch&batch=…` became `/upload?batch=…`, and the id it
 * always carried stayed a parameter, because it names *which* batch and never named
 * the screen.
 *
 * ⚠️ **The upload is still 273's dialog, mounted open, not a re-drawn page.** The
 * screen it belongs to is now addressable — a nav leaf points here (284) — but
 * nothing about the upload itself was redesigned in a routing slice, and inventing a
 * page around it would have meant copy nobody has written. Dismissing it returns to
 * the Overview at the scope the reader chose, which is where the button that used to
 * open it stands.
 */
export default function UploadView() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const batchId = readBatch(searchParams)

  if (batchId) return <BatchWithdraw batchId={batchId} />

  return (
    <BulkUploadDialog
      open
      // ⚠️ `replace`, and it is load-bearing for a screen that is a dialog: a PUSH
      // would leave [door, upload, door] behind the reader, so Back off the door they
      // just dismissed to would re-open the upload they dismissed.
      onClose={() => navigate(doorSearch(searchParams), { replace: true })}
    />
  )
}
