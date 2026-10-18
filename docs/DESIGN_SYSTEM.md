# Raahi design system

Raahi is a photo-led travel connection product. The system is intentionally compact: one confident type voice, one action accent, one positive compatibility accent, and strong trip context before social actions.

## Source of truth

- Visual direction and product decisions: [`docs/DESIGN.md`](./DESIGN.md)
- Runtime tokens: [`mobile/src/theme.ts`](../mobile/src/theme.ts)
- Shared primitives: [`mobile/src/ui.tsx`](../mobile/src/ui.tsx)
- Product surfaces: [`mobile/src/screens/`](../mobile/src/screens/)

## Tokens

| Role | Token | Use |
|---|---|---|
| Canvas | `#FFF7FF` | Primary app background; dark mode maps to `#17121C`. |
| Ink | `#1E1A22` | Headlines, high-confidence labels, dark trip surfaces. |
| Muted ink | `#6B5967` | Body copy and supporting metadata. |
| Primary action | `#E1037D` | Interest, primary CTA, active navigation. |
| Primary text | `#B40063` | Small action labels and emphasized metadata on light surfaces. |
| Compatibility | `#C7EF00` | Fit signals, reviewed/positive moments, trip passport status. Never use as body text on white. |
| Super interest | `#7F31C3` | Reserved for the super-interest action. |
| Surfaces | `#FFFFFF` / `#F7EFF8` | Interactive form containers and soft grouping. |
| Radius | `10 / 16 / 24 / 32 / pill` | Tight controls, fields, structural surfaces, photo-led surfaces, compact actions. |

## Type scale

- `34/40` large display
- `26/32` page title
- `21/27` section heading
- `16/22` emphasized UI copy
- `15/22` body copy
- `12/17` metadata
- `10/14` tracked labels

Use system sans with weight changes for hierarchy. Keep body copy readable, labels tracked, and large headings tight. Avoid decorative serif swaps, gradient text, and extra accent colors.

## Component contracts

### `Header`

Every screen has a branded mark or back affordance, a clear title, optional supporting context, and at most one trailing action.

### `Button` / `IconButton`

- Minimum 44pt touch target.
- Haptic feedback on deliberate actions.
- Primary action is pink; lime is reserved for positive compatibility/confirmation; ghost is quiet secondary navigation; danger is destructive only.
- Loading and disabled states must be visible.

### `Surface`

Use only for an interaction container or a hierarchy boundary. Do not nest surfaces to create decoration. Elevated surfaces use one soft shadow; most grouping uses a border only.

### `TripStrip`

Trip context is a black passport surface with destination, dates, flexibility, budget, and travel styles. It appears before discovery decisions and in chat/match context.

### `StatTile`

Only show computed signals that come from product data: overlapping days, shared styles, compatibility, and budget/currency. Never invent social proof or empty metrics.

## State requirements

Every network-backed surface needs loading, error/retry, empty, disabled, and success feedback. Discovery and matches use real loading blocks instead of prematurely showing an empty state.

## Motion

- Press: short scale feedback.
- Modal/sheet: fade or slide only when focus/context changes.
- Swipe card: spring back or directional exit.
- Respect reduced motion via `useReducedMotion`.

## Accessibility

- Native semantic controls and labels.
- Visible current tab state.
- Error messages are inline and announced.
- Text remains readable in dark mode.
- No important action is icon-only without an accessible label.
