import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { StockConsoleItem } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import { formatFigure } from '@/core/util/number-format'
import { FreeCell, ReservedCell } from './figure-cells'
import HowRead from './HowRead'
import { HOW_ITEM } from './how-sections'
import { answeredNowView, changeFeedView, otherStock, sumLines, type SumLine } from './item-sum'

/**
 * The item's sum, written out with its numbers (oms 943, spec 4157 stories 52–55; pure in `./item-sum`): SAP counter,
 * less sold at the till and not in SAP, equals till-side; less held, less reserved, equals free. Beside it the two other
 * rules in use — what the channels are answered now and by which rule, and the change feed's figure — then the other
 * stock types when not zero, and "How this is read" for each line.
 */
export default function ItemSum({ item }: { item: StockConsoleItem }) {
  const { t } = useTranslation('stock-console')
  const others = otherStock(item)

  return (
    <section className="flex flex-col gap-3" data-item-sum={item.item}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">{t('sum.title')}</h3>
          <table className="w-full text-sm">
            <tbody>
              {sumLines(item).map((line) => (
                <SumRow key={line.name} line={line} item={item} />
              ))}
            </tbody>
          </table>
        </div>
        <Rules item={item} />
      </div>

      {others.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-4" data-item-other-stock={others.length}>
          <h3 className="mb-2 text-sm font-semibold">{t('sum.other.title')}</h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {others.map((o) => (
              <div key={o.type} className="flex flex-col rounded-md border border-border/60 px-3 py-2" data-other-stock={o.type}>
                <dt className="text-xs text-muted-foreground">{t(`sum.other.${o.type}`)}</dt>
                <dd className="font-semibold">
                  <Ltr>{formatFigure(o.value)}</Ltr>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <HowRead section="item" paragraphs={HOW_ITEM} />
    </section>
  )
}

/** One line of the sum: how it joins the line above ("−", "="), its words, and its figure at the end. */
function SumRow({ line, item }: { line: SumLine; item: StockConsoleItem }) {
  const { t } = useTranslation('stock-console')
  const total = line.op === 'equals'
  let value: ReactNode
  if (line.name === 'reserved') value = <ReservedCell row={item} t={t} />
  else if (line.name === 'free') value = <FreeCell row={item} t={t} />
  else value = <Ltr>{formatFigure(line.value)}</Ltr>

  return (
    <tr className={total ? 'border-t border-border/60 font-semibold' : ''} data-sum-line={line.name} data-sum-op={line.op}>
      <td className="w-6 py-1 align-top text-muted-foreground">{line.op === 'start' ? null : t(`sum.op.${line.op}`)}</td>
      <td className="py-1 align-top">
        <div>{t(`sum.line.${line.name}`)}</div>
        {line.parts && (
          <div className="text-xs font-normal text-muted-foreground">
            <Trans
              t={t}
              i18nKey="store.heldParts"
              values={{ standing: formatFigure(line.parts.standing), sold: formatFigure(line.parts.sold) }}
              components={{ v: <Ltr /> }}
            />
            {line.onNoBatch != null && (
              <span className="ms-2" data-held-on-no-batch={line.onNoBatch}>
                <Trans
                  t={t}
                  i18nKey="sum.onNoBatch"
                  count={line.onNoBatch}
                  values={{ n: formatFigure(line.onNoBatch) }}
                  components={{ v: <Ltr /> }}
                />
              </span>
            )}
          </div>
        )}
      </td>
      <td className="py-1 text-end align-top">{value}</td>
    </tr>
  )
}

/** The two other rules in use: answered now (its rule, and under live orders the open orders) and the change feed. */
function Rules({ item }: { item: StockConsoleItem }) {
  const { t } = useTranslation('stock-console')
  const now = answeredNowView(item)
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-item-rules="">
      <h3 className="text-sm font-semibold">{t('sum.rules')}</h3>
      <div className="flex flex-col gap-0.5" data-answered-now={now ? 'answered' : 'noAnswer'}>
        <span className="text-xs text-muted-foreground">{t('sum.answeredNow.title')}</span>
        {now ? (
          <>
            <span className="text-lg font-semibold">
              <Ltr>{formatFigure(now.quantity)}</Ltr>
            </span>
            <span className="text-xs text-muted-foreground" data-answer-rule={'key' in now.rule ? now.rule.key : now.rule.raw}>
              {'key' in now.rule ? (
                t(now.rule.key)
              ) : (
                <Trans t={t} i18nKey="sum.rule.unknown" values={{ rule: now.rule.raw }} components={{ r: <Ltr /> }} />
              )}
            </span>
            {now.liveOrders !== null && (
              <span className="text-xs text-muted-foreground" data-live-orders={now.liveOrders}>
                <Trans
                  t={t}
                  i18nKey="sum.answeredNow.liveOrders"
                  values={{ n: formatFigure(now.liveOrders) }}
                  components={{ v: <Ltr /> }}
                />
              </span>
            )}
          </>
        ) : (
          <span className="text-sm font-medium text-danger-800">{t('sum.answeredNow.noAnswer')}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5" data-change-feed={changeFeedView(item)}>
        <span className="text-xs text-muted-foreground">{t('sum.changeFeed.title')}</span>
        <span className="text-lg font-semibold">
          <Ltr>{formatFigure(changeFeedView(item))}</Ltr>
        </span>
        <span className="text-xs text-muted-foreground">{t('sum.changeFeed.floor')}</span>
      </div>
    </div>
  )
}
