import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardReasonsQuery } from '@/core/insurance-rules/order-guards-api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import { saysIn } from '@/core/rules/sentence'
import { RuleId } from '@/core/insurance-rules/badges'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import type { Severity } from '@/core/ui/severity'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { REVIEW_KEY, reviewApi } from './api'
import { REVIEW_KINDS, type ReviewMark, type ReviewRow } from './model'
import { EMPTY_REVIEW_QUERY, reviewFromParams, reviewToParams, type ReviewQuery } from './review-query'
import { Code, ReasonText } from './shared'
import { DeniedCard, TD, TH } from '@/core/insurance-rules/parts'

/**
 * Insurance rules ▸ Review — `/insurance-rules/review` (BackOffice 3141, oms ticket 614). Overrides, HQ
 * exceptions used and UNCHECKED requests, filtered by kind, pharmacist, store, rule and reason (all in the
 * address); a reviewer marks each row OK or Questioned with a note.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on the read is "You do not have access".
 */
export default function ReviewPage() {
  const { t } = useTranslation('insurance-review')
  return (
    <section className="flex h-full w-full flex-col gap-4" data-review-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('review.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('review.lede')}</p>
      </header>
      <Review />
    </section>
  )
}

const MARK_SEV: Record<ReviewMark, Severity> = { ok: 'ok', questioned: 'warn' }

function Review() {
  const { t, i18n } = useTranslation('insurance-review')
  const { query, update, changedFromOutside } = useUrlQuery(reviewFromParams, reviewToParams)
  const [draft, setDraft] = useState<ReviewQuery>(query)
  useEffect(() => {
    if (changedFromOutside()) setDraft(query)
  }, [query, changedFromOutside])
  const rows = useQuery({ queryKey: [...REVIEW_KEY, reviewToParams(query).toString()], queryFn: () => reviewApi.review(query), retry: false })
  const reasons = useQuery(guardReasonsQuery())
  const draftDoc = useQuery(guardDraftQuery())
  const [marking, setMarking] = useState<{ row: ReviewRow; mark: ReviewMark } | null>(null)

  const apply = (next: ReviewQuery) => {
    setDraft(next)
    update(() => next)
  }
  const reasonList = reasons.data?.reason ?? []

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3"
        data-review-filters=""
        onSubmit={(e) => {
          e.preventDefault()
          apply(draft)
        }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t('filter.kind')}</span>
          <div className="inline-flex gap-1" role="group" aria-label={t('filter.kind')}>
            {(['', ...REVIEW_KINDS] as const).map((k) => (
              <Chip key={k || 'all'} data-kind-filter={k} on={query.kind === k} onClick={() => apply({ ...draft, kind: k })}>
                {k ? t(`kind.${k}`) : t('filter.allKinds')}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={t('filter.pharmacist')}>
          <Input dir="ltr" value={draft.pharmacist} onChange={(e) => setDraft({ ...draft, pharmacist: e.target.value })} data-filter="pharmacist" />
        </Field>
        <Field label={t('filter.store')}>
          <Input dir="ltr" value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} data-filter="store" />
        </Field>
        <Field label={t('filter.rule')}>
          <Select value={draft.rule} onChange={(e) => apply({ ...draft, rule: e.target.value })} data-filter="rule">
            <option value="">{t('filter.allRules')}</option>
            {(draftDoc.data?.rules ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {fsi(formatPair(r.id, saysIn(r.name, i18n.language)))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filter.reason')}>
          <Select value={draft.reason} onChange={(e) => apply({ ...draft, reason: e.target.value })} data-filter="reason">
            <option value="">{t('filter.allReasons')}</option>
            {reasonList.map((r) => (
              <option key={r.code} value={r.code}>
                {fsi(formatPair(r.code, saysIn(r, i18n.language)))}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary" data-review-search="">
          {t('filter.search')}
        </Button>
        <Button variant="text" onClick={() => apply(EMPTY_REVIEW_QUERY)} data-review-clear="">
          {t('filter.clear')}
        </Button>
      </form>

      {rows.isError && isBareDenial(rows.error) ? (
        <DeniedCard ns="insurance-review" hook="review-denied" />
      ) : rows.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(rows.error, t('review.failed'))} />
      ) : !rows.data ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('review.loading')}
        </div>
      ) : rows.data.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-review-empty="">
          {t('review.empty')}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-review-count={rows.data.length}>
            {t('review.rows', { count: rows.data.length })}
          </p>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-review-table="">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr>
                  {(['at', 'kind', 'store', 'pharmacist', 'patient', 'rule', 'item', 'reason', 'note', 'mark', 'actions'] as const).map((c) => (
                    <th key={c} className={TH}>
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.data.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-b-0" data-review-row={r.id} data-kind={r.kind}>
                    <td className={TD}>
                      <Ltr>{formatDateTime(r.at)}</Ltr>
                    </td>
                    <td className={TD} data-col="kind">
                      {t(`kind.${r.kind}`)}
                      {r.exceptionId && (
                        <span className="ms-1 text-xs text-muted-foreground" data-exception-id={r.exceptionId}>
                          <Ltr>{`#${r.exceptionId}`}</Ltr>
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <Code value={r.store} hook="store" />
                    </td>
                    <td className={TD}>
                      <Code value={r.pharmacist} hook="pharmacist" />
                    </td>
                    <td className={TD}>
                      <Code value={r.patientKey} hook="patient" />
                    </td>
                    <td className={TD} data-col="rule">
                      {r.ruleId ? <RuleId id={r.ruleId} /> : <span className="text-xs text-muted-foreground">{t('mark.noRule')}</span>}
                    </td>
                    <td className={TD} data-col="item">
                      {r.item && <Ltr>{formatPair(r.item.code, r.item.name)}</Ltr>}
                    </td>
                    <td className={TD} data-col="reason">
                      <ReasonText code={r.reason} reasons={reasonList} />
                    </td>
                    <td className={TD} data-col="note">
                      {r.note && <bdi>{r.note}</bdi>}
                    </td>
                    <td className={TD} data-col="mark" data-mark={r.mark ?? ''}>
                      <StatusBadge sev={r.mark ? MARK_SEV[r.mark] : 'mute'}>{t(r.mark ? `mark.${r.mark}` : 'mark.none')}</StatusBadge>
                      {r.mark && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {r.markNote && (
                            <bdi className="block" data-mark-note="">
                              {r.markNote}
                            </bdi>
                          )}
                          {r.markedBy && (
                            <span data-marked-by="">
                              {t('mark.by')} <Ltr>{r.markedBy}</Ltr>
                              {r.markedAt && (
                                <>
                                  {' '}
                                  <Ltr>{formatDateTime(r.markedAt)}</Ltr>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex gap-1">
                        <Button variant="outlined" onClick={() => setMarking({ row: r, mark: 'ok' })} data-mark-action="ok">
                          {t('mark.ok')}
                        </Button>
                        <Button variant="outlined" onClick={() => setMarking({ row: r, mark: 'questioned' })} data-mark-action="questioned">
                          {t('mark.questioned')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {marking && <MarkDialog row={marking.row} mark={marking.mark} onClose={() => setMarking(null)} />}
    </div>
  )
}

/** Mark one row OK or Questioned. A Questioned mark needs a note (🚩 guess; the brief says "with a note"). */
function MarkDialog({ row, mark, onClose }: { row: ReviewRow; mark: ReviewMark; onClose: () => void }) {
  const { t } = useTranslation('insurance-review')
  const qc = useQueryClient()
  const [note, setNote] = useState(row.mark === mark ? (row.markNote ?? '') : '')
  const [tried, setTried] = useState(false)
  const needsNote = mark === 'questioned' && !note.trim()
  const save = useMutation({
    mutationFn: () => reviewApi.mark(row.id, { mark, note: note.trim() }),
    onSuccess: () => {
      notify.success(t('mark.saved'))
      void qc.invalidateQueries({ queryKey: REVIEW_KEY })
      onClose()
    },
    onError: (err) => notify.apiError(t('mark.failed'), err, t('mark.failed')),
  })
  return (
    <Modal
      open
      onClose={onClose}
      title={t(mark === 'ok' ? 'mark.dialogOk' : 'mark.dialogQuestioned')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('mark.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending}
            data-mark-save=""
            onClick={() => {
              setTried(true)
              if (!needsNote) save.mutate()
            }}
          >
            {t('mark.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2" data-mark-dialog={mark}>
        <p className="text-xs text-muted-foreground">
          {t(`kind.${row.kind}`)} <Ltr>{formatPair(row.ruleId ?? '', formatDateTime(row.at))}</Ltr>
        </p>
        <Field
          label={t('mark.note')}
          error={
            tried && needsNote ? (
              <span role="alert" data-mark-problem="">
                {t('mark.noteRequired')}
              </span>
            ) : undefined
          }
        >
          <Textarea className="h-20" value={note} onChange={(e) => setNote(e.target.value)} data-mark-note-input="" dir="auto" />
        </Field>
      </div>
    </Modal>
  )
}
