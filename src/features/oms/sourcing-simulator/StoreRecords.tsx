import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { storeRecords } from './money-rows-model'
import SourcePill from './SourcePill'
import { usePlanWords } from './use-plan-words'

/** A rate as a percentage to one decimal. */
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`

/**
 * How deliveries go at this store (ticket 965, spec 4354 §6 "the store record cost", story 91): per shipment, its
 * store's record for its mode — a row per measure, the store's rate against like stores, the deliveries behind it,
 * and its cost or credit. A neutral default and a steadied rate say so. The words never blame the store.
 */
export default function StoreRecords({ plan, reply }: { plan: AdvisePlan; reply: AdviseReply }) {
  const w = usePlanWords()
  const { t } = w
  return (
    <ol className="flex flex-col gap-3" data-why-records="">
      {storeRecords(plan, reply).map((r) => (
        <li key={r.no} className="flex flex-col gap-1.5 rounded-md border border-border/70 px-3 py-2 text-xs" data-why-record={r.no}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5 font-semibold">
              <span className="font-mono">
                <Ltr>{formatPair(r.store, r.storeName)}</Ltr>
              </span>
              <span className="font-normal text-muted-foreground">{t('why.records.byMode', { mode: w.mode(r.mode) })}</span>
            </span>
            {r.cost !== null && (
              <span className="flex gap-1">
                <span className="text-muted-foreground">{t('why.part.STORE_RECORD')}</span>
                <span className="font-semibold tabular-nums" data-why-record-cost="">
                  <Ltr>{w.money(r.cost)}</Ltr>
                </span>
              </span>
            )}
          </div>
          {!r.read ? (
            <p className="text-muted-foreground">{t('why.records.notRead')}</p>
          ) : r.rows.length === 0 ? (
            <p className="text-muted-foreground">{t('why.records.noRecord')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className={TH}>{t('why.records.measure')}</th>
                    <th className={`${TH} text-end`}>{t('why.records.thisStore')}</th>
                    <th className={`${TH} text-end`}>{t('why.records.likeStores')}</th>
                    <th className={`${TH} text-end`}>{t('why.records.deliveries')}</th>
                    <th className={`${TH} text-end`}>{t('why.records.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((m) => (
                    <tr key={m.measure} className="border-b border-border/60 last:border-b-0" data-why-measure={m.measure}>
                      <td className={TD}>{t(`why.measure.${m.measure}`, { defaultValue: m.measure })}</td>
                      <td className={`${TD} text-end`}>
                        <span className="inline-flex items-center justify-end gap-1">
                          {m.neutral ? (
                            <SourcePill source="NEUTRAL_DEFAULT" />
                          ) : (
                            <>
                              <span className="tabular-nums">
                                <Ltr>{percent(m.rate)}</Ltr>
                              </span>
                              {m.source !== 'STORES_OWN' && <SourcePill source={m.source} />}
                            </>
                          )}
                        </span>
                      </td>
                      <td className={`${TD} text-end tabular-nums`}>
                        <Ltr>{percent(m.likeStores)}</Ltr>
                      </td>
                      <td className={`${TD} text-end tabular-nums`}>
                        <Ltr>{formatFigure(m.count)}</Ltr>
                      </td>
                      <td className={`${TD} text-end tabular-nums`} data-why-measure-cost="">
                        {m.cost === null ? t('dash') : <Ltr>{w.money(m.cost)}</Ltr>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
