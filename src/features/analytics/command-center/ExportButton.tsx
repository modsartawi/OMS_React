import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { FileResponse } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { saveBlob } from '@/core/util/download-file'

/**
 * A profile's Export (oms 948 store profile, BO 4177; 949 category profile, BO 4178): downloads the server's workbook
 * for the request the page shows (one sheet per section), named by the server or else by `fallbackName`. The caller
 * hands in the download and its words in the page language.
 */
export default function ExportButton({
  download,
  fallbackName,
  label,
  failed,
}: {
  download: () => Promise<FileResponse>
  fallbackName: string
  label: string
  /** The toast's sentence when the workbook cannot be downloaded. */
  failed: string
}) {
  const [exporting, setExporting] = useState(false)
  async function run() {
    setExporting(true)
    try {
      const file = await download()
      saveBlob(file.filename || fallbackName, file.blob)
    } catch (err) {
      notify.apiError(failed, err, failed)
    } finally {
      setExporting(false)
    }
  }
  return (
    <Button variant="secondary" onClick={run} disabled={exporting} data-cc-export>
      {exporting ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Download aria-hidden className="size-3.5" />}
      {label}
    </Button>
  )
}
