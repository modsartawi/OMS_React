import type { ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Download, Loader2, Upload } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canViewAnalytics } from '@/core/analytics-access'
import { itemListUploadHref } from '@/core/analytics-routes'
import type { ItemList } from '@/core/models/item-list'
import { usePermissions } from '@/core/permissions'
import { saysIn } from '@/core/rules/sentence'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatDateTime } from '@/core/util/date-format'
import { saveBlob } from '@/core/util/download-file'
import { itemListActions } from './access'
import { itemListApi, itemListKey, itemListVersionsKey } from './api'
import { MembersGrid, PeriodsGrid } from './ItemListGrids'

/**
 * An item list's own page (oms 925, BackOffice spec 4057), for anyone in its audience: its members with their level,
 * the periods with their status chips and notes, the values the last file held that matched nothing, and its
 * versions — who uploaded each and when. Export is everyone's; a new version (the re-upload, through the same
 * preview) is the owner's, with the author grant.
 */
export default function ItemListPage() {
  const { t } = useTranslation('item-lists')
  const { id = '' } = useParams()
  return (
    <ScreenGate can={canViewAnalytics} ns="item-lists" title={t('list.title')} subtitle={t('list.subtitle')}>
      <OpenedList key={id} id={id} />
    </ScreenGate>
  )
}

function OpenedList({ id }: { id: string }) {
  const { t, i18n } = useTranslation('item-lists')
  const permissions = usePermissions()
  const userId = useSession((s) => s.userId)
  const list = useQuery({ queryKey: itemListKey(id), queryFn: () => itemListApi.get(id), retry: false })
  const exported = useMutation({ mutationFn: () => itemListApi.export(id), onSuccess: ({ blob, fileName }) => saveBlob(fileName, blob) })

  if (list.isPending)
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-item-list-loading="">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('list.loading')}
      </p>
    )
  if (!list.data)
    return (
      <div data-item-list-failed="">
        <ErrorBanner message={apiErrorMessage(list.error, t('list.failed'))} />
      </div>
    )

  const l = list.data
  const can = itemListActions(permissions, userId, l)
  return (
    <div className="flex w-full max-w-6xl flex-col gap-4" data-item-list={l.id}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold" data-item-list-name="">
            <bdi>{saysIn(l.title, i18n.language)}</bdi>
          </h2>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Fact label={t('list.owner')}>
              <Ltr>{l.owner}</Ltr>
            </Fact>
            <Fact label={t('list.version')}>
              <Ltr>{l.revision}</Ltr>
            </Fact>
            {l.upload && (
              <Fact label={t('list.lastUpload')}>
                <span data-item-list-upload-line="">
                  <Trans
                    t={t}
                    i18nKey="list.uploadLine"
                    values={{ fileName: l.upload.fileName, matched: l.upload.matched, rows: l.upload.rows }}
                    components={{ file: <bdi />, matched: <Ltr />, rows: <Ltr /> }}
                  />
                </span>
              </Fact>
            )}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.export && (
            <Button variant="secondary" onClick={() => exported.mutate()} disabled={exported.isPending} data-item-list-export="">
              {exported.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
              {t(exported.isPending ? 'list.exporting' : 'list.export')}
            </Button>
          )}
          {can.reupload && (
            <Link to={itemListUploadHref(l.id)} className={buttonClass('primary')} data-item-list-reupload="">
              <Upload className="size-3.5" aria-hidden />
              {t('list.reupload')}
            </Link>
          )}
        </div>
      </header>
      {exported.isError && <ErrorBanner message={apiErrorMessage(exported.error, t('list.exportFailed'))} />}

      <Section title={t('list.members')} count={l.members.length} k="members">
        {l.members.length ? <MembersGrid members={l.members} periods={l.periods} /> : <Empty>{t('list.noMembers')}</Empty>}
      </Section>
      <Section title={t('list.periods')} count={l.periods.length} k="periods">
        {l.periods.length ? <PeriodsGrid members={l.members} periods={l.periods} /> : <Empty>{t('list.noPeriods')}</Empty>}
      </Section>
      <Section title={t('list.unknown')} count={l.unknown.length} k="unknown">
        {l.unknown.length ? <UnknownValues list={l} /> : <Empty>{t('list.noUnknown')}</Empty>}
      </Section>
      <Versions id={l.id} />
    </div>
  )
}

function UnknownValues({ list }: { list: ItemList }) {
  const { t } = useTranslation('item-lists')
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {list.unknown.map((u, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-2" data-item-list-unknown={u.row}>
          <span className="text-xs text-muted-foreground">{t('preview.row')}</span>
          <span className="rounded bg-muted px-1.5 font-mono text-xs">
            <Ltr>{u.row}</Ltr>
          </span>
          {u.level && <span className="text-xs text-muted-foreground">{t(`level.${u.level}`, { defaultValue: u.level })}</span>}
          <span className="font-mono">
            <bdi>{u.value}</bdi>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Versions({ id }: { id: string }) {
  const { t } = useTranslation('item-lists')
  const versions = useQuery({ queryKey: itemListVersionsKey(id), queryFn: () => itemListApi.versions(id), retry: false })
  const rows = versions.data ?? []
  return (
    <Section title={t('list.versions')} count={rows.length} k="versions">
      {versions.isPending ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
      ) : versions.isError ? (
        <ErrorBanner message={apiErrorMessage(versions.error, t('list.failed'))} />
      ) : rows.length === 0 ? (
        <Empty>{t('list.noVersions')}</Empty>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {rows.map((v) => (
            <li key={v.revision} data-item-list-version={v.revision}>
              <Trans t={t} i18nKey="list.versionBy" values={{ revision: v.revision, by: v.by, at: formatDateTime(v.at) }} components={{ rev: <Ltr />, by: <Ltr />, at: <Ltr /> }} />
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

function Section({ title, count, k, children }: { title: string; count: number; k: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" data-item-list-section={k} data-count={count}>
      <h3 className="text-sm font-semibold">
        {title}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          (<Ltr>{count}</Ltr>)
        </span>
      </h3>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  )
}
