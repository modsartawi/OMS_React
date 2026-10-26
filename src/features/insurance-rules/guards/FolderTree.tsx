import { useTranslation } from 'react-i18next'
import { Folder, FolderOpen, Layers } from 'lucide-react'
import type { FolderNode } from '@/core/insurance-rules/folders'
import Ltr from '@/core/ui/Ltr'

/**
 * The folder tree beside the Guards grid (607). Folders only organize rules (K14); picking one keeps the
 * rules in it and under it. "All rules" clears the pick. 609 adds create / rename / move here.
 */
export default function FolderTree({
  nodes,
  total,
  picked,
  onPick,
}: {
  nodes: readonly FolderNode[]
  total: number
  picked: string
  onPick: (path: string) => void
}) {
  const { t } = useTranslation('insurance-guards')
  return (
    <nav aria-label={t('folders.label')} className="flex flex-col gap-0.5 text-sm" data-folder-tree="">
      <FolderButton path="" name={t('folders.all')} count={total} depth={0} picked={picked} onPick={onPick} all />
      <Branch nodes={nodes} depth={0} picked={picked} onPick={onPick} />
    </nav>
  )
}

function Branch({ nodes, depth, picked, onPick }: { nodes: readonly FolderNode[]; depth: number; picked: string; onPick: (p: string) => void }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.path}>
          <FolderButton path={n.path} name={n.name} count={n.count} depth={depth} picked={picked} onPick={onPick} />
          {n.children.length > 0 && <Branch nodes={n.children} depth={depth + 1} picked={picked} onPick={onPick} />}
        </div>
      ))}
    </>
  )
}

function FolderButton({
  path,
  name,
  count,
  depth,
  picked,
  onPick,
  all = false,
}: {
  path: string
  name: string
  count: number
  depth: number
  picked: string
  onPick: (p: string) => void
  all?: boolean
}) {
  const on = picked === path
  const Icon = all ? Layers : on ? FolderOpen : Folder
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onPick(path)}
      data-folder={path}
      style={{ paddingInlineStart: `${0.5 + depth}rem` }}
      className={`flex w-full items-center gap-2 rounded-md py-1 pe-2 text-start ${on ? 'bg-primary-050 font-medium text-primary-800' : 'hover:bg-muted'}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <bdi className="min-w-0 flex-1 truncate">{name}</bdi>
      <span className="text-xs tabular-nums text-muted-foreground" data-count="">
        <Ltr>{count}</Ltr>
      </span>
    </button>
  )
}
