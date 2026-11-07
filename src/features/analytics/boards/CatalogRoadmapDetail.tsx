import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import type { CatalogNode } from './catalog-tree'
import { PlannedStatusBadge } from './CatalogPlannedDetail'
import { Fact } from './CatalogDetailParts'

type RoadmapNode = Extract<CatalogNode, { kind: 'roadmap' | 'plannedGroup' | 'plannedStatus' | 'untappedGroup' }>

/**
 * The Planned / untapped section's own nodes (ticket 842): the section, the planned group, a status and the
 * untapped group each show what they hold — planned areas per status, untapped source tables — as counts.
 */
export default function CatalogRoadmapDetail({ node }: { node: RoadmapNode }) {
  const { t } = useTranslation('boards')
  const planned = node.kind === 'roadmap' ? node.children.find((c) => c.kind === 'plannedGroup') : node.kind === 'untappedGroup' ? undefined : node
  const untapped = node.kind === 'roadmap' ? node.children.find((c) => c.kind === 'untappedGroup') : node.kind === 'untappedGroup' ? node : undefined
  const statuses = planned?.kind === 'plannedStatus' ? [planned] : (planned?.children ?? [])
  const title = node.kind === 'plannedStatus' ? t(`catalog.planned.status.${node.status}`) : t(`catalog.planned.node.${node.kind}`)
  return (
    // Not `DetailShell`: the title is the page's own words (one language), not a bilingual label or a machine key.
    <article className="flex min-w-0 flex-col gap-4" data-catalog-detail="roadmap" data-catalog-roadmap={node.kind}>
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('catalog.planned.section')}</p>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
      <Fact label={t('catalog.planned.hintLabel')}>
        <span className="text-muted-foreground">{t(node.kind === 'untappedGroup' ? 'catalog.untapped.hint' : 'catalog.planned.hint')}</span>
      </Fact>
      {statuses.map(
        (s) =>
          s.kind === 'plannedStatus' && (
            <Fact key={s.id} label={t(`catalog.planned.status.${s.status}`)} data={`status-${s.status}`}>
              <span className="flex items-center gap-2">
                <PlannedStatusBadge status={s.status} />
                <Ltr>{s.children.length}</Ltr>
              </span>
            </Fact>
          ),
      )}
      {untapped && (
        <Fact label={t('catalog.planned.node.untappedGroup')} data="untapped-count">
          <Ltr>{untapped.children.length}</Ltr>
        </Fact>
      )}
      </dl>
    </article>
  )
}
