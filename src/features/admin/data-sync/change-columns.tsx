import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import type { ChangeKind, ChangeManifestRow } from '@/core/models/data-sync'
import { MONO, formatTime } from './campaign-columns'
import { changeCells, type ChangeValue } from './changes-helpers'

/**
 * One side's value. Free text in either script → `<bdi>`; a NULL and an empty string each get
 * their own marker, so neither can be read as the other (ticket 562).
 */
function ValueView({ t, value, side }: { t: TFunction; value: ChangeValue | null; side: 'source' | 'target' }) {
  if (value === null)
    return (
      <span className="text-xs text-muted-foreground italic" data-change-absent={side}>
        {t(side === 'source' ? 'changes.notAtSource' : 'changes.notAtStore')}
      </span>
    )
  if (value.kind === 'null')
    return (
      <span className="rounded border border-border/60 px-1 font-mono text-[11px] text-muted-foreground" data-change-null={side}>
        {t('changes.nullValue')}
      </span>
    )
  if (value.kind === 'empty')
    return (
      <span className="text-xs text-muted-foreground italic" data-change-empty={side}>
        {t('changes.emptyValue')}
      </span>
    )
  return (
    <bdi className="break-all whitespace-pre-wrap" data-change-text={side}>
      {value.text}
    </bdi>
  )
}

/**
 * The Changes grid (ticket 562): table, kind, key and the differing values side by side, source
 * against store. 🚩 The cells draw rows; nothing here copies, logs or exports one.
 */
export function buildChangeColumns(t: TFunction): ColDef<ChangeManifestRow>[] {
  return [
    {
      headerName: t('changes.columns.table'),
      field: 'table',
      width: 170,
      cellClass: MONO,
    },
    {
      headerName: t('changes.columns.kind'),
      field: 'kind',
      width: 140,
      valueFormatter: (p: ValueFormatterParams<ChangeManifestRow, ChangeKind>) =>
        p.value ? t(`kind.${p.value}`, { defaultValue: p.value }) : '',
    },
    {
      headerName: t('changes.columns.key'),
      colId: 'key',
      width: 220,
      autoHeight: true,
      cellRenderer: (p: ICellRendererParams<ChangeManifestRow>) => {
        if (!p.data) return null
        return (
          <ul className="flex flex-col py-1 font-mono text-[12px] leading-5" data-change-key="">
            {changeCells(p.data).key.map((k) => (
              <li key={k.column}>
                {/* A key pair is led by a machine value: isolated once, whole (bidi rule). */}
                {k.text === null ? (
                  <>
                    <Ltr>{k.column}</Ltr> <span className="text-muted-foreground">{t('changes.nullValue')}</span>
                  </>
                ) : (
                  <Ltr>{formatPair(k.column, k.text)}</Ltr>
                )}
              </li>
            ))}
          </ul>
        )
      },
    },
    {
      headerName: t('changes.columns.values'),
      colId: 'values',
      flex: 1,
      minWidth: 420,
      autoHeight: true,
      cellRenderer: (p: ICellRendererParams<ChangeManifestRow>) => {
        if (!p.data) return null
        return (
          <table className="my-1 w-full text-[12px] leading-5" data-change-values={p.data.kind}>
            <thead className="sr-only">
              <tr>
                <th>{t('changes.column')}</th>
                <th>{t('changes.source')}</th>
                <th>{t('changes.store')}</th>
              </tr>
            </thead>
            <tbody>
              {changeCells(p.data).values.map((c) => (
                <tr key={c.column} className="align-top" data-change-column={c.column}>
                  <td className="w-40 pe-3 font-mono text-muted-foreground">
                    <Ltr>{c.column}</Ltr>
                  </td>
                  <td className="w-1/2 pe-3" data-change-side="source">
                    <ValueView t={t} value={c.source} side="source" />
                  </td>
                  <td className="w-1/2" data-change-side="target">
                    <ValueView t={t} value={c.target} side="target" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      },
    },
    { headerName: t('changes.columns.capturedAt'), field: 'capturedAt', width: 150, cellClass: MONO, valueFormatter: formatTime },
  ]
}
