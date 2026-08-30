import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'

import { saveBlob } from '@/core/util/download-file'
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import { idocInspectorApi } from './api'
import { useCodeLabel } from './CodeValue'
import { fallbackFileName, idocTypesPresent } from './download'
import { downloadFailure, type DownloadOutcome } from './download-outcome'
import type { LookupKey } from './lookup-key'

/**
 * Taking the XML away — **one button per IDoc type present**, on the verdict
 * strip (ticket 299).
 *
 * 🔑 **Per type, and never anything else.** Not per line, not per document, and
 * not one button for the transaction: aggregated and financial are two downloads
 * yielding two files, because the file handed to a SAP consultant must be the
 * file their team expects to read. `idocTypesPresent` is where that is decided
 * and tested; this file adds the `t()` calls, the fetch and the chrome.
 *
 * ⚠️ **The reconstruction caveat rides here, beside the buttons.** This XML is
 * rebuilt from the database rows *as they stand now*; the document row carries a
 * creation timestamp and no update timestamp, so nothing on this screen may
 * present it as *what SAP received*. The server puts the same caveat in the
 * filename. It is drawn whenever a button is, and never behind a hover.
 *
 * 🚩 **Export state changes what the consultant is told, not what they can
 * take.** Exported, batched-but-not-exported and not-batched all offer the same
 * file, and a held document offers its own too. There is no refusal here — the
 * badge on the card is the telling.
 *
 * ⚠️ **A plain link cannot do this**, which is why there is a fetch and a Blob:
 * the cookie branch of the server's CSRF filter requires a header an `<a href>`
 * or a `window.open` cannot send, so a download link answers 401.
 */
export default function DownloadStrip({
  lookupKey,
  documents,
}: {
  lookupKey: LookupKey
  documents: readonly IDocInspectorDocument[]
}) {
  const { t } = useTranslation('reports')
  const types = idocTypesPresent(documents)

  /**
   * Which types are in flight — a SET, not one value.
   *
   * 🚩 Two downloads are two files and there is deliberately nothing stopping a
   * consultant starting the financial one while the aggregated one is still
   * fetching. A single "the pending type" would let the second start clear the
   * first one's spinner, leaving a live button over a request still running.
   */
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  /**
   * The failures, **keyed by the type they belong to** rather than one slot.
   *
   * 🚩 Three buttons can sit here and two of them can fail for different reasons.
   * A single slot would silently erase the aggregated failure the moment the
   * financial one landed, leaving a button that had failed reading as one that
   * had succeeded — and the sentence beside it naming a type the consultant was
   * no longer asking about.
   */
  const [failures, setFailures] = useState<ReadonlyMap<string, DownloadOutcome>>(new Map())

  const settle = useCallback((idocType: string) => {
    setPending((running) => {
      const next = new Set(running)
      next.delete(idocType)
      return next
    })
  }, [])

  const onDownload = useCallback(
    async (idocType: string) => {
      setPending((running) => new Set(running).add(idocType))
      // 🚩 Only THIS type's failure is cleared. A financial download that failed
      // must keep saying so while the aggregated one runs beside it.
      setFailures((f) => {
        if (!f.has(idocType)) return f
        const next = new Map(f)
        next.delete(idocType)
        return next
      })
      try {
        const { blob, filename } = await idocInspectorApi.download(lookupKey, idocType)
        // 🔑 **The server owns the name and this uses what it was given.**
        // `Content-Disposition` is the authority; the fallback is only reached
        // when the header did not arrive at all, and it mirrors the server's own
        // format so the two never look like different files.
        saveBlob(filename ?? fallbackFileName(lookupKey, idocType, new Date()), blob)
      } catch (err) {
        // ⚠️ A non-2xx carrying the envelope is a **business outcome, not a
        // crash** — the rail's own sentence is what gets shown.
        setFailures((f) => new Map(f).set(idocType, downloadFailure(err)))
      } finally {
        // 🚩 Cleared unconditionally. A download whose blob save threw must not
        // leave a button spinning forever with no way back to it.
        settle(idocType)
      }
    },
    [lookupKey, settle],
  )

  // 🚩 No buttons and no caveat when the transaction produced nothing to take.
  // The strip itself only renders over a graph, and this is the second guard: a
  // verdict that shows documents while carrying none would otherwise draw a
  // caveat about a file nobody can download.
  if (types.length === 0) return null

  return (
    <div className="ms-auto flex flex-col items-end gap-1" data-download-strip="">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {types.map((idocType) => (
          <DownloadButton
            key={idocType}
            idocType={idocType}
            pending={pending.has(idocType)}
            onDownload={onDownload}
          />
        ))}
      </div>
      <p className="max-w-md text-end text-[11.5px] text-muted-foreground" data-download-caveat="">
        {t('idocInspector.download.caveat')}
      </p>
      {[...failures].map(([idocType, outcome]) => (
        <p
          key={idocType}
          role="alert"
          data-download-error={outcome.code ?? ''}
          data-download-error-type={idocType}
          className="max-w-md text-end text-[11.5px] font-medium text-danger-800"
        >
          {/* 🔑 The server's own words when it gave any — the screen's copy is the
              fallback, not the reading. ⚠️ Named with the TYPE it belongs to:
              three buttons can sit here, and an unattributed sentence would leave
              a consultant guessing which file did not come. */}
          {t('idocInspector.download.failed', {
            idocType,
            message: outcome.serverMessage ?? t(outcome.messageKey),
          })}
        </p>
      ))}
    </div>
  )
}

/**
 * One type's button.
 *
 * ⚠️ **The RAW code is the label**, with the legend's name in the tooltip — the
 * whole screen's rule (ticket 300), and the one that matters most here: the file
 * this button produces is *named* by the raw code, and a consultant matching a
 * download against a SAP ticket needs the literal value.
 */
function DownloadButton({
  idocType,
  pending,
  onDownload,
}: {
  idocType: string
  pending: boolean
  onDownload: (idocType: string) => void
}) {
  const { t } = useTranslation('reports')
  const { label } = useCodeLabel('iDocType', idocType)

  return (
    <button
      type="button"
      data-download-type={idocType}
      disabled={pending}
      onClick={() => onDownload(idocType)}
      // Only its OWN button is disabled while it runs; the other types stay live.
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 px-3 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
      // ⚠️ The label is the legend's when it has one and nothing is invented when
      // it does not — a `title` echoing the code back promises an explanation and
      // delivers the thing being explained.
      title={label ?? undefined}
      aria-label={t('idocInspector.download.actionAria', { idocType })}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Download className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="font-mono tracking-wide">{idocType}</span>
      <span className="font-sans font-medium">{t('idocInspector.download.xml')}</span>
    </button>
  )
}
