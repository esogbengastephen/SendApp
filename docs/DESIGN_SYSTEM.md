# FlipPay Design System (Fintech)

Hand-off doc for designers and developers. Same style and color palette; clear hierarchy and restraint.

---

## 1. Color

### Roles
- **Primary** = actions only (Send, Receive, active tab). Use for 1–2 elements per screen max.
- **Surface** = cards and containers. Never use full primary for card backgrounds.
- **Background** = calm base. Avoid stacking more than 2 strong colors.

### Light mode
| Token | Hex | Usage |
|-------|-----|--------|
| `--color-primary` | `#00B8FF` | Primary CTAs, active tab |
| `--color-surface-strong` | `#BFEFFF` | Balance cards, main surfaces |
| `--color-surface-soft` | `#E6F7FF` | Token price bar, inner surfaces |
| `--color-bg-light` | `#F8FCFF` | App background (optional) |
| `--color-border` | `#D9EEF9` | Borders |
| `--text-primary` | `#0A2540` | Headings, amounts |
| `--text-secondary` | `#5E7A8A` | Labels, secondary text |
| `--text-muted` | `#9FB7C5` | Hints, inactive UI |

### Dark mode
| Token | Hex | Usage |
|-------|-----|--------|
| `--color-primary` | `#4CCBFF` | Same hue, calmer (no neon) |
| `--dark-bg` | `#071826` | App background |
| `--dark-surface` | `#0E2A3A` | Cards, nav bar |
| `--dark-surface-soft` | `#123B52` | Softer surfaces |
| `--text-primary` | `#EAF6FF` | Primary text |
| `--text-secondary` | `#9CC3D8` | Secondary text |
| `--text-muted` | `#6E97AD` | Muted text |

### Tailwind classes
- Colors: `ds-primary`, `ds-surface-strong`, `ds-surface-soft`, `ds-text-primary`, `ds-text-secondary`, `ds-text-muted`, `ds-dark-bg`, `ds-dark-surface`, `ds-dark-surface-soft`, `ds-border`, `ds-bg-light`.

---

## 2. Motion (fintech feel)

- **No bounce, no spring.** Money apps should feel stable and predictable.

| Token | Value | Usage |
|-------|--------|--------|
| `--motion-fast` | 120ms | Button feedback (press) |
| `--motion-base` | 180ms | Transitions, tabs, card enter |
| `--motion-slow` | 260ms | Loading, skeletons (≥1.2s for shimmer) |
| `--ease-standard` | cubic-bezier(0.2, 0, 0.2, 1) | Default easing |
| `--ease-exit` | cubic-bezier(0.4, 0, 1, 1) | Exit transitions |

### Component rules
- **Buttons (Send/Receive):** `duration-motion-fast`, `active:scale-[0.98]`, no bounce.
- **Cards:** Fade + slight slide on enter (`animate-card-enter`, 180ms).
- **Tab switch:** `duration-motion-base`, cross-fade + indicator move.
- **Loading:** Shimmer/rotation ≥ 1.2s.

### Tailwind
- `duration-motion-fast`, `duration-motion-base`, `duration-motion-slow`
- `ease-standard`, `ease-exit`
- `animate-card-enter`

---

## 3. Spacing (8pt)

| Token | Value | Usage |
|-------|------|--------|
| `--space-2` | 4px | Tight gaps |
| `--space-3` | 8px | Icon/text gaps |
| `--space-4` | 12px | Small padding |
| `--space-5` | 16px | Default padding, card inner |
| `--space-6` | 24px | Card spacing |
| `--space-7` | 32px | Section separation |
| `--space-8` | 40px | Large sections |

### Layout
- Screen padding: 16px horizontal, 24px vertical.
- Card inner: 16px. Card-to-card: 24px. Section gaps: 32px.
- Services grid gap: 16px.

### Tailwind
- `ds-2` … `ds-8` (e.g. `p-ds-5`, `gap-ds-4`, `mt-ds-7`).

---

## 4. Radius

| Token | Value | Usage |
|-------|------|--------|
| `--radius-sm` | 8px | Small chips |
| `--radius-md` | 12px | Buttons |
| `--radius-lg` | 16px | Cards, service icons |
| `--radius-xl` | 24px | Balance container, bottom nav |

### Tailwind
- `rounded-ds-sm`, `rounded-ds-md`, `rounded-ds-lg`, `rounded-ds-xl`.

---

## 5. Shadows

- No colored shadows. Use neutral gray only.

| Token | Value | Usage |
|-------|------|--------|
| `--shadow-soft` | 0 4px 12px rgba(0,0,0,0.06) | Cards |
| `--shadow-base` | 0 8px 20px rgba(0,0,0,0.08) | Floating elements |

### Tailwind
- `shadow-ds-soft`, `shadow-ds-base`.

---

## 6. Component rules

| Component | Rule |
|-----------|------|
| **Primary CTAs** | Only Send + Receive (and active tab) use full primary. |
| **Cards** | Surface colors only (`ds-surface-strong` / `ds-dark-surface`). Text: `ds-text-primary` / `ds-text-secondary`. |
| **Token price bar** | Informational: `ds-surface-soft`, `ds-text-secondary`. Not a CTA. |
| **Services** | All service buttons use the same style for balance: `ds-surface-soft` / `ds-dark-surface-soft` background, `ds-primary` icon color, `ds-text-primary` labels. Section bg: white / `ds-dark-surface`. No row dominates. |
| **Bottom nav** | Bar: dark surface. Active: `ds-primary`. Inactive: `text-white/70`. One shadow only (`shadow-ds-soft`). |
| **Header icons** | Muted (e.g. `text-secondary/70`). Username stays full white. |

---

## 7. Dark mode

- Same hue, lower brightness. Never pure black.
- Text contrast over color pop.
- Surfaces use `ds-dark-surface` / `ds-dark-surface-soft`.

---

## 8. File reference

| What | Where |
|------|--------|
| CSS variables | `app/globals.css` (`:root` and `.dark`) |
| Tailwind theme | `tailwind.config.ts` (colors, spacing, radius, shadow, transition, animation) |
| Dashboard | `components/UserDashboard.tsx` |
| Balance cards | `components/WalletCard.tsx` |
| Service icons | `components/ServiceButton.tsx` (unified surface + primary icon) |
| Bottom nav | `components/BottomNavigation.tsx` |

---

## 9. Before vs after (summary)

| Before | After |
|--------|--------|
| Too many primary blues | Primary only on Send, Receive, active tab |
| Cards and buttons compete | Clear surface vs action (surface = cards) |
| Dark mode feels neon | Calmer dark primary, surfaces defined |
| No visual hierarchy | Text/surface/primary roles consistent |

Same brand color and layout; tuned for clarity and a fintech-grade feel.
