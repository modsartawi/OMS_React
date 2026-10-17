import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronRight, CircleCheck, Loader2, TriangleAlert } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { RULE_GROUP_TYPE, type CampaignRule, type RuleBlockCatalogue, type RuleCampaignChecks, type RuleCheckSeverity } from '@/core/models/rule-campaign'
import { catalogueBlock } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { labelText, useHas } from './builder-ui'
import { SEVERITY_LOOK } from './CheckNotes'
import { approvalVerdict, severityOf, type CheckPlace, type LocatedCheck } from './checks'
import { fieldLabelKey } from './panel-keys'

/**
 * The builder's checks pill (ticket 508): HQ's checks of the saved draft — "2 errors  1 warning",
 * or "All checks pass". Opening it lists each message with where it points (rule › block › field);
 * a click on one takes the reader there (`onGo`). It says whether the errors block "Ask for
 * approval" (warnings never do), and, while there are unsaved changes, that the checks are the last
 * save's. While HQ is asked again (after a Save) it says so rather than show the last answer, and a
 * check that could not be made says that, never an older answer.
 */
export default function ChecksPill({
  checks,
  fetching,
  error,
  onRetry,
  located,
  dirty,
  rules,
  catalogue,
  onGo,
}: {
  checks: RuleCampaignChecks | undefined
  /** HQ is being asked (the first read, or again after a Save or a retry). */
  fetching: boolean
  /** Why the last ask failed; null when it answered. */
  error: unknown
  onRetry: () => void
  located: LocatedCheck[]
  dirty: boolean
  rules: CampaignRule[]
  catalogue: RuleBlockCatalogue
  onGo: (place: CheckPlace) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const root = useRef<HTMLDivElement>(null)
  const failed = !fetching && error != null
  const verdict = !fetching && !failed && checks ? approvalVerdict(checks) : null

  // Escape or a click elsewhere closes the list.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  let face: ReactNode
  let tone: string
  let state: string
  if (failed) {
    state = 'failed'
    tone = 'border-attention-border bg-attention-050 text-attention-800'
    face = (
      <>
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
        {t('checks.failed')}
      </>
    )
  } else if (!verdict) {
    state = 'pending'
    tone = 'border-border/60 text-muted-foreground'
    face = (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t('checks.pending')}
      </>
    )
  } else if (verdict.errors || verdict.warnings) {
    state = verdict.errors ? 'errors' : 'warnings'
    tone = verdict.errors ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-attention-border bg-attention-050 text-attention-800'
    face = (
      <>
        {verdict.errors > 0 && <CheckCount n={verdict.errors} severity="error" />}
        {verdict.warnings > 0 && <CheckCount n={verdict.warnings} severity="warning" />}
      </>
    )
  } else {
    state = 'pass'
    tone = 'border-success-border bg-success-050 text-success-800'
    face = (
      <>
        <CircleCheck className="h-3.5 w-3.5" aria-hidden />
        {t('checks.pass')}
      </>
    )
  }
  const showList = open && (failed || verdict !== null)

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium ${tone}`}
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        disabled={!failed && !verdict}
        onClick={() => setOpen((o) => !o)}
        data-checks-pill={state}
      >
        {face}
      </button>
      {showList && (
        <div id={listId} className={'absolute end-0 top-full z-50 mt-1 flex w-[32rem] max-w-[90vw] flex-col gap-2 p-3 ' + POPOVER} data-checks-list="">
          {failed || !verdict ? (
            <ErrorBanner className="p-2" title={t('checks.failedTitle')} message={apiErrorMessage(error, t('checks.failedBody'))}>
              <Button variant="outlined" className="mt-2" onClick={onRetry} disabled={fetching} data-checks-retry="">
                {t('checks.retry')}
              </Button>
            </ErrorBanner>
          ) : (
            <>
              {located.length > 0 && (
                <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                  {located.map((l) => {
                    const severity = severityOf(l.message)
                    const { Icon, ink } = SEVERITY_LOOK[severity]
                    const goes = l.place.at !== 'campaign' && l.place.at !== 'gone'
                    const body = (
                      <>
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${ink}`} aria-hidden />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground" data-check-where="">
                            <Where place={l.place} rules={rules} catalogue={catalogue} />
                          </span>
                          <bdi className="text-sm" data-check-message="">
                            {l.message.message}
                          </bdi>
                        </span>
                      </>
                    )
                    return (
                      <li key={l.key} data-check-item={severity} data-check-code={l.message.code}>
                        {goes ? (
                          <button
                            type="button"
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start hover:bg-accent"
                            onClick={() => {
                              setOpen(false)
                              onGo(l.place)
                            }}
                            data-check-go=""
                          >
                            {body}
                          </button>
                        ) : (
                          <div className="flex items-start gap-2 px-2 py-1.5">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className={'text-xs ' + (verdict.blocked ? 'font-medium text-danger-800' : 'text-muted-foreground')} data-checks-verdict={verdict.blocked ? 'blocked' : 'clear'}>
                {t(verdict.blocked ? 'checks.verdict.blocked' : verdict.warnings ? 'checks.verdict.warningsOnly' : 'checks.verdict.clear')}
              </p>
            </>
          )}
          {dirty && (
            <p className="text-xs text-attention-800" data-checks-stale="">
              {t('checks.stale')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** "1 error" / "3 warnings" on the pill. */
function CheckCount({ n, severity }: { n: number; severity: RuleCheckSeverity }) {
  const { t } = useTranslation('campaign-workspace')
  const { Icon, ink } = SEVERITY_LOOK[severity]
  return (
    <span className={`inline-flex items-center gap-1 ${ink}`} {...{ [`data-checks-${severity}s`]: n }}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>
        <Trans t={t} i18nKey={`checks.${severity}s`} count={n} components={{ n: <Ltr /> }} />
      </span>
    </span>
  )
}

/** Where a message points, as crumbs: Rule n "name" › Condition n › At least. Names are data. */
function Where({ place, rules, catalogue }: { place: CheckPlace; rules: CampaignRule[]; catalogue: RuleBlockCatalogue }) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  if (place.at === 'campaign') return <>{t('checks.where.campaign')}</>
  const ruleIndex = place.ruleIndex
  if (ruleIndex === null) return <>{t('checks.where.gone')}</>
  const rule = rules[ruleIndex]
  const crumbs: ReactNode[] = [
    <span key="rule">
      <Trans
        t={t}
        i18nKey={rule.name.trim() ? 'checks.where.ruleNamed' : 'checks.where.rule'}
        values={{ n: ruleIndex + 1, name: rule.name }}
        components={{ n: <Ltr />, name: <bdi className="font-medium" /> }}
      />
    </span>,
  ]
  if (place.at === 'gone') crumbs.push(<span key="gone">{t('checks.where.gone')}</span>)
  if (place.at === 'block') {
    if (place.kind === 'filter' || place.kind === 'value') {
      const name = place.kind === 'filter' ? rule.filters[place.index]?.name : rule.values[place.index]?.name
      crumbs.push(
        <span key="block">
          <Trans t={t} i18nKey={`checks.where.${place.kind}`} values={{ name: name ?? '' }} components={{ name: <bdi className="font-mono" /> }} />
        </span>,
      )
    } else {
      crumbs.push(
        <span key="block">
          <Trans
            t={t}
            i18nKey={place.type === RULE_GROUP_TYPE ? 'checks.where.group' : place.groupId ? `checks.where.${place.kind}InGroup` : `checks.where.${place.kind}`}
            values={{ n: place.index + 1 }}
            components={{ n: <Ltr /> }}
          />
        </span>,
      )
    }
  }
  if (place.at !== 'gone' && place.field) crumbs.push(<span key="field">{fieldLabel(place, catalogue, t, has)}</span>)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {crumbs.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden />}
          {c}
        </span>
      ))}
    </span>
  )
}

/** A field's label as its panel shows it; a field this bundle has no words for reads as its code. */
function fieldLabel(place: Extract<CheckPlace, { at: 'rule' | 'block' }>, catalogue: RuleBlockCatalogue, t: (key: string) => string, has: (key: string) => boolean): ReactNode {
  const field = place.field ?? ''
  if (place.at === 'rule' || place.kind === 'filter' || place.kind === 'value') return has(`checks.field.${field}`) ? t(`checks.field.${field}`) : <Ltr>{field}</Ltr>
  const entry = place.type ? catalogueBlock(catalogue, place.kind, place.type) : null
  const def = entry?.fields.find((f) => f.key === field)
  if (def?.kind === 'says' || (!def && field === 'says' && place.kind === 'condition')) return t(`rules.says.${def?.role ?? 'notMet'}`)
  return labelText(t, fieldLabelKey(place.type ?? '', field, has), field, has)
}
