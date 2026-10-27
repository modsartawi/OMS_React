import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Loader2, Upload } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatFigure } from '@/core/util/number-format'
import { fsi } from '@/core/util/bidi'
import { EDITIONS_KEY, editionsApi, historyQuery } from './api'
import { EDITION_LISTS, editionPath, editionsFromParams, editionsToParams, liveEdition, type EditionList } from './editions'
import { EditionStateBadge } from './parts'
import { ByAt, DeniedCard } from '@/core/insurance-rules/parts'

/**
 * Insurance rules ▸ Editions — `/insurance-rules/editions` (BackOffice 3138, oms ticket 613). The SFDA Human
 * Drug List or the CHI Drug Formulary (`?list=chi`): upload a new edition (Excel), and every edition before it,
 * newest first — the live one, the one waiting to be published, and the old ones, read-only. An edition opens
 * its diff, its publish and its gap report (`/insurance-rules/editions/:list/:id`).
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on the read is "You do not have access".
 */
export default function EditionsPage() {
  const { t } = useTranslation('insurance-editions')
  const { query, update } = useUrlQuery(editionsFromParams, editionsToParams)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-editions-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('list.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('list.lede')}</p>
      </header>
      <div role="tablist" aria-label={t('list.tabs')} className="flex gap-1">
        {EDITION_LISTS.map((l) => (
          <Chip key={l} variant="tab" on={query.list === l} data-list-tab={l} onClick={() => update(() => ({ list: l }))}>
            {t(`listName.${l}`)}
          </Chip>
        ))}
      </div>
      <UploadCard list={query.list} />
      <History list={query.list} />
    </section>
  )
}

function UploadCard({ list }: { list: EditionList }) {
  const { t } = useTranslation('insurance-editions')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({
    mutationFn: (f: File) => editionsApi.upload(list, f),
    onSuccess: async ({ id }) => {
      notify.success(t('upload.done'), t('upload.doneDetail', { id: fsi(id) }))
      await queryClient.invalidateQueries({ queryKey: EDITIONS_KEY })
      navigate(editionPath(list, id))
    },
  })
  const listName = t(`listName.${list}`)
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3" data-upload="">
      <div className="text-sm font-medium">{t('upload.title', { list: listName })}</div>
      <p className="text-xs text-muted-foreground">{t('upload.hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          aria-label={t('upload.file')}
          data-upload-file=""
          className="text-sm"
          onChange={(e) => {
            upload.reset()
            setFile(e.target.files?.[0] ?? null)
          }}
        />
        <Button
          variant="primary"
          data-upload-submit=""
          disabled={!file || upload.isPending}
          onClick={() => file && upload.mutate(file)}
        >
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
          {t('upload.submit')}
        </Button>
      </div>
      {upload.isError && (
        <div data-upload-refused="">
          <ErrorBanner message={apiErrorMessage(upload.error, t('upload.failed'))} />
        </div>
      )}
    </div>
  )
}

function History({ list }: { list: EditionList }) {
  const { t } = useTranslation('insurance-editions')
  const history = useQuery(historyQuery(list))
  if (history.isError && isBareDenial(history.error)) return <DeniedCard ns="insurance-editions" hook="editions-denied" />
  if (history.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(history.error, t('list.failed'))} />
  if (!history.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('list.loading')}
      </div>
    )
  }
  const rows = history.data
  const live = liveEdition(rows)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" data-live-edition="">
        {t('list.live')} {live ? <Ltr>{live.id}</Ltr> : <span className="text-muted-foreground">{t('list.noLive')}</span>}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-history-empty="">
          {t('list.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-history="">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('columns.id')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('columns.file')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('columns.rows')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('columns.state')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('columns.uploaded')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('columns.published')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-border/60" data-edition={e.id}>
                  <td className="px-3 py-2 font-medium">
                    <Link to={editionPath(e.list, e.id)} className="text-primary hover:underline" data-edition-link="">
                      <Ltr>{e.id}</Ltr>
                    </Link>
                  </td>
                  <td className="px-3 py-2" data-col="file">
                    <bdi>{e.fileName ?? ''}</bdi>
                  </td>
                  <td className="px-3 py-2 text-end" data-col="rows">
                    {e.rows == null ? null : <Ltr>{formatFigure(e.rows)}</Ltr>}
                  </td>
                  <td className="px-3 py-2">
                    <EditionStateBadge state={e.state} />
                  </td>
                  <td className="px-3 py-2 text-xs" data-col="uploaded">
                    <ByAt by={e.uploadedBy} at={e.uploadedAt} />
                  </td>
                  <td className="px-3 py-2 text-xs" data-col="published">
                    <ByAt by={e.publishedBy} at={e.publishedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
