import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, FolderPlus, Trash2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type {
  RuleCampaignListRow,
  RuleEvaluationTree,
  RuleFeature,
  RuleOrderCampaign,
  RuleOrderGroupMode,
  RuleOrderGroupScope,
  RuleTreeGroup,
  Says,
} from '@/core/models/rule-campaign'
import { ruleCampaignsQuery, ruleOrderQuery, ruleReadingCatalogueQuery } from '@/core/rules/api'
import { featuresUsedBy } from '@/core/rules/campaign-list'
import { saysIn } from '@/core/rules/sentence'
import { campaignPath, campaignState } from '@/core/rules/campaign-state'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import LeaveGuard from '@/core/ui/LeaveGuard'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import CarrierDialog from './CarrierDialog'
import {
  addGroup,
  blankGroups,
  freshGroupName,
  moveCampaign,
  moveCampaignTo,
  moveGroup,
  newGroupId,
  removeGroup,
  sameOrder,
  setGroup,
  tidyOrder,
  type GroupPatch,
  type OrderPlace,
} from './order'

const MODES: RuleOrderGroupMode[] = ['stackable', 'first', 'highest']
const SCOPES: RuleOrderGroupScope[] = ['session', 'item']

/**
 * Campaigns ▸ Priority (tickets 513, 524; BackOffice 2759, ADR 0090): the LIVE evaluation order
 * (`Rules/Authoring/Order`) — the stackable base list, top to bottom, with flat groups placed in it,
 * each with its name (EN + AR), mode and scope. Campaigns move up / down within their list and to
 * another place with **Move to**; a group moves as one place in the base; **Add group** adds an
 * empty one. Every edit is local until **Save**. HQ has no order save — an order-only change rides a
 * campaign draft — so Save asks which draft being edited carries the tree (`CarrierDialog`) and sends
 * that draft's Drafts/Save with it: the order goes live when that draft is activated. Saved, the page
 * keeps showing the order that draft carries (edits build on it) until the reader asks for the live
 * order again.
 *
 * No access probe yet (BO ask B): the door fails closed on the server.
 */
export default function PriorityPage() {
  const { t } = useTranslation('campaign-priority')
  const order = useQuery(ruleOrderQuery())
  const campaigns = useQuery(ruleCampaignsQuery())
  const catalogue = useQuery(ruleReadingCatalogueQuery())
  /** The reader's unsaved order; null while they have changed nothing. */
  const [draft, setDraft] = useState<RuleEvaluationTree | null>(null)
  /** The order the last save left on a draft, and that draft: what the page shows and builds on until
   *  the reader asks for the live order again. */
  const [carried, setCarried] = useState<{ campaign: string; tree: RuleEvaluationTree } | null>(null)
  const [choosing, setChoosing] = useState(false)

  // HQ's order is drawn tidy (each campaign in one place, each group placed once), and a save sends
  // what is drawn.
  const hqOrder = useMemo(() => (order.data ? tidyOrder(order.data.tree) : undefined), [order.data])
  const base = carried?.tree ?? hqOrder
  const current = draft ?? base
  const dirty = !!draft && !!base && !sameOrder(draft, base)
  const blank = current ? blankGroups(current) : []

  // Nothing moves while the carrier is chosen: the save sends the order as it is then.
  const edit = (change: (o: RuleEvaluationTree) => RuleEvaluationTree) => {
    if (!current || choosing) return
    setDraft(change(current))
  }

  const listed = useMemo(() => new Map((campaigns.data ?? []).map((c) => [c.campaign, c])), [campaigns.data])
  const live = useMemo(() => new Map((order.data?.campaigns ?? []).map((c) => [c.code, c])), [order.data])
  /** A row's features: its draft's, else what its live blocks use (read through the catalogue). */
  const featuresOf = (row: RuleCampaignListRow | undefined): RuleFeature[] =>
    row?.features ?? (row?.live && catalogue.data ? featuresUsedBy(row.live, catalogue.data) : [])
  const now = new Date()

  const places = (current?.groups ?? []).map((g) => ({ id: g.id, name: g.name }))
  const row = (id: string, pos: number, count: number, place: OrderPlace) => (
    <CampaignRow
      key={id}
      id={id}
      live={live.get(id)}
      campaign={listed.get(id)}
      features={featuresOf(listed.get(id))}
      listRead={!!campaigns.data}
      pos={pos}
      count={count}
      place={place}
      places={places}
      now={now}
      onMove={(delta) => edit((o) => moveCampaign(o, id, delta))}
      onMoveTo={(target) => edit((o) => moveCampaignTo(o, id, target))}
    />
  )

  return (
    <section className="flex w-full max-w-5xl flex-col gap-4" data-priority="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={!current || choosing}
            onClick={() => edit((o) => addGroup(o, newGroupId(o), { en: freshGroupName(o, (n) => t('group.newName', { n })), ar: '' }))}
            data-add-group=""
          >
            <FolderPlus className="size-3.5" aria-hidden />
            {t('actions.addGroup')}
          </Button>
          <Button variant="text" disabled={!dirty || choosing} onClick={() => setDraft(null)} data-discard-order="">
            {t('actions.discard')}
          </Button>
          <Button variant="primary" disabled={!dirty || blank.length > 0 || choosing} onClick={() => draft && setChoosing(true)} data-save-order="">
            {t('actions.save')}
          </Button>
        </div>
      </header>

      <ul className="grid gap-1.5 rounded-md border border-border bg-card-2 px-3 py-2.5 text-xs text-muted-foreground sm:grid-cols-2" aria-label={t('legend.label')}>
        {MODES.map((m) => (
          <li key={m}>
            <span className="font-semibold text-foreground">{t(`modes.${m}`)}</span> {t(`legend.${m}`)}
          </li>
        ))}
        <li>
          <span className="font-semibold text-foreground">{t('scopes.item')}</span> {t('legend.item')}
        </li>
      </ul>
      <p className="text-sm" data-cascade="">
        {t('cascade')}
      </p>

      {order.isError && (
        <ErrorBanner className="p-2.5" title={t('load.failedTitle')} message={isBareDenial(order.error) ? t('load.denied') : apiErrorMessage(order.error, t('load.failed'))} />
      )}
      {order.data && (
        <p className="text-xs text-muted-foreground" data-order-version={order.data.versionNo}>
          {t('liveVersion', { version: fsi(order.data.versionNo) })}
        </p>
      )}
      {campaigns.isError && (
        <ErrorBanner className="p-2.5" title={t('campaigns.failedTitle')} message={isBareDenial(campaigns.error) ? t('campaigns.denied') : apiErrorMessage(campaigns.error, t('campaigns.failed'))} />
      )}
      {dirty && blank.length > 0 && (
        <p className="text-sm text-danger-800" role="alert" data-blank-group="">
          {t('save.blankName')}
        </p>
      )}
      {carried && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted px-3 py-2 text-sm" role="status" data-order-saved={carried.campaign}>
          <span data-order-saved-text="">{t('save.done', { campaign: fsi(carried.campaign) })}</span>
          <Button
            variant="text"
            disabled={choosing}
            onClick={() => {
              setCarried(null)
              setDraft(null)
            }}
            data-show-live=""
          >
            {t('save.showLive')}
          </Button>
        </div>
      )}
      {dirty && (
        <p className="text-xs font-medium text-muted-foreground" data-order-dirty="">
          {t('unsaved')}
        </p>
      )}

      {order.isPending && <p className="text-sm text-muted-foreground">{t('load.loading')}</p>}
      {current && (
        <div className="flex flex-col gap-1.5 border-s-2 border-border ps-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('base.title')}</p>
          {current.order.length === 0 && <p className="text-sm text-muted-foreground">{t('base.empty')}</p>}
          <ol className="flex flex-col gap-1.5" aria-label={t('base.label')} data-order-base="">
            {current.order.map((node, i) => {
              if ('campaign' in node) return row(node.campaign, i + 1, current.order.length, 'base')
              const group = current.groups.find((g) => g.id === node.group)
              if (!group) return null
              return (
                <GroupBlock
                  key={group.id}
                  group={group}
                  pos={i + 1}
                  count={current.order.length}
                  blank={blank.includes(group.id)}
                  onMove={(delta) => edit((o) => moveGroup(o, group.id, delta))}
                  onSet={(patch) => edit((o) => setGroup(o, group.id, patch))}
                  onRemove={() => edit((o) => removeGroup(o, group.id))}
                >
                  {group.campaigns.map((id, j) => row(id, j + 1, group.campaigns.length, group.id))}
                </GroupBlock>
              )
            })}
          </ol>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('publishes')}</p>

      {choosing && current && (
        <CarrierDialog
          tree={current}
          preferred={carried?.campaign ?? null}
          onClose={() => setChoosing(false)}
          onSaved={(campaign, tree) => {
            setChoosing(false)
            setDraft(null)
            setCarried({ campaign, tree })
          }}
        />
      )}

      <LeaveGuard dirty={dirty} words={{ title: t('leave.title'), body: t('leave.body'), stay: t('leave.stay'), go: t('leave.go') }} />
    </section>
  )
}

/** A group's name in the reader's language for a string-only sink (an option, a label), isolated
 *  whole; a blank one says so. */
function groupLabel(name: Says, t: TFunction<'campaign-priority'>, lang: string): string {
  const shown = saysIn({ en: name.en.trim(), ar: name.ar.trim() }, lang)
  return shown ? fsi(shown) : t('group.unnamed')
}

/** Up / down for a campaign or a group: disabled at the ends of its list. */
function UpDown({ pos, count, label, onMove }: { pos: number; count: number; label: string; onMove: (delta: -1 | 1) => void }) {
  const { t } = useTranslation('campaign-priority')
  return (
    <span className="flex items-center gap-0.5">
      <Button variant="ghost" className="px-1.5" disabled={pos === 1} onClick={() => onMove(-1)} aria-label={t('move.up', { what: label })} data-move-up="">
        <ArrowUp className="size-3.5" aria-hidden />
      </Button>
      <Button variant="ghost" className="px-1.5" disabled={pos === count} onClick={() => onMove(1)} aria-label={t('move.down', { what: label })} data-move-down="">
        <ArrowDown className="size-3.5" aria-hidden />
      </Button>
    </span>
  )
}

const SELECT =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none'

function CampaignRow({
  id,
  live,
  campaign,
  features,
  listRead,
  pos,
  count,
  place,
  places,
  now,
  onMove,
  onMoveTo,
}: {
  id: string
  /** The campaign in the live order (its names), when it is live. */
  live: RuleOrderCampaign | undefined
  /** Its row in the campaigns list (its state). */
  campaign: RuleCampaignListRow | undefined
  features: RuleFeature[]
  /** The campaigns list has been read: a campaign missing from it is named as such. */
  listRead: boolean
  pos: number
  count: number
  place: OrderPlace
  places: { id: string; name: Says }[]
  now: Date
  onMove: (delta: -1 | 1) => void
  onMoveTo: (target: OrderPlace) => void
}) {
  const { t, i18n } = useTranslation('campaign-priority')
  const code = campaign?.campaign ?? id
  const name = campaign?.name ?? live?.name
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card px-3 py-2" data-order-row={id}>
      <span className="w-6 text-xs text-muted-foreground tabular-nums">
        <Ltr>{pos}</Ltr>
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-baseline gap-2 text-sm">
          <Link to={campaignPath(id)} className="font-mono text-xs font-semibold text-primary hover:underline">
            <Ltr>{code}</Ltr>
          </Link>
          {name ? <bdi>{name.en}</bdi> : listRead && <span className="text-muted-foreground">{t('row.unknown')}</span>}
        </span>
        {name?.ar && (
          <span className="text-xs text-muted-foreground" data-order-name-ar="">
            <bdi>{name.ar}</bdi>
          </span>
        )}
      </div>
      {campaign && <CampaignStateBadge state={campaignState(campaign, now)} />}
      {/* The legend's "highest discount … points do not count" needs to say which rows earn points (2734 CRow). */}
      {features.includes('points') && (
        <span className="rounded-full bg-primary-050 px-2 py-0.5 text-xs font-medium text-primary-800" data-order-points="">
          {t('row.points')}
        </span>
      )}
      <UpDown pos={pos} count={count} label={fsi(code)} onMove={onMove} />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t('row.moveTo')}
        <select className={SELECT} value={place} onChange={(e) => onMoveTo(e.target.value)} data-move-to="">
          <option value="base">{t('row.base')}</option>
          {places.map((g) => (
            <option key={g.id} value={g.id}>
              {groupLabel(g.name, t, i18n.language)}
            </option>
          ))}
        </select>
      </label>
    </li>
  )
}

function GroupBlock({
  group,
  pos,
  count,
  blank,
  onMove,
  onSet,
  onRemove,
  children,
}: {
  group: RuleTreeGroup
  pos: number
  count: number
  blank: boolean
  onMove: (delta: -1 | 1) => void
  onSet: (patch: GroupPatch) => void
  onRemove: () => void
  children: ReactNode
}) {
  const { t, i18n } = useTranslation('campaign-priority')
  const label = groupLabel(group.name, t, i18n.language)
  const held = group.campaigns.length > 0
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border bg-card-2 p-2" data-order-group={group.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-6 text-xs text-muted-foreground tabular-nums">
          <Ltr>{pos}</Ltr>
        </span>
        <input
          value={group.name.en}
          onChange={(e) => onSet({ name: { ...group.name, en: e.target.value } })}
          dir="ltr"
          aria-label={t('group.name')}
          aria-invalid={blank || undefined}
          className={`h-7 w-48 rounded-md border bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none ${blank ? 'border-danger-border' : 'border-border/60'}`}
          data-group-name=""
        />
        <input
          value={group.name.ar}
          onChange={(e) => onSet({ name: { ...group.name, ar: e.target.value } })}
          dir="rtl"
          aria-label={t('group.nameAr')}
          className="h-7 w-48 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          data-group-name-ar=""
        />
        <select className={SELECT} value={group.mode} onChange={(e) => onSet({ mode: e.target.value as RuleOrderGroupMode })} aria-label={t('group.mode')} data-group-mode="">
          {MODES.map((m) => (
            <option key={m} value={m}>
              {t(`modes.${m}`)}
            </option>
          ))}
        </select>
        <select className={SELECT} value={group.scope} onChange={(e) => onSet({ scope: e.target.value as RuleOrderGroupScope })} aria-label={t('group.scope')} data-group-scope="">
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {t(`scopes.${s}`)}
            </option>
          ))}
        </select>
        <span className="grow" />
        <UpDown pos={pos} count={count} label={label} onMove={onMove} />
        <Button
          variant="ghost"
          className="px-1.5"
          aria-disabled={held || undefined}
          onClick={() => !held && onRemove()}
          aria-label={t('group.delete', { what: label })}
          title={held ? t('group.deleteHeld') : t('group.delete', { what: label })}
          data-delete-group=""
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
      {group.campaigns.length === 0 ? (
        <p className="ps-8 text-xs text-muted-foreground" data-group-empty="">
          {t('group.empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5 ps-8">{children}</ol>
      )}
    </li>
  )
}
