import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Boxes, Gift, Info, ShoppingCart, TriangleAlert } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import type { BbyDetailDto } from '@/core/models/bonus-buy-inquiry'
import { bonusBuyInquiryApi } from './api'
import GroupingMembersModal, { type GroupingTarget } from './GroupingMembersModal'
import { codeLabelKey, type CodeSet } from './codeLabels'
import { formatAmount, formatBbyDate, formatBbyTime } from './formatters'
import {
  toDetailView,
  type DetailBuyRow,
  type DetailGetRow,
  type DetailView,
  type DiscountKind,
} from './detail-view'

/** The unit that follows a discount figure — the `%` glyph for a percentage, the org
 *  currency for an amount, nothing for the defensive `plain` fallback. The one place
 *  the symbol is chosen, shared by the Get rows and the Document total-discount card
 *  (the `discountKind` decision itself is owned by the pure `toDetailView`). */
function discountUnit(kind: DiscountKind, currency: string): string {
  if (kind === 'percent') return '%'
  if (kind === 'amount') return ` ${currency}`
  return ''
}

// The per-row Details modal — the SAP "Display Bonus Buy" mirror (spec 061, ticket
// 066; approved prototype 060). Reuses core/ui/Modal.tsx (native <dialog>: focus
// trap, Escape, backdrop dismiss, focus restore — story 47) at a wider width. All
// branch logic lives in the pure `toDetailView`; this component is the renderer:
// title recap → Organisation panel → Header & rules panel → Buy side → "then" strip →
// Get side (per-condition table, or the Document total-discount card).
//
// States: loading skeleton; BBY_NOT_FOUND (404 business outcome) → a clear not-found
// card via apiErrorCode, never "unexpected". The grouping "N members" chip is shown
// but inert here — the paged drilldown is slice 067.

const STATUS_TONE: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  I: 'bg-muted text-muted-foreground',
  D: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  X: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

const VALIDITY_TONE: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ended: 'bg-muted text-muted-foreground',
  notStarted: 'bg-muted text-muted-foreground',
}

/** Today as `yyyyMMdd` (local) — the ordinal key the pure `toDetailView` compares the
 *  validity window against (glossary 054). Computed at the render tier so the pure map
 *  stays deterministic/testable. */
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** Resolve a raw code to its readable label via the shared pure `codeLabelKey` +
 *  `t(key, { defaultValue: raw })` — the same seam the grid uses (columns.tsx). */
function codeText(t: TFunction, set: CodeSet, raw: string): string {
  return raw === '' ? '' : t(`bonus-buy-inquiry:${codeLabelKey(set, raw)}`, { defaultValue: raw })
}

interface DetailModalProps {
  /** The BBY to display; `null` closes the modal. */
  bbyNumber: string | null
  onClose: () => void
}

export default function DetailModal({ bbyNumber, onClose }: DetailModalProps) {
  const { t } = useTranslation('bonus-buy-inquiry')
  const open = bbyNumber !== null

  // Which grouping (if any) has its paged members drilldown open (slice 067). Lives
  // here — alongside the detail query — so the chip click and the nested modal share
  // one source of truth. Reset whenever the target BBY changes (close, or a switch to
  // another row) so a stale grouping from the prior BBY can never reopen.
  const [drilldown, setDrilldown] = useState<GroupingTarget | null>(null)
  useEffect(() => {
    setDrilldown(null)
  }, [bbyNumber])

  const detail = useQuery({
    queryKey: ['bonus-buy-inquiry', 'detail', bbyNumber],
    queryFn: () => bonusBuyInquiryApi.detail(bbyNumber as string),
    enabled: open,
  })

  const view: DetailView | null = detail.data ? toDetailView(detail.data, todayYmd()) : null

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('detail.eyebrow')} width="60rem">
        {detail.isPending ? (
          <DetailSkeleton label={t('detail.loading')} />
        ) : detail.isError ? (
          <DetailError
            notFound={apiErrorCode(detail.error) === 'BBY_NOT_FOUND'}
            message={apiErrorMessage(detail.error, t('detail.loadFailed'))}
            notFoundTitle={t('detail.notFound.title')}
            notFoundHint={t('detail.notFound.hint')}
          />
        ) : view ? (
          <DetailBody t={t} view={view} onDrilldown={setDrilldown} />
        ) : null}
      </Modal>
      {bbyNumber && (
        <GroupingMembersModal
          bbyNumber={bbyNumber}
          target={drilldown}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  )
}

/** The resolved body: title recap + the four content sections. */
function DetailBody({
  t,
  view,
  onDrilldown,
}: {
  t: TFunction
  view: DetailView
  onDrilldown: (target: GroupingTarget) => void
}) {
  const { header, org } = view
  const currency = org.currency
  return (
    <div className="flex flex-col gap-5">
      <TitleRecap t={t} view={view} />

      {/* Organisation panel */}
      <Section
        icon={<Boxes className="h-3.5 w-3.5" aria-hidden />}
        title={t('detail.org.title')}
        sub={t('detail.org.sub')}
      >
        <DefGrid>
          <Def k={t('detail.org.salesOrg')} v={org.salesOrganization} mono />
          <Def k={t('detail.org.distChannel')} v={org.distributionChannel} mono />
          <Def k={t('detail.org.plant')} v={org.plant} mono />
          <Def k={t('detail.org.currency')} v={org.currency} />
        </DefGrid>
      </Section>

      {/* Header & rules panel */}
      <Section
        icon={<Info className="h-3.5 w-3.5" aria-hidden />}
        title={t('detail.rules.title')}
        sub={t('detail.rules.sub')}
      >
        <DefGrid>
          <Def k={t('detail.rules.promotion')} v={header.promoNumber} mono />
          <Def k={t('detail.rules.offer')} v={header.offerId} mono />
          <Def k={t('detail.rules.profile')} v={header.bbyProfile} />
          <Def k={t('detail.rules.status')}>
            <StatusBadge code={header.bbyStatus} label={codeText(t, 'status', header.bbyStatus)} />
          </Def>

          <Def
            span2
            k={t('detail.rules.validityWindow')}
            v={`${formatBbyDate(header.validFrom)} ${formatBbyTime(header.validFromTime)} → ${formatBbyDate(header.validTo)} ${formatBbyTime(header.validToTime)}`}
            mono
          />
          <Def
            k={t('detail.rules.condTarget')}
            v={codeText(t, 'condTarget', header.condTargetType)}
          />
          <Def
            k={t('detail.rules.limit')}
            v={header.limitNumber ? String(header.limitNumber) : t('detail.rules.unlimited')}
            mono={header.limitNumber > 0}
          />

          <Def k={t('detail.rules.link')}>
            <span className="inline-flex items-center gap-1">
              <Chip>{codeText(t, 'link', header.linkCategoryBuy)}</Chip>
              <span className="text-muted-foreground">/</span>
              <Chip>{codeText(t, 'link', header.linkCategoryGet)}</Chip>
            </span>
          </Def>
          <Def
            k={t('detail.rules.minMax')}
            v={
              header.minValue || header.maxValue
                ? `${header.minValue ? formatAmount(header.minValue) : t('detail.dash')} / ${header.maxValue ? formatAmount(header.maxValue) : t('detail.dash')} ${currency}`
                : ''
            }
            mono
          />
          <Def k={t('detail.rules.stackability')} v={stackabilityText(t, header)} />
          <Def k={t('detail.rules.score')} v={header.score != null ? String(header.score) : ''} mono />

          <Def k={t('detail.rules.loyGroups')} v={header.loyGroups} />
          <Def k={t('detail.rules.loyTiers')} v={header.loyTiers} />
          <Def k={t('detail.rules.includes')} v={header.includes ?? ''} />
          <Def k={t('detail.rules.excludes')} v={header.excludes ?? ''} />
        </DefGrid>
      </Section>

      {/* Buy side */}
      <BuySection t={t} view={view} onDrilldown={onDrilldown} />

      {/* "then" link strip */}
      <div className="flex items-center justify-center gap-3">
        <span className="h-px max-w-[7rem] flex-1 bg-border" />
        <span className="rounded-full bg-primary/10 px-3 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-primary">
          {t('detail.then')}
        </span>
        <span className="h-px max-w-[7rem] flex-1 bg-border" />
      </div>

      {/* Get side — per-condition rows or the Document total-discount card */}
      {view.mode === 'totalDiscount' ? (
        <TotalDiscountCard t={t} view={view} />
      ) : (
        <GetSection t={t} view={view} onDrilldown={onDrilldown} />
      )}
    </div>
  )
}

/** Number (large) + status badge + validity badge + description — the title recap
 *  (story 31). Sits inside the body because core Modal's own title bar is text-only. */
function TitleRecap({ t, view }: { t: TFunction; view: DetailView }) {
  const { header, validity } = view
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-lg font-bold tabular-nums tracking-tight">
          {header.bbyNumber}
        </span>
        <StatusBadge code={header.bbyStatus} label={codeText(t, 'status', header.bbyStatus)} />
        {validity && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${VALIDITY_TONE[validity]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {t(`detail.validity.${validity}`)}
          </span>
        )}
      </div>
      {header.description && (
        <p className="text-sm text-muted-foreground">{header.description}</p>
      )}
    </div>
  )
}

function BuySection({
  t,
  view,
  onDrilldown,
}: {
  t: TFunction
  view: DetailView
  onDrilldown: (target: GroupingTarget) => void
}) {
  const rows = view.buy
  return (
    <Section
      tone="buy"
      icon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden />}
      title={t('detail.buy.title')}
      sub={t('detail.buy.sub', { link: codeText(t, 'link', view.header.linkCategoryBuy) })}
    >
      {rows.length === 0 ? (
        <EmptyNote>{t('detail.buy.emptyNote')}</EmptyNote>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[3rem_1fr_8rem_6rem_6rem] gap-2.5 border-b border-border bg-muted/50 px-3.5 py-2 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{t('detail.buy.pos')}</span>
            <span>{t('detail.buy.material')}</span>
            <span>{t('detail.buy.kind')}</span>
            <span className="text-end">{t('detail.buy.qty')}</span>
            <span className="text-end">{t('detail.buy.minValue')}</span>
          </div>
          {rows.map((r, i) => (
            <BuyRow key={`${r.lineItemPos}-${i}`} t={t} row={r} onDrilldown={onDrilldown} />
          ))}
        </div>
      )}
    </Section>
  )
}

function BuyRow({
  t,
  row,
  onDrilldown,
}: {
  t: TFunction
  row: DetailBuyRow
  onDrilldown: (target: GroupingTarget) => void
}) {
  return (
    <div className="grid grid-cols-[3rem_1fr_8rem_6rem_6rem] items-center gap-2.5 border-b border-border px-3.5 py-2 text-[0.8125rem] last:border-b-0">
      <span className="font-mono tabular-nums">{row.lineItemPos}</span>
      <IdentityCell
        t={t}
        identifier={row.identifier}
        description={row.description}
        isGrouping={row.isGrouping}
        drilldownEnabled={row.drilldownEnabled}
        memberCount={row.memberCount}
        onDrilldown={
          row.drilldownEnabled
            ? () =>
                onDrilldown({
                  side: 'buy',
                  groupingKey: row.identifier,
                  label: row.identifier,
                  memberCount: row.memberCount,
                })
            : undefined
        }
      />
      <span className="text-xs font-medium text-muted-foreground">
        {row.isGrouping ? t('detail.kind.grouping') : t('detail.kind.material')}
      </span>
      <span className="text-end font-mono tabular-nums">
        {formatAmount(row.qty)} <span className="text-xs text-muted-foreground">{row.uom}</span>
      </span>
      <span className="text-end font-mono tabular-nums">
        {row.minValue ? formatAmount(row.minValue) : t('detail.dash')}
      </span>
    </div>
  )
}

function GetSection({
  t,
  view,
  onDrilldown,
}: {
  t: TFunction
  view: DetailView
  onDrilldown: (target: GroupingTarget) => void
}) {
  const rows = view.get
  return (
    <Section
      tone="get"
      icon={<Gift className="h-3.5 w-3.5" aria-hidden />}
      title={t('detail.get.title')}
      sub={t('detail.get.sub', { link: codeText(t, 'link', view.header.linkCategoryGet) })}
    >
      {rows.length === 0 ? (
        <EmptyNote>{t('detail.get.emptyNote')}</EmptyNote>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[4rem_1fr_8rem_9rem_7rem] gap-2.5 border-b border-border bg-muted/50 px-3.5 py-2 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{t('detail.get.cond')}</span>
            <span>{t('detail.get.material')}</span>
            <span>{t('detail.get.discount')}</span>
            <span>{t('detail.get.scalePricing')}</span>
            <span>{t('detail.get.condType')}</span>
          </div>
          {rows.map((r, i) => (
            <GetRow
              key={`${r.condNumber}-${i}`}
              t={t}
              row={r}
              currency={view.org.currency}
              onDrilldown={onDrilldown}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

function GetRow({
  t,
  row,
  currency,
  onDrilldown,
}: {
  t: TFunction
  row: DetailGetRow
  currency: string
  onDrilldown: (target: GroupingTarget) => void
}) {
  const unit = discountUnit(row.discountKind, currency)
  return (
    <div className="grid grid-cols-[4rem_1fr_8rem_9rem_7rem] items-center gap-2.5 border-b border-border px-3.5 py-2 text-[0.8125rem] last:border-b-0">
      <span className="font-mono tabular-nums">{row.condNumber}</span>
      <IdentityCell
        t={t}
        identifier={row.identifier}
        description={row.description}
        isGrouping={row.isGrouping}
        drilldownEnabled={row.drilldownEnabled}
        memberCount={row.memberCount}
        onDrilldown={
          row.drilldownEnabled
            ? () =>
                onDrilldown({
                  side: 'get',
                  groupingKey: row.condNumber,
                  label: row.identifier,
                  memberCount: row.memberCount,
                })
            : undefined
        }
      />
      <span className="flex flex-col">
        <span className="font-mono font-semibold tabular-nums">
          {formatAmount(row.discountAmount)}
          <span className="text-xs font-normal text-muted-foreground">{unit}</span>
        </span>
        <span className="text-[0.6875rem] text-muted-foreground">
          {codeText(t, 'discount', row.discountType)}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">
        {codeText(t, 'scale', row.scaleType)} {formatAmount(row.qty)} {row.uom}
        <br />
        {t('detail.get.perUnit', { qty: formatAmount(row.pricingUnit), uom: row.pricingUnitUom })}
      </span>
      <span className="justify-self-start rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">
        {codeText(t, 'condType', row.conditionType)}
      </span>
    </div>
  )
}

function TotalDiscountCard({ t, view }: { t: TFunction; view: DetailView }) {
  const td = view.totalDiscount
  const currency = view.org.currency
  if (!td) return null
  return (
    <Section
      tone="get"
      icon={<Gift className="h-3.5 w-3.5" aria-hidden />}
      title={t('detail.totalDiscount.title')}
      sub={t('detail.totalDiscount.sub')}
    >
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
        <div className="font-mono text-4xl font-bold leading-none tracking-tight tabular-nums text-primary">
          {formatAmount(td.discountAmount)}
          <span className="ms-1 text-xl font-semibold">{discountUnit(td.discountKind, currency)}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('detail.totalDiscount.appliedTo')}
          </span>
          <TdRow lab={t('detail.totalDiscount.discountType')} val={codeText(t, 'discount', td.discountType)} />
          <TdRow lab={t('detail.totalDiscount.condType')} val={codeText(t, 'condType', td.conditionType)} />
          <TdRow
            lab={t('detail.totalDiscount.requirement')}
            val={t('detail.totalDiscount.requirementValue', {
              value: formatAmount(td.requirement),
              currency,
            })}
          />
        </div>
      </div>
    </Section>
  )
}

function TdRow({ lab, val }: { lab: string; val: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-[7.5rem] text-xs text-muted-foreground">{lab}</span>
      <span className="text-[0.8125rem] font-semibold">{val}</span>
    </div>
  )
}

/** Material/grouping identity cell — a plain material shows number + description; a
 *  grouping shows the key + an inline "N members" chip that, when `onDrilldown` is
 *  supplied (a drilldown-enabled grouping), is a button opening the paged members
 *  drilldown (slice 067). */
function IdentityCell({
  t,
  identifier,
  description,
  isGrouping,
  drilldownEnabled,
  memberCount,
  onDrilldown,
}: {
  t: TFunction
  identifier: string
  description: string | null
  isGrouping: boolean
  drilldownEnabled: boolean
  memberCount: number
  onDrilldown?: () => void
}) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-mono font-semibold tabular-nums">{identifier}</span>
      {drilldownEnabled ? (
        <button
          type="button"
          onClick={onDrilldown}
          className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={t('detail.membersOpen', { count: memberCount })}
        >
          <Boxes className="h-3 w-3" aria-hidden />
          {t('detail.members', { count: memberCount })}
        </button>
      ) : (
        !isGrouping &&
        description && (
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        )
      )}
    </span>
  )
}

function stackabilityText(t: TFunction, header: BbyDetailDto['header']): string {
  if (!header.isStackable) return t('detail.rules.notStackable')
  return header.allowNestedStacking
    ? `${t('detail.rules.stackable')} · ${t('detail.rules.nestedAllowed')}`
    : t('detail.rules.stackable')
}

// --- small presentational primitives ---

function Section({
  icon,
  title,
  sub,
  tone = 'neutral',
  children,
}: {
  icon: ReactNode
  title: string
  sub: string
  tone?: 'neutral' | 'buy' | 'get'
  children: ReactNode
}) {
  const iconTone =
    tone === 'buy'
      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
      : tone === 'get'
        ? 'bg-primary/10 text-primary'
        : 'bg-muted text-muted-foreground'
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${iconTone}`}>
          {icon}
        </span>
        <h3 className="text-[0.8125rem] font-semibold tracking-tight">{title}</h3>
        <span className="text-xs text-muted-foreground">{sub}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  )
}

function DefGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
      {children}
    </div>
  )
}

function Def({
  k,
  v,
  children,
  span2,
  mono,
}: {
  k: string
  v?: string
  children?: ReactNode
  span2?: boolean
  mono?: boolean
}) {
  const { t } = useTranslation('bonus-buy-inquiry')
  const empty = children == null && !v
  return (
    <div className={`min-w-0 bg-card px-3 py-2 ${span2 ? 'col-span-2' : ''}`}>
      <div className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {k}
      </div>
      <div
        className={`mt-0.5 break-words text-[0.8125rem] font-medium ${mono ? 'font-mono tabular-nums' : ''} ${empty ? 'text-muted-foreground' : ''}`}
      >
        {children ?? (empty ? t('detail.dash') : v)}
      </div>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
      {children}
    </span>
  )
}

function StatusBadge({ code, label }: { code: string; label: string }) {
  if (!code) return null
  const tone = STATUS_TONE[code] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="px-1 py-2.5 text-[0.8125rem] italic text-muted-foreground">{children}</p>
}

function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label={label}>
      <div className="h-12 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

function DetailError({
  notFound,
  message,
  notFoundTitle,
  notFoundHint,
}: {
  notFound: boolean
  message: string
  notFoundTitle: string
  notFoundHint: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
        <TriangleAlert className="h-6 w-6" aria-hidden />
      </span>
      <div className="text-[0.9375rem] font-semibold tracking-tight">
        {notFound ? notFoundTitle : message}
      </div>
      {notFound && <p className="max-w-sm text-sm text-muted-foreground">{notFoundHint}</p>}
    </div>
  )
}
