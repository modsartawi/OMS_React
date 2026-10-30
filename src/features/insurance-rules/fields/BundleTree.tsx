import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

import { factKey } from '@/core/insurance-rules/fhir-catalog'
import SaysBoth from '@/core/rules/SaysBoth'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { fieldsApi } from './api'
import { bundleParam, clickOutcome, treeRows, type ClickOutcome, type ExistingField, type TreeRow } from './bundle-tree'
import { failureWords } from './failure-words'
import RawPathDialog from './RawPathDialog'

function NodeRow({ row, busy, onToggle, onPick }: { row: TreeRow; busy: boolean; onToggle: () => void; onPick: () => void }) {
  const { t } = useTranslation('insurance-fields')
  return (
    <li className="flex min-h-7 flex-wrap items-center gap-2 px-2 py-0.5 text-xs" style={{ paddingInlineStart: `${row.depth + 0.5}rem` }} data-tree-node={row.nodeRef} data-tree-depth={row.depth}>
      {row.expandable ? (
        <IconButton label={t(row.expanded ? 'tree.collapse' : 'tree.expand')} size="compact" aria-expanded={row.expanded} onClick={onToggle} data-tree-toggle="">
          {/* Points along the reading direction, so it mirrors under RTL. */}
          {row.expanded ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5 rtl:-scale-x-100" aria-hidden />}
        </IconButton>
      ) : (
        <span className="w-5 shrink-0" aria-hidden />
      )}
      <code className="font-medium" data-tree-label="">
        <Ltr>{row.label}</Ltr>
      </code>
      <code className="text-muted-foreground" data-tree-type="">
        <Ltr>{row.fhirType}</Ltr>
      </code>
      {/* A bundle value is shown and nothing else: never in a title, a key or the URL. */}
      {row.pickable ? (
        <Button variant="text" aria-disabled={busy} aria-label={t('tree.pickName', { name: fsi(row.label) })} onClick={onPick} data-tree-pick="">
          {row.value === null ? t('tree.pickWhole') : <bdi data-tree-value="">{row.value}</bdi>}
        </Button>
      ) : (
        row.value !== null && (
          <bdi className="text-muted-foreground" data-tree-value="">
            {row.value}
          </bdi>
        )
      )}
    </li>
  )
}

function ExistingNotice({ field }: { field: ExistingField }) {
  const { t } = useTranslation('insurance-fields')
  const key = factKey(field)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-attention-050 p-2 text-xs text-attention-800" role="status" data-tree-existing={key}>
      <span className="font-semibold">{t('tree.existing')}</span>
      <SaysBoth says={field.label} />
      <code>
        <Ltr>{key}</Ltr>
      </code>
      <Button
        variant="text"
        onClick={() => document.querySelector(`[data-catalog-row="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center' })}
        data-tree-existing-show=""
      >
        {t('tree.existingShow')}
      </Button>
    </div>
  )
}

function TreeView({ bundle }: { bundle: string }) {
  const { t } = useTranslation('insurance-fields')
  // Read under the grant and logged by the door, so it is not kept: gone as soon as this view is.
  const tree = useQuery({ queryKey: ['insurance-fields', 'bundle-tree', bundle], queryFn: () => fieldsApi.tree(bundle), gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: false })
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [outcome, setOutcome] = useState<ClickOutcome | null>(null)
  const click = useMutation({ mutationFn: (nodeRef: string) => fieldsApi.treeClick(bundle, nodeRef) })

  if (tree.isError) return <ErrorBanner className="p-2" message={failureWords(tree.error, t('rawPath.denied'), t('tree.failed'))} />
  if (!tree.data)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t('tree.loading')}
      </p>
    )

  const pick = (nodeRef: string) => {
    if (click.isPending) return
    setOutcome(null)
    // On the call, not the hook: a reply landing after this view has gone opens nothing.
    click.mutate(nodeRef, { onSuccess: (reply) => setOutcome(clickOutcome(reply)) })
  }
  const toggle = (nodeRef: string) =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (!next.delete(nodeRef)) next.add(nodeRef)
      return next
    })

  return (
    <div className="flex flex-col gap-2">
      {outcome?.kind === 'existing' && <ExistingNotice field={outcome.field} />}
      {click.isError && <ErrorBanner className="p-2" message={failureWords(click.error, t('rawPath.denied'), t('tree.clickFailed'))} />}
      <ul className="max-h-[32rem] overflow-auto rounded-md border border-border/60" data-tree="">
        {treeRows(tree.data.root, collapsed).map((row) => (
          <NodeRow key={row.nodeRef} row={row} busy={click.isPending} onToggle={() => toggle(row.nodeRef)} onPick={() => pick(row.nodeRef)} />
        ))}
      </ul>
      <RawPathDialog open={outcome?.kind === 'propose'} initial={outcome?.kind === 'propose' ? outcome.initial : undefined} onClose={() => setOutcome(null)} />
    </div>
  )
}

/**
 * The sample tree (oms 697; BackOffice spec 3271 stories 5-8, 3262 V3, door 3283). An author opens a kept bundle by its
 * ref and clicks a value, or a whole Money, Quantity or code. The door answers with the path; the raw-path form (695)
 * opens filled with it, so the same checks and Probe apply. A field already on that path is pointed at instead.
 *
 * The URL holds the ref and nothing else from the bundle.
 */
export default function BundleTree() {
  const { t } = useTranslation('insurance-fields')
  const [params, setParams] = useSearchParams()
  const bundle = bundleParam(params.get('bundle'))
  const [typed, setTyped] = useState(bundle ?? '')

  const openBundle = () => {
    const ref = bundleParam(typed)
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (ref) next.set('bundle', ref)
        else next.delete('bundle')
        return next
      },
      { replace: true },
    )
  }

  return (
    <section className="flex flex-col gap-2" data-bundle-tree="">
      <div>
        <h2 className="text-sm font-semibold">{t('tree.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('tree.lede')}</p>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          openBundle()
        }}
      >
        <Field label={t('tree.ref')}>
          <Input dir="ltr" autoComplete="off" className="w-72 max-w-full font-mono text-xs" value={typed} onChange={(e) => setTyped(e.target.value)} data-tree-ref="" />
        </Field>
        <Button type="submit" variant="secondary" data-tree-open="">
          {t('tree.open')}
        </Button>
      </form>
      {/* A new ref is a new view: its collapsed nodes, its click and its reply do not carry over. */}
      {bundle && <TreeView key={bundle} bundle={bundle} />}
    </section>
  )
}
