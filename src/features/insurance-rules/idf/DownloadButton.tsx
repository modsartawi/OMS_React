import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

import type { FileResponse } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { saveBlob } from '@/core/util/download-file'

/**
 * One IDF file download (BackOffice spec 3185; the shared seam of oms 644 / 650 / 651 / 652 / 653): asks the door for
 * the server's `.xlsx` (`api.blob`) and saves it under the server's name, `fallbackName` only when it sends none —
 * 627's pattern. A refused download (the JSON 400 envelope, or a bare 403) is an error toast titled `failedLabel`
 * carrying the server's message. `hook` is the button's `data-*` attribute name (e.g. `data-idf-groups-export`).
 */
export default function DownloadButton({
  fetch,
  fallbackName,
  label,
  failedLabel,
  hook,
  disabled = false,
}: {
  fetch: () => Promise<FileResponse>
  fallbackName: string
  label: string
  failedLabel: string
  hook: `data-${string}`
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const onClick = async () => {
    setBusy(true)
    try {
      const file = await fetch()
      saveBlob(file.filename ?? fallbackName, file.blob)
    } catch (err) {
      notify.apiError(failedLabel, err, failedLabel)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outlined" disabled={busy || disabled} aria-busy={busy || undefined} onClick={onClick} {...{ [hook]: '' }}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
      {label}
    </Button>
  )
}
