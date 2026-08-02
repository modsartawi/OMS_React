import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import { diagnosesKey, morphsKey, nphiesLookupApi } from '@/core/nphies/api'
import type { NphiesSessionDiagnosis } from '@/core/models/nphies'
import {
  DIAGNOSIS_TYPES_OFFERED,
  addDiagnosis,
  choosePrincipal,
  isPrincipal,
  morphologyField,
  removeDiagnosis,
  setMorphology,
  type DiagnosisRefusal,
} from './diagnosis-form'

/** How long a keystroke waits before it becomes a search. The door answers a
 *  `Take(500)` scan per call, so a request per character would ask it to do that
 *  five times to spell `C50.9`. */
const SEARCH_DEBOUNCE_MS = 250
/** Below this the search is not run at all — one character matches most of the
 *  ICD catalogue, which is a slow way to answer "nothing useful". */
const MIN_SEARCH_LENGTH = 2

/**
 * **The diagnoses that justify the request** (ticket 219, spec 209 stories 42–45,
 * contract v1.0 §1.2's `setHeader`).
 *
 * A compact row above a small table, against the code lookup — not a modal to
 * hunt through. Two structural choices, both of which **replace a validation with
 * a control**:
 *
 * - 🚩 **Principal is a radio in the row**, not a fourth value of the type
 *   dropdown, so choosing one deselects the other and "exactly one, mandatory"
 *   is enforced by the control rather than by a message box after submit.
 * - 🚩 **The morphology field does not exist unless the principal needs one.** It
 *   appears and disappears with the radio, carrying its own *required because…*
 *   heading. The old screen let the agent submit and then refused; making the
 *   requirement arrive **with its cause** is the same rule stated forward.
 *
 * Plus the **exception prescription** checkbox — one item group for the whole
 * request. All of its frightening-looking branches in the source sat inside the
 * direct-dispense path and died with it, so what is left really is a checkbox.
 *
 * Every change sends the diagnoses **whole** on `setHeader`; the engine answers
 * with the whole state and this block redraws from it.
 */
export default function Diagnoses({
  diagnoses,
  exceptionPrescription,
  needsMorph,
  onCommit,
  onExceptionPrescription,
  busy,
  disabled,
}: {
  diagnoses: NphiesSessionDiagnosis[]
  exceptionPrescription: boolean
  /**
   * 🚩 `isNeedMorph` for the **principal's own code**, straight off the diagnosis
   * lookup — the service's answer to "is this a neoplasm", never a code range
   * read in the browser. `undefined` while that lookup is in flight.
   *
   * It is resolved by the page rather than here because the submit gate has to
   * ask the same question, and two components asking it separately is how the
   * banner and the field come to disagree.
   */
  needsMorph: boolean | undefined
  /** The list, whole — there is no add-one or remove-one verb (§1.2). */
  onCommit: (next: NphiesSessionDiagnosis[]) => void
  onExceptionPrescription: (next: boolean) => void
  busy: boolean
  disabled: boolean
}) {
  const { t } = useTranslation('authorizations')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState('')
  const [type, setType] = useState<string>(DIAGNOSIS_TYPES_OFFERED[0])
  const [refusal, setRefusal] = useState<DiagnosisRefusal | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  /** 🚩 The diagnosis door is a **search**, not a catalogue: it answers `[]` for
   *  an empty query and 500 rows otherwise, so the picker types and the server
   *  answers. Nothing here holds "all diagnoses". */
  const matches = useQuery({
    queryKey: diagnosesKey(query),
    queryFn: () => nphiesLookupApi.diagnoses(query),
    enabled: query.length >= MIN_SEARCH_LENGTH,
    staleTime: 5 * 60 * 1000,
  })

  const morphology = morphologyField(diagnoses, needsMorph)

  function add() {
    const row = (matches.data ?? []).find((match) => match.diagnosisCode === picked)
    const answer = addDiagnosis(diagnoses, {
      code: row?.diagnosisCode ?? picked,
      description: row?.diagnosisDescription ?? '',
      type,
    })
    if (!answer.ok) {
      setRefusal(answer.reason)
      return
    }
    setRefusal(null)
    setPicked('')
    setSearch('')
    onCommit(answer.diagnoses)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('form.diagnoses.title')}</h2>
        {busy && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('form.diagnoses.saving')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('form.diagnoses.hint')}</p>

      {/* The compact add row — a search, what it found, the type, and Add. */}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('form.diagnoses.search')}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder={t('form.diagnoses.searchPlaceholder')}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('form.diagnoses.match')}
          <select
            value={picked}
            // Named explicitly: a wrapping label leaves a select's accessible
            // name carrying its option list, which is not a name.
            aria-label={t('form.diagnoses.match')}
            onChange={(event) => setPicked(event.target.value)}
            disabled={disabled || (matches.data ?? []).length === 0}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">
              {matches.isFetching
                ? t('form.diagnoses.searching')
                : query.length < MIN_SEARCH_LENGTH
                  ? t('form.diagnoses.typeToSearch')
                  : (matches.data ?? []).length === 0
                    ? t('form.diagnoses.noMatches')
                    : t('form.diagnoses.chooseMatch')}
            </option>
            {(matches.data ?? []).map((match) => (
              <option key={match.diagnosisCode} value={match.diagnosisCode}>
                {t('form.diagnoses.matchOption', {
                  code: match.diagnosisCode,
                  description: match.diagnosisDescription,
                })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-40 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('form.diagnoses.type')}
          <select
            value={type}
            aria-label={t('form.diagnoses.type')}
            onChange={(event) => setType(event.target.value)}
            disabled={disabled}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {/* 🚩 Principal is deliberately NOT here — it is the radio below. */}
            {DIAGNOSIS_TYPES_OFFERED.map((offered) => (
              <option key={offered} value={offered}>
                {t(`form.diagnoses.types.${offered}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" className="h-8" disabled={disabled || picked === ''}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('form.diagnoses.add')}
        </Button>
      </form>

      {refusal && (
        <p role="alert" className="flex items-start gap-2 text-xs text-attention-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t(`form.diagnoses.refusal.${refusal}`)}</span>
        </p>
      )}

      {matches.isError && (
        <p className="text-xs text-muted-foreground">
          {apiErrorMessage(matches.error, t('errors.diagnosesFailed'))}
        </p>
      )}

      {diagnoses.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('form.diagnoses.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table
            aria-label={t('form.diagnoses.tableLabel')}
            className="w-full min-w-[34rem] border-collapse text-sm"
          >
            <thead>
              <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
                <th className="px-2 py-1.5 text-start font-medium">
                  {t('form.diagnoses.principal')}
                </th>
                <th className="px-2 py-1.5 text-start font-medium">{t('form.diagnoses.type')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('form.diagnoses.code')}</th>
                <th className="px-2 py-1.5 text-start font-medium">
                  {t('form.diagnoses.description')}
                </th>
                <th className="px-2 py-1.5 text-start font-medium">{t('form.diagnoses.acts')}</th>
              </tr>
            </thead>
            <tbody>
              {diagnoses.map((diagnosis) => (
                <tr key={diagnosis.code} className="border-b border-border/40 last:border-b-0">
                  <td className="px-2 py-2">
                    {/* 🚩 The radio IS the uniqueness rule. One name, one checked
                        input — choosing this one deselects whichever held it. */}
                    <input
                      type="radio"
                      name="nphies-principal-diagnosis"
                      checked={isPrincipal(diagnosis)}
                      disabled={disabled || busy}
                      aria-label={t('form.diagnoses.principalFor', { code: diagnosis.code })}
                      onChange={() => onCommit(choosePrincipal(diagnoses, diagnosis.code))}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {isPrincipal(diagnosis)
                      ? t('form.diagnoses.types.principal')
                      : t(`form.diagnoses.types.${diagnosis.type}`, {
                          defaultValue: diagnosis.type,
                        })}
                  </td>
                  <td className="px-2 py-2 font-medium tabular-nums">{diagnosis.code}</td>
                  <td className="px-2 py-2 text-muted-foreground">{diagnosis.description}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => onCommit(removeDiagnosis(diagnoses, diagnosis.code))}
                      className="inline-flex h-7 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('form.diagnoses.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 🚩 The field that exists only because of the diagnosis above it, and
          says so. It is not disabled while the principal is a plain diagnosis —
          it is absent. */}
      {morphology.visible && (
        <MorphologyPicker
          because={t('form.diagnoses.morphology.because', {
            code: morphology.becauseCode,
            description: morphology.becauseDescription,
          })}
          value={morphology.morphology}
          disabled={disabled || busy}
          onPick={(next) => onCommit(setMorphology(diagnoses, next))}
        />
      )}

      {/* One item group for the whole request. One checkbox and one grouping
          rule — everything else this flag used to reach died with direct
          dispense. */}
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={exceptionPrescription}
          disabled={disabled || busy}
          onChange={(event) => onExceptionPrescription(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium text-foreground">
            {t('form.diagnoses.exceptionPrescription')}
          </span>{' '}
          {t('form.diagnoses.exceptionPrescriptionHint')}
        </span>
      </label>
    </section>
  )
}

/**
 * The morphology picker — the same search shape as the diagnosis row, against
 * `GET Nphies/Morphs?query=`.
 *
 * It carries its own **required because…** heading: the requirement and its cause
 * arrive together, which is the whole difference from WPF's refusal after submit.
 */
function MorphologyPicker({
  because,
  value,
  disabled,
  onPick,
}: {
  because: string
  value: string
  disabled: boolean
  onPick: (next: string) => void
}) {
  const { t } = useTranslation('authorizations')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const matches = useQuery({
    queryKey: morphsKey(query),
    queryFn: () => nphiesLookupApi.morphs(query),
    enabled: query.length >= MIN_SEARCH_LENGTH,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-attention-border bg-attention-050 p-3">
      <p className="text-xs font-medium text-attention-800">{because}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-attention-800">
          {t('form.diagnoses.morphology.search')}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder={t('form.diagnoses.morphology.searchPlaceholder')}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-medium text-attention-800">
          {t('form.diagnoses.morphology.label')}
          <select
            value={value}
            disabled={disabled}
            aria-label={t('form.diagnoses.morphology.label')}
            onChange={(event) => onPick(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {/* The chosen code stays selectable after the search that found it has
                been cleared — otherwise the box would empty itself on a re-render. */}
            <option value="">{t('form.diagnoses.morphology.none')}</option>
            {value !== '' && !(matches.data ?? []).some((row) => row.morphCode === value) && (
              <option value={value}>{value}</option>
            )}
            {(matches.data ?? []).map((row) => (
              <option key={row.morphCode} value={row.morphCode}>
                {t('form.diagnoses.morphology.option', {
                  code: row.morphCode,
                  description: row.morphDescription,
                })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {matches.isError && (
        <p className="text-xs text-attention-800">
          {apiErrorMessage(matches.error, t('errors.morphsFailed'))}
        </p>
      )}
    </div>
  )
}
