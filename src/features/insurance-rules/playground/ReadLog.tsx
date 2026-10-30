import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import Ltr from "@/core/ui/Ltr";
import StatusBadge from "@/core/ui/StatusBadge";
import { fsi } from "@/core/util/bidi";
import { TD, TH } from "@/core/insurance-rules/parts";
import type { ReadRow, ReadShown, ReadsView } from "./reads";

/**
 * The read log on Outcome tab A (ticket 686): every fact the engine read, per line — a field as raw → parsed, a missing
 * fact as "missing", a derived one marked derived, an eligibility fact marked as the whole request's, and a request- or
 * patient-scope field flagged "no live source". It draws a `ReadsView` (`./reads`) and nothing of the raw reply.
 */
export default function ReadLog({ reads }: { reads: ReadsView }) {
  const { t } = useTranslation("insurance-playground");
  return (
    <section
      className="flex flex-col gap-2 border-t border-border/60 pt-3"
      data-read-log=""
    >
      <h3 className="text-sm font-semibold">{t("reads.title")}</h3>
      {reads.kind === "none" ? (
        <p className="text-xs text-muted-foreground" data-reads-none="">
          {t("reads.none")}
        </p>
      ) : (
        reads.lines.map((l) => (
          <div
            key={l.line}
            className="flex flex-col gap-1"
            data-read-line={l.line}
          >
            <p className="text-xs font-medium">
              {t("reads.line", { n: fsi(l.line) })}
            </p>
            {l.rows.length === 0 ? (
              <p
                className="text-xs text-muted-foreground"
                data-reads-line-none=""
              >
                {t("reads.lineNone")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className={TH}>{t("reads.rule")}</th>
                      <th className={TH}>{t("reads.block")}</th>
                      <th className={TH}>{t("reads.fact")}</th>
                      <th className={TH}>{t("reads.value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.rows.map((r, i) => (
                      <ReadRowView key={i} row={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function ReadRowView({ row }: { row: ReadRow }) {
  const { t } = useTranslation("insurance-playground");
  return (
    <tr
      data-read-row={`${row.ruleId}:${row.blockPath}:${row.path}`}
      data-read-kind={row.kind}
      data-read-state={row.shown.state}
      data-no-live-source={row.noLiveSource ? "true" : undefined}
      data-whole-request={row.wholeRequest ? "true" : undefined}
    >
      <td className={`${TD} font-mono`}>
        <Ltr>{row.ruleId}</Ltr>
      </td>
      <td className={`${TD} font-mono`}>
        <Ltr>{row.blockPath}</Ltr>
      </td>
      <td className={TD}>
        <div className="flex flex-wrap items-center gap-1">
          <code className="font-mono">
            <Ltr>{row.path}</Ltr>
          </code>
          {row.kind === "derived" && (
            <StatusBadge sev="mute">{t("reads.derived")}</StatusBadge>
          )}
          {row.wholeRequest && (
            <span
              title={t("reads.wholeRequestHint")}
              data-whole-request-badge=""
            >
              <StatusBadge sev="go">{t("reads.wholeRequest")}</StatusBadge>
            </span>
          )}
          {row.noLiveSource && (
            <span data-no-live-source-badge="">
              <StatusBadge sev="warn">{t("reads.noLiveSource")}</StatusBadge>
            </span>
          )}
        </div>
      </td>
      <td className={TD}>
        <div className="flex items-center gap-1 whitespace-nowrap">
          {row.raw !== null && (
            <>
              <code
                className="rounded bg-muted px-1 font-mono"
                data-read-raw=""
              >
                <Ltr>{row.raw}</Ltr>
              </code>
              {/* The arrow points along the reading direction: rtl:rotate-180 mirrors it. */}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden />
            </>
          )}
          <Shown shown={row.shown} />
        </div>
      </td>
    </tr>
  );
}

export function Shown({ shown }: { shown: ReadShown }) {
  const { t } = useTranslation("insurance-playground");
  if (shown.state === "value")
    return (
      <span className="font-mono" data-read-value={shown.text}>
        <Ltr>{shown.unit ? `${shown.text} ${shown.unit}` : shown.text}</Ltr>
      </span>
    );
  if (shown.state === "missing")
    return <StatusBadge sev="warn">{t("reads.missing")}</StatusBadge>;
  return (
    <>
      <span data-read-unparsed={shown.expected ?? "any"}>
        {t(
          `reads.notA.${shown.expected && ["number", "date", "flag", "text"].includes(shown.expected) ? shown.expected : "any"}`,
        )}
      </span>
      <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden />
      <StatusBadge sev="warn">{t("reads.unknown")}</StatusBadge>
    </>
  );
}
