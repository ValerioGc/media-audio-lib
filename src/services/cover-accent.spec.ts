import { describe, expect, it } from 'vitest';

import { coverAccentFromRgb } from './cover-accent';

describe('coverAccentFromRgb', () => {
  it('costruisce i gradienti dal colore medio', () => {
    const accent = coverAccentFromRgb(12.2, 99.8, 260);

    expect(accent.rgb).toBe('12 100 255');
    expect(accent.surfaceGradient).toContain('rgb(12 100 255 / 28%)');
    expect(accent.rowGradient).toContain('rgb(12 100 255 / 26%)');
  });
});
