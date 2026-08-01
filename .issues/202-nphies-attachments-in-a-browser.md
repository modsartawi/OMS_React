---
type: wayfinder-ticket
wayfinder: prototype
map: 196
status: done
blocked-by: 199
---

# 202 — Attachments in a browser

## Question

`GeneralValidation()` (`NphiesAuthRequestController.cs:1319`) refuses any non-advance authorization
with no attachments: *"Attachments are mandatory"*. So attachments are not a nice-to-have on the
auth request screen — without them the screen cannot submit at all. This ticket makes a rough
prototype and settles the shape.

The WPF flow (line 1139): pick a title (default `"Id"`) and a type (`image` | `pdf`) → `OpenFileDialog`
filtered to `*.JPEG;*.JPG;*.PNG` or `*.PDF` → `NphiesHelpers.ConvertImage` / `ConvertPdf` produce a
**base64 string** → held in a list → each becomes a `SupportingInfo` with
`Category = Attachment` on submit. `NphiesImageViewerController` renders one back from base64.

Questions the prototype answers:

1. **What does `NphiesHelpers.ConvertImage` do beyond base64?** Read
   `Helpers\NphiesHelpers.cs` (33 lines) — if it resizes or re-encodes, the browser must match, and
   the payload size limit that motivated it applies to us too. A phone-camera JPEG base64'd into a
   JSON body is several megabytes; find whether the Nphies service or the proxy caps it.
2. **Capture, not just upload.** The audience includes call-centre agents working from a patient on
   the phone and back-office staff with scans. A file input covers both; a camera capture may matter
   for one and not the other. Decide from the audience, not from what is easy.
3. **The titles.** `AttachmentTitle` is a free-text field defaulting to `"Id"` — is it genuinely
   free, or a short list (id, prescription, report) that should be a select? Free text on a payer
   submission is a data-quality question, and the payer may be matching on it.
4. **Preview and removal** before submit, and whether a previously-submitted authorization's
   attachments are viewable on the detail screen (they come back on `auth/AuthResponse/{id}` as
   `AuthSupportingInfos` with `Attachment` populated).
5. **The cost.** Base64 in a JSON body is the WPF contract; a real upload endpoint would be
   better-behaved but is new server work. Name which, and price it.

Blocked by [199](199-nphies-scope-of-acts.md) because the mandate is claim-type-dependent —
advance prior auth is exempt, and if v1 turns out to be advance-only this ticket shrinks to nothing.

Prototype under `.issues/assets/196-nphies/`, linked from the answer.

## Comments

**2026-07-31, from [198](198-nphies-proxy-contract.md) — question 5 is half-answered, and the
Nphies service's source is now readable.** The transport is confirmed as **base64 inside the auth
JSON**: `AuthSupportingInfoRequest.Attachment` is a plain string on the `Auth/Auth` body
(`C:\Work\DMSCO\nphies\Service\NphiesService\NphiesService\Features\Auth\Dtos\AuthSupportingInfoRequest.cs:14`).
The service's separate multipart endpoints (`Auth/UploadAuthRequest` and siblings) are **ruled out of
scope** — a WPF-only special case — so there is no upload endpoint to fall back on and no multipart
anywhere in the proxy. If this ticket wants "a real upload endpoint would be better-behaved", that is
**new work on the Nphies service**, not a switch to something that already exists.

Question 1's size cap is now answerable from source rather than guessed — the service is on disk at
`C:\Work\DMSCO\nphies\Service\NphiesService\`. Note also that 198 priced the proxy assuming
JSON-only; a multipart transport would reopen that figure.

## Answer

**One file input, a fixed document list, and a canvas downscale — and the whole thing is browser
work with no server change at all.** [Prototype](assets/196-nphies/attachments-prototype.html)
(working: pick a real file and the re-encode and base64 size are computed live).

### 1. `ConvertImage` does nothing beyond base64 — and there is no size cap anywhere

`NphiesHelpers.cs:11-20` is `Image.FromFile` → `image.Save(m, image.RawFormat)` → `ToBase64String`:
a re-encode in the file's **original** format. No resize, no quality change, no metadata policy. It
is byte-equivalent to `File.ReadAllBytes` for every format GDI+ round-trips, and `ConvertPdf` is
literally `ReadAllBytes` + base64. **So the browser has nothing to match** — `FileReader` on the raw
file is the same contract. WPF's two functions exist because `OpenFileDialog` hands back a path, not
because a transform was wanted.

**The cap the question assumed exists does not.** Searched both hops and the schema:

| Where | What was found |
|---|---|
| NphiesService | no `MaxRequestBodySize`, no `RequestSizeLimit`, no `maxAllowedContentLength` — the published `web.config` is the bare `AspNetCoreModuleV2` stub |
| SIS.Api | same: nothing configured |
| DB column | `Property(c => c.Attachment, mapper => mapper.Length(4002))` (`NAuthSupportingInfoMap.cs:19-23`) — on `MsSql2008Dialect` (`hibernate.cfg.xml:12`) any length over 4000 is the NHibernate idiom for **`NVARCHAR(MAX)`**. Deliberately unbounded. |

The only ceiling is the **un-configured ASP.NET Core default of ~28.6 MB, per hop** — a default
nobody chose, not a decision. **NPHIES's own limit is not knowable from this source** and is
recorded as a spec dependency, not a blocker: after the downscale below, a typical request is a few
hundred KB and the question stops mattering. A cap that only bites at 28 MB is not a design input.

### 2. File picker only — no camera

Ruled by the requester. Both audiences already hold the file when they reach the screen: the
back-office scans it, and the call-centre agent has the patient on a **phone**, so the document
arrives by some other channel before it can be attached. Camera capture would serve neither, and a
desktop webcam photographing an ID card is worse than the scan it replaces. Noted as a v1+ item if
agents ask for it; not costed here.

### 3. The type dropdown dissolves; images are downscaled and re-encoded to JPEG

WPF makes you pick `image` or `pdf` **first**, solely so it can set the `OpenFileDialog` filter
(`:1141-1154`), and throws `"File type and title are required!"` if you don't. The browser reads the
file's MIME and derives `AttachmentType` itself — **one more control gone**, the same dissolution
[199](199-nphies-scope-of-acts.md)/[200](200-nphies-identity-and-context.md)/[203](203-nphies-screen-shape.md)
kept finding.

**Images: canvas-downscale to a 2000 px longest edge at JPEG q0.85, then base64.** A 6 MB phone
photo becomes ~250 KB while an ID card stays legible. This is a deliberate *divergence* from WPF,
which sends the original whole — justified because the payload crosses two hops with no configured
limit and a 100 s synchronous submit ([198](198-nphies-proxy-contract.md)).

🚩 **A latent WPF defect the divergence happens to fix.** `Extensions.cs:725` sets
`ContentType = AttachmentType == "image" ? "image/jpeg" : "application/pdf"` — hardcoded. WPF's
filter admits `*.PNG` (`:1149`), so **today a PNG is submitted to the national exchange labelled
`image/jpeg`**. Converting to real JPEG in the browser makes the hardcoded string true for the web's
traffic. It does **not** fix WPF's, and that is worth reporting to the Nphies service team as a
separate defect — it is not this map's to fix.

**PDFs pass through untouched, refused over 5 MB** with a re-scan message at the picker. Nothing to
downscale, and a cap an order of magnitude inside the default keeps the submit honest.

### 4. Fixed title select, duplicates allowed

`AttachmentTitle` is free text defaulting to `"Id"` (`:1232`) and reaches the payer verbatim. Ruled
a **closed select, no free-text escape** — a typo at a national exchange is a data-quality defect,
and the requester took the trade knowingly. Seven values, shipped as drafted and revisited only if a
payer refuses one:

`Id` (National ID / Iqama — keeps WPF's wire value) · `Prescription` · `Medical report` ·
`Lab result` · `Radiology report` · `Insurance card` · `Referral letter`

**The same title may be used twice.** Two prescriptions are two prescriptions; `Sequence`
(`AuthService.cs:332`) already makes each supporting-info row distinct, so nothing collides. This is
the *opposite* of [208](208-nphies-the-auth-is-an-engine-document.md)'s duplicate-item refusal, and
correctly so — a duplicate engine line really does collide, a duplicate title does not.

### 5. Mandatory is a form state; preview and removal are inline; the detail screen shows them back

`GeneralValidation()` (`:1319-1325`) refuses any non-advance authorization with no attachments, and
v1 is claim type 0 only ([199](199-nphies-scope-of-acts.md)) — **so every v1 submission needs at
least one**, with no advance-auth exemption to shrink this ticket. The web makes it a standing form
state: a banner while empty and **Submit disabled**, not an exception thrown after the agent has
filled in everything else. Removal is per-row (WPF: select-then-`RemoveAttachment`, `:1187-1197`),
and WPF's separate `NphiesImageViewerController` window becomes an inline lightbox off the same data
URL that will be sent — you preview exactly what goes.

**On the detail screen: yes, thumbnails, click to open — and it costs no endpoint and no server
change.** `cfg.CreateMap<NAuthSupportingInfo, AuthSupportingInfoDto>()` (`AuthMapper.cs:28`) maps
`Attachment` straight through, so `auth/AuthResponse/{id}` **already returns the base64 whether we
render it or not**. An agent chasing a rejection sees what the payer was actually sent without
opening WPF. The consequence to note for [198](198-nphies-proxy-contract.md): the proxied detail
response carries every attached megabyte, so the downscale in §3 pays twice.

### 6. The cost

**Base64 in the auth JSON is the transport, and it stays.** [198](198-nphies-proxy-contract.md)
already ruled the multipart siblings out of scope and confirmed `AuthSupportingInfoRequest.Attachment`
is a plain string on `Auth/Auth`. "A real upload endpoint would be better-behaved" would be **new
work on the Nphies service** plus a reopened proxy figure — and after the downscale there is nothing
left for it to buy. **Priced at zero and dropped.**

| | |
|---|---|
| Nphies service | **no change** |
| SIS.Api | **no change** — the field is already on the body [198](198-nphies-proxy-contract.md) proxies |
| Browser | **~1 developer-day** — file input, canvas downscale, title select, row list, lightbox, the empty-state gate. No library: `FileReader` and `<canvas>` are native. |

**Net effect on the map's estimate: +1 day, and the only ticket so far that adds no server work at
all.** No new endpoint, no new grant (access is [200](200-nphies-identity-and-context.md)'s single
screen grant), no new model.

### Carried to the spec, not ticketed

- **NPHIES's own attachment size limit is unverified** — ask the Nphies service team when the spec is
  written. Not a blocker: the downscale puts a typical request three orders of magnitude below the
  smallest plausible cap.
- **The PNG-labelled-`image/jpeg` defect in `Extensions.cs:725`** affects WPF traffic today. Report
  it; do not fix it from here.
