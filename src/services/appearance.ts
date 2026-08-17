import type { Locale, ResolvedTheme, TextSize } from '@/types/settings';

export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 0.875,
  medium: 1,
  large: 1.125,
};

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function applyTextSize(size: TextSize, root: HTMLElement = document.documentElement) {
  root.style.setProperty('--app_font_scale', String(TEXT_SIZE_SCALE[size]));
}

export function applyDocumentLocale(locale: Locale, root: HTMLElement = document.documentElement) {
  root.lang = locale;
}
