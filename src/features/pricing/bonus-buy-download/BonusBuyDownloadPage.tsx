import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Ban, Check, Loader2, X } from 'lucide-react'
import { ApiError } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { BbyOverrides } from '@/core/models/bonus-buy-download'
import { bonusBuyDownloadApi } from './api'

// Screen half of map 489 / spec 504 (ticket 516). Full-width single column so EVERY
// override field is visible at once (owner: attributes must show completely, no
// cramping). The client LOOPS one call per BBY (design 493): parse + de-dup the
// textarea, snapshot the overrides ONCE, then call download/delete per number,
// advancing a progress bar + a per-number status list. A mid-loop 502 (HANA
// middleware unreachable) halts with ONE banner, not N rows. Delete confirms first,
// listing the numbers. Self-guards on Access (spinner → denied card → content),
// sharing the ['bonus-buy-download','access'] key with the menu probe (issue 429).

// The six free-text override fields — always rendered; blank CLEARS (design 492). The
// four capped columns (Includes/Excludes/OriginFilter/StackingExcludes) get maxLength
// 300 per the contract; the two loyalty fields are uncapped like the WPF.
const TEXT_FIELDS: { key: keyof BbyOverrides; labelKey: string; maxLength?: number }[] = [
  { key: 'includes', labelKey: 'attributes.includes', maxLength: 300 },
  { key: 'excludes', labelKey: 'attributes.excludes', maxLength: 300 },
  { key: 'originFilter', labelKey: 'attributes.originFilter', maxLength: 300 },
  { key: 'stackingExcludes', labelKey: 'attributes.stackingExcludes', maxLength: 300 },
  { key: 'loyGroups', labelKey: 'attributes.loyGroups' },
  { key: 'loyTiers', labelKey: 'attributes.loyTiers' },
]

type RunAction = 'download' | 'delete'

// One per-number outcome, unified across download/delete: both carry a status +
// message; only download carries `overwritten`. `action` drives which status label +
// tally the row belongs to.
interface Row {
  bbyNumber: string
  status: string
  overwritten?: boolean
  message?: string | null
}

/** Split the textarea into a de-duplicated, order-preserving list of non-blank numbers. */
function parseNumbers(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split('\n')) {
    const n = line.trim()
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

export default function BonusBuyDownloadPage() {
  const { t } = useTranslation('bonus-buy-download')

  const access = useQuery({
    queryKey: ['bonus-buy-download', 'access'],
    queryFn: () => bonusBuyDownloadApi.access(),
  })

  // --- form state ---
  const [numbersText, setNumbersText] = useState('')
  const [text, setText] = useState<Record<string, string>>({
    includes: '',
    excludes: '',
    originFilter: '',
    stackingExcludes: '',
    loyGroups: '',
    loyTiers: '',
  })
  const [isStackable, setIsStackable] = useState(false)
  const [maxValue, setMaxValue] = useState('')
  const [score, setScore] = useState('')
  const [validFromTime, setValidFromTime] = useState('')
  const [validToTime, setValidToTime] = useState('')

  // --- run state ---
  const [running, setRunning] = useState(false)
  const [lastAction, setLastAction] = useState<RunAction | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [banner, setBanner] = useState<string | null>(null)

  const numbers = useMemo(() => parseNumbers(numbersText), [numbersText])
  const canRun = numbers.length > 0 && !running

  // Snapshot the overrides ONCE at the start of a run (design 493) — a blank/0/false
  // value is sent verbatim (it overwrites); the two times send null when blank (= keep
  // the HANA value). maxValue/score coerce blank ⇒ 0 (contract 492).
  function snapshotOverrides(): BbyOverrides {
    const num = (v: string) => {
      const n = Number(v.trim())
      return Number.isFinite(n) ? n : 0
    }
    return {
      includes: text.includes,
      excludes: text.excludes,
      originFilter: text.originFilter,
      stackingExcludes: text.stackingExcludes,
      loyGroups: text.loyGroups,
      loyTiers: text.loyTiers,
      isStackable,
      maxValue: num(maxValue),
      score: Math.trunc(num(score)),
      validFromTime: validFromTime.trim() || null,
      validToTime: validToTime.trim() || null,
    }
  }

  async function runDownload() {
    if (!canRun) return
    const attributes = snapshotOverrides()
    await runLoop('download', (bby) => bonusBuyDownloadApi.download(bby, attributes))
  }

  async function runDelete() {
    if (!canRun) return
    const ok = await confirmAction(
      t('confirm.deleteBody', { count: numbers.length, numbers: numbers.join(', ') }),
      t('confirm.deleteTitle'),
    )
    if (!ok) return
    await runLoop('delete', (bby) => bonusBuyDownloadApi.delete(bby))
  }

  // The client loop: sequential, one call per number. A per-number business outcome
  // (succeeded / notFoundInHana / failed / deleted / notFound) is an in-band 200 and
  // becomes a row. A 502 (HANA middleware unreachable) is infra, not a per-number
  // outcome — it HALTS the loop and shows one banner rather than N identical rows.
  async function runLoop(action: RunAction, call: (bby: string) => Promise<Row>) {
    setRunning(true)
    setLastAction(action)
    setBanner(null)
    setRows([])
    setProgress({ done: 0, total: numbers.length })

    for (let i = 0; i < numbers.length; i++) {
      const bby = numbers[i]
      try {
        const result = await call(bby)
        setRows((r) => [...r, result])
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 502) {
          setBanner(t('banner.middlewareDown'))
          setProgress(null)
          break
        }
        // Any other unexpected throw is treated as this number's failure so the loop
        // still advances (per-number faults are normally in-band 200 already).
        const message = err instanceof ApiError ? err.message : String(err)
        setRows((r) => [...r, { bbyNumber: bby, status: 'failed', overwritten: false, message }])
      }
      setProgress((p) => (p ? { ...p, done: i + 1 } : p))
    }

    setRunning(false)
  }

  // --- tally over the accumulated rows ---
  const counts = useMemo(() => {
    const c = { succeeded: 0, deleted: 0, notFoundInHana: 0, notFound: 0, failed: 0, overwritten: 0 }
    for (const r of rows) {
      if (r.status === 'succeeded') {
        c.succeeded++
        if (r.overwritten) c.overwritten++
      } else if (r.status === 'deleted') c.deleted++
      else if (r.status === 'notFoundInHana') c.notFoundInHana++
      else if (r.status === 'notFound') c.notFound++
      else if (r.status === 'failed') c.failed++
    }
    return c
  }, [rows])

  // --- access gate (spinner → denied → content) ---
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (access.data?.screenAllowed !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* BBY numbers */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bby-numbers" className="text-sm font-medium">
          {t('numbers.label')}
        </label>
        <textarea
          id="bby-numbers"
          className="min-h-[8rem] w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          placeholder={t('numbers.placeholder')}
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          disabled={running}
          spellCheck={false}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('numbers.hint')}</span>
          <span className="tabular-nums">{t('numbers.counted', { count: numbers.length })}</span>
        </div>
      </div>

      {/* Attributes (overrides) — always fully visible */}
      <fieldset className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" disabled={running}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-medium">{t('attributes.legend')}</legend>
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('attributes.clearsWarning')}
          </span>
        </div>

        {/* six free-text fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t(f.labelKey)}
              <input
                type="text"
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
                value={text[f.key as string]}
                maxLength={f.maxLength}
                onChange={(e) => setText((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        {/* numeric + boolean + times */}
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('attributes.maxValue')}
            <input
              type="number"
              inputMode="decimal"
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('attributes.score')}
            <input
              type="number"
              inputMode="numeric"
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('attributes.validFromTime')}
            <input
              type="time"
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
              value={validFromTime}
              onChange={(e) => setValidFromTime(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('attributes.validToTime')}
            <input
              type="time"
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
              value={validToTime}
              onChange={(e) => setValidToTime(e.target.value)}
            />
          </label>
          <label className="flex h-8 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={isStackable}
              onChange={(e) => setIsStackable(e.target.checked)}
            />
            {t('attributes.isStackable')}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t('attributes.timeHint')}</p>
      </fieldset>

      {/* actions */}
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void runDownload()} disabled={!canRun}>
          {running && lastAction === 'download' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('actions.download')}
        </Button>
        <Button variant="danger" onClick={() => void runDelete()} disabled={!canRun}>
          {running && lastAction === 'delete' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('actions.delete')}
        </Button>
      </div>

      {/* results region — below the form, never squeezing it */}
      {(progress || rows.length > 0 || banner) && (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
          {banner && <ErrorBanner message={banner} className="p-4" />}

          {progress && (
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                {t('progress.counter', { done: progress.done, total: progress.total })}
              </span>
            </div>
          )}

          {rows.length > 0 && lastAction && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {lastAction === 'download' ? (
                <>
                  <span className="text-emerald-700 dark:text-emerald-400">{t('tally.succeeded', { count: counts.succeeded })}</span>
                  <span className="text-muted-foreground">{t('tally.notFoundInHana', { count: counts.notFoundInHana })}</span>
                  <span className="text-red-700 dark:text-red-400">{t('tally.failed', { count: counts.failed })}</span>
                  <span className="text-muted-foreground">{t('tally.overwritten', { count: counts.overwritten })}</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-700 dark:text-emerald-400">{t('tally.deleted', { count: counts.deleted })}</span>
                  <span className="text-muted-foreground">{t('tally.notFound', { count: counts.notFound })}</span>
                  <span className="text-red-700 dark:text-red-400">{t('tally.failed', { count: counts.failed })}</span>
                </>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {rows.map((r, i) => (
                <StatusRow key={`${r.bbyNumber}-${i}`} row={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// One per-number status line: number + an icon-tinted status + the failure message.
function StatusRow({ row }: { row: Row }) {
  const { t } = useTranslation('bonus-buy-download')
  const ok = row.status === 'succeeded' || row.status === 'deleted'
  const failed = row.status === 'failed'

  const label =
    row.status === 'succeeded'
      ? row.overwritten
        ? t('status.succeededOverwritten')
        : t('status.succeeded')
      : t(`status.${row.status}`, { defaultValue: row.status })

  const Icon = ok ? Check : failed ? X : Ban
  const tone = ok
    ? 'text-emerald-700 dark:text-emerald-400'
    : failed
      ? 'text-red-700 dark:text-red-400'
      : 'text-muted-foreground'

  return (
    <li className="flex items-center gap-2">
      <span className="w-24 shrink-0 font-mono tabular-nums">{row.bbyNumber}</span>
      <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden />
      <span className={tone}>{label}</span>
      {failed && row.message ? <span className="text-muted-foreground">— {row.message}</span> : null}
    </li>
  )
}
