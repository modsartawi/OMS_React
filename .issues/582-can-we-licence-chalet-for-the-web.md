---
type: wayfinder-ticket
wayfinder: research
map: 580
status: done
blocked-by: —
---

# 582 — Can we licence Chalet for the web?

## Question

The design sets all type in **"ChaletBook"** (Bold and Regular; sizes 13–48). The repo has no
Chalet files, so the login shipped in IBM Plex. Before anyone rules on the app's type family,
establish the facts:

- **Who makes it and what it is.** Is "ChaletBook" the House Industries *Chalet* family (Chalet
  Book / London / Paris / New York…), or a custom/derived face? Which styles exist?
- **Web licensing.** Is a web-font (self-hosted woff2) licence sold, under what model (pageviews,
  domains, seats, perpetual vs subscription), and roughly what it costs for an internal back-office
  app served from a few internal hosts.
- **Arabic.** Does it have Arabic glyphs? If not, what does the design's Arabic use (the login
  frame's language pill is set in **Avenir Arabic**), and is that licensable for the web too?
- **Fit for dense UI.** Tabular figures, a distinguishable `1/l/I` and `0/O`, and hinting at
  12–13px — the sizes our grids run at. Plex was chosen for these (ADR 0003).
- **Open alternatives** close in look, if licensing fails.

Write findings to a Markdown note with sources (foundry pages, licence text), linked from here.
The decision itself is [589](589-which-type-family-the-app-sets-type-in.md).

## Answer

Resolved 2026-10-26 (AFK research). Full note with sources: `.issues/assets/582-chalet-web-licence.md`
on the local, unpushed branch `research/582-chalet-web-licence` (commit `5b4e8015`; never merged).

- **What it is:** House Industries' **Chalet Book**, a separate four-font package (Regular, Italic,
  Bold, Bold Italic) from the main Chalet family. The style list comes from a third-party index.
- **Web licence: yes.** Self-hosted woff/woff2, per root domain (subdomains included), tiered by
  unique visitors, one-time payment. Requires referrer blocking and a House copyright comment in the
  CSS.
- **Cost: small, but needs a written quote.** Page data suggests about $50 once for Chalet Book at
  the lowest tier (about $150 for the collection). Online checkout is switched off, so this is
  inferred.
- **The real risk is scope.** The licence defines a domain as a public root domain. Internal IIS
  hosts, some reached by IP, aren't clearly covered and might each need a licence. House must
  confirm in writing.
- **Arabic: no.** None of Chalet's styles has Arabic. The design's Avenir Arabic (Linotype) has a
  MyFonts web licence (per domain, mostly annual, price not visible), but it loses the matched
  Latin/Arabic pairing ADR 0003 chose Plex for.
- **Dense UI: unproven.** The main Chalet family lists tabular figures; the Chalet Book package lists
  only small caps and fractions. The `1/l/I` and `0/O` shapes and small-size hinting were not
  confirmed. Cheap test: set `Il1 O0 1,234.50` at 12px in the Figma file beside Plex.
- **Best open alternative:** Jost (OFL, tabular figures, no Arabic). The look-alike ranking is from a
  third-party site.
- **Researcher's suggestion for 589:** keep Plex for UI and grids, use Chalet Book only on brand
  surfaces (login, headings, the shell mark). That narrows the question to House to "one internal
  app, N hostnames".
