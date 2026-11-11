---
type: wayfinder-ticket
wayfinder: research
map: 793
status: done
blocked-by: —
---

# 803 — How does a scheduled report reach its recipients by email?

## Question

A report must run on a schedule ("every day at 08:00") and go by email to named people. Find out
what we already have and what it costs:
- **Sending:** what SIS.Api or BackOffice already uses to send email (SMTP relay, Exchange, a
  notification service, the web notification center), and its limits on attachments and
  recipients.
- **Rendering charts without a browser:** server-side PNG or PDF of Recharts panels (a headless
  Chromium job on the analytics host, which has no internet egress), versus an email of figures and
  tables with a link back to the live report. Size, RTL/Arabic rendering and the DMSCO theme.
- **Scheduling:** where the schedule runs (an SIS.Api background service like the copilot rollup
  worker, or a job on the analytics host), one host only, and catch-up after downtime.
- **Who may receive:** internal addresses only, analytics-grant holders only, or anyone the owner
  names. The no-PII rule already holds for the content.
- **Whose rights the run uses:** the scheduler's owner, and what happens when that owner loses the
  grant.

Notes go in `docs/research/793-scheduled-report-email.md`.

## Answer

Notes: [793-scheduled-report-email.md](../docs/research/793-scheduled-report-email.md). The key
citations were spot-checked against BackOffice main (`EmailService.cs`, `appsettings.json` `EmailConfig`,
`PortalLookupAlertService.cs`) and against the print route here (`src/app/router.tsx:80`).

- **Sending:** from SIS.Api through the existing `IEmailService` (MailKit, STARTTLS to the Google Workspace
  relay as `oms@al-dawaa.com.sa`, shared with the login OTP mail). Today it carries To, Subject and a body only.
  v2 extends it with attachments and inline CID images. The analytics host has no egress and cannot reach the relay.
- **Body:** an HTML email of headline figures and small tables, a "data as of" line and a link to the live
  report. Values are isolated per the bidi rule. No SVG and no `data:` images, because Outlook and Gmail drop them.
- **Charts:** a PDF attachment rendered by headless Chromium from the existing report print route
  (`/analytics/print/report/:id`). Chromium is installed at deploy time and the fonts are the ones the app
  already ships. The render signs in with a short-lived, read-only ticket bound to the owner, never a real
  session. A failed render sends the HTML alone with a "charts unavailable" line. Drawing charts in .NET is
  rejected because two renderers would drift apart.
- **Scheduler:** an SIS.Api background worker behind a config gate, on one always-running instance
  (`AlwaysRunning`, idle timeout 0). A claim row per schedule and slot, with a lease, released on a failed
  send. This is the `PortalLookupAlertService` pattern, not the copilot rollup worker's in-memory pass.
  Times are Riyadh local.
- **Catch-up:** a missed slot is sent once, late, with a late notice, until the next slot or the end of the
  day. After that it is skipped and recorded. It is never sent twice.
- **Recipients:** only analytics users who hold the run grant and sit in the report's audience, checked at
  every send. The address must be `@al-dawaa.com.sa`. The cap is 25 recipients per schedule.
- **Rights:** a run uses the owner's rights. If the owner loses run or author, the schedule is **suspended,
  not deleted**. Recipients who left the audience are dropped from that run (`ANALYTICS-413`). A saved
  parameter value that no longer resolves (`ANALYTICS-412`) stops the send and tells the owner.
- **Open asks for BackOffice and infra** (they go into the spec's open asks): the tenant's real Workspace
  limits and attachment cap, and whether report mail gets its own sender mailbox. Chromium on the production
  IIS host, which instance runs the worker, and SMTP egress from it. Which freshness signal a run checks
  before sending. **Rotating the credentials committed in BackOffice source** (an SMTP password in
  `appsettings.json` and in a code comment, Mandrill and Office 365 in `InvoiceEmail.cs`). That last one is
  a security finding outside this map.
