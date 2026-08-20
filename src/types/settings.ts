export const LOCALES = ['it', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = 'light' | 'dark';

export const VIEW_MODES = ['table', 'preview'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const MAX_PLAYER_BLUR = 28;
export const MIN_COVER_GRADIENT_INTENSITY = 40;
export const MAX_COVER_GRADIENT_INTENSITY = 200;

export interface AppSettings {
  locale: Locale;
  textSize: TextSize;
  theme: ThemeChoice;
  viewMode: ViewMode;
  mainLibraryId: string | null;
  coverGradientEnabled: boolean;
  coverGradientIntensity: number;
  playerTransparency: number;
  playerBlur: number;
  defaultPlayerBannerDismissed: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'it',
  textSize: 'medium',
  theme: 'system',
  viewMode: 'preview',
  mainLibraryId: null,
  coverGradientEnabled: true,
  coverGradientIntensity: 100,
  playerTransparency: 12,
  playerBlur: 12,
  defaultPlayerBannerDismissed: false,
};
