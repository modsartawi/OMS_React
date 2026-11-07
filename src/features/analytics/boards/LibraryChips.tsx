import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import { FIELD_LABEL } from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import { choiceNarrows, LIBRARY_KINDS, LIBRARY_WHO, type LibraryChanged, type LibraryChoice } from './library'

const CHANGED: readonly { key: string; changed: LibraryChanged }[] = [
  { key: 'any', changed: { kind: 'any' } },
  { key: 'today', changed: { kind: 'today' } },
  { key: 'days7', changed: { kind: 'days', days: 7 } },
  { key: 'days30', changed: { kind: 'days', days: 30 } },
  { key: 'range', changed: { kind: 'range' } },
]

const changedKey = (c: LibraryChanged): string => (c.kind === 'days' ? `days${c.days}` : c.kind)

/**
 * 837 item 3: the library's chips — who (All · Mine · Certified · Shared with me), kind (Views · Boards · Reports)
 * and changed (Any time · Today · Last 7 days · Last 30 days · Between dates, with its from/to dates). Each group is
 * one choice; the dates are machine values, so their fields are left-to-right (bidi rule).
 *
 * 839: a library page whose route fixes who or kind hides that group (`shows`), and `narrows` says what counts as
 * narrowing on that page (Clear shows only for what the page leaves open).
 */
export default function LibraryChips({
  choice,
  onChange,
  shows = { who: true, kind: true },
  narrows = choiceNarrows,
}: {
  choice: LibraryChoice
  onChange: (change: (c: LibraryChoice) => LibraryChoice) => void
  shows?: { who: boolean; kind: boolean }
  narrows?: (c: LibraryChoice) => boolean
}) {
  const { t } = useTranslation('boards')
  const range = choice.changed.kind === 'range' ? choice.changed : null
  return (
    <div className="flex flex-col gap-2" data-analytics-library-chips>
      {(shows.who || shows.kind) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {shows.who && (
            <ChipGroup label={t('home.library.who.label')}>
              {LIBRARY_WHO.map((who) => (
                <Chip key={who} on={choice.who === who} onClick={() => onChange((c) => ({ ...c, who }))} data-analytics-chip-who={who}>
                  {t(`home.library.who.${who}`)}
                </Chip>
              ))}
            </ChipGroup>
          )}
          {shows.kind && (
            <ChipGroup label={t('home.library.kind.label')}>
              {LIBRARY_KINDS.map((kind) => (
                <Chip key={kind} on={choice.kind === kind} onClick={() => onChange((c) => ({ ...c, kind }))} data-analytics-chip-kind={kind}>
                  {t(`home.library.kind.${kind}`)}
                </Chip>
              ))}
            </ChipGroup>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipGroup label={t('home.library.changed.label')}>
          {CHANGED.map(({ key, changed }) => (
            <Chip
              key={key}
              on={changedKey(choice.changed) === key}
              onClick={() => onChange((c) => ({ ...c, changed: changed.kind === 'range' && c.changed.kind === 'range' ? c.changed : changed }))}
              data-analytics-chip-changed={key}
            >
              {t(`home.library.changed.${key}`)}
            </Chip>
          ))}
        </ChipGroup>
        {range && (
          <div className="flex flex-wrap items-center gap-2" data-analytics-changed-range>
            <Input
              type="date"
              dir="ltr"
              value={range.from ?? ''}
              max={range.to || undefined}
              aria-label={t('home.library.changed.from')}
              title={t('home.library.changed.from')}
              onChange={(e) => {
                const from = e.target.value || undefined
                // From the latest choice, not this render's: the URL write lands async (`useUrlQuery`).
                onChange((c) => ({ ...c, changed: { kind: 'range', from, to: c.changed.kind === 'range' ? c.changed.to : undefined } }))
              }}
              className="font-mono"
              data-analytics-changed-from
            />
            <Input
              type="date"
              dir="ltr"
              value={range.to ?? ''}
              min={range.from || undefined}
              aria-label={t('home.library.changed.to')}
              title={t('home.library.changed.to')}
              onChange={(e) => {
                const to = e.target.value || undefined
                onChange((c) => ({ ...c, changed: { kind: 'range', from: c.changed.kind === 'range' ? c.changed.from : undefined, to } }))
              }}
              className="font-mono"
              data-analytics-changed-to
            />
          </div>
        )}
        {narrows(choice) && (
          <Button
            variant="text"
            onClick={() => onChange((c) => ({ ...c, who: 'all', kind: 'all', changed: { kind: 'any' }, search: '' }))}
            data-analytics-library-clear
          >
            {t('home.library.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className={`${FIELD_LABEL} me-1`}>{label}</span>
      {children}
    </div>
  )
}
