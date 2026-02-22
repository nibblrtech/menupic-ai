/**
 * MenuPic AI — Design System
 *
 * Single source of truth for all visual tokens.
 * Import from here; never hard-code colors, sizes, or font names elsewhere.
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const Colors = {
  /** Primary dark background (screens, tab bar, headers) */
  dark: '#1f2933',
  /** Light surface (popups / dialogs / modals) */
  light: '#fff6ee',
  /** Text rendered on a dark surface */
  textOnDark: '#fff6ee',
  /** Text rendered on a light surface */
  textOnLight: '#1f2933',
  /** A semi-transparent dark overlay (modals backdrop) */
  overlay: 'rgba(0,0,0,0.6)',
  /** Subtle divider / border tint used on light surfaces */
  dividerLight: 'rgba(31,41,51,0.12)',
  /** Subtle divider / border tint used on dark surfaces */
  dividerDark: 'rgba(255,246,238,0.12)',
} as const;

// ─── Fonts ───────────────────────────────────────────────────────────────────

export const Fonts = {
  regular: 'Play-Regular',
  bold: 'Play-Bold',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
// Three tiers only.  "title" is reserved for the home-screen app name.

export const FontSize = {
  /** Reserved for the home-screen app name only */
  title: 20,
  /** Body copy, labels, buttons */
  normal: 16,
  /** Captions, hints, terms text */
  small: 12,
} as const;

// ─── Spacing (8 px grid) ─────────────────────────────────────────────────────

export const Spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
} as const;

// ─── Buttons ─────────────────────────────────────────────────────────────────

export const Button = {
  height: 48,
  borderRadius: 32,
} as const;

// ─── Convenience helpers ─────────────────────────────────────────────────────

/**
 * Returns button background and text colors for the given surface.
 *  - surface = 'dark'  →  light button (#fff6ee) with dark text (#1f2933)
 *  - surface = 'light' →  dark button (#1f2933) with light text (#fff6ee)
 */
export function buttonColors(surface: 'dark' | 'light') {
  return surface === 'dark'
    ? { bg: Colors.light, text: Colors.textOnLight }
    : { bg: Colors.dark,  text: Colors.textOnDark  };
}
