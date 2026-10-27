import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { AffectedTypesView } from './action-type-edit'

/**
 * Every document type and delivery type an action-type edit reaches (ticket 3155, story 39) — on the category page and
 * repeated in the save dialog, from the same `affectedTypesView`. Codes are machine values (`Ltr`), descriptions free
 * text (`bdi`).
 */
export default function AffectedTypesList({ view, where }: { view: AffectedTypesView; where: 'page' | 'dialog' }) {
  const { t } = useTranslation('doc-type-config')
  return (
    <section
      className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm"
      data-affected-types={where}
      data-affected-count={view.total}
    >
      <h3 className="mb-1 flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-800" aria-hidden />
        {t('actionTypes.affected.title', { n: fsi(String(view.total)) })}
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">{t(`actionTypes.affected.hint.${where}`)}</p>
      {view.total === 0 ? (
        <p className="text-xs text-muted-foreground" data-affected-none="">
          {t('actionTypes.affected.none')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {view.groups.map((g) => (
            <div key={g.kind} data-affected-kind={g.kind}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t(`actionTypes.affected.kinds.${g.kind}`, { defaultValue: g.kind })}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {g.types.map((type) => (
                  <li
                    key={`${g.kind}:${type.documentType}`}
                    className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-xs"
                    data-affected-type={type.documentType}
                  >
                    <span className="font-mono font-semibold">
                      <Ltr>{type.documentType}</Ltr>
                    </span>
                    {type.description && (
                      <>
                        {' '}
                        <bdi className="text-muted-foreground">{type.description}</bdi>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
