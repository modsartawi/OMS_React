/* PROTOTYPE 371 · A — "Far as drawn": the Ops Console prototype's record page on B tokens.
 * Light header with the commands at its end and the destructive pair inside More ▾
 * (Far's own risk note: a behaviour change vs 083 D-10 "nothing hidden");
 * full-width stepper; per-job banners; stacked sections + a sticky Activity column
 * (feed + composer). */
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Ban, CalendarClock, ChevronLeft, Flag, MoreHorizontal, Plus, Reply, Store, XCircle } from 'lucide-react'
import {
  AllStatuses, Cmd, Composer, ConditionsGrid, DueTag, FactList, FeedList, H, ItemsGrid, JobBanners, NowBadge,
  StepperH, SubIds, Tags, findCmd, useFacts, useFeed, type VariantProps,
} from './parts'

export const NAME = 'Far as drawn — sections + Activity column, destructive in More'

export default function VariantA(p: VariantProps) {
  const { t } = useTranslation('document')
  const { doc, bar } = p
  const [more, setMore] = useState(false)
  const facts = useFacts(doc)
  const card = (k: string) => facts.find((c) => c.key === k)
  const { items, toggle } = useFeed(p)
  const c = (k: Parameters<typeof findCmd>[1]) => findCmd(bar, k)!

  return (
    <div className="grid gap-2.5">
      {/* header — a light card, never a dark slab beside the navy rail */}
      <header className="grid gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/oms/deliveries" aria-label={t('back')} title={`${t('back')} (Esc)`} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-accent">
            <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Link>
          <span className="font-mono text-xl font-semibold tracking-tight">{doc.documentNo}</span>
          <NowBadge steps={p.steps} />
          <DueTag doc={doc} />
          <Tags doc={doc} />
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <Cmd c={c('reschedule')} variant="fulfilment" onCommand={p.onCommand} refused={p.refused} hint="R" icon={<CalendarClock className="h-3.5 w-3.5" />} label={t('actions.reschedule')} />
            <Cmd c={c('change-store')} variant="outlined" onCommand={p.onCommand} refused={p.refused} icon={<Store className="h-3.5 w-3.5" />} label={t('actions.change-store')} />
            <Cmd c={c('request-close')} variant="cancel-request" onCommand={p.onCommand} refused={p.refused} hint="C" icon={<Flag className="h-3.5 w-3.5" />} label={t('actions.request-close')} />
            <span className="relative">
              <button
                type="button"
                aria-expanded={more}
                aria-label="More commands"
                onClick={() => setMore((v) => !v)}
                className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-accent"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
              {more && (
                <div role="menu" className="absolute end-0 z-30 mt-1 grid w-52 rounded-lg border border-border bg-card p-1 text-[0.8125rem] shadow-[0_10px_30px_rgb(16_24_40/.16)]" onClick={() => setMore(false)}>
                  {[
                    { k: 'add-note' as const, icon: Plus, label: `${t('actions.add-note')} (N)` },
                    { k: 'return-document' as const, icon: Reply, label: t('actions.return-document') },
                  ].map(({ k, icon: I, label }) => (
                    <button key={k} role="menuitem" type="button" disabled={!!c(k).reason} title={c(k).reason ?? undefined} onClick={() => p.onCommand(k)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-accent disabled:opacity-50">
                      <I className="h-3.5 w-3.5" aria-hidden /> {label}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  {[
                    { k: 'force-close' as const, icon: XCircle },
                    { k: 'close' as const, icon: Ban },
                  ].map(({ k, icon: I }) => (
                    <button key={k} role="menuitem" type="button" onClick={() => p.onCommand(k)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-danger-800 hover:bg-danger-050">
                      <I className="h-3.5 w-3.5" aria-hidden /> {t(`actions.${k}`)}
                    </button>
                  ))}
                </div>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 ps-9">
          <SubIds doc={doc} />
          <span className="ms-auto">
            <AllStatuses doc={doc} />
          </span>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <StepperH steps={p.steps} />
      </div>

      <JobBanners jobs={p.jobs} showRetrySlot={p.showRetrySlot} />

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-2.5">
          <section className="rounded-lg border border-border bg-card p-3">
            <H>Customer &amp; delivery</H>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-3">
              {(['customer', 'fulfilment', 'driver'] as const).map((k) =>
                card(k) ? (
                  <div key={k} className="min-w-0">
                    <h4 className="mb-1 text-xs font-semibold">{card(k)!.title}</h4>
                    <FactList rows={card(k)!.rows} />
                  </div>
                ) : null,
              )}
            </div>
          </section>
          {card('prescription') && (
            <section className="rounded-lg border border-border bg-card p-3">
              <H dot="bg-prescription">{card('prescription')!.title}</H>
              <FactList rows={card('prescription')!.rows} cols="grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]" />
            </section>
          )}
          <section className="rounded-lg border border-border bg-card p-3">
            <H end={<span className="text-xs text-ink-3">Deleted lines stay visible, struck through</span>}>
              Items · {doc.lines?.length ?? 0}
            </H>
            <ItemsGrid doc={doc} />
          </section>
          <section className="grid gap-2.5 rounded-lg border border-border bg-card p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0">
              <H>Pricing conditions</H>
              <ConditionsGrid doc={doc} />
            </div>
            {card('payment') && (
              <div>
                <H>{card('payment')!.title}</H>
                <FactList rows={card('payment')!.rows} />
              </div>
            )}
          </section>
        </div>

        <aside aria-label="Activity" className="sticky top-2 grid max-h-[calc(100vh-7rem)] grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <h3 className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">Activity</h3>
            <span className="rounded bg-muted px-1.5 text-[0.625rem] text-muted-foreground">log + jobs</span>
            <span className="ms-auto">{toggle}</span>
          </div>
          <div className="overflow-y-auto px-3 py-1">
            <FeedList items={items} />
          </div>
          <div className="border-t border-border p-3">
            <Composer p={p} autoFocusHint />
          </div>
        </aside>
      </div>
    </div>
  )
}
