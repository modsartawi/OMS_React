import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { canEditServingLists, canViewServingLists, servingListAccessQuery } from '@/core/serving-list/access'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { listsQuery } from './api'
import ListHeader from './ListHeader'
import ListTabs from './ListTabs'

/**
 * One serving list — `/oms/serving-lists/:servingListId` (BackOffice spec 3042, oms ticket 568). The header
 * (names, status, member counts, pointing types) from the list's `ServingListRow`, then the tabs: Members
 * (568 — every member with its duty today, filtered by city, enabled state and duty) and History (571).
 *
 * Behind `canViewServingLists` like the lists page; edit controls (569, 570) read `canEditServingLists` off
 * the same cached probe, handed down as `canEdit`.
 *
 * Seams: `HeaderActions` (570) in the header, `MembersToolbar` (569) and `MemberActionsCell` (570) on the
 * Members tab, `HistoryTab` (571).
 */
export default function ServingListPage() {
  const { t } = useTranslation('serving-lists')
  return (
    <ScreenGate query={servingListAccessQuery()} can={canViewServingLists} ns="serving-lists" title={t('detail.title')} subtitle={t('detail.subtitle')}>
      <Detail />
    </ScreenGate>
  )
}

function Detail() {
  const { t } = useTranslation('serving-lists')
  const { servingListId = '' } = useParams()
  const access = useQuery(servingListAccessQuery())
  const canEdit = canEditServingLists(access.data)
  // No single-list door: the header's facts come from the (cached) Lists read.
  const lists = useQuery(listsQuery())
  const list = lists.data?.find((r) => r.servingListId === servingListId)
  // Without the Lists read the header cannot say the list's names (and its edit controls stay hidden): say so.
  const listsFailed = lists.isError
    ? isBareDenial(lists.error)
      ? t('access.deniedHint')
      : apiErrorMessage(lists.error, t('failed'))
    : null

  return (
    <div className="flex min-w-0 flex-col gap-4" data-serving-list={servingListId}>
      <Link to="/oms/serving-lists" className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline" data-back="">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('detail.back')}
      </Link>
      <ListHeader servingListId={servingListId} list={list} canEdit={canEdit} />
      {listsFailed !== null && (
        <ErrorBanner className="p-3" title={t('detail.listFailed')} message={listsFailed}>
          <span data-lists-failed="" />
        </ErrorBanner>
      )}
      {/* Keyed on the list, so following a link to another list resets each tab's own state. */}
      <ListTabs key={servingListId} servingListId={servingListId} list={list} canEdit={canEdit} />
    </div>
  )
}
