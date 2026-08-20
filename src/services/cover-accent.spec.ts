import { describe, expect, it } from 'vitest';

import { coverAccentFromRgb } from './cover-accent';

describe('coverAccentFromRgb', () => {
  it('costruisce i gradienti dal colore medio', () => {
    const accent = coverAccentFromRgb(12.2, 99.8, 260);

    expect(accent.rgb).toBe('20 108 255');
    expect(accent.surfaceGradient).toContain('rgb(20 108 255 / 58%)');
    expect(accent.rowGradient).toContain('rgb(20 108 255 / 44%)');
  });
});
