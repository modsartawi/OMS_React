import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import { RuleId } from '@/core/insurance-rules/badges'
import type { GuardList, GuardListFilter } from '@/core/insurance-rules/model'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { fieldsQuery } from '@/core/insurance-rules/registry-api'
import SaysBoth from '@/core/rules/SaysBoth'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import DeniedCard from './DeniedCard'
import ListEditor from './ListEditor'
import { attributeCodes, attributeMode, listUsers } from './list-graph'
import { CARD, CHIP } from './ui'

const NEW_LIST: GuardList = {
  id: '',
  name: { en: '', ar: '' },
  filters: [{ articles: [], categories: [], attributes: [] }],
  include: [],
  exclude: [],
}

/**
 * The Items tab: every item list of the guard ruleset as a card — its definition read out (fields with any of /
 * none of their codes, items and categories picked one by one, lists included and taken out), and the rules that
 * use it. Edit or New opens the editor in place of the cards; a save is a PUT of the whole draft.
 */
export default function ItemLists() {
  const { t } = useTranslation('insurance-lists')
  const draft = useQuery(guardDraftQuery())
  const fields = useQuery(fieldsQuery())
  const [editing, setEditing] = useState<{ list: GuardList; isNew: boolean } | null>(null)

  const failed = draft.error ?? fields.error
  if (failed && isBareDenial(failed)) return <DeniedCard hook="lists-denied" />
  if (failed) return <ErrorBanner className="p-3" message={apiErrorMessage(failed, t('items.failed'))} />
  if (!draft.data || !fields.data)
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('items.loading')}
      </div>
    )

  if (editing)
    return (
      <ListEditor
        key={editing.list.id || 'new'}
        initial={editing.list}
        isNew={editing.isNew}
        draft={draft.data}
        fields={fields.data}
        onDone={() => setEditing(null)}
      />
    )

  const { lists, rules } = draft.data
  return (
    <div className="flex flex-col gap-3" data-item-lists="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">{t('items.lede')}</p>
        <Button variant="primary" onClick={() => setEditing({ list: NEW_LIST, isNew: true })} data-list-new="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('items.new')}
        </Button>
      </div>
      {lists.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground">{t('items.empty')}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lists.map((l) => (
            <ListCard key={l.id} list={l} lists={lists} fields={fields.data} users={listUsers(rules, l.id)} onEdit={() => setEditing({ list: l, isNew: false })} />
          ))}
        </div>
      )}
    </div>
  )
}

function ListCard({ list, lists, fields, users, onEdit }: { list: GuardList; lists: GuardList[]; fields: RegistryField[]; users: string[]; onEdit: () => void }) {
  const { t } = useTranslation('insurance-lists')
  const fromFields = list.filters.some((f) => f.attributes.length > 0)
  return (
    <article className={`${CARD} flex flex-col gap-3`} data-list-card={list.id}>
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="font-semibold">
            <SaysBoth says={list.name} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <code data-list-id="">
              <Ltr>{list.id}</Ltr>
            </code>
            {fromFields && <span className="rounded-full bg-primary-050 px-2 py-0.5 text-primary-800">{t('items.fromFields')}</span>}
          </div>
        </div>
        <Button variant="secondary" onClick={onEdit} data-list-edit={list.id}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          {t('items.edit')}
        </Button>
      </header>
      <ListDefinition list={list} lists={lists} fields={fields} />
      <p className="text-xs text-muted-foreground" data-list-used-by="">
        {users.length ? (
          <>
            {t('items.usedBy')}{' '}
            {users.map((id) => (
              <span key={id} className="me-1">
                <RuleId id={id} />
              </span>
            ))}
          </>
        ) : (
          t('items.unused')
        )}
      </p>
    </article>
  )
}

/** A list's definition read out: each filter (OR between them), each field row (AND within), then the lists. */
function ListDefinition({ list, lists, fields }: { list: GuardList; lists: GuardList[]; fields: RegistryField[] }) {
  const { t } = useTranslation('insurance-lists')
  const nameOf = (id: string) => lists.find((l) => l.id === id)?.name
  return (
    <div className="flex flex-col gap-2 text-sm" data-list-definition="">
      {list.filters.map((f, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border border-border/60 p-2" data-list-filter={i}>
          {i > 0 && <span className="text-xs font-semibold uppercase text-muted-foreground">{t('def.or')}</span>}
          <FilterRead filter={f} fields={fields} />
        </div>
      ))}
      {(['include', 'exclude'] as const).map((side) =>
        list[side].length ? (
          <div key={side} className="flex flex-wrap items-center gap-1" data-list-refs={side}>
            <span className="text-xs text-muted-foreground">{t(`def.${side}`)}</span>
            {list[side].map((id) => {
              const name = nameOf(id)
              return (
                <span key={id} className={CHIP} data-list-ref={id}>
                  {name ? <bdi>{name.en}</bdi> : <Ltr>{id}</Ltr>}
                </span>
              )
            })}
          </div>
        ) : null,
      )}
    </div>
  )
}

function FilterRead({ filter, fields }: { filter: GuardListFilter; fields: RegistryField[] }) {
  const { t } = useTranslation('insurance-lists')
  const codes = (label: string, values: string[], hook: string) => (
    <div className="flex flex-wrap items-center gap-1" data-def-row={hook}>
      {label}
      {values.map((v) => (
        <span key={v} className={CHIP}>
          <Ltr>{v}</Ltr>
        </span>
      ))}
    </div>
  )
  return (
    <>
      {filter.attributes.map((a, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1" data-def-attribute={a.field}>
          <FieldName field={a.field} fields={fields} />
          <span className="text-muted-foreground">{t(`mode.${attributeMode(a)}`)}</span>
          {attributeCodes(a).map((v) => (
            <span key={v} className={CHIP} data-def-code={v}>
              <Ltr>{v}</Ltr>
            </span>
          ))}
        </div>
      ))}
      {filter.articles.length > 0 && codes(t('def.articles'), filter.articles, 'articles')}
      {filter.categories.length > 0 && codes(t('def.categories'), filter.categories, 'categories')}
    </>
  )
}

/** A field by key: its English label when the registry knows it, else the key itself. */
export function FieldName({ field, fields }: { field: string; fields: RegistryField[] }) {
  const f = fields.find((x) => x.key === field)
  return <span className="font-medium">{f ? <bdi>{f.label.en}</bdi> : <Ltr>{field}</Ltr>}</span>
}
