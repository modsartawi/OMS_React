import { useState, type DragEvent, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Folder, FolderOpen, Inbox, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { apiErrorData } from '@/core/api'
import type { AnalyticsFolder } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { folderName, folderNameTaken, LIBRARY_DRAG_TYPE, type LibraryFolder } from './library'
import LibraryMenu from './LibraryMenu'
import { useFolderWrites } from './use-library'
import { analyticsErrorWords } from './wire'

/**
 * 837 item 3: the library's folder rail, at the start side — All items · Unfiled · my folders (with counts) ·
 * + New folder · Recently deleted. A row dragged onto Unfiled or a folder is filed there (`onDropItem`); each folder's
 * ⋯ menu renames or deletes it (delete unfiles its items, 3432 §1). Until the server has folders (`available` false)
 * the rail shows All items and a note, nothing else.
 */
export default function LibraryRail({
  folders,
  available,
  current,
  onPick,
  onDropItem,
}: {
  folders: readonly AnalyticsFolder[]
  available: boolean
  current: LibraryFolder
  onPick: (folder: LibraryFolder) => void
  onDropItem: (itemId: string, folder: AnalyticsFolder | null) => void
}) {
  const { t } = useTranslation('boards')
  const [editing, setEditing] = useState<{ folder: AnalyticsFolder | null } | null>(null)
  const [deleting, setDeleting] = useState<AnalyticsFolder | null>(null)
  const writes = useFolderWrites()

  return (
    <nav aria-label={t('home.library.railLabel')} className="flex w-full flex-col gap-0.5 md:w-56 md:shrink-0" data-analytics-library-rail>
      <RailEntry active={current === 'all'} onPick={() => onPick('all')} icon={<Layers className="size-4" aria-hidden />} data="all">
        {t('home.library.all')}
      </RailEntry>
      {!available ? (
        <p className="mt-2 px-2 text-xs text-muted-foreground" data-analytics-library-folders-unavailable>
          {t('home.library.foldersUnavailable')}
        </p>
      ) : (
        <>
          <RailEntry
            active={current === 'none'}
            onPick={() => onPick('none')}
            onDropItem={(id) => onDropItem(id, null)}
            icon={<Inbox className="size-4" aria-hidden />}
            data="none"
          >
            {t('home.library.none')}
          </RailEntry>
          <h2 className="mt-3 px-2 text-xs font-semibold text-muted-foreground">{t('home.library.railLabel')}</h2>
          {folders.map((f) => (
            <RailEntry
              key={f.id}
              active={current === f.id}
              onPick={() => onPick(f.id)}
              onDropItem={(id) => onDropItem(id, f)}
              icon={current === f.id ? <FolderOpen className="size-4" aria-hidden /> : <Folder className="size-4" aria-hidden />}
              count={f.itemCount}
              data={f.id}
              menu={
                <LibraryMenu
                  label={t('home.library.folderActions', { name: fsi(f.name) })}
                  icon={MoreHorizontal}
                  data={`folder:${f.id}`}
                  items={[
                    { key: 'rename', label: t('home.library.rename'), icon: Pencil, onSelect: () => setEditing({ folder: f }) },
                    { key: 'delete', label: t('home.library.deleteFolder'), icon: Trash2, danger: true, onSelect: () => setDeleting(f) },
                  ]}
                />
              }
            >
              <bdi>{f.name}</bdi>
            </RailEntry>
          ))}
          <Button variant="text" className="mt-1 w-full justify-start rounded-md" onClick={() => setEditing({ folder: null })} data-analytics-new-folder>
            <Plus className="size-4" aria-hidden />
            {t('home.library.newFolder')}
          </Button>
          <div className="mt-3 border-t border-border/60 pt-2">
            <RailEntry active={current === 'deleted'} onPick={() => onPick('deleted')} icon={<Trash2 className="size-4" aria-hidden />} data="deleted">
              {t('home.library.deleted')}
            </RailEntry>
          </div>
        </>
      )}
      {editing && (
        <FolderDialog
          folder={editing.folder}
          folders={folders}
          pending={writes.save.isPending}
          error={writes.save.error}
          onClose={() => {
            setEditing(null)
            writes.save.reset()
          }}
          onSave={(name) =>
            writes.save.mutate(
              { id: editing.folder?.id, name },
              {
                onSuccess: () => {
                  setEditing(null)
                  writes.save.reset()
                },
              },
            )
          }
        />
      )}
      <Modal
        open={deleting !== null}
        onClose={() => {
          setDeleting(null)
          writes.remove.reset()
        }}
        title={t('home.library.deleteFolderDialog.title')}
        footer={
          <>
            <Button
              variant="text"
              onClick={() => {
                setDeleting(null)
                writes.remove.reset()
              }}
            >
              {t('home.library.deleteFolderDialog.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={writes.remove.isPending}
              data-analytics-confirm="deleteFolder"
              onClick={() => {
                if (!deleting) return
                const id = deleting.id
                writes.remove.mutate(id, {
                  onSuccess: () => {
                    setDeleting(null)
                    if (current === id) onPick('all')
                  },
                })
              }}
            >
              {t('home.library.deleteFolderDialog.confirm')}
            </Button>
          </>
        }
      >
        {deleting && (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <Trans t={t} i18nKey="home.library.deleteFolderDialog.body" values={{ name: deleting.name }} components={{ name: <bdi className="font-medium" /> }} />
            </p>
            {writes.remove.error && (
              <p className="text-xs text-attention-800" role="alert">
                <bdi>{analyticsErrorWords(writes.remove.error, t('home.library.deleteFolderDialog.failed'), t)}</bdi>
              </p>
            )}
          </div>
        )}
      </Modal>
    </nav>
  )
}

/** One rail row: a folder pick (a shared Button), and a drop target when `onDropItem` is given. */
function RailEntry({
  active,
  onPick,
  onDropItem,
  icon,
  count,
  menu,
  data,
  children,
}: {
  active: boolean
  onPick: () => void
  onDropItem?: (itemId: string) => void
  icon: ReactNode
  count?: number
  menu?: ReactNode
  data: string
  children: ReactNode
}) {
  const { t } = useTranslation('boards')
  const [over, setOver] = useState(false)
  const takes = (e: DragEvent) => !!onDropItem && e.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)
  return (
    <div
      className={`group flex items-center gap-1 rounded-md ${over ? 'bg-primary-050 ring-2 ring-primary' : active ? 'bg-primary-050' : ''}`}
      onDragEnter={(e) => {
        if (takes(e)) setOver(true)
      }}
      onDragOver={(e) => {
        if (!takes(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        if (!takes(e)) return
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData(LIBRARY_DRAG_TYPE)
        if (id) onDropItem?.(id)
      }}
      title={onDropItem ? t('home.library.dropHere') : undefined}
      data-analytics-library-folder={data}
      data-drop-over={over || undefined}
    >
      <Button
        variant="text"
        aria-current={active ? 'true' : undefined}
        onClick={onPick}
        className={`min-w-0 flex-1 justify-start rounded-md ${active ? 'text-primary-800' : 'text-foreground'}`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-start">{children}</span>
        {count !== undefined && (
          <span className="text-muted-foreground" data-analytics-library-folder-count={count}>
            <Ltr>{count}</Ltr>
          </span>
        )}
      </Button>
      {menu}
    </div>
  )
}

/** New folder (`folder` null) or Rename. Trimmed, 1–80, unique ignoring case; the server's 406 is worded too. */
function FolderDialog({
  folder,
  folders,
  pending,
  error,
  onClose,
  onSave,
}: {
  folder: AnalyticsFolder | null
  folders: readonly AnalyticsFolder[]
  pending: boolean
  error: unknown
  onClose: () => void
  onSave: (name: string) => void
}) {
  const { t } = useTranslation('boards')
  const [draft, setDraft] = useState(folder?.name ?? '')
  const [tried, setTried] = useState(false)
  const name = folderName(draft)
  const taken = !!name && folderNameTaken(folders, name, folder?.id)
  const fieldRefused = !!error && (apiErrorData(error) as { field?: string } | null)?.field === 'name'
  const problem = !name ? t('home.library.folderDialog.invalid') : taken ? t('home.library.folderDialog.taken') : null
  const shownProblem = tried && problem ? problem : error ? analyticsErrorWords(error, t('home.library.folderDialog.failed'), t) : null
  const submit = () => {
    setTried(true)
    if (name && !taken) onSave(name)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t(folder ? 'home.library.folderDialog.renameTitle' : 'home.library.folderDialog.createTitle')}
      width="26rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('home.library.folderDialog.cancel')}
          </Button>
          <Button variant="primary" disabled={pending} onClick={submit} data-analytics-folder-save>
            {t(folder ? 'home.library.folderDialog.save' : 'home.library.folderDialog.create')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label={t('home.library.folderDialog.name')} hint={t('home.library.folderDialog.hint')} error={shownProblem} invalid={!!shownProblem && (tried || fieldRefused)}>
          <Input value={draft} maxLength={80} autoFocus onChange={(e) => setDraft(e.target.value)} className="w-full" data-analytics-folder-name />
        </Field>
      </form>
    </Modal>
  )
}
