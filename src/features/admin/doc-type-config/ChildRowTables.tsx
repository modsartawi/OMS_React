import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { REASON_MAX } from '@/core/reason/reason'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import {
  CHILD_ROW_STALE_CODES,
  CHILD_ROWS_KEY,
  childRowsApi,
  childRowsQuery,
  itemCategoriesQuery,
  plantNetworkIdsQuery,
} from './child-rows-api'
import {
  ITEM_CATEGORY_ASSIGNMENT,
  PLANT_NETWORK,
  childRowKey,
  childRowRequest,
  childRowState,
  emptyChildRow,
  setChildField,
  type ChildColumn,
  type ChildRowMode,
  type ChildRowSpec,
} from './child-rows'

/**
 * A document type's item-category assignment rows and plant network rows (BackOffice spec 3148 stories 21-25, 58;
 * ticket 3151), as two tables on the type's page. With the configuration grant each table offers Add and, per row,
 * Edit and Remove; every one opens one dialog that asks for a reason (and, for a change, shows the before/after).
 * Without the grant the tables are read-only — no Add, Edit or Remove is rendered.
 */
export default function ChildRowTables({ code, canEdit }: { code: string; canEdit: boolean }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2" data-child-rows="">
      <ChildRowTable spec={ITEM_CATEGORY_ASSIGNMENT} code={code} canEdit={canEdit} />
      <ChildRowTable spec={PLANT_NETWORK} code={code} canEdit={canEdit} />
    </div>
  )
}

type Row = { documentType: string }
type Editing<R> = { mode: ChildRowMode; loaded: R | null } | null

function ChildRowTable<R extends Row>({ spec, code, canEdit }: { spec: ChildRowSpec<R>; code: string; canEdit: boolean }) {
  const { t } = useTranslation('doc-type-config')
  const list = useQuery(childRowsQuery<R>(spec.id, code))
  const [editing, setEditing] = useState<Editing<R>>(null)
  const columns = [...spec.keyFields, ...spec.valueFields]
  const rows = list.data ?? []

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-child-table={spec.id}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(`childRows.${spec.id}.title`)}</h3>
        {canEdit && (
          <Button variant="outlined" onClick={() => setEditing({ mode: 'add', loaded: null })} data-child-add={spec.id}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('childRows.add')}
          </Button>
        )}
      </div>
      {list.isError ? (
        <ErrorBanner className="p-2" message={apiErrorMessage(list.error, t('childRows.failed'))} />
      ) : !list.data ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('childRows.loading')}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground" data-child-empty="">
          {t(`childRows.${spec.id}.empty`)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.field} className="py-1 pe-3 text-start font-medium">
                    {t(`childRows.${spec.id}.columns.${c.field}`)}
                  </th>
                ))}
                {canEdit && <th className="py-1 text-end font-medium">{t('childRows.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={childRowKey(spec, row)} className="border-t border-border/60" data-child-row={childRowKey(spec, row)}>
                  {columns.map((c) => (
                    <td key={c.field} className="py-1 pe-3">
                      <CodeText value={String(row[c.field] ?? '')} />
                    </td>
                  ))}
                  {canEdit && (
                    <td className="py-1 text-end whitespace-nowrap">
                      <Button variant="ghost" onClick={() => setEditing({ mode: 'edit', loaded: row })} data-child-edit="" aria-label={t('childRows.edit')}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing({ mode: 'remove', loaded: row })} data-child-remove="" aria-label={t('childRows.remove')}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && editing && (
        <ChildRowDialog spec={spec} code={code} mode={editing.mode} loaded={editing.loaded} existing={rows} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}

function CodeText({ value }: { value: string }) {
  const { t } = useTranslation('doc-type-config')
  const text = value.trim()
  if (text === '') return <span className="text-muted-foreground">{t('value.blank')}</span>
  return <Ltr>{text}</Ltr>
}

function ChildRowDialog<R extends Row>({
  spec,
  code,
  mode,
  loaded,
  existing,
  onClose,
}: {
  spec: ChildRowSpec<R>
  code: string
  mode: ChildRowMode
  loaded: R | null
  existing: readonly R[]
  onClose: () => void
}) {
  const { t } = useTranslation('doc-type-config')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<R>(loaded ?? emptyChildRow(spec, code))
  const [reasonText, setReasonText] = useState('')
  const listKey = childRowsQuery<R>(spec.id, code).queryKey

  const save = useMutation({
    mutationFn: async () => {
      const body = childRowRequest(mode, loaded, draft, reasonText)
      if (mode === 'add') await childRowsApi.add(spec.id, code, body)
      else if (mode === 'edit') await childRowsApi.update(spec.id, code, body)
      else await childRowsApi.remove(spec.id, code, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      notify.success(t(mode === 'remove' ? 'childRows.removed' : 'childRows.saved', { what: t(`childRows.${spec.id}.title`) }))
      onClose()
    },
    onError: (err) => {
      if (CHILD_ROW_STALE_CODES.includes(apiErrorCode(err) ?? '')) void queryClient.invalidateQueries({ queryKey: [...CHILD_ROWS_KEY, spec.id] })
    },
  })

  const state = childRowState(spec, mode, loaded, draft, existing, reasonText)
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null
  const columns = [...spec.keyFields, ...spec.valueFields]

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t(`childRows.${spec.id}.${mode}Title`, { code: fsi(code) })}
      width="40rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-child-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button
            variant={mode === 'remove' ? 'danger' : 'primary'}
            disabled={!state.canSave || busy}
            onClick={() => state.canSave && !busy && save.mutate()}
            data-child-save=""
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t(mode === 'remove' ? 'childRows.confirmRemove' : 'edit.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-child-dialog={mode}>
        {mode === 'remove' ? (
          <p className="text-sm" data-child-remove-note="">
            {t('childRows.removeNote')}
          </p>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('edit.note')} {mode === 'edit' && t('childRows.keyLockedHint')}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {columns.map((c) => (
            <ChildFieldInput
              key={c.field}
              spec={spec}
              column={c}
              value={String(draft[c.field] ?? '')}
              locked={mode === 'remove' || (mode === 'edit' && spec.keyFields.includes(c))}
              disabled={busy}
              onChange={(v) => {
                setDraft((d) => setChildField(spec, mode, d, c.field, v))
                save.reset()
              }}
            />
          ))}
        </div>

        {state.blocker === 'missing' && (
          <p className="text-xs text-muted-foreground" data-child-missing="">
            {t('childRows.missing', { fields: fsi(state.missing.map((f) => t(`childRows.${spec.id}.columns.${f}`)).join(', ')) })}
          </p>
        )}
        {state.blocker === 'duplicate' && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-child-duplicate="">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(`childRows.${spec.id}.duplicate`)}
          </p>
        )}

        {mode === 'edit' && state.changes.length > 0 && (
          <table className="w-full text-sm" data-child-diff="">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 text-start font-medium" />
                <th className="py-1 text-start font-medium">{t('edit.before')}</th>
                <th className="py-1 text-start font-medium">{t('edit.after')}</th>
              </tr>
            </thead>
            <tbody>
              {state.changes.map((c) => (
                <tr key={c.field} className="border-t border-border/60" data-child-change={c.field}>
                  <td className="py-1 pe-3">{t(`childRows.${spec.id}.columns.${c.field}`)}</td>
                  <td className="py-1 pe-3">
                    <CodeText value={c.before} />
                  </td>
                  <td className="py-1">
                    <CodeText value={c.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            {t('reason.label')}
            <span className={'font-normal tabular-nums ' + (state.reason.problem === 'tooLong' ? 'text-danger-800' : 'text-muted-foreground')}>
              <Ltr>{formatCount(state.reason.length, REASON_MAX)}</Ltr>
            </span>
          </span>
          <textarea
            value={reasonText}
            onChange={(e) => {
              setReasonText(e.target.value)
              save.reset()
            }}
            rows={2}
            required
            disabled={busy}
            dir="auto"
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-child-reason=""
          />
          <span className="font-normal text-muted-foreground">{t('reason.hint')}</span>
        </label>
        {state.reason.problem === 'tooLong' && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('reason.tooLong', { max: fsi(String(REASON_MAX)) })}
          </p>
        )}

        {save.isError &&
          (isBareDenial(save.error) ? (
            <ErrorBanner className="p-2" message={t('edit.notGranted')} />
          ) : (
            <ErrorBanner className="p-2" title={t('dialog.failed')} message={apiErrorMessage(save.error, t('dialog.failedHint'))}>
              {errorCode && (
                <span className="font-mono text-xs" data-child-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}

/** One column: a pick-list for an item category or a plant network (chosen from the existing ones), a code box
 *  otherwise; a key column of an existing row (or any column of a row being removed) is shown, never editable. */
function ChildFieldInput<R extends Row>({
  spec,
  column,
  value,
  locked,
  disabled,
  onChange,
}: {
  spec: ChildRowSpec<R>
  column: ChildColumn<R>
  value: string
  locked: boolean
  disabled: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('doc-type-config')
  const label = t(`childRows.${spec.id}.columns.${column.field}`)
  const categories = useQuery({ ...itemCategoriesQuery(), enabled: !locked && column.source === 'itemCategory' })
  const networks = useQuery({ ...plantNetworkIdsQuery(), enabled: !locked && column.source === 'plantNetwork' })

  if (locked) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm" data-child-field={column.field} data-child-locked="">
        <span className="flex items-center gap-1 text-muted-foreground">
          {label}
          <Lock className="h-3 w-3" aria-label={t('detail.locked')} />
        </span>
        <CodeText value={value} />
      </div>
    )
  }

  const options =
    column.source === 'itemCategory'
      ? (categories.data ?? []).map((c) => ({ value: c.itemCategory, label: fsi(formatPair(c.itemCategory, c.description)) }))
      : column.source === 'plantNetwork'
        ? (networks.data ?? []).map((n) => ({ value: n, label: fsi(n) }))
        : null
  // A value the row already holds stays selectable even when the list does not (yet) name it.
  if (options && value !== '' && !options.some((o) => o.value === value)) options.unshift({ value, label: fsi(value) })

  return (
    <label className="flex items-center justify-between gap-2 text-sm" data-child-field={column.field}>
      <span>{label}</span>
      {options ? (
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-56 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
        >
          <option value="">{t('childRows.none')}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          maxLength={column.maxLength}
          disabled={disabled}
          dir="ltr"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-56 rounded-md border border-border/60 bg-background px-2 py-1 text-sm uppercase"
        />
      )}
    </label>
  )
}
