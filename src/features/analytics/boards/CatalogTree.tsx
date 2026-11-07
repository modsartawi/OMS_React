import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Database, Folder, Info, Layers, Lightbulb, Map as MapIcon, Sigma, Table2, Tag, TableProperties } from 'lucide-react'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { CatalogNode } from './catalog-tree'

/**
 * The Catalog's tree on the start side (ticket 841): one `treeitem` per node, a chevron to open it and its name to
 * pick it — both shared controls (`IconButton`, `Button variant="text"`), never raw buttons. Labels are free text in
 * the page's language (`<bdi>`), keys machine values (`Ltr`). Indentation and the chevron are logical, so the tree
 * mirrors under Arabic.
 */

/** Indentation per level (logical: `ps-*`), listed whole so Tailwind sees each class. */
const INDENT = ['ps-0', 'ps-5', 'ps-10', 'ps-14', 'ps-20'] as const

export interface CatalogTreeProps {
  nodes: CatalogNode[]
  /** Nodes drawn open. */
  isOpen: (id: string) => boolean
  /** While a search stands, the nodes drawn (others hidden); `null` = all. */
  shown: Set<string> | null
  /** Search matches, emphasised. */
  matches: Set<string>
  selected: string | null
  onToggle: (id: string) => void
  onSelect: (node: CatalogNode) => void
  lang: string
}

export default function CatalogTree(props: CatalogTreeProps) {
  const { t } = useTranslation('boards')
  return (
    <ul role="tree" aria-label={t('catalog.treeLabel')} className="flex flex-col gap-0.5 text-sm" data-catalog-tree>
      <Level {...props} nodes={props.nodes} level={0} />
    </ul>
  )
}

function Level(props: CatalogTreeProps & { level: number }) {
  const { nodes, shown, level } = props
  return (
    <>
      {nodes
        .filter((n) => !shown || shown.has(n.id))
        .map((n) => (
          <Row key={n.id} {...props} node={n} level={level} />
        ))}
    </>
  )
}

function Row(props: CatalogTreeProps & { node: CatalogNode; level: number }) {
  const { node, level, isOpen, matches, selected, onToggle, onSelect, lang } = props
  const { t } = useTranslation('boards')
  const indent = INDENT[Math.min(level, INDENT.length - 1)]

  if (node.kind === 'lineageNote')
    return (
      <li role="treeitem" aria-level={level + 1} aria-selected={false} className={indent} data-catalog-node={node.id} data-catalog-kind="lineageNote">
        <p className="flex items-start gap-1.5 px-2 py-1 text-xs text-muted-foreground" data-catalog-lineage-note>
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('catalog.lineageNote')}
        </p>
      </li>
    )

  const hasChildren = node.children.length > 0
  const open = hasChildren && isOpen(node.id)
  const picked = selected === node.id
  const dim = node.kind === 'area' && !node.area.available
  const name = nodeName(node, lang, t)
  return (
    <li
      role="treeitem"
      aria-level={level + 1}
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={picked}
      data-catalog-node={node.id}
      data-catalog-kind={node.kind}
      data-catalog-match={matches.has(node.id) || undefined}
      data-catalog-unavailable={dim || undefined}
    >
      <div className={`flex items-center gap-0.5 rounded-md border-s-2 ${indent} ${picked ? 'border-primary bg-primary-050' : 'border-transparent'} ${dim ? 'opacity-60' : ''}`}>
        {hasChildren ? (
          <IconButton
            size="compact"
            label={open ? t('catalog.collapse', { name: fsi(name.text) }) : t('catalog.expand', { name: fsi(name.text) })}
            aria-expanded={open}
            onClick={() => onToggle(node.id)}
            data-catalog-toggle={node.id}
          >
            {/* Closed points along the reading direction (mirrored under RTL); open points down in both. */}
            <ChevronRight className={`size-3.5 transition-transform ${open ? 'rotate-90' : 'rtl:rotate-180'}`} aria-hidden />
          </IconButton>
        ) : (
          <span className="inline-block size-6 shrink-0" aria-hidden />
        )}
        <Button
          variant="text"
          aria-current={picked ? 'true' : undefined}
          onClick={() => onSelect(node)}
          className={`min-w-0 flex-1 justify-start rounded-md ${picked ? 'text-primary-800' : 'text-foreground'} ${matches.has(node.id) ? 'font-semibold' : 'font-normal'}`}
          data-catalog-pick={node.id}
        >
          <span className="shrink-0 text-muted-foreground">{kindIcon(node)}</span>
          <span className="min-w-0 flex-1 truncate text-start">{name.node}</span>
          {COUNTED.has(node.kind) && (
            <span className="text-xs text-muted-foreground">
              <Ltr>{node.children.length}</Ltr>
            </span>
          )}
        </Button>
      </div>
      {dim && (
        <p className={`${INDENT[Math.min(level + 1, INDENT.length - 1)]} px-2 pb-1 text-xs text-muted-foreground`} data-catalog-unavailable-reason={node.id}>
          {t('catalog.unavailable')}
          {node.kind === 'area' && node.area.unavailableReason && (
            <>
              {' '}
              <bdi>{saysIn(node.area.unavailableReason, lang)}</bdi>
            </>
          )}
        </p>
      )}
      {open && (
        <ul role="group" className="flex flex-col gap-0.5">
          <Level {...props} nodes={node.children} level={level + 1} />
        </ul>
      )}
    </li>
  )
}

/** Nodes that show how many they hold beside their name. */
const COUNTED = new Set<CatalogNode['kind']>(['group', 'plannedGroup', 'plannedStatus', 'untappedGroup'])

function kindIcon(n: CatalogNode): ReactNode {
  const c = 'size-4'
  switch (n.kind) {
    case 'area':
      return <Layers className={c} aria-hidden />
    case 'group':
      return <Folder className={c} aria-hidden />
    case 'measure':
      return <Sigma className={c} aria-hidden />
    case 'dimension':
      return <Tag className={c} aria-hidden />
    case 'mart':
      return <Table2 className={c} aria-hidden />
    case 'roadmap':
      return <MapIcon className={c} aria-hidden />
    case 'plannedGroup':
    case 'plannedStatus':
    case 'untappedGroup':
      return <Folder className={c} aria-hidden />
    case 'planned':
      return <Lightbulb className={c} aria-hidden />
    case 'untapped':
      return <TableProperties className={c} aria-hidden />
    default:
      return <Database className={c} aria-hidden />
  }
}

/** A node's name: the drawn node and its plain text (for the chevron's accessible name). */
function nodeName(n: CatalogNode, lang: string, t: (k: string) => string): { node: ReactNode; text: string } {
  const label = (l: { en: string; ar: string }, key: string) => {
    const text = saysIn(l, lang) || key
    return { node: <bdi>{text}</bdi>, text }
  }
  switch (n.kind) {
    case 'area':
      return label(n.area.label, n.area.key)
    case 'measure':
      return label(n.measure.label, n.measure.key)
    case 'dimension':
      return label(n.dimension.label, n.dimension.key)
    case 'group': {
      const text = t(`catalog.group.${n.group}`)
      return { node: text, text }
    }
    case 'mart':
    case 'source':
      return { node: <Ltr>{n.key}</Ltr>, text: n.key }
    // 842: the Planned / untapped section.
    case 'roadmap':
    case 'plannedGroup':
    case 'untappedGroup': {
      const text = t(`catalog.planned.node.${n.kind}`)
      return { node: text, text }
    }
    case 'plannedStatus': {
      const text = t(`catalog.planned.status.${n.status}`)
      return { node: text, text }
    }
    case 'planned':
      return label(n.planned.label, n.planned.key)
    case 'untapped':
      return { node: <Ltr>{n.untapped.key}</Ltr>, text: n.untapped.key }
    default:
      return { node: null, text: '' }
  }
}
