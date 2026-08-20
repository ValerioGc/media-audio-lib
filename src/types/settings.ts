export const LOCALES = ['it', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = 'light' | 'dark';

export const VIEW_MODES = ['table', 'preview'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export interface AppSettings {
  locale: Locale;
  textSize: TextSize;
  theme: ThemeChoice;
  viewMode: ViewMode;
  coverGradientEnabled: boolean;
  playerTransparency: number;
  playerBlur: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'it',
  textSize: 'medium',
  theme: 'system',
  viewMode: 'table',
  coverGradientEnabled: true,
  playerTransparency: 12,
  playerBlur: 12,
};
