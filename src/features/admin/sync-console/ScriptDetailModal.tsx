import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import type { ScriptDetail, ScriptStoreRow, SentScript } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { scriptDetailQuery, syncConsoleAccessQuery } from './api'
import { figure } from './helpers'
import { orderScriptStores, scriptControls, scriptIsLegacy, scriptTargetKey, storeRetryOffered } from './scripts-helpers'
import { buildScriptStoreColumns } from './scripts-columns'
import ScriptActionDialog, { type ScriptAction } from './ScriptActionDialog'
import TabGrid from './TabGrid'

const storeCode = (r: { code: string }) => r.code

/**
 * One store script (ticket 663), from `GET ActionSync/Scripts/Detail`: its header, its SQL when
 * the door sends it (a holder of `ActionSync.RunStoreScript` only — `null` otherwise, and then no
 * SQL is drawn at all), and each store's row, the exhausted ones first.
 *
 * Ticket 664's controls, behind `canRunScripts` and never on a legacy or withdrawn script: the
 * footer's **Withdraw** and **Retry all exhausted**, and **Retry** on an exhausted store's row.
 * Each opens the preview-then-confirm reason dialog. They are read off the detail as the door
 * sends it (the list row until it answers), so a re-read after a write moves them.
 */
export default function ScriptDetailModal({ script, onClose }: { script: SentScript | null; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const detail = useQuery({ ...scriptDetailQuery(script?.scriptId ?? ''), enabled: script !== null })
  const [action, setAction] = useState<ScriptAction | null>(null)
  const current = script && detail.data?.scriptId === script.scriptId ? detail.data : script
  const controls = current ? scriptControls(current, access.data) : { withdraw: false, retryAll: false }
  const shownTitle = current ? (scriptIsLegacy(current) ? t('scriptsPage.legacyTitle') : (current.title ?? '')) : ''
  const rowsRetry = current ? storeRetryOffered({ state: 'exhausted' }, current, access.data) : false
  const onRetry = useCallback((code: string) => setAction({ kind: 'retry', code }), [])
  const retryOffered = useCallback(
    (row: ScriptStoreRow) => (current ? storeRetryOffered(row, current, access.data) : false),
    [current, access.data],
  )
  return (
    <Modal
      open={script !== null}
      onClose={() => {
        setAction(null)
        onClose()
      }}
      // A modal title is a string-only sink: the title (free text) is isolated as one value.
      title={script ? t('scriptDetail.title', { title: fsi(shownTitle) }) : ''}
      width="72rem"
      footer={
        <>
          {controls.withdraw && (
            <Button variant="outlined" onClick={() => setAction({ kind: 'withdraw' })} data-script-withdraw="">
              {t('scriptDetail.withdraw')}
            </Button>
          )}
          {controls.retryAll && (
            <Button variant="outlined" onClick={() => setAction({ kind: 'retry' })} data-script-retry-all="">
              {t('scriptDetail.retryAll')}
            </Button>
          )}
          <Button variant="outlined" onClick={onClose} data-script-detail-close="">
            {t('scriptDetail.close')}
          </Button>
        </>
      }
    >
      {script && (
        <Detail
          scriptId={script.scriptId}
          onRetry={rowsRetry ? onRetry : undefined}
          retryOffered={retryOffered}
        />
      )}
      {script && (
        <ScriptActionDialog scriptId={script.scriptId} title={shownTitle} action={action} onClose={() => setAction(null)} />
      )}
    </Modal>
  )
}

function Detail({
  scriptId,
  onRetry,
  retryOffered,
}: {
  scriptId: string
  /** Given only when a row's Retry can be offered at all (a sender, a live script). */
  onRetry?: (code: string) => void
  retryOffered: (row: ScriptStoreRow) => boolean
}) {
  const { t } = useTranslation('sync-console')
  const detail = useQuery(scriptDetailQuery(scriptId))
  const columns = useMemo(() => buildScriptStoreColumns(t, onRetry && { onRetry, offered: retryOffered }), [t, onRetry, retryOffered])
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
