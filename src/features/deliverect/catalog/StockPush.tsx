import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import ReasonDialog, { InlineRefusal } from '@/core/deliverect/ReasonDialog'
import { parseMaterialList } from '@/core/import/material-list'
import type { DeliverectImportPush, DeliverectStockPushResult } from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { catalogApi } from './api'
import {
  PUSH_NOW_LIST_CODES,
  STOCK_PUSH_MAX,
  importPushView,
  pushAccountsView,
  pushNowRefusal,
  type PushAccountsView,
} from './stock-push'
import { figure } from './whitelist-state'

// The on-demand stock push on the catalog screen (ticket 860, BackOffice spec 3481): the import's
// push block (3485) and Push now (3483). Neither ever publishes our catalog (ADR 0131): both send
// the chosen materials' stock and price as Deliverect's inventory file, one per account.

/**
 * Per Deliverect account: the stores its file covered, the rows sent, Deliverect's file id and
 * whether it took the file. An `"E"` account is red with its error; the others still went.
 */
export function PushAccounts({ view }: { view: PushAccountsView }) {
  const { t } = useTranslation('deliverect-catalog')
  return (
    <div className="flex flex-col gap-1.5">
      {view.failed > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-attention-800" data-push-some-failed={view.failed}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('pushResult.someFailed', { count: view.failed, n: fsi(figure(view.failed)) })}
        </p>
      )}
      <table className="w-full border-collapse text-xs" data-push-accounts="">
        <thead className="border-b border-border/60 text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-start font-medium">{t('pushResult.columns.account')}</th>
            <th className="px-2 py-1 text-start font-medium">{t('pushResult.columns.stores')}</th>
            <th className="px-2 py-1 text-end font-medium">{t('pushResult.columns.rows')}</th>
            <th className="px-2 py-1 text-start font-medium">{t('pushResult.columns.fileId')}</th>
            <th className="px-2 py-1 text-start font-medium">{t('pushResult.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {view.accounts.map((a) => (
            <tr
              key={a.accountKey}
              className={'border-b border-border/40 align-top ' + (a.failed ? 'bg-danger-050' : '')}
              data-push-account={a.accountKey}
              data-push-account-failed={a.failed ? '' : undefined}
            >
              <td className="px-2 py-1.5 font-mono">
                <Ltr>{a.accountKey}</Ltr>
              </td>
              <td className="px-2 py-1.5" data-push-account-stores={a.stores.length}>
                <span className="tabular-nums">
                  <Ltr>{figure(a.stores.length)}</Ltr>
                </span>
                {a.stores.length > 0 && (
                  <span className="block font-mono text-muted-foreground">
                    {/* ONE string of codes, isolated once. */}
                    <Ltr>{a.stores.join(', ')}</Ltr>
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5 text-end tabular-nums" data-push-account-rows="">
                <Ltr>{figure(a.rows)}</Ltr>
              </td>
              <td className="px-2 py-1.5 font-mono" data-push-account-file="">
                {a.fileId ? <Ltr>{a.fileId}</Ltr> : null}
              </td>
              <td className="px-2 py-1.5" data-push-account-status={a.status}>
                <StatusBadge sev={a.failed ? 'bad' : 'ok'}>
                  <span>
                    {a.failed ? t('pushResult.status.failed') : t('pushResult.status.taken')} <Ltr>{a.status}</Ltr>
                  </span>
                </StatusBadge>
                {a.error && (
                  <span className="mt-1 block text-danger-800" data-push-account-error="">
                    <bdi>{a.error}</bdi>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">{t('pushResult.hint')}</p>
    </div>
  )
}

/**
 * The import's `push` block (BackOffice 3485), under the import's answer. The import is saved
 * whatever it says: a failed push is a WARNING here, never a failed import. Nothing is drawn for a
 * server before 3485, which sends no block.
 */
export function ImportPushBlock({ push }: { push: DeliverectImportPush | null | undefined }) {
  const { t } = useTranslation('deliverect-catalog')
  const view = importPushView(push)
  if (view.kind === 'absent') return null
  return (
    <section className="flex flex-col gap-1.5 border-t border-border/60 pt-3" data-import-push={view.kind}>
      <h3 className="text-sm font-medium">{t('pushResult.title')}</h3>
      {view.kind === 'skipped' && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-import-push-why={view.why ?? ''}>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(`pushResult.skipped.${view.why ?? 'other'}`, { max: fsi(figure(STOCK_PUSH_MAX)) })}
        </p>
      )}
      {view.kind === 'failed' && (
        <div className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 px-2.5 py-2 text-xs" data-import-push-failed="">
          <p className="flex items-start gap-1.5 font-medium text-attention-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('pushResult.failed')}
          </p>
          <p>
            <bdi>{view.error}</bdi>
          </p>
        </div>
      )}
      {view.kind === 'noStores' && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-import-push-no-stores="">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('pushResult.noStores')}
        </p>
      )}
      {view.kind === 'pushed' && <PushAccounts view={view} />}
    </section>
  )
}

/**
 * **Push now** (BackOffice 3483; `POST Stock/Push`): the chosen materials' stock and price again,
 * now, to every linked, unpaused Deliverect store — e.g. once Deliverect has created the products.
 * The list starts as the grid's ticked rows and can be edited or pasted into; at most 200, refused
 * HERE before anything is sent. The door's list refusals show inline under the list — DLV-00004
 * (not whitelisted, with the materials it names) and DLV-00015 (empty or over the cap) — and its
 * reason refusal under the reason. On success the page shows the per-account answer.
 */
export function PushNowDialog({
  initial,
  onClose,
  onDone,
}: {
  initial: readonly string[]
  onClose: () => void
  onDone: (result: DeliverectStockPushResult) => void
}) {
  const { t } = useTranslation('deliverect-catalog')
  const [text, setText] = useState(() => initial.join('\n'))
  const list = useMemo(() => parseMaterialList(text, STOCK_PUSH_MAX), [text])
  const send = useMutation({
    mutationFn: (reason: string) => catalogApi.pushStock({ materialNumbers: list.materials, reason }),
    onSuccess: (result) => {
      notify.success(t('pushNow.done'))
      onDone(result)
    },
  })
  // An edit clears the refusal (`send.reset`), so while one stands the list is the list it refused.
  const refusal = pushNowRefusal(send.error, list.materials, t('dialog.failedHint'))

  return (
    <ReasonDialog
      open
      title={t('pushNow.title')}
      note={<span data-push-now-note="">{t('pushNow.note', { max: fsi(figure(STOCK_PUSH_MAX)) })}</span>}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('pushNow.confirm')}
      confirmDisabled={list.materials.length === 0 || list.overBy > 0}
      handledCodes={PUSH_NOW_LIST_CODES}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5" data-push-now-dialog="">
        <Field label={t('pushNow.list')}>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              send.reset()
            }}
            rows={6}
            disabled={send.isPending}
            dir="ltr"
            autoFocus={initial.length === 0}
            placeholder={t('import.placeholder')}
            className="font-mono"
            data-push-now-text=""
          />
        </Field>
        <span className="text-xs text-muted-foreground" data-push-now-count={list.materials.length}>
          <Trans t={t} i18nKey="pushNow.count" count={list.materials.length} values={{ n: figure(list.materials.length) }} components={{ n: <Ltr /> }} />
        </span>
        {list.overBy > 0 && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-push-now-over-cap="">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('pushNow.overCap', { count: list.overBy, max: fsi(figure(STOCK_PUSH_MAX)), overBy: fsi(figure(list.overBy)) })}
          </p>
        )}
        {refusal && (
          <div className="flex flex-col gap-1" data-push-now-refusal={refusal.code}>
            <InlineRefusal message={refusal.message} code={refusal.code} />
            {refusal.materials.length > 0 && (
              <p className="text-xs text-danger-800" data-push-now-not-whitelisted={refusal.materials.join(' ')}>
                {t('pushNow.notWhitelisted')}{' '}
                <span className="font-mono">
                  <Ltr>{refusal.materials.join(', ')}</Ltr>
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}

/** Push now's answer: per account, on the app modal. */
export function PushResultDialog({ result, onClose }: { result: DeliverectStockPushResult; onClose: () => void }) {
  const { t } = useTranslation('deliverect-catalog')
  const view = pushAccountsView(result.accounts ?? [])
  return (
    <Modal
      open
      onClose={onClose}
      title={t('pushResult.title')}
      width="40rem"
      footer={
        <Button variant="primary" onClick={onClose} data-push-result-close="">
          {t('pushResult.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3" data-push-result="">
        {view.accounts.length === 0 ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-push-result-no-stores="">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('pushResult.noStores')}
          </p>
        ) : (
          <>
            {view.failed === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-success-800" data-push-result-all-taken="">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t('pushResult.allTaken')}
              </p>
            )}
            <PushAccounts view={view} />
          </>
        )}
      </div>
    </Modal>
  )
}
