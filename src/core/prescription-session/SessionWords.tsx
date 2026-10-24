import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import type { AfterCloseLine, StepLine } from './lines'
import { PRESCRIPTION_SESSION_NS, wordText, type CodeWord } from './words'

/**
 * The prescription session's shared renderers (ticket 544): a code word, a next step and an
 * after-close event, drawn the same on Document Details (544) and the HQ list (545-548). Read-only:
 * nothing here can be pressed. Bidi per `.claude/rules/bidi.md` — a known word is copy; an unknown
 * code, a `PS-…`, a store and a document number are machine values (`Ltr`); the server's step label,
 * a park note and a recorder are free text (`<bdi>`).
 */

/** A code's word: the translation, or an unknown code as itself (isolated, it is a machine value). */
export function Word({ word }: { word: CodeWord }) {
  const { t } = useTranslation(PRESCRIPTION_SESSION_NS)
  return word.key === null ? <Ltr>{word.raw}</Ltr> : <>{wordText(t, word)}</>
}

/** A next step: its label, owner, what it waits on, parked + note, badges. */
export function StepSummary({ step }: { step: StepLine }) {
  const { t } = useTranslation(PRESCRIPTION_SESSION_NS)
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5" data-ps-step="">
      <bdi className="font-medium" data-ps-step-label="">
        {step.label}
      </bdi>
      <span className="text-muted-foreground" data-ps-owner={step.owner.raw}>
        <Trans
          t={t}
          i18nKey="step.owner"
          values={{ owner: wordText(t, step.owner) }}
          components={{ o: step.owner.key === null ? <Ltr /> : <span /> }}
        />
      </span>
      {step.waitingOn && (
        <span className="text-muted-foreground" data-ps-waiting-on={step.waitingOn}>
          <Trans t={t} i18nKey="step.waitingOn" values={{ session: step.waitingOn }} components={{ v: <Ltr /> }} />
        </span>
      )}
      {step.parked && (
        <span className="inline-flex items-baseline gap-1" data-ps-parked="">
          <StatusBadge sev="warn">{t('step.parked')}</StatusBadge>
          {step.parkNote && (
            <bdi className="text-muted-foreground" data-ps-park-note="">
              {step.parkNote}
            </bdi>
          )}
        </span>
      )}
      {step.badges.map((badge) => (
        <span key={badge.raw} data-ps-badge={badge.raw}>
          <StatusBadge sev="warn">
            <Word word={badge} />
          </StatusBadge>
        </span>
      ))}
    </span>
  )
}

/** One after-close event: kind, its sentence with the numbers, then store · time, then who. */
export function AfterCloseText({ line }: { line: AfterCloseLine }) {
  const { t } = useTranslation(PRESCRIPTION_SESSION_NS)
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5" data-ps-after-close={line.kind.raw}>
      <span className="font-medium" data-ps-after-close-kind="">
        <Word word={line.kind} />
      </span>
      <span data-ps-after-close-sentence="">
        <Trans
          t={t}
          i18nKey={line.sentence}
          values={{ sale: line.sale, document: line.document, resale: line.resale, kind: line.kind.raw }}
          components={{ v: <Ltr /> }}
        />
      </span>
      {/* A pair led by a machine value: formatted once, isolated once. */}
      <span className="text-muted-foreground tabular-nums" data-ps-after-close-at="">
        <Ltr>{formatPair(line.storeCode, formatDateTime(line.recordedAt) || line.recordedAt)}</Ltr>
      </span>
      {line.recordedBy && (
        <span className="text-muted-foreground" data-ps-after-close-by="">
          <Trans t={t} i18nKey="afterClose.recordedBy" values={{ by: line.recordedBy }} components={{ w: <bdi /> }} />
        </span>
      )}
    </span>
  )
}
