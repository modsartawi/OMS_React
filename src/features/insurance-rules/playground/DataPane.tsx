import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Chip from '@/core/ui/Chip'
import Textarea from '@/core/ui/Textarea'
import { formFromText, formText, type DataForm } from './data-form'
import { DataFormView } from './DataFormView'
import { DATA_TABS, type DataTab } from './experiment'
import { JsonPane } from './JsonPane'

/**
 * The Data pane (tickets 677, 682, 684): tabs **Form** and **JSON** (two views of ONE dataset, the data box, sent as
 * `data`) and **Raw** (free text, sent as `raw` as it is, even when it is not JSON). Raw keeps its own text, so
 * leaving it never overwrites the data box.
 *
 * The data box's text is the one source of truth. A form edit writes the whole data back to it at once; the form the
 * user is typing in is kept beside the text it wrote (so a half-typed attribute row or "E11, " survives), and any
 * other change to the text — the JSON tab, a kind switch — re-reads the form from it.
 */
export function DataPane({
  tab,
  onTab,
  dataText,
  onDataText,
  rawText,
  onRawText,
  invalid,
}: {
  tab: DataTab
  onTab: (tab: DataTab) => void
  dataText: string
  onDataText: (text: string) => void
  rawText: string
  onRawText: (text: string) => void
  invalid: boolean
}) {
  const { t } = useTranslation('insurance-playground')
  const [own, setOwn] = useState<{ text: string; form: DataForm } | null>(null)
  const read = useMemo(() => (tab !== 'form' ? null : own && own.text === dataText ? { form: own.form } : formFromText(dataText)), [tab, own, dataText])
  const editForm = (form: DataForm) => {
    const text = formText(form)
    setOwn({ text, form })
    onDataText(text)
  }

  const tabs = (
    <div role="tablist" aria-label={t('data.tabs.label')} className="flex gap-1">
      {DATA_TABS.map((k) => (
        <Chip key={k} variant="tab" on={tab === k} aria-controls="playground-data" onClick={() => onTab(k)} data-data-tab={k}>
          {t(`data.tabs.${k}`)}
        </Chip>
      ))}
    </div>
  )
  const hint = tab === 'raw' ? t('data.rawHint') : tab === 'form' ? t('data.formHint') : t('data.hint')
  return (
    <JsonPane box="data" title={t('data.title')} hint={hint} value={dataText} onChange={onDataText} invalid={invalid} tabs={tabs}>
      {tab === 'raw' ? (
        <Textarea
          id="playground-data"
          className="min-h-96 w-full font-mono text-xs"
          dir="ltr"
          spellCheck={false}
          value={rawText}
          onChange={(e) => onRawText(e.target.value)}
          data-raw-box=""
        />
      ) : read && 'form' in read ? (
        <div id="playground-data">
          <DataFormView form={read.form} onChange={editForm} />
        </div>
      ) : read ? (
        <p id="playground-data" className="text-xs text-danger-800" role="alert" data-form-problem={read.problem}>
          {t(`data.form.problem.${read.problem}`)}
        </p>
      ) : undefined}
    </JsonPane>
  )
}
