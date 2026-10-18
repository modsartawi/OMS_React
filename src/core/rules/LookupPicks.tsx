import { useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Search, X } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { RULE_MATERIAL_SEARCH_MIN, type RuleLookupItem, type RuleLookupKind } from '@/core/models/rule-campaign'
import { ruleLookupQuery } from '@/core/rules/api'
import { lookupName } from '@/core/rules/lookups'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'

// The builder's item picker (ticket 506), graduated here in ticket 503: the rule builder's
// "Certain items…" and Settings ▸ Audience (the workspace) and the Create dialog's template
// placeholders (the list) all pick codes with it, and a feature may not import another. Its words
// stay in the `campaign-workspace` namespace, where 506 put them.

/** The rule screens' input, select and textarea look. */
export const RULE_INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** A label and its controls on the editor's grid. */
function Step({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id} className="pt-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </>
  )
}

/**
 * One step of the chain: the codes picked so far, each removable, and a search on HQ's lookup
 * (`ruleLookupQuery`) whose hits add a code. A material is found by its SKU or its name, from
 * three characters on (HQ refuses a shorter material search).
 */
export default function LookupPicks({
  kind,
  label,
  value,
  onChange,
  after,
  empty,
  data,
  onPickHit,
}: {
  kind: RuleLookupKind
  /** A translated label, or the caller's data isolated in a `<bdi>`. */
  label: ReactNode
  value: string[]
  onChange: (codes: string[]) => void
  after?: ReactNode
  /** What an empty step reads; "Any" by default. */
  empty?: string
  data: string
  /**
   * What a hit does instead of adding its code to `value` — a collection's hit writes its
   * `articles` into the filter (2758: a filter keeps articles, not collections).
   */
  onPickHit?: (hit: RuleLookupItem) => void
}) {
  const { t, i18n } = useTranslation('campaign-workspace')
  const [find, setFind] = useState('')
  const q = useDebounced(find.trim(), 250)
  const tooShort = kind === 'materials' && q !== '' && q.length < RULE_MATERIAL_SEARCH_MIN
  const hits = useQuery({ ...ruleLookupQuery(kind, q), enabled: q !== '' && !tooShort })
  const id = `lookup-${data}-${useId()}`
  const listId = `${id}-hits`
  // Only while the search settled on what is typed: a pick clears the input, and its old hits go with it.
  const searching = q !== '' && !tooShort && q === find.trim()
  const found = hits.data ?? []

  return (
    <Step id={id} label={label}>
      <span className="flex flex-wrap items-center gap-1.5" data-picks={data}>
        {value.length === 0 && <span className="text-xs text-muted-foreground">{empty ?? t('filters.none')}</span>}
        {value.map((code) => (
          <span key={code} className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card py-0.5 ps-2 pe-0.5 text-xs" data-pick={code}>
            <code className="font-mono">
              <Ltr>{code}</Ltr>
            </code>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-danger-800"
              aria-label={t('filters.remove', { code: fsi(code) })}
              onClick={() => onChange(value.filter((c) => c !== code))}
              data-pick-remove={code}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
      </span>
      <span className="relative flex max-w-md items-center">
        <Search className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          id={id}
          type="search"
          dir="auto"
          className={`${RULE_INPUT} w-full ps-7`}
          value={find}
          placeholder={t(`filters.search.${kind}`)}
          aria-controls={searching ? listId : undefined}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            // Escape clears a search, and only that: no enclosing dialog closes (the keydown's
            // default is a native <dialog>'s cancel). Enter never submits an enclosing form (503's
            // template placeholders sit in one): a code is picked by its hit.
            if (e.key === 'Escape' && find) {
              e.preventDefault()
              e.stopPropagation()
              setFind('')
            }
            if (e.key === 'Enter') e.preventDefault()
          }}
          data-lookup={data}
        />
      </span>
      {tooShort && q === find.trim() && (
        <p className="text-xs text-muted-foreground" data-lookup-short={data}>
          {t('filters.searchTooShort')}
        </p>
      )}
      {searching && (
        <div id={listId} className="max-w-md rounded-md border border-border/60 bg-card" aria-live="polite" data-lookup-hits={data}>
          {hits.isPending ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('filters.searching')}</p>
          ) : hits.isError ? (
            <p className="px-2 py-1.5 text-xs text-danger-800" role="alert">
              {isBareDenial(hits.error) ? t('filters.lookupDenied') : apiErrorMessage(hits.error, t('filters.lookupFailed'))}
            </p>
          ) : found.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground" data-lookup-empty="">
              {t('filters.noHits')}
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {found.map((h) => {
                const picked = value.includes(h.code)
                return (
                  <li key={h.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-1 text-start text-sm hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent"
                      disabled={picked}
                      onClick={() => {
                        if (onPickHit) onPickHit(h)
                        else onChange([...value, h.code])
                        setFind('')
                      }}
                      data-lookup-hit={h.code}
                    >
                      <span className="flex-1">
                        <Ltr>{formatPair(h.code, lookupName(h, i18n.language))}</Ltr>
                      </span>
                      {picked && <Check className="h-3.5 w-3.5" aria-label={t('filters.picked')} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {after}
    </Step>
  )
}
