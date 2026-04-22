/**
 * IndLokal Pulse mark — mobile.
 *
 * Mirrors `apps/web/src/components/Logo.tsx`. Uses the bundled PNG asset so
 * we don't need to pull in `react-native-svg` just for the brand mark.
 *
 * See `docs/brand/DESIGN_GUIDELINES.md` §1 for clear-space and minimum-size
 * rules. Keep `size >= 24` per the guidelines.
 */
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const PULSE_MARK = require('../assets/images/icon.png');

export interface LogoMarkProps {
  /** Pixel width and height. Defaults to 40 (matches typical header use). */
  size?: number;
  /** Override container styling — e.g. shadow, margin. */
  style?: StyleProp<ImageStyle>;
}

export function LogoMark({ size = 40, style }: LogoMarkProps) {
  return (
    <Image
      source={PULSE_MARK}
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.max(8, size * 0.22), // matches web `rounded-xl` for the tile
        },
        style,
      ]}
      accessibilityLabel="IndLokal"
      accessibilityRole="image"
      resizeMode="contain"
    />
  );
}
