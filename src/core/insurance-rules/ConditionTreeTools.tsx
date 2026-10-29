import { createContext, useContext, useState, type DragEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical } from 'lucide-react'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import {
  conditionAt,
  duplicateCondition,
  groupsToMoveInto,
  listAt,
  moveCondition,
  moveDown,
  moveIntoGroup,
  moveOutOfGroup,
  moveRefusal,
  moveUp,
  ungroup,
  ungroupRefusal,
  wrapInGroup,
  type ConditionPath,
} from './guard-edit'
import type { GuardCondition } from './model'

// Rearranging a condition tree (oms 658), for every editor that draws the guard language's All of / Any of tree —
// the guard editor's IF and the category / coverage rules' (617). Drag and drop (native HTML5: a handle on every
// condition and group, a drop zone between siblings and inside each group, a refused drop shown as not allowed),
// and the same moves without a mouse: each condition's tools menu (up, down, out of its group, into a sibling
// group, duplicate; ungroup on a group) and a selection mode that groups the ticked siblings. Every move is one
// edit through the caller's `apply`, so the editor's history covers it. The pure moves are `./guard-edit`'s. The
// words are the `insurance-rules` bundle's (`tree.*`).

/** One edit of the tree: the caller runs it through its history. */
export type TreeApply = (fn: (when: GuardCondition[]) => GuardCondition[]) => void

interface TreeState {
  when: readonly GuardCondition[]
  apply: TreeApply
  dragging: ConditionPath | null
  setDragging: (p: ConditionPath | null) => void
  selecting: boolean
  setSelecting: (on: boolean) => void
  selected: ConditionPath[]
  setSelected: (ps: ConditionPath[]) => void
}

const Tree = createContext<TreeState | null>(null)

const keyOf = (p: ConditionPath) => p.join('.')
const parentKey = (p: ConditionPath) => keyOf(p.slice(0, -1))

function useTree(): TreeState {
  const s = useContext(Tree)
  if (!s) throw new Error('ConditionTreeTools: outside a TreeToolsProvider')
  return s
}

/** The tree's tools for everything under it: drag state and the selection. */
export function TreeToolsProvider({ when, apply, children }: { when: readonly GuardCondition[]; apply: TreeApply; children: ReactNode }) {
  const [dragging, setDragging] = useState<ConditionPath | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ConditionPath[]>([])
  // A selection whose conditions moved away is dropped rather than pointing at others.
  const live = selected.filter((p) => conditionAt(when, p))
  return (
    <Tree.Provider value={{ when, apply, dragging, setDragging, selecting, setSelecting, selected: live, setSelected }}>{children}</Tree.Provider>
  )
}

/** The handle a condition or group is dragged by. Keyboard and touch users move it through its tools menu. */
export function DragHandle({ path }: { path: ConditionPath }) {
  const { t } = useTranslation('insurance-rules')
  const { setDragging } = useTree()
  return (
    <span
      draggable
      title={t('tree.drag')}
      aria-hidden
      className="inline-grid h-7 w-5 shrink-0 cursor-grab place-items-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', keyOf(path))
        setDragging(path)
      }}
      onDragEnd={() => setDragging(null)}
      data-drag-handle={keyOf(path)}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </span>
  )
}

/**
 * Where a dragged condition may be dropped: before the item at `index` of the list at `parent` (`index` = its
 * length: after the last). Thin while nothing is dragged; while a drag is on it shows whether it would take the
 * condition — a line where it lands, or "not here" and why (into itself, a 4th level).
 */
export function DropZone({ parent, index, empty = false }: { parent: ConditionPath; index: number; empty?: boolean }) {
  const { t } = useTranslation('insurance-rules')
  const { when, apply, dragging, setDragging } = useTree()
  const [over, setOver] = useState(false)
  const refusal = dragging ? moveRefusal(when, dragging, parent, index) : null
  const where = `${keyOf(parent)}@${index}`
  if (!dragging) return empty ? null : <div className="h-0" data-drop={where} />
  const state = refusal ? 'refused' : 'allowed'
  return (
    <div
      className={
        'flex items-center rounded-md border border-dashed px-2 text-xs transition-colors ' +
        (empty ? 'min-h-9 ' : 'min-h-5 ') +
        (over ? (refusal ? 'cursor-not-allowed border-danger-border bg-danger-050 text-danger-800' : 'border-primary bg-primary-050 text-primary-800') : 'border-border/60 text-muted-foreground')
      }
      onDragEnter={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDragOver={(e) => {
        if (refusal) {
          e.dataTransfer.dropEffect = 'none'
          return
        }
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const from = dragging
        setDragging(null)
        if (!refusal) apply((w) => moveCondition(w, from, parent, index))
      }}
      data-drop={where}
      data-drop-state={state}
    >
      {over ? (refusal ? t(`tree.refused.${refusal}`) : t('tree.dropHere')) : empty ? t('tree.dropInto') : null}
    </div>
  )
}

/** The tree's toolbar: the selection mode, and "Group the selected as All of / Any of". */
export function TreeToolbar() {
  const { t } = useTranslation('insurance-rules')
  const { apply, selecting, setSelecting, selected, setSelected } = useTree()
  return (
    <div className="flex flex-wrap items-center gap-2" data-tree-toolbar="">
      <Chip
        on={selecting}
        onClick={() => {
          setSelecting(!selecting)
          setSelected([])
        }}
        data-select-mode=""
      >
        {t('tree.select')}
      </Chip>
      {selecting && (
        <>
          <span className="text-xs text-muted-foreground" data-selected-count={selected.length}>
            {selected.length ? t('tree.selected', { count: selected.length }) : t('tree.selectHint')}
          </span>
          {(['all', 'any'] as const).map((mode) => (
            <Button
              key={mode}
              variant="outlined"
              disabled={!selected.length}
              onClick={() => {
                const paths = selected
                apply((w) => wrapInGroup(w, paths, mode))
                setSelected([])
                setSelecting(false)
              }}
              data-group-selected={mode}
            >
              {t(`tree.groupAs.${mode}`)}
            </Button>
          ))}
        </>
      )}
    </div>
  )
}

/** A condition's tick in the selection mode: ticking one in another list starts the selection there (siblings only). */
export function SelectTick({ path }: { path: ConditionPath }) {
  const { t } = useTranslation('insurance-rules')
  const { selecting, selected, setSelected } = useTree()
  if (!selecting) return null
  const on = selected.some((p) => keyOf(p) === keyOf(path))
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-primary"
      checked={on}
      aria-label={t('tree.tick')}
      onChange={() => {
        if (on) setSelected(selected.filter((p) => keyOf(p) !== keyOf(path)))
        else setSelected([...selected.filter((p) => parentKey(p) === parentKey(path)), path])
      }}
      data-select-condition={keyOf(path)}
    />
  )
}

/** A condition's tools: the moves a drag makes, as a menu (keyboard and touch), plus Duplicate and Ungroup. */
export function ConditionTools({ path }: { path: ConditionPath }) {
  const { t } = useTranslation('insurance-rules')
  const { when, apply } = useTree()
  const c = conditionAt(when, path)
  const at = path[path.length - 1]
  const siblings = listAt(when, path.slice(0, -1)) ?? []
  const into = groupsToMoveInto(when, path)
  const modeWord = (g: ConditionPath) => {
    const x = conditionAt(when, g)
    return x?.check === 'group' ? t(`tree.mode.${x.mode}`) : ''
  }
  const outOk = path.length > 1 && !moveRefusal(when, path, path.slice(0, -2), path[path.length - 2] + 1)
  const ungroupWhy = c?.check === 'group' ? ungroupRefusal(when, path) : 'notGroup'
  const run = (v: string) => {
    if (v === 'up') apply((w) => moveUp(w, path))
    else if (v === 'down') apply((w) => moveDown(w, path))
    else if (v === 'out') apply((w) => moveOutOfGroup(w, path))
    else if (v === 'duplicate') apply((w) => duplicateCondition(w, path))
    else if (v === 'ungroup') apply((w) => ungroup(w, path))
    else if (v.startsWith('into:')) {
      const g = v.slice(5).split('.').map(Number)
      apply((w) => moveIntoGroup(w, path, g))
    }
  }
  return (
    <Select value="" aria-label={t('tree.tools')} className="w-40" onChange={(e) => e.target.value && run(e.target.value)} data-tools={keyOf(path)}>
      <option value="">{t('tree.tools')}</option>
      <option value="up" disabled={at === 0}>
        {t('tree.up')}
      </option>
      <option value="down" disabled={at >= siblings.length - 1}>
        {t('tree.down')}
      </option>
      {path.length > 1 && (
        <option value="out" disabled={!outOk}>
          {t('tree.out')}
        </option>
      )}
      {into.map((g) => (
        <option key={keyOf(g)} value={`into:${keyOf(g)}`}>
          {t('tree.into', { n: fsi(String(g[g.length - 1] + 1)), mode: modeWord(g) })}
        </option>
      ))}
      <option value="duplicate">{t('tree.duplicate')}</option>
      {c?.check === 'group' && (
        <option value="ungroup" disabled={ungroupWhy !== null}>
          {ungroupWhy === 'negated' ? t('tree.ungroupNegated') : t('tree.ungroup')}
        </option>
      )}
    </Select>
  )
}
