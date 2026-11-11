# 793 — Scheduled report email: sending, charts without a browser, scheduling, recipients, rights

Research for map [793](../../.issues/793-hq-analytics-v2-team-reports-with-parameters-over-more-sources-map.md)
(scheduled delivery), gathered 2026-11-06. It decides nothing. It builds on
[794](../../.issues/794-who-is-a-team-when-an-analytics-item-is-shared-and-what-may-the-team-do-with-it.md) (audience, author,
runner) and [797](../../.issues/797-what-parameters-may-an-author-declare-and-how-do-they-bind-to-panels.md) (parameters).

"BO" means `C:\Work\DMSCO\BackOffice` (read only). Paths below are relative to it unless they start with `src/`,
`docs/` or `.issues/` in oms-react. **(inference)** marks my own reasoning, not a source's. **No secrets are copied
here.** Several are committed in BO source. They are flagged in Open asks.

## 1. Sending: what already exists

| Path | Where | Transport | Shape |
|---|---|---|---|
| **SIS.Api `IEmailService`** | `Sartawi.Retail.Data/Modules/Mail/EmailService.cs:13-36` | MailKit `SmtpClient`. It connects, authenticates, sends and disconnects on **every** message (`:31-35`). STARTTLS unless `UseSsl` (`:27-29`). | `EmailMessage` is `To[]`, `Subject`, `Body`, `IsHtml` only (`Modules/Mail/EmailMessage.cs:5-11`). **No attachments, no inline images, no Cc/Bcc.** Body is one `TextPart` (`EmailService.cs:21-24`). |
| Its config | `Modules/ApplicationServiceCollectionExtensions.cs:118-129`. The keys are `EmailConfig:*` and it is registered scoped. | `Services/SIS.Api/appsettings.json:70-78`: host `smtp.gmail.com`, port 587, `UseSsl:false` (so STARTTLS), username and sender `oms@al-dawaa.com.sa`, display name `OMS`. The password is in the file (**redacted**). | It is a **Google Workspace mailbox over SMTP AUTH** (inference from the host and the company domain). |
| Its callers today | UA password reset OTP (`Modules/Auth/UaLogin/Services/UaPasswordResetService.cs:460`). TOTP enrolment OTP (`UaTotpEnrollmentService.cs:196`). The delivery-cancelled notice, with two **hard-coded internal** recipients (`Modules/Sd/Outbox/Handlers/Notify/NotifyDeliveryCancelledHandler.cs:46-59`). The portal alert, with a **configured** list (`Modules/SmartAcquisition/Portal/PortalLookupAlertService.cs:98-158`, `SmartAcquisitionPortalOptions.cs:163-170`). | | Every report mail would share **one mailbox's quota** with the login OTPs. |
| WPF invoice-email job (not SIS.Api) | `Sartawi.Retail/SendEmails/InvoiceEmail.cs:94-101, 146-152` | MailKit to `smtp.mandrillapp.com:587`. A credential is **hard-coded** in source (**redacted**). | It is the only existing path with an **attachment** (PDF through `BodyBuilder.Attachments`, `:94-96`). MailKit/MimeKit 4.15 in both projects (`Sartawi.Retail.Data.csproj:76-77,190-191`). |
| "Email OTP override" | `email-otp-override-2026-09-22.md:24` | **SMS OTP to a mobile number**, not email. It is a till return override and does not bear on this. | — |
| Web notification center | `Modules/NotificationCenter/NotificationCenterFeature.cs:10-14`, `Services/SIS.Api/Hubs/NotificationHub.cs`, `Endpoints/Notifications/NotificationEndpoints.cs` (last change `acd693de9`, 2026-11-02) | In-app SignalR. It does **not** send email: it is not among `IEmailService`'s callers (grep). | **The memory line "backend missing" is stale.** The backend exists, behind `NotificationCenter:Enabled`. |

**Limits.** No code limit exists on recipients or body size (`EmailService.cs`). The relay limits below are the
published **Google Workspace** limits. They are **typical, unverified for this relay**: it depends on the tenant
plan and admin settings.

| Limit | Value | Source |
|---|---|---|
| Recipients per message via SMTP (POP/IMAP users) | **100** | [Workspace sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) |
| Messages per user per day (rolling 24 h) | 2,000 | same |
| Total recipients per day / external recipients per day | 10,000 / 3,000 | same |
| Attachment size | 25 MB for personal accounts. Workspace sets its own value per admin. | [Gmail help 6584](https://support.google.com/mail/answer/6584) |

## 2. Drawing charts without a browser

Today v1 draws charts with **Recharts in the browser** (`package.json:26`, `recharts 3.10.1`). A copilot report
already has a **chromeless print route**, `/analytics/print/report/:id` (`src/app/router.tsx:79-84`). That page calls
`window.print()` once every query has landed (`src/features/analytics/boards/AnalyticsReportPrintPage.tsx:33-38`).
The app **ships its own fonts**, including Arabic: Roboto, Avenir Arabic 400/500/600-700 and Plex Mono, all in
`src/assets/fonts/` (`src/app/global.css:34-92`, `--font-sans` at `:99`). Nothing is loaded from a CDN.

| | (a) Headless Chromium renders the real print route | (b) .NET draws the charts on the server | (c) HTML email: figures and tables, plus a link |
|---|---|---|---|
| What exists | Playwright is **not** a dependency. The drives load a global install through a `createRequire` shim (`tools/screen1-smoke.mjs:9-12`). By default the browsers download from Microsoft's CDN. Offline you need `PLAYWRIGHT_DOWNLOAD_HOST` or a pre-filled `PLAYWRIGHT_BROWSERS_PATH`, plus `install-deps` on Linux ([playwright.dev/docs/browsers](https://playwright.dev/docs/browsers)). | **No server chart library.** SIS.Api is `net8.0` (`Services/SIS.Api/SIS.Api.csproj:4`) and its package list (`:17-64`) has no SkiaSharp, ScottPlot or OxyPlot. Only `System.Drawing.Common 8.0.12` (`:58`), which is Windows-only from .NET 6 ([MS breaking change](https://learn.microsoft.com/dotnet/core/compatibility/core-libraries/6.0/system-drawing-common-windows-only)). DevExpress 12.1 charts and Stimulsoft are WPF/desktop references (csproj grep). | Already possible: `IsHtml` (`EmailMessage.cs:10`). |
| RTL / Arabic | **Exact.** The same CSS, `dir`, bidi isolates and bundled Avenir Arabic as the screen. | You would need Arabic shaping and bidi in a .NET drawing library, plus the font files copied in. All of it is new. | Good. Text in HTML is shaped by the mail client. Wrap values in `<bdi>` (the bidi rule applies). |
| DMSCO theme fidelity | Exact (one renderer). | It drifts. Colour slots, number formats and axis rules would be re-implemented in C#. | Tokens are hand-copied as inline CSS. There are no charts. |
| Maintenance | One renderer. The cost is a browser binary on a host, plus a render session. | **Two chart renderers drifting.** Every new chart kind or format lands twice. | Low. A table template per panel kind. |
| Size (inference) | PDF of an A4 report: around a few hundred KB. A PNG per chart: around 50-150 KB each. | Similar PNGs. | Tens of KB. |
| Host cost | Chromium in the one analytics image would grow it a lot (the Cube base image is Debian, `Analytics/image/Dockerfile:19-29`). On the IIS host it means a Chromium process per render under the app-pool identity. | A NuGet package plus fonts. | None. |

**Email-client constraints**

| Technique | Outlook Windows | Gmail webmail | Outlook.com / Apple Mail | Source |
|---|---|---|---|---|
| SVG `<img>` (a Recharts chart is SVG) | **No** for 2007-2016, yes for 2019 | **No**. The 2026-09 entry is partial and rasterised to PNG. | Yes / partial by version | [caniemail image-svg](https://www.caniemail.com/features/image-svg/) (raw data: [GitHub](https://raw.githubusercontent.com/hteumeuleu/caniemail/main/_features/image-svg.md)) |
| `data:` base64 images | **No** for 2007-2016 | **No** | Yes | [caniemail image-base64](https://raw.githubusercontent.com/hteumeuleu/caniemail/main/_features/image-base64.md) |
| CSS flex layout | **No** for 2007-2019 | Yes | — | [caniemail css-display-flex](https://raw.githubusercontent.com/hteumeuleu/caniemail/main/_features/css-display-flex.md) |
| Inline CID images | MimeKit `BodyBuilder.LinkedResources` with `ContentId` and `<img src="cid:…">` ([MimeKit docs](https://mimekit.net/docs/html/Creating-Messages.htm)). `EmailService` would have to switch from `TextPart` to `BodyBuilder`. | | | |

So charts in the body must be **PNG**, either as CID images or as an attachment. **A PDF attachment** from (a) carries
the whole report exactly as printed, and the HTML body stays table-based, so it survives Outlook (inference).

## 3. Scheduling: where it runs, one host only, catch-up

| Option | Evidence | Fit |
|---|---|---|
| **SIS.Api `BackgroundService`** | This is the house pattern. More than 90 `AddHostedService` calls, each gated by a config `"X"` (`Services/SIS.Api/Program.cs:131-815`). The copilot rollup worker (spec 734/3345) is gated by `Copilot:SalesRollupWorker` and runs on **exactly one host**, because its nightly pass is remembered **in memory** (`BackgroundServices/Copilot/TillSalesRollupBackgroundService.cs:13-16`, `Program.cs:600-602`). | Good. It holds the store, the grants, the compiler and `IEmailService`. |
| A safer "once" pattern already in SIS.Api | The portal alert takes a **claim row** per hour inside a transaction (`PortalLookupAlertService.cs:25-26, 73`). A failed send **releases** the claim so a later tick retries (`:92, 115`). A claim older than `ClaimLeaseMinutes` (15) is taken over (`:59-67`). Unjudged hours are retried for `CatchUpHours` (3) (`SmartAcquisitionPortalOptions.cs:182-196`). It is "once per hour across instances". | **The model to copy**, so a second instance is harmless. |
| IIS implications | Production runs **four SIS.Api instances** (`.issues/428-PROD-WEB-HOSTING.RESEARCH.md:134`). An in-process worker needs its app pool on `AlwaysRunning`, preload on, idle timeout 0 and no periodic recycle, or it "waits for the first HTTP request" (`.issues/2505-where-the-push-runs-and-how-it-picks-stores.md:57-61`). Prod recycles were seen at about 00:25 and 09:27 on 2026-10-21 (`.issues/2523-STORE-SYNC-WORKER.RUNBOOK.md:45-53`). | A 08:00 send can be cut by a recycle. The claim, release and lease handle that. |
| Hangfire / Quartz | Quartz 2.1 appears only in desktop/WPF projects (`Sartawi`, `Sartawi.Retail`, `SapIntegration`, `IDocUploader` csproj). There is none in SIS.Api (`SIS.Api.csproj:17-64`). No Hangfire anywhere (grep). | Do not add one. |
| Job on the analytics host | It runs supercronic in the one container, `TZ=Asia/Riyadh`, with exactly one instance (`Analytics/image/Dockerfile:2-6, 71`). dbt runs nightly at 03:00 and every 15 min intraday (`Analytics/image/crontab:3-6`). The host has **no internet egress** (`docs/adr/0006-…md:48`, `.issues/766-…spec.md:217`), so it **cannot reach `smtp.gmail.com`**. It also has no grants, store or audit. | Poor. It would have to call back into SIS.Api anyway. |

**Catch-up (inference, on the alert's pattern).** Keep one claim row per `(schedule, due slot)`.

- If the slot passed while the host was down, send **once, late**, if it is still inside a window. Say, until the
  next slot or the end of the day, with a "sent late, data as of …" line.
- After that window, **skip** the slot and record it as missed. Never send twice.
- A daily 08:00 slot comes after the 03:00 nightly. The run should still check the marts' freshness (the v1
  freshness signal), and say "data as of" if the nightly has not finished.

## 4. Who may receive

- **No existing outbound allowlist.** The UA email check is **format only, by decision**: "Do not quietly add a
  domain allowlist here" (`Modules/Auth/UaLogin/Services/UaEmailFormat.cs:10-17`). The invoice resolver only skips
  `@support.com` (`Modules/EmailDelivery/Rules/InvoiceEmailRecipientResolver.cs:121`).
- The internal lists in use are all `@al-dawaa.com.sa` (`NotifyDeliveryCancelledHandler.cs:50-51`,
  `SmartAcquisitionPortalOptions.cs:163`).
- **Inference:** the mail carries the same figures the item shows. A recipient outside the item's audience would
  get data that the screen refuses them with `ANALYTICS-413` (794 Answer §7). An email recipient is a second door
  into the data, so it should be gated the same way.

| Option | Leak risk | Fit with 794 |
|---|---|---|
| Anyone the owner names | Highest. An external or typo'd address gets HQ figures. | It bypasses audience and `ANALYTICS-413`. |
| Internal domain only | Medium. Any employee. | It still bypasses the audience. |
| **Analytics users with run, inside the report's audience, at send time** | Lowest. Forwarding is the residual risk. | **The same rule as the screen.** |

## 5. Whose rights the run uses

- Cube receives an **actor** in its token (`Sartawi.Retail.Data/Modules/Analytics/AnalyticsCubeClient.cs:22`). The
  scheduled run should compile and query **as the schedule's owner**: the same compiler, the same caps, audited
  with the owner as actor and the schedule as the cause. A service identity would see more than any person
  (inference).
- Refusal codes exist up to `ANALYTICS-410` (`Modules/Analytics/AnalyticsRefusals.cs:14-42`). 411, 412 and 413 are
  new in 797 and 794.
- **The headless render (option a) needs a session.** The web client authenticates with the `sis_session` cookie
  and the `X-Web-Client` header (`.issues/403-ANGULAR-PROTOTYPE-CONTRACT.RESEARCH.md:27`, `.issues/428-…:126`). It
  should get a **short-lived render ticket** minted by the worker. The ticket is bound to `{item, revision, values}`
  and the owner as actor, and it is read-only. It must never be a real owner session (inference).

| Event at run time | Recommended outcome |
|---|---|
| The owner lost **run** (`ANALYTICS-401`) or **author** (794 §2: scheduling is building) | The schedule is **suspended**, not deleted, with the code recorded. A curator may delete it. It resumes if the grant returns. This touches the map's fog item "An owner who loses the author grant". |
| A recipient is no longer in the audience, or lost run | That recipient is **dropped from this run**. Recorded as skipped with `ANALYTICS-413` / `401`. The others still receive it. |
| The audience was narrowed and the owner is outside it | Impossible for the owner's own item. A curator unsharing it leaves it Personal: owner-only recipients. |
| A saved parameter value no longer valid (`ANALYTICS-412`), e.g. a member removed from the model | The run fails **closed**. No mail goes to recipients. The owner gets a failure notice. 797 §2 guarantees defaults are never empty, but it does not guarantee they stay valid. |
| A declaration is invalid (`ANALYTICS-411`) | It is refused when the schedule is saved, so it never reaches run time. |
| Cube timeout or unreachable (`408`/`409`) | Release the claim and retry within the catch-up window, then record it as missed. |

## Recommended answer

1. **Send from SIS.Api through `IEmailService`, extended**: `BodyBuilder` with attachments and CID images, and Bcc or
   one message per recipient. The analytics host has no egress and cannot reach the relay.
2. **The body is an HTML email** of tables (headline figures per panel, small tables, a "data as of" line, a link to
   the live report). There is no SVG, no `data:` image and no flex. Values are wrapped in `<bdi>`, strings come
   from the locale, and `dir` follows the owner's locale.
3. **Charts go in a PDF attachment** rendered by **headless Chromium from the existing print route** on the SIS.Api
   worker host. Chromium is pre-installed at deploy (`PLAYWRIGHT_BROWSERS_PATH`) and nothing is downloaded at run
   time. If the render fails, send the HTML alone and mark "charts unavailable". **Reject (b):** no chart library
   exists on the server and the renderers would drift.
4. **The scheduler is an SIS.Api `BackgroundService`** gated by `Analytics:ReportScheduleWorker == "X"`, on one
   `AlwaysRunning` instance. It uses a **claim row per (schedule, slot)** with release-on-failure and a lease, as
   the portal alert does, so a second instance is harmless. Time is Riyadh local.
5. **Catch-up:** a missed slot is sent **once, late**, until the next slot or the end of the day, with a late notice.
   After that it is skipped and recorded. A slot is never sent twice.
6. **Recipients** are analytics users who hold **run** and are **in the report's audience**, checked at **every
   send**. No free-typed addresses. Optionally the address must also end in `@al-dawaa.com.sa`, as a backstop.
   Cap: about 25 recipients per schedule, well under the SMTP limit of 100.
7. **The run uses the owner's rights**, audited as the owner on behalf of the schedule. If the owner loses run or
   author, the schedule is **suspended**. Each recipient is filtered on each run. An invalid saved value means
   fail closed and tell the owner.
8. **Only authors schedule** (it is building, per 794 §2). The schedule lives on the report, not on a view.
   Managing a schedule (create, pause, delete) is in the item's history.

## Open asks (BackOffice / infra)

- **Relay limits:** confirm that `oms@al-dawaa.com.sa` is Google Workspace and its plan's real daily and
  per-message limits. Decide whether report mail needs its **own sender mailbox**, so a busy morning cannot use up
  the quota the **login OTP** mails depend on.
- **Attachment ceiling** set by the Workspace admin, and whether the recipients' gateway strips PDFs.
- **Chromium on the worker host:** may a headless Chromium run under the SIS.Api app-pool identity on the prod IIS
  host? Which instance is the worker? Can its app pool be set to `AlwaysRunning`, idle 0, no recycle?
- **Egress from the worker host to `smtp.gmail.com:587`:** it works today for OTP mail, but this should be
  confirmed for the instance chosen.
- **Secrets committed in BO source:** an SMTP password in a comment at
  `Modules/ApplicationServiceCollectionExtensions.cs:107-117`, the Mandrill and Office 365 credentials in
  `Sartawi.Retail/SendEmails/InvoiceEmail.cs:151-152, 270`, and the live password in
  `Services/SIS.Api/appsettings.json:75`. They should be rotated and moved to deploy-time config. They are out of
  this map's scope, but they matter once report mail rides on the same mailbox.
- **The freshness signal** that a scheduled run reads before sending ("the nightly finished"). Confirm what v1
  exposes.
