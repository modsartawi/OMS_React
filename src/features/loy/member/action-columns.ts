import type { ColDef, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { LoyMemberActionRow } from '@/core/models/loy'
import { formatDateTime } from '@/core/util/date-format'

/**
 * The Actions tab's seven columns (ticket 238, settled by 226 §5).
 *
 * **Action is the headline** — an audit row's first question is *what happened* —
 * and **By** is why the tab exists at all: it answers "who did this to my
 * account", which is the one thing the member cannot see for themselves.
 *
 * 🚩 **No sort, no filter, and that is the decision this file is here to make
 * visible.** *Sort what you hold, never what you are paging through.* The other
 * two tabs hold their entire window in the browser, so sorting them reorders the
 * **result**; this tab holds 25 rows of N, so sorting would reorder a **page** and
 * call it a result — the same class of lie the invisible window would be. The
 * Nphies lists set `sortable: false` for exactly this stated reason and it binds
 * here and only here. A reviewer reading the absence as an oversight should read
 * this paragraph instead.
 *
 * 🚩 **No member-snapshot column.** The wire row is denormalised with the whole
 * member — mobile, full name, email, gender, city name, insurance company,
 * blocked reason, joined date — repeated on all 25 rows of every page. It is the
 * member already on screen in the header, and it would put PII in a grid for no
 * reading benefit. `LoyMemberActionRow` does not carry those fields, so this is
 * enforced by the type as well as by the list below.
 *
 * 🚩 **No row links.** No route accepts an `ActionNo`, and `oms/document/:documentNo`
 * is a different identifier space that would 404 on every row (226 §9).
 */
export const ACTION_DEFAULT_COL_DEF: ColDef<LoyMemberActionRow> = {
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/**
 * A description column's text: the server's joined English, or 🚩 **the raw code
 * when the join found none**.
 *
 * Both description fields are LEFT JOINs, so an action type that is in the data
 * but not in its type table arrives as a `null` description beside a perfectly
 * good code. Rendering the empty cell would tell an agent an action has no name;
 * rendering `MUPD` tells them it has one they cannot read, which is the truth and
 * is also something they can quote to whoever can.
 *
 * Returns `''` only when there is neither — a row with no action code at all is
 * not a thing the source can produce, and inventing a placeholder for it would be
 * inventing a fact.
 */
export function actionText(
  description: string | null | undefined,
  code: string | null | undefined,
): string {
  return description?.trim() || code?.trim() || ''
}

export function buildActionColumns(t: TFunction): ColDef<LoyMemberActionRow>[] {
  return [
    {
      headerName: t('tabs.actions.columns.when'),
      field: 'actionDateTime',
      width: 150,
      // A full stamp here, unlike Sales: `ActionDateTime` really is a stamp, and
      // on an audit trail the minute is the point — two changes in one day are
      // two different stories.
      valueFormatter: (p) => formatDateTime(p.value as string | null | undefined),
    },
    {
      // 🚩 The headline, and the fallback that keeps a cell from going blank.
      headerName: t('tabs.actions.columns.action'),
      colId: 'action',
      flex: 1,
      minWidth: 180,
      valueGetter: (p: ValueGetterParams<LoyMemberActionRow>) =>
        actionText(p.data?.mainActionDescription, p.data?.mainActionType),
    },
    {
      headerName: t('tabs.actions.columns.subAction'),
      colId: 'subAction',
      flex: 1,
      minWidth: 150,
      valueGetter: (p: ValueGetterParams<LoyMemberActionRow>) =>
        actionText(p.data?.subActionDescription, p.data?.subActionType),
    },
    {
      // Free-form and untyped — rendered verbatim, because the screen has no
      // basis for reshaping a payload whose shape the writing code chose.
      headerName: t('tabs.actions.columns.details'),
      field: 'actionData',
      flex: 1,
      minWidth: 160,
    },
    {
      // 🚩 Shown by the user's ruling, over the recommendation to drop it:
      // nothing is hidden from the agent, even where the field is undocumented
      // and empty on most rows.
      headerName: t('tabs.actions.columns.details2'),
      field: 'actionData2',
      flex: 1,
      minWidth: 140,
    },
    {
      // The point of an audit tab: who did this.
      headerName: t('tabs.actions.columns.by'),
      field: 'userId',
      width: 130,
    },
    {
      // A bare code — the report joins no branch name and the door carries no
      // lookup, so the label says "code" and the cell shows one (229).
      headerName: t('tabs.actions.columns.branch'),
      field: 'branchId',
      width: 110,
    },
  ]
}
