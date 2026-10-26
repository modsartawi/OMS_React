import { Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { PointingChip } from './list-view'

/**
 * One chip per pointing type: the code, the description as its tooltip, a competed type marked. Shared by
 * the lists grid's cell (567) and the detail header (568). Read-only: pointing a type is an HQ script.
 */
export default function PointingChips({ chips }: { chips: PointingChip[] }) {
  const { t } = useTranslation('serving-lists')
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {chips.map((c) => (
        <span
          key={c.code}
          title={fsi(c.tooltip)}
          className={
            'inline-flex items-center gap-0.5 rounded-full border px-2 py-0 font-mono text-[11px] leading-5 ' +
            (c.competed ? 'border-primary/50 bg-primary-050 text-primary-800' : 'border-border/60 text-muted-foreground')
          }
          data-chip={c.code}
          data-competed={c.competed ? 'true' : 'false'}
        >
          {c.competed && <Zap className="h-3 w-3" aria-label={t('pointing.competed')} />}
          <Ltr>{c.code}</Ltr>
        </span>
      ))}
    </span>
  )
}
