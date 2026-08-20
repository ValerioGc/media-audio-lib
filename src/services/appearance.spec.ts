import { beforeEach, describe, expect, it } from 'vitest';

import { TEXT_SIZE_SCALE, applyDocumentLocale, applyTextSize, applyTheme } from './appearance';

describe('appearance', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('writes the theme as an attribute and color-scheme', () => {
    applyTheme('dark', root);

    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('replaces the previous theme', () => {
    applyTheme('dark', root);
    applyTheme('light', root);

    expect(root.dataset.theme).toBe('light');
  });

  it('applies the text scale as a CSS variable', () => {
    applyTextSize('large', root);

    expect(root.style.getPropertyValue('--app_font_scale')).toBe(String(TEXT_SIZE_SCALE.large));
  });

  it('uses increasing and distinct scales for each size', () => {
    expect(TEXT_SIZE_SCALE.small).toBeLessThan(TEXT_SIZE_SCALE.medium);
    expect(TEXT_SIZE_SCALE.medium).toBeLessThan(TEXT_SIZE_SCALE.large);
  });

  it('sets the document language', () => {
    applyDocumentLocale('en', root);

    expect(root.lang).toBe('en');
  });

  it('uses documentElement as the default root', () => {
    applyTheme('dark');
    applyTextSize('small');
    applyDocumentLocale('it');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('0.875');
    expect(document.documentElement.lang).toBe('it');
  });
});
