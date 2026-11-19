import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Download, Loader2, Save, Upload } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import AudiencePicker from '@/core/analytics-audience/AudiencePicker'
import { audienceWrite, type AudienceDraft } from '@/core/analytics-audience/audience'
import { canAuthorAnalytics } from '@/core/analytics-access'
import { ITEM_LISTS_LIBRARY_PATH, itemListHref } from '@/core/analytics-routes'
import type { ItemListPreview } from '@/core/models/item-list'
import { usePermissions } from '@/core/permissions'
import { saysIn } from '@/core/rules/sentence'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { saveBlob } from '@/core/util/download-file'
import { itemListActions } from './access'
import { ITEM_LIST_FOLDERS_KEY, ITEM_LISTS_KEY, isExpiredTokenRefusal, itemListApi, itemListKey } from './api'
import PreviewPanel from './PreviewPanel'
import { fileProblem, saveState, tokenDeadline, type SaveMode } from './preview'

/** The library's item lists read again after a save (boards' `ANALYTICS_ITEMS_KEY`, named by value: a feature may not import another). */
const ANALYTICS_ITEMS_KEY = ['analytics', 'items'] as const

/**
 * Analytics ▸ Upload an item list (oms 925, BackOffice spec 4057), behind the author grant: the template, a file drop
 * (`.xlsx` / `.csv`, 2 MB), the server's preview with its problems by row, then name, audience and folder, and Save,
 * which spends the preview's token. At `/analytics/itemlist/:id/upload` it is the list's re-upload: the same preview,
 * and Save replaces the list's contents as a new version.
 */
export default function ItemListUploadPage() {
  const { t } = useTranslation('item-lists')
  const { id } = useParams()
  return (
    <ScreenGate
      can={canAuthorAnalytics}
      ns="item-lists"
      title={t(id ? 'upload.reuploadTitle' : 'upload.title')}
      subtitle={t(id ? 'upload.reuploadSubtitle' : 'upload.subtitle')}
    >
      {id ? <Reupload key={id} id={id} /> : <Uploader mode="create" />}
    </ScreenGate>
  )
}

/** A re-upload: the list is read first, for its name, and only its owner is offered the drop. */
function Reupload({ id }: { id: string }) {
  const { t, i18n } = useTranslation('item-lists')
  const permissions = usePermissions()
  const userId = useSession((s) => s.userId)
  const list = useQuery({ queryKey: itemListKey(id), queryFn: () => itemListApi.get(id), retry: false })
  if (list.isPending)
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('list.loading')}
      </p>
    )
  if (!list.data) return <ErrorBanner message={apiErrorMessage(list.error, t('upload.loadFailed'))} />
  const can = itemListActions(permissions, userId, list.data)
  return (
    <div className="flex flex-col gap-4">
      <Link to={itemListHref(id)} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline" data-item-list-back="">
        <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden />
        {t('upload.back')}
        <span className="font-semibold">
          <bdi>{saysIn(list.data.title, i18n.language)}</bdi>
        </span>
      </Link>
      {can.reupload ? (
        <Uploader mode="replace" listId={id} />
      ) : (
        <p className="text-sm text-muted-foreground" data-item-list-not-owner="">
          {t('upload.notOwner')}
        </p>
      )}
    </div>
  )
}

function Uploader({ mode, listId }: { mode: SaveMode; listId?: string }) {
  const { t } = useTranslation('item-lists')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<ItemListPreview | null>(null)
  const [expired, setExpired] = useState(false)
  const [picked, setPicked] = useState<'type' | 'size' | null>(null)
  const [name, setName] = useState('')
  const [audience, setAudience] = useState<AudienceDraft>({ everyone: true, roles: [], users: [] })
  const [folderId, setFolderId] = useState('')
  const [now, setNow] = useState(() => Date.now())
  /** When the token lapses on this machine's clock, counted from the preview's receipt (`tokenDeadline`). */
  const [deadline, setDeadline] = useState(Infinity)

  const template = useMutation({ mutationFn: itemListApi.template, onSuccess: ({ blob, fileName }) => saveBlob(fileName, blob) })
  const read = useMutation({
    mutationFn: itemListApi.preview,
    onSuccess: (p) => {
      const received = Date.now()
      setPreview(p)
      setDeadline(tokenDeadline(p, received))
      setNow(received)
    },
  })
  const folders = useQuery({ queryKey: ITEM_LIST_FOLDERS_KEY, queryFn: itemListApi.folders, retry: false, enabled: mode === 'create' })

  /** The token lapsed (the clock, or Save's refusal): the preview is dropped and the file asked for again. */
  const lapse = () => {
    setPreview(null)
    setExpired(true)
    save.reset()
  }

  // The preview's own clock: at its deadline (the server's window from receipt) the page asks for the file again,
  // before Save is ever pressed. Save's `ANALYTICS-433` refusal is what decides; this only spares a doomed press.
  useEffect(() => {
    if (!preview || !Number.isFinite(deadline)) return
    const left = deadline - Date.now()
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(left, 2_147_000_000)))
    return () => clearTimeout(timer)
  }, [preview, deadline])
  useEffect(() => {
    if (preview && now >= deadline) lapse()
  }, [preview, now, deadline])

  const save = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('no preview')
      if (mode === 'replace' && listId) return itemListApi.replace(listId, preview.token)
      const write = audienceWrite(audience)
      if (!write) throw new Error('no audience')
      return itemListApi.create({ token: preview.token, name: name.trim(), audience: write, folderId: folderId || null })
    },
    onSuccess: (list) => {
      void queryClient.invalidateQueries({ queryKey: ITEM_LISTS_KEY })
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      toast.success(t(mode === 'replace' ? 'save.savedVersion' : 'save.saved'))
      // A save answering no readable id lands on the library's item lists, never `/analytics/itemlist/`.
      const saved = list.id || listId
      navigate(saved ? itemListHref(saved) : ITEM_LISTS_LIBRARY_PATH)
    },
    onError: (err) => {
      if (isExpiredTokenRefusal(err)) lapse()
    },
  })

  const choose = (file: File) => {
    const problem = fileProblem(file)
    setPicked(problem)
    // A refused file drops the last preview too: Save never spends a token for a file the page just refused.
    setPreview(null)
    save.reset()
    read.reset()
    if (problem) return
    setExpired(false)
    read.mutate(file)
  }

  const state = saveState({ preview, mode, name, audience, deadline, now, pending: save.isPending })

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4" data-item-list-upload={mode}>
      <Step title={t('template.title')} hint={t('template.hint')}>
        <div>
          <Button variant="secondary" onClick={() => template.mutate()} disabled={template.isPending} data-item-list-template="">
            {template.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
            {t(template.isPending ? 'template.downloading' : 'template.download')}
          </Button>
        </div>
        {template.isError && <ErrorBanner message={apiErrorMessage(template.error, t('template.failed'))} />}
      </Step>

      <Step title={t('drop.title')} hint={t('drop.hint')}>
        {expired && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" data-item-list-expired="">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{t('expired.title')}</p>
              <p>{t('expired.body')}</p>
            </div>
          </div>
        )}
        <FileDrop onFile={choose} busy={read.isPending} />
        {picked && (
          <p role="alert" className="text-sm text-danger-800" data-item-list-file-problem={picked}>
            {t(`drop.${picked}`)}
          </p>
        )}
        {read.isPending && (
          <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-item-list-reading="">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t('drop.reading')}
          </p>
        )}
        {read.isError && (
          <div data-item-list-read-error="">
            <ErrorBanner message={apiErrorMessage(read.error, t('drop.failed'))} />
          </div>
        )}
      </Step>

      {preview && <PreviewPanel preview={preview} />}

      {preview && (
        <Step title={t('save.title')}>
          {mode === 'create' && (
            <div className="flex max-w-xl flex-col gap-4">
              <Field label={t('save.name')} hint={t('save.nameHint')}>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} data-item-list-name="" />
              </Field>
              <AudiencePicker who={t('save.who')} draft={audience} onChange={setAudience} />
              <Field label={t('save.folder')}>
                <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} data-item-list-folder="">
                  <option value="">{t('save.unfiled')}</option>
                  {(folders.data ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {fsi(f.name)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={!state.enabled} data-item-list-save="">
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
              {t(save.isPending ? 'save.saving' : mode === 'replace' ? 'save.saveVersion' : 'save.save')}
            </Button>
            {state.reason && state.reason !== 'saving' && (
              <span className="text-xs text-muted-foreground" data-item-list-save-hold={state.reason}>
                {t(`save.hold.${state.reason}`)}
              </span>
            )}
          </div>
          {save.isError && !isExpiredTokenRefusal(save.error) && (
            <div data-item-list-save-error="">
              <ErrorBanner message={apiErrorMessage(save.error, t('save.failed'))} />
            </div>
          )}
        </Step>
      )}
    </div>
  )
}

/** The file drop: a dashed zone taking a dropped file, or the native picker behind its link. */
function FileDrop({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const { t } = useTranslation('item-lists')
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [over, setOver] = useState(false)
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm ${over ? 'border-primary bg-primary-050' : 'border-border bg-muted/30'}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && !busy) onFile(file)
      }}
      data-item-list-drop=""
    >
      <Upload className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">
        {t('drop.zone')}{' '}
        <label htmlFor={inputId} className="cursor-pointer font-medium text-primary hover:underline">
          {t('drop.pick')}
        </label>
      </p>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        aria-label={t('drop.file')}
        disabled={busy}
        data-item-list-file=""
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared at once, so choosing the same file again (after fixing it) fires a change.
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  )
}
