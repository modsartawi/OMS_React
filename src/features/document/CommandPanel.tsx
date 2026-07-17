import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
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

/**
 * The Screen 2 command panel — a free-text note above the corrective-action
 * buttons.
 *
 * Purely presentational: it owns the note input and reports a triggered action;
 * the parent confirms / opens the picker, posts and refreshes.
 *
 * Note the gating is deliberately thin — busy, note-presence (Add Note) and the
 * BB check (Return Document). There is **no status-based gating**: the server
 * decides what is legal for a document and says so in its `400` message. Second-
 * guessing that here would mean re-implementing its rules in the client and
 * drifting from them.
 */
const BUTTONS: { kind: CommandKind; icon: typeof Plus; variant: ButtonVariant }[] = [
  { kind: 'add-note', icon: Plus, variant: 'primary' },
  { kind: 'change-store', icon: Store, variant: 'secondary' },
  { kind: 'reschedule', icon: CalendarClock, variant: 'secondary' },
  { kind: 'request-close', icon: Flag, variant: 'secondary' },
  { kind: 'cancel-close-request', icon: Undo2, variant: 'secondary' },
  { kind: 'close', icon: CheckCircle2, variant: 'secondary' },
  { kind: 'force-close', icon: XCircle, variant: 'danger' },
  { kind: 'return-document', icon: Reply, variant: 'outlined' },
]

export default function CommandPanel({
  note,
  onNoteChange,
  busy,
  returnEnabled,
  onCommand,
}: {
  note: string
  onNoteChange: (note: string) => void
  /** An action is posting, its follow-up reload is running, or a picker is open. */
  busy: boolean
  /** Return Document — only for a BeyondBorder delivery. */
  returnEnabled: boolean
  onCommand: (kind: CommandKind) => void
}) {
  const { t } = useTranslation('document')
  const hasNote = note.trim().length > 0

  function disabled(kind: CommandKind): boolean {
    if (busy) return true
    if (kind === 'add-note') return !hasNote
    if (kind === 'return-document') return !returnEnabled
    return false
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <h2 className="border-b border-border/60 px-2.5 py-1.5 text-xs font-semibold tracking-tight">
        {t('command.title')}
      </h2>
      <div className="flex flex-wrap items-end gap-2.5 px-2.5 py-2">
        <div className="flex min-w-56 flex-[1_1_18rem] flex-col gap-0.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="command-note">
            {t('command.note')}
          </label>
          <textarea
            id="command-note"
            rows={2}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('command.notePlaceholder')}
            className="w-full resize-y rounded-lg border border-input bg-background px-2 py-1 text-[0.8125rem]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BUTTONS.map(({ kind, icon: Icon, variant }) => (
            <Button
              key={kind}
              variant={variant}
              disabled={disabled(kind)}
              onClick={() => onCommand(kind)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(`actions.${kind}`)}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
