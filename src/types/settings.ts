export const LOCALES = ['it', 'en', 'fr', 'es', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const TEXT_SIZES = ['xsmall', 'small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = 'light' | 'dark';

/** Accent colours offered as swatches. The first one is the default of the interface. */
export const ACCENT_PRESETS = [
  '#0067c0',
  '#0099bc',
  '#038387',
  '#107c10',
  '#498205',
  '#986f0b',
  '#ca5010',
  '#c42b1c',
  '#e3008c',
  '#c239b3',
  '#8764b8',
  '#4f6bed',
] as const;

export const DEFAULT_ACCENT_COLOR = ACCENT_PRESETS[0];

/** How the ambient background is drawn. */
export const AMBIENT_STYLES = ['orbs', 'linear', 'spotlight'] as const;
export type AmbientStyle = (typeof AMBIENT_STYLES)[number];

/** Where the background starts from: the corner or the side the accent comes in on. */
export const AMBIENT_DIRECTIONS = [
  'topLeft',
  'top',
  'topRight',
  'left',
  'right',
  'bottomLeft',
  'bottom',
  'bottomRight',
] as const;
export type AmbientDirection = (typeof AMBIENT_DIRECTIONS)[number];

export const VIEW_MODES = ['table', 'preview'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const TABLE_COLUMN_KEYS = [
  'cover',
  'title',
  'artist',
  'album',
  'year',
  'genre',
  'format',
  'path',
  'duration',
] as const;
export type TableColumnKey = (typeof TABLE_COLUMN_KEYS)[number];

export const MANDATORY_TABLE_COLUMN_KEYS = ['cover', 'title', 'duration'] as const;
export const LOCKED_LEADING_TABLE_COLUMN_KEYS = ['cover', 'title'] as const;

export interface TableColumnSetting {
  key: TableColumnKey;
  visible: boolean;
  width: number;
}

export const TABLE_COLUMN_WIDTHS: Record<
  TableColumnKey,
  { min: number; max: number; default: number }
> = {
  cover: { min: 44, max: 72, default: 48 },
  title: { min: 180, max: 520, default: 260 },
  artist: { min: 120, max: 360, default: 180 },
  album: { min: 120, max: 360, default: 180 },
  year: { min: 64, max: 120, default: 72 },
  genre: { min: 110, max: 260, default: 140 },
  format: { min: 72, max: 160, default: 90 },
  path: { min: 180, max: 560, default: 300 },
  duration: { min: 76, max: 140, default: 90 },
};

export const DEFAULT_TABLE_COLUMNS: TableColumnSetting[] = TABLE_COLUMN_KEYS.map((key) => ({
  key,
  visible: !['format', 'path'].includes(key),
  width: TABLE_COLUMN_WIDTHS[key].default,
}));

export const MAX_PLAYER_BLUR = 28;
export const MIN_COVER_GRADIENT_INTENSITY = 40;
export const MAX_COVER_GRADIENT_INTENSITY = 200;

export interface AppSettings {
  locale: Locale;
  textSize: TextSize;
  theme: ThemeChoice;
  accentColor: string;
  ambientBackgroundEnabled: boolean;
  ambientStyle: AmbientStyle;
  ambientDirection: AmbientDirection;
  glassSurfacesEnabled: boolean;
  viewMode: ViewMode;
  mainLibraryId: string | null;
  coverGradientEnabled: boolean;
  coverGradientIntensity: number;
  playerTransparency: number;
  playerBlur: number;
  defaultPlayerBannerDismissed: boolean;
  tableColumns: TableColumnSetting[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'it',
  textSize: 'medium',
  theme: 'system',
  accentColor: DEFAULT_ACCENT_COLOR,
  ambientBackgroundEnabled: true,
  ambientStyle: 'orbs',
  ambientDirection: 'topLeft',
  glassSurfacesEnabled: true,
  viewMode: 'preview',
  mainLibraryId: null,
  coverGradientEnabled: true,
  coverGradientIntensity: 100,
  playerTransparency: 12,
  playerBlur: 12,
  defaultPlayerBannerDismissed: false,
  tableColumns: DEFAULT_TABLE_COLUMNS,
};
