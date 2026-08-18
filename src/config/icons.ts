/** Single place where the glyphs used by the interface live. */
export const ICON_GLYPHS = {
  remove: '✕',
  note: '♪',
  sortAsc: '▲',
  sortDesc: '▼',
  warning: '⚠',
} as const;

export type IconName = keyof typeof ICON_GLYPHS;
