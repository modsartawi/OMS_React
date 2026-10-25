import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { HUNGERSTATION_MATERIAL_HISTORY_CAP, HUNGERSTATION_SYNC_HISTORY_DAYS, type HungerStationMaterialLine } from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { materialLinesKey, storesApi } from './api'
import { LineCells, PushStatus, PushType } from './PushCells'
import { cappedNotice, historyRefusal, pushReading } from './sync-history'

const INPUT =
  'h-8 w-48 rounded-md border border-border/60 bg-background px-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none'

/**
 * **A material's history at one HungerStation store** (ticket 554; contract `GET Sync/{store}/Lines?material=`)
 * — every line sent for one material at the store in the last 15 days, newest first, each with its
 * push's type and status: "what stock did HungerStation last get for 601624 at 1234?". The door
 * answers at most the newest 200 lines; when it does, a notice says older ones are not shown. A
 * failed push's line is red, an inactive line amber, a value not sent blank.
 *
 * Like the logs drawer it takes a store CODE (the page opens it from `?history=<code>`), so a
 * removed store's history stays readable. DHS-00007 — no store and no logs — says so in words.
 *
 * 🚩 Open (owner, BackOffice 3028): in production this read is a seek only once BackOffice 3034's
 * purge and index script 007 part 2 are in; until then each lookup scans the whole lines table.
 * Whether this entry point shows before then is the owner's call — no switch hides it yet.
 */
export default function MaterialHistoryDrawer({ storeCode, storeName, onClose }: { storeCode: string; storeName: string; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const titleId = useId()
  const [draft, setDraft] = useState('')
  const [material, setMaterial] = useState('')
  const history = useQuery({
    queryKey: materialLinesKey(storeCode, material),
    queryFn: () => storesApi.materialLines(storeCode, material),
    enabled: material !== '',
    retry: false,
  })
  const days = fsi(String(HUNGERSTATION_SYNC_HISTORY_DAYS))
  const capped = history.data ? cappedNotice(history.data) : null

  return (
    <SideSheet onClose={onClose} width="w-[60rem]" aria-labelledby={titleId} data-hs-material-drawer={storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('material.eyebrow')}
        // A pair led by a machine value: one string, isolated once (bidi rule).
        title={<Ltr>{formatPair(storeCode, storeName)}</Ltr>}
        hint={t('material.hint', { days, max: fsi(figure(HUNGERSTATION_MATERIAL_HISTORY_CAP)) })}
        closeLabel={t('material.close')}
        onClose={onClose}
        titleData={{ 'data-hs-material-title': '' }}
        closeData={{ 'data-hs-material-close': '' }}
      />
      <div className={SHEET_BODY}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const next = draft.trim()
            if (next === material) void history.refetch()
            else setMaterial(next)
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('material.material')}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('material.materialPlaceholder')}
              className={INPUT}
              dir="ltr"
              data-hs-material-input=""
            />
          </label>
          <Button type="submit" className="h-8" disabled={draft.trim() === '' || history.isFetching} data-hs-material-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('material.search')}
          </Button>
        </form>

        {material === '' ? (
          <p className="text-sm text-muted-foreground" data-hs-material-prompt="">
            {t('material.prompt')}
          </p>
        ) : history.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-hs-material-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('material.loading')}
          </p>
        ) : history.isError && historyRefusal(apiErrorCode(history.error)) === 'unknownStore' ? (
          <p role="status" className="rounded-md border border-border/60 bg-card-2 px-3 py-2 text-sm text-muted-foreground" data-hs-material-unknown="">
            {t('logs.unknownStore')}
          </p>
        ) : history.isError ? (
          <div data-hs-material-error={apiErrorCode(history.error) ?? ''}>
            <ErrorBanner className="p-3" title={t('material.failed')} message={apiErrorMessage(history.error, t('dialog.failedHint'))} />
          </div>
        ) : history.data.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-hs-material-empty="">
            <Trans t={t} i18nKey="material.empty" values={{ material, days }} components={{ m: <Ltr /> }} />
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {capped && (
              <p role="status" className="text-xs text-muted-foreground" data-hs-material-capped="">
                {t(capped.key, { max: fsi(capped.max), days: fsi(capped.days) })}
              </p>
            )}
            <table className="w-full border-collapse text-xs" data-hs-material-table="">
              <thead className="border-b border-border/60 text-muted-foreground">
                <tr>
                  <th className={TH}>{t('material.columns.sentAt')}</th>
                  <th className={TH}>{t('material.columns.type')}</th>
                  <th className={TH}>{t('material.columns.status')}</th>
                  <th className={TH}>{t('lines.columns.active')}</th>
                  <th className={TH + ' text-end'}>{t('lines.columns.quantity')}</th>
                  <th className={TH + ' text-end'}>{t('lines.columns.maximumSalesQuantity')}</th>
                  <th className={TH + ' text-end'}>{t('lines.columns.price')}</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((line, i) => (
                  <MaterialRow key={`${line.logId}|${i}`} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SideSheet>
  )
}

/** One line with its push: a failed push's line is red, an inactive line amber. */
function MaterialRow({ line }: { line: HungerStationMaterialLine }) {
  const failed = pushReading(line) === 'failed'
  const inactive = line.active === false
  return (
    <tr
      className={'border-b border-border/40 ' + (failed ? 'bg-danger-050' : inactive ? 'bg-attention-050' : '')}
      data-hs-material-line={line.logId}
      data-hs-material-failed={failed ? '' : undefined}
      data-line-inactive={inactive ? '' : undefined}
    >
      <td className={TD} data-line-sent-at="">
        <Ltr>{formatDateTime(line.sentAt)}</Ltr>
      </td>
      <td className={TD} data-line-push-type="">
        <PushType syncType={line.syncType} />
      </td>
      <td className={TD} data-line-push-status="">
        <PushStatus push={line} />
      </td>
      <LineCells line={line} />
    </tr>
  )
}
