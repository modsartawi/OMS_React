import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PatternCaseDetail } from '@/core/models/insurance-patterns'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { CASE_READS_KEY, patternsApi, PATTERNS_KEY } from './api'
import { draftAfterSave, MARK_STATUSES, markProblem, NOTE_MAX, type MarkDraft } from './mark'
import { statusSev, statusText } from './words'

const EMPTY: MarkDraft = { status: '', note: '' }

/**
 * A case's marks (oms 922; BackOffice spec 4050 story 19, door 4053 `POST …/Marks`): the team's marks, newest first, and
 * the form that sets watching, cleared, confirmed or closed with a note saying why. A saved mark re-reads the case (its
 * status and marks) and the list. A refusal is the server's own sentence, and the draft stays.
 */
export default function CaseMarks({ detail }: { detail: PatternCaseDetail }) {
  const { t } = useTranslation('insurance-patterns')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<MarkDraft>(EMPTY)
  // A problem shows once the reviewer tried to save, not while they are still typing.
  const [tried, setTried] = useState(false)
  const problem = markProblem(draft)

  const save = useMutation({
    mutationFn: (sent: MarkDraft) => patternsApi.mark(detail.caseId, sent),
    onSuccess: (_mark, sent) => {
      // Only what was sent is cleared: words typed while the mark was saving stay (review 8).
      setDraft((current) => draftAfterSave(current, sent))
      setTried(false)
      toast.success(t('case.marks.saved'), { description: fsi(detail.caseNumber) })
      // The case reads by prefix: the screen's read is keyed by the id as the route spelled it (review 10).
      void queryClient.invalidateQueries({ queryKey: CASE_READS_KEY })
      void queryClient.invalidateQueries({ queryKey: [...PATTERNS_KEY, 'cases'] })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problem || save.isPending) return
    save.mutate(draft)
  }

  // The problem in words: the save button's reason while it is held (`title`), and the field's error once tried.
  const problemText =
    problem === 'status'
      ? t('case.marks.problem.status')
      : problem === 'note'
        ? t('case.marks.problem.note')
        : problem === 'tooLong'
          ? t('case.marks.problem.tooLong', { max: fsi(NOTE_MAX) })
          : undefined
  const noteError = tried && (problem === 'note' || problem === 'tooLong') ? problemText : undefined
  const marks = [...detail.marks].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="pattern-marks-title" data-testid="pattern-marks">
      <h3 id="pattern-marks-title" className="text-sm font-semibold">
        {t('case.marks.title')}
      </h3>

      <form className="flex flex-col gap-2" onSubmit={submit} noValidate data-testid="pattern-mark-form">
        <Field label={t('case.marks.status')} error={tried && problem === 'status' ? problemText : undefined}>
          <Select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as MarkDraft['status'] }))}
            data-testid="pattern-mark-status"
          >
            <option value="" disabled>
              {t('case.marks.choose')}
            </option>
            {MARK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('case.marks.note')} hint={t('case.marks.noteHint')} error={noteError}>
          <Textarea
            rows={3}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            className="w-full"
            data-testid="pattern-mark-note"
          />
        </Field>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${draft.note.trim().length > NOTE_MAX ? 'text-danger-800' : 'text-muted-foreground'}`} data-testid="pattern-mark-count">
            <Ltr>{formatCount(draft.note.trim().length, NOTE_MAX)}</Ltr>
          </span>
          <Button type="submit" aria-disabled={problem !== null || save.isPending} title={problemText} data-testid="pattern-mark-save">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
            {t(save.isPending ? 'case.marks.saving' : 'case.marks.save')}
          </Button>
        </div>
        {save.isError && <ErrorBanner title={t('case.marks.failed')} message={apiErrorMessage(save.error, t('case.marks.failed'))} className="p-2" />}
      </form>

      {marks.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="pattern-marks-none">
          {t('case.marks.none')}
        </p>
      ) : (
        <ol className="flex flex-col gap-2" data-testid="pattern-mark-list">
          {marks.map((m, i) => (
            <li key={`${m.at}-${i}`} className="border-t border-border/60 pt-2 text-sm" data-testid="pattern-mark" data-status={m.status}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge sev={statusSev(m.status)}>{statusText(t, m.status)}</StatusBadge>
                <span className="text-xs text-muted-foreground">{t('case.marks.byAt', { by: fsi(m.by), at: fsi(formatDateTime(m.at)) })}</span>
              </div>
              <p className="mt-1 whitespace-pre-line">
                <bdi>{m.note}</bdi>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
