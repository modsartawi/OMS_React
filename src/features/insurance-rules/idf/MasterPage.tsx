import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Loader2, Send, Upload } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { ByAt, DeniedCard, Loading } from '@/core/insurance-rules/parts'
import { IDF_KEY, idfUploadApi, mastersQuery, storeListsQuery } from './api'
import { storeListName } from './store-lists'
import { masterRow, type IdfMasterRow } from './masters'
import { IDF_UPLOAD_ACCEPT, isPublishable, ruleWordKey, type IdfUploadReport } from './upload'
import UploadRowReport from './UploadRowReport' // 653 extracted 622's row report
import VersionsSection from './VersionsSection' // 623
import ItemsSection from './ItemsSection' // 643
import DraftPanel from './DraftPanel' // 645
import { idfMasterFilesApi } from './api' // 644
import DownloadButton from './DownloadButton' // 644
import { masterTemplateFileName } from './download' // 644

/**
 * Insurance rules ▸ IDF masters ▸ one master — `/insurance-rules/idf/masters/:masterId` (BackOffice spec 3157,
 * door 3161; oms ticket 622). The master's scope, thresholds and live version, and its **Upload** step: a file
 * (item, IDF group, priority) is checked row by row and publishes nothing; the row report lists every failing row;
 * **Publish is all-or-nothing** — off unless the report is clean, and it asks for a note. Publishing moves the live
 * version here and on the list. A new upload replaces the previous report.
 *
 * The master is read from the masters list (the brief has no single-master door); a publish invalidates every IDF
 * query, so both screens show the new live version.
 *
 * 🚩 UNGATED until 628: a bare 403 on the read is "You do not have access".
 */
export default function MasterPage() {
  const { t, i18n } = useTranslation('insurance-idf')
  const { masterId = '' } = useParams()
  const masters = useQuery(mastersQuery())
  const master = masters.data?.find((m) => m.masterId === masterId)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-idf-master-page="">
      <Link to="/insurance-rules/idf/masters" className="text-xs text-muted-foreground hover:text-foreground" data-idf-back="">
        {t('upload.back')}
      </Link>
      {masters.isError && isBareDenial(masters.error) ? (
        <DeniedCard ns="insurance-idf" hook="idf-master-denied" />
      ) : masters.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(masters.error, t('upload.failed'))} />
      ) : !masters.data ? (
        <Loading text={t('upload.loading')} />
      ) : !master ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-master-missing="">
          {t('upload.notFound', { id: fsi(masterId) })}
        </p>
      ) : (
        <>
          <MasterHeader row={masterRow(master, i18n.language)} />
          {/* 643 · Items */}
          <ItemsSection key={`items-${master.masterId}`} masterId={master.masterId} liveVersionId={master.liveVersion?.versionId ?? null} />
          {/* 645 · Draft */}
          <DraftPanel key={`draft-${master.masterId}`} masterId={master.masterId} />
          <UploadStep key={master.masterId} masterId={master.masterId} />
          {/* 623 · Versions */}
          <VersionsSection key={`versions-${master.masterId}`} masterId={master.masterId} liveVersionId={master.liveVersion?.versionId ?? null} />
        </>
      )}
    </section>
  )
}

function MasterHeader({ row }: { row: IdfMasterRow }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const lists = useQuery(storeListsQuery())
  const list = row.storeListId ? lists.data?.find((l) => l.storeListId === row.storeListId) : undefined
  return (
    <header className="flex max-w-3xl flex-col gap-2" data-idf-master={row.masterId} data-kind={row.kind}>
      <h1 className="text-lg font-semibold tracking-tight">
        <bdi>{row.name}</bdi>
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('masters.columns.kind')}</dt>
        <dd data-col="kind">{t(`masters.kind.${row.kind}`, { defaultValue: row.kind })}</dd>
        {row.insurerCustomerId && (
          <>
            <dt className="text-muted-foreground">{t('masters.columns.payer')}</dt>
            <dd data-col="payer">
              <Ltr>{row.insurerCustomerId}</Ltr>
            </dd>
          </>
        )}
        {row.storeListId && (
          <>
            <dt className="text-muted-foreground">{t('masters.columns.storeList')}</dt>
            <dd data-col="storeList">
              {list ? <bdi data-store-list-id={row.storeListId}>{storeListName(list, i18n.language)}</bdi> : <Ltr>{row.storeListId}</Ltr>}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">{t('masters.columns.thresholds')}</dt>
        <dd data-col="thresholds">
          <Trans t={t} i18nKey="masters.thresholds" values={{ hard: formatFigure(row.hard), reminder: formatFigure(row.reminder) }} components={{ v: <Ltr /> }} />
        </dd>
        <dt className="text-muted-foreground">{t('upload.live')}</dt>
        {row.live ? (
          <dd className="flex flex-wrap items-baseline gap-x-3" data-col="live">
            <span data-live-number="">
              <Ltr>{formatFigure(row.live.number)}</Ltr>
            </span>
            <span className="text-xs" data-live-by-at="">
              <ByAt by={row.live.by} at={row.live.at} />
            </span>
            {row.live.note && (
              <span className="text-xs text-muted-foreground" data-live-note="">
                <bdi>{row.live.note}</bdi>
              </span>
            )}
          </dd>
        ) : (
          <dd className="text-muted-foreground" data-col="noLive">
            {t('masters.noLive')}
          </dd>
        )}
      </dl>
    </header>
  )
}

function UploadStep({ masterId }: { masterId: string }) {
  const { t } = useTranslation('insurance-idf')
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const upload = useMutation({ mutationFn: (f: File) => idfUploadApi.upload(masterId, f) })
  const report = upload.data ?? null
  const publish = useMutation({
    mutationFn: (r: IdfUploadReport) => idfUploadApi.publish(masterId, r.uploadId, note.trim()),
    onSuccess: async (v) => {
      notify.success(t('upload.published'), t('upload.publishedDetail', { n: fsi(formatFigure(v.number)) }))
      upload.reset()
      setNote('')
      await queryClient.invalidateQueries({ queryKey: IDF_KEY })
    },
  })
  const canPublish = isPublishable(report) && note.trim() !== '' && !publish.isPending
  return (
    <div className="flex max-w-4xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" data-idf-upload="">
      <div className="text-sm font-medium">{t('upload.title')}</div>
      <p className="text-xs text-muted-foreground">{t('upload.hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept={IDF_UPLOAD_ACCEPT}
          aria-label={t('upload.file')}
          data-idf-upload-file=""
          className="text-sm"
          onChange={(e) => {
            upload.reset()
            publish.reset()
            setFile(e.target.files?.[0] ?? null)
          }}
        />
        <Button
          variant="secondary"
          data-idf-upload-submit=""
          disabled={!file || upload.isPending}
          onClick={() => {
            if (!file) return
            publish.reset()
            upload.mutate(file)
          }}
        >
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
          {t('upload.submit')}
        </Button>
        {/* 644 · Template */}
        <div className="ms-auto">
          <DownloadButton
            fetch={() => idfMasterFilesApi.template()}
            fallbackName={masterTemplateFileName()}
            label={t('download.template')}
            failedLabel={t('download.templateFailed')}
            hook="data-idf-master-template"
          />
        </div>
      </div>
      {upload.isError && (
        <div data-idf-upload-refused="">
          <ErrorBanner message={apiErrorMessage(upload.error, t('upload.uploadFailed'))} />
        </div>
      )}
      {report && <UploadRowReport report={report} kind="item" applicable={isPublishable(report)} ruleWordKey={ruleWordKey} keyPrefix="upload" />}
      <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
        <Field label={t('upload.note')} className="min-w-64 flex-1">
          <Input value={note} placeholder={t('upload.notePlaceholder')} data-idf-publish-note="" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button variant="primary" data-idf-publish="" disabled={!canPublish} onClick={() => report && publish.mutate(report)}>
          {publish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
          {t('upload.publish')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('upload.publishHint')}</p>
      {publish.isError && (
        <div data-idf-publish-refused="">
          <ErrorBanner message={apiErrorMessage(publish.error, t('upload.publishFailed'))} />
        </div>
      )}
    </div>
  )
}
