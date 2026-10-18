# HingeX Component Specifications

Component specs for the HingeX clone in Raahi. All components use tokens from `tokens.json`.

---

### HingeXBadge
- **variants**: `gold` (VIP highlight), `charcoal` (subtle on dark), `pill` (header status)
- **sizes**: `sm` (22px height), `md` (28px height)
- **tokens**: bg `#F5C451`, text `#1A1508`, border `#E5B338`, radius `pill`
- **a11y**: accessibilityRole="text", accessibilityLabel="HingeX Member badge"
- **used on**: S01 (Paywall), S02 (Discover Header), S04 (Likes You Feed), S06 (Settings)

---

### TierComparisonTable
- **columns**: Feature | Free | Plus | HingeX
- **features listed**:
  - Daily Likes: 8 / day | Unlimited | Unlimited
  - See Who Likes You: 1 at a time | Full Grid | Full Grid
  - Like Placement: Standard | Standard | **Priority (Top of Queue)**
  - Recommendations: Standard | Enhanced | **Real-Time Adaptive Fit**
  - Strict Dealbreakers: None | Basic | **All Trip Attributes**
  - VIP Member Badge: No | No | **Yes (Gold Platinum)**
- **tokens**: bg `surface`, border `border`, text `text`, highlight `accent`
- **a11y**: table semantic / accessible list of feature comparisons
- **used on**: S01 (Paywall)

---

### PlanDurationCard
- **variants**: `1 Month` (Standard), `3 Months` (Popular - save 33%), `6 Months` (Best Value - save 50%)
- **states**: `default`, `selected` (gold border + glow), `pressed`
- **tokens**: bg `surface-raised`, border `border`, selected-border `accent`, text `text`, highlight `accent`
- **a11y**: accessibilityRole="radio" or "button", announces duration, price per month, and total price
- **used on**: S01 (Paywall)

---

### PriorityLikeButton
- **variants**: `compact` (inline with actions), `prominent` (in like dialog)
- **states**: `default`, `active` (gold glowing aura), `disabled`, `busy`
- **tokens**: bg `surface`, active-bg `accent`, active-text `on-accent`, border `accent`
- **a11y**: accessibilityRole="button", accessibilityLabel="Send Priority Like to skip the line"
- **used on**: S02 (Discover Card action bar), S05 (Like dialog)

---

### PriorityBanner
- **variants**: `ribbon` (top of card in Likes You), `inline-pill`
- **tokens**: bg `accent`, text `on-accent`, font `xs/bold`
- **a11y**: accessibilityLabel="Priority Like: This traveler sent a priority interest"
- **used on**: S04 (Likes You Feed)

---

### DealbreakerToggle
- **variants**: `verified-only`, `same-pace`, `budget-overlap`
- **states**: `off`, `on` (gold accent), `locked` (shows padlock with "HingeX only" nudge for free users)
- **tokens**: track-on `accent`, track-off `border`, thumb `text`
- **a11y**: accessibilityRole="switch", announces name and state
- **used on**: S03 (Discovery Filters)

---

### LikeQuotaPill
- **states**:
  - `normal`: "6 likes remaining today"
  - `low`: "1 like remaining today" (orange warning)
  - `exhausted`: "0 likes remaining — Get HingeX" (danger / CTA)
  - `unlimited`: "⚡ Unlimited Likes (HingeX)"
- **tokens**: bg `surface-raised`, text `text-muted`, highlight `accent`
- **a11y**: accessibilityRole="text", announces daily likes quota
- **used on**: S02 (Discover Header)
