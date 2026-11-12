import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { apiErrorMessage } from '@/core/api'
import { fsi } from '@/core/util/bidi'
import type { AnalyticsItem } from '@/core/models/analytics'
import { ANALYTICS_SQL_FORMATS, ANALYTICS_SQL_MAX_TITLE, numericColumns, sqlChartOffers, type AnalyticsSqlChartType } from '@/core/models/analytics-sql'
import type { AnswerSql } from './answer'
import { copilotApi } from './api'
import { sqlSaveBody, sqlSaveForm, sqlSaveProblem, sqlTypeShape, withChartType, withValue, type SqlSaveForm } from './sql-save'

/**
 * Save on a SQL answer (889, BackOffice spec 3632 Q39, Q41): the title in both words, the chart type (only the types the
 * result's columns fit), the axis, the series and the values, and each value's label and format. Default: a table.
 * `POST Analytics/Item/Sql` saves it Personal; the server runs the statement first and its refusal is shown here.
 * Column names are machine values: `fsi()` in the option sinks.
 */
export default function SqlSaveDialog({
  sql,
  question,
  open,
  onClose,
  onSaved,
}: {
  sql: AnswerSql
  question: string
  open: boolean
  onClose: () => void
  onSaved: (item: AnalyticsItem) => void
}) {
  const { t } = useTranslation('copilot')
  const [form, setForm] = useState<SqlSaveForm>(() => sqlSaveForm(sql, question))
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const offers = sqlChartOffers(sql.columns, sql.rows).filter((o) => o.offered)
  const numeric = numericColumns(sql.columns, sql.rows)
  const numbers = sql.columns.filter((_, i) => numeric[i])
  const shape = sqlTypeShape(form.type, form.series)
  const problem = sqlSaveProblem(form, sql)
  const spare = numbers.filter((c) => c !== form.axis && c !== form.series && !form.values.some((v) => v.column === c))
  const change = (next: SqlSaveForm) => {
    setForm(next)
    setFailed(null)
  }

  const save = async () => {
    if (problem !== null || saving) return
    setSaving(true)
    setFailed(null)
    try {
      const item = await copilotApi.saveSql(sqlSaveBody(sql, question, form))
      onSaved(item)
    } catch (err) {
      setFailed(apiErrorMessage(err, t('sqlSave.failed')))
    } finally {
      setSaving(false)
    }
  }

  const columnOptions = (list: readonly string[]) =>
    list.map((c) => (
      <option key={c} value={c}>
        {fsi(c)}
      </option>
    ))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sqlSave.title')}
      width="40rem"
      dismissable={!saving}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={saving}>
            {t('sqlSave.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={problem !== null || saving} data-copilot-sql-save-send>
            {saving ? t('sqlSave.saving') : t('sqlSave.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-xs" data-copilot-sql-save>
        <p className="text-muted-foreground">{t('sqlSave.personal')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('sqlSave.titleEn')}>
            <Input dir="ltr" maxLength={ANALYTICS_SQL_MAX_TITLE} value={form.title.en} onChange={(e) => change({ ...form, title: { ...form.title, en: e.target.value } })} />
          </Field>
          <Field label={t('sqlSave.titleAr')}>
            <Input dir="rtl" maxLength={ANALYTICS_SQL_MAX_TITLE} value={form.title.ar} onChange={(e) => change({ ...form, title: { ...form.title, ar: e.target.value } })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('sqlSave.type')}>
            <Select
              value={form.type}
              onChange={(e) => change(withChartType(form, e.target.value as AnalyticsSqlChartType, sql))}
              data-copilot-sql-save-type
            >
              {offers.map((o) => (
                <option key={o.type} value={o.type}>
                  {t(`sqlSave.types.${o.type}`)}
                </option>
              ))}
            </Select>
          </Field>
          {shape.axis && (
            <Field label={t('sqlSave.axis')}>
              <Select value={form.axis ?? ''} onChange={(e) => change({ ...form, axis: e.target.value || null })} data-copilot-sql-save-axis>
                {columnOptions(sql.columns)}
              </Select>
            </Field>
          )}
          {shape.series && (
            <Field label={t('sqlSave.series')}>
              <Select value={form.series ?? ''} onChange={(e) => change({ ...form, series: e.target.value || null })} data-copilot-sql-save-series>
                {form.type !== 'heatmap' && <option value="">{t('sqlSave.noSeries')}</option>}
                {columnOptions(sql.columns)}
              </Select>
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-2" data-copilot-sql-save-values>
          <p className="font-medium text-muted-foreground">{t('sqlSave.values')}</p>
          {form.values.length === 0 && <p className="text-muted-foreground">{t('sqlSave.noValues')}</p>}
          {form.values.map((v, i) => (
            <div key={i} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_8rem_auto]" data-copilot-sql-save-value={v.column}>
              <Field label={t('sqlSave.column')}>
                <Select value={v.column} onChange={(e) => change(withValue(form, i, { column: e.target.value }))}>
                  {columnOptions(numbers)}
                </Select>
              </Field>
              <Field label={t('sqlSave.labelEn')}>
                <Input
                  dir="ltr"
                  maxLength={ANALYTICS_SQL_MAX_TITLE}
                  placeholder={v.column}
                  value={v.label.en}
                  onChange={(e) => change(withValue(form, i, { label: { ...v.label, en: e.target.value } }))}
                />
              </Field>
              <Field label={t('sqlSave.labelAr')}>
                <Input
                  dir="rtl"
                  maxLength={ANALYTICS_SQL_MAX_TITLE}
                  placeholder={v.column}
                  value={v.label.ar}
                  onChange={(e) => change(withValue(form, i, { label: { ...v.label, ar: e.target.value } }))}
                />
              </Field>
              <Field label={t('sqlSave.format')}>
                <Select value={v.format} onChange={(e) => change(withValue(form, i, { format: e.target.value as (typeof ANALYTICS_SQL_FORMATS)[number] }))}>
                  {ANALYTICS_SQL_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {t(`sqlSave.formats.${f}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <IconButton
                label={t('sqlSave.removeValue')}
                onClick={() => change({ ...form, values: form.values.filter((_, j) => j !== i) })}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </IconButton>
            </div>
          ))}
          {form.values.length < shape.max && spare.length > 0 && (
            <div>
              <Button
                variant="secondary"
                onClick={() => change({ ...form, values: [...form.values, { column: spare[0], label: { en: '', ar: '' }, format: 'number' }] })}
                data-copilot-sql-save-add-value
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t('sqlSave.addValue')}
              </Button>
            </div>
          )}
        </div>
        {problem !== null && (
          <p role="note" className="text-muted-foreground" data-copilot-sql-save-problem={problem}>
            {t(`sqlSave.problem.${problem}`)}
          </p>
        )}
        {failed !== null && (
          <p role="alert" className="text-danger-800" data-copilot-sql-save-failed>
            <bdi>{failed}</bdi>
          </p>
        )}
      </div>
    </Modal>
  )
}
