import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronsRight, ExternalLink, Truck } from 'lucide-react'
import { legendText } from '@/core/commands/keys'
import { useSingleKeys } from '@/core/commands/single-key-switch'
import { ORDER_GUARD_STATE_SEV } from '@/core/insurance-rules/tones'
import { NEXT_ROW_KEYS, PREVIOUS_ROW_KEYS } from '@/core/list/list-keys'
import type { OrderDocumentRow } from '@/core/models/order-document'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import PaneSeparator, { useViewportWidth } from '@/core/ui/PaneSeparator'
import StatusBadge from '@/core/ui/StatusBadge'
import { clampInspectorWidth } from '@/core/ui/inspector-pane'
import { formatPair } from '@/core/util/bidi'
import { INSPECTOR_ID } from './GridToolbar'
import { orderInspectorView, type OrderInspectorView } from './inspector-model'
import type { QueryGrants } from './query-model'

function Section({ title, children, name }: { title: string; children: ReactNode; name: string }) {
  return (
    <section className="flex flex-col gap-1.5" data-section={name}>
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      <dl className="flex flex-col gap-0.5">{children}</dl>
    </section>
  )
}

/** One label · value line. A blank value is no line. */
function Line({ label, children, name }: { label: string; children: ReactNode; name: string }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-xs leading-5" data-field={name}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/** A machine value, isolated LTR — or nothing when blank, so its line drops. */
const machine = (value: string, mono = false) =>
  value ? <Ltr>{mono ? <span className="font-mono">{value}</span> : value}</Ltr> : null

function Body({ view, onOpen }: { view: OrderInspectorView; onOpen: (to: string) => void }) {
  const { t } = useTranslation('orders')
  const { header, customer, fulfilment, money, insurance } = view
  return (
    <div className="flex flex-col gap-4" data-inspector-body="">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold" data-inspector-document="">
            <Ltr>{header.documentNo}</Ltr>
          </span>
          {header.category && <span className="text-xs text-muted-foreground">{t(`category.${header.category}`)}</span>}
        </div>
        {/* The order no. and its type: led by the order no., one pair isolated once. */}
        {header.orderNo && (
          <div className="text-xs text-muted-foreground">
            <Ltr>{formatPair(header.orderNo, header.documentType)}</Ltr>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {header.status && (
            <StatusBadge sev="mute">
              <bdi>{header.status}</bdi>
            </StatusBadge>
          )}
          {header.guardState && (
            <StatusBadge sev={ORDER_GUARD_STATE_SEV[header.guardState] ?? 'mute'}>
              {t(`insurance-order-guards:state.${header.guardState}`)}
            </StatusBadge>
          )}
        </div>
      </header>

      <Section title={t('inspector.customer')} name="customer">
        <Line label={t('inspector.name')} name="name">
          {customer.name ? <bdi>{customer.name}</bdi> : null}
        </Line>
        <Line label={t('inspector.mobile')} name="mobile">
          {machine(customer.mobile)}
        </Line>
      </Section>

      <Section title={t('inspector.fulfilment')} name="fulfilment">
        <Line label={t('inspector.store')} name="store">
          {machine(fulfilment.storeCode, true)}
        </Line>
        <Line label={t('inspector.source')} name="source">
          {fulfilment.source ? <bdi>{fulfilment.source}</bdi> : null}
        </Line>
        <Line label={t('inspector.entryTime')} name="entryTime">
          {machine(fulfilment.entryTime)}
        </Line>
        <Line label={t('inspector.delivery')} name="delivery">
          {fulfilment.deliveryNo ? machine(fulfilment.deliveryNo, true) : t('inspector.noDelivery')}
        </Line>
      </Section>

      <Section title={t('inspector.money')} name="money">
        <Line label={t('inspector.net')} name="net">
          {machine(money.net)}
        </Line>
        <Line label={t('inspector.amountDue')} name="amountDue">
          {machine(money.due)}
        </Line>
      </Section>

      {insurance && (
        <Section title={t('inspector.insurance')} name="insurance">
          <Line label={t('inspector.moneySource')} name="moneySource">
            {insurance.moneySource ? t(`moneySource.${insurance.moneySource}`) : null}
          </Line>
          <Line label={t('inspector.patientTotal')} name="patientTotal">
            {machine(insurance.patientTotal)}
          </Line>
          <Line label={t('inspector.insurerTotal')} name="insurerTotal">
            {machine(insurance.insurerTotal)}
          </Line>
          {insurance.ids && (
            <>
              <Line label={t('inspector.patientId')} name="patientId">
                {machine(insurance.ids.patientId, true)}
              </Line>
              <Line label={t('inspector.memberId')} name="memberId">
                {machine(insurance.ids.memberId, true)}
              </Line>
            </>
          )}
        </Section>
      )}

      <div className="flex flex-col gap-1.5">
        {view.openTo && (
          <Button variant="outlined" data-inspector-open="" onClick={() => onOpen(view.openTo!)}>
            <ExternalLink className="size-3.5" aria-hidden />
            {t('inspector.open')}
          </Button>
        )}
        {view.deliveryTo && (
          <Button variant="outlined" data-inspector-open-delivery="" onClick={() => onOpen(view.deliveryTo!)}>
            <Truck className="size-3.5" aria-hidden />
            {t('inspector.openDelivery')}
          </Button>
        )}
      </div>
    </div>
  )
}

function Empty() {
  const { t } = useTranslation('orders')
  const singleKeys = useSingleKeys((s) => s.on)
  return (
    <div className="flex flex-col items-center gap-1 pt-10 text-center text-xs text-muted-foreground" data-inspector-empty="">
      <p>{t('inspector.empty')}</p>
      {singleKeys && (
        <p>
          <Trans
            t={t}
            i18nKey="inspector.emptyKeys"
            components={{
              keys: (
                <Ltr>
                  <Kbd>{legendText(NEXT_ROW_KEYS, t)}</Kbd> <Kbd>{legendText(PREVIOUS_ROW_KEYS, t)}</Kbd>
                </Ltr>
              ),
            }}
          />
        </p>
      )}
    </div>
  )
}

/**
 * The Order inspector (ticket 786), at the inline-end edge: the current row, from the row alone,
 * resizable and foldable as the Delivery inspector is (the width bounds are `@/core/ui`'s).
 */
export default function OrderInspector({
  row,
  grants,
  width,
  onWidth,
  onCollapse,
  onOpen,
  className = '',
}: {
  row: OrderDocumentRow | null
  grants: QueryGrants
  width: number
  onWidth: (width: number) => void
  onCollapse: () => void
  onOpen: (to: string) => void
  className?: string
}) {
  const { t } = useTranslation('orders')
  const viewport = useViewportWidth()
  const shown = clampInspectorWidth(width, viewport)
  return (
    <aside
      id={INSPECTOR_ID}
      aria-label={t('inspector.region')}
      style={{ width: shown }}
      className={`relative flex shrink-0 flex-col border-s border-border bg-card ${className}`}
    >
      <PaneSeparator
        controls={INSPECTOR_ID}
        label={t('inspector.resize')}
        width={shown}
        viewport={viewport}
        onWidth={(next) => onWidth(clampInspectorWidth(next, viewport))}
      />
      <div className="flex h-8 shrink-0 items-center justify-end border-b border-divider px-2">
        <IconButton onClick={onCollapse} label={t('inspector.hide')} data-inspector-collapse="">
          {/* Points toward the inline end, where the pane folds away. */}
          <ChevronsRight className="size-4 rtl:rotate-180" aria-hidden />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        {row ? <Body view={orderInspectorView(row, grants)} onOpen={onOpen} /> : <Empty />}
      </div>
    </aside>
  )
}
