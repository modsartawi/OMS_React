# HITL-389 — unattended decisions, ticket 389 (the bell opens a dense dropdown)

## Q: Does the title truncate to one line, as the 377 prototype's row did?
**Decision taken:** No. The title wraps (`break-words`), and only the body is clamped to two lines.
**Why:** Spec story 30 says "so that titles are not truncated", and 377 §3 names the truncated title as the defect. In every approved capture the titles fit on one line anyway, so the look is the same.
**Revisit if:** the owner wants a long title held to one line with an ellipsis. That would be one class, `truncate`.

## Q: What does the "N new" chip count?
**Decision taken:** The badge's own rule (Active ∧ not expired ∧ not read), through a new pure `unreadItems` in `layout/notifications/helpers.ts`. Mark all as read targets exactly that set, and `unreadCount` is now its length. The chip, the badge and the action can never disagree.
**Why:** The prototype re-derived the set inline (`status === 'Active' && !isRead`). One helper is the test seam the ticket names.
**Revisit if:** the chip should count something other than the badge, such as only the arrivals since the panel was last opened.

## Q: How is the chip's count isolated, and what is the plural key?
**Decision taken:** `notifications:panel.newCount_one` / `_other` = `"<n>{{count}}</n> new"`, rendered with `<Trans count>` and the `n` slot as `Ltr`. The badge's count is also wrapped in `Ltr`.
**Why:** The chip is JSX, so the rule's `<Trans>` slot applies, not `fsi()`. A count is a machine value.
**Revisit if:** an Arabic locale wants the count elsewhere in the sentence. The slot moves with the template.

## Q: Should server title and body text be isolated?
**Decision taken:** Yes. Each one is a `<bdi>` (dir auto) inside its styled cell. The drive proves that an English body keeps its full stop at its end under RTL, with a control that must see the stop flip. The 377 prototype's RTL capture shows the flip (".identities created, 0 refused 74").
**Why:** `.claude/rules/bidi.md` treats free text in either script as `<bdi>`.
**Revisit if:** never, short of a rule change.

## Q: The relative time ("21m ago") interpolated its count into a `t()` sentence without an isolate
**Decision taken:** Isolate it. The three `relative.*` templates became `"<n>{{count}}</n>m ago"` (and the same for `h` and `d`), rendered through `<Trans count>` with an `Ltr` slot, like the chip. `tabular-nums` is restored. The bell panel is the only consumer of these keys.
**Why:** `.claude/rules/bidi.md`: "a value interpolated into a `t()` sentence" needs `fsi()` or a `<Trans>` slot. `fsi()` would break i18next's plural `count`. The standards review raised it, because this slice rewrote the span.
**Revisit if:** a string-only sink (such as a toast) ever wants these keys. It would need its own keys without the tag.

## Q: Where does the unread dot sit when a title wraps?
**Decision taken:** On the title's first line. The dot sits in a cell one title line tall (`h-[1lh]` at 12.5px, `self-start`), and the drive feeds a title that wraps and measures this.
**Why:** The spec review noted that `self-center` would drop the dot halfway down a wrapped title, because titles now wrap instead of truncating.
**Revisit if:** titles go back to `truncate`.

## Comments
- "Maximum update depth exceeded": not seen. Every bell mode asserts no page errors.
- Under RTL, an English body that is clamped puts its ellipsis at the start of the second line. Line-clamp follows the block's direction, and the text inside is an LTR isolate. The prototype shows the same. Real Arabic bodies clamp at their own end, so this is left alone.
- The full `tools/foundation-drive.mjs` passed 752/752 on port 5280. After the review fixes, the bell part passed 106/106 and the overlays part 118/118.
- The review left one item open: `box`/`resolve` are now re-declared in five drive parts. This extends the drive's existing per-part pattern, so they were not hoisted.
