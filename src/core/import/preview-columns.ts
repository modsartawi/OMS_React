import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { ImportLine } from './parse-import'

// The import preview grid (spec 430 D14) — graduated from the geography feature at ticket 438, when
// Document source users became its second feature. `t` is the importing feature's own: its
// `import.preview.*`, `import.action.*` and `import.problem.*` keys word the frame, and `header`
// words each of the feature's columns, so the preview reads like that feature's grid.

/**
 * The preview grid: each line's number and action, then its cells under the spec's columns, then
 * what is wrong with it. An error line shows its cells by position, so a shifted column is seen.
 */
export function importPreviewColumns<K extends string>(
  t: TFunction,
  keys: readonly K[],
  header: (key: K) => string,
): ColDef<ImportLine<string>>[] {
  return [
    { colId: 'line', headerName: t('import.preview.line'), width: 80, type: 'numericColumn', valueGetter: ({ data }) => data?.line },
    {
      colId: 'action',
      headerName: t('import.preview.action'),
      width: 150,
      valueGetter: ({ data }) => (!data ? '' : data.error ? t('import.action.error') : t(`import.action.${data.action}`)),
      cellClassRules: {
        'font-medium text-danger-800': ({ data }) => !!data?.error,
        'text-attention-800': ({ data }) => data?.action === 'delete',
      },
    },
    ...keys.map(
      (key, i): ColDef<ImportLine<string>> => ({
        colId: key,
        headerName: header(key),
        width: 150,
        valueGetter: ({ data }) => data?.cells[i] ?? '',
      }),
    ),
    {
      colId: 'problem',
      headerName: t('import.preview.problem'),
      minWidth: 280,
      flex: 1,
      valueGetter: ({ data }) =>
        data?.error
          ? t('import.problem.columnCount', { count: data.error.found, expected: data.error.expected, withDelete: data.error.expected + 1 })
          : '',
      cellClass: 'text-danger-800',
    },
  ]
}
