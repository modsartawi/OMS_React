import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import type { ScriptDetail, SentScript } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { scriptDetailQuery } from './api'
import { figure } from './helpers'
import { orderScriptStores, scriptIsLegacy, scriptTargetKey } from './scripts-helpers'
import { buildScriptStoreColumns } from './scripts-columns'
import TabGrid from './TabGrid'

const storeCode = (r: { code: string }) => r.code

/**
 * One store script (ticket 663), from `GET ActionSync/Scripts/Detail`: its header, its SQL when
 * the door sends it (a holder of `ActionSync.RunStoreScript` only — `null` otherwise, and then no
 * SQL is drawn at all), and each store's row, the exhausted ones first.
 *
 * Read only here. Ticket 664 puts Withdraw and Retry all in the footer and Retry on an exhausted
 * row, behind `canRunScripts`; nothing here needs to move for them.
 */
export default function ScriptDetailModal({ script, onClose }: { script: SentScript | null; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  return (
    <Modal
      open={script !== null}
      onClose={onClose}
      // A modal title is a string-only sink: the title (free text) is isolated as one value.
      title={script ? t('scriptDetail.title', { title: fsi(scriptIsLegacy(script) ? t('scriptsPage.legacyTitle') : (script.title ?? '')) }) : ''}
      width="72rem"
      footer={
        <Button variant="outlined" onClick={onClose} data-script-detail-close="">
          {t('scriptDetail.close')}
        </Button>
      }
    >
      {script && <Detail scriptId={script.scriptId} />}
    </Modal>
  )
}

function Detail({ scriptId }: { scriptId: string }) {
  const { t } = useTranslation('sync-console')
  const detail = useQuery(scriptDetailQuery(scriptId))
  const columns = useMemo(() => buildScriptStoreColumns(t), [t])
  const rows = useMemo(() => (detail.data ? orderScriptStores(detail.data.stores) : undefined), [detail.data])
  return (
    <div className="flex flex-col gap-3" data-script-detail={scriptId}>
      {detail.data && <Header detail={detail.data} />}
      {detail.data &&
        (typeof detail.data.sql === 'string' ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-muted-foreground">{t('scriptDetail.sql')}</h3>
            {/* Read only, as sent: SQL is a machine value, laid out left to right in every locale. */}
            <pre dir="ltr" className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-[12px] whitespace-pre" data-script-sql="">
              {detail.data.sql}
            </pre>
          </section>
        ) : (
          <p className="text-xs text-muted-foreground" data-script-sql-hidden="">
            {t('scriptDetail.sqlHidden')}
          </p>
        ))}
      <TabGrid
        rows={rows}
        columns={columns}
        rowId={storeCode}
        pending={detail.isPending}
        error={detail.error}
        failed={t('scriptDetail.failed')}
        empty={t('scriptDetail.empty')}
        loading={t('scriptDetail.loading')}
        data="script-stores"
      />
    </div>
  )
}

function Header({ detail }: { detail: ScriptDetail }) {
  const { t } = useTranslation('sync-console')
  const legacy = scriptIsLegacy(detail)
  const target = scriptTargetKey(detail.targetMode)
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4 gap-y-1 text-sm" data-script-header="">
        <Item label={t('scriptDetail.scriptId')}>
          <span className="font-mono text-[12px]">
            <Ltr>{detail.scriptId}</Ltr>
          </span>
        </Item>
        {!legacy && (
          <>
            <Item label={t('scriptDetail.sentBy')}>
              <Ltr>{detail.sentBy ?? ''}</Ltr>
            </Item>
            <Item label={t('scriptDetail.sentAt')}>
              <Ltr>{formatDateTime(detail.sentAt)}</Ltr>
            </Item>
            <Item label={t('scriptDetail.target')}>{target ? t(target) : <Ltr>{detail.targetMode ?? ''}</Ltr>}</Item>
          </>
        )}
        <Item label={t('scriptDetail.storeCount')}>
          <Ltr>{figure(detail.storeCount)}</Ltr>
        </Item>
        {detail.withdrawnAt && (
          <Item label={t('scriptDetail.withdrawnAt')}>
            <span data-script-withdrawn-at="">
              <Ltr>{formatDateTime(detail.withdrawnAt)}</Ltr>
            </span>
          </Item>
        )}
      </dl>
      {legacy && (
        <p className="text-xs text-muted-foreground" data-script-legacy-note="">
          {t('scriptDetail.legacyNote')}
        </p>
      )}
    </div>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  )
}
