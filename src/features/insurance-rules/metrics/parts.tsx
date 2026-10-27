import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RuleId } from '@/core/insurance-rules/badges'
import { guardRulePath, type Says } from '@/core/insurance-rules/model'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'

// Small pieces the three tabs share (ticket 615).

/** A KPI tile: a label and one figure (isolated). */
export function Tile({ label, hook, tag, tone, children }: { label: string; hook: string; tag?: string; tone?: 'bad'; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2" data-tile={hook}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {tag && (
          <span className="rounded-full bg-attention-050 px-1.5 text-[10px] font-medium text-attention-800" data-estimate="">
            {tag}
          </span>
        )}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${tone === 'bad' ? 'text-danger-800' : ''}`} data-figure="">
        {children}
      </div>
    </div>
  )
}

/** A rule named by its id (a link to the rule read as sentences) and its name in the reader's language. */
export function RuleName({ id, name }: { id: string; name: Says | null }) {
  const { i18n } = useTranslation()
  return (
    <span className="flex flex-col leading-tight">
      <Link to={guardRulePath(id)} className="w-fit text-primary hover:underline" data-rule-link={id}>
        <RuleId id={id} />
      </Link>
      {name && (
        <bdi className="text-xs text-muted-foreground" data-rule-name="">
          {saysIn(name, i18n.language)}
        </bdi>
      )}
    </span>
  )
}

/** A share 0–1 as a whole percent, isolated. */
export function Pct({ share }: { share: number | null }) {
  const { t } = useTranslation('insurance-metrics')
  if (share === null) return <span className="text-muted-foreground">{t('dash')}</span>
  return <Ltr>{t('unit.pct', { n: Math.round(share * 100) })}</Ltr>
}

export const TD = 'px-2 py-1.5 align-middle'
export const NUM = 'px-2 py-1.5 text-end align-middle tabular-nums'
