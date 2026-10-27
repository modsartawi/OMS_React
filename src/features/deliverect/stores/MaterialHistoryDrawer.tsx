import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { apiErrorCode, apiErrorMessage } from "@/core/api";
import type {
  DeliverectMaterialLine,
  DeliverectStoreRow,
} from "@/core/models/deliverect";
import Button from "@/core/ui/Button";
import ErrorBanner from "@/core/ui/ErrorBanner";
import Ltr from "@/core/ui/Ltr";
import StatusBadge from "@/core/ui/StatusBadge";
import SideSheet from "@/core/ui/SideSheet";
import SideSheetHeader from "@/core/ui/SideSheetHeader";
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
import { SHEET_BODY, TD, TH } from "@/core/ui/sheet-table";
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'


/**
 * **A material's sync history at one store** (ticket 550; BackOffice 3026, `GET Sync/{store}/Lines?plu=`)
 * — every line sent for one PLU at the store in the last 15 days, newest push first, each with its
 * push's type, status and Deliverect's callback. It answers "what stock did Deliverect last get
 * for 601624 at P001?" without opening runs one by one. A refused push's line reads Attempted,
 * never Sent; an out-of-stock line is marked.
 *
 * The frame is core's `SideSheet` (graduated by ticket 556; its header is core's `SideSheetHeader`, ticket 554).
 */
export default function MaterialHistoryDrawer({
  row,
  onClose,
}: {
  row: DeliverectStoreRow;
  onClose: () => void;
}) {
  const { t } = useTranslation("deliverect-stores");
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

  return (
    <SideSheet onClose={onClose} width="w-[60rem]" aria-labelledby={titleId} data-material-history-drawer={row.storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t("material.eyebrow")}
        title={<Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>}
        hint={t("material.hint", { days, max: fsi(String(MATERIAL_LINES_MAX)) })}
        closeLabel={t("material.close")}
        onClose={onClose}
        titleData={{ "data-material-title": "" }}
        closeData={{ "data-material-close": "" }}
      />
      <div className={SHEET_BODY}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = draft.trim();
            if (next === plu) void history.refetch();
            else setPlu(next);
          }}
        >
          <Field label={t("material.plu")}>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("material.pluPlaceholder")}
              dir="ltr"
              className="w-48 font-mono"
              data-material-plu=""
            />
          </Field>
          <Button
            type="submit"
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
    </SideSheet>
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
