/** Single place where the glyphs used by the interface live. */
export const ICON_GLYPHS = {
  remove: '✕',
  edit: '✎',
  note: '♪',
  sortAsc: '▲',
  sortDesc: '▼',
  warning: '⚠',
  settings: '⚙',
  expand: '▲',
  collapse: '▼',
  close: '✕',
  play: '▶',
  list: '☰',
  grid: '▦',
  external: '↗',
  minimize: '─',
  maximize: '▢',
  help: '?',
  add: '＋',
  search: '⌕',
} as const;

export type IconName = keyof typeof ICON_GLYPHS;
