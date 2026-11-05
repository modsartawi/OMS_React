import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { TFunction } from 'i18next'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { deliveriesDrill } from './detail-drill'
import { crumbsOf, drillTargets, type MarkPoint } from './drill'
import { newViewLink } from './editor'
import type { DrillStep } from './effective-query'
import { labelIn } from './view-model'

/**
 * A board panel's drill row (spec 766 §F, ticket 772), under its header:
 *
 * - **The breadcrumb**, once the panel is drilled: the view's own breakdown, then each step ("P001 by City").
 *   An earlier crumb goes back to it; the last is where the panel is.
 * - **The drill menu**: one action per entry of `drillActions`. While the panel holds the board's
 *   cross-filter point, drill by re-asks THIS panel in place, from the point into another allowed dimension.
 *   Once drilled, "Save as view" opens 775's editor seeded with the drilled definition; nothing is saved before.
 *
 * The menu is a list so later tickets add to it. 774's drill to detail: a store point offers "See deliveries",
 * which routes to the Deliveries list filtered to that store and the panel's period (`detail-drill.ts`).
 */

export interface DrillAction {
  key: string
  label: string
  /** Absent with `disabledReason` set: shown, focusable, and saying why it cannot run yet. */
  run?: () => void
  disabledReason?: string
  /** `data-drill-into` for a drill by action (the drive's handle). */
  into?: string
}

const dimLabel = (key: string, model: AnalyticsModel, lang: string) => labelIn(model.dimensions.find((d) => d.key === key)?.label, lang) || key

/** A member's label: the model's inline label where it has one (channel, country), else its key. */
export const memberLabel = (point: MarkPoint, model: AnalyticsModel, lang: string) => {
  const dim = model.dimensions.find((d) => d.key === point.dimension)
  return labelIn(dim?.values?.find((v) => v.key === point.member)?.label, lang) || point.member
}

/** The drill menu's actions on a panel drilled by `steps`: drill by from `point` (if any), and save the drill. */
export function drillActions({
  drilled,
  steps,
  point,
  model,
  lang,
  onDrill,
  onSaveAsView,
  onDetail,
  t,
}: {
  drilled: AnalyticsViewDefinition
  steps: readonly DrillStep[]
  point: MarkPoint | null
  model: AnalyticsModel
  lang: string
  onDrill: (steps: DrillStep[]) => void
  /** Opens the view editor seeded with `drilled` (775): the only way a drill is kept. */
  onSaveAsView: (drilled: AnalyticsViewDefinition) => void
  /** The detail screen's route for `point` (774), or `null` when this point offers no drill to detail. */
  onDetail?: { href: string | null; open: (href: string) => void }
  t: TFunction<'boards'>
}): DrillAction[] {
  const by: DrillAction[] = point
    ? drillTargets(drilled, model, steps).map((into) => ({
        key: `by:${into}`,
        into,
        label: dimLabel(into, model, lang),
        run: () => onDrill([...steps, { dimension: point.dimension, member: point.member, into }]),
      }))
    : []
  // 774: drill to detail, by route. 783 adds Dispatch for a callout beside it.
  const href = point ? onDetail?.href : null
  const detail: DrillAction[] = href && onDetail ? [{ key: 'detail:deliveries', label: t('board.drill.seeDeliveries'), run: () => onDetail.open(href) }] : []
  const save: DrillAction[] = steps.length > 0 ? [{ key: 'saveAsView', label: t('board.drill.saveAsView'), run: () => onSaveAsView(drilled) }] : []
  return [...by, ...detail, ...save]
}

export default function PanelDrill({
  view,
  drilled,
  steps,
  point,
  model,
  lang,
  period,
  onDrill,
}: {
  /** The panel's saved view, and the same view drilled by `steps`. */
  view: AnalyticsViewDefinition
  drilled: AnalyticsViewDefinition
  steps: readonly DrillStep[]
  /** The board's cross-filter point when it was clicked on THIS panel, on the breakdown it shows. */
  point: MarkPoint | null
  model: AnalyticsModel
  lang: string
  /** The period the panel is asked over (its effective query's), for drill to detail (774). */
  period?: string | null
  onDrill: (steps: DrillStep[]) => void
}) {
  const { t } = useTranslation('boards')
  const navigate = useNavigate()
  if (steps.length === 0 && !point) return null
  const crumbs = crumbsOf(view, steps)
  const onSaveAsView = (definition: AnalyticsViewDefinition) => {
    const link = newViewLink({ definition })
    navigate(link.to, { state: link.state })
  }
  const onDetail = { href: point ? deliveriesDrill(point, drilled, model, period, new Date()) : null, open: (to: string) => navigate(to) }
  const actions = drillActions({ drilled, steps, point, model, lang, onDrill, onSaveAsView, onDetail, t })

  return (
    <div className="flex flex-col gap-1.5 text-xs" data-board-drill>
      {steps.length > 0 && (
        <nav aria-label={t('board.drill.breadcrumb')} data-board-drill-crumbs>
          <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1
              const text = c.member ? (
                <Trans
                  t={t}
                  i18nKey="board.drill.crumb"
                  values={{ member: memberLabel(c.member, model, lang), dimension: dimLabel(c.dimension, model, lang) }}
                  components={{ member: <bdi />, dimension: <bdi /> }}
                />
              ) : (
                <bdi>{dimLabel(c.dimension, model, lang)}</bdi>
              )
              return (
                <li key={c.depth} className="flex items-center gap-1" data-crumb={c.depth}>
                  {i > 0 && <span aria-hidden>›</span>}
                  {last ? (
                    <span className="font-medium text-foreground" aria-current="location">
                      {text}
                    </span>
                  ) : (
                    <Button variant="link" onClick={() => onDrill(steps.slice(0, c.depth))}>
                      {text}
                    </Button>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}
      {actions.length > 0 && (
        <div
          role="group"
          className="flex flex-wrap items-center gap-1.5"
          aria-label={point ? t('board.drill.menu', { member: fsi(memberLabel(point, model, lang)) }) : t('board.drill.breadcrumb')}
          data-board-drill-menu
        >
          {point && (
            <span className="text-muted-foreground">
              <Trans t={t} i18nKey="board.drill.by" values={{ member: memberLabel(point, model, lang) }} components={{ member: <bdi /> }} />
            </span>
          )}
          {actions.map((a) =>
            a.run ? (
              <Button key={a.key} variant="outlined" onClick={a.run} data-drill-action={a.key} data-drill-into={a.into}>
                <bdi>{a.label}</bdi>
              </Button>
            ) : (
              <Button key={a.key} variant="outlined" aria-disabled title={a.disabledReason} data-drill-action={a.key}>
                {a.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
