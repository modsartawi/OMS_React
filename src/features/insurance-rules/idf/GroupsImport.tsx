import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { CheckCheck, FileUp, Loader2, Upload } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { IDF_GROUPS_KEY, idfGroupsApi, idfGroupsImportApi } from './api'
import { groupsTemplateFileName } from './download'
import DownloadButton from './DownloadButton'
import { groupsImportCounts, groupsImportRuleWordKey, isGroupsImportApplicable, type IdfGroupsImportReport, type IdfGroupsImportResult } from './groups-import'
import { IDF_UPLOAD_ACCEPT } from './upload'
import UploadRowReport from './UploadRowReport'

/**
 * The IDF groups leaf's **Template** + **Import** (BackOffice spec 3185, door 3197; oms ticket 653). Template saves
 * the blank file. Import picks a file and checks it — nothing is written: the report lists every row with what
 * applying would do (add / update) and, on a failing row, the rule and its message. **Apply** is off unless the report
 * is clean (a bad groups file must never reach the tills); the result says how many groups were added and updated,
 * and the list re-reads.
 *
 * 654: Import needs `canEditGeneral` (`canEdit`); without it only the Template shows (a read, on the view grant). The
 * result also says how many lines left their group unchanged.
 */
export default function GroupsImport({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation('insurance-idf')
  const [open, setOpen] = useState(false)
  return (
    <>
      <DownloadButton
        fetch={() => idfGroupsApi.template()}
        fallbackName={groupsTemplateFileName()}
        label={t('groupsImport.template')}
        failedLabel={t('groupsImport.templateFailed')}
        hook="data-idf-groups-template"
      />
      {canEdit && (
        <Button variant="secondary" onClick={() => setOpen(true)} data-idf-groups-import="">
          <FileUp className="h-3.5 w-3.5" aria-hidden />
          {t('groupsImport.open')}
        </Button>
      )}
      {canEdit && open && <ImportDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<IdfGroupsImportResult | null>(null)
  const upload = useMutation({ mutationFn: (f: File) => idfGroupsImportApi.upload(f) })
  const report = upload.data ?? null
  const apply = useMutation({
    mutationFn: (r: IdfGroupsImportReport) => idfGroupsImportApi.apply(r.uploadId),
    onSuccess: async (res) => {
      notify.success(t('groupsImport.applied'), t('groupsImport.appliedDetail', { added: fsi(formatFigure(res.added)), updated: fsi(formatFigure(res.updated)), unchanged: fsi(formatFigure(res.unchanged)) }))
      setResult(res)
      upload.reset()
      await qc.invalidateQueries({ queryKey: IDF_GROUPS_KEY })
    },
  })
  const counts = groupsImportCounts(report?.rows)
  const canApply = isGroupsImportApplicable(report) && !apply.isPending
  return (
    <Modal
      open
      onClose={onClose}
      width="52rem"
      title={t('groupsImport.title')}
      footer={
        <>
          <Button variant="text" onClick={onClose} data-idf-groups-import-close="">
            {t('groupsImport.close')}
          </Button>
          <Button variant="primary" disabled={!canApply} data-idf-groups-import-apply="" onClick={() => report && apply.mutate(report)}>
            {apply.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCheck className="h-3.5 w-3.5" aria-hidden />}
            {t('groupsImport.apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-groups-import-dialog="">
        <p className="text-xs text-muted-foreground">{t('groupsImport.hint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept={IDF_UPLOAD_ACCEPT}
            aria-label={t('groupsImport.file')}
            data-idf-groups-import-file=""
            className="text-sm"
            onChange={(e) => {
              upload.reset()
              apply.reset()
              setResult(null)
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          <Button
            variant="secondary"
            data-idf-groups-import-submit=""
            disabled={!file || upload.isPending}
            onClick={() => {
              if (!file) return
              apply.reset()
              setResult(null)
              upload.mutate(file)
            }}
          >
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
            {t('groupsImport.submit')}
          </Button>
        </div>
        {upload.isError && (
          <div data-idf-groups-import-refused="">
            <ErrorBanner message={apiErrorMessage(upload.error, t('groupsImport.uploadFailed'))} />
          </div>
        )}
        {report && (
          <UploadRowReport
            report={report}
            kind="group"
            applicable={isGroupsImportApplicable(report)}
            ruleWordKey={groupsImportRuleWordKey}
            keyPrefix="groupsImport"
            summary={
              <p className="text-xs text-muted-foreground" data-idf-groups-import-counts="" data-add={counts.add} data-update={counts.update}>
                <Trans t={t} i18nKey="groupsImport.counts" values={{ add: formatFigure(counts.add), update: formatFigure(counts.update) }} components={{ v: <Ltr /> }} />
              </p>
            }
          />
        )}
        <p className="text-xs text-muted-foreground">{t('groupsImport.applyHint')}</p>
        {apply.isError && (
          <div data-idf-groups-import-apply-refused="">
            <ErrorBanner message={apiErrorMessage(apply.error, t('groupsImport.applyFailed'))} />
          </div>
        )}
        {result && (
          <p className="text-sm" data-idf-groups-import-result="" data-added={result.added} data-updated={result.updated} data-unchanged={result.unchanged}>
            <Trans
              t={t}
              i18nKey="groupsImport.result"
              values={{ added: formatFigure(result.added), updated: formatFigure(result.updated), unchanged: formatFigure(result.unchanged) }}
              components={{ v: <Ltr /> }}
            />
          </p>
        )}
      </div>
    </Modal>
  )
}
