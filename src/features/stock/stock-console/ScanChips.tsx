import { useTranslation } from 'react-i18next'
import type { StockConsoleScan } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { localizedName } from '@/core/util/localized-name'
import { applyScan, type ScanChip } from './scan'

/** A chip's value as one string: the item leads its name (`1001 · Panadol`), isolated once as a pair. */
const chipValue = (chip: ScanChip, language: string): string =>
  chip.kind === 'item' ? formatPair(chip.value, localizedName(chip, language)) : chip.value

/**
 * What was read from the GS1 box's code (oms 944, spec 4157 story 67), above the rows: item and name, GTIN, lot,
 * expiry, serial as chips — each value left-to-right machine data, isolated whole — and the line that says the item was
 * not found or the code is not one we know.
 */
export default function ScanChips({ scan }: { scan: StockConsoleScan }) {
  const { t, i18n } = useTranslation('stock-console')
  const read = applyScan(scan)
  return (
    <div className="flex min-w-0 flex-col gap-2" data-scan-read={scan.kind}>
      {read.chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{t('gs1.read')}</span>
          {read.chips.map((chip) => (
            <span
              key={chip.kind}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5"
              data-scan-chip={chip.kind}
            >
              <span className="text-muted-foreground">{t(`gs1.chip.${chip.kind}`)}</span>
              <span className={chip.kind === 'item' ? 'font-medium' : 'font-mono'}>
                <Ltr>{chipValue(chip, i18n.language)}</Ltr>
              </span>
            </span>
          ))}
        </div>
      )}
      {read.note && (
        <p
          role="status"
          className="rounded-md bg-attention-050 px-3 py-1.5 text-sm text-attention-800"
          data-scan-note={read.note}
        >
          {t(`gs1.note.${read.note}`)}
        </p>
      )}
    </div>
  )
}
