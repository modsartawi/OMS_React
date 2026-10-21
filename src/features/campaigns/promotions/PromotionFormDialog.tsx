import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { RulePromotionRecord } from '@/core/models/rule-promotion'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { promotionWriteApi, refreshPromotions } from './api'
import { PROMOTION_NAME_MAX, promotionFormProblems, toPromotionBody, type PromotionForm, type PromotionFormProblem } from './promotion-write'
import WriteRefusal from './WriteRefusal'

const FORM_ID = 'promotion-form'

/**
 * New promotion and Rename (ticket 536; BackOffice brief 2848 D3), one dialog: the promotion code
 * (New only — its rule said beside it; Rename shows it, never edits it), the English name (required),
 * the Arabic name and the note → `Promotions/Create` or `Promotions/Update`. Rename sends every field
 * as it shows it (a null would keep HQ's, which the dialog never means), on a hand-made or an
 * uploaded promotion alike.
 *
 * A missing field is said once the button has been pressed (the code's own rule at once while it is
 * typed); a refusal shows inside, the form kept and the promotion as it was. Nothing here publishes
 * or asks approval: the write happens at once, and the promotions are read afresh.
 */
export default function PromotionFormDialog({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'rename'
  /** The fields to start from: empty for New, the promotion's own for Rename. */
  initial: PromotionForm
  onClose: () => void
  onSaved: (record: RulePromotionRecord) => void
}) {
  const { t } = useTranslation('campaign-promotions')
  const queryClient = useQueryClient()
  const [form, setForm] = useState(initial)
  const [tried, setTried] = useState(false)
  const renaming = mode === 'rename'
  const save = useMutation({
    mutationFn: (f: PromotionForm) => (renaming ? promotionWriteApi.update(toPromotionBody(f)) : promotionWriteApi.create(toPromotionBody(f))),
    // Read afresh after a refusal too (a taken code may be a promotion this list has not read yet), and
    // waited for: Create opens the new promotion's page from the list.
    onSettled: () => refreshPromotions(queryClient),
  })

  const problems = promotionFormProblems(form, { renaming })
  const codeProblem = problems.find((p) => p.startsWith('code.') && (tried || p !== 'code.required')) ?? null
  const shown = (p: PromotionFormProblem) => (tried && problems.includes(p) ? t(`form.problem.${p}`) : null)
  const set = (change: Partial<PromotionForm>) => {
    setForm((f) => ({ ...f, ...change }))
    // A refusal was about the form as it was sent; an edit makes it stale.
    if (save.isError) save.reset()
  }
  const close = () => !save.isPending && onClose()
  const submit = () => {
    setTried(true)
    if (problems.length || save.isPending) return
    save.mutate(form, { onSuccess: onSaved })
  }
  const keys = renaming ? 'rename' : 'newPromotion'

  return (
    <Modal
      open
      onClose={close}
      title={t(`${keys}.title`)}
      width="34rem"
      footer={
        <>
          <Button variant="text" disabled={save.isPending} onClick={close}>
            {t('form.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={save.isPending} data-promotion-form-submit="">
            {save.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t(`${keys}.submit`)}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-3"
        data-promotion-form={mode}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {!renaming && <p className="text-sm text-muted-foreground">{t('newPromotion.lede')}</p>}
        {renaming ? (
          <div className="flex flex-col gap-1" data-promotion-form-code="">
            <span className="text-xs font-medium text-muted-foreground">{t('form.code')}</span>
            <span className="font-mono text-sm font-medium">
              <Ltr>{form.promotionCode}</Ltr>
            </span>
            <span className="text-xs text-muted-foreground">{t('form.codeFixed')}</span>
          </div>
        ) : (
          <Field
            id="promotion-code"
            label={t('form.code')}
            placeholder={t('form.codePlaceholder')}
            hint={t('form.codeHint')}
            value={form.promotionCode}
            onChange={(promotionCode) => set({ promotionCode })}
            error={codeProblem ? t(`form.problem.${codeProblem}`) : null}
            dir="ltr"
            required
            data="promotionCode"
          />
        )}
        <Field
          id="promotion-name-en"
          label={t('form.nameEn')}
          placeholder={t('form.nameEnPlaceholder')}
          value={form.nameEn}
          onChange={(nameEn) => set({ nameEn })}
          error={shown('nameEnRequired')}
          dir="ltr"
          maxLength={PROMOTION_NAME_MAX}
          required
          data="nameEn"
        />
        <Field
          id="promotion-name-ar"
          label={t('form.nameAr')}
          placeholder={t('form.nameArPlaceholder')}
          value={form.nameAr}
          onChange={(nameAr) => set({ nameAr })}
          error={null}
          dir="rtl"
          maxLength={PROMOTION_NAME_MAX}
          data="nameAr"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="promotion-note" className="text-xs font-medium text-muted-foreground">
            {t('form.note')}
          </label>
          <textarea
            id="promotion-note"
            dir="auto"
            rows={3}
            value={form.note}
            placeholder={t('form.notePlaceholder')}
            onChange={(e) => set({ note: e.target.value })}
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-promotion-field="note"
          />
        </div>
        {save.isError && <WriteRefusal title={t(`${keys}.refusedTitle`)} error={save.error} />}
      </form>
    </Modal>
  )
}

function Field({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
  error,
  dir,
  maxLength,
  required = false,
  data,
}: {
  id: string
  label: string
  placeholder: string
  hint?: string
  value: string
  onChange: (value: string) => void
  error: string | null
  dir: 'ltr' | 'rtl'
  /** Names stop at HQ's clamp; the code has none, so a long one is said rather than cut. */
  maxLength?: number
  required?: boolean
  data: string
}) {
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        data-promotion-field={data}
        className={
          'h-9 w-full rounded-md border bg-background px-2.5 text-sm text-foreground focus:outline-none ' +
          (error ? 'border-danger-border focus:border-danger' : 'border-border/60 focus:border-primary/50')
        }
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger-800" data-promotion-problem={data}>
          {error}
        </p>
      )}
    </div>
  )
}
