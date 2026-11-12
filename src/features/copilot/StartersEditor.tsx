import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react'
import type { CopilotReaderKind } from '@/core/models/copilot'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { copilotAnswerModel } from './answer'
import { Answer, Refusal } from './AnswerParts'
import { copilotRulesApi } from './rules-api'
import {
  READER_KINDS,
  addStarter,
  applyTrial,
  canAddStarter,
  curatorRefused,
  editStarter,
  readingsTooLong,
  removeStarter,
  rulesTooLong,
  starterIssue,
  tryRequest,
  type RefusedStarter,
  type RulesDraft,
  type RulesFrame,
  type StarterDraft,
  type StarterIssue,
  type StartersDraft,
} from './rules'

/** A `COPILOT-412` naming a starter (or a kind's list), with the server's words. */
export interface StarterRefusal extends RefusedStarter {
  message: string
}

/** The starter being tried: its place and the English text sent. */
interface Trial {
  kind: CopilotReaderKind
  index: number
  text: string
}

const only = (kind: CopilotReaderKind, s: StarterDraft): StartersDraft =>
  ({ executive: [], operations: [], [kind]: [s] }) as StartersDraft

/**
 * The house-rules screen's starters (ticket 875, BackOffice 3600 A51/A52): a list for each kind of reader, at most
 * `startersPerKind` each, every starter in English and Arabic. "Try" runs the English text through the trial door
 * with the draft house rules and keeps the answering tool call as the starter's proof; editing the text clears it. A
 * starter marked as having a blank for the reader needs no proof and is not tried.
 *
 * Bidi: the starters are free text in either script (`dir="auto"`); the number, the count and the tool name are
 * machine values (`Ltr`).
 */
export default function StartersEditor({
  draft,
  frame,
  onStarters,
  refusal,
  onRefused,
}: {
  draft: RulesDraft
  frame: RulesFrame
  onStarters: (f: (s: StartersDraft) => StartersDraft) => void
  refusal: StarterRefusal | null
  onRefused: (err: unknown) => boolean
}) {
  const { t } = useTranslation('copilot')
  const run = useMutation({
    mutationFn: (trial: Trial) => copilotRulesApi.tryDraft(tryRequest(draft, trial.text.trim(), frame)),
    onSuccess: (answer, trial) => onStarters((s) => applyTrial(s, trial.kind, trial.index, trial.text, answer)),
    onError: (err) => void onRefused(err),
  })
  const draftTriable = draft.text.trim() !== '' && !rulesTooLong(draft.text) && !readingsTooLong(draft.readings, frame)
  const max = frame.starterMaxLength

  return (
    <section className="flex flex-col gap-3" data-rules-starters>
      <div>
        <h3 className="text-sm font-semibold">{t('rules.starters.heading')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('rules.starters.hint')}</p>
      </div>
      {READER_KINDS.map((kind) => {
        const list = draft.starters[kind]
        const listRefused = refusal && refusal.kind === kind && refusal.index === null ? refusal.message : null
        return (
          <div key={kind} className="flex flex-col gap-2" data-rules-starters-kind={kind}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold">
                {t(`rules.starters.kind.${kind}`)}{' '}
                <span className="font-normal text-muted-foreground" data-rules-starters-count={kind}>
                  <Ltr>{formatCount(formatNumber(list.length), formatNumber(frame.startersPerKind))}</Ltr>
                </span>
              </h4>
              <Button
                variant="outlined"
                disabled={!canAddStarter(draft.starters, kind, frame)}
                title={canAddStarter(draft.starters, kind, frame) ? undefined : t('rules.starters.full', { max: fsi(formatNumber(frame.startersPerKind)) })}
                onClick={() => onStarters((s) => addStarter(s, kind, frame))}
                data-rules-starter-add={kind}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t('rules.starters.add')}
              </Button>
            </div>
            {listRefused && (
              <p className="text-xs text-danger-800" role="alert" data-rules-starters-refused={kind}>
                <bdi>{listRefused}</bdi>
              </p>
            )}
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('rules.starters.none')}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {list.map((s, index) => {
                  const own = starterIssue(only(kind, s), frame)
                  const marked = refusal && refusal.kind === kind && refusal.index === index ? refusal.message : null
                  const trying = run.isPending && run.variables?.kind === kind && run.variables.index === index
                  const shown = !run.isPending && run.variables?.kind === kind && run.variables.index === index
                  const canTry = !s.blank && own?.problem !== 'missing' && own?.problem !== 'tooLong' && draftTriable && !run.isPending
                  const langError = (lang: 'en' | 'ar') =>
                    own?.problem === 'tooLong' && own.lang === lang ? t('rules.starters.tooLong', { max: fsi(formatNumber(max)) }) : undefined
                  return (
                    <li
                      key={index}
                      className={`flex flex-col gap-2 rounded-lg border p-2.5 ${marked ? 'border-danger-border bg-danger-050' : 'border-border/60 bg-card'}`}
                      data-rules-starter={`${kind}-${index}`}
                      data-refused={marked ? true : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t('rules.starters.number')} <Ltr>{formatNumber(index + 1)}</Ltr>
                        </span>
                        <IconButton
                          label={t('rules.starters.remove')}
                          size="compact"
                          onClick={() => onStarters((x) => removeStarter(x, kind, index))}
                          data-rules-starter-remove
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </IconButton>
                      </div>
                      {(['en', 'ar'] as const).map((lang) => (
                        <Field
                          key={lang}
                          label={t(`rules.starters.lang.${lang}`)}
                          error={langError(lang)}
                          hint={
                            <span>
                              {t('rules.editor.chars')} <Ltr>{formatCount(formatNumber(s[lang].trim().length), formatNumber(max))}</Ltr>
                            </span>
                          }
                        >
                          <Input
                            dir="auto"
                            value={s[lang]}
                            onChange={(e) => {
                              const text = e.target.value
                              onStarters((x) => editStarter(x, kind, index, { [lang]: text }))
                            }}
                            data-rules-starter-text={lang}
                          />
                        </Field>
                      ))}
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={s.blank}
                          onChange={(e) => {
                            const blank = e.target.checked
                            onStarters((x) => editStarter(x, kind, index, { blank }))
                          }}
                          data-rules-starter-blank
                        />
                        {t('rules.starters.blank')}
                      </label>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs" data-rules-starter-proof={s.blank ? 'blank' : s.proof ? 'proven' : 'none'}>
                          {s.blank ? (
                            <span className="text-muted-foreground">{t('rules.starters.noProofNeeded')}</span>
                          ) : s.proof ? (
                            <StatusBadge sev="ok">
                              {t('rules.starters.proven')} <Ltr>{s.proof.tool}</Ltr>
                            </StatusBadge>
                          ) : (
                            <StatusBadge sev="warn">{t('rules.starters.unproven')}</StatusBadge>
                          )}
                        </span>
                        {!s.blank && (
                          <Button
                            variant="secondary"
                            disabled={!canTry}
                            onClick={() => run.mutate({ kind, index, text: s.en })}
                            data-rules-starter-try
                          >
                            {trying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FlaskConical className="h-3.5 w-3.5" aria-hidden />}
                            {t('rules.starters.try')}
                          </Button>
                        )}
                      </div>
                      {marked && (
                        <p className="text-xs text-danger-800" role="alert">
                          <bdi>{marked}</bdi>
                        </p>
                      )}
                      {shown &&
                        (run.isError ? (
                          curatorRefused(run.error) ? null : <Refusal err={run.error} />
                        ) : run.data ? (
                          <div
                            className="flex flex-col gap-2 rounded-2xl border border-dashed border-primary-border bg-card px-3.5 py-2.5"
                            data-rules-starter-answer
                          >
                            <StatusBadge sev="warn">{t('rules.try.draft')}</StatusBadge>
                            {!s.blank && !s.proof && <p className="text-xs text-muted-foreground">{t('rules.starters.noProofKept')}</p>}
                            <Answer model={{ ...copilotAnswerModel(run.data), rules: null }} />
                          </div>
                        ) : null)}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Why the save is shut by a starter, naming it: its kind, its number from 1, and the language. */
export function useStarterIssueText(): (issue: StarterIssue, frame: RulesFrame) => string {
  const { t } = useTranslation('copilot')
  return (issue, frame) =>
    t(`rules.starters.issue.${issue.problem}`, {
      kind: t(`rules.starters.kind.${issue.kind}`),
      n: fsi(formatNumber(issue.index + 1)),
      lang: issue.lang ? t(`rules.starters.lang.${issue.lang}`) : '',
      max: fsi(formatNumber(frame.starterMaxLength)),
    })
}

/** One version's starters, read-only, for the history's side-by-side. */
export function StartersPane({ label, starters, ...rest }: { label: ReactNode; starters: StartersDraft; [data: `data-${string}`]: unknown }) {
  const { t } = useTranslation('copilot')
  return (
    <div className="flex min-w-0 flex-col gap-1" {...rest}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs">
        {READER_KINDS.map((kind) => (
          <div key={kind}>
            <div className="font-semibold">{t(`rules.starters.kind.${kind}`)}</div>
            {starters[kind].length === 0 ? (
              <p className="text-muted-foreground">{t('rules.starters.none')}</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {starters[kind].map((s, i) => (
                  <li key={i} className="flex flex-col">
                    <bdi>{s.en}</bdi>
                    <bdi>{s.ar}</bdi>
                    {s.blank && <span className="text-muted-foreground">{t('rules.starters.blank')}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
