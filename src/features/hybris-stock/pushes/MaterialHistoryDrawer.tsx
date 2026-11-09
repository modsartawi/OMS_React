import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { materialHistoryKey, pushesApi } from './api'
import { PushStatus, PushType } from './PushCells'

/**
 * **A material's history at a store** (spec 3447 story 46; ticket 849): every quantity sent for it at
 * that store and when, newest first, each with its push's type and status — to answer a
 * customer complaint about one product. Opened from a push line (store and material known), or from
 * a store (`?history=<store>`: it asks for the material). `onPick` writes the material to the URL.
 */
export default function MaterialHistoryDrawer({
  storeCode,
  materialNumber,
  retentionDays,
  onPick,
  onPush,
  onClose,
}: {
  storeCode: string
  materialNumber: string | null
  /** `null` when Status cannot be read (the hint then names no number); `undefined` while it is read (no hint yet). */
  retentionDays: number | null | undefined
  onPick: (materialNumber: string) => void
  onPush: (pushId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('hybris-stock-pushes')
  const titleId = useId()
  const [draft, setDraft] = useState(materialNumber ?? '')
  const history = useQuery({
    queryKey: materialHistoryKey(storeCode, materialNumber ?? ''),
    queryFn: () => pushesApi.materialHistory(storeCode, materialNumber!),
    enabled: materialNumber !== null,
    retry: false,
  })
  const rows = history.data ?? []

  return (
    <SideSheet onClose={onClose} width="w-[48rem]" aria-labelledby={titleId} data-material-drawer={storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('history.eyebrow')}
        title={<Ltr>{materialNumber ? formatPair(storeCode, materialNumber) : storeCode}</Ltr>}
        hint={retentionDays === undefined ? undefined : retentionDays === null ? t('history.hintNoDays') : t('history.hint', { days: fsi(figure(retentionDays)) })}
        closeLabel={t('history.close')}
        onClose={onClose}
        closeData={{ 'data-material-close': '' }}
      />
      <div className={SHEET_BODY}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = draft.trim()
            if (n) onPick(n)
          }}
        >
          <Field label={t('history.material')}>
            <Input value={draft} dir="ltr" onChange={(e) => setDraft(e.target.value)} data-material-input="" />
          </Field>
          <Button type="submit" variant="secondary" disabled={!draft.trim()} data-material-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('history.look')}
          </Button>
        </form>

        {materialNumber === null && <p className="text-xs text-muted-foreground">{t('history.prompt')}</p>}
        {history.isFetching && !history.data && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('history.loading')}
          </p>
        )}
        {history.isError && <ErrorBanner className="p-2" title={t('history.failed')} message={apiErrorMessage(history.error, t('results.failed'))} />}
        {history.isSuccess && rows.length === 0 && (
          <p className="text-xs text-muted-foreground" data-material-empty="">
            {t('history.empty', { material: fsi(materialNumber ?? ''), store: fsi(storeCode) })}
          </p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-xs" data-material-table="">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className={TH}>{t('history.sentAt')}</th>
                <th className={`${TH} text-end`}>{t('history.quantity')}</th>
                <th className={TH}>{t('columns.type')}</th>
                <th className={TH}>{t('columns.status')}</th>
                <th className={TH}>{t('columns.push')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.pushId}-${r.sentAt}`} className="border-b border-border/50" data-material-line={r.pushId}>
                  <td className={TD}>
                    <Ltr>{formatDateTime(r.sentAt)}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-material-quantity="">
                    <Ltr>{figure(r.quantity)}</Ltr>
                  </td>
                  <td className={TD}>
                    <PushType type={r.type} />
                  </td>
                  <td className={TD}>
                    <PushStatus status={r.status} />
                  </td>
                  <td className={TD}>
                    <Button variant="text" onClick={() => onPush(r.pushId)} data-material-push={r.pushId}>
                      <Ltr>{r.pushId}</Ltr>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SideSheet>
  )
}
