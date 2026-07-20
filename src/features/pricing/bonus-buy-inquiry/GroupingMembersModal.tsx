import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Boxes, TriangleAlert } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import type { BbyGroupMember, BbySide } from '@/core/models/bonus-buy-inquiry'
import { bonusBuyInquiryApi } from './api'
import { formatAmount } from './formatters'

// The material-grouping members drilldown (spec 061, ticket 067) — a SECOND
// core/ui/Modal.tsx opened ON TOP of the Details modal when a grouping's "N members"
// chip is clicked. Native <dialog> uses the top layer, so the nested dialog stacks
// and traps focus correctly over the first with no z-index war (story 47).
//
// It calls GET Bby/GroupingMembers ONE PAGE AT A TIME — Buy groupings keyed by
// `matGrouping`, Get by `condNumber` (the `side` selects) — so a grouping standing
// for ~1,000 SKUs never fetches more than the page on screen. Prev/Next paging;
// `placeholderData: keepPreviousData` keeps the prior page visible while the next
// loads (no flash); the footer shows the range + total; a per-page loading + error
// state. Endpoint is runtime-blocked (mocked in the drive), like the rest of Bby/*.

const PAGE_SIZE = 20

/** The grouping the drilldown is opened for; `null` closes it. Carried up in
 *  DetailModal so the chip click and the modal render share one source of truth. */
export interface GroupingTarget {
  side: BbySide
  /** Buy `matGrouping` / Get `condNumber` — the server's member key. */
  groupingKey: string
  /** The grouping's own identifier, shown in the drilldown recap. */
  label: string
  /** The chip's count — the pager's total until the first page answers. */
  memberCount: number
}

interface GroupingMembersModalProps {
  bbyNumber: string
  /** The grouping to drill into; `null` closes the modal. */
  target: GroupingTarget | null
  onClose: () => void
}

export default function GroupingMembersModal({
  bbyNumber,
  target,
  onClose,
}: GroupingMembersModalProps) {
  const { t } = useTranslation('bonus-buy-inquiry')
  const open = target !== null
  const [page, setPage] = useState(1)

  // A new grouping (or reopen) starts at page 1 — reset whenever the target changes.
  useEffect(() => {
    setPage(1)
  }, [target?.side, target?.groupingKey])

  const members = useQuery({
    queryKey: ['bonus-buy-inquiry', 'members', bbyNumber, target?.side, target?.groupingKey, page],
    queryFn: () =>
      bonusBuyInquiryApi.groupingMembers({
        bbyNumber,
        side: (target as GroupingTarget).side,
        groupingKey: (target as GroupingTarget).groupingKey,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  // Total comes from the answered page; fall back to the chip count until it lands.
  const total = members.data?.total ?? target?.memberCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = members.data?.members ?? []
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('members.title')}
      width="42rem"
      footer={
        <Pager
          t={t}
          page={page}
          pageCount={pageCount}
          first={first}
          last={last}
          total={total}
          loading={members.isFetching}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        />
      }
    >
      {target && <Recap t={t} target={target} />}
      {members.isError ? (
        <MembersError message={apiErrorMessage(members.error, t('members.loadFailed'))} />
      ) : members.isPending ? (
        <MembersSkeleton label={t('members.loading')} />
      ) : (
        <MembersTable t={t} rows={rows} loading={members.isFetching} emptyLabel={t('members.empty')} />
      )}
    </Modal>
  )
}

/** Grouping recap strip — the key + side + total, so the nested modal is self-titling
 *  above its native (text-only) title bar. */
function Recap({ t, target }: { t: TFunction; target: GroupingTarget }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Boxes className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="font-mono text-sm font-bold tabular-nums tracking-tight">{target.label}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
        {t(`members.side.${target.side}`)}
      </span>
    </div>
  )
}

function MembersTable({
  t,
  rows,
  loading,
  emptyLabel,
}: {
  t: TFunction
  rows: BbyGroupMember[]
  loading: boolean
  emptyLabel: string
}) {
  if (rows.length === 0) return <EmptyNote>{emptyLabel}</EmptyNote>
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border transition-opacity ${loading ? 'opacity-60' : ''}`}
    >
      <div className="grid grid-cols-[9rem_1fr_6rem] gap-2.5 border-b border-border bg-muted/50 px-3.5 py-2 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{t('members.material')}</span>
        <span>{t('members.description')}</span>
        <span className="text-end">{t('members.qty')}</span>
      </div>
      {rows.map((m, i) => (
        <div
          key={`${m.materialNumber}-${i}`}
          className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2.5 border-b border-border px-3.5 py-2 text-[0.8125rem] last:border-b-0"
        >
          <span className="font-mono font-semibold tabular-nums">{m.materialNumber}</span>
          <span className="min-w-0 truncate text-muted-foreground">{m.description}</span>
          <span className="text-end font-mono tabular-nums">
            {formatAmount(m.qty)} <span className="text-xs text-muted-foreground">{m.uom}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function Pager({
  t,
  page,
  pageCount,
  first,
  last,
  total,
  loading,
  onPrev,
  onNext,
}: {
  t: TFunction
  page: number
  pageCount: number
  first: number
  last: number
  total: number
  loading: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-between">
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {loading ? t('members.loadingShort') : t('members.range', { first, last, total })}
      </span>
      <span className="flex items-center gap-2">
        <Button variant="outlined" onClick={onPrev} disabled={page <= 1}>
          {t('members.prev')}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('members.pageOf', { page, pageCount })}
        </span>
        <Button variant="outlined" onClick={onNext} disabled={page >= pageCount}>
          {t('members.next')}
        </Button>
      </span>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2.5 text-[0.8125rem] italic text-muted-foreground">{children}</p>
}

function MembersSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      <div className="h-8 animate-pulse rounded-md bg-muted" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

function MembersError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center" role="alert">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
        <TriangleAlert className="h-5 w-5" aria-hidden />
      </span>
      <div className="text-sm font-semibold tracking-tight">{message}</div>
    </div>
  )
}
