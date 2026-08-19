import type { IconName } from '@/config/icons';

/** One entry of a dropdown menu, shared by the row actions and the library options. */
export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Longer text announced to screen readers when the short label is not enough. */
  description?: string;
  disabled?: boolean;
  danger?: boolean;
}
