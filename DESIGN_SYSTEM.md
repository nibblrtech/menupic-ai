# MenuPic AI — Design System

> **Single source of truth** for all UI/UX decisions in this project.
> All values live in `constants/DesignSystem.ts`. Never hard-code colors, fonts, or sizes anywhere else.

---

## Typography

| Role | Size | Font | Usage |
|------|------|------|-------|
| `title` | **20 px** | Play Bold | Home-screen app name **only** |
| `normal` | **16 px** | Play Regular / Bold | Body copy, labels, buttons, headers |
| `small` | **12 px** | Play Regular | Captions, hints, terms text, subtitles |

- **Font family**: [Play](https://fonts.google.com/specimen/Play) (Google Fonts)
- **Files**: `assets/fonts/Play-Regular.ttf`, `assets/fonts/Play-Bold.ttf`
- **Loading**: Fonts are loaded at app start in `app/_layout.tsx` via `expo-font`. The splash screen is held until fonts are ready.
- Use `fontFamily: Fonts.bold` in place of `fontWeight: 'bold'` — Play Bold is the correct weight variant.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `Colors.dark` | `#1f2933` | Main background (all screens, tab bar, headers) |
| `Colors.light` | `#fff6ee` | Popup / dialog / modal backgrounds |
| `Colors.textOnDark` | `#fff6ee` | Text rendered on a dark surface |
| `Colors.textOnLight` | `#1f2933` | Text rendered on a light surface |
| `Colors.overlay` | `rgba(0,0,0,0.6)` | Semi-transparent modal backdrop |
| `Colors.dividerLight` | `rgba(31,41,51,0.12)` | Borders / dividers on light surfaces |
| `Colors.dividerDark` | `rgba(255,246,238,0.12)` | Borders / dividers on dark surfaces |

**Rule:** text color always matches the surface it sits on — `textOnDark` on dark, `textOnLight` on light.

---

## Buttons

| Property | Value |
|----------|-------|
| Height | **48 px** |
| Corner radius | **32 px** |
| Width | Full container width (minus horizontal padding) |
| Font | Play Bold, `normal` (16 px) |

### Button colors (surface-driven)

| Surface | Button bg | Button text |
|---------|-----------|-------------|
| Dark (`#1f2933`) | `#fff6ee` (light) | `#1f2933` (dark) |
| Light (`#fff6ee`) | `#1f2933` (dark) | `#fff6ee` (light) |

Use the `buttonColors(surface)` helper from `DesignSystem.ts`:

```ts
import { buttonColors } from '../constants/DesignSystem';
const { bg, text } = buttonColors('dark'); // or 'light'
```

### Cancel / close buttons (popup exception)

Popup cancel buttons are **icon-only** (`✕`), no background, no border. They sit absolute top-right inside the modal. This is the **only** exception to the button shape/fill rules.

---

## Spacing — 8 px Grid

All padding, margin, gap, border-radius, and size values must be multiples of **8 px**.

| Token | Value |
|-------|-------|
| `Spacing.xs` | 8 px |
| `Spacing.sm` | 16 px |
| `Spacing.md` | 24 px |
| `Spacing.lg` | 32 px |
| `Spacing.xl` | 40 px |
| `Spacing.xxl` | 48 px |

---

## Layout Principles

- **Classy, high-end, conservative.** Avoid decorative gradients, bright accent colors, or playful animations beyond subtle fades/slides.
- Use `borderColor: Colors.dividerDark` (or `dividerLight`) for all hairline separators — never hard-coded grays.
- Modal/popup content areas use `Colors.light` background with `Colors.textOnLight` text.
- All screens use `Colors.dark` as the root background.
- Tab bar and header bars share `Colors.dark` background with a `Colors.dividerDark` border.

---

## File Reference

| File | Role |
|------|------|
| `constants/DesignSystem.ts` | All tokens + `buttonColors()` helper |
| `assets/fonts/Play-Regular.ttf` | Play Regular font |
| `assets/fonts/Play-Bold.ttf` | Play Bold font |
| `app/_layout.tsx` | Font loading + splash screen gate |
