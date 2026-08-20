import { afterEach, describe, expect, it } from 'vitest';

import { LIBRARY_ROW_HEIGHT_REM, remToPixels } from '@/config/layout';

afterEach(() => {
  document.documentElement.style.removeProperty('font-size');
});

describe('remToPixels', () => {
  it('converts using the current text size', () => {
    document.documentElement.style.fontSize = '16px';

    expect(remToPixels(LIBRARY_ROW_HEIGHT_REM)).toBe(56);
  });

  it('follows text enlargement', () => {
    document.documentElement.style.fontSize = '20px';

    expect(remToPixels(LIBRARY_ROW_HEIGHT_REM)).toBe(70);
  });

  it('falls back to 16px when the value is unreadable', () => {
    document.documentElement.style.fontSize = 'inherit';

    expect(remToPixels(2)).toBe(32);
  });
});
