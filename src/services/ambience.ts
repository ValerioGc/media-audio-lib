import { colorChannels, rotateHue } from '@/services/accent';
import { DEFAULT_ACCENT_COLOR, type ResolvedTheme } from '@/types/settings';

/**
 * How far the companion colour sits from the accent on the colour wheel. Far enough for
 * the two orbs to read as different colours, close enough to stay in the same family.
 */
export const AMBIENT_HUE_SHIFT = 140;

interface Orb {
  /** Size and position of the blurred blob, as a CSS radial-gradient prelude. */
  shape: string;
  /** Which of the two colours it is painted with. */
  color: 'accent' | 'secondary';
  /** Opacity at the centre, per mille of the theme strength. */
  strength: number;
}

/**
 * Three overlapping blobs: the accent enters from the top left, the companion colour
 * answers from the top right, and a third one lifts the bottom of the window so the
 * background does not go flat under the player.
 */
const ORBS: readonly Orb[] = [
  { shape: '68rem 46rem at 6% -12%', color: 'accent', strength: 1 },
  { shape: '52rem 38rem at 98% 4%', color: 'secondary', strength: 0.8 },
  { shape: '58rem 44rem at 62% 112%', color: 'accent', strength: 0.55 },
];

/**
 * Peak opacity of the strongest orb. The background has to stay behind the interface: on
 * dark surfaces colour reads more easily, so it is dialled back there.
 */
const THEME_STRENGTH: Record<ResolvedTheme, number> = { light: 0.2, dark: 0.16 };

export interface Ambience {
  /** The value of `background-image`, from the topmost layer to the bottom one. */
  layers: string;
  /** The companion colour, as `#rrggbb`. */
  secondary: string;
}

function orbLayer(orb: Orb, channels: string, strength: number): string {
  const peak = Math.round(orb.strength * strength * 100);

  return `radial-gradient(${orb.shape}, rgb(${channels} / ${peak}%), transparent 70%)`;
}

/**
 * Builds the app background from the accent alone: the orbs and the wash under them all
 * follow the colour chosen in the settings, so the window keeps one identity.
 */
export function ambience(accentColor: string, theme: ResolvedTheme): Ambience {
  const secondary = rotateHue(accentColor, AMBIENT_HUE_SHIFT, DEFAULT_ACCENT_COLOR);
  const channels = {
    accent: colorChannels(accentColor, DEFAULT_ACCENT_COLOR),
    secondary: colorChannels(secondary, DEFAULT_ACCENT_COLOR),
  };
  const strength = THEME_STRENGTH[theme];
  const washPeak = Math.round(strength * 45);

  return {
    secondary,
    layers: [
      ...ORBS.map((orb) => orbLayer(orb, channels[orb.color], strength)),
      // A diagonal wash between the two colours keeps the empty middle from going grey.
      `linear-gradient(140deg, rgb(${channels.accent} / ${washPeak}%), transparent 46%, rgb(${channels.secondary} / ${washPeak}%))`,
    ].join(', '),
  };
}
