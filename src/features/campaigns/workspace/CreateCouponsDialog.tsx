import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import type { RuleCampaign, RuleCouponBatch } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCouponsKey } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { cleanCode } from '@/core/rules/coupon'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import {
  COUPON_CHARSETS,
  COUPON_KINDS,
  MAX_AFFIX,
  MAX_BATCH,
  MAX_LENGTH,
  MIN_LENGTH,
  cleanAffix,
  codeExample,
  couponCreateBody,
  couponCreateProblems,
  emptyCouponForm,
  memberIds,
  type CouponCreateForm,
  type CouponField,
} from './coupon-form'
import { Refusal, SETTINGS_CONTROL, SETTINGS_INPUT } from './settings-ui'

const FORM_ID = 'create-coupons-form'

/**
 * Create coupons (ticket 515; the prototype's `CouponCreate`): one batch of random codes, one
 * universal code, or one personal code per member, each with a validity in local days. HQ mints the
 * codes and the batch id; on success the dialog closes and the page shows the batch id.
 *
 * There are no redemption-limit fields (ADR 0094): a line says the limits are budgets and links to
 * Settings ▸ Budgets. A problem is said at its field once Create has been tried; HQ's refusal shows
 * in the dialog, verbatim, and the form is kept.
 */
export default function CreateCouponsDialog({
  campaign: c,
  taken,
  open,
  onClose,
  onCreated,
}: {
  campaign: RuleCampaign
  /** The codes the campaign has: a universal code may not repeat one. */
  taken: readonly string[]
  open: boolean
  onClose: () => void
  onCreated: (batch: RuleCouponBatch) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CouponCreateForm>(() => emptyCouponForm(c.code))
  const [tried, setTried] = useState(false)

  const create = useMutation({
    mutationFn: (body: NonNullable<ReturnType<typeof couponCreateBody>>) => ruleCampaignApi.createCoupons(c.id, body),
    // The list is read afresh BEFORE the page hears of the batch, so "Show the codes" finds it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleCouponsKey(c.id) }),
  })

  const problems = couponCreateProblems(form, taken)
  const problem = (field: CouponField) => (tried ? problems[field] : undefined)
  const set = (change: Partial<CouponCreateForm>) => {
    setForm((f) => ({ ...f, ...change }))
    // A refusal was about the form as it was sent; an edit makes it stale.
    if (create.isError) create.reset()
  }

  /** Back to a fresh form, so a reopened dialog never shows the last batch. */
  const clear = () => {
    setForm(emptyCouponForm(c.code))
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
    const body = couponCreateBody(form, taken)
    if (!body || create.isPending) return
    create.mutate(body, {
      onSuccess: (batch) => {
        clear()
        onCreated(batch)
      },
    })
  }

  const members = memberIds(form.members)
  const shaped = form.kind !== 'universal'

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
          <Field id="coupon-code" label={t('coupons.create.code')} problem={problem('code')}>
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
            values={{ max: MAX_BATCH }}
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

        {shaped && (
          <fieldset className="flex flex-col gap-3" data-coupon-shape="">
            <legend className="mb-2 text-sm font-semibold">{t('coupons.create.shape')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="coupon-prefix" label={t('coupons.create.prefix')} hint={t('coupons.create.affixHint', { max: fsi(MAX_AFFIX) })}>
                <input
                  id="coupon-prefix"
                  dir="ltr"
                  value={form.prefix}
                  onChange={(e) => set({ prefix: cleanAffix(e.target.value) })}
                  className={`${SETTINGS_INPUT} font-mono border-border/60`}
                  data-coupon-field="prefix"
                />
              </Field>
              <Field id="coupon-suffix" label={t('coupons.create.suffix')}>
                <input
                  id="coupon-suffix"
                  dir="ltr"
                  value={form.suffix}
                  onChange={(e) => set({ suffix: cleanAffix(e.target.value) })}
                  className={`${SETTINGS_INPUT} font-mono border-border/60`}
                  data-coupon-field="suffix"
                />
              </Field>
              <Field id="coupon-length" label={t('coupons.create.length')} problem={problem('length')} values={{ min: MIN_LENGTH, max: MAX_LENGTH }}>
                <input
                  id="coupon-length"
                  inputMode="numeric"
                  value={form.length}
                  onChange={(e) => set({ length: e.target.value })}
                  className={`${SETTINGS_INPUT} max-w-[8rem] ${problem('length') ? 'border-danger' : 'border-border/60'}`}
                  data-coupon-field="length"
                />
              </Field>
              <Field id="coupon-charset" label={t('coupons.create.charset')}>
                <select
                  id="coupon-charset"
                  value={form.charset}
                  onChange={(e) => set({ charset: e.target.value as CouponCreateForm['charset'] })}
                  className={SETTINGS_CONTROL}
                  data-coupon-field="charset"
                >
                  {COUPON_CHARSETS.map((cs) => (
                    <option key={cs} value={cs}>
                      {t(`coupons.create.charsets.${cs}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-sm text-muted-foreground" data-coupon-example="">
              <Trans t={t} i18nKey="coupons.create.example" values={{ code: codeExample(form) }} components={{ code: <bdi className="font-mono text-foreground" dir="ltr" /> }} />
            </p>
          </fieldset>
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

        <p className="rounded-md border border-border/60 bg-muted px-3 py-2 text-sm" data-coupon-limits="">
          <Trans
            t={t}
            i18nKey="coupons.create.limits"
            components={{ budgets: <Link to={`${campaignPath(c.id)}/settings/budgets`} className="font-medium text-primary hover:underline" data-coupon-budgets-link="" /> }}
          />
        </p>

        {create.isError && (
          <div data-coupons-create-refusal="">
            <Refusal title={t('coupons.create.refusedTitle')} fallback={t('coupons.create.refused')} error={create.error} />
          </div>
        )}
      </form>
    </Modal>
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
