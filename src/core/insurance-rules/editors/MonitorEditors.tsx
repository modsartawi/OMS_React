// A monitor's WHEN and THEN on the guard builder (oms 699). A monitor has none of the guard's till effects, so these draw only
// what it has: the answers it reads, and a review item's severity and text.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { blockKey, fieldIssues, type ChecksIndex } from '@/core/insurance-rules/checks'
import { Issues } from '@/core/insurance-rules/controls'
import { effectSeveritiesFor, setMonitorScope, toggleUse } from '@/core/insurance-rules/monitor'
import { MONITOR_SCOPES, MONITOR_USES, type GuardEffect, type GuardRule, type MonitorScope } from '@/core/insurance-rules/model'
import Chip from '@/core/ui/Chip'
import type { RuleEdit } from './ConditionEditor'
import { MessageBox } from './EffectEditor'

/**
 * The message it reads (oms 701), and on a claim response which answers of it. The last use cannot be turned off. A change
 * of scope drops the blocks the new message cannot read, and says so: Undo brings them back.
 */
export function MonitorScopeEditor({ rule, edit }: { rule: GuardRule; edit: RuleEdit }) {
  const { t } = useTranslation('insurance-guards')
  const [droppedOn, setDroppedOn] = useState<MonitorScope | null>(null)
  const scope = rule.scope ?? 'claimResponse'
  const uses = rule.uses ?? []
  const pick = (s: MonitorScope) => {
    if (s === scope) return
    const next = setMonitorScope(rule, s)
    setDroppedOn(JSON.stringify(next.when) !== JSON.stringify(rule.when) ? s : null)
    edit((r) => setMonitorScope(r, s))
  }
  return (
    <div className="flex flex-col gap-2 text-xs" data-monitor-scope={scope}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t('monitor.scope')}</span>
        <div className="inline-flex flex-wrap gap-1" role="group" aria-label={t('monitor.scope')}>
          {MONITOR_SCOPES.map((s) => (
            <Chip key={s} on={s === scope} data-monitor-scope-pick={s} onClick={() => pick(s)}>
              {t(`insurance-rules:catalog.message.${s}`)}
            </Chip>
          ))}
        </div>
      </div>
      {scope === 'claimResponse' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t('monitor.uses')}</span>
          <div className="inline-flex gap-1" role="group" aria-label={t('monitor.uses')}>
            {MONITOR_USES.map((u) => (
              <Chip key={u} on={uses.includes(u)} data-monitor-use={u} onClick={() => edit((r) => toggleUse(r, u))}>
                {t(`insurance-rules:sentence.when.use.${u}`)}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground" data-monitor-scope-note={scope}>
          {t(`monitor.scopeNote.${scope}`)}
        </p>
      )}
      {droppedOn === scope && (
        <p role="status" data-monitor-scope-dropped="">
          {t('monitor.scopeDropped')}
        </p>
      )}
    </div>
  )
}

export function MonitorEffectEditor({ rule, edit, checks }: { rule: GuardRule; edit: RuleEdit; checks: ChecksIndex }) {
  return (
    <div className="flex flex-col gap-4">
      {rule.then.map((e, i) => (
        <OneItem key={i} e={e} index={i} edit={edit} checks={checks} />
      ))}
    </div>
  )
}

function OneItem({ e, index, edit, checks }: { e: GuardEffect; index: number; edit: RuleEdit; checks: ChecksIndex }) {
  const { t } = useTranslation('insurance-guards')
  const issues = checks.blocks.get(blockKey('then', [index])) ?? []
  const setEffect = (fn: (x: GuardEffect) => GuardEffect, field?: string) =>
    edit((r) => ({ ...r, then: r.then.map((x, j) => (j === index ? fn(x) : x)) }), field ? `then:${index}:${field}` : undefined)
  return (
    <div className="flex flex-col gap-3" data-monitor-effect={index}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('editor.severity')}</span>
        <div className="inline-flex gap-1" role="group" aria-label={t('editor.severity')}>
          {effectSeveritiesFor('monitor').map((s) => (
            <Chip key={s} on={e.severity === s} data-severity-pick={s} onClick={() => setEffect((x) => (x.severity === s ? x : { ...x, severity: s }))}>
              {t(`insurance-rules:severity.${s}`)}
            </Chip>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{t(`insurance-rules:sentence.then.${e.severity}`)}</span>
      </div>
      <MessageBox lang="en" placeholders={false} value={e.says.en} invalid={fieldIssues(issues, 'says.en').length > 0} onValue={(v) => setEffect((x) => ({ ...x, says: { ...x.says, en: v } }), 'says.en')} />
      <MessageBox lang="ar" placeholders={false} value={e.says.ar} invalid={fieldIssues(issues, 'says.ar').length > 0} onValue={(v) => setEffect((x) => ({ ...x, says: { ...x.says, ar: v } }), 'says.ar')} />
      <Issues issues={issues} hook={`then.${index}`} />
    </div>
  )
}
