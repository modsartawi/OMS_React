---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: —
---

# 377 — Notifications, toasts and dialogs in the Ops Console

## Question

Now that [The rail shell](363-the-rail-shell.md) is settled (44px top bar holding the store chip
and the bell; navy flyouts off a 56px rail), how do the app's **overlay surfaces** look and sit
under 362's B tokens?

- **The notification panel** (`layout/notifications/NotificationPanel.tsx`) dropping from the bell
  in the new top bar: width, density, the broadcast/job type tags, and its unread dot against B.
- **Sonner toasts** (`main.tsx`, `richColors`, top-right, 6s): do `richColors` survive B's status
  families, and does top-right collide with the bell/panel under the new top bar? Position in RTL.
- **The confirm dialog** (`core/services/confirm.tsx`) and the app's other dialogs: 6px controls,
  8px cards, the dark scrim, and the gold-in-dark focus ring.
- **One overlay family or several?** The flyout, the store-chip and user-menu popovers, the bell
  panel and the dialogs: one elevation/border/radius recipe, or a navy family on the rail and a
  card family off it?

Prototype it on the 363 branch (`prototype/363-rail-shell`), light, dark and RTL.

## Answer

**Navy on the rail, one card recipe off it; tinted 082 toasts at bottom-end; a dense bell dropdown;
a dialog's own failure shows inside the dialog, never as a toast.** The owner picked all four on
2026-10-02 from the live prototype and its captures.

**Assets:** branch `prototype/377-overlays` (`9e5bf95`, stacked on 363's `acd5564` → 362's
`da08890`; never merges), worktree `C:\Playground\oms-react-377`. Run `npx vite --port 5277`, open
`/oms/deliveries?stub=1&palette=navy&shell=D&cmd=1`, and use the bottom-start dev bar: stage
buttons raise each overlay through the real code paths, five rows switch the axes
(`?fam=&toast=&pos=&bell=&host=`). [Captures](assets/377-shots/) — 60 shots in light, dark and RTL,
plus side-by-side [sheets](assets/377-shots/sheets/). Re-shoot with
`DRIVE_PORT=5277 node tools/proto-377-shots.mjs`.

*Note:* the 362 and 363 prototype branches had been deleted, and their commits survived unreachable.
377 was stacked on `acd5564`, so `prototype/377-overlays` keeps both reachable.

### 1. One overlay recipe — except what opens from the rail

"One family" was not on offer in full: 363 already made the flyout navy because it *is* the rail.
So the rule is by **origin**:

- **From the rail → navy.** The group flyout and the **user menu at the rail foot**: `--rail`
  ground, `--rail-foreground` ink, `--rail-muted` for secondary text, `--rail-accent` hover with
  white ink, dividers and edge `rgb(255 255 255 / .12)`, **gold focus ring** (362: gold on navy).
- **Everywhere else → the card recipe.** Store chip, bell panel, column chooser, saved-view menus,
  every dialog and the palette:
  - ground `--card`, edge **`--border-strong`** (today's popovers use `--border`), ink `--foreground`;
  - radius **8px** for popovers and menus (`--radius-lg`), **10px** for dialogs and the palette;
  - **one shadow token, `--shadow-pop`**: `0 10px 30px rgb(16 24 40/.16), 0 2px 6px rgb(16 24 40/.08)`
    light, `0 12px 34px rgb(0 0 0/.5), 0 2px 6px rgb(0 0 0/.3)` dark;
  - **one scrim token, `--backdrop`**: `rgb(13 16 21/.32)` light, `rgb(0 0 0/.5)` dark, used by
    `::backdrop` and by any hand-drawn scrim;
  - menu items 28px, 12.5px, 6px radius; dialog title 13px semibold.
- **What it replaces:** today's mix of `shadow-md`/`-lg`/`-2xl`, `rounded-md`/`-lg`, and the
  `bg-black/50` and `bg-black/30` scrims.
- **Checked live:**
  - The dark scrim over `#0A111D` still separates the `#111A28` dialog, because the edge is
    `--border-strong`.
  - The gold-in-dark focus ring reads on fields and buttons.
  - 6px controls inside dialogs hold. The one exception is the shipped `NoteField` textarea, which
    is `rounded-lg` (8px); the breakage sweep fixes it.

### 2. Toasts: tinted to 082, bottom-end, Plex

- **`richColors` does not survive B — it never read the tokens.** Sonner paints its own HSL palette
  (measured: success `rgb(236,253,243)` / `rgb(0,138,46)`, not 082's `--success-050`/`-800`), its
  neutral dark toast is pure `#000`, and its font is `system-ui`, not Plex.
- **The look:** keep `richColors`, but point sonner's variables at 082's tiers.
  - **Status toasts:** success, warning (`attention`) and error (`danger`) take their `-050`
    ground, `-border` edge and `-800` ink. **Info takes the `primary` tiers**, because 082
    deliberately has no `--info`.
  - **Neutral toasts** (arrivals) take `--card` / `--border-strong` / `--foreground`.
  - **All toasts:** Plex, `--radius`, `--shadow-pop`, 340px wide, a 12.5px title at 600 and a 12px
    description.
  - **Buttons** are 6px controls: action `--primary`, cancel `--muted`.
  - **No new tokens.** The styling lives in `global.css` beside the tokens (sonner's variables on
    `[data-sonner-toaster]`), not at call sites.
- **The position: bottom-end, offset 16px, mapped by `dir`.** Measured: today's physical
  `top-right` (24px offset) sits **on the 44px top bar**, over the store chip and the bell; a
  top-end toast pushed under the bar **lands on the open bell panel**. Bottom-end clears both.
- **RTL:** sonner positions are physical, so the Toaster takes
  `position = dir === 'rtl' ? 'bottom-left' : 'bottom-right'`, re-read when the direction
  changes. Driven: the toasts land on the inline-end edge in both directions.
- **Considered and not taken:**
  - A neutral card toast with a 3px logical status edge. It is calmer, but errors are less salient.
  - Far's inverted ink chip at bottom-centre. It needs an inverse status set, because its icons
    sit on the other mode's ground.

### 3. The bell panel: a dense dropdown

The same anchored dropdown (`role="dialog"`, outside-click/Esc, opening marks nothing read), redrawn
at the console's density:

- **360px**, max 440px tall, card recipe. Header 36px: "Notifications", an **"N new"** count chip
  (`primary-050` / `primary-800`), then Mark all as read as a 24px text control.
- **Rows:** 8px × 12px padding, `--divider` rules, `--card-2` hover. Title 12.5px (600 unread,
  500 + `muted-foreground` read), relative time 11px `--ink-3` at the end, body 12px
  `muted-foreground` **clamped to two lines**.
- **The type tag moves to its own line** under the body: squared (4px), 10px uppercase. Today's tag
  sits inline and truncates titles ("Store 1017 closes at 21…") at 380px.
- **BROADCAST takes the primary tier, not amber.** Today it wears `attention`, which in 082 means
  "needs attention", and a broadcast is not a warning. JOB stays `--muted`.
- **Unread is a 6px `--primary` dot**, not the cursor bar, which already means "selected" (362).
- **The bell's badge is gold with navy ink in both modes**: a gold fill carrying navy ink, which
  362 allows. It has a `--card` ring against the top bar. Today it is `--ring`: navy-lifted in
  light, gold only in dark.
- The full-height sheet (grouped New / Earlier) was not taken. It would cover the inspector's
  column on Deliveries while open.

### 4. A dialog's own failure shows inside the dialog

- **Measured:** a native `showModal()` dialog sits in the browser's top layer, so any toast raised
  while it is open paints **under its `::backdrop`**. It is dimmed, and a hit-test at its close
  button lands on the DIALOG, so it is unreachable. Portalling the Toaster into the open dialog fixes
  the hit-test but drops toasts already on screen whenever the host moves. It was not taken.
- **The rule:** a failure of the dialog's own action renders **inside the dialog** (`ErrorBanner`,
  as `RescheduleDialog` and `CentralInvoiceDialog` already do), and the dialog stays open. A
  success that closes the dialog may still toast, because it fires as the dialog closes. The
  Toaster stays at the root.
- **Known offenders, live today:** `admin/ua-admin/SetPasswordModal.tsx` (`notify.apiError` and
  stays open) and `collection/settlement/PostEntryDialog.tsx` (`toast.error` and stays open).
  18 of the 37 `Modal` users toast somewhere, so the foundation's breakage sweep audits all 18
  against the rule.
- **Arrivals during a dialog** (a broadcast banner, a job toast) wait under the scrim. A sticky
  banner is still there when the dialog closes. A job toast may expire unseen, but the bell's
  badge still counts it, which was accepted.

### Findings handed on

- **To [The foundation in Arabic/RTL](378-the-foundation-in-arabic-rtl.md)** (it was claimed by
  another session, so it is noted here rather than edited there):
  - **Toast text needs bidi isolation.** Under `dir="rtl"` an English server message flips its
    terminal punctuation ("`.(OUT_FOR_DELIVERY)`", "`.Pick a store…`"). Server-supplied toast
    and confirm text should render with `dir="auto"`.
  - **The Toaster's position must be dir-mapped** (above).
- **To the foundation step:**
  - Add `accent-color: var(--primary)` globally. Checkboxes inside dialogs currently paint the
    browser's default purple.
  - Add the two tokens, `--shadow-pop` and `--backdrop`. Neither is a text pair, so the contrast
    gate is unchanged.
  - Tag the toast restyle and the rail-origin navy popover as foundation work.
- **To [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md)'s build:**
  `ViewManager`'s Save-view dialog is **hand-rolled** (a `fixed` div with `bg-black/50`, not
  native). It moves onto `core/ui/Modal`, which also brings it under the card recipe and the
  top-layer rule.
- **Not decided here:** confirm-dialog copy (today's generic Yes/No) and the help sheet's look
  (keyboard step).
