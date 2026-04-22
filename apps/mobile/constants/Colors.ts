/**
 * Legacy Expo-template Colors export — now backed by the brand palette.
 * Prefer importing from `@/constants/theme` directly in new code.
 */
import { palette } from './theme';

const tintColorLight = palette.brand[600];
const tintColorDark = palette.brand[300];

export default {
  light: {
    text: palette.neutral.foreground,
    background: palette.neutral.background,
    tint: tintColorLight,
    tabIconDefault: palette.neutral.muted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f8fafc',
    background: '#0f172a',
    tint: tintColorDark,
    tabIconDefault: '#64748b',
    tabIconSelected: tintColorDark,
  },
};
