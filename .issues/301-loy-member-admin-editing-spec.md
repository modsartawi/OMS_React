---
type: spec
status: ready
---

# 301 — A loyalty member is edited, blocked, and made unreachable

**This is the FRONTEND spec** — a **Profile** tab on the existing member lookup
(`features/loy/member`) that turns a read-only PII surface into an editing one, in this repo
(`oms-react`, `C:\Playground\oms-react`).

**Its backend half does not exist yet and is the larger of the two.** Six write routes on the
`LoyWeb` door, a command-parameterised route filter (the estate's first), two new handlers, two new
grants, two new roles, a seeded blocked-reason row and four new code-table rows all live in the
sibling BackOffice repo at `C:\Work\DMSCO\BackOffice`. That work is **unwritten and unnumbered** at
the time of this spec — see [The backend half](#the-backend-half). Everything under
[The wire, as designed](#the-wire-as-designed) is this client's **design intent**, not a
transcription of a shipped contract, and the BackOffice spec that eventually owns those shapes is
normative over it.

Extends **spec 231** (the read-only lookup, tickets 232–239) and continues **wayfinder map 222**.
Vocabulary is `CONTEXT.md`'s: **loyalty member**, **member command**, **member update snapshot**,
**contact removal**, **case reference**, **system reason**. Two ADRs bind this spec:
[`docs/adr/0001`](../docs/adr/0001-loyalty-member-writes-are-gated-per-command.md) (authority) and
[`docs/adr/0002`](../docs/adr/0002-contact-removal-records-no-removed-value.md) (what a removal
records).

---

## Problem Statement

A loyalty analyst can look a member up and can change nothing about them.

Spec 231 shipped a lookup that resolves a **loyalty member** by mobile or loyalty id and draws four
things: who they are, their activities, their sales lines, and the trail of **member commands** run
against them. Every one of those is a read. When the analyst finds a misspelt name, a bounced email
address, or a member who needs blocking, the only path is the WPF till — a different application, a
different audience, and a different authority family — or a request to someone with database access.

Three specific requests have no path at all from the portal:

1. **A customer's details are wrong.** Name, email, birth date, city, nationality, national id,
   insurance company, preferred language. The analyst can see every one of them being wrong and can
   correct none.
2. **A customer's mobile number changed.** The number is the member's login credential and one of
   only two ways to find them, so this is the highest-consequence routine edit in the programme.
3. **A customer telephones and asks to be removed.** They want to stop being contacted, and they
   want to stop being findable. Today this is a database task with no record of who asked, who did
   it, or why.

The third is the one that prompted this work, and it is also the one the portal is least equipped
for — because the read-only screen's own **Actions** tab renders free-form command data verbatim to
anyone holding the read grant, so a naively-recorded removal would publish the contact details it
was asked to take away.

Underneath all three sits an authority problem. Every screen gate in the portal — fourteen of them —
authorises **opening a screen**. Not one authorises a write, because until now no web screen had
one. Admitting an analyst to this screen currently grants them everything the screen can do, and
what the screen can do is about to include destroying a customer's login.

## Solution

A **Profile** tab, first among the member screen's tabs, that draws the whole shape of a loyalty
member and — for a session that holds the right authority — lets it be changed through six named
**member commands**.

**Three tiers of authority on one screen.** The existing screen grant keeps its meaning: *may look*.
A second grant means *may edit*. A third means *may remove a mobile* — the one command with no
self-service undo. A session holding only the first sees the Profile tab as a read-only field list
with no controls at all, which is honest: it can already see every one of those values on the
header. (ADR 0001.)

**Six commands, never one Save.** Update profile · change mobile · block · unblock · remove email ·
remove mobile. Each is invoked on its own, refuses on its own, and writes its own **member update
snapshot** under its own name. There is deliberately no button that writes several at once, because
a snapshot has room for exactly one command name and a composite write would have to lie about
which change it was.

**Contact removal is per-field and is not deletion.** Removing an **email** ends a contact channel
and nothing else — the member keeps their account, their login and their points. Removing a
**mobile** ends the member's ability to sign in, makes them unfindable by the only key an agent
normally has, and blocks the account under a **system reason** an agent cannot pick by hand. Both
require a **case reference** naming the customer's request; the mobile removal additionally requires
the analyst to retype the loyalty id, because the realistic failure is not a mis-click but the wrong
member.

**A removal records that it happened and why, never what it took away.** The removed mobile and
email are written nowhere new. They survive only in the *preceding* member update snapshot, a trail
exposed on no screen — so recovery is a support task, and the Actions tab never renders the contact
details the removal existed to remove. (ADR 0002.)

---

## User Stories

### Seeing the shape of a member

1. As a loyalty analyst, I want a Profile tab beside Activities, Sales and Actions, so that the
   member's editable details sit on the screen I already resolved them on rather than a second one.
2. As a loyalty analyst, I want the Profile tab to be the first tab, so that the member's own
   details lead and their history follows.
3. As a loyalty analyst, I want every field of the member drawn — including ones I may not change —
   so that "the whole shape of the member" is one reading and not a hunt across tabs.
4. As a loyalty analyst, I want fields I may never change (loyalty id, member type, points balance,
   tier, referral code, creation stamps) drawn as plainly read-only, so that I never fill in a
   control that was never going to save.
5. As a look-only analyst, I want the Profile tab to render as a field list with no controls
   whatsoever, so that I am never offered an action that will be refused.
6. As a look-only analyst, I want no explanation of *why* I cannot edit cluttering the tab, so that
   the screen I can use is not half-covered by a screen I cannot.
7. As a loyalty analyst, I want an archived or non-loyalty member to be editable like any other,
   so that the read that deliberately stopped refusing archived members is not undone by a form
   that refuses them.
8. As a loyalty analyst, I want the header chip that says which kind of member this is to stay
   visible while I edit, so that I always know I am editing an archived member if I am.
9. As a loyalty analyst, I want a blocked member's block reason shown on the Profile tab in words,
   so that I can see why they are blocked without decoding a two-letter code.

### Correcting a member's profile

10. As a loyalty analyst, I want to correct a member's full name, so that a misspelling recorded at
    sign-up does not follow them forever.
11. As a loyalty analyst, I want to correct a member's email address, so that a bounced address stops
    bouncing.
12. As a loyalty analyst, I want to set a member's birth date, gender, nationality, national id,
    city, preferred language and insurance company, so that a sparse sign-up record can be completed.
13. As a loyalty analyst, I want to **leave** gender and preferred language blank on a member who has
    never had one, so that correcting a name does not force me to invent a fact about the customer.
14. As a loyalty analyst, I want the Save control disabled until I have actually changed something,
    so that I cannot write a snapshot that records no change.
15. As a loyalty analyst, I want to see which fields I have changed before I save, so that a stray
    keystroke in a field I did not mean to touch is visible rather than silent.
16. As a loyalty analyst, I want to discard my edits and return to the member as stored, so that
    abandoning a correction does not mean reloading the screen.
17. As a loyalty analyst, I want a validation failure named against the field that caused it, so
    that I fix the field rather than guess at the form.
18. As a loyalty analyst, I want a refused save to leave every one of my edits on the form, so that a
    server refusal costs me a retry and never my typing.
19. As a loyalty analyst, I want changing an email to clear that address's *verified* mark, so that
    the record never claims we proved an address the customer never confirmed.
20. As a loyalty analyst, I want to be told if the member changed underneath me since I opened the
    form, so that I do not silently overwrite a colleague's correction with my stale copy.
21. As a loyalty analyst, I want a stale-form warning to show me that the member has moved on and let
    me reload, so that recovering from the clash is one action and not a lost afternoon.

### Changing a mobile number

22. As a loyalty analyst, I want changing the mobile number to be its own control, separate from the
    profile Save, so that the programme's login credential is never changed as a side effect of
    fixing a name.
23. As a loyalty analyst, I want to confirm a mobile change before it is written, so that the
    highest-consequence routine edit is deliberate.
24. As a loyalty analyst, I want a mobile number already held by another member to refuse my change
    with that as the stated reason, so that I understand it is a collision and not a format problem.
25. As a loyalty analyst, I want a refusal on collision to change nothing at all, so that a failed
    mobile change never leaves the member half-edited.
26. As a loyalty analyst, I want entering the number the member already has to be refused as such, so
    that I do not write a snapshot recording a change that did not happen.
27. As a loyalty analyst, I want an invalid number refused before anything is written, so that a
    typo cannot become a member's credential.
28. As a loyalty analyst, I want the mobile change to appear on the Actions tab immediately, so that
    I can see the command I just ran without reloading the screen.

### Blocking and unblocking

29. As a loyalty analyst, I want to block a member with a reason chosen from the server's list, so
    that a block always says why.
30. As a loyalty analyst, I want the reason list to offer only the reasons a person may choose, so
    that I cannot mark a member with a **system reason** that is not true of them.
31. As a loyalty analyst, I want to unblock a member, so that a block applied in error or since
    resolved can be lifted.
32. As a loyalty analyst, I want blocking and unblocking to be one control that offers whichever is
    applicable, so that I never have to work out which of two buttons applies to the member in front
    of me.
33. As a loyalty analyst, I want a block to show up on the header immediately, so that the member's
    state on screen and in the database are never different.

### Removing contact details

34. As a loyalty analyst, I want to remove a member's **email** on their request, so that a customer
    asking not to be emailed stops being emailed.
35. As a loyalty analyst, I want removing an email to leave the member's login, points and history
    untouched, so that the commonest of the two removal requests costs the customer nothing.
36. As a loyalty analyst, I want to remove a member's **mobile** on their request, so that a customer
    asking to be unreachable can no longer be found or contacted.
37. As a loyalty analyst, I want removing a mobile to also block the member, so that "this person
    asked to be removed" is a recorded state rather than a side effect of an empty column.
38. As a loyalty analyst, I want to record the customer's **case reference** on any removal, so that
    the trail says a person asked rather than that someone acted.
39. As a loyalty analyst, I want the removal blocked until I have entered a case reference, so that
    an unaccountable removal is not possible rather than merely discouraged.
40. As a loyalty analyst, I want to retype the loyalty id to confirm a **mobile** removal, so that
    having two members open in two tabs cannot cost the wrong customer their login.
41. As a loyalty analyst, I want the confirmation to state plainly that the member will not be able
    to sign in and will not be findable by mobile, so that I know what I am about to do.
42. As a loyalty analyst, I want the confirmation to state plainly that this is **not** account
    deletion — the name, national id, points and purchase history remain — so that I do not promise
    a customer something we have not done.
43. As a loyalty analyst, I want the removal controls kept away from the profile Save, so that the
    destructive command is never the button next to the one I press twenty times a day.
44. As a look-or-edit-only analyst, I want the mobile removal control hidden entirely, so that I am
    not shown a door I do not hold the key to.
45. As an editing analyst without removal authority, I want the **email** removal still available to
    me, so that the commonest request is not gated behind the rarest authority.
46. As a loyalty analyst, I want the member whose mobile I just removed dropped from my recent
    searches, so that the number I was asked to remove does not sit in my session as a chip that no
    longer resolves.
47. As a loyalty analyst, I want the removal to appear on the Actions tab, so that the command I ran
    is visible on the trail like any other.
48. As a loyalty analyst, I want the removal's Actions row to show my case reference and **not** the
    removed number, so that the trail is accountable without republishing what was removed.

### Authority

49. As a loyalty administrator, I want editing to require a grant separate from looking, so that
    admitting an analyst to a PII lookup does not also admit them to changing it.
50. As a loyalty administrator, I want removing a mobile to require a grant separate from editing, so
    that the command with no self-service undo is held by fewer people than the routine ones.
51. As a loyalty administrator, I want the three authorities to be tiers of one screen rather than
    separate screens, so that an editor cannot end up holding the write grant without the one that
    opens the screen.
52. As a security reviewer, I want the server to enforce every command's grant independently of what
    the browser drew, so that hiding a control is a courtesy and never the protection.
53. As a security reviewer, I want a session whose grants cannot be determined to be treated as
    holding none, so that an authorization fault never opens a PII surface.
54. As a loyalty analyst, I want my authority resolved in the same single call that already decides
    whether the screen opens, so that a gated screen still costs one network round trip.
55. As a loyalty analyst whose authority was revoked while I had the screen open, I want the server's
    refusal explained rather than shown as a crash, so that I understand I no longer hold the grant.

### The trail

56. As a loyalty auditor, I want every command to write a **member update snapshot** under its own
    name, so that "what happened to this member" is answerable from one table.
57. As a loyalty auditor, I want each snapshot stamped with who ran the command and when, so that
    every change has a person against it.
58. As a loyalty auditor, I want the acting store recorded from the signed-in session rather than
    from the browser's request, so that the stamp cannot be forged by the client.
59. As a loyalty auditor, I want a removal distinguishable from an ordinary edit that happened to
    blank the same field, so that I can tell a customer's request from an agent's typo.
60. As a loyalty auditor, I want to be told in the spec that removal counts **undercount** — because
    an email can also be blanked through an ordinary profile edit — so that I do not read a report
    as a total.
61. As a loyalty analyst, I want double-clicking a command not to run it twice, so that one action
    leaves one row on the trail.

---

## Implementation Decisions

### The shape on screen

- **A tab, not a screen.** `features/loy/member` grows a **Profile** tab beside Activities, Sales
  and Actions. No new feature folder, no new route, no new menu entry, no new i18n namespace — the
  member is already resolved, the header already says who they are, and the route already exists.
  Keys go under the existing `loy` namespace (which is the **area's** namespace, not the feature's —
  spec 231's deliberate deviation).
- **Profile leads.** It becomes the first tab. The tab-volume convention the other three follow
  (each tab fetches when opened) does not apply: the Profile tab draws the member already in the
  cache and issues no read of its own.
- **One tab, two renderings.** For a look-only session it renders a read-only field list. For an
  editing session the same fields become controls. This is one component with a capability flag, not
  two components — a divergence here is how a read-only view starts showing a field the editable one
  dropped.
- **The commands are grouped by consequence, not by field.** A *Profile* section with its own Save
  and Discard; a *Mobile* control that changes on its own; a *Status* control that offers block or
  unblock depending on the member's current state; and a *Contact removal* group set visibly apart
  from the rest.

### Authority

- **Three tiers on one controller** — *may look* (the existing screen grant), *may edit*, *may
  remove a mobile*. Rationale, rejected alternatives and consequences are ADR 0001; it is normative
  over this section.
- **The probe grows in place.** The existing access probe answers three flags instead of one. It
  stays on the **one shared cache key** that the nav leaf and the screen's in-page guard already
  share, so a gated area still costs one call. Nav gating is unchanged — the nav leaf still turns on
  *may look* alone.
- **Every flag fails closed** — `=== true` and nothing looser, matching the existing predicate. A
  malformed answer, a missing flag, an unseeded grant and a thrown probe are all denials. The
  existing probe's deliberate absence of a 404-tolerant catch is preserved and extended.
- **Removing an email is under *may edit*, not *may remove*.** An editor can clear the Email field
  through the profile command anyway, so gating it higher would be an authority that looks enforced
  and is not. ADR 0001 records this; the spec states it out loud rather than leaving it to be
  discovered.
- **Hiding a control is never the protection.** Every command's grant is enforced server-side per
  route. The client's flags decide what is *drawn*.

### The member commands

Six commands. Four delegate to handlers that already exist behind the internal `Loy/*` tag; two are
new server-side.

| Command | Grant tier | Server | Snapshot name | Trail row |
|---|---|---|---|---|
| Update profile | edit | **new** admin-side handler | update-member | member-update |
| Change mobile | edit | existing no-OTP change | change-mobile | change-mobile |
| Block | edit | existing | block | member-blocked |
| Unblock | edit | existing | unblock | member-unblocked |
| Remove email | edit | **new** | contact-removal | member-update / email-removed |
| Remove mobile | **remove** | **new** | contact-removal | change-mobile / mobile-removed **+** member-blocked |

- **The profile command gets a new server-side sibling rather than reusing the existing one.** The
  existing handler's validator makes gender and preferred language **mandatory** (its e-commerce
  sibling explicitly permits blank; this one deliberately does not) and constructs itself inside the
  handler, so it cannot be swapped from outside. Since the members this form edits are frequently
  sparse, delegating verbatim would force an analyst to invent a gender to fix a name. Editing the
  shared handler instead would change behaviour for the WPF till, POS and e-commerce callers — the
  exact drift the `LoyWeb` door was built to avoid. So: **depart by adding beside, never by
  editing the shared path**, which is the pattern this door already follows for two of its five
  reads.
- **The new profile handler also clears the email-verified mark** when, and only when, the email
  actually changes. The existing handler changes the address and leaves the mark set, which makes
  the record assert we verified an address the customer never confirmed.
- **The profile command keeps the existing snapshot name.** A web edit and a till edit are the same
  *act*; only the door differs, and they are told apart by the recorded user and store. Minting a
  new name would break every existing report grouping on the old one.
- **Contact removal is per-field.** Email-only and mobile(-and-optionally-email) are distinct
  commands with distinct consequences. Removing an email does **not** block; removing a mobile
  does.
- **Removing a mobile clears the country code with it**, and clears both verified marks, so no field
  is left asserting something about a value that is gone.
- **A mobile removal on an already-blocked member overwrites the existing reason** with the
  removal's **system reason**. The existing blank-the-mobile path in the module preserves instead;
  this is a deliberate departure, because inactivity and collision markers can be re-derived and
  "this person asked to be removed" cannot.

### Contact removal — what is recorded

- ADR 0002 is normative. In summary: the removal records the loyalty id, the acting user, the time
  and the **case reference**; it records the removed mobile and email **nowhere new**.
- **The case reference goes in the trail row's first free-form slot** — the one the Actions tab
  draws. It is meant to be read. (The trail's third slot is *not* drawn by the Actions tab; nothing
  is hidden there, because hiding data in an undrawn column is exactly the kind of promise ADR 0002
  rejects.)
- **The case reference is validated as non-empty after trimming and length-capped; it is given no
  format rule.** A pattern that is wrong for a phone call with no ticket buys nothing except agents
  typing a hyphen. It is labelled *case reference*, never *notes* — a field that invites prose
  invites PII.
- 🚩 **An agent can still type a phone number into the case reference**, and it will render on the
  Actions tab. Nothing in the code can prevent this. It is a training matter, and the label is the
  only lever the screen has.
- **Recovery is out of the screen's hands.** The previous values survive in the preceding member
  update snapshot, which no portal read exposes. Reversal is a support task — and is not a simple
  restore anyway, since reattaching a mobile must re-run the collision check.

### Confirmation

- **Both removals require a case reference.** The Remove control stays disabled until one is
  entered.
- **A mobile removal additionally requires the loyalty id retyped**, matched exactly. The failure
  being designed against is not a mis-click but the *wrong member* — two members open in two tabs.
  A confirmation dialog does not prevent that; people click through dialogs. A retyped id does,
  because the wrong id is on screen and will not match.
- **An email removal gets a confirmation but no retyped id.** It is an edit an analyst can simply
  redo; the friction would buy nothing.
- **The mobile removal's confirmation says three things**: the member will not be able to sign in;
  the member will not be findable by mobile; this is **not** account deletion and the name, national
  id, points and purchase history remain. The third is there so an analyst does not promise a
  customer more than has happened.

### Writing safely

- **The profile command echoes the member's last-update stamp** — already carried on the member
  payload — and the server refuses if it no longer matches. The profile command writes nine fields
  at once, so two analysts with the screen open would otherwise silently clobber each other. The
  narrow commands (mobile, block, unblock, removals) need no token: they write one dimension and the
  server reads the member fresh.
- **The acting store is derived server-side from the session** and is never sent by the browser. It
  is an audit stamp; a client that can choose it can forge it.
- 🚩 **There is no server-side idempotency.** The correlation id every command carries is
  pass-through only — no dedup check exists anywhere in the module, and the trail service freely
  mints its own. A double submit therefore writes two snapshots and two trail rows. The **client**
  must disable a command's control while it is in flight; nothing server-side will save you.
- **Every command invalidates the member's cache entry and every page of the Actions cache.** The
  Actions tab is where a command becomes visible; a write that does not refresh it looks like it did
  not happen. (Server-side, only the by-mobile read is cached; the by-id re-read is not.)

### Failure

- **Refusals are business outcomes, not crashes.** Every command can be refused with the envelope's
  own machine code, and each is surfaced with the server's message plus the screen's own wording for
  the codes it recognises — never flattened into a bare string, per the api-envelope rule.
  The codes this screen must recognise by name are: **member does not exist**, **mobile already
  used**, **same mobile as now**, **invalid mobile**, **invalid blocked reason**, **invalid
  nationality**, **invalid city**, and the new **member changed since you loaded it**.
- 🚩 **A refusal keeps the analyst on the form with their edits intact.** This is the same rule
  ticket 220 established for a refused submit elsewhere in the portal.
- **A grant refusal is not an outage.** A command refused for authority says so, and does not offer
  a retry.
- **401 remains untouched** — the api module already clears the session, toasts once and redirects.
  No command catches it.

### The wire, as designed

Six writes and one read are added to the existing `LoyWeb` door. **These shapes are this client's
design intent and are not yet a shipped contract** — the BackOffice spec that owns them is normative
over what follows, and any drift is reconciled in that spec's favour.

- Six command routes, each gated on its tier's grant, taking the loyalty id plus that command's own
  fields, and answering the standard envelope.
- One read returning the blocked reasons an agent may choose — filtered to exclude **system
  reasons**. 🚩 This is the **first reader** of a flag that exists in the table today and is read by
  nothing. The internal reasons read stays untouched, so the till's behaviour does not change.
- The existing access probe's answer gains two flags.

### The backend half

Not written and not numbered at the time of this spec. It comprises: two new grants and two new
roles seeded beside the existing screen grant; a route filter that takes its required command as a
parameter (the estate's first — every existing web gate hard-codes *open*); the new admin-side
profile handler; two new removal handlers; a seeded blocked-reason row carrying the **system
reason** flag; and lookup rows for the two new trail sub-types, without which the Actions tab
renders bare codes instead of English.

🚩 **Deployment ordering is a real hazard.** The grants must be seeded and bound to named people —
query-verified — **before** the API that reads them ships, or the new commands lock out the desk
they exist to admit. This is the same ordering warning the existing screen grant carries.

---

## Testing Decisions

**What makes a good test here.** It states an outcome an analyst or an auditor would recognise, and
it fails when that outcome stops being true. It does not assert that a particular function was
called, that a prop was passed, or that a component rendered a particular element tree. The
highest-value tests in this feature are the ones that make a *dangerous thing unrepresentable* —
the direct descendants of `actions-request.ts`, whose whole job is that the estate-wide read cannot
be issued from the client even by mistake.

**Two tiers, both already existing. No new seam infrastructure.**

### Pure, in-memory (`src/**/*.test.ts`, vitest, node environment)

The primary seam, and where this feature's silent regressions live.

- **The profile form module** — *new*. Given a loyalty member and the analyst's edits, it produces
  the dirty set, the validation verdict and the request body. This is where the blank-tolerance
  ruling lives, and it is the single most valuable test in the feature: a regression to the till's
  mandatory-gender rule would be invisible in the type system, invisible at build, and would only
  surface as an analyst unable to fix a name. Also carries the last-update echo and the
  stale-detection comparison, rather than giving those their own module.
- **The removal module** — *new*. Which fields a **contact removal** names; whether the invocation
  is the mobile path or the email path; and the confirmation preconditions (case reference non-empty
  after trim; retyped loyalty id matching exactly, mobile only). Prior art is `actions-request.ts`:
  a pure guard placed so the dangerous call cannot be constructed.
- **The access predicates** — extend the existing `access.test.ts`. The two new flags, `=== true`
  and nothing looser, each asserted against a denial, a malformed answer, an absent flag and an
  errored probe. Small, and the one place where being wrong fails *open*.
- **The blocked-reason projection** — that a **system reason** cannot reach the selectable list, and
  that an empty list is rendered as an empty list rather than as a failure.

The existing suite in this feature (10 files, ~1,100 lines) is the shape to match.

### Flow (Playwright, manual-run)

- **One new drive**, `tools/loy-member-admin-drive.mjs`, on the stubbed-envelope pattern of the
  existing 1,660-line `loy-member-drive.mjs`. It must cover: the tab rendering read-only for a
  look-only session; controls appearing for an editor; the mobile-removal control appearing only for
  a remover; a successful profile save refreshing the header and the Actions tab; a
  mobile-already-used refusal keeping the analyst on the form with edits intact; and the removal
  dialog staying disabled until the case reference and the retyped id are both right.
- Run as the other drives are: `npx vite --port 5199` in one shell, `node tools/<x>.mjs` in another.
  Not a CI gate.

### The seam this feature does **not** add

🚩 **React Testing Library is not bootstrapped by this wave.** The instinct says a destructive form
deserves component tests, and the honest counter-argument is recorded here: *"the Remove button was
enabled when it should not have been"* is a real failure that only a component test catches at its
own seam. It is declined anyway, for two reasons. First, the confirmation *logic* is pure and tested
at the seam above, so a component test would verify only that a disabled prop is bound to a
predicate already proven — the thin-renderer wiring spec 083 explicitly declined to test. Second,
bootstrapping it is not small: the runner is node-only and `.test.ts`-only, so RTL needs jsdom, a
setup file and a `.test.tsx` include — a projects config in practice. Landing that inside a wave that
also ships a new authority model and six write commands is how both land badly. It remains the
hardening ticket's to add.

### What cannot be verified at all

🚩 **No live SIS.Api.** Every Loy wave to date was built against stubbed envelopes, and this one
**writes** — to a customer's login credential. The code-complete-but-runtime-blocked posture that
was acceptable for the read tabs is materially riskier here, and a ticket's *done* cannot mean
*driven*. Every ticket in this wave must state that its envelopes are stubbed, and the wave must not
be reported as verified against a server.

---

## Out of Scope

- **Actual deletion or anonymisation of a member.** Contact removal clears two fields. The name,
  national id, birth date, nationality, city, points balance, tier, membership and entire purchase
  history remain and are readable by anyone holding the read grant. If a genuine
  regulatory-grade erasure obligation exists, it is a separate and much larger effort — and this
  screen's copy must never imply it has been met.
- **Creating a member.** Sign-up stays where it is.
- **Undoing a contact removal from the portal.** Deliberate, per ADR 0002.
- **Merging duplicate members**, transferring points, adjusting balances, changing tiers by hand,
  compensations, and every other points-engine command. None is a profile edit.
- **Editing member type**, referral code, old loyalty id, creation stamps, or any points/tier value.
- **OTP-confirmed mobile change.** The admin path deliberately uses the no-OTP handler; the
  customer-driven OTP flow is not a back-office command. 🚩 Note the consequence: the admin path
  marks the new number **verified** with no OTP at all — an analyst asserts verification on the
  customer's behalf. Left as-is, and flagged for an owner ruling rather than changed here.
- **Rewriting the Actions tab.** It renders the new commands' rows through machinery it already has;
  it gains no columns and no filters.
- **A bulk or batch editing surface.** One member at a time.
- **Reconciling the WPF till's editing screen** with this one. The two doors over one module is the
  established no-drift pattern, not a defect to fix.
- **Fixing the duplicate `Verdict` entry in `CONTEXT.md`.** Found while adding this wave's
  vocabulary — the glossary defines the word twice, for two unrelated concepts. Wants a ruling; not
  this spec's.

---

## Further Notes

**Why this wave is unusual for the repo.** It is the first web screen in the portal that writes
anything under an authority narrower than *may open the screen*, and the first that can take
something away from a customer. Both firsts are load-bearing: the route filter pattern this
establishes is what every future write screen will copy, and the removal's recording rule is what a
future auditor will read the trail through.

**The vocabulary was sharpened mid-design and the old words are wrong.** This work was grilled under
the word *erasure*, which was rejected: nothing is erased. `CONTEXT.md`'s canonical term is
**contact removal**, and *erasure*, *account deletion* and *anonymisation* are listed against it
precisely because each claims more than the command does. Likewise these writes are **member
commands**, not *acts* — the glossary already spends two entries on *command* for the Document
Details equivalent, and splitting the language would have bought nothing. Tickets and code should
use the glossary's words.

**The biggest open risk is not in this repo.** The backend half is larger than the frontend half,
is unwritten, and includes a database seed whose deployment ordering can lock the desk out of the
screen. A frontend wave that lands first is code-complete against a door that does not exist — which
is the posture every prior Loy ticket shipped under, but those were reads.

**Two smaller things needing an owner's ruling**, neither blocking:

1. The admin mobile change marks the new number **verified with no OTP**. Existing behaviour,
   deliberately not changed here, but it is a claim the record makes on thin evidence.
2. The exact behaviour of the shared email validator on an **empty string** — null passes; empty
   probably does not. The new profile handler's validator must handle the blank case explicitly, and
   the behaviour wants confirming on the wire rather than reasoning about.
