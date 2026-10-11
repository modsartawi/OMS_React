import { useEffect, useId, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Copy, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { StoreTransaction } from '@/core/models/sync-console'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { SHEET } from '@/core/ui/overlay'
import { formatDateTime } from '@/core/util/date-format'
import { AUDIT_KEY, storeTransactionSnapshotQuery } from './api'
import { prettyJson, snapshotRefusal, snapshotSections } from './transactions-helpers'
import Loading from './Loading'

/**
 * **One receipt's JSON** (spec 444 amended by BackOffice spec 2586 decision 6, ticket 468,
 * door 2589) — the side sheet the Transactions tab's View JSON opens, for an operator
 * (`canOperate`) only. It reads `Store/Transactions/Snapshot` when it opens, and only then:
 * each opening is its own audited read (`storeTransactionSnapshotQuery`'s `opening`),
 * never prefetched, and nothing is kept once it closes.
 *
 * 🚩 **Privacy.** The snapshot carries customer, loyalty and tender data. It is drawn and
 * copied on request, and nothing else: never logged, never stored, never in the URL.
 *
 * The frame copies the house side sheet's pattern (`collection/inquiry`'s `SlipDrawer`; a
 * feature never imports another): a native `<dialog>` docked to the inline end on the
 * overlay recipe's `SHEET`, over the `--backdrop` scrim, with its top layer, focus trap,
 * focus given back and Escape. React state stays the one source of truth for open.
 *
 * The JSON is ONE left-to-right island (`dir="ltr"` on its container, monospace, 2-space
 * indent), split into its top-level keys (`snapshotSections`) on native `<details>`.
 */
export default function SnapshotDrawer({
  code,
  row,
  opening,
  onClose,
}: {
  code: string
  row: StoreTransaction
  /** The tab's count of openings: a second opening of the same receipt is a second read. */
  opening: number
  onClose: () => void
}) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // A served view wrote an audit row first: the audit feeds (fleet and store share the key) show it,
  // even when the drawer was closed before the answer came.
  const read = useQuery(
    storeTransactionSnapshotQuery(code, row.transactionId, opening, () => void qc.invalidateQueries({ queryKey: AUDIT_KEY })),
  )

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  const sections = useMemo(() => (read.data ? snapshotSections(read.data.snapshot) : []), [read.data])

  // The whole snapshot, pretty-printed only when asked for. Inside the promise, so a page
  // with no clipboard (plain http) says it could not copy rather than throwing.
  const copy = () => {
    const snapshot = read.data?.snapshot
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(prettyJson(snapshot)))
      .then(
        () => notify.success(t('transactionsTab.snapshot.copied')),
        () => notify.error(t('transactionsTab.snapshot.copyFailed')),
      )
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-snapshot-drawer={row.transactionId}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        if (e.target === ref.current) onClose()
      }}
      onClose={() => {
        if (ref.current && !ref.current.open) onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[48rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('transactionsTab.snapshot.eyebrow')}</span>
            <h2 id={titleId} className="font-mono text-sm font-semibold tracking-tight" data-snapshot-title="">
              <Ltr>{row.receiptNumber}</Ltr>
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={copy} disabled={!read.isSuccess} data-snapshot-copy="">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {t('transactionsTab.snapshot.copy')}
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('transactionsTab.snapshot.close')}
              title={t('transactionsTab.snapshot.close')}
              data-snapshot-close=""
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {read.isPending ? (
            <Loading label={t('transactionsTab.snapshot.loading')} />
          ) : read.isError ? (
            <Refusal error={read.error} />
          ) : (
            <>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-snapshot-loaded-at={read.data.loadedAt}>
                <p>
                  <Trans
                    t={t}
                    i18nKey="transactionsTab.snapshot.loadedAt"
                    values={{ at: formatDateTime(read.data.loadedAt) }}
                    components={{ t: <Ltr /> }}
                  />
                </p>
                <p data-snapshot-note="">{t('transactionsTab.snapshot.note')}</p>
              </div>
              {/* One LTR island for the whole JSON, in Arabic too: never an isolate per value. */}
              <div
                dir="ltr"
                className="flex flex-col gap-2 font-mono text-xs"
                aria-label={t('transactionsTab.snapshot.sections')}
                role="group"
                data-snapshot-json=""
              >
                {sections.map((s, i) =>
                  s.key === null ? (
                    <pre key={i} className="overflow-x-auto rounded-md bg-muted p-3 whitespace-pre" data-snapshot-section="">
                      {s.json}
                    </pre>
                  ) : (
                    <details key={s.key} open className="rounded-md border border-border/60" data-snapshot-section={s.key}>
                      <summary className="cursor-pointer px-3 py-1.5 font-semibold select-none">
                        {/* A machine key, untranslated: isolated as one, inside the island. */}
                        <Ltr>{s.key}</Ltr>
                      </summary>
                      <pre className="overflow-x-auto border-t border-border/60 bg-muted p-3 whitespace-pre">{s.json}</pre>
                    </details>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}

/**
 * A refused read: `NOT_FOUND` in its own words; any other code in the store doors'
 * shared words with the code beside them, or raw with the server's message; a bare
 * failure (the 500 of a failed audit write) under core's server sentence (`apiErrorMessage`
 * words any 500 itself, not with the body's message).
 */
function Refusal({ error }: { error: unknown }) {
  const { t } = useTranslation('sync-console')
  const code = apiErrorCode(error)
  const { labelKey, showCode } = snapshotRefusal(code)
  // A failure that is not the server's (no envelope) has no sentence of its own: the title alone.
  const message = labelKey ? t(labelKey) : apiErrorMessage(error, '')
  return (
    <div data-snapshot-error={code ?? ''}>
      <ErrorBanner
        className="p-3"
        title={message ? t('transactionsTab.snapshot.failed') : undefined}
        message={message || t('transactionsTab.snapshot.failed')}
      >
        {showCode && code && (
          <p className="font-mono text-xs" data-snapshot-error-code="">
            <Ltr>{code}</Ltr>
          </p>
        )}
      </ErrorBanner>
    </div>
  )
}
