import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { Loader2, Search, X } from "lucide-react";
import { apiErrorCode, apiErrorMessage } from "@/core/api";
import type {
  DeliverectMaterialLine,
  DeliverectStoreRow,
} from "@/core/models/deliverect";
import Button from "@/core/ui/Button";
import ErrorBanner from "@/core/ui/ErrorBanner";
import Ltr from "@/core/ui/Ltr";
import StatusBadge from "@/core/ui/StatusBadge";
import { SHEET } from "@/core/ui/overlay";
import { formatDateTime } from "@/core/util/date-format";
import { formatPair, fsi } from "@/core/util/bidi";
import { materialLinesKey, storesApi } from "./api";
import { LineCells } from "./PushLines";
import { syncTypeKey } from "./sync-health";
import {
  LINES_KEPT_DAYS,
  MATERIAL_LINES_MAX,
  figure,
  pushOutcome,
  readLine,
} from "./sync-lines";
import { TD, TH } from "./table-cells";

const INPUT =
  "h-8 w-48 rounded-md border border-border/60 bg-background px-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none";

/**
 * **A material's sync history at one store** (ticket 550; BackOffice 3026, `GET Sync/{store}/Lines?plu=`)
 * — every line sent for one PLU at the store in the last 15 days, newest push first, each with its
 * push's type, status and Deliverect's callback. It answers "what stock did Deliverect last get
 * for 601624 at P001?" without opening runs one by one. A refused push's line reads Attempted,
 * never Sent; an out-of-stock line is marked.
 *
 * The frame is the logs drawer's (a native `<dialog>` on the overlay recipe's `SHEET`).
 */
export default function MaterialHistoryDrawer({
  row,
  onClose,
}: {
  row: DeliverectStoreRow;
  onClose: () => void;
}) {
  const { t } = useTranslation("deliverect-stores");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState("");
  const [plu, setPlu] = useState("");
  const history = useQuery({
    queryKey: materialLinesKey(row.storeCode, plu),
    queryFn: () => storesApi.materialLines(row.storeCode, plu),
    enabled: plu !== "",
    retry: false,
  });
  const days = fsi(String(LINES_KEPT_DAYS));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-material-history-drawer={row.storeCode}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target === ref.current) onClose();
      }}
      onClose={() => {
        if (ref.current && !ref.current.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={
        "end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[60rem] max-w-[96vw] border-0 border-s p-0 " +
        SHEET
      }
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {t("material.eyebrow")}
            </span>
            <h2
              id={titleId}
              className="text-sm font-semibold tracking-tight"
              data-material-title=""
            >
              <Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>
            </h2>
            <span className="text-xs text-muted-foreground">
              {t("material.hint", {
                days,
                max: fsi(String(MATERIAL_LINES_MAX)),
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("material.close")}
            title={t("material.close")}
            data-material-close=""
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = draft.trim();
              if (next === plu) void history.refetch();
              else setPlu(next);
            }}
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t("material.plu")}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("material.pluPlaceholder")}
                className={INPUT}
                dir="ltr"
                data-material-plu=""
              />
            </label>
            <Button
              type="submit"
              className="h-8"
              disabled={draft.trim() === "" || history.isFetching}
              data-material-search=""
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              {t("material.search")}
            </Button>
          </form>

          {plu === "" ? (
            <p
              className="text-sm text-muted-foreground"
              data-material-prompt=""
            >
              {t("material.prompt")}
            </p>
          ) : history.isPending ? (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-material-loading=""
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("material.loading")}
            </p>
          ) : history.isError ? (
            <div data-material-error={apiErrorCode(history.error) ?? ""}>
              <ErrorBanner
                className="p-3"
                title={t("material.failed")}
                message={apiErrorMessage(history.error, t("dialog.failedHint"))}
              />
            </div>
          ) : history.data.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-material-empty="">
              <Trans
                t={t}
                i18nKey="material.empty"
                values={{ plu, days }}
                components={{ plu: <Ltr /> }}
              />
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {history.data.length >= MATERIAL_LINES_MAX && (
                <p
                  className="text-xs text-muted-foreground"
                  data-material-capped=""
                >
                  {t("material.capped", {
                    max: fsi(figure(MATERIAL_LINES_MAX)),
                    days,
                  })}
                </p>
              )}
              <table
                className="w-full border-collapse text-xs"
                data-material-table=""
              >
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("material.columns.sentAt")}</th>
                    <th className={TH}>{t("material.columns.type")}</th>
                    <th className={TH}>{t("material.columns.outcome")}</th>
                    <th className={TH}>{t("material.columns.callback")}</th>
                    <th className={TH}>{t("material.columns.platform")}</th>
                    <th className={TH + " text-end"}>
                      {t("material.columns.price")}
                    </th>
                    <th className={TH + " text-end"}>
                      {t("material.columns.stock")}
                    </th>
                    <th className={TH}>{t("material.columns.stockStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((line, i) => (
                    <MaterialRow
                      key={`${line.logId}|${line.channel ?? ""}|${i}`}
                      line={line}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

/** One line with its push: a refused push's line is Attempted (red), an out-of-stock line amber. */
function MaterialRow({ line }: { line: DeliverectMaterialLine }) {
  const { t } = useTranslation("deliverect-stores");
  const type = syncTypeKey(line.syncType);
  // The contract gives a line's push no end time: a push with no status yet is still running.
  const outcome = pushOutcome(line.status, line.callbackStatus, !line.status);
  const out = readLine(line).outOfStock;
  return (
    <tr
      className={
        "border-b border-border/40 " +
        (outcome === "attempted"
          ? "bg-danger-050"
          : out
            ? "bg-attention-050"
            : "")
      }
      data-material-line={line.logId}
      data-material-attempted={outcome === "attempted" ? "" : undefined}
      data-line-out={out ? "" : undefined}
    >
      <td className={TD} data-material-sent-at="">
        <Ltr>{formatDateTime(line.sentAt)}</Ltr>
      </td>
      <td className={TD} data-material-type="">
        {type ? t(`logs.type.${type}`) : <Ltr>{line.syncType}</Ltr>}
      </td>
      <td className={TD} data-material-outcome="">
        <StatusBadge
          sev={
            outcome === "attempted"
              ? "bad"
              : outcome === "running"
                ? "mute"
                : "ok"
          }
        >
          {/* One flex item: the words and the code, with the space between them kept. */}
          <span>
            {outcome === "running"
              ? t("logs.running")
              : t(`material.outcome.${outcome}`)}{" "}
            <Ltr>{line.status}</Ltr>
          </span>
        </StatusBadge>
      </td>
      <td className={TD + " font-mono"} data-material-callback="">
        {line.callbackStatus ? (
          <Ltr>{line.callbackStatus}</Ltr>
        ) : (
          <span className="font-sans text-muted-foreground">
            {t("logs.noCallback")}
          </span>
        )}
      </td>
      <LineCells line={line} />
    </tr>
  );
}
