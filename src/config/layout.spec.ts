import { afterEach, describe, expect, it } from 'vitest';

import { LIBRARY_ROW_HEIGHT_REM, remToPixels } from './layout';

afterEach(() => {
  document.documentElement.style.removeProperty('font-size');
});

describe('remToPixels', () => {
  it('converte usando la dimensione del testo corrente', () => {
    document.documentElement.style.fontSize = '16px';

    expect(remToPixels(LIBRARY_ROW_HEIGHT_REM)).toBe(56);
  });

  it('segue l ingrandimento del testo', () => {
    document.documentElement.style.fontSize = '20px';

    expect(remToPixels(LIBRARY_ROW_HEIGHT_REM)).toBe(70);
  });

  it('ripiega su 16px quando la misura non e leggibile', () => {
    document.documentElement.style.fontSize = 'inherit';

    expect(remToPixels(2)).toBe(32);
  });
});
