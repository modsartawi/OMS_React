import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Ban,
  CalendarClock,
  Flag,
  Plus,
  Reply,
  Store,
  Undo2,
  XCircle,
} from 'lucide-react'
import Button, { type ButtonVariant } from '@/core/ui/Button'
import type { CommandKind } from './actions'
import {
  commandBar,
  type ClusterId,
  type CommandContext,
  type CommandState,
  type TerminalKind,
} from './commands'

/**
 * Screen 2's action bar (spec 083 D-10, ticket 094).
 *
 * A bar with a **grammar**: three labelled clusters in order of increasing
 * consequence — which is also reading order — with the destructive pair pinned
 * at the end as a **tier, not a commit**.
 *
 * Purely presentational. The clusters, their membership and the two gates are
 * `commands.ts`; this file paints them and reports a triggered command. The
 * parent opens the dialog, posts and refreshes.
 *
 * Three structural rules this file exists to hold:
 *
 * - **The promoted-commit slot is permanently empty.** The terminal pair is the
 *   same `h-7` as every cluster button and is never enlarged — no command on
 *   this screen is a positive outcome, and enlarging Cancel Order would put a
 *   destructive mutation in the Save/Submit position.
 * - **The escape slot stays empty too.** Back is the identity band's chevron; a
 *   page is not a modal. Back top-start, Cancel Order bottom-end, as far apart
 *   as the page allows.
 * - **Nothing is ever hidden, and no `More ▾`.** Below the width where three
 *   clusters fit, the cluster group WRAPS and the terminal pair stays pinned to
 *   the end.
 */

/** The icon per command. No check mark anywhere: nothing here is a happy ending. */
const ICONS: Record<CommandKind, typeof Plus> = {
  reschedule: CalendarClock,
  'change-store': Store,
  'request-close': Flag,
  'cancel-close-request': Undo2,
  'add-note': Plus,
  'return-document': Reply,
  'force-close': XCircle,
  close: Ban,
}

/** Colour carries function, not stakes — one variant per cluster (072). */
const CLUSTER_VARIANT: Record<ClusterId, ButtonVariant> = {
  fulfilment: 'fulfilment',
  'cancel-request': 'cancel-request',
  notes: 'ghost',
}

/**
 * The terminal tier: filled red is the sanctioned cancel, outlined red beside it
 * is the override. Two filled reds would read as equal alternatives. Keyed on
 * `TerminalKind`, so the map is exhaustive and no future terminal command can
 * fall through to the filled red by omission.
 */
const TERMINAL_VARIANT: Record<TerminalKind, ButtonVariant> = {
  'force-close': 'danger-outlined',
  close: 'danger',
}

/**
 * One command button, plus its explanation when it has one.
 *
 * A command disabled by document STATE carries `aria-disabled` rather than
 * `disabled`, so it keeps its place in the tab order and can state its reason on
 * focus as well as on hover. A command disabled because the page is BUSY takes
 * the real `disabled` attribute: it has nothing to explain — the spinner
 * already reports it — and it should not be tabbable mid-request.
 */
function CommandButton({
  command,
  variant,
  label,
  onCommand,
}: {
  command: CommandState
  variant: ButtonVariant
  label: string
  onCommand: (kind: CommandKind) => void
}) {
  const Icon = ICONS[command.kind]
  const explained = command.reason !== null
  const reasonId = `command-reason-${command.kind}`

  const button = (
    <Button
      variant={variant}
      disabled={command.disabled && !explained}
      aria-disabled={explained || undefined}
      aria-describedby={explained ? reasonId : undefined}
      onClick={explained ? undefined : () => onCommand(command.kind)}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )

  if (!explained) return button

  return (
    <span className="group relative inline-flex">
      {button}
      {/*
        Hidden by OPACITY, never by `display:none` or `visibility` — an
        `aria-describedby` target that is not rendered is not announced, and the
        whole point of this element is that the command explains itself.
      */}
      <span
        id={reasonId}
        role="tooltip"
        className={
          'pointer-events-none absolute bottom-full start-0 z-20 mb-1 w-max max-w-64 ' +
          'rounded-lg border border-border bg-card px-2 py-1 text-[0.6875rem] text-foreground shadow-md ' +
          'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
        }
      >
        {command.reason}
      </span>
    </span>
  )
}

export default function CommandPanel({
  context,
  onCommand,
}: {
  /** The gated fields plus busy — documented once, on `CommandContext`. */
  context: CommandContext
  onCommand: (kind: CommandKind) => void
}) {
  const { t } = useTranslation('document')
  const { closeStatus, documentCategory, canReturn, lines, busy } = context
  // Memoised on the FIELDS, not on `context`: the parent builds the object
  // inline, so a reference dependency would recompute on every render.
  const bar = useMemo(
    () => commandBar({ closeStatus, documentCategory, canReturn, lines, busy }, t),
    [closeStatus, documentCategory, canReturn, lines, busy, t],
  )

  return (
    <section className="rounded-lg border border-border/60 bg-card" aria-label={t('command.title')}>
      <h2 className="border-b border-border/60 px-2.5 py-1.5 text-xs font-semibold tracking-tight">
        {t('command.title')}
      </h2>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-2.5 py-2">
        {/*
          The cluster group is the flexible half: it wraps within itself and then
          onto its own line, and the terminal pair keeps its `ms-auto` place at
          the end of the bar at every width.
        */}
        <div className="flex flex-1 flex-wrap items-end gap-x-4 gap-y-3">
          {bar.clusters.map((cluster) => (
            <div key={cluster.id} className="flex flex-col gap-1">
              {/*
                The tiny caps label is what makes a two-colour bar legible;
                colour is reinforcement, never the only signal.
              */}
              <span className="ps-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-ink-3">
                {cluster.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cluster.commands.map((command) => (
                  <CommandButton
                    key={command.kind}
                    command={command}
                    variant={CLUSTER_VARIANT[cluster.id]}
                    label={t(`actions.${command.kind}`)}
                    onCommand={onCommand}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/*
          Unlabelled by design — a label would make the terminal tier read as a
          fourth family rather than as the edge of the bar.
        */}
        <div className="flex flex-wrap items-end gap-1.5 ms-auto">
          {bar.terminal.map((command) => (
            <CommandButton
              key={command.kind}
              command={command}
              variant={TERMINAL_VARIANT[command.kind]}
              label={t(`actions.${command.kind}`)}
              onCommand={onCommand}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
