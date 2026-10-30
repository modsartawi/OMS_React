import { useTranslation } from 'react-i18next'
import Chip from '@/core/ui/Chip'
import Textarea from '@/core/ui/Textarea'
import type { DataTab } from './experiment'
import { JsonPane } from './JsonPane'

const DATA_TABS: readonly DataTab[] = ['json', 'raw']

/**
 * The Data pane (tickets 677, 684): tabs **JSON** (the data box, sent as `data`) and **Raw** (free text, sent as
 * `raw` as it is, even when it is not JSON). Each tab keeps its own text, so leaving Raw never overwrites the data
 * box. 682 adds the Form tab here.
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
  const tabs = (
    <div role="tablist" aria-label={t('data.tabs.label')} className="flex gap-1">
      {DATA_TABS.map((k) => (
        <Chip key={k} variant="tab" on={tab === k} aria-controls="playground-data" onClick={() => onTab(k)} data-data-tab={k}>
          {t(`data.tabs.${k}`)}
        </Chip>
      ))}
    </div>
  )
  return (
    <JsonPane box="data" title={t('data.title')} hint={tab === 'raw' ? t('data.rawHint') : t('data.hint')} value={dataText} onChange={onDataText} invalid={invalid} tabs={tabs}>
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
      ) : undefined}
    </JsonPane>
  )
}
