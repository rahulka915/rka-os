# RKA OS River Stone Material

Reusable React Native / Expo material system for RKA OS.

This package controls material rendering only.

It does not define:

- screen layout
- navigation
- component content
- iconography
- typography
- business logic

## Public components

### RiverStoneSurface

Static material wrapper.

```tsx
<RiverStoneSurface
  variant="hero"
  mode="dark"
  style={{ minHeight: 220 }}
  contentStyle={{ padding: 24 }}
>
  {children}
</RiverStoneSurface>
```

### RiverStonePressable

Interactive surface wrapper.

```tsx
<RiverStonePressable
  variant="list"
  mode="dark"
  onPress={handlePress}
  contentStyle={{
    paddingHorizontal: 18,
    paddingVertical: 14,
  }}
>
  {children}
</RiverStonePressable>
```

## Variants

Available variants:

- `chip`
- `header`
- `list`
- `card`
- `hero`
- `tray`

Depth order:

```text
chip
<
header
<
list
<
card
<
hero
<
tray
```

## Material layers

Each River Stone surface contains:

1. large soft ambient shadow
2. tight contact shadow
3. matte graphite or pale-stone face
4. broad upper ambient light
5. subtle lower-edge occlusion
6. lower-corner weight
7. discontinuous upper-left edge catches
8. application content

## Design rules

Do not add:

- bright continuous silver borders
- obvious horizontal tonal bands
- strong full-height gradients
- glass effects
- chrome effects
- marble
- grain
- noise
- stone texture
- random asymmetric blob geometry

## Dark material

Base:

```text
#181B22
```

The centre should remain nearly uniform.

Lighting should be felt rather than clearly seen.

## Light material

Base:

```text
#E3DDD0
```

This is a warm pale-stone tone rather than pure white.

## Migration order

Recommended order:

1. Hero surface
2. Small cards
3. List rows
4. Chips
5. Header
6. Bottom tray

Validate the application visually after each step.
