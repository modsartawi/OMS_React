/* PROTOTYPE 371 · B — "083 carried forward": the shipped skeleton, re-skinned.
 * The identity band goes LIGHT (card ground + navy leading edge), the pill rail is
 * replaced by the stepper, the 083 D-10 command grammar stays (labelled clusters,
 * unlabelled terminal tier pinned to the end, nothing hidden, no More), the summary
 * rail stays at 340px, and the tabs become Items · Conditions · Activity (Log+Jobs
 * merged). Notes stay in 083 D-11's dialog — no composer. */
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Ban, CalendarClock, ChevronLeft, Flag, Plus, Reply, Store, XCircle } from 'lucide-react'
import type { ButtonVariant } from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import SummaryRail from '../SummaryRail'
import { bandCustomer } from '../fields'
import type { CommandKind } from '../actions'
import { failedJobs } from './derive'
import { AllStatuses, Cmd, ConditionsGrid, DueTag, FeedList, ItemsGrid, JobBanners, NowBadge, StepperH, SubIds, Tags, useFeed, type VariantProps } from './parts'

export const NAME = '083 carried forward — light band, stepper, tabs, nothing hidden'

const ICON: Record<CommandKind, typeof Plus> = {
  reschedule: CalendarClock, 'change-store': Store, 'request-close': Flag, 'cancel-close-request': Flag,
  'add-note': Plus, 'return-document': Reply, 'force-close': XCircle, close: Ban,
}
const CLUSTER: Record<string, ButtonVariant> = { fulfilment: 'fulfilment', 'cancel-request': 'cancel-request', notes: 'ghost' }
const HINT: Partial<Record<CommandKind, string>> = { reschedule: 'R', 'request-close': 'C', 'add-note': 'N' }

export default function VariantB(p: VariantProps) {
  const { t } = useTranslation('document')
  const { doc, bar } = p
  const [tab, setTab] = useState<'items' | 'conditions' | 'activity'>('items')
  const { items, toggle } = useFeed(p)
  const customer = bandCustomer(doc)
  const failed = failedJobs(p.jobs).length

  return (
    <div className="grid gap-2.5">
      <header className="relative overflow-hidden rounded-lg border border-border bg-card">
        <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-(--cursor)" />
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 pt-3 pb-2.5">
          <Link to="/oms/deliveries" aria-label={t('back')} title={`${t('back')} (Esc)`} className="mt-0.5 grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-accent">
            <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1 basis-80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-semibold tracking-tight">{doc.documentNo}</span>
              <NowBadge steps={p.steps} />
              <DueTag doc={doc} />
              <Tags doc={doc} />
            </div>
            <SubIds doc={doc} className="mt-1.5" />
          </div>
          {(customer.name || customer.contact) && (
            <div className="ms-auto text-end">
              <div className="text-sm font-semibold">{customer.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <Ltr>{customer.contact}</Ltr>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-start gap-4 border-t border-divider px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <StepperH steps={p.steps} />
          </div>
          <AllStatuses doc={doc} />
        </div>
      </header>

      <JobBanners jobs={p.jobs} showRetrySlot={p.showRetrySlot} />

      <section aria-label={t('command.title')} className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex flex-1 flex-wrap items-end gap-x-4 gap-y-3">
          {bar.clusters.map((cl) => (
            <div key={cl.id} className="flex flex-col gap-1">
              <span className="ps-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-ink-3">{cl.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {cl.commands.map((c) => {
                  const I = ICON[c.kind]
                  return <Cmd key={c.kind} c={c} variant={CLUSTER[cl.id]} onCommand={p.onCommand} refused={p.refused} hint={HINT[c.kind]} icon={<I className="h-3.5 w-3.5" />} label={t(`actions.${c.kind}`)} />
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="ms-auto flex flex-wrap gap-1.5">
          {bar.terminal.map((c) => {
            const I = ICON[c.kind]
            return <Cmd key={c.kind} c={c} variant={c.kind === 'close' ? 'danger' : 'danger-outlined'} onCommand={p.onCommand} refused={p.refused} icon={<I className="h-3.5 w-3.5" />} label={t(`actions.${c.kind}`)} />
          })}
        </div>
      </section>

      <div className="grid gap-2.5 rail:grid-cols-[340px_minmax(0,1fr)]">
        <SummaryRail document={doc} />
        <div className="min-w-0">
          <div role="tablist" className="flex gap-1 border-b border-border">
            {(
              [
                ['items', `Items`, doc.lines?.length ?? 0, false],
                ['conditions', 'Conditions', (doc.conditions ?? []).filter((c) => c.condDocumentLine === 0).length, false],
                ['activity', 'Activity', failed || items.length, failed > 0],
              ] as const
            ).map(([id, label, n, bad]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={'flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm ' + (tab === id ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
              >
                {label}
                <span className={'rounded-full px-1.5 text-xs tabular-nums ' + (bad ? 'bg-danger-050 text-danger-800' : 'bg-muted text-muted-foreground')} title={bad ? `${n} failed jobs` : undefined}>
                  {n}
                </span>
              </button>
            ))}
          </div>
          <div className="pt-2.5">
            <div hidden={tab !== 'items'}>
              <ItemsGrid doc={doc} />
            </div>
            <div hidden={tab !== 'conditions'}>
              <ConditionsGrid doc={doc} />
            </div>
            <div hidden={tab !== 'activity'} className="rounded-lg border border-border bg-card px-3 py-1">
              <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
                Log and Jobs, one list. Add a note with <b>Add note…</b> (N).
                <span className="ms-auto">{toggle}</span>
              </div>
              <FeedList items={items} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
