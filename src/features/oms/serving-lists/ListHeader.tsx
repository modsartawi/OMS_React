import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

import type { ServingListRow } from '@/core/models/serving-list'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import HeaderActions from './HeaderActions'
import { listFlag, membersLabel, pointingChips } from './list-view'
import PointingChips from './PointingChips'

/**
 * The serving-list detail's header (oms ticket 568): the names (EN + AR), Active / Deactivated, the member
 * counts and the pointing types, all from the list's `ServingListRow` (there is no single-list door; the
 * page picks it out of the Lists read). A deactivated list says its deliveries are not competed.
 *
 * The end of the title row is `HeaderActions` (570's slot).
 */
export default function ListHeader({ servingListId, list, canEdit }: { servingListId: string; list: ServingListRow | undefined; canEdit: boolean }) {
  const { t } = useTranslation('serving-lists')
  if (!list) {
    return (
      <section className="rounded-lg border border-border/60 bg-card p-4" data-list-header="" data-list-known="false">
        <span className="font-mono text-sm text-muted-foreground">
          <Ltr>{servingListId}</Ltr>
        </span>
      </section>
    )
  }
  const chips = pointingChips(list)
  const flag = listFlag(list)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-list-header="" data-list-known="true">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            <bdi data-name-en="">{list.nameEn}</bdi>
            <span data-status={list.isActive ? 'active' : 'deactivated'}>
              <StatusBadge sev={list.isActive ? 'ok' : 'mute'}>{t(list.isActive ? 'status.active' : 'status.deactivated')}</StatusBadge>
            </span>
          </h2>
          <div className="text-sm text-muted-foreground" lang="ar">
            <bdi data-name-ar="">{list.nameAr}</bdi>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground" data-list-id="">
            <Ltr>{list.servingListId}</Ltr>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2" data-header-actions="">
          <HeaderActions list={list} canEdit={canEdit} />
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{t('detail.members')}</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums" title={t('columns.membersTooltip')} data-header-members="">
            <Ltr>{membersLabel(list)}</Ltr>
          </span>
          {flag && (
            <span title={t(`flag.${flag}Hint`)} data-flag={flag}>
              <StatusBadge sev={flag === 'empty' ? 'mute' : 'warn'}>
                {flag !== 'empty' && <TriangleAlert className="me-1 h-3 w-3" aria-hidden />}
                {t(`flag.${flag}`)}
              </StatusBadge>
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">{t('columns.pointingTypes')}</dt>
        <dd data-header-pointing="">
          {chips.length === 0 ? <span className="text-muted-foreground" data-pointing-none="">{t('pointing.none')}</span> : <PointingChips chips={chips} />}
        </dd>
      </dl>

      {!list.isActive && (
        <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-deactivated-note="">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('detail.deactivatedNote')}
        </p>
      )}
    </section>
  )
}
