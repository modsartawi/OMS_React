import { useTranslation } from 'react-i18next'
import { ClipboardCopy } from 'lucide-react'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'

/** A count, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

/** One figure of the answer: its label (already worded) and a `data-result-<attr>` hook. */
export interface ImportAnswerCount {
  label: string
  value: number
  attr: string
}

/**
 * A material import's answer: the door's counts, then the material numbers the server did not know
 * — listed, with a Copy that puts them on the clipboard one per line. Built for the Deliverect
 * whitelist import (ticket 479) and graduated to core by ticket 555, when the HungerStation material
 * import became its second user (a feature may never import another).
 *
 * It speaks in `ns`, whose `result.*` block carries the chrome: `title`, `close`, `unknown`,
 * `unknownHint`, `copy`, `copied`, `copiedDetail` (plural), `copyFailed`, `noneUnknown`.
 */
export default function ImportAnswerDialog({
  ns,
  counts,
  unknown,
  onClose,
}: {
  ns: string
  counts: readonly ImportAnswerCount[]
  unknown: readonly string[]
  onClose: () => void
}) {
  const { t } = useTranslation(ns)
  // Inside the promise, so a page with no clipboard (plain http) says it could not copy rather than throwing.
  const copy = () =>
    void Promise.resolve()
      .then(() => navigator.clipboard.writeText(unknown.join('\n')))
      .then(
        () => notify.success(t('result.copied'), t('result.copiedDetail', { count: unknown.length, n: fsi(figure(unknown.length)) })),
        () => notify.error(t('result.copyFailed')),
      )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('result.title')}
      width="32rem"
      footer={
        <Button variant="primary" onClick={onClose} data-result-close="">
          {t('result.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3" data-import-result="">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {counts.map((c) => (
            <div key={c.attr} className="contents">
              <dt className="text-muted-foreground">{c.label}</dt>
              <dd className="tabular-nums" {...{ [`data-result-${c.attr}`]: c.value }}>
                <Ltr>{figure(c.value)}</Ltr>
              </dd>
            </div>
          ))}
          <dt className="text-muted-foreground">{t('result.unknown')}</dt>
          <dd className="tabular-nums" data-result-unknown-count={unknown.length}>
            <Ltr>{figure(unknown.length)}</Ltr>
          </dd>
        </dl>
        {unknown.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t('result.unknownHint')}</span>
              <Button variant="secondary" onClick={copy} data-result-copy="">
                <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                {t('result.copy')}
              </Button>
            </div>
            <ul
              dir="ltr"
              className="max-h-48 overflow-auto rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs"
              data-result-unknown=""
            >
              {unknown.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground" data-result-none-unknown="">
            {t('result.noneUnknown')}
          </p>
        )}
      </div>
    </Modal>
  )
}
