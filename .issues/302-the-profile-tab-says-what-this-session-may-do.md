---
status: done
spec: 301
blocked-by: —
---

# 302 — theProfileTabSaysWhatThisSessionMayDo

## What to build

A **Profile** tab on the member screen that draws the whole shape of the **loyalty member** already
on screen, and renders **exactly what this session's authority allows** — nothing more, and no
apology for what it doesn't.

This is Slice 0. It writes nothing. Its job is to retire the wave's biggest retirable unknown: the
portal's **first three-tier authority on one screen**, where being wrong fails *open* on a PII
surface.

Three renderings of one tab:

- **May look** — a read-only field list. No controls, no disabled buttons, no "you cannot edit this"
  banner. The analyst can already see every one of these values on the header; the tab is a better
  arrangement of them and nothing else.
- **May edit** — the same fields become controls, and a Status control and an email-removal control
  appear. (Neither does anything yet — 303 and 306 make them work. Draw them inert or draw them
  behind the ticket that fills them in, your call, but the *visibility rule* is this ticket's and
  must be driven.)
- **May remove a mobile** — the mobile-removal control appears in a group set visibly apart from
  the rest.

The fields drawn, and which are forever read-only:

| Editable later | Read-only always |
|---|---|
| full name · email · birth date · gender · nationality · national id · city · preferred language · insurance company | loyalty id · member type · mobile (its own command) · points balance · pending points · tier · tier points · referral code · join date · last update · blocked reason |

🚩 **The three flags fail closed** — `=== true` and nothing looser, matching `canOpenLoyMember`
exactly. A denial, an absent flag, a malformed answer (`{}`, `"true"`), a pending probe and a thrown
probe are all *no*. The existing predicate's deliberate absence of a 404-tolerant catch is preserved
and extended: this is a PII surface, and an authorization fault is not permission.

🚩 **The three flags ride the ONE existing shared cache key.** The nav leaf, the in-page guard and
this tab read one answer from one call. A second key would let the nav and the screen disagree about
the same session.

**Profile leads the strip but does NOT become the landing tab.** `MEMBER_TABS` gains `profile` at
the front; `DEFAULT_MEMBER_TAB` stays `activities`. 227 #7 chose Activities deliberately — "what
happened to my points" is the question that brings an analyst here — and that is still true for the
many who only read. `resolveTab`'s unknown-value fallback is unchanged.

## Spine reach

model/api (probe answer widens, two new predicates) · store/logic (`tab-volume` gains a tab;
capability derivation) · component (`ProfileTab`, `MemberTabs` strip) · i18n (`loy` keys) · test
(pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `theEditAndRemovePredicatesAdmitOnlyLiteralTrue` — each new flag against a denial, an absent
      flag, a string `"true"`, an empty object, an errored probe and a pending probe; extends the
      existing `access.test.ts` · pure
- [x] `profileLeadsTheStripWithoutBecomingTheLandingTab` — `MEMBER_TABS` order, `DEFAULT_MEMBER_TAB`
      unchanged, `resolveTab` unknown-value fallback unchanged · pure
- [x] `theTabDrawsControlsOnlyForTheAuthorityHeld` — three sessions driven against stubbed probe
      answers: look-only sees no control at all, editor sees edit + status + email-removal, remover
      additionally sees mobile removal · flow (`tools/loy-member-admin-drive.mjs`, **new**)

## Boundaries

- **Endpoint dependency:** the existing access probe's answer gains two flags. No new route.
  🚩 The door is unbuilt — stub the widened answer in the drive, as every prior Loy ticket did.
- **i18n:** new keys in the existing `loy` namespace (the *area's* namespace, spec 231's deliberate
  deviation). **No new namespace.** Zero literals from the first commit.
- **Nav:** unchanged. The nav leaf still turns on *may look* alone.
- **New drive file** `tools/loy-member-admin-drive.mjs`, which 303–307 each grow.
- Does **not** bootstrap RTL — spec 301 declined it for this wave. Screen behaviour is proven by the
  drive.

## Done when

Driving the app with three different stubbed probe answers renders three different tabs — no
controls, edit controls, edit + mobile-removal controls — and the pure suite proves every
not-literally-true answer is a denial. `typecheck`, `lint` and the full vitest suite green.

## Blocked by

None — can start immediately.

## Open questions

- Whether the inert controls in the *may edit* rendering are drawn here as non-functional or
  deferred to the tickets that fill them in. Either is fine; the **visibility rule** is this
  ticket's either way and must be driven here.

---

## As built (2026-08-30)

`ProfileTab.tsx` (new) · `MemberTabs` gains the tab · `tab-volume` gains `profile` at the FRONT with
`DEFAULT_MEMBER_TAB` untouched · `api.ts` gains `canEditLoyMember`, `canRemoveLoyMemberMobile` and
`memberAuthority` · `LoyAccessResult` widens · 44 keys in the existing `loy` namespace · new
`tools/loy-member-admin-drive.mjs`.

**Proof:** vitest 2109/2109 (access +6 cases, tab-volume +4) · `loy-member-admin-drive` **28/28** ·
`loy-member-drive` **184/184** (its three-tab counts became four) · typecheck, lint and build green.
🚩 Every envelope stubbed — **no live SIS.Api**, and the admin half of the door is still unwritten
and unnumbered.

**Decisions taken here:**

- **The inert rendering, not the deferred one** (the Open question). Every control is drawn and every
  command is `disabled`, under one line saying they are not connected yet. An editor therefore sees
  the shape of the screen 303–307 fill in, rather than a screen that grows buttons unannounced.
- 🚩 **The authority is derived ONCE, on the page, and handed down.** The first cut read the probe
  again inside the tab on the shared key; correct, but it made "one call" depend on three sites
  agreeing about `staleTime`. `MemberLookupPage` already holds the answer, so it derives
  `memberAuthority` beside its own `allowed` and passes it to `MemberTabs`. Driven: the whole
  screen costs **one** `LoyWeb/Access` call.
- 🚩 **`memberAuthority` anchors both write tiers on *may look*.** A door answering `canEdit` to a
  session that cannot open the screen is malformed, not generous (ADR 0001) — and the page's own
  fail-closed guard means such a session never reaches the tab at all. Driven.
- **The two new flags are OPTIONAL on `LoyAccessResult`.** The door answers neither today; required
  fields would let a future direct read type as `boolean` and arrive `undefined`. Optional makes the
  `=== true` predicates the only legal way to consume them.
- **The read-only rendering reads the MEMBER; only the editing one reads a draft.** Both from one
  `editable()` definition, so the two renderings cannot drift. The draft is seeded once and never
  re-synced — right for an analyst mid-edit, and a constraint on 304's stale-write guard, noted on
  that ticket.
- 🚩 **The birth date is two things said two ways**: `yyyy-MM-dd` in the control (the value that will
  be sent), the display date in the read-only twin. The `0001-01-01` sentinel carries as blank
  through `isBlankDate`, never as a fact about the customer.

**⚠ Deviation from this ticket's own table:** the read-only column names a **referral code**.
`LoyMemberModel` carries none — it is absent from the wire, from `src/core/models/loy.ts` and from
anywhere in the estate's projection — so nothing draws one. The table is wrong, not the code; 304's
notes carry the same warning so no later slice tries to make one editable. Also narrower than spec
301 story 3's "every field": `mobileCountry`, `pointsBalanceAmount` and `pointsExpireSoon` are drawn
on the header and not repeated here, which is this ticket's table as written.
