# River Stone Migration Guide

## Goal

Replace existing surface styling without changing:

- layout
- dimensions
- content
- navigation
- business logic
- interactions

## Hero card

Replace the outer card View with:

```tsx
<RiverStoneSurface
  variant="hero"
  mode={themeMode}
  style={styles.hero}
  contentStyle={styles.heroContent}
>
  {heroContent}
</RiverStoneSurface>
```

Remove from the old card:

- border colour
- bright outline
- full-height linear gradient
- duplicate shadow
- top highlight View

## Small cards

Use:

```tsx
<RiverStoneSurface
  variant="card"
  mode={themeMode}
>
  {content}
</RiverStoneSurface>
```

Keep:

- existing dimensions
- illustration placement
- text layout

## List rows

For static rows:

```tsx
<RiverStoneSurface
  variant="list"
  mode={themeMode}
>
  {rowContent}
</RiverStoneSurface>
```

For interactive rows:

```tsx
<RiverStonePressable
  variant="list"
  mode={themeMode}
  onPress={handlePress}
>
  {rowContent}
</RiverStonePressable>
```

## Chips

Use `variant="chip"`.

Do not place another strong shadow around the chip.

Chips should remain the shallowest surface.

## Header

Use `variant="header"`.

The header should remain visually quieter than the hero card.

## Bottom tray

Use `variant="tray"` as the material layer only.

Preserve the existing:

- tray SVG geometry
- home indicator recess
- FAB cradle
- safe-area calculations
- icon positions

Do not replace tray geometry with a generic rounded rectangle.

## Validation

After each migration:

1. run the app
2. open Home
3. compare against the Gold Master
4. check for hard horizontal bands
5. check for bright full borders
6. check the depth hierarchy
7. check dark and light mode
