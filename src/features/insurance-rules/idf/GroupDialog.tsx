import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorData, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { IDF_GROUPS_KEY, idfGroupsApi } from './api'
import {
  EMPTY_GROUP_FORM,
  formFromGroup,
  groupBody,
  groupEditBody,
  groupFormProblems,
  refusedItemCount,
  type IdfGroup,
  type IdfGroupForm,
} from './groups'

/**
 * Add or edit one IDF group (BackOffice 3196; oms ticket 652). Add asks for the number (at most 26), the description
 * and the dosage form; Edit shows the number fixed and sends only the description and dosage form. A write refusal is
 * a toast carrying the server's message.
 */
export function GroupDialog({ row, onClose }: { row: IdfGroup | null; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const mode = row ? 'edit' : 'add'
  const [form, setForm] = useState<IdfGroupForm>(row ? formFromGroup(row) : EMPTY_GROUP_FORM)
  const [tried, setTried] = useState(false)
  const problems = useMemo(() => groupFormProblems(form, mode), [form, mode])
  const set = (key: keyof IdfGroupForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const save = useMutation({
    mutationFn: () => (row ? idfGroupsApi.edit(row.idfNumber, groupEditBody(form)) : idfGroupsApi.add(groupBody(form))),
    onSuccess: () => {
      notify.success(t(row ? 'groups.saved' : 'groups.added'), fsi(row?.idfNumber ?? form.idfNumber.trim()))
      void qc.invalidateQueries({ queryKey: IDF_GROUPS_KEY })
      onClose()
    },
    onError: (err) => notify.apiError(t('groups.saveFailed'), err, t('groups.saveFailed')),
  })
  const problem = (p: string | undefined) =>
    tried && p ? (
      <span role="alert" data-problem={p}>
        {t(`groups.problem.${p}`)}
      </span>
    ) : undefined
  return (
    <Modal
      open
      onClose={onClose}
      width="30rem"
      title={row ? t('groups.editTitle', { number: fsi(row.idfNumber) }) : t('groups.addTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('groups.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending}
            data-group-save=""
            onClick={() => {
              setTried(true)
              if (Object.keys(problems).length === 0) save.mutate()
            }}
          >
            {t('groups.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-group-dialog={row?.idfNumber ?? 'new'}>
        <Field label={t('groups.number')} hint={row ? t('groups.numberFixed') : undefined} error={problem(problems.idfNumber)}>
          <Input dir="ltr" value={form.idfNumber} onChange={set('idfNumber')} disabled={!!row} readOnly={!!row} data-field="idfNumber" />
        </Field>
        <Field label={t('groups.description')} error={problem(problems.description)}>
          <Input dir="auto" value={form.description} onChange={set('description')} data-field="description" />
        </Field>
        <Field label={t('groups.dosageForm')}>
          <Input dir="auto" value={form.dosageForm} onChange={set('dosageForm')} data-field="dosageForm" />
        </Field>
      </div>
    </Modal>
  )
}

/**
 * Remove an empty group. The door refuses while items point at it (the WPF may have added members since the list
 * was read): the refusal stays in the dialog with its message and the count it carries, and the list re-reads so the
 * row shows its real count.
 */
export function RemoveGroupDialog({ row, onClose }: { row: IdfGroup; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () => idfGroupsApi.remove(row.idfNumber),
    onSuccess: () => {
      notify.success(t('groups.removed'), fsi(row.idfNumber))
      void qc.invalidateQueries({ queryKey: IDF_GROUPS_KEY })
      onClose()
    },
    onError: () => void qc.invalidateQueries({ queryKey: IDF_GROUPS_KEY }),
  })
  const err = remove.error
  const count = err ? refusedItemCount(apiErrorData(err)) : null
  return (
    <Modal
      open
      onClose={onClose}
      width="28rem"
      title={t('groups.removeTitle', { number: fsi(row.idfNumber) })}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('groups.cancel')}
          </Button>
          <Button variant="danger" disabled={remove.isPending || err != null} data-group-remove-confirm="" onClick={() => remove.mutate()}>
            {t('groups.remove')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-group-remove-dialog={row.idfNumber}>
        {err ? (
          <div data-idf-group-remove-refusal="">
            <ErrorBanner className="p-3" title={t('groups.removeFailed')} message={isBareDenial(err) ? t('access.deniedTitle') : apiErrorMessage(err, t('groups.removeFailed'))}>
              {count != null && (
                <div className="mt-1 text-xs" data-refused-count={count}>
                  <Trans t={t} i18nKey="groups.refusedCount" count={count} values={{ n: formatFigure(count) }} components={{ v: <Ltr /> }} />
                </div>
              )}
            </ErrorBanner>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('groups.removeHint')}</p>
        )}
      </div>
    </Modal>
  )
}
