import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ApiError } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { notify } from '@/core/services/notify'
import type { CouponTemplate } from '@/core/models/coupons'
import { couponsApi } from './api'

// Templates workspace (ticket 520): a load-then-edit form over the 517 endpoints.
// `Load` fills from GET Templates/{id}; `Save` = create (POST) when blank / update (PUT)
// when loaded. The Template ID is editable only on create; MaxRedemptions*/CodePrefix
// are immutable after create (the update DTO omits them), so they lock once loaded.
// Business failures surface as a toast from the server message + CUP-* code.
// The material is the operator's own COUP number on create AND edit (ADR 0051): the server keeps it
// as typed, creates it as a redeem-only coupon item when absent, and makes an existing hand-keyable
// coupon redeem-only. It refuses an empty / non-COUP number or one held by a non-coupon item.

interface FormState {
  templateId: string
  materialNumber: string
  description: string
  maxRedemptionsPerCode: string
  maxRedemptionsTotal: string
  codePrefix: string
  validFrom: string
  validTo: string
  originFilter: string
  isDisabled: boolean
}

const BLANK: FormState = {
  templateId: '',
  materialNumber: '',
  description: '',
  maxRedemptionsPerCode: '1',
  maxRedemptionsTotal: '0',
  codePrefix: '',
  validFrom: '',
  validTo: '',
  originFilter: '',
  isDisabled: false,
}

// The till keys coupon handling off this prefix; the server refuses any other material.
const COUPON_PREFIX = 'COUP'

const datePart = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const intOr = (v: string, fallback = 0) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function toForm(tpl: CouponTemplate): FormState {
  return {
    templateId: tpl.templateId,
    materialNumber: tpl.materialNumber,
    description: tpl.description,
    maxRedemptionsPerCode: String(tpl.maxRedemptionsPerCode),
    maxRedemptionsTotal: String(tpl.maxRedemptionsTotal),
    codePrefix: tpl.codePrefix,
    validFrom: datePart(tpl.validFrom),
    validTo: datePart(tpl.validTo),
    originFilter: tpl.originFilter,
    isDisabled: tpl.isDisabled,
  }
}

export default function TemplatesWorkspace() {
  const { t } = useTranslation('coupons')

  const [form, setForm] = useState<FormState>(BLANK)
  // The loaded template (edit mode) — null means create mode.
  const [loaded, setLoaded] = useState<CouponTemplate | null>(null)
  const [loadId, setLoadId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)

  const isEdit = loaded !== null
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function newTemplate() {
    setForm(BLANK)
    setLoaded(null)
    setNotFound(null)
  }

  async function load() {
    const id = loadId.trim()
    if (!id || loading) return
    setLoading(true)
    setNotFound(null)
    try {
      const tpl = await couponsApi.getTemplate(id)
      setLoaded(tpl)
      setForm(toForm(tpl))
    } catch (err) {
      // 404 (CUP-09011) is an inline "not found", not a toast — the rest is a toast.
      if (err instanceof ApiError && err.statusCode === 404) {
        setLoaded(null)
        setNotFound(id)
      } else {
        notify.apiError(t('templates.loadFailed'), err)
      }
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (saving) return
    const id = form.templateId.trim()
    if (!id) {
      notify.warn(t('templates.idRequired'))
      return
    }
    const material = form.materialNumber.trim().toUpperCase()
    if (!material.startsWith(COUPON_PREFIX) || material.length === COUPON_PREFIX.length) {
      notify.warn(t('templates.materialInvalid'))
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        const updated = await couponsApi.updateTemplate(id, {
          templateId: id,
          materialNumber: material,
          description: form.description.trim(),
          isDisabled: form.isDisabled,
          validFrom: form.validFrom || null,
          validTo: form.validTo || null,
          originFilter: form.originFilter.trim(),
        })
        setLoaded(updated)
        setForm(toForm(updated))
        notify.success(t('templates.updated', { id }))
      } else {
        const created = await couponsApi.createTemplate({
          templateId: id,
          materialNumber: material,
          description: form.description.trim(),
          maxRedemptionsPerCode: intOr(form.maxRedemptionsPerCode),
          maxRedemptionsTotal: intOr(form.maxRedemptionsTotal),
          codePrefix: form.codePrefix.trim(),
          validFrom: form.validFrom || null,
          validTo: form.validTo || null,
          originFilter: form.originFilter.trim(),
        })
        // Flip to edit mode on the freshly-created template.
        setLoaded(created)
        setForm(toForm(created))
        notify.success(t('templates.created', { id }))
      }
    } catch (err) {
      notify.apiError(t('templates.saveFailed'), err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Load bar */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('templates.loadLabel')}
          <input
            type="text"
            className="w-56 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
            value={loadId}
            placeholder={t('templates.loadPlaceholder')}
            onChange={(e) => setLoadId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
        </label>
        <Button variant="secondary" onClick={() => void load()} disabled={!loadId.trim() || loading}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('templates.load')}
        </Button>
        <Button variant="outlined" onClick={newTemplate}>
          {t('templates.new')}
        </Button>
        <div className="ms-auto text-xs text-muted-foreground">
          {isEdit ? t('templates.editingBadge', { id: loaded!.templateId }) : t('templates.creatingBadge')}
        </div>
      </div>

      {notFound && <ErrorBanner message={t('templates.notFound', { id: notFound })} className="p-3" />}

      {/* Edit form */}
      <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-card p-4 sm:grid-cols-2" disabled={saving}>
        <Field label={t('templates.fields.templateId')}>
          <input
            type="text"
            className={inputCls}
            value={form.templateId}
            disabled={isEdit}
            maxLength={26}
            onChange={(e) => set('templateId', e.target.value)}
          />
        </Field>
        <Field label={t('templates.fields.materialNumber')} hint={t('templates.materialHint')}>
          <input
            type="text"
            className={`${inputCls} font-mono`}
            value={form.materialNumber}
            maxLength={26}
            placeholder="COUP01"
            onChange={(e) => set('materialNumber', e.target.value.toUpperCase())}
          />
        </Field>

        <Field label={t('templates.fields.description')} className="sm:col-span-2">
          <input type="text" className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <Field label={t('templates.fields.maxPerCode')}>
          <input
            type="number"
            inputMode="numeric"
            className={inputCls}
            value={form.maxRedemptionsPerCode}
            disabled={isEdit}
            onChange={(e) => set('maxRedemptionsPerCode', e.target.value)}
          />
        </Field>
        <Field label={t('templates.fields.maxTotal')}>
          <input
            type="number"
            inputMode="numeric"
            className={inputCls}
            value={form.maxRedemptionsTotal}
            disabled={isEdit}
            onChange={(e) => set('maxRedemptionsTotal', e.target.value)}
          />
        </Field>

        <Field label={t('templates.fields.codePrefix')}>
          <input
            type="text"
            className={inputCls}
            value={form.codePrefix}
            disabled={isEdit}
            onChange={(e) => set('codePrefix', e.target.value)}
          />
        </Field>
        <Field label={t('templates.fields.originFilter')}>
          <input type="text" className={inputCls} value={form.originFilter} onChange={(e) => set('originFilter', e.target.value)} />
        </Field>

        <Field label={t('templates.fields.validFrom')}>
          <input type="date" className={inputCls} value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
        </Field>
        <Field label={t('templates.fields.validTo')}>
          <input type="date" className={inputCls} value={form.validTo} onChange={(e) => set('validTo', e.target.value)} />
        </Field>

        {isEdit && (
          <>
            <label className="flex items-center gap-2 self-end text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.isDisabled}
                onChange={(e) => set('isDisabled', e.target.checked)}
              />
              {t('templates.fields.isDisabled')}
            </label>
            <div className="self-end text-xs text-muted-foreground">
              {t('templates.redeemedSoFar', { count: loaded!.totalRedemptionCount })}
            </div>
          </>
        )}
      </fieldset>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? t('templates.save') : t('templates.create')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {isEdit ? t('templates.saveHint') : t('templates.createHint')}
        </span>
      </div>
    </div>
  )
}

const inputCls =
  'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary disabled:opacity-60'

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-muted-foreground ${className}`}>
      {label}
      {children}
      {hint && <span className="font-normal">{hint}</span>}
    </label>
  )
}
