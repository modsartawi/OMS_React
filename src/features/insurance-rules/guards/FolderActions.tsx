import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FolderPen, FolderPlus } from 'lucide-react'

import { GUARD_DRAFT_KEY } from '@/core/insurance-rules/api'
import { childPath, folderNameProblem, renamedPath, type FolderNode } from '@/core/insurance-rules/folders'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import { fsi } from '@/core/util/bidi'
import { GUARDS_KEY, GUARD_FOLDERS_KEY, guardFoldersApi } from './api'

type Mode = { kind: 'new'; parent: string } | { kind: 'rename'; path: string } | null

/**
 * New folder / Rename under the folder tree (609). Folders only organize rules (K14), so neither asks for
 * approval: `POST …/Folders` makes one under the picked folder, `PUT …/Folders { from, to }` renames the picked
 * one (its rules and the folders under it follow). A name is refused empty, with a `/`, or a sibling's.
 */
export default function FolderActions({ tree, picked, onPick }: { tree: readonly FolderNode[]; picked: string; onPick: (path: string) => void }) {
  const { t } = useTranslation('insurance-guards')
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>(null)
  const [name, setName] = useState('')

  const done = () => {
    setMode(null)
    setName('')
    for (const queryKey of [GUARD_FOLDERS_KEY, GUARDS_KEY, GUARD_DRAFT_KEY]) void queryClient.invalidateQueries({ queryKey })
  }
  const create = useMutation({
    mutationFn: (path: string) => guardFoldersApi.create(path).then(() => path),
    onSuccess: (path) => {
      done()
      notify.success(t('folders.created', { folder: fsi(path) }))
      onPick(path)
    },
    onError: (err) => notify.apiError(t('folders.createFailed'), err, t('folders.createFailed')),
  })
  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => guardFoldersApi.rename(from, to).then(() => to),
    onSuccess: (to) => {
      done()
      notify.success(t('folders.renamed', { folder: fsi(to) }))
      onPick(to)
    },
    onError: (err) => notify.apiError(t('folders.renameFailed'), err, t('folders.renameFailed')),
  })

  const parent = mode?.kind === 'new' ? mode.parent : mode?.kind === 'rename' ? mode.path.split('/').slice(0, -1).join('/') : ''
  const problem = mode ? folderNameProblem(name, parent, tree, mode.kind === 'rename' ? mode.path : undefined) : null
  const busy = create.isPending || rename.isPending
  const submit = () => {
    if (!mode || problem) return
    if (mode.kind === 'new') create.mutate(childPath(mode.parent, name))
    else if (renamedPath(mode.path, name) !== mode.path) rename.mutate({ from: mode.path, to: renamedPath(mode.path, name) })
    else setMode(null)
  }

  if (!mode)
    return (
      <div className="mt-2 flex flex-wrap gap-1" data-folder-actions="">
        <Button variant="ghost" onClick={() => setMode({ kind: 'new', parent: picked })} data-folder-new="">
          <FolderPlus className="h-3.5 w-3.5" aria-hidden />
          {t(picked ? 'folders.newInside' : 'folders.new')}
        </Button>
        {picked && (
          <Button
            variant="ghost"
            onClick={() => {
              setMode({ kind: 'rename', path: picked })
              setName(picked.split('/').pop() ?? '')
            }}
            data-folder-rename=""
          >
            <FolderPen className="h-3.5 w-3.5" aria-hidden />
            {t('folders.rename')}
          </Button>
        )}
      </div>
    )

  return (
    <form
      className="mt-2 flex flex-col gap-1.5 rounded-md border border-border/60 p-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      data-folder-form={mode.kind}
    >
      <Field
        label={mode.kind === 'new' ? (parent ? t('folders.newUnder', { folder: fsi(parent) }) : t('folders.newTop')) : t('folders.renameLabel')}
        error={
          problem && name !== '' ? (
            <span role="alert" data-folder-problem={problem}>
              {t(`folders.problem.${problem}`)}
            </span>
          ) : undefined
        }
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} data-input="folder-name" />
      </Field>
      <div className="flex gap-1">
        <Button type="submit" variant="primary" disabled={problem !== null || busy} data-folder-save="">
          {t(mode.kind === 'new' ? 'folders.create' : 'folders.save')}
        </Button>
        <Button type="button" variant="text" onClick={() => setMode(null)} disabled={busy} data-folder-cancel="">
          {t('editor.cancel')}
        </Button>
      </div>
    </form>
  )
}
