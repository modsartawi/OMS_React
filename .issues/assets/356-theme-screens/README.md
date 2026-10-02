# Selected theme: delivery details and POS simulation

Owner-requested extension of the accepted inquiry prototype, on branch `prototype/theme-directions-355`. The owner approved both screen previews on 2026-10-02, as captured in commit `5cc3a27`. The [approval record](../../356-make-grid-and-component-states-feel-like-one-system.md#approved-screen-previews) defines its scope.

Run `npm run prototype:theme`, then open:

- [Delivery details](http://127.0.0.1:5198/oms/delivery/8000048?variant=selected)
- [POS simulation](http://127.0.0.1:5198/pricing/simulation?variant=selected)
- [Delivery inquiry](http://127.0.0.1:5198/oms/deliveries?variant=selected)

Use the screen links across the top; the inquiry's **Preview delivery** opens the selected document. Theme and direction travel between screens. Both previews offer Light/Dark and RTL controls.

Delivery details reuses the real page, its command dialogs, status disclosure, summary rail and four tabs. Its data is entirely fictional, constructed from the existing wire shape with all captured values cleared first. Grid text selection/Ctrl+C is enabled only for the development preview. Commands can be inspected, but the preview server refuses writes with an explicit message.

Simulation reuses the existing rendering components and a throwaway copy of the page controller, initialized with one of four captured requests: promotion applied, near miss, multiple items, and pricing trace. Choose a basket and press **Process** or Ctrl+Enter, then expand result rows. **Reset sample** restores the captured inputs. The middleware matches the complete request before replaying its captured response; it refuses edited requests rather than inventing new prices. The captures are the existing [098 corpus](../098-simulate-payloads/), which contains no customer identity data. This is a visual replay, not a live pricing service.

All API requests terminate in the isolated development middleware. No changes reach SIS.Api. The production router excludes these preview entries.

Geometry experiments are scoped to the preview: compact rectangular controls and surfaces, existing semantic badge/action colours, and the approved steel palette. Existing detail information hierarchy and simulation results/promotion relationship are preserved. Simulation retains its established 780px work-area floor, with local horizontal scrolling at smaller widths.

## Review captures

- Delivery: [light](delivery-light.png), [dark](delivery-dark.png), [RTL](delivery-dark-rtl.png).
- Simulation: [promotion applied](simulation-light-fired.png), [near miss](simulation-light-near.png), [multiple items](simulation-light-plain.png), [pricing trace](simulation-light-trace.png).
- Simulation: [dark](simulation-dark-fired.png), [RTL](simulation-dark-rtl.png), [laptop](simulation-laptop.png).

## Verification

`npm run build` and `npm run lint` pass (the existing large-chunk warning remains). The manual browser drive `node tools/theme-screens-drive.mjs` checks the real routes, both themes, all tabs, text copying, dialogs, status disclosure, RTL, captured scenario runs, line expansion, stale inputs, unsupported-input refusal, reset, keyboard processing, laptop overflow and round-trip navigation. Results: [verification.json](verification.json).

Both screen previews are approved. Collection specimens and the full shared component-state matrix remain ticket 356's work.
