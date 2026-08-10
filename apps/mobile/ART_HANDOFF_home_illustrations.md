# Home illustration handoff — zen-garden scene + scroll stack

**Status: done (2026-07-13).** The photorealistic 3D-rendered candidates were rejected as a style
mismatch against the rest of the app (chibi character + painted scenes, not photoreal); regenerated as
flat-vector chibi-style illustrations instead, matching the chibi Ronin's actual art style. Both verified
with real alpha transparency (`sips -g hasAlpha` + a pixel-level check confirming true `alpha=0` at the
corners, not just an unused alpha channel) and wired in:

- `assets/illustrations/zen-garden-scene.png` (mossy stone lantern) → `NextUpCard.tsx`'s empty state
- `assets/illustrations/scroll-stack.png` (single scroll) → `InboxScrollCard.tsx`

See DESIGN_CHECKLIST.md for the final integration notes. The rest of this doc is kept as a reference for
the original brief.

Audience: whoever/whatever produces the actual art (Codex or a human illustrator), then an executing
agent to wire the result in.

## Context (read first)

- Direction: `DESIGN_CHECKLIST.md` — "feel like Things 3, look like Moonly." We compared Home against a
  real Moonly reference screen and found the gap: Moonly's cards each carry unique illustrated/painted
  art, ours are still line-icon-only below the hero card. This handoff closes that gap for the two most
  visible candidates.
- Two hand-coded SVG placeholders were prototyped in-conversation for these exact spots and rejected as
  "not convincing at painted-scene scale" — small hand-drawn shapes read fine as tiny icons (see
  `ScrollIcon.tsx`/`ZenGardenIcon.tsx`, already shipped and approved at ~18-46px), but not at the larger
  panel size these two need. Real illustration is needed instead of more SVG iteration.
- **Known pitfall to avoid:** the existing chibi Ronin PNGs (`assets/ronin/base|haori|training|journey/`)
  have rough/dirty transparency edges from an imperfect chroma-key/auto-trim pass, and were pulled from
  `RoninGreetingCard.tsx` for exactly that reason. Whatever produces this new art must deliver **real,
  clean alpha transparency** — verify with `sips -g hasAlpha <file>.png` before considering a piece done,
  and visually check the edges against both a light and a dark backdrop for halo/fringing artifacts.
- Existing painted style reference: `assets/ronin/scenes/{morning,day,night}.png` — real painted scenery
  (mountain, lake, tree, shrine, lantern), muted/atmospheric, not flat-vector. New pieces should read as
  siblings of this set stylistically (same rendering technique/painterly quality), not a different art
  style bolted on.

## Piece 1 — Mossy stone lantern (for `NextUpCard.tsx`'s empty state)

**Selected art:** a photorealistic mossy stone lantern (tōrō) with a warm inner glow, small rocks and a
leafy sprig beside it, dark studio background. Replaces the current `ZenGardenIcon` line-icon (raked
circles + stone) used inline in the same spot, at much larger scale.

- **Crop/composition:** the lantern should be roughly centered, enough negative space around it to sit
  comfortably as a standalone cutout (not tightly cropped to the silhouette edge).
- **Delivery format — transparent PNG required:** the source render has a dark studio background with a
  soft glow and soft ground shadow. **Do not chroma-key/color-key this after the fact** — the soft
  glow/shadow falloff will leave visible halos or fringing at the edges (this is exactly the "rough/dirty
  transparency" failure mode called out at the top of this doc for the earlier Ronin PNGs). Instead,
  re-export directly from whatever tool produced it with a transparent-background option, or run it
  through a proper matting tool (not simple color-key) if regenerating isn't possible.
- **Verify before delivering:** `sips -g hasAlpha <file>.png` must say `hasAlpha: yes`, AND visually check
  the edges against both a light and dark backdrop for halos — the glow around the lantern's window is
  the highest-risk spot for fringing.
- **Delivery:** `assets/illustrations/zen-garden-scene.png` (create the `assets/illustrations/` folder if
  it doesn't exist — separate from `assets/ronin/` since this isn't a Ronin-character asset).

## Piece 2 — Single scroll (for `InboxScrollCard.tsx`)

**Selected art:** a photorealistic single rolled scroll — parchment-cream paper body, wood/bronze rod
ends, a red tie ribbon around the middle, dark studio background. Replaces the current `ScrollIcon`
line-icon (single rolled-scroll silhouette in a color bubble), at larger scale, with real material
shading instead of a flat stroke outline.

- **Crop/composition:** roughly square, ~72×72 equivalent — the scroll upright and centered.
- **Delivery format — transparent PNG required:** same caution as Piece 1 — the source render has a soft
  drop shadow beneath the scroll on the studio surface. Re-export with real alpha directly from the
  generation tool rather than color-keying afterward.
- **Verify before delivering:** `sips -g hasAlpha <file>.png` must say `hasAlpha: yes`, and check the
  bottom edge (where the shadow was) for fringing.
- **Delivery:** `assets/illustrations/scroll-stack.png`.

## Integration (once art lands — small, mechanical)

Both components currently render their icon inside a colored bubble/badge (see `NextUpCard.tsx`'s empty
state block and `InboxScrollCard.tsx`'s icon bubble). Once the PNGs exist:

1. Verify alpha on both files: `sips -g hasAlpha assets/illustrations/zen-garden-scene.png
   assets/illustrations/scroll-stack.png` — must both say `hasAlpha: yes`.
2. `NextUpCard.tsx` empty state: replace the `<ZenGardenIcon size={40} .../>` line with an `<Image
   source={require('../../../assets/illustrations/zen-garden-scene.png')} style={{ width: '100%', height:
   90 }} resizeMode="contain" />` sized to fill the card width, keep the text block below unchanged.
3. `InboxScrollCard.tsx`: replace the `ScrollIcon`-in-a-bubble with `<Image
   source={require('../../../assets/illustrations/scroll-stack.png')} style={{ width: 72, height: 72 }}
   resizeMode="contain" />`, drop the surrounding colored circle badge (the illustration itself now
   carries the color/depth).
4. `npx tsc --noEmit` must pass. Do not touch `ScrollIcon.tsx`/`ZenGardenIcon.tsx` — they stay in place
   for their existing small-icon uses elsewhere (if any) and as the fallback if either PNG fails to load.
5. Update `DESIGN_CHECKLIST.md`: mark this handoff's two entries done under the relevant components once
   wired, same as every other row in that file.
