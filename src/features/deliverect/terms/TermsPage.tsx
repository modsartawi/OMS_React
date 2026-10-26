import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CalendarPlus, ListOrdered, Pencil, Plus } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { deliverectAccessQuery, deliverectAccountsQuery, deliverectPlatformsQuery } from '@/core/deliverect/api'
import { canAddPlatform, canManageTerms } from '@/core/deliverect/access'
import type { DeliverectPlatform } from '@/core/models/deliverect'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatNumber } from '@/core/util/number-format'
import { TERMS_KEY, termsApi } from './api'
import { AddTermsDialog, PlatformDialog } from './TermsDialogs'
import { money, termsTimeline } from './terms-timeline'

/**
 * Delivery platforms and their terms (ticket 482, BackOffice spec 2615 / ADR 0080; contract
 * § Platforms and terms): the Deliverect accounts (read only), each **delivery platform** with its
 * Deliverect channel id, credit customer and active flag (edited with a reason), and the platform's
 * effective-dated terms as a timeline. A new terms row closes the previous one the day before it
 * starts; rows are never edited or deleted, so there is no edit or delete affordance on a row.
 *
 * Behind `canManageTerms` on the ONE Deliverect probe, the same predicate the menu leaf reads. Its
 * doors are BackOffice 2627. **Add platform** shows only with the probe's `canAddPlatform` — its
 * own grant, since a platform is a new SAP credit-customer route; the door re-checks it.
 */
export default function TermsPage() {
  const { t } = useTranslation('deliverect-terms')
  return (
    <ScreenGate query={deliverectAccessQuery()} can={canManageTerms} ns="deliverect-terms" title={t('title')} subtitle={t('subtitle')}>
      <Terms />
    </ScreenGate>
  )
}

const TH = 'px-2 py-1.5 text-start font-medium whitespace-nowrap'
const TD = 'px-2 py-1.5 align-middle whitespace-nowrap'
const TABLE = 'w-full border-collapse text-sm'
const HEAD = 'border-b border-border/60 text-xs text-muted-foreground'
const ROW = 'border-b border-border/40 last:border-b-0'

function Terms() {
  const { t } = useTranslation('deliverect-terms')
  const [params, setParams] = useSearchParams()
  const platforms = useQuery(deliverectPlatformsQuery())
  const list = useMemo(() => platforms.data ?? [], [platforms.data])
  // The platform whose terms are shown: the URL's, else the first one listed.
  const picked = params.get('platform')
  const selected = list.find((p) => p.platformKey === picked) ?? (picked === null ? list[0] : undefined) ?? null
  const [editing, setEditing] = useState<DeliverectPlatform | null>(null)
  const [adding, setAdding] = useState(false)
  // The same probe ScreenGate read (cached); only an explicit grant shows the button.
  const access = useQuery(deliverectAccessQuery())
  const mayAdd = canAddPlatform(access.data)

  return (
    <div className="flex flex-col gap-4">
      <Accounts />
      <Section
        title={t('platforms.title')}
        data="platforms"
        action={
          mayAdd && (
            <Button onClick={() => setAdding(true)} disabled={!platforms.isSuccess} data-platform-add="">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('platforms.add')}
            </Button>
          )
        }
      >
        <Loaded query={platforms} what="platforms" empty={list.length === 0}>
          <table className={TABLE} data-platforms-table="">
            <thead className={HEAD}>
              <tr>
                <PlatformHeaders />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <PlatformRow
                  key={p.platformKey}
                  p={p}
                  selected={selected?.platformKey === p.platformKey}
                  onPick={() => setParams({ platform: p.platformKey }, { replace: true })}
                  onEdit={() => setEditing(p)}
                />
              ))}
            </tbody>
          </table>
        </Loaded>
      </Section>
      {selected ? <Timeline key={selected.platformKey} platform={selected} /> : platforms.isSuccess && list.length > 0 && <PickHint />}
      {editing && <PlatformDialog platform={editing} onClose={() => setEditing(null)} />}
      {adding && mayAdd && <PlatformDialog platform={null} onClose={() => setAdding(false)} />}
    </div>
  )
}

function Section({ title, hint, action, data, children }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3" data-section={data}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {action && <span className="ms-auto">{action}</span>}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

/** A read's loading / failed / empty line, else its table. */
function Loaded({
  query,
  what,
  empty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown }
  what: 'accounts' | 'platforms' | 'timeline'
  empty: boolean
  children: ReactNode
}) {
  const { t } = useTranslation('deliverect-terms')
  if (query.isPending) return <p className="text-xs text-muted-foreground" data-loading={what}>{t(`${what}.loading`)}</p>
  if (query.isError)
    return <ErrorBanner className="p-2" title={t(`${what}.failed`)} message={apiErrorMessage(query.error, t('failedHint'))} />
  if (empty) return <p className="text-xs text-muted-foreground" data-empty={what}>{t(`${what}.empty`)}</p>
  return <>{children}</>
}

/** The Deliverect accounts, read only (`GET Accounts`). */
function Accounts() {
  const { t } = useTranslation('deliverect-terms')
  const accounts = useQuery(deliverectAccountsQuery())
  const rows = accounts.data ?? []
  return (
    <Section title={t('accounts.title')} hint={t('accounts.hint')} data="accounts">
      <Loaded query={accounts} what="accounts" empty={rows.length === 0}>
        <table className={TABLE} data-accounts-table="">
          <thead className={HEAD}>
            <tr>
              <th className={TH}>{t('accounts.columns.accountKey')}</th>
              <th className={TH}>{t('accounts.columns.deliverectAccountId')}</th>
              <th className={TH}>{t('accounts.columns.active')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.accountKey} className={ROW} data-account-row={a.accountKey}>
                <td className={TD + ' font-mono text-[12px]'} data-cell="accountKey">
                  <Ltr>{a.accountKey}</Ltr>
                </td>
                <td className={TD + ' font-mono text-[12px]'} data-cell="deliverectAccountId">
                  <Ltr>{a.deliverectAccountId}</Ltr>
                </td>
                <td className={TD} data-cell="active">
                  {a.active ? t('yes') : t('no')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Loaded>
    </Section>
  )
}

function PlatformHeaders() {
  const { t } = useTranslation('deliverect-terms')
  return (
    <>
      {(['platform', 'platformKey', 'channelId', 'creditCustomer', 'active', 'actions'] as const).map((c) => (
        <th key={c} className={TH}>
          {t(`platforms.columns.${c}`)}
        </th>
      ))}
    </>
  )
}

function PlatformRow({ p, selected, onPick, onEdit }: { p: DeliverectPlatform; selected: boolean; onPick: () => void; onEdit: () => void }) {
  const { t } = useTranslation('deliverect-terms')
  return (
    <tr className={ROW + (selected ? ' bg-primary-050' : '')} data-platform-row={p.platformKey} aria-selected={selected}>
      <td className={TD} data-cell="displayName">
        <bdi>{p.displayName}</bdi>
      </td>
      <td className={TD + ' font-mono text-[12px]'} data-cell="platformKey">
        <Ltr>{p.platformKey}</Ltr>
      </td>
      <td className={TD + ' tabular-nums'} data-cell="channelId">
        <Ltr>{String(p.channelId)}</Ltr>
      </td>
      <td className={TD + ' font-mono text-[12px]'} data-cell="creditCustomer">
        {p.creditCustomer ? <Ltr>{p.creditCustomer}</Ltr> : <StatusBadge sev="warn">{t('platforms.noCreditCustomer')}</StatusBadge>}
      </td>
      <td className={TD} data-cell="active">
        <StatusBadge sev={p.active ? 'ok' : 'mute'}>{p.active ? t('platforms.active') : t('platforms.inactive')}</StatusBadge>
      </td>
      <td className={TD}>
        <span className="flex items-center gap-1">
          <Button variant="ghost" aria-pressed={selected} onClick={onPick} data-platform-terms={p.platformKey}>
            <ListOrdered className="h-3.5 w-3.5" aria-hidden />
            {t('platforms.terms')}
          </Button>
          <Button variant="ghost" onClick={onEdit} data-platform-edit={p.platformKey}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {t('platforms.edit')}
          </Button>
        </span>
      </td>
    </tr>
  )
}

function PickHint() {
  const { t } = useTranslation('deliverect-terms')
  return <p className="text-xs text-muted-foreground">{t('timeline.pick')}</p>
}

/** One platform's terms, by `validFrom`, the open row marked current. No row is editable. */
function Timeline({ platform }: { platform: DeliverectPlatform }) {
  const { t } = useTranslation('deliverect-terms')
  const terms = useQuery({
    queryKey: [...TERMS_KEY, platform.platformKey],
    queryFn: () => termsApi.list(platform.platformKey),
    retry: false,
  })
  const timeline = useMemo(() => termsTimeline(terms.data), [terms.data])
  const [adding, setAdding] = useState(false)

  return (
    <Section
      data="timeline"
      title={
        <span data-timeline-title="">
          <Trans t={t} i18nKey="timeline.titleFor" values={{ platform: platform.displayName }} components={{ platform: <bdi /> }} />
        </span>
      }
      hint={t('timeline.hint')}
      action={
        <Button onClick={() => setAdding(true)} disabled={!terms.isSuccess} data-terms-add="">
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          {t('timeline.add')}
        </Button>
      }
    >
      <Loaded query={terms} what="timeline" empty={timeline.length === 0}>
        <table className={TABLE} data-terms-table={platform.platformKey}>
          <thead className={HEAD}>
            <tr>
              <th className={TH}>{t('timeline.columns.validFrom')}</th>
              <th className={TH}>{t('timeline.columns.validTo')}</th>
              <th className={TH + ' text-end'}>{t('timeline.columns.customerDiscountPct')}</th>
              <th className={TH + ' text-end'}>{t('timeline.columns.commissionPct')}</th>
              <th className={TH + ' text-end'}>{t('timeline.columns.deliveryFee')}</th>
              <th className={TH + ' text-end'}>{t('timeline.columns.deliveryFeeThreshold')}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {timeline.map(({ row, current }) => (
              <tr key={row.termsId} className={ROW + (current ? ' bg-primary-050 font-medium' : '')} data-terms-row={row.termsId} data-current={current || undefined}>
                <td className={TD + ' tabular-nums'} data-cell="validFrom">
                  <Ltr>{row.validFrom}</Ltr>
                </td>
                <td className={TD + ' tabular-nums'} data-cell="validTo">
                  {row.validTo ? <Ltr>{row.validTo}</Ltr> : <span className="text-muted-foreground">{t('timeline.open')}</span>}
                </td>
                <td className={TD + ' text-end tabular-nums'} data-cell="customerDiscountPct">
                  <Ltr>{formatNumber(row.customerDiscountPct)}</Ltr>
                </td>
                <td className={TD + ' text-end tabular-nums'} data-cell="commissionPct">
                  <Ltr>{formatNumber(row.commissionPct)}</Ltr>
                </td>
                <td className={TD + ' text-end tabular-nums'} data-cell="deliveryFee">
                  <Ltr>{money(row.deliveryFee, row.currencyKey)}</Ltr>
                </td>
                <td className={TD + ' text-end tabular-nums'} data-cell="deliveryFeeThreshold">
                  <Ltr>{money(row.deliveryFeeThreshold, row.currencyKey)}</Ltr>
                </td>
                <td className={TD}>{current && <StatusBadge sev="go">{t('timeline.current')}</StatusBadge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Loaded>
      {adding && terms.isSuccess && <AddTermsDialog platform={platform} timeline={timeline} onClose={() => setAdding(false)} />}
    </Section>
  )
}
