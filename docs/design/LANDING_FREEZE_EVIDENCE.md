# Landing Freeze Evidence

Date: 2026-09-03  
Audited source base: `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de`

## Approved changes

- `client/src/styles/tokens.css` defines Landing-owned lime, mint, and border tokens.
- `client/src/styles/landing.css` maps the existing Figma Landing variables to those Landing-owned tokens.
- The same feature stylesheet restores the real installed `Plus Jakarta Sans Variable` family and weight 700 on the hero and final CTA after the legacy compatibility reset.
- No Landing copy, markup, assets, dimensions, spacing, color values, shadows, responsive rules, or motion rules changed.

## Pre-change reproduction

The CSS source declared weight 700, but the later compatibility rule `button,input,textarea { font: inherit }` won by cascade layer. After `document.fonts.ready`, both desktop and mobile CTA buttons and spans computed to `"Plus Jakarta Sans", system-ui, sans-serif` at weight `400`. The imported variable font is registered under `Plus Jakarta Sans Variable`, so that family name was falling back.

Committed deterministic baselines:

| Viewport | Full-page size | Baseline SHA-256 | Hero CTA | Final CTA |
| --- | ---: | --- | --- | --- |
| 1440 × 1000 | 1440 × 9342 | `667cca0e686e2963b3fffbf1130bbe87657f1b1be37860fccc17b49e90105ed6` | `(597,489) 246×58` | `(597,8697) 246×58` |
| 390 × 844 | 390 × 8801 | `cdef666620e0c22ad468cc05322b46fc5374f81f335d40449e7b92062c21f9ae` | `(90,383) 210×52` | `(90,8113) 210×52` |

## Post-change acceptance

`npm run test:landing-freeze` uses deterministic public API responses, reduced motion, device scale 1, and waits for `document.fonts.ready`. It verifies:

- both CTA buttons and child spans compute to `"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif` at weight `700`;
- the installed 700-weight variable face reports loaded through the FontFaceSet API;
- CTA rectangles are unchanged at both viewports;
- `--fg-lime` remains `#c2ff33` and `--fg-mint` remains `#45ffa2`;
- horizontal overflow is zero;
- the pixel difference outside the union of the before/after CTA rectangles is exactly zero;
- changing saved Workspace preferences from system/lime to dark/blue, while also changing OS color scheme, changes exactly zero Landing pixels.

Post-change SHA-256 values are `eacb9d1ff881a30af9f09135895bf7e87f0bc341ca72583bee9efb46cfb17d3e` for desktop and `3d4f3f7e987d9cafdf217d21e445e1eaa65f15703f6b8debbc7b4c93f655f05d` for mobile. Full screenshots and diff images are emitted under `output/playwright/landing-freeze/` for local inspection.

## Scope guard

The gate intentionally masks only the two fixed CTA rectangles in the pre/post comparison. Any future changed pixel outside them fails. Preference-independence comparison masks nothing.
