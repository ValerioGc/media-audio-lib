import type { ResolvedTheme } from '@/types/settings';

/** The four accent tokens the interface reads, derived from a single chosen colour. */
export interface AccentPalette {
  accent: string;
  accentHover: string;
  accentSoft: string;
  onAccent: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Matches `--color_bg` of the dark theme: the surface the accent is read against. */
const DARK_SURFACE: Rgb = { r: 31, g: 31, b: 31 };

/** The accent also carries text (links, active sorting, badges), so it targets AA. */
const MIN_ACCENT_CONTRAST = 4.5;

const HEX_PATTERN = /^#?([\da-f]{3}|[\da-f]{6})$/i;

function expandShorthand(hex: string): string {
  return hex.length === 3
    ? hex
        .split('')
        .map((channel) => channel + channel)
        .join('')
    : hex;
}

function parseHex(value: string): Rgb | null {
  const match = HEX_PATTERN.exec(value.trim());

  if (match === null) {
    return null;
  }

  const hex = expandShorthand(match[1]!);

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Mixes `base` towards `target`, where `ratio` is how much of `target` is used. */
function mix(base: Rgb, target: Rgb, ratio: number): Rgb {
  const amount = Math.min(1, Math.max(0, ratio));

  return {
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  };
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, between 0 (black) and 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, between 1 (identical) and 21 (black on white). */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pushes the chosen colour towards white on dark backgrounds, and towards black on light
 * ones, until it is readable. A colour picked for one theme stays usable in the other.
 */
function readableOnSurface(color: Rgb, theme: ResolvedTheme): Rgb {
  const surface = theme === 'dark' ? DARK_SURFACE : WHITE;
  const towards = theme === 'dark' ? WHITE : BLACK;

  for (let ratio = 0; ratio < 1; ratio += 0.04) {
    const candidate = mix(color, towards, ratio);

    if (contrastRatio(candidate, surface) >= MIN_ACCENT_CONTRAST) {
      return candidate;
    }
  }

  return towards;
}

/** White or a very dark tint of the accent, whichever reads better on top of it. */
function foregroundFor(accent: Rgb): Rgb {
  const shade = mix(accent, BLACK, 0.85);

  return contrastRatio(accent, WHITE) >= contrastRatio(accent, shade) ? WHITE : shade;
}

/**
 * Accepts a colour written by the user or read from disk and returns it as `#rrggbb`,
 * or `null` when it is not a colour at all.
 */
export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = parseHex(value);

  return parsed === null ? null : toHex(parsed);
}

/** Builds the accent tokens for one theme. Falls back to `fallback` on an invalid colour. */
export function accentPalette(
  color: string,
  theme: ResolvedTheme,
  fallback = '#0067c0',
): AccentPalette {
  const parsed = parseHex(color) ?? parseHex(fallback) ?? { r: 0, g: 103, b: 192 };
  const accent = readableOnSurface(parsed, theme);
  const surface = theme === 'dark' ? DARK_SURFACE : WHITE;

  return {
    accent: toHex(accent),
    accentHover: toHex(mix(accent, theme === 'dark' ? WHITE : BLACK, 0.18)),
    accentSoft: toHex(mix(accent, surface, theme === 'dark' ? 0.85 : 0.9)),
    onAccent: toHex(foregroundFor(accent)),
  };
}
