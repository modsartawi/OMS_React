import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import SaysBoth from '@/core/rules/SaysBoth'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatPair, fsi } from '@/core/util/bidi'
import { GuardSeverityBadge, RuleId } from './badges'
import { guardAnswer, hasSuggestion, reasonChoices, type GuardAnswerDraft, type GuardDrafts, type GuardItem } from './guard-answer'
import type { GuardAnswerResult, GuardReasonCode, GuardReasons, OrderGuards } from './guard-check'
import { PROBLEM_KEYS, suggestionsOf } from './guard-words'
import { guardReasonsQuery, orderGuardsApi } from './order-guards-api'

/** An order line's item, for the line's heading: its number and its description. */
export interface GuardLineItem {
  code: string
  name: string
}

const FIELD = 'rounded-md border border-border/60 bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary/60'

/**
 * The guard dialog on an insured OMS order (BackOffice 3142/3143, oms ticket 616) — the till's per-line
 * guard dialog: REFUSE → remove or change the line on the order; WARN → tick; OVERRIDE → intervention,
 * outcome and reason (where the rule asks) with an optional note, only with `INS_GUARD`. A rule an HQ
 * exception passed says so and needs nothing. In `@/core/` because the OMS document feature draws it (the
 * `core/dispatch/ReleaseLockDialog` precedent); it speaks in `insurance-order-guards`.
 *
 * Send stays disabled until `guardAnswer` says every rule is answered. A refusal (a different `lineHash`, a
 * capped reason past its cap, no grant) stays in the dialog with the server's sentence and its code, so
 * nothing picked is lost.
 */
export default function GuardDialog({
  open,
  guards,
  lineItem,
  canOverride,
  onClose,
  onAnswered,
}: {
  open: boolean
  guards: OrderGuards
  lineItem: (line: number) => GuardLineItem | null
  /** `INS_GUARD`. */
  canOverride: boolean
  onClose: () => void
  onAnswered: (result: GuardAnswerResult) => void
}) {
  const { t } = useTranslation('insurance-order-guards')
  const user = useSession((s) => s.userId) ?? ''
  const [drafts, setDrafts] = useState<GuardDrafts>({})
  const reasons = useQuery({ ...guardReasonsQuery(), enabled: open })
  const form = guardAnswer({ guards, reasons: reasons.data ?? null, drafts, user, canOverride })
  const send = useMutation({
    mutationFn: () => orderGuardsApi.answer(guards.checkId, form.body!),
    onSuccess: (r) => onAnswered(r),
  })
  const busy = send.isPending
  const edit = (key: string, patch: Partial<GuardAnswerDraft>) => {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }))
    if (send.isError) send.reset()
  }
  const refused = form.items.some((i) => i.problem === 'remove')
  const code = send.isError ? apiErrorCode(send.error) : null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      onShow={() => {
        setDrafts({})
        send.reset()
      }}
      title={t('guard.title')}
      width="48rem"
      footer={
        <>
          <span className="me-auto text-xs text-muted-foreground" data-guard-status={form.ready ? 'ready' : refused ? 'refused' : 'open'}>
            {form.ready
              ? t('guard.ready')
              : refused
                ? t('guard.blockedRefuse')
                : form.open > 0
                  ? t('guard.open', { count: form.open })
                  : t('guard.nothing')}
          </span>
          <Button variant="text" onClick={onClose} disabled={busy} data-guard-cancel="">
            {t('guard.cancel')}
          </Button>
          <Button disabled={!form.ready || busy} onClick={() => form.ready && send.mutate()} data-guard-send="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('guard.sending') : t('guard.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-guard-dialog={guards.checkId}>
        <p className="text-xs text-muted-foreground">{t('guard.intro')}</p>
        {reasons.isError && (
          <ErrorBanner className="p-2" title={t('guard.reasonsFailed')} message={apiErrorMessage(reasons.error, t('guard.failedHint'))} />
        )}
        {guards.lines.map((l) => {
          const item = lineItem(l.line)
          const items = form.items.filter((i) => i.line === l.line)
          return (
            <section key={l.line} className="rounded-md border border-border/60" data-guard-line={l.line} data-outcome={l.outcome}>
              <header className="flex flex-wrap items-baseline gap-2 border-b border-border/60 bg-muted px-3 py-1.5 text-sm">
                <span className="font-medium">
                  {t('guard.line', { line: fsi(String(l.line)) })}
                </span>
                {item && (
                  <span className="text-muted-foreground" data-guard-item-name="">
                    <Ltr>{formatPair(item.code, item.name)}</Ltr>
                  </span>
                )}
              </header>
              <div className="flex flex-col divide-y divide-border/60">
                {items.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground" data-guard-passed="">
                    {t('guard.passed')}
                  </p>
                )}
                {items.map((i) => (
                  <FiredRule
                    key={i.key}
                    item={i}
                    unknowns={l.unknowns}
                    reasons={reasons.data ?? null}
                    drafts={drafts}
                    disabled={busy}
                    onEdit={(patch) => edit(i.key, patch)}
                  />
                ))}
              </div>
            </section>
          )
        })}
        {send.isError && (
          <ErrorBanner className="p-2" title={t('guard.failed')} message={apiErrorMessage(send.error, t('guard.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-guard-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}

function FiredRule({
  item,
  unknowns,
  reasons,
  drafts,
  disabled,
  onEdit,
}: {
  item: GuardItem
  unknowns: string[]
  reasons: GuardReasons | null
  drafts: GuardDrafts
  disabled: boolean
  onEdit: (patch: Partial<GuardAnswerDraft>) => void
}) {
  const { t } = useTranslation('insurance-order-guards')
  const { fired, need, problem } = item
  const draft = drafts[item.key] ?? {}
  // Story 6 / 35: a suggestion is applied in one tap — the line goes on changed (a CHANGE answer), no triad needed.
  const canApply = need !== 'exception' && hasSuggestion(fired)
  const applied = canApply && draft.apply === true
  const shownProblem = problem && problem !== 'remove' && problem !== 'noGrant' ? problem : null
  return (
    <div className="flex flex-col gap-2 px-3 py-2 text-sm" data-guard-item={item.key} data-need={need} data-problem={problem ?? ''} data-applied={applied ? 'yes' : 'no'}>
      <div className="flex flex-wrap items-center gap-2">
        <GuardSeverityBadge severity={fired.severity} />
        <RuleId id={fired.ruleId} />
        <span className="ms-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {fired.codes?.conflict && (
            <span data-guard-conflict="">
              {t('guard.conflict')} <Ltr>{fired.codes.conflict}</Ltr>
            </span>
          )}
          {fired.codes?.nphies && (
            <span data-guard-nphies="">
              {t('guard.nphies')} <Ltr>{fired.codes.nphies}</Ltr>
            </span>
          )}
        </span>
      </div>
      <SaysBoth says={{ en: fired.en, ar: fired.ar }} />
      {suggestionsOf(fired.suggestion).map((s) => (
        <p key={s.key} className="text-xs text-muted-foreground" data-guard-suggestion={s.value}>
          <Trans t={t} i18nKey={s.key} values={{ value: s.value }} components={{ n: <Ltr /> }} />
        </p>
      ))}
      {canApply && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={applied ? 'secondary' : 'primary'}
            disabled={disabled}
            aria-pressed={applied}
            onClick={() => onEdit({ apply: !applied })}
            data-guard-apply={applied ? 'applied' : 'offered'}
          >
            {t(applied ? 'guard.unapply' : 'guard.apply')}
          </Button>
          {applied && (
            <span className="text-xs text-success-800" data-guard-applied="">
              {t('guard.applied')}
            </span>
          )}
        </div>
      )}
      {unknowns.length > 0 && need !== 'exception' && (
        <p className="text-xs text-muted-foreground" data-guard-unknowns="">
          {t('guard.unknowns')}{' '}
          {unknowns.map((u) => (
            <span key={u} className="me-1.5 font-mono">
              <Ltr>{u}</Ltr>
            </span>
          ))}
        </p>
      )}

      {need === 'exception' && (
        <p className="text-xs text-success-800" data-guard-exception={fired.exceptionId ?? ''}>
          <Trans t={t} i18nKey="guard.exception" values={{ id: fired.exceptionId ?? '' }} components={{ x: <Ltr /> }} />
        </p>
      )}
      {!applied && (problem === 'remove' || problem === 'noGrant') && (
        <p className="text-xs font-medium text-danger-800" data-guard-instruction={problem}>
          {t(PROBLEM_KEYS[problem])}
        </p>
      )}
      {!applied && need === 'warn' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.ack === true} disabled={disabled} onChange={(e) => onEdit({ ack: e.target.checked })} data-guard-ack="" />
          {t('guard.ack')}
        </label>
      )}
      {!applied && need === 'override' && problem !== 'noGrant' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <CodeSelect
            label={t('guard.intervention')}
            hook="intervention"
            value={draft.intervention}
            options={activeOptions(reasons?.intervention)}
            disabled={disabled}
            onChange={(v) => onEdit({ intervention: v })}
          />
          <CodeSelect
            label={t('guard.outcome')}
            hook="outcome"
            value={draft.outcome}
            options={activeOptions(reasons?.outcome)}
            disabled={disabled}
            onChange={(v) => onEdit({ outcome: v })}
          />
          {item.asksReason && (
            <CodeSelect
              label={t('guard.reason')}
              hook="reason"
              value={draft.reason}
              options={reasonChoices(reasons, fired.ruleId, drafts, item.key)}
              disabled={disabled}
              onChange={(v) => onEdit({ reason: v })}
            />
          )}
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t('guard.note')}
            <input
              value={draft.note ?? ''}
              onChange={(e) => onEdit({ note: e.target.value })}
              dir="auto"
              maxLength={200}
              disabled={disabled}
              className={FIELD}
              data-guard-note=""
            />
          </label>
        </div>
      )}
      {shownProblem && (
        <p className="text-xs text-muted-foreground" data-guard-problem={shownProblem}>
          {t(PROBLEM_KEYS[shownProblem])}
        </p>
      )}
    </div>
  )
}

const activeOptions = (codes: GuardReasonCode[] | undefined) =>
  (codes ?? []).filter((c) => c.active).map((c) => ({ code: c.code, en: c.en, ar: c.ar, disabled: false }))

function CodeSelect({
  label,
  hook,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  hook: string
  value: string | undefined
  options: Array<{ code: string; en: string; disabled: boolean }>
  disabled: boolean
  onChange: (code: string) => void
}) {
  const { t } = useTranslation('insurance-order-guards')
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
        {...{ [`data-guard-${hook}`]: '' }}
      >
        <option value="">{t('guard.choose')}</option>
        {options.map((o) => {
          // A native <option> is a string sink: the whole `code · words` pair is isolated once.
          const text = fsi(formatPair(o.code, o.en))
          return (
            <option key={o.code} value={o.code} disabled={o.disabled} data-code={o.code}>
              {o.disabled ? t('guard.usedUp', { label: text }) : text}
            </option>
          )
        })}
      </select>
    </label>
  )
}
