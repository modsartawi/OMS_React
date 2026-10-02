---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: open
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
