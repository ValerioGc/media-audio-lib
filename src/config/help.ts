import type { IconName } from '@/config/icons';

/**
 * Topics of the in-app guide, in reading order. Each one has a title, where to find the
 * feature, the steps to use it and one closing tip, all in the translation files under
 * `help.topics.<id>`.
 *
 * The index of the guide is built from this list: adding a topic here and its strings in
 * the translations is enough for it to appear.
 */
export const HELP_TOPICS = [
  'start',
  'import',
  'organize',
  'views',
  'metadata',
  'files',
  'player',
  'dock',
  'shortcuts',
  'libraries',
  'transfer',
  'appearance',
  'settings',
  'storage',
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

export const HELP_TOPIC_ICONS: Record<HelpTopic, IconName> = {
  start: 'play',
  import: 'add',
  organize: 'search',
  views: 'list',
  metadata: 'edit',
  files: 'verify',
  player: 'play',
  dock: 'tray',
  shortcuts: 'drag',
  libraries: 'switch',
  transfer: 'export',
  appearance: 'grid',
  settings: 'settings',
  storage: 'info',
};
