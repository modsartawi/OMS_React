/**
 * One planner row in a side sheet (ticket 968, the owner's variant A): its form, a reason where the server keeps one
 * (buffer overrides and stock confidence, BO 4375), Save / End where the table's doors allow them, and the row's own
 * history under it — who changed what and when, the old and new values. A change is never made in place: the server
 * ends the row and writes a new one. A list entry is added or taken off, never changed; a rule is switched, never ended.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { History, Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import Textarea from '@/core/ui/Textarea'
import { SHEET_BODY } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { plannerKeys, sourcingPlannerApi } from './api'
import { ChangeCard, NS, RowLabel } from './display'
import { blankOverrideForm, overrideFormOf, overrideProblems, overrideValues, type OverrideForm } from './override-form-model'
import { GenericFields, OverrideFields } from './RowFields'
import { TABLES, formOf, formProblems, formValues, type FormProblem, type RowForm } from './tables'
import type { PlannerRow, PlannerTableKey, PlannerValues } from './wire'

type Generic = Exclude<PlannerTableKey, 'overrides'>

export default function RowSheet({ table, row, today, onClose }: { table: PlannerTableKey; row: PlannerRow | null; today: string; onClose: () => void }) {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const spec = TABLES[table]
  const isNew = row == null
  const ended = !!row?.endedAt
  const canSave = !ended && (isNew || spec.changeable)
  const canEnd = !ended && !isNew && spec.endable
  const reasonKept = spec.reasonKept

  const [override, setOverride] = useState<OverrideForm>(() => (row ? overrideFormOf(row.values) : blankOverrideForm(today)))
  const [generic, setGeneric] = useState<RowForm>(() => (table === 'overrides' ? {} : formOf(table, row?.values ?? null, today)))
  const [reason, setReason] = useState('')

  const problems: string[] = !canSave
    ? []
    : table === 'overrides'
      ? overrideProblems(override, today).map((p) => t(`problems.${p}`))
      : formProblems(table, generic, today).map((p) => problemText(p))
  const values: PlannerValues | null = table === 'overrides' ? overrideValues(override, today) : formValues(table as Generic, generic, today)
  const noReason = reasonKept && reason.trim() === ''

  const history = useQuery({
    queryKey: plannerKeys.history(table, row?.id ?? ''),
    queryFn: () => sourcingPlannerApi.history(table, row!),
    enabled: row != null,
  })

  const done = (message: string) => {
    toast.success(message)
    void queryClient.invalidateQueries({ queryKey: plannerKeys.table(table) })
    onClose()
  }
  const save = useMutation({
    mutationFn: (v: PlannerValues) => sourcingPlannerApi.save(table, row, v, reason),
    onSuccess: () => done(t(isNew ? 'toast.added' : 'toast.saved')),
  })
  const end = useMutation({
    mutationFn: () => sourcingPlannerApi.end(table, row!, reason),
    onSuccess: () => done(t(table === 'restricted' || table === 'bulky' ? 'toast.removed' : 'toast.ended')),
  })
  const busy = save.isPending || end.isPending
  const failure = save.error ?? end.error

  return (
    <SideSheet onClose={onClose} width="w-[38rem]" aria-labelledby="planner-sheet-title" data-row-sheet={row?.id ?? 'new'}>
      <SideSheetHeader
        titleId="planner-sheet-title"
        eyebrow={t(`tabs.${table}`)}
        title={row ? <RowLabel row={row} table={table} /> : t('sheet.newRow')}
        hint={row ? t('sheet.version', { at: fsi(row.setAt), by: row.setBy ? fsi(row.setBy) : t('seed') }) : undefined}
        closeLabel={t('actions.close')}
        onClose={onClose}
      />
      <div className={SHEET_BODY}>
        {ended && (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground" data-ended="">
            {t('sheet.ended', { at: fsi(row?.endedAt ?? ''), by: fsi(row?.endedBy ?? '') })}
          </p>
        )}
        {row?.flag && (
          <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800" data-flag={row.flag}>
            {t(`flag.${row.flag}`)}
          </p>
        )}
        {table === 'overrides' ? (
          <OverrideFields form={override} onChange={setOverride} isNew={isNew} readOnly={!canSave} />
        ) : (
          <GenericFields table={table} form={generic} onChange={setGeneric} isNew={isNew} readOnly={!canSave} today={today} />
        )}
        {(canSave || canEnd) && (
          <>
            {reasonKept ? (
              <Field label={t('reason.label')} hint={t('reason.hint')}>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" required data-reason="" />
              </Field>
            ) : (
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground" data-reason-none="">
                {t('reason.none')}
              </p>
            )}
            {problems.length > 0 && (
              <ul className="list-inside list-disc text-xs text-danger-800" data-problems="">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {failure && <ErrorBanner title={t('sheet.failed')} message={apiErrorMessage(failure, t('sheet.failedFallback'))} />}
            <div className="flex flex-wrap items-center gap-2">
              {canSave && (
                <Button variant="primary" disabled={values == null || noReason || busy} onClick={() => values && save.mutate(values)} data-save="">
                  {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {t(isNew ? 'actions.addRow' : 'actions.save')}
                </Button>
              )}
              {canEnd && (
                <Button variant="danger-outlined" disabled={noReason || busy} onClick={() => end.mutate()} data-end="">
                  {end.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {t(table === 'restricted' || table === 'bulky' ? 'actions.remove' : 'actions.end')}
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                {t('actions.cancel')}
              </Button>
            </div>
            {!isNew && canSave && <p className="text-[11px] text-muted-foreground">{t('sheet.neverInPlace')}</p>}
            {!isNew && !spec.changeable && <p className="text-[11px] text-muted-foreground">{t('sheet.listEntry')}</p>}
            {!isNew && !spec.endable && <p className="text-[11px] text-muted-foreground">{t('sheet.ruleNotEnded')}</p>}
          </>
        )}
        {row && (
          <section className="flex flex-col gap-2 border-t border-border/60 pt-3" data-row-history="">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <History className="h-3.5 w-3.5" aria-hidden />
              {t('sheet.history')}
            </h3>
            {history.isPending ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('sheet.historyLoading')}
              </p>
            ) : history.isError ? (
              <ErrorBanner title={t('sheet.historyFailed')} message={apiErrorMessage(history.error, t('sheet.failedFallback'))} />
            ) : history.data.changes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('sheet.noChanges')}</p>
            ) : (
              history.data.changes.map((c) => <ChangeCard key={c.id} table={table} change={c} />)
            )}
          </section>
        )}
      </div>
    </SideSheet>
  )

  function problemText(p: FormProblem): string {
    if (p.key === 'required' || p.key === 'badNumber') return t(`problems.${p.key}`, { field: t(`fields.${table}.${p.field}`) })
    return t(`problems.${p.key}`)
  }
}
