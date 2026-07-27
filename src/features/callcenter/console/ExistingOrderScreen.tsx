/**
 * The already-open screen (ticket 163) — the console drawing a **choice**, not a
 * failure.
 *
 * `OpenResult.outcome = 'refusedExisting'` arrives on the success path (§8.1):
 * one active order per agent (law 9), and which one survives is the agent's
 * call. So this screen is full-viewport and carries exactly what the choice
 * needs — the previous caller's name, the line count, when it was opened, and
 * the fulfilment store — with two explicit actions, and the ways home the
 * chrome-less route owes every non-console state (134 §8, `ConsoleCard`).
 *
 * 🚩 **No basket is rendered behind it.** An agent who has just picked up a new
 * caller must not inherit the previous caller's basket (127), and the surest way
 * to guarantee that is for the previous basket never to be on screen at all.
 * This screen renders `ExistingOrder` — four fields off the refusal — and never
 * a `SessionState`; resuming *fetches* the order it decided to resume.
 *
 * It is also the **reconnect** surface: a refresh, a crash, a closed tab and a
 * second device all land here, which is why it reads as an ordinary junction
 * rather than as an error. Recovery is a path the agent already knows.
 */
import { useTranslation } from 'react-i18next'
import type { ExistingOrder } from '@/core/models/callcenter'
import ConsoleCard from './ConsoleCard'
import { openedAtLabel } from './open-outcome'

export default function ExistingOrderScreen({
  existing,
  onResume,
  onStartFresh,
  resuming,
  resumeError,
}: {
  existing: ExistingOrder
  onResume: () => void
  /** Opens the confirmation; the abandon-then-open pair is the page's. */
  onStartFresh: () => void
  resuming: boolean
  /**
   * A resume that failed to read the order back. It is shown **here**, on the
   * choice screen, rather than on a card of its own: a failed resume must leave
   * *abandon and start fresh* reachable, or the agent is left with neither an
   * order nor a way to get one (163's Done-when).
   */
  resumeError: string | null
}) {
  const { t } = useTranslation('callcenter')
  // Read at render: what "today" means is a property of when the agent is
  // looking, and this screen is drawn once per arrival on it.
  // An unusable timestamp says so. This is the field the staleness judgement
  // actually rests on, and a silent blank reads as a rendering slip rather than
  // as "we do not know when this was opened".
  const opened = openedAtLabel(existing.openedAt, new Date()) || t('existing.openedUnknown')

  return (
    <ConsoleCard
      tone="attention"
      marker="existing"
      width="max-w-lg"
      actions={
        // Two actions, both explicit, and neither reachable by accident:
        // resuming is one deliberate click, abandoning is a click plus the
        // confirmation that names what it voids.
        <>
          <button
            type="button"
            onClick={onResume}
            disabled={resuming}
            data-cc-resume
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {resuming ? t('existing.resuming') : t('existing.resume')}
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            disabled={resuming}
            data-cc-start-fresh
            className="rounded-md border border-danger-border px-4 py-2 text-sm font-medium text-danger-800 hover:bg-danger-050 disabled:opacity-50"
          >
            {t('existing.startFresh')}
          </button>
        </>
      }
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-attention-800">
        {t('existing.marker')}
      </div>
      {/* The caller's name is the fact the choice actually turns on — it is the
          heading, not a detail row. A `null` name is its own sentence rather
          than an empty slot: an order with nobody attached is a real state, and
          printing "for —" would read as data loss. */}
      <h1 className="mb-4 text-lg font-semibold" data-cc-existing-title>
        {existing.customerName
          ? t('existing.titleNamed', { name: existing.customerName })
          : t('existing.titleAnonymous')}
      </h1>

      <dl className="mb-5 grid grid-cols-3 gap-3 rounded-md bg-muted p-3 text-sm">
        <Fact label={t('existing.lines')} value={String(existing.lineCount)} marker="lines" />
        <Fact label={t('existing.opened')} value={opened} marker="opened" />
        <Fact label={t('existing.store')} value={existing.plant} marker="store" />
      </dl>

      <p className="text-sm text-muted-foreground">{t('existing.note')}</p>

      {resumeError && (
        <p
          className="mt-4 rounded-md border border-danger-border bg-danger-050 p-2 text-sm text-danger-800"
          data-cc-resume-error
        >
          {resumeError}
        </p>
      )}
    </ConsoleCard>
  )
}

function Fact({ label, value, marker }: { label: string; value: string; marker: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {/* Tabular figures — a clock time and a store code are both figure
          surfaces, and proportional digits make three of them fail to line up. */}
      <dd data-numeric className="font-medium" data-cc-existing={marker}>
        {value}
      </dd>
    </div>
  )
}
