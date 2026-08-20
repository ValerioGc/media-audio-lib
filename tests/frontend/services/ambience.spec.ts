import { describe, expect, it } from 'vitest';

import { rotateHue } from '@/services/accent';
import { AMBIENT_HUE_SHIFT, ambience } from '@/services/ambience';

/** Every `nn%` alpha the layers are built from, in the order they appear. */
function alphas(layers: string): number[] {
  return [...layers.matchAll(/\/ (\d+)%/g)].map((match) => Number(match[1]));
}

describe('ambience', () => {
  it('builds the three orbs plus the wash under them', () => {
    const { layers } = ambience('#0067c0', 'light');

    expect([...layers.matchAll(/radial-gradient/g)]).toHaveLength(3);
    expect([...layers.matchAll(/linear-gradient/g)]).toHaveLength(1);
  });

  it('derives the companion colour from the accent', () => {
    const { secondary } = ambience('#0067c0', 'light');

    expect(secondary).toBe(rotateHue('#0067c0', AMBIENT_HUE_SHIFT));
    expect(secondary).not.toBe('#0067c0');
  });

  it('follows the accent: a different colour gives a different background', () => {
    expect(ambience('#0067c0', 'light').layers).not.toBe(ambience('#e3008c', 'light').layers);
  });

  it('paints both colours into the layers', () => {
    const { layers, secondary } = ambience('#0067c0', 'light');

    expect(layers).toContain('0 103 192');
    expect(layers).toContain(
      [
        Number.parseInt(secondary.slice(1, 3), 16),
        Number.parseInt(secondary.slice(3, 5), 16),
        Number.parseInt(secondary.slice(5, 7), 16),
      ].join(' '),
    );
  });

  it('stays discreet: nothing is painted above a fifth of opacity', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const alpha of alphas(ambience('#0067c0', theme).layers)) {
        expect(alpha).toBeLessThanOrEqual(20);
      }
    }
  });

  it('holds back on the dark theme, where colour reads more easily', () => {
    const light = Math.max(...alphas(ambience('#0067c0', 'light').layers));
    const dark = Math.max(...alphas(ambience('#0067c0', 'dark').layers));

    expect(dark).toBeLessThan(light);
  });

  it('falls back to the built-in blue on a colour it cannot read', () => {
    expect(ambience('non un colore', 'light').layers).toBe(ambience('#0067c0', 'light').layers);
  });
});

describe('rotateHue', () => {
  it('turns the colour without losing it', () => {
    expect(rotateHue('#0067c0', 140)).toMatch(/^#[\da-f]{6}$/);
  });

  it('comes back to the start after a full turn', () => {
    expect(rotateHue('#0067c0', 360)).toBe('#0067c0');
  });

  it('leaves a grey alone: it has no hue to turn', () => {
    expect(rotateHue('#808080', 140)).toBe('#808080');
  });

  it('turns each of the three primaries into the next one', () => {
    expect(rotateHue('#ff0000', 120)).toBe('#00ff00');
    expect(rotateHue('#00ff00', 120)).toBe('#0000ff');
    expect(rotateHue('#0000ff', 120)).toBe('#ff0000');
  });

  it('accepts a negative turn', () => {
    expect(rotateHue('#ff0000', -120)).toBe('#0000ff');
  });

  it('falls back when the colour is unreadable', () => {
    expect(rotateHue('nope', 140, '#ff0000')).toBe(rotateHue('#ff0000', 140));
  });
});
