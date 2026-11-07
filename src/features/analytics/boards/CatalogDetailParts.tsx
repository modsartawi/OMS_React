import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsLabel } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'

/**
 * The pieces every Catalog detail pane is built from (ticket 841): the shell with its kind, title, machine key and
 * an **actions slot** (843's author actions, 844's curator raw preview — each in its own kind's detail file), and
 * the fact rows below it.
 */
export function DetailShell({
  kind,
  title,
  machineKey,
  actions,
  children,
  data,
}: {
  /** The node kind's name, already translated. */
  kind: string
  /** The node's name in both languages (a label) or its machine key alone. */
  title: AnalyticsLabel | null
  machineKey: string
  /** Buttons for this node (843/844). `null`/absent draws nothing. */
  actions?: ReactNode
  children?: ReactNode
  data: string
}) {
  return (
    <article className="flex min-w-0 flex-col gap-4" data-catalog-detail={data}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kind}</p>
          <h2 className="text-base font-semibold tracking-tight">{title ? <Both says={title} /> : <Ltr>{machineKey}</Ltr>}</h2>
          {title && (
            <p className="mt-0.5 text-xs text-muted-foreground" data-catalog-detail-key>
              <Ltr>{machineKey}</Ltr>
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2" data-catalog-actions>
            {actions}
          </div>
        )}
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">{children}</dl>
    </article>
  )
}

/** One fact: its name and its value. */
export function Fact({ label, children, data }: { label: string; children: ReactNode; data?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0" data-catalog-fact={data}>
        {children}
      </dd>
    </>
  )
}

/** A bilingual text, both languages; blank in both → the "not given" words. */
export function BothOrNone({ says }: { says: AnalyticsLabel | null | undefined }) {
  const { t } = useTranslation('boards')
  if (!says || (!says.en && !says.ar)) return <span className="text-muted-foreground">{t('catalog.notGiven')}</span>
  return <Both says={says} />
}

/** English-only server text (a dbt description, a grain): free text, isolated, never keyed. */
export function ServerText({ text }: { text: string }) {
  const { t } = useTranslation('boards')
  return text ? <bdi>{text}</bdi> : <span className="text-muted-foreground">{t('catalog.notGiven')}</span>
}

/** A list of machine keys, each its own isolated value. */
export function KeyList({ keys, empty, data }: { keys: readonly string[]; empty: string; data?: string }) {
  if (keys.length === 0) return <span className="text-muted-foreground">{empty}</span>
  return (
    <ul className="flex flex-col gap-0.5" data-catalog-keys={data}>
      {keys.map((k) => (
        <li key={k}>
          <Ltr>{k}</Ltr>
        </li>
      ))}
    </ul>
  )
}

/**
 * Both languages, English then Arabic, each free text in its own isolate — like `@/core/rules/SaysBoth`, but each
 * line sized to its text and aligned to the start, so under RTL the English does not drift to the far end.
 */
function Both({ says }: { says: AnalyticsLabel }) {
  return (
    <span className="flex flex-col items-start" data-says="">
      {says.en && (
        <bdi lang="en" data-says-en="">
          {says.en}
        </bdi>
      )}
      {says.ar && (
        <bdi dir="rtl" lang="ar" data-says-ar="">
          {says.ar}
        </bdi>
      )}
    </span>
  )
}
