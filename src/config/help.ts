import type { IconName } from '@/config/icons';

/**
 * Topics of the in-app guide. Each one has a title, where to find the feature and the
 * steps to use it, all in the translation files under `help.topics.<id>`.
 *
 * Import/export gets its own topic once phase 7 ships: the guide only describes what the
 * app can actually do today.
 */
export const HELP_TOPICS = [
  'import',
  'organize',
  'views',
  'metadata',
  'player',
  'settings',
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

export const HELP_TOPIC_ICONS: Record<HelpTopic, IconName> = {
  import: 'add',
  organize: 'search',
  views: 'grid',
  metadata: 'edit',
  player: 'play',
  settings: 'settings',
};
