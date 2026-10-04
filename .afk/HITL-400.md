# HITL log — ticket 400 (an operator saves, defaults and manages their own views)

## Q: Does a view capture (and drift against) the criteria on screen, or the last search that ran?
**Decision taken:** The criteria on screen (the bar's draft). Save and Update store the draft; the modified dot compares the draft. Applying a view sets the draft and runs it, so the two agree straight after applying.
**Why:** Comparing against the last-run query made the dot flash while a view's own search was in flight, and stick on if that search failed. The bar's own amber flags already say "not searched".
**Revisit if:** The owner wants a view to hold only what was searched (the prototype's `applied ?? draft`). Then `snapshot()` and the `modified` selector read `query ?? draft` instead.

## Q: The modified dot is amber. 368 §3 reserves amber for attention (due tag, rewind marker, unapplied edits, cut-off line).
**Decision taken:** Amber (`--attention`), as the approved capture `A-modified.png` draws it. A drifted view is an unsaved edit, the same family as unapplied edits. The pair is in the contrast gate (3:1 on `--card-2` and `--primary-050`).
**Why:** The capture governs layout and it is the only drawn answer. The ruling's list names edits.
**Revisit if:** The owner reads §3's list as closed. Then the dot takes `--primary` (one class in `ModifiedDot`).

## Q: The default's star — amber like the prototype, or something else?
**Decision taken:** A filled star in `--primary` (navy), gated at 3:1 on both rail grounds.
**Why:** 368 §3 reserves amber for attention, and a default is not attention. Gold fails 3:1 on light cards (362's negative assertion).
**Revisit if:** The owner wants the capture's amber star.

## Q: Update is "enabled only once the view has drifted", but a layout-only view can never drift on criteria or lens — so it could never be re-saved as a full view.
**Decision taken:** On the ACTIVE layout-only view, Update is live at once, and re-saving it captures the criteria, lens, columns and filters (the `layout` tag goes). Full views keep the drift rule.
**Why:** The ticket says "Re-saving one makes it a full view"; the spec review found the gate blocked that.
**Revisit if:** The owner wants imported views upgraded only through Save as new.

## Q: An imported layout-only view says "lens All". Does applying one set the lens to All?
**Decision taken:** No. It sets the layout only and leaves both the criteria and the lens alone.
**Why:** 366: "Applying one sets the layout, leaves the current criteria alone, and runs no search." The lens narrows the current result, which a layout leaves alone too. "lens All" is the stored value, and drift ignores it.
**Revisit if:** The owner wants applying an imported layout to reset the lens.

## Q: The old app allowed duplicate names; names must now be unique per user.
**Decision taken:** On import, a clashing name takes the next free " (2)", " (3)"… (cut to stay within 60 characters). Undo of a delete whose name was taken meanwhile does the same.
**Why:** Dropping a duplicate would lose an operator's layout. The suffix keeps every layout and the user can rename it.
**Revisit if:** The owner prefers skipping duplicates.

## Q: What counts as "no in-memory search" for the default on open?
**Decision taken:** No search has come back or failed, no view is active, and the bar holds no edits (`opensOnDefault`). Then the default runs, once per page mount, after the grant and this user's views have loaded.
**Why:** It must never overwrite the search the operator returns to from Details, nor criteria they typed and left.
**Revisit if:** The operator lead's S3 acceptance (R2) asks for something narrower.

## Q: Where do the old ViewManager controls go (the select, Save view, Update, Delete in the grid bar)?
**Decision taken:** Removed. The views rail's My views replaces them, and the name dialog moves onto core `Modal` (`ViewNameDialog`). `grid-views.ts` is deleted; the old key is only read by `saved-views.ts`'s one-time import.
**Why:** L7/L12. Keeping two view UIs would let the old one write the old key, which L4 forbids.
**Revisit if:** —

## Q: The ⋯ menu painted under the grid.
**Decision taken:** The views rail gets `z-20`: it is sticky (so a stacking context) and must sit over the centre column, under the top bar's z-30.
**Why:** Found by the drive (the grid intercepted the click).
**Revisit if:** A later slice adds an overlay in the centre column that must sit over the rail.

## Q: A view applied while a search is still running.
**Decision taken:** The view's search runs anyway (`supersede`), and a numbered-search guard drops the earlier search's answer if it lands later. Search pressed twice still runs once.
**Why:** /code-review found that applying a view mid-search ran nothing and left the old rows under the view's name.
**Revisit if:** —

## Q: screen1-smoke.mjs drove the old Save view button.
**Decision taken:** Updated to + Save current view and the per-user key, but not run: it logs in against a live SIS.Api, which is not up.
**Why:** It is a live smoke, outside what this slice can stub.
**Revisit if:** SIS.Api is up. Run it then.
