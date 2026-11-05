import { Trans, useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { copyText } from '@/core/util/copy-text'
import { HEADING } from './facts-heading'
import { receivedView, type JsonNode } from './received-section'

/**
 * The Insurance section's **Received** part (ticket 788; BackOffice 3392, spec 3389 user stories
 * 64–66): the intake body the order arrived with, as formatted JSON whose every object and array
 * folds (a native `<details>`, not a counted control), with Copy taking the body byte for byte. A
 * body that is not JSON is shown as received. An order that landed before bodies were kept says
 * "not kept for orders before <date>".
 *
 * The JSON is ONE left-to-right island (`dir="ltr"`, monospace) in Arabic too — never an isolate per
 * value (the raw-drawer precedent).
 */
export default function InsuranceReceivedPart({ read }: { read: OrderInsuranceRead }) {
  const { t } = useTranslation('document')
  const view = receivedView(read.intake)

  const copy = (text: string) =>
    void copyText(text).then((outcome) =>
      outcome === 'copied' ? notify.success(t('insurance.received.copied')) : notify.error(t('insurance.received.copyFailed')),
    )

  return (
    <div className="flex min-w-0 flex-col gap-2" data-insurance-received={view.kind}>
      <h4 className={`${HEADING} text-muted-foreground`}>{t('insurance.received.heading')}</h4>
      {view.kind === 'notKept' ? (
        <p className="text-muted-foreground italic" data-received-not-kept="">
          {view.since ? (
            <Trans t={t} i18nKey={view.textKey} values={{ date: view.since }} components={{ date: <Ltr /> }} />
          ) : (
            t(view.textKey)
          )}
        </p>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-muted-foreground">{t('insurance.received.intro')}</span>
            <dl className="flex flex-wrap gap-x-3 text-xs">
              {view.receivedAt && (
                <span className="flex gap-1">
                  <dt className="text-muted-foreground">{t('insurance.received.at')}</dt>
                  <dd className="tabular-nums">
                    <Ltr>{view.receivedAt}</Ltr>
                  </dd>
                </span>
              )}
              {view.receivedBy && (
                <span className="flex gap-1">
                  <dt className="text-muted-foreground">{t('insurance.received.by')}</dt>
                  <dd>
                    <bdi>{view.receivedBy}</bdi>
                  </dd>
                </span>
              )}
              {view.contentType && (
                <span className="flex gap-1">
                  <dt className="text-muted-foreground">{t('insurance.received.contentType')}</dt>
                  <dd className="font-mono">
                    <Ltr>{view.contentType}</Ltr>
                  </dd>
                </span>
              )}
            </dl>
            <Button variant="secondary" className="ms-auto" onClick={() => copy(view.copyText)} data-received-copy="">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {t('insurance.received.copy')}
            </Button>
          </div>
          {!view.tree && <p className="text-xs text-muted-foreground">{t('insurance.received.notJson')}</p>}
          <div
            dir="ltr"
            className="max-h-[28rem] min-w-0 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-start font-mono text-xs"
            aria-label={t('insurance.received.body')}
            role="region"
            data-received-body=""
          >
            {view.tree ? <JsonValue node={view.tree} /> : <pre className="whitespace-pre-wrap break-all">{view.text}</pre>}
          </div>
        </>
      )}
    </div>
  )
}

/** One JSON value; an object or array folds under its own `<details>`, open by default. */
function JsonValue({ node, label, comma }: { node: JsonNode; label?: string; comma?: boolean }) {
  const key = label !== undefined && (
    <>
      <span className="text-primary">{label}</span>
      {': '}
    </>
  )
  const tail = comma ? ',' : ''
  if (node.type === 'scalar')
    return (
      <div className="whitespace-pre-wrap break-all" data-json-scalar="">
        {key}
        <span className={node.raw.startsWith('"') ? 'text-foreground' : 'text-success-800'}>{node.raw}</span>
        {tail}
      </div>
    )
  const [open, close] = node.type === 'object' ? ['{', '}'] : ['[', ']']
  const children =
    node.type === 'object'
      ? node.entries.map((e, i) => <JsonValue key={i} node={e.value} label={e.key} comma={i < node.entries.length - 1} />)
      : node.items.map((item, i) => <JsonValue key={i} node={item} comma={i < node.items.length - 1} />)
  if (children.length === 0)
    return (
      <div data-json-scalar="">
        {key}
        {open}
        {close}
        {tail}
      </div>
    )
  return (
    <details open className="group" data-json-node={node.type}>
      <summary className="cursor-pointer select-none list-inside">
        {key}
        {open}
        <span className="hidden text-muted-foreground group-[:not([open])]:inline">
          {'…'}
          {close}
          {tail}
        </span>
      </summary>
      <div className="ms-4 border-s border-border/60 ps-2">{children}</div>
      <div>
        {close}
        {tail}
      </div>
    </details>
  )
}
