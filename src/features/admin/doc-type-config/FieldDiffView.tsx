import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { columnField, fieldDiff, type DiffSource, type DiffValue } from './field-diff'
import FieldValueText from './FieldValueText'
import { ALL_FIELDS, type FieldDef } from './fields'
import type { DocumentTypeField } from './types'

const KNOWN = new Map<string, FieldDef>(ALL_FIELDS.map((d) => [d.field, d]))

/**
 * A change-log row's field-level diff (ticket 3152): one line per changed field — its label, before, after. A create
 * or copy has no Before column, a delete no After column. Generic over the entity type: a document-type field is
 * labelled and shown as the detail shows it; any other column (a child row's, a later slice's) falls back to its
 * own words if `fields.<field>` has them, else to the column name as a machine value.
 */
export default function FieldDiffView({ row }: { row: DiffSource }) {
  const { t, i18n } = useTranslation('doc-type-config')
  const diff = fieldDiff(row)
  if (diff.kind === 'unreadable')
    return (
      <p className="text-xs text-muted-foreground" data-diff-unreadable="">
        {t('change.unreadable')}
      </p>
    )
  if (diff.lines.length === 0)
    return (
      <p className="text-xs text-muted-foreground" data-diff-empty="">
        {t('change.noFields')}
      </p>
    )

  const showBefore = diff.kind !== 'create' && diff.kind !== 'copy'
  const showAfter = diff.kind !== 'delete'
  const label = (column: string) => {
    const field = columnField(column)
    return i18n.exists(`fields.${field}`, { ns: 'doc-type-config' }) ? t(`fields.${field}`) : <Ltr>{column}</Ltr>
  }

  return (
    <table className="w-full text-xs" data-diff={diff.kind}>
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pe-3 text-start font-medium">{t('change.field')}</th>
          {showBefore && <th className="py-1 pe-3 text-start font-medium">{t('change.before')}</th>}
          {showAfter && <th className="py-1 text-start font-medium">{t('change.after')}</th>}
        </tr>
      </thead>
      <tbody>
        {diff.lines.map((line) => (
          <tr key={line.column} className="border-t border-border/40 align-top" data-diff-field={line.column}>
            <td className="py-1 pe-3">{label(line.column)}</td>
            {showBefore && (
              <td className="py-1 pe-3" data-diff-before="">
                <DiffValueText column={line.column} value={line.before} />
              </td>
            )}
            {showAfter && (
              <td className="py-1" data-diff-after="">
                <DiffValueText column={line.column} value={line.after} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A value the way its field shows it (bidi rule): a known field through the detail's renderer, else by its type. */
function DiffValueText({ column, value }: { column: string; value: DiffValue | undefined }) {
  const { t } = useTranslation('doc-type-config')
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))
    return <span className="text-muted-foreground">{t('value.blank')}</span>
  const def = KNOWN.get(columnField(column) as DocumentTypeField)
  if (def) return <FieldValueText def={def} value={value} />
  if (typeof value === 'boolean') return <span data-flag-value={String(value)}>{t(value ? 'value.yes' : 'value.no')}</span>
  // Free text by name (a description); every other column is a code, a number or an id.
  return /Description$/.test(column) ? <bdi>{String(value)}</bdi> : <Ltr>{String(value)}</Ltr>
}
