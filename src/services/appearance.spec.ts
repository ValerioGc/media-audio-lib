import { beforeEach, describe, expect, it } from 'vitest';

import { TEXT_SIZE_SCALE, applyDocumentLocale, applyTextSize, applyTheme } from './appearance';

describe('appearance', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('scrive il tema come attributo e come color-scheme', () => {
    applyTheme('dark', root);

    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('sostituisce il tema precedente', () => {
    applyTheme('dark', root);
    applyTheme('light', root);

    expect(root.dataset.theme).toBe('light');
  });

  it('applica la scala tipografica come variabile CSS', () => {
    applyTextSize('large', root);

    expect(root.style.getPropertyValue('--app_font_scale')).toBe(String(TEXT_SIZE_SCALE.large));
  });

  it('usa scale crescenti e distinte per ogni dimensione', () => {
    expect(TEXT_SIZE_SCALE.small).toBeLessThan(TEXT_SIZE_SCALE.medium);
    expect(TEXT_SIZE_SCALE.medium).toBeLessThan(TEXT_SIZE_SCALE.large);
  });

  it('imposta la lingua del documento', () => {
    applyDocumentLocale('en', root);

    expect(root.lang).toBe('en');
  });

  it('usa documentElement come radice predefinita', () => {
    applyTheme('dark');
    applyTextSize('small');
    applyDocumentLocale('it');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('0.875');
    expect(document.documentElement.lang).toBe('it');
  });
});
