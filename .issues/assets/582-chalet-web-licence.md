# 582: Can we licence Chalet for the web?

Research note for [582](../582-can-we-licence-chalet-for-the-web.md) (map 580). Gathered
2026-10-26. Nothing was bought, signed up for or downloaded.

**Source access.** `houseind.com` redirects to `housefonts.com` (the specimen pages) and to
`houseindustries.com` (licence and FAQ). Both send a 403 to automated fetchers, and their pages
are rendered by JavaScript. The facts below come from the raw HTML of those pages: the FAQ text,
and the JSON the specimen page embeds (`gon.fontFamily`, `gon.licenseOptions`,
`gon.translations.licenseAgreement`). That JSON holds the full licence text. "Primary" below means
House Industries' own pages, read this way.

## Short answer

| Question | Answer | Confidence |
|---|---|---|
| Is "ChaletBook" House Industries' Chalet? | **Yes.** It is **Chalet Book**, a separate 4-style text version of Chalet that House Industries sells as its own package. | High |
| Is a self-hosted web licence sold? | **Yes.** It covers CSS `@font-face` with self-hosted woff/woff2, is sold **per root domain**, is tiered by **unique visitors**, and is paid as a **one-time fee** (perpetual). | High |
| What does it cost for us? | It is probably cheap, roughly **$50–$150 one-time**. That figure is **inferred**, not quoted, because online checkout is switched off on the page. The bigger question is the licence's scope (see §2). | Low (price), High (model) |
| Does it cover Arabic? | **No.** Chalet has no Arabic glyphs. | High |
| Avenir Arabic for the web? | **Yes.** Monotype/Linotype sells a webfont licence through MyFonts, priced by **pageviews** and mostly **annual**. | Medium |
| Is it fit for dense 12–13px grids? | **Unproven, and probably worse than Plex.** Chalet has tabular figures. Chalet Book's tabular figures, the `1/l/I` and `0/O` shapes, and its hinting could not be confirmed. | Low |
| Best open alternative | None is close **and** fit for UI. If the brand feel matters, the nearest usable one is **Jost** (OFL, has tabular figures, no Arabic). On fitness, keeping **IBM Plex** remains the better choice. | Medium |

## 1. What "ChaletBook" is

- **The family.** House Industries' Chalet is "ten typefaces in three unique styles". The
  specimen credits a fictional designer, "René Albert Chalet".
  [housefonts.com/hi/chalet](https://housefonts.com/hi/chalet). Typewolf names the real designers
  as Ken Barber and Paul van der Laan, with a 1996 release.
  [typewolf.com/chalet](https://www.typewolf.com/chalet) (secondary).
- **The styles on the specimen** (`gon.fontFamily.styles`) are Paris / London / New York in 1960,
  1970 and 1980, which are the weights, plus Paris / London / New York Oblique and Tokyo.
  [housefonts.com/hi/chalet](https://housefonts.com/hi/chalet)
- **The packages on the same page** (`fontFamily.packages`):
  - *Chalet*: 13 fonts, "Cyrillic character set, Extended Latin", base price $199.
  - *Chalet Comprimé*: 10 fonts, $175.
  - *Chalet Book*: **4 fonts, "OpenType text features, Small Caps, Fractions"**, $100.
  - *Chalet Entire Collection*: 27 fonts, $299.
- **Chalet Book's four styles.** These are listed only by a third-party font index, as Regular,
  Italic, Bold and Bold Italic. The same index gives the embedded description "We developed this
  special version of Chalet for the House book project" and the copyright "House
  Industries/Brand Design Co. Inc, 2003".
  [font.download/font/chaletbook](https://font.download/font/chaletbook) (secondary, not
  confirmed against House's own pages).
  The design's "ChaletBook Bold + Regular" matches two of those four styles, so we would license
  the **Chalet Book** package, not the main Chalet family.

## 2. Web licensing (House Industries)

**What is sold.** The FAQ lists three standard licences: Desktop, Webfont and Mobile App.
Anything else is handled case by case.

> "Webfont license: This license is specifically for CSS @font-face 'webfont' embedding. The
> license is sold per domain (subdomains are included) and the price varies with unique page
> views. Each domain is a separate license."
> ([houseindustries.com/faq](https://houseindustries.com/faq/))

Delivery is woff and woff2 files that you store on your own server.
([FAQ, "How do I use these woff and woff2 web fonts?"](https://houseindustries.com/faq/)) So
**self-hosting is the normal model**, not a special case.

**Webfont licence terms.** These are quoted from the full agreement text embedded in the specimen
page ([housefonts.com/hi/chalet](https://housefonts.com/hi/chalet),
`licenseAgreement.web`):

- Scope: "only the number of Domains at the maximum number of unique visitors specified on the
  invoice".
- **Domain** means "a single root domain (e.g. houseind.com) … including any subdomains" (§1). One
  licence covers **one** domain (§3).
- **Payment:** "a one-time license fee" (§11). There is no subscription. This makes it perpetual
  under its terms, although House reserves the right to revoke or replace the software (§13).
- **Required technical controls** (§12):
  - block font requests whose referrer is not an allowed domain;
  - put a specific House Industries copyright comment in the CSS next to the `@font-face` link.
- The font files must stay in "your exclusive and actual control" (§3). Redistribution is barred
  (§8f), and so are derivative works, which would include subsetting or converting the files
  (§6).
- Office correspondence and printed communications are excluded (§8h). Our PDF and print exports
  render text in the browser, so this is probably fine, but it is a point to confirm.

**Price model.** The specimen page's `gon.licenseOptions` sets each licence as a multiplier on a
package's base price:

- **Web:** "up to 12,500" visitors at ×0.5; "up to 25,000" at ×1.0. Those are the only two tiers
  listed.
- **Desktop:** 1, 2 or 3 seats at ×1.0, ×1.25 and ×1.5.
- **App:** 1 to 10 apps, ×1.0 up to ×5.5.

**Inferred cost.** Applying the multiplier to the base price gives:

- Chalet Book at up to 12,500 visitors ≈ **$100 × 0.5 = $50, once**.
- The entire collection at the same tier ≈ $150.

This is **an inference from page data, not a quoted price.** On every family checked (Chalet,
Chalet Comprimé, Neutraface, Eames), the page reports `showLicensing=false`, `variants=[]` and
`in_stock=false`. Online purchase appears to be switched off, and the FAQ says to use "Buying
Options" or contact them. Expect to get a quote by email or phone (302-234-2356,
[houseind.com/contact](https://houseind.com/contact/)).

**Distribution change.** Monotype no longer sells or renews House fonts, so licences now come
only from House Industries. Adobe Fonts no longer offers House fonts to new projects.
([FAQ](https://houseindustries.com/faq/))

**Fit to our deployment (the real risk).** The licence is written for a public website on a root
domain, priced by unique visitors.

- **Visitor count is not the problem.** A back-office with a few hundred staff sits well inside
  the 12,500 tier.
- **The deployment shape is.** We serve from several internal hosts (IIS), some of them reached by
  IP and port rather than a registered root domain. Neither the agreement nor the FAQ defines
  intranet or IP-addressed use.
- **Count of licences.** Several hosts on different names could, read literally, each need their
  own Domain licence.
- **Referrer blocking.** §12's referrer allow-list would have to be configured on IIS.

**Not confirmed:** whether House treats an internal app as a standard webfont licence or as a
special licence. Ask them in writing and list the actual hostnames.

## 3. Arabic

- **Chalet has none.** None of the 13 styles' glyph lists on the specimen page contains a single
  Arabic code point (U+0600–06FF, FB50–FEFF). The only extra script named on any package is
  Cyrillic. ([housefonts.com/hi/chalet](https://housefonts.com/hi/chalet), checked against
  `gon.fontFamily.styles[].glyphs`.) The FAQ's minimum language list is all Latin-script.
  ([FAQ](https://houseindustries.com/faq/)) Chalet Book's glyph set is not shown on the page, but
  nothing suggests it has Arabic.
- **Avenir Arabic** is Linotype's, designed by Adrian Frutiger and Nadine Chahine (Arabic by
  Chahine for Monotype).
  - Six weights: Light, Book, Roman, Medium, Heavy, Black.
  - OpenType Arabic features; codepage 1256.
  - MyFonts offers Desktop, Company Desktop, **Webfonts**, App, Electronic Doc and Digital Ad
    licences.
  - Shown price for the 6-style family: $419.99. The page also shows two different per-style
    prices ($149 and $69.99). Both refer to desktop licensing, not web.
  - [myfonts.com/collections/avenir-arabic-font-linotype](https://www.myfonts.com/collections/avenir-arabic-font-linotype)
- **Monotype/MyFonts webfont model:**
  - Self-hosted kit, **one domain**, priced by **pageviews**, "the vast majority … annual".
  - The MyFonts FAQ describes a monthly pageview allowance. Monotype's foundry article says
    pageviews are prepaid and "valid for 1 year", with tiers that scale a base price (×1 at 10k
    pageviews per month, up to ×30 at 2M).
  - [myfonts.com/pages/faq](https://www.myfonts.com/pages/faq),
    [Monotype foundry support: Webfont License](https://foundrysupport.monotype.com/hc/en-us/articles/10839926029588-Webfont-License)
    (behind Cloudflare. Its content is known only from the search-index summary, **not read
    directly**.)
  - "Pay as you go" webfonts also exist and allow several domains.
    [myfonts.com/pages/fontshop-introducing-pay-as-you-go-webfonts](https://www.myfonts.com/pages/fontshop-introducing-pay-as-you-go-webfonts)
- **Not confirmed:**
  - the actual web price for Avenir Arabic at our traffic;
  - whether it is annual or perpetual for this family;
  - how Monotype treats intranet hosts.

  The product page did not show web tier prices. A Monotype "Company Desktop" licence is annual and
  tiered by employee count (same MyFonts page), but it does not cover web embedding.
- **Pairing.** Avenir Arabic is drawn to pair with Avenir, not with Chalet. Choosing Chalet plus
  Avenir Arabic would lose the matched Latin/Arabic stroke and x-height that ADR 0003 picked Plex
  for.

## 4. Fit for dense UI (12–13px grids)

| Property | Finding | Source |
|---|---|---|
| Tabular figures | **Chalet: yes.** "From fractions to tabular figures, Chalet sports a full range of figure styles." **Chalet Book: not stated.** Its package lists only small caps and fractions. | [housefonts.com/hi/chalet](https://housefonts.com/hi/chalet) (`fontFamily.features`) |
| Default figures | House notes that many of its fonts default to old-style figures, with lining figures behind `lnum`. If Chalet Book does this, the grids would need `font-feature-settings: "lnum","tnum"`. | [FAQ](https://houseindustries.com/faq/) |
| `1/l/I`, `0/O` distinction | **Not confirmed.** No glyph images were inspected. Chalet is a plain 1990s grotesque, so a straight `l` and a straight `I` are likely, but that is unverified. | — |
| Hinting / small-size rendering | **Not confirmed.** House publishes no hinting information. Third-party listings say Chalet Book is "optimised for readability at small sizes", but that is about book text, not 12px on screen. | (web-search summary of third-party listings, unverified) |
| Width | Not measured. | — |

**Verdict.** Chalet Book fits the design's 13–48px headings and labels. For the grids at 12px it
is **unproven**. Plex was chosen for exactly the properties that can't be confirmed here
([ADR 0003](../../docs/adr/0003-the-ops-console-sets-type-in-ibm-plex.md)):

- tabular figures by default;
- an unambiguous `1/l/I`;
- a matched Arabic face.

One way to settle it is a quote-free test. Set the Figma frame's sample strings
(`Il1 O0 1,234.50`) in ChaletBook at 12px, take a screenshot, and compare it with Plex. That needs
nothing beyond the design file.

## 5. Open-licence alternatives

There is no open clone of Chalet. The only "closest free alternative" rankings found come from a
third-party site with an undisclosed method, **fontalternatives.com**: Jost 80%, Josefin Sans 72%,
Raleway 70%, Work Sans 65%, all OFL on Google Fonts.
([fontalternatives.com/alternatives/chalet](https://fontalternatives.com/alternatives/chalet/);
treat the scores as indicative only.)

- **Jost.** OFL. Nine weights plus variable. "Both tabular and proportional numbers". Latin and
  Cyrillic, **no Arabic**. Geometric, Futura-like, with a round `O`/`0` that may be ambiguous.
  [github.com/indestructible-type/Jost](https://github.com/indestructible-type/Jost)
- **Work Sans.** OFL. Nine weights plus italics. Latin and Vietnamese, **no Arabic**. "Optimised
  for on-screen medium-sized text, roughly 14px to 48px", so it is not aimed at 12px.
  Autohinted. Tabular figures are not documented.
  [github.com/weiweihuanghuang/Work-Sans](https://github.com/weiweihuanghuang/Work-Sans)
- **Josefin Sans and Raleway** are display-leaning geometric faces. Raleway defaults to old-style
  figures (from memory, not checked). Neither was checked further, and neither looks credible for
  grids.
- **Arabic in every open option.** None of the alternatives has Arabic, so each would still pair
  with **IBM Plex Sans Arabic** (already shipped) or another open Arabic face.

**Recommendation for 589 (input only, the decision is 589's):**

- **Licensing is not the blocker.** Chalet Book can be licensed for self-hosted web use at a small
  one-time cost, subject to House confirming that our internal hosts count as one Domain.
- **The blockers are fitness and pairing:**
  - no Arabic;
  - an Avenir Arabic pairing that is annual, pageview-metered and drawn for another family;
  - unproven 12px legibility.
- **A defensible split** keeps Plex for UI and grids, and uses Chalet Book only in brand
  surfaces: the login, headings and the shell mark. If it is used that way, the licence question
  to House shrinks to "one internal app, N hostnames".

## Open questions to put to vendors

1. House Industries: is an internal back-office served from N internal hostnames, some of them by
   IP address, one webfont licence or N of them? What is the quote for Chalet Book Regular + Bold?
   Does Chalet Book include tabular and lining figures?
2. Monotype/MyFonts: what is the webfont price for Avenir Arabic Roman + Heavy (or the weights the
   design uses) at fewer than 10k pageviews a month? Is it annual or perpetual? Are intranet hosts
   allowed?
