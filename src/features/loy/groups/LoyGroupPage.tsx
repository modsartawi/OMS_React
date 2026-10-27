import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { canMaintainLoyGroups, canViewLoyGroups, loyGroupName, loyGroupsAccessQuery } from '@/core/loy-groups/api'
import { loyGroupRefusal } from '@/core/loy-groups/refusal'
import type { LoyGroupDetail } from '@/core/models/loy-groups'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { groupsApi, loyGroupKey } from './api'
import { renameRequest } from './group-form'
import MembersTab from './MembersTab'
import RefusalLine from './RefusalLine'

/**
 * One loyalty group — `/loy/groups/:groupId` (oms ticket 630; door `GET LoyGroupWeb/Groups/{groupId}`).
 * The code is read-only, always: no field anywhere renames it. The English and Arabic names are edited
 * and saved through `Rename` (the Arabic name exactly as typed). Created and updated by/at in local
 * wall-clock. The home later tickets add to (631 the active toggle, 632 the members tab).
 *
 * Behind the same `canViewLoyGroups` gate as the list; Save is absent on a view-only grant.
 */
export default function LoyGroupPage() {
  const { t } = useTranslation('loy-groups')
  return (
    <ScreenGate query={loyGroupsAccessQuery()} can={canViewLoyGroups} ns="loy-groups" title={t('title')} subtitle={t('subtitle')}>
      <Group />
    </ScreenGate>
  )
}

function Group() {
  const { t } = useTranslation('loy-groups')
  const { groupId = '' } = useParams()
  const group = useQuery({ queryKey: loyGroupKey(groupId), queryFn: () => groupsApi.group(groupId) })
  const access = useQuery(loyGroupsAccessQuery())
  const canMaintain = canMaintainLoyGroups(access.data)

  return (
    <div className="flex min-w-0 flex-col gap-3" data-loy-group={groupId}>
      <Link to="/loy/groups" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('group.back')}
      </Link>
      {group.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(group.error, t('group.failed'))} />
      ) : !group.data ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('group.loading')}
        </div>
      ) : (
        // Re-seeded whenever the server's copy changes (a save, a refetch), never while the user types.
        <GroupBody key={`${group.data.groupId}:${group.data.updatedAt ?? ''}`} group={group.data} canMaintain={canMaintain} />
      )}
    </div>
  )
}

function GroupBody({ group, canMaintain }: { group: LoyGroupDetail; canMaintain: boolean }) {
  const { t, i18n } = useTranslation('loy-groups')
  const queryClient = useQueryClient()
  const [nameEn, setNameEn] = useState(group.nameEn)
  const [nameAr, setNameAr] = useState(group.nameAr)
  const dirty = nameEn !== group.nameEn || nameAr !== group.nameAr

  const rename = useMutation({
    mutationFn: () => groupsApi.rename(renameRequest(group.groupId, { nameEn, nameAr })),
    onSuccess: (saved) => {
      queryClient.setQueryData(loyGroupKey(group.groupId), saved)
      void queryClient.invalidateQueries({ queryKey: ['loy', 'groups', 'list'] })
      notify.success(t('group.saved'))
    },
  })
  const refusal = rename.isError ? loyGroupRefusal(rename.error, i18n.language, t('group.saveFailed')) : null

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          <bdi>{loyGroupName(group, i18n.language) || group.code}</bdi>
        </h2>
        <StatusBadge sev={group.isActive ? 'ok' : 'mute'}>{t(group.isActive ? 'status.active' : 'status.inactive')}</StatusBadge>
      </header>

      <section className="grid max-w-3xl gap-3 rounded-lg border border-border/60 bg-card p-4 sm:grid-cols-2">
        <Fact label={t('fields.code')} className="sm:col-span-2">
          {/* 🚩 Text, never a field: a group's code never changes after create. */}
          <span className="font-mono text-sm" data-loy-group-code="">
            <Ltr>{group.code}</Ltr>
          </span>
        </Fact>
        {canMaintain ? (
          <>
            <Field label={t('fields.nameEn')}>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} lang="en" dir="auto" data-loy-group-field="nameEn" />
            </Field>
            <Field label={t('fields.nameAr')}>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} lang="ar" dir="auto" data-loy-group-field="nameAr" />
            </Field>
          </>
        ) : (
          <>
            <Fact label={t('fields.nameEn')}>
              <bdi data-loy-group-name="en">{group.nameEn}</bdi>
            </Fact>
            <Fact label={t('fields.nameAr')}>
              <bdi lang="ar" data-loy-group-name="ar">
                {group.nameAr}
              </bdi>
            </Fact>
          </>
        )}
        {canMaintain && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              variant="primary"
              onClick={() => rename.mutate()}
              disabled={!dirty || rename.isPending}
              data-loy-group-save=""
            >
              {rename.isPending ? t('group.saving') : t('group.save')}
            </Button>
          </div>
        )}
        {refusal && (
          <ErrorBanner className="p-3 sm:col-span-2" title={t('group.refused')} message={refusal.message}>
            <RefusalLine code={refusal.code} />
          </ErrorBanner>
        )}
      </section>

      <section className="grid max-w-3xl gap-3 sm:grid-cols-2" data-loy-group-audit="">
        <Fact label={t('group.created')}>
          <Stamp by={group.createdBy} at={group.createdAt} name="created" />
        </Fact>
        <Fact label={t('group.updated')}>
          <Stamp by={group.updatedBy} at={group.updatedAt} name="updated" />
        </Fact>
      </section>

      {/* Ticket 632: the group's members — paged, searched, added and removed one at a time. */}
      <MembersTab groupId={group.groupId} mobileCount={group.mobileCount} canMaintain={canMaintain} />
    </>
  )
}

function Fact({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

/** Who and when — the user as free text, the time local wall-clock (the door sends no `Z`). */
function Stamp({ by, at, name }: { by: string | null; at: string | null; name: string }) {
  const { t } = useTranslation('loy-groups')
  const when = formatDateTime(at)
  if (!by && !when) {
    return (
      <span className="text-muted-foreground" data-loy-group-stamp={name}>
        {t('group.never')}
      </span>
    )
  }
  return (
    <span className="flex flex-wrap gap-x-2" data-loy-group-stamp={name}>
      {by && <bdi data-stamp-by="">{by}</bdi>}
      {when && (
        <span className="tabular-nums text-muted-foreground" data-stamp-at="">
          <Ltr>{when}</Ltr>
        </span>
      )}
    </span>
  )
}
