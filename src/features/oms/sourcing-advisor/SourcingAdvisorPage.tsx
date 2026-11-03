import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { canViewSourcingAdvisor, sourcingAdvisorAccessQuery } from '@/core/sourcing-advisor/access'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import { explainPath } from './paths'

/**
 * The sourcing advisor's entry (ticket 738, spec 734 D21): the menu leaf's target. In this slice it
 * opens one order's explanation by its number; ticket 739 puts the 30-day simulation here, and its
 * top orders drill into the same explanation.
 *
 * Behind `canViewSourcingAdvisor`, the predicate the menu leaf and Delivery details' link read.
 */
export default function SourcingAdvisorPage() {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <ScreenGate query={sourcingAdvisorAccessQuery()} can={canViewSourcingAdvisor} ns="sourcing-advisor" title={t('title')} subtitle={t('subtitle')}>
      <Lookup />
    </ScreenGate>
  )
}

function Lookup() {
  const { t } = useTranslation('sourcing-advisor')
  const navigate = useNavigate()
  const [orderNo, setOrderNo] = useState('')
  const trimmed = orderNo.trim()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (trimmed !== '') void navigate(explainPath(trimmed))
  }
  return (
    <form className="flex max-w-md flex-col gap-1" onSubmit={submit} data-sourcing-lookup="">
      <div className="flex items-end gap-2">
        <Field label={t('lookup.label')} className="flex-1">
          <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} inputMode="numeric" dir="ltr" />
        </Field>
        <Button type="submit" disabled={trimmed === ''}>
          {t('lookup.open')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('lookup.hint')}</p>
    </form>
  )
}
