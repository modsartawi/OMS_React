import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { SearchX, ShieldAlert, type LucideIcon } from 'lucide-react'

import Ltr from '@/core/ui/Ltr'

/**
 * The cards a serving-list read shows in place of its content (oms tickets 567, 568, 571): "You do not have
 * access" on a bare 403, and "This serving list does not exist" on `SVL-00001`. One look for the lists page,
 * the Members tab and the History tab.
 */
function StateCard({ icon: Icon, title, hint, hook }: { icon: LucideIcon; title: string; hint: ReactNode; hook: string }) {
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <Icon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

/** A bare 403 on a read; `hook` names the `data-*` attribute the drives find it by (`lists-denied`, …). */
export function DeniedCard({ hook }: { hook: string }) {
  const { t } = useTranslation('serving-lists')
  return <StateCard icon={ShieldAlert} title={t('access.deniedTitle')} hint={t('access.deniedHint')} hook={hook} />
}

/** `SVL-00001`: no list has this id. */
export function NotFoundCard({ servingListId }: { servingListId: string }) {
  const { t } = useTranslation('serving-lists')
  return (
    <StateCard
      icon={SearchX}
      title={t('notFound.title')}
      hint={<Trans t={t} i18nKey="notFound.hint" values={{ id: servingListId }} components={{ v: <Ltr /> }} />}
      hook="list-not-found"
    />
  )
}
