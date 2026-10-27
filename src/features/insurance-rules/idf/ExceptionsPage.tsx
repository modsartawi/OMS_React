import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { ByAt, DeniedCard, FORM_FIELD, FORM_INPUT, Loading, TD, TH } from '@/core/insurance-rules/parts'
import { IDF_EXCEPTIONS_KEY, exceptionsQuery, idfExceptionsApi, mastersQuery } from './api'
import {
  EMPTY_EXCEPTION_FORM,
  IDF_EXCEPTION_HANDLINGS,
  IDF_EXCEPTION_KEY_KINDS,
  exceptionBody,
  exceptionFormProblems,
  formFromException,
  reasonProblem,
  type IdfException,
  type IdfExceptionForm,
} from './exceptions'
import { masterName, type IdfMaster } from './masters'

/**
 * Insurance rules ▸ IDF exceptions — `/insurance-rules/idf/exceptions` (BackOffice spec 3157, door 3166; oms ticket
 * 624). Rows keyed by document type, sub-document type or Nphies claim type that skip IDF priority, only remind, or
 * use a named master (619's list, named in the reader's language). Add, edit and delete each ask for a reason.
 *
 * Not 614's guard exceptions (`/insurance-rules/exceptions`). The seed rows are server data: the screen shows
 * whatever comes.
 *
 * 🚩 UNGATED until 628: a bare 403 on the read is "You do not have access".
 */
export default function ExceptionsPage() {
  const { t } = useTranslation('insurance-idf')
  const [editing, setEditing] = useState<IdfException | 'new' | null>(null)
  const [deleting, setDeleting] = useState<IdfException | null>(null)
  const list = useQuery(exceptionsQuery())
  const masters = useQuery(mastersQuery())
  const denied = list.isError && isBareDenial(list.error)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-idf-exceptions-page="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('exceptions.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('exceptions.lede')}</p>
        </div>
        {!denied && (
          <Button variant="primary" onClick={() => setEditing('new')} data-idf-exception-add="">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('exceptions.add')}
          </Button>
        )}
      </header>
      {denied ? (
        <DeniedCard ns="insurance-idf" hook="idf-exceptions-denied" />
      ) : list.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(list.error, t('exceptions.failed'))} />
      ) : !list.data ? (
        <Loading text={t('exceptions.loading')} />
      ) : list.data.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-exceptions-empty="">
          {t('exceptions.empty')}
        </p>
      ) : (
        <ExceptionsTable rows={list.data} masters={masters.data ?? []} onEdit={setEditing} onDelete={setDeleting} />
      )}
      {editing && (
        <ExceptionDialog row={editing === 'new' ? null : editing} masters={masters.data ?? []} onClose={() => setEditing(null)} />
      )}
      {deleting && <DeleteDialog row={deleting} onClose={() => setDeleting(null)} />}
    </section>
  )
}

function ExceptionsTable({
  rows,
  masters,
  onEdit,
  onDelete,
}: {
  rows: IdfException[]
  masters: IdfMaster[]
  onEdit: (row: IdfException) => void
  onDelete: (row: IdfException) => void
}) {
  const { t, i18n } = useTranslation('insurance-idf')
  const nameOf = (id: string) => {
    const m = masters.find((x) => x.masterId === id)
    return m ? masterName(m, i18n.language) : null
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm" data-idf-exceptions="">
        <thead className="bg-muted/50">
          <tr>
            {(['keyKind', 'key', 'handling', 'reason', 'changed', 'actions'] as const).map((c) => (
              <th key={c} className={TH}>
                {t(`exceptions.columns.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = r.handling === 'master' && r.masterId ? nameOf(r.masterId) : null
            return (
              <tr key={r.exceptionId} className="border-t border-border/60" data-exception={r.exceptionId} data-handling={r.handling}>
                <td className={TD} data-col="keyKind">
                  {t(`exceptions.keyKind.${r.keyKind}`, { defaultValue: r.keyKind })}
                </td>
                <td className={`${TD} font-medium`} data-col="key">
                  <Ltr>{r.key}</Ltr>
                </td>
                <td className={TD} data-col="handling">
                  {t(`exceptions.handling.${r.handling}`, { defaultValue: r.handling })}
                  {r.handling === 'master' && r.masterId && (
                    <span className="ms-1 text-muted-foreground" data-master-name="">
                      {name ? <bdi>{name}</bdi> : <Ltr>{r.masterId}</Ltr>}
                    </span>
                  )}
                </td>
                <td className={TD} data-col="reason">
                  <bdi>{r.reason}</bdi>
                </td>
                <td className={`${TD} text-xs`} data-col="changed">
                  <ByAt by={r.by} at={r.at} />
                </td>
                <td className={TD}>
                  <div className="flex gap-1">
                    <Button variant="outlined" onClick={() => onEdit(r)} data-exception-edit="">
                      {t('exceptions.edit')}
                    </Button>
                    <Button variant="danger-outlined" onClick={() => onDelete(r)} data-exception-delete="">
                      {t('exceptions.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Problem({ problem }: { problem: string | null | undefined }) {
  const { t } = useTranslation('insurance-idf')
  if (!problem) return null
  return (
    <span className="text-xs text-danger-800" role="alert" data-problem={problem}>
      {t(`exceptions.problem.${problem}`)}
    </span>
  )
}

function ExceptionDialog({ row, masters, onClose }: { row: IdfException | null; masters: IdfMaster[]; onClose: () => void }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const [form, setForm] = useState<IdfExceptionForm>(row ? formFromException(row) : EMPTY_EXCEPTION_FORM)
  const [tried, setTried] = useState(false)
  const problems = useMemo(() => exceptionFormProblems(form), [form])
  const set = <K extends keyof IdfExceptionForm>(key: K, value: IdfExceptionForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const save = useMutation({
    mutationFn: () => (row ? idfExceptionsApi.edit(row.exceptionId, exceptionBody(form)) : idfExceptionsApi.add(exceptionBody(form))),
    onSuccess: () => {
      notify.success(t(row ? 'exceptions.saved' : 'exceptions.added'))
      void qc.invalidateQueries({ queryKey: IDF_EXCEPTIONS_KEY })
      onClose()
    },
    onError: (err) => notify.apiError(t('exceptions.saveFailed'), err, t('exceptions.saveFailed')),
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="32rem"
      title={t(row ? 'exceptions.editTitle' : 'exceptions.addTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('exceptions.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending}
            data-exception-save=""
            onClick={() => {
              setTried(true)
              if (Object.keys(problems).length === 0) save.mutate()
            }}
          >
            {t('exceptions.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-exception-dialog={row?.exceptionId ?? 'new'}>
        <label className={FORM_FIELD}>
          {t('exceptions.columns.keyKind')}
          <select className={FORM_INPUT} value={form.keyKind} onChange={(e) => set('keyKind', e.target.value as IdfExceptionForm['keyKind'])} data-field="keyKind">
            {IDF_EXCEPTION_KEY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`exceptions.keyKind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FORM_FIELD}>
          {t('exceptions.columns.key')}
          <input className={FORM_INPUT} dir="ltr" value={form.key} onChange={(e) => set('key', e.target.value)} data-field="key" />
          {tried && <Problem problem={problems.key} />}
        </label>
        <fieldset className={FORM_FIELD}>
          <legend className="mb-1">{t('exceptions.columns.handling')}</legend>
          <div className="flex flex-wrap gap-3" role="radiogroup">
            {IDF_EXCEPTION_HANDLINGS.map((h) => (
              <label key={h} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <input type="radio" name="handling" value={h} checked={form.handling === h} onChange={() => set('handling', h)} data-handling-option={h} />
                {t(`exceptions.handling.${h}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {form.handling === 'master' && (
          <label className={FORM_FIELD}>
            {t('exceptions.master')}
            <select className={FORM_INPUT} value={form.masterId} onChange={(e) => set('masterId', e.target.value)} data-field="masterId">
              <option value="">{t('exceptions.pickMaster')}</option>
              {masters.map((m) => (
                <option key={m.masterId} value={m.masterId}>
                  {fsi(masterName(m, i18n.language))}
                </option>
              ))}
            </select>
            {tried && <Problem problem={problems.masterId} />}
          </label>
        )}
        <label className={FORM_FIELD}>
          {t('exceptions.reason')}
          <textarea className={`${FORM_INPUT} h-20 py-1`} dir="auto" value={form.reason} onChange={(e) => set('reason', e.target.value)} data-field="reason" />
          {tried && <Problem problem={problems.reason} />}
        </label>
      </div>
    </Modal>
  )
}

function DeleteDialog({ row, onClose }: { row: IdfException; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const problem = reasonProblem(reason)
  const remove = useMutation({
    mutationFn: () => idfExceptionsApi.remove(row.exceptionId, reason.trim()),
    onSuccess: () => {
      notify.success(t('exceptions.deleted'))
      void qc.invalidateQueries({ queryKey: IDF_EXCEPTIONS_KEY })
      onClose()
    },
    onError: (err) => notify.apiError(t('exceptions.deleteFailed'), err, t('exceptions.deleteFailed')),
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="28rem"
      title={t('exceptions.deleteTitle', { key: fsi(row.key) })}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('exceptions.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            data-exception-delete-confirm=""
            onClick={() => {
              setTried(true)
              if (!problem) remove.mutate()
            }}
          >
            {t('exceptions.delete')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-exception-delete-dialog={row.exceptionId}>
        <label className={FORM_FIELD}>
          {t('exceptions.reason')}
          <textarea className={`${FORM_INPUT} h-20 py-1`} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} data-field="reason" />
          {tried && <Problem problem={problem} />}
        </label>
      </div>
    </Modal>
  )
}
