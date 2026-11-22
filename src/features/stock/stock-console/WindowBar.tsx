import type { KeyboardEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, TriangleAlert } from 'lucide-react'
import Button from '@/core/ui/Button'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { formatRange } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { windowProblemKey } from './movements'
import type { Movements } from './use-movements'

/**
 * A movements tab's window and its button (oms 945): two day boxes and **Read SAP** / **Read**. Nothing is read before
 * the button; a window over its limit (or reversed, or not a day) is stopped here with its sentence and asks nothing.
 * Once read, the window read is written as one range. `ns` is the tab's locale block (`sap` or `movements`).
 */
export default function WindowBar({
  ns,
  movements,
  read,
}: {
  ns: 'sap' | 'movements'
  movements: Movements
  /** The tab's main read: Read with the window already shown re-reads it; its spinner. */
  read: { isFetching: boolean; refetch: () => unknown }
}) {
  const { t } = useTranslation('stock-console')
  const { boxes, setBox, decision, today } = movements

  const run = () => {
    if (!movements.press()) void read.refetch()
  }
  const enter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    run()
  }

  return (
    <div className="flex min-w-0 flex-col gap-2" data-window-bar={ns} data-window-read={decision.kind}>
      <div className="flex flex-wrap items-center gap-2">
        {(['from', 'to'] as const).map((box) => (
          <label key={box} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t(`${ns}.${box}`)}
            <Input
              type="date"
              value={boxes[box]}
              max={today}
              onChange={(e) => setBox(box, e.target.value)}
              onKeyDown={enter}
              className="w-fit"
              data-window-box={box}
            />
          </label>
        ))}
        <Button variant="primary" onClick={run} data-window-run="">
          {t(`${ns}.read`)}
        </Button>
        {decision.kind === 'read' && (
          <span className="text-xs text-muted-foreground" data-window-shown="">
            <Trans
              t={t}
              i18nKey={`${ns}.window`}
              values={{ window: formatRange(decision.from, decision.to) }}
              components={{ w: <Ltr /> }}
            />
          </span>
        )}
        {decision.kind === 'read' && read.isFetching && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      {decision.kind === 'nothing' && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-nothing-read="">
          {t(`${ns}.nothingYet`)}
        </p>
      )}
      {decision.kind === 'stopped' && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
          data-window-stopped={decision.problem}
        >
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <Trans
              t={t}
              i18nKey={windowProblemKey(decision.problem)}
              values={{ max: formatFigure(movements.spec.maxDays) }}
              components={{ n: <Ltr /> }}
            />
          </span>
        </p>
      )}
    </div>
  )
}
