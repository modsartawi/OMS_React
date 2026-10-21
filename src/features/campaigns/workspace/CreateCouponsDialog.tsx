import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import type { RuleCampaign, RuleCouponBatchCreated } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCouponBatchesKey } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { cleanCode } from '@/core/rules/coupon'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import {
  COUPON_KINDS,
  MAX_BATCH,
  MAX_CODE,
  MAX_MEMBER,
  MAX_TEMPLATE,
  couponCreateBody,
  couponCreateProblems,
  emptyCouponForm,
  limitsCovered,
  memberIds,
  type CouponCreateForm,
  type CouponField,
} from './coupon-form'
import { Refusal, SETTINGS_CONTROL, SETTINGS_INPUT } from './settings-ui'
import { useWorkspace } from './context'

const FORM_ID = 'create-coupons-form'

/**
 * Create coupons (tickets 515, 526; the prototype's `CouponCreate`): one batch of random codes, one
 * universal code, or one personal code per member, under the campaign's coupon template
 * (`CouponBatches/Create`), each with a validity in local days. HQ mints the codes — shaped by the
 * template — and the batch id; on success the dialog closes and the page shows the batch id.
 *
 * The template id is typed: HQ names no door for a campaign's template, so it starts from the
 * newest batch's. The codes carry no redemption limit (ADR 0094): "each code once" and "once per
 * customer" are boxes HQ answers as budgets, which the page adds to the draft; a box a budget already
 * does shows ticked and is not sent. A problem is said at its field once Create has been tried; HQ's
 * refusal shows in the dialog, verbatim, and the form is kept.
 */
export default function CreateCouponsDialog({
  campaign: c,
  templateId,
  open,
  onClose,
  onCreated,
}: {
  campaign: RuleCampaign
  /** The template a new batch starts from (the newest batch's, or ''). */
  templateId: string
  open: boolean
  onClose: () => void
  onCreated: (batch: RuleCouponBatchCreated) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const { link } = useWorkspace()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CouponCreateForm>(() => emptyCouponForm(templateId))
  const [tried, setTried] = useState(false)
  const covered = limitsCovered(c.budgets)

  const create = useMutation({
    mutationFn: (body: NonNullable<ReturnType<typeof couponCreateBody>>) => ruleCampaignApi.createBatch(body),
    // The batches are read afresh BEFORE the page hears of the batch, so "Show the codes" finds it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleCouponBatchesKey(c.id) }),
  })

  const problems = couponCreateProblems(form)
  const problem = (field: CouponField) => (tried ? problems[field] : undefined)
  const set = (change: Partial<CouponCreateForm>) => {
    setForm((f) => ({ ...f, ...change }))
    // A refusal was about the form as it was sent; an edit makes it stale.
    if (create.isError) create.reset()
  }

  /** Back to a fresh form, so a reopened dialog never shows the last batch. A template typed here
   *  is kept until the batches are read again, which names it. */
  const clear = () => {
    setForm((f) => emptyCouponForm(templateId || f.templateId.trim()))
    setTried(false)
    create.reset()
  }
  const close = () => {
    if (create.isPending) return
    clear()
    onClose()
  }
  const submit = () => {
    setTried(true)
    const body = couponCreateBody(form, covered)
    if (!body || create.isPending) return
    create.mutate(body, {
      onSuccess: (batch) => {
        clear()
        onCreated(batch)
      },
    })
  }

  const members = memberIds(form.members)

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('coupons.create.title')}
      width="40rem"
      footer={
        <>
          <Button variant="text" disabled={create.isPending} onClick={close}>
            {t('coupons.create.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={create.isPending} data-coupons-create-submit="">
            {create.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('coupons.create.submit')}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-4"
        noValidate
        data-coupons-create=""
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div role="radiogroup" aria-label={t('coupons.create.kindLabel')} className="flex flex-wrap gap-1" data-coupon-kinds="">
          {COUPON_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={form.kind === kind}
              disabled={create.isPending}
              onClick={() => set({ kind })}
              data-coupon-kind={kind}
              className={
                'rounded-md border px-3 py-1.5 text-sm transition-colors ' +
                (form.kind === kind ? 'border-primary-border bg-primary-050 font-medium text-primary-800' : 'border-border/60 text-foreground hover:bg-accent')
              }
            >
              {t(`coupons.create.kinds.${kind}.label`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground" data-coupon-kind-intro={form.kind}>
          {t(`coupons.create.kinds.${form.kind}.intro`)}
        </p>

        <Field id="coupon-template" label={t('coupons.create.template')} problem={problem('templateId')} values={{ max: MAX_TEMPLATE }} hint={t('coupons.create.templateHint')}>
          <input
            id="coupon-template"
            dir="ltr"
            value={form.templateId}
            onChange={(e) => set({ templateId: e.target.value })}
            className={`${SETTINGS_INPUT} max-w-xs font-mono ${problem('templateId') ? 'border-danger' : 'border-border/60'}`}
            data-coupon-field="templateId"
          />
        </Field>

        {form.kind === 'random' && (
          <Field id="coupon-count" label={t('coupons.create.count')} problem={problem('count')} values={{ max: MAX_BATCH }}>
            <input
              id="coupon-count"
              inputMode="numeric"
              value={form.count}
              onChange={(e) => set({ count: e.target.value })}
              className={`${SETTINGS_INPUT} max-w-[10rem] ${problem('count') ? 'border-danger' : 'border-border/60'}`}
              data-coupon-field="count"
            />
          </Field>
        )}

        {form.kind === 'universal' && (
          <Field id="coupon-code" label={t('coupons.create.code')} problem={problem('code')} values={{ max: MAX_CODE }} hint={form.code ? undefined : t('coupons.create.codeHint')}>
            <input
              id="coupon-code"
              dir="ltr"
              value={form.code}
              onChange={(e) => set({ code: cleanCode(e.target.value) })}
              placeholder={t('coupons.create.codePlaceholder')}
              className={`${SETTINGS_INPUT} font-mono ${problem('code') ? 'border-danger' : 'border-border/60'}`}
              data-coupon-field="code"
            />
          </Field>
        )}

        {form.kind === 'personal' && (
          <Field
            id="coupon-members"
            label={t('coupons.create.members')}
            problem={problem('members')}
            values={{ max: MAX_BATCH, width: MAX_MEMBER }}
            hint={
              members.ids.length > 0 && (
                <span data-coupon-members-count="">
                  <Trans t={t} i18nKey="coupons.create.membersReady" count={members.ids.length} values={{ n: members.ids.length }} components={{ n: <Ltr /> }} />
                  {members.repeated > 0 && (
                    <>
                      {' '}
                      <Trans t={t} i18nKey="coupons.create.membersRepeated" count={members.repeated} values={{ n: members.repeated }} components={{ n: <Ltr /> }} />
                    </>
                  )}
                </span>
              )
            }
          >
            <textarea
              id="coupon-members"
              dir="ltr"
              rows={4}
              value={form.members}
              onChange={(e) => set({ members: e.target.value })}
              placeholder={t('coupons.create.membersPlaceholder')}
              className={`w-full max-w-md rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm text-foreground focus:outline-none ${problem('members') ? 'border-danger' : 'border-border/60'}`}
              data-coupon-field="members"
            />
          </Field>
        )}

        <fieldset className="flex flex-col gap-3" data-coupon-validity="">
          <legend className="mb-2 text-sm font-semibold">{t('coupons.create.validity')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="coupon-from" label={t('coupons.create.from')} problem={problem('from')} hint={form.from ? undefined : t('coupons.create.fromHint')}>
              <input
                id="coupon-from"
                type="date"
                value={form.from}
                onChange={(e) => set({ from: e.target.value })}
                className={SETTINGS_CONTROL}
                data-coupon-field="from"
              />
            </Field>
            <Field id="coupon-until" label={t('coupons.create.until')} problem={problem('until')} hint={form.until ? undefined : t('coupons.create.untilHint')}>
              <input
                id="coupon-until"
                type="date"
                value={form.until}
                onChange={(e) => set({ until: e.target.value })}
                className={SETTINGS_CONTROL}
                data-coupon-field="until"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t('coupons.create.validityNote')}</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted px-3 py-2" data-coupon-limits="">
          <legend className="px-1 text-sm font-semibold">{t('coupons.create.limitsTitle')}</legend>
          <p className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey="coupons.create.limits"
              components={{ budgets: <Link to={link(`${campaignPath(c.id)}/settings/budgets`)} className="font-medium text-primary hover:underline" data-coupon-budgets-link="" /> }}
            />
          </p>
          {form.kind !== 'universal' ? (
            <Limit
              name="eachCodeOnce"
              label={t('coupons.create.eachCodeOnce')}
              covered={covered.eachCodeOnce}
              coveredNote={t('coupons.create.eachCodeOnceCovered')}
              checked={form.eachCodeOnce}
              disabled={create.isPending}
              onChange={(eachCodeOnce) => set({ eachCodeOnce })}
            />
          ) : (
            <p className="text-sm" data-coupon-universal-limit="">
              {t('coupons.create.universalLimit')}
            </p>
          )}
          <Limit
            name="oncePerCustomer"
            label={t('coupons.create.oncePerCustomer')}
            covered={covered.oncePerCustomer}
            coveredNote={t('coupons.create.oncePerCustomerCovered')}
            checked={form.oncePerCustomer}
            disabled={create.isPending}
            onChange={(oncePerCustomer) => set({ oncePerCustomer })}
          />
        </fieldset>

        {create.isError && (
          <div data-coupons-create-refusal="">
            <Refusal title={t('coupons.create.refusedTitle')} fallback={t('coupons.create.refused')} error={create.error} />
          </div>
        )}
      </form>
    </Modal>
  )
}

/** One of the dialog's limits: a box, ticked and fixed when a budget of the campaign already does it. */
function Limit({
  name,
  label,
  covered,
  coveredNote,
  checked,
  disabled,
  onChange,
}: {
  name: 'eachCodeOnce' | 'oncePerCustomer'
  label: string
  covered: boolean
  coveredNote: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <input type="checkbox" checked={checked || covered} disabled={disabled || covered} onChange={(e) => onChange(e.target.checked)} data-coupon-limit={name} />
      <span>{label}</span>
      {covered && (
        <span className="text-xs text-muted-foreground" data-coupon-limit-covered={name}>
          {coveredNote}
        </span>
      )}
    </label>
  )
}

/** A label above its control; below it, the field's problem once Create was tried, else its hint. */
function Field({
  id,
  label,
  problem,
  values,
  hint,
  children,
}: {
  id: string
  label: string
  problem?: string
  /** The bounds a problem's sentence names. */
  values?: Record<string, number>
  hint?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {problem ? (
        <p className="text-xs text-danger" role="alert" data-coupon-problem={problem}>
          {/* Each bound is a machine value inside a sentence: isolated whole (bidi rule). */}
          {t(`coupons.create.problems.${problem}`, Object.fromEntries(Object.entries(values ?? {}).map(([k, v]) => [k, fsi(v)])))}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
