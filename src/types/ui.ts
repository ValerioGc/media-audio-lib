export interface SelectOption {
  value: string;
  label: string;
  /**
   * URL of a small image shown before the label, such as a flag.
   *
   * Only the option group draws it: a native `<select>` cannot render anything but text
   * inside its options, so `AppSelect` ignores it.
   */
  icon?: string;
}
