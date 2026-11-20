import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { MiniPosAllowedCategory, MiniPosRefusedItem } from '@/core/models/mini-pos'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatDateTime } from '@/core/util/date-format'

/**
 * The items screen's two lists (oms 927): the A-level allow-list and the refusal list with each item's reason. Props in,
 * markup out, so the component tests render them as static markup; the page owns the calls. Remove is drawn only with
 * `canManage` (`MiniPosAdmin:06`).
 */

const NS = 'mini-pos-items'

interface ListActions {
  canManage: boolean
  /** The key whose removal is in flight. */
  busyKey?: string | null
  onRemove: (key: string) => void
}

export function CategoryList({ rows, canManage, busyKey, onRemove }: { rows: readonly MiniPosAllowedCategory[] } & ListActions) {
  const { t } = useTranslation(NS)
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground" data-minipos-categories-empty="">{t('category.empty')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.8125rem]">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className={TH}>{t('category.code')}</th>
            <th className={TH}>{t('enteredBy')}</th>
            <th className={TH}>{t('enteredAt')}</th>
            {canManage && <th className={TH}>{t('actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aCode} className="border-t border-border/40" data-minipos-category={row.aCode}>
              <td className={`${TD} font-mono`}>
                <Ltr>{row.aCode}</Ltr>
              </td>
              <td className={`${TD} font-mono text-[12px]`}>
                <Ltr>{row.enteredBy}</Ltr>
              </td>
              <td className={`${TD} tabular-nums`}>
                <Ltr>{formatDateTime(row.enteredAt)}</Ltr>
              </td>
              {canManage && (
                <td className={TD}>
                  <Button
                    variant="danger-outlined"
                    disabled={busyKey === row.aCode}
                    onClick={() => onRemove(row.aCode)}
                    data-minipos-category-remove={row.aCode}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {t('remove')}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RefusedList({ rows, canManage, busyKey, onRemove }: { rows: readonly MiniPosRefusedItem[] } & ListActions) {
  const { t } = useTranslation(NS)
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground" data-minipos-refused-empty="">{t('refused.empty')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.8125rem]">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className={TH}>{t('refused.item')}</th>
            <th className={TH}>{t('refused.reason')}</th>
            <th className={TH}>{t('enteredBy')}</th>
            <th className={TH}>{t('enteredAt')}</th>
            {canManage && <th className={TH}>{t('actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemNumber} className="border-t border-border/40" data-minipos-refused={row.itemNumber}>
              <td className={`${TD} font-mono`}>
                <Ltr>{row.itemNumber}</Ltr>
              </td>
              <td className={`${TD} min-w-48 whitespace-normal`}>
                <bdi>{row.reasonNote}</bdi>
              </td>
              <td className={`${TD} font-mono text-[12px]`}>
                <Ltr>{row.enteredBy}</Ltr>
              </td>
              <td className={`${TD} tabular-nums`}>
                <Ltr>{formatDateTime(row.enteredAt)}</Ltr>
              </td>
              {canManage && (
                <td className={TD}>
                  <Button
                    variant="danger-outlined"
                    disabled={busyKey === row.itemNumber}
                    onClick={() => onRemove(row.itemNumber)}
                    data-minipos-refused-remove={row.itemNumber}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {t('remove')}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
