import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import type { ServingListRow } from '@/core/models/serving-list'
import Ltr from '@/core/ui/Ltr'
import { formatCount, fsi } from '@/core/util/bidi'
import { servingListsApi } from './api'
import { NAME_MAX, nameBody, nameCheck, type NameForm, type NameProblem } from './name-form'
import WriteDialog, { listName, useRefreshList } from './WriteDialog'
import { writeRefusal } from './write-refusal'

const FIELD = 'h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-primary/60'

/**
 * Create a list (`POST ServingListWeb/Lists`) or rename one (`PUT …/Lists/{id}/Name`) — oms ticket 570. Both
 * names required, at most 100 characters each (checked here, `SVL-00005` / `SVL-00006` mapped if the door
 * refuses anyway); the Arabic field is RTL. A rename with unchanged names cannot be saved (the door would log
 * nothing). A created list opens.
 */
export default function NameDialog({ list, onClose }: { list?: ServingListRow; onClose: () => void }) {
  const { t, i18n } = useTranslation('serving-lists')
  const navigate = useNavigate()
  const refresh = useRefreshList()
  const mode = list ? 'rename' : 'create'
  const [form, setForm] = useState<NameForm>({ nameEn: list?.nameEn ?? '', nameAr: list?.nameAr ?? '', note: '' })
  const [touched, setTouched] = useState({ en: false, ar: false })

  const send = useMutation({
    mutationFn: () => (list ? servingListsApi.rename(list.servingListId, nameBody(form)) : servingListsApi.create(nameBody(form))),
    onSuccess: (row) => {
      onClose()
      refresh(row.servingListId)
      toast.success(t(`writes.${mode}.done`, { name: fsi(listName(row, i18n.language)) }))
      if (!list) navigate(`/oms/serving-lists/${encodeURIComponent(row.servingListId)}`)
    },
    onError: (err) => {
      const r = writeRefusal(err)
      if (r.kind === 'refused' && r.stale && list) refresh(list.servingListId)
    },
  })

  const check = nameCheck(form, list)
  const refusal = send.isError ? writeRefusal(send.error) : null

  return (
    <WriteDialog
      hook={mode}
      title={t(`writes.${mode}.title`)}
      confirmLabel={t(`writes.${mode}.confirm`)}
      ready={check.ready}
      busy={send.isPending}
      refusal={refusal}
      note={form.note}
      onNote={(note) => setForm((f) => ({ ...f, note }))}
      onConfirm={() => send.mutate()}
      onClose={onClose}
    >
      <NameField
        label={t('writes.name.en')}
        value={form.nameEn}
        dir="ltr"
        problem={check.en}
        touched={touched.en}
        disabled={send.isPending}
        hook="en"
        onChange={(nameEn) => {
          setForm((f) => ({ ...f, nameEn }))
          setTouched((s) => ({ ...s, en: true }))
        }}
      />
      <NameField
        label={t('writes.name.ar')}
        value={form.nameAr}
        dir="rtl"
        lang="ar"
        problem={check.ar}
        touched={touched.ar}
        disabled={send.isPending}
        hook="ar"
        onChange={(nameAr) => {
          setForm((f) => ({ ...f, nameAr }))
          setTouched((s) => ({ ...s, ar: true }))
        }}
      />
      {mode === 'rename' && check.unchanged && (
        <p className="text-xs text-muted-foreground" data-name-unchanged="">
          {t('writes.name.unchanged')}
        </p>
      )}
      {mode === 'create' && <p className="text-xs text-muted-foreground">{t('writes.create.hint')}</p>}
    </WriteDialog>
  )
}

function NameField({
  label,
  value,
  dir,
  lang,
  problem,
  touched,
  disabled,
  hook,
  onChange,
}: {
  label: string
  value: string
  dir: 'ltr' | 'rtl'
  lang?: string
  problem: NameProblem | null
  touched: boolean
  disabled: boolean
  hook: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation('serving-lists')
  // "Required" only once the field was typed in; "too long" as soon as it is.
  const shown = problem === 'tooLong' || (problem === 'required' && touched) ? problem : null
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        <span className={'font-mono font-normal tabular-nums ' + (problem === 'tooLong' ? 'text-danger-800' : 'text-muted-foreground')}>
          <Ltr>{formatCount(value.trim().length, NAME_MAX)}</Ltr>
        </span>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        lang={lang}
        disabled={disabled}
        aria-invalid={shown !== null}
        className={FIELD}
        data-name-field={hook}
      />
      {shown && (
        <span role="alert" className="font-normal text-danger-800" data-name-problem={`${hook}:${shown}`}>
          {t(`writes.name.${shown}`)}
        </span>
      )}
    </label>
  )
}
