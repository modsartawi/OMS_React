import { memo, type ReactNode, type RefObject } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, ImageDown, Link2, Maximize2, Minimize2, RefreshCw, Table2, TriangleAlert, ChartColumn } from 'lucide-react'
import { formatClock } from '@/core/charts/format'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { copyText } from '@/core/util/copy-text'
import { downloadCsv, saveBlob } from '@/core/util/download-file'
import { writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { useNow } from './panel-hooks'
import { chartPng, drawsAsPicture } from './panel-png'
import { fetchedAgo, isBehind } from './panel-state'
import { panelCsv, panelFileBase, panelSheet, panelTable } from './panel-table'
import { useCalculatedModel } from './use-calculations'

/**
 * A panel's actions and freshness (spec 766 §F, ticket 773), in the header slot of a board panel
 * (`data-board-panel-actions`) and of the view page: "data as of HH:MM", the "data is behind" chip past
 * 45 minutes, the row-cap chip, "fetched N ago" with refresh, then view as table, full screen, CSV, xlsx,
 * PNG and the permalink. Each download writes the panel's rows (`./panel-table`) with isolates stripped.
 *
 * 780's TV mode reuses the full screen ({@link useFullscreen}) and the refresh (`onRefresh`).
 *
 * Memoised and deliberately blind to `isFetching` (the chart frame shows the busy state): with stable
 * props it does not re-render when a board's re-ask turns every panel busy, which 771 keeps under 0.5 s.
 */
export interface PanelActionsProps {
  viewId: string
  /** The panel's title as shown: the sheet name of the xlsx. */
  title: string
  /** The answer drawn (the previous one while a re-ask is in flight). */
  result: AnalyticsQueryResult | undefined
  /** When the client last received an answer (`dataUpdatedAt`): "fetched N ago" when the server sends no `fetchedAt`. */
  updatedAt: number
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  onRefresh: () => void
  table: boolean
  onTable: () => void
  /** The panel element: what goes full screen, and where the chart's SVG is read for the PNG. */
  frame: RefObject<HTMLElement | null>
  fullscreen: { on: boolean; toggle: () => void }
  permalink: () => string
}

const stamped = (base: string, ext: string) => xlsxFileName(base).replace(/\.xlsx$/, `.${ext}`)

export default memo(function PanelActions(p: PanelActionsProps) {
  const { t } = useTranslation('boards')
  const now = useNow()
  const { result, lang } = p
  const asOf = result ? formatClock(result.dataAsOf, lang) : ''
  const behind = !!result && isBehind(result.dataAsOf, now)
  const ago = result ? fetchedAgo(result.fetchedAt || (p.updatedAt ? new Date(p.updatedAt).toISOString() : ''), now) : null
  const base = panelFileBase(p.viewId)
  // 861: the downloads carry the calculated columns under their labels.
  const shown = useCalculatedModel(p.model, p.definition, result, lang)
  const table = () =>
    panelTable(result!, p.definition, shown, lang, {
      series: t('view.seriesColumn'),
      previous: (measure) => t('view.previousColumn', { measure: fsi(measure) }),
      // 864 (spec 3543 decision 12): a cross-area answer's "All" rows are written last, the unsplit dimension "All".
      all: t('view.allMembers'),
    })

  const picture = drawsAsPicture(p.definition.chart.type)
  const pngReason = !picture ? t('panel.pngUnavailable') : p.table ? t('panel.pngTableView') : null

  const png = async () => {
    const el = p.frame.current
    if (!el || pngReason) return
    const blob = await chartPng(el, getComputedStyle(el).backgroundColor).catch(() => null)
    if (blob) saveBlob(stamped(base, 'png'), blob)
    else toast.error(t('panel.pngFailed'))
  }
  const link = async () => {
    const outcome = await copyText(p.permalink())
    if (outcome === 'copied') toast.success(t('panel.permalinkCopied'))
    else toast.error(t('panel.permalinkFailed'))
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-muted-foreground" data-panel-chrome>
      {behind && (
        <span title={t('panel.behindHint')} data-analytics-behind>
          <StatusBadge sev="warn">
            <TriangleAlert className="me-1 size-3" aria-hidden />
            {t('panel.behind')}
          </StatusBadge>
        </span>
      )}
      {result?.truncated && (
        <span title={t('panel.truncatedHint')} data-analytics-truncated>
          <StatusBadge sev="mute">{t('panel.truncated')}</StatusBadge>
        </span>
      )}
      {asOf && (
        <span data-analytics-as-of>
          <Trans t={t} i18nKey="view.dataAsOf" values={{ at: asOf }} components={{ at: <Ltr /> }} />
        </span>
      )}
      {ago && (
        <span data-analytics-fetched={ago.key}>
          {ago.key === 'justNow' ? (
            t('panel.fetched.justNow')
          ) : (
            <Trans t={t} i18nKey={`panel.fetched.${ago.key}`} count={ago.n} values={{ count: ago.n }} components={{ n: <Ltr /> }} />
          )}
        </span>
      )}
      <div className="flex items-center print:hidden" role="toolbar" aria-label={t('panel.actions')} data-panel-actions>
        <Action label={t('panel.refresh')} action="refresh" onClick={p.onRefresh}>
          <RefreshCw className="size-3.5" aria-hidden />
        </Action>
        {p.definition.chart.type !== 'table' && (
          <Action label={t(p.table ? 'panel.hideTable' : 'panel.showTable')} action="table" onClick={p.onTable} pressed={p.table} disabled={!result}>
            {p.table ? <ChartColumn className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
          </Action>
        )}
        <Action label={t(p.fullscreen.on ? 'panel.exitFullscreen' : 'panel.fullscreen')} action="fullscreen" onClick={p.fullscreen.toggle} pressed={p.fullscreen.on}>
          {p.fullscreen.on ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
        </Action>
        <Action label={t('panel.csv')} action="csv" disabled={!result} onClick={() => downloadCsv(stamped(base, 'csv'), panelCsv(table()))}>
          <FileText className="size-3.5" aria-hidden />
        </Action>
        <Action label={t('panel.xlsx')} action="xlsx" disabled={!result} onClick={() => void writeWorkbook([panelSheet(table(), p.title)], xlsxFileName(base))}>
          <FileSpreadsheet className="size-3.5" aria-hidden />
        </Action>
        <Action label={t('panel.png')} action="png" disabled={!result} reason={pngReason} onClick={() => void png()}>
          <ImageDown className="size-3.5" aria-hidden />
        </Action>
        <Action label={t('panel.permalink')} action="permalink" onClick={() => void link()}>
          <Link2 className="size-3.5" aria-hidden />
        </Action>
      </div>
    </div>
  )
})

/** One action. Disabled with a reason stays focusable (`aria-disabled`) and says why in its title. */
function Action({
  label,
  action,
  onClick,
  disabled,
  reason,
  pressed,
  children,
}: {
  label: string
  action: string
  onClick: () => void
  disabled?: boolean
  reason?: string | null
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <IconButton
      label={label}
      title={reason ?? undefined}
      disabled={disabled}
      aria-disabled={reason ? true : undefined}
      aria-pressed={pressed}
      onClick={reason ? undefined : onClick}
      data-panel-action={action}
    >
      {children}
    </IconButton>
  )
}
