import type {
  DeliverectSyncLine,
  DeliverectSyncLinesQuery,
} from "@/core/models/deliverect";
import { skipForPage } from "@/core/ui/pager";
import { formatMoney3 } from "@/core/util/number-format";
import { runFailed } from "./sync-health";

// A Deliverect push's lines (ticket 550; BackOffice 3026, contract § Stock sync lines): how a line
// reads, whether a push's lines reached Deliverect or were only attempted, and the Lines door's
// query from the drawer's filter. Pure: no React, no `t`.

/** A push's lines are kept this many days from its start, then deleted (its log row stays). */
export const LINES_KEPT_DAYS = 15;

/** The drawer reads the Lines door's default page. */
export const SYNC_LINES_TAKE = 200;

/** The material history door answers at most the newest this many lines. */
export const MATERIAL_LINES_MAX = 200;

/** The number a cell or sentence shows, grouped as figures are drawn across the app. */
export const figure = (n: number) => n.toLocaleString("en-US");

export interface LineReading {
  /** The platform's name on a platform row; `null` on the base (location) row. */
  platform: string | null;
  /** The price sent at 3 decimals, or `null` when none was sent — never shown as zero. */
  price: string | null;
  /** The stock sent, grouped, on a base row; `null` on a platform row. */
  stock: string | null;
  /** The stock status as a label key, or `null` for a value the contract does not name. */
  stockStatus: "inStock" | "outOfStock" | null;
  outOfStock: boolean;
}

export function readLine(line: DeliverectSyncLine): LineReading {
  const stockStatus =
    line.stockStatus === "IN_STOCK"
      ? "inStock"
      : line.stockStatus === "OUT_OF_STOCK"
        ? "outOfStock"
        : null;
  return {
    platform: line.channel,
    price: line.price == null ? null : formatMoney3(line.price),
    stock:
      line.channel == null && line.stock != null ? figure(line.stock) : null,
    stockStatus,
    outOfStock: stockStatus === "outOfStock",
  };
}

/**
 * The callback words that mean Deliverect's processing failed. The contract names `"error"`; the
 * others are read the same so a spelling the server did not promise is never shown as delivered.
 */
const CALLBACK_FAILED = new Set(["error", "failed", "failure", "rejected"]);

/**
 * Whether a push's lines reached Deliverect. A push still `running` (no end yet) is neither: its
 * status is not final. A push that failed (`status` other than `"S"`) or whose processing callback
 * reported a failure (read case-blind) keeps its lines as what was **attempted** — never shown as
 * delivered (HITL-550: the callback half is this ticket's reading, owner-overrulable).
 */
export function pushOutcome(
  status: string | null | undefined,
  callbackStatus: string | null | undefined,
  running = false,
): "sent" | "attempted" | "running" {
  if (running) return "running";
  const callbackFailed =
    callbackStatus != null &&
    CALLBACK_FAILED.has(callbackStatus.trim().toLowerCase());
  return runFailed(status) || callbackFailed ? "attempted" : "sent";
}

/**
 * The words that stand in for an empty table: an expired push says its lines are kept 15 days
 * (never "nothing was sent"); a filtered read matched none; a push still running is in progress;
 * otherwise a kept push with no line sent nothing.
 */
export function linesNotice(p: {
  linesKept: boolean;
  total: number;
  filtered: boolean;
  running?: boolean;
}): "expired" | "noneSent" | "noMatch" | "running" | null {
  if (!p.linesKept) return "expired";
  if (p.total > 0) return null;
  if (p.filtered) return "noMatch";
  return p.running ? "running" : "noneSent";
}

/** What the platform filter asks for: every row, base rows only, or one platform typed by name. */
export type PlatformScope = "all" | "base" | "platform";

/**
 * The filter's `platform` from the scope and the typed name: `''` (all rows), `'base'`, or the
 * name trimmed. The name is typed, not picked from the pages read so far, so a platform first
 * carried on a later page can still be asked for (HITL-550). A blank name is all rows.
 */
export function platformParam(scope: PlatformScope, name: string): string {
  if (scope === "base") return "base";
  if (scope === "platform") return name.trim();
  return "";
}

/** The drawer's filter: a PLU (exact), a platform (`''` all rows, `'base'` base rows, else a name), a 1-based page. */
export interface LinesFilter {
  plu: string;
  platform: string;
  page: number;
}

export function linesQuery(filter: LinesFilter): DeliverectSyncLinesQuery {
  return {
    plu: filter.plu.trim() || null,
    channel: filter.platform || null,
    skip: skipForPage(filter.page, SYNC_LINES_TAKE),
    take: SYNC_LINES_TAKE,
  };
}

/**
 * The platform names the filter offers: those seen so far, those the new page carries, and the
 * current selection, each once and sorted. The platform list door rides another grant
 * (`canManageTerms`), so the lines themselves are the source.
 */
export function platformChoices(
  seen: readonly string[],
  lines: readonly DeliverectSyncLine[],
  selected = "",
): string[] {
  const names = new Set(seen);
  for (const l of lines) if (l.channel) names.add(l.channel);
  if (selected && selected !== "base") names.add(selected);
  return [...names].sort((a, b) => a.localeCompare(b));
}
