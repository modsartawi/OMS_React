---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: open
blocked-by: 744
---

# 747 — Do users explore inside oms-react or inside the BI tool?

## Question

Where does an HQ user explore, save and re-run views?

The options:
1. **Embedded:** the BI tool is embedded in an oms-react screen under a new area.
2. **Standalone:** the BI tool's own UI, reached by SSO from a menu link.
3. **Native:** an oms-react screen of our own that talks to the semantic layer directly, keeping
   the BI tool for authoring only.

For the chosen option, settle:
- how oms-react grants gate it (one `BackOfficeScreen` grant beside `Copilot`, or the same one);
- the area and URL;
- how the AI's `create_view` link lands the user on the view;
- what the zero-literal, RTL and DMSCO-theme rules mean for embedded content we don't render.
