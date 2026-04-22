/**
 * Mobile design tokens — mirrors the brand palette defined in
 * apps/web/src/app/globals.css and docs/brand/DESIGN_GUIDELINES.md.
 *
 * Keep this file in sync with the web `--color-*` tokens. When the
 * brand evolves, update both sides together.
 */

export const palette = {
  brand: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  accent: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  neutral: {
    background: '#fafaf9',
    surface: '#ffffff',
    foreground: '#1e293b',
    muted: '#64748b',
    mutedBg: '#f1f5f9',
    border: '#e2e8f0',
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    destructive: '#ef4444',
  },
} as const;

export const radius = {
  badge: 9999,
  button: 8,
  card: 14,
  panel: 16,
} as const;

export const typography = {
  h1: 36,
  h2: 30,
  h3: 24,
  h4: 20,
  body: 16,
  small: 14,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
