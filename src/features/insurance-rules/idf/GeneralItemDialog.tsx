import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { IDF_GENERAL_KEY, idfGeneralEditApi } from './api'
import { EXCEPTION_REASON_MAX, reasonProblem } from './exceptions'
import {
  generalEditBody,
  generalEditProblems,
  generalFormFromRow,
  NEW_GENERAL_ITEM_FORM,
  type IdfGeneralEditForm,
  type IdfGeneralEditProblem,
} from './general-edit'
import type { IdfEntryRow } from './items'

/** A refusal is a business outcome: it stays in the dialog with the server's message (a bare 403 says "no access"). */
function Refusal({ err, title, hook }: { err: unknown; title: string; hook: string }) {
  const { t } = useTranslation('insurance-idf')
  return (
    <div {...{ [hook]: '' }}>
      <ErrorBanner className="p-3" title={title} message={isBareDenial(err) ? t('access.deniedTitle') : apiErrorMessage(err, title)} />
    </div>
  )
}

/**
 * Set or edit one general item (BackOffice 3192; oms ticket 648). Edit (`row`) starts from the row's group and
 * priority with its item number fixed; Set item (`row` null) starts blank with the item number typed. Save stays off
 * until the group, a whole priority of 1 or more and a reason are all there. A success re-reads the general master
 * (the row shows its new group and priority); a refusal stays in the dialog.
 */
export function GeneralItemDialog({ row, onClose }: { row: IdfEntryRow | null; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const mode = row ? 'edit' : 'set'
  const [form, setForm] = useState<IdfGeneralEditForm>(row ? generalFormFromRow(row) : NEW_GENERAL_ITEM_FORM)
  const [touched, setTouched] = useState<Partial<Record<keyof IdfGeneralEditForm, true>>>({})
  const problems = useMemo(() => generalEditProblems(form, mode), [form, mode])
  const valid = Object.keys(problems).length === 0
  const set = (key: keyof IdfGeneralEditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setTouched((s) => ({ ...s, [key]: true }))
  }
  const save = useMutation({
    mutationFn: () => idfGeneralEditApi.set(form.itemNumber.trim(), generalEditBody(form)),
    onSuccess: () => {
      notify.success(t('generalEdit.saved'), fsi(form.itemNumber.trim()))
      void qc.invalidateQueries({ queryKey: IDF_GENERAL_KEY })
      onClose()
    },
  })
  const problem = (key: keyof IdfGeneralEditForm) => {
    const p = touched[key] ? problems[key] : undefined
    return p ? (
      <span role="alert" data-problem={p}>
        {t(`generalEdit.problem.${p}`)}
      </span>
    ) : undefined
  }
  return (
    <Modal
      open
      onClose={onClose}
      width="30rem"
      title={row ? t('generalEdit.editTitle', { item: fsi(row.itemNumber) }) : t('generalEdit.setTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('generalEdit.cancel')}
          </Button>
          <Button variant="primary" disabled={!valid || save.isPending} data-general-save="" onClick={() => save.mutate()}>
            {t('generalEdit.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-general-dialog={row?.itemNumber ?? 'new'}>
        <p className="text-xs text-muted-foreground">{t('generalEdit.lede')}</p>
        <Field label={t('generalEdit.item')} error={problem('itemNumber')}>
          <Input dir="ltr" value={form.itemNumber} onChange={set('itemNumber')} disabled={!!row} readOnly={!!row} data-field="itemNumber" />
        </Field>
        <Field label={t('generalEdit.group')} error={problem('idfNumber')}>
          <Input dir="ltr" value={form.idfNumber} onChange={set('idfNumber')} data-field="idfNumber" />
        </Field>
        <Field label={t('generalEdit.priority')} error={problem('priority')}>
          <Input dir="ltr" inputMode="numeric" className="w-32" value={form.priority} onChange={set('priority')} data-field="priority" />
        </Field>
        <Field label={t('generalEdit.reason')} error={problem('reason')}>
          <Textarea className="h-20" dir="auto" maxLength={EXCEPTION_REASON_MAX} value={form.reason} onChange={set('reason')} data-field="reason" />
        </Field>
        {save.error != null && <Refusal err={save.error} title={t('generalEdit.saveFailed')} hook="data-idf-general-refusal" />}
      </div>
    </Modal>
  )
}

/** Clear one general item, with a reason (BackOffice 3192; oms ticket 648). A refusal stays in the dialog. */
export function ClearGeneralItemDialog({ row, onClose }: { row: IdfEntryRow; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const p: IdfGeneralEditProblem | null = reasonProblem(reason) as IdfGeneralEditProblem | null
  const clear = useMutation({
    mutationFn: () => idfGeneralEditApi.clear(row.itemNumber, reason.trim()),
    onSuccess: () => {
      notify.success(t('generalEdit.cleared'), fsi(row.itemNumber))
      void qc.invalidateQueries({ queryKey: IDF_GENERAL_KEY })
      onClose()
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="28rem"
      title={t('generalEdit.clearTitle', { item: fsi(row.itemNumber) })}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('generalEdit.cancel')}
          </Button>
          <Button variant="danger" disabled={p != null || clear.isPending} data-general-clear-confirm="" onClick={() => clear.mutate()}>
            {t('generalEdit.clear')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-general-clear-dialog={row.itemNumber}>
        <p className="text-sm text-muted-foreground">{t('generalEdit.clearHint')}</p>
        <Field
          label={t('generalEdit.reason')}
          error={
            touched && p ? (
              <span role="alert" data-problem={p}>
                {t(`generalEdit.problem.${p}`)}
              </span>
            ) : undefined
          }
        >
          <Textarea
            className="h-20"
            dir="auto"
            maxLength={EXCEPTION_REASON_MAX}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setTouched(true)
            }}
            data-field="reason"
          />
        </Field>
        {clear.error != null && <Refusal err={clear.error} title={t('generalEdit.clearFailed')} hook="data-idf-general-refusal" />}
      </div>
    </Modal>
  )
}
