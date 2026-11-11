# Arabic is set in Avenir Arabic, not Plex Sans Arabic

Arabic text moves from **Plex Sans Arabic** to **Avenir Arabic**, the face on the company's official
website. Only Arabic moves: Latin, digits and codes stay in the Latin faces (Roboto since
[ADR 0005](0005-latin-ui-text-is-set-in-roboto.md), and Plex Mono). This replaces
the Arabic part of [ADR 0003](0003-the-ops-console-sets-type-in-ibm-plex.md). Decided by the owner,
2026-11-02.

## Why

The owner chose it so the app's Arabic matches the company's own. This gives up 0003's argument for
Plex Sans Arabic, that it was drawn alongside the Latin so the two match in mixed lines.

## Licence

Avenir Arabic is a commercial Monotype font. The files came from arfonts.net, whose note says they
may only be used with a prior licence. The owner approved the use because the font is on the official
website. No licence document was reviewed, so whether it covers this app is **not confirmed here**.
If it is later confirmed, or replaced with the foundry's own web files, record that here.

## The choices that follow

- **Weights follow stroke thickness, not file names.** The source files' names and declared weights
  are unreliable: "regular" is the thinnest and "light" is thicker than it. Measured alef stems are
  regular 60, book 66, light 78, medium 88, heavy 118 and black 148.
  - 400 uses "light". "regular" and "book" are too thin at 12px.
  - 500 uses "medium".
  - 600 and 700 share "heavy". "black" is too dense in a grid. So in Arabic, 600 and 700 look the same.
- **`size-adjust` is 105%, not 115%.** Avenir draws larger per pixel than Plex, and 105% matches the
  line width of Plex at the 115% the owner approved in 378 §4.
- **Files are unmodified apart from the woff2 conversion**, gated by `unicode-range`, so a session
  with no Arabic downloads none of the ~114 KB.

## Consequences

- **Rarer Arabic letters fall back to the platform font.** Avenir covers 102 characters in the main
  Arabic block against Plex's 252. Saudi Arabic, Persian and Urdu's common letters are all there;
  a rarer letter, say in a name, renders in the system font.
- **Arabic-Indic digits now come from Avenir.** Their alignment was not measured. The app shows
  Western digits, which stay in the Latin faces.
