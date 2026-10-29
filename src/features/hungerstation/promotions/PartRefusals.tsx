import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import type { HungerStationPromotionPart } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { copyText } from '@/core/util/copy-text'
import { formatFigure as figure } from '@/core/util/number-format'
import { refusalsByStore, refusalsCopyText, refusalsForStore, type RefusalList, type RefusalsByStore, type StoreRefusals } from './part-refusals'

/**
 * **What HungerStation refused** (ticket 669; BackOffice 3214): for each part whose latest final
 * answer refused something, the three lists of that answer — stores HungerStation called invalid
 * (our store code + the vendor id sent), materials it could not find, and materials whose promo
 * price it found above its list price — each per store. One store filter per part narrows all
 * three; each list copies as it is filtered. A part with nothing refused shows nothing here, and
 * with no part refused the section is not drawn.
 */
export default function PartRefusals({ parts }: { parts: HungerStationPromotionPart[] }) {
  const { t } = useTranslation('hungerstation-promotions')
  const refused = parts.flatMap((part) => {
    const grouped = refusalsByStore(part.refusals)
    return grouped ? [{ part, grouped }] : []
  })
  if (refused.length === 0) return null
  return (
    <section className="flex flex-col gap-3" data-promotion-refusals="">
      <h3 className="text-xs font-semibold tracking-tight">{t('refusals.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('refusals.hint')}</p>
      {refused.map(({ part, grouped }) => (
        <PartRefusal key={part.partId} part={part} grouped={grouped} />
      ))}
    </section>
  )
}

const storeLabel = (t: (k: string, o?: Record<string, unknown>) => string, s: StoreRefusals) =>
  s.storeCode !== null ? fsi(s.storeCode) : t('refusals.vendorOption', { vendorId: fsi(s.vendorId) })

function PartRefusal({ part, grouped }: { part: HungerStationPromotionPart; grouped: RefusalsByStore }) {
  const { t } = useTranslation('hungerstation-promotions')
  const [store, setStore] = useState<string | null>(null)
  const shown = refusalsForStore(grouped, store)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3" data-promotion-refusal-part={part.partId}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm font-medium">
          <bdi>{part.name}</bdi>
        </span>
        <Field label={t('refusals.store')}>
          <Select value={store ?? ''} onChange={(e) => setStore(e.target.value || null)} data-refusal-store="">
            <option value="">{t('refusals.storeAll')}</option>
            {grouped.stores.map((s) => (
              <option key={s.key} value={s.key}>
                {storeLabel(t, s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <RefusalTable list="invalidVendors" total={grouped.counts.invalidVendors} stores={shown} />
        <RefusalTable list="missingSkus" total={grouped.counts.missingSkus} stores={shown} />
        <RefusalTable list="invalidDiscountedSkus" total={grouped.counts.invalidDiscountedSkus} stores={shown} />
      </div>
    </div>
  )
}

/** One of the three lists, under the store filter, with its whole-part count and a Copy. */
function RefusalTable({ list, total, stores }: { list: RefusalList; total: number; stores: StoreRefusals[] }) {
  const { t } = useTranslation('hungerstation-promotions')
  const rows =
    list === 'invalidVendors'
      ? stores.filter((s) => s.invalidVendor).map((s) => ({ s, sku: null }))
      : stores.flatMap((s) => (list === 'missingSkus' ? s.missing : s.overList).map((sku) => ({ s, sku })))
  const copy = async (e: MouseEvent<HTMLButtonElement>) => {
    const outcome = await copyText(refusalsCopyText(stores, list), { container: e.currentTarget.closest('dialog') })
    if (outcome === 'copied') notify.success(t('refusals.copied'))
    else notify.error(t('refusals.copyFailed'), t('refusals.copyFailedDetail'))
  }
  return (
    <div className="flex min-w-0 flex-col gap-1" data-refusal-list={list}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {t(`refusals.${list}`)}
          <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums" data-refusal-count="">
            <Ltr>{figure(total)}</Ltr>
          </span>
        </span>
        <Button variant="ghost" disabled={rows.length === 0} onClick={(e) => void copy(e)} data-refusal-copy={list}>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {t('refusals.copy')}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('refusals.none')}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('refusals.columns.store')}</th>
              <th className={TH}>{t('refusals.columns.vendorId')}</th>
              {list !== 'invalidVendors' && <th className={TH}>{t('refusals.columns.material')}</th>}
              {list !== 'invalidVendors' && <th className={TH}>{t('refusals.columns.sku')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, sku }) => (
              <tr key={`${s.key}|${sku?.sku ?? ''}`} className="border-b border-border/40" data-refusal-row={s.key}>
                <td className={TD + ' font-mono'}>{s.storeCode !== null ? <Ltr>{s.storeCode}</Ltr> : <span className="text-muted-foreground">{t('refusals.unresolved')}</span>}</td>
                <td className={TD + ' font-mono'}>
                  <Ltr>{s.vendorId}</Ltr>
                </td>
                {sku && <td className={TD + ' font-mono'}>{sku.materialNumber ? <Ltr>{sku.materialNumber}</Ltr> : null}</td>}
                {sku && (
                  <td className={TD + ' font-mono'}>
                    <Ltr>{sku.sku}</Ltr>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
