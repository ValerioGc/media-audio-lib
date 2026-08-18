import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';

import { computeVirtualRange, useVirtualList } from './useVirtualList';

describe('computeVirtualRange', () => {
  it('non rende nulla per una lista vuota', () => {
    expect(computeVirtualRange(0, 50, 500, 0)).toEqual({
      start: 0,
      end: 0,
      offsetTop: 0,
      totalHeight: 0,
    });
  });

  it('calcola l altezza totale della lista', () => {
    expect(computeVirtualRange(100, 50, 500, 0).totalHeight).toBe(5000);
  });

  it('rende solo la finestra visibile piu il margine', () => {
    const range = computeVirtualRange(1000, 50, 500, 0, 2);

    expect(range.start).toBe(0);
    expect(range.end).toBe(13);
  });

  it('sposta la finestra seguendo lo scroll', () => {
    const range = computeVirtualRange(1000, 50, 500, 2500, 2);

    expect(range.start).toBe(48);
    expect(range.offsetTop).toBe(2400);
    expect(range.end).toBeGreaterThan(50);
  });

  it('non supera la fine della lista', () => {
    const range = computeVirtualRange(20, 50, 500, 100_000);

    expect(range.end).toBe(20);
    expect(range.start).toBeLessThan(20);
  });

  it('ignora uno scroll negativo', () => {
    expect(computeVirtualRange(100, 50, 500, -300).start).toBe(0);
  });

  it('si protegge da un altezza di riga non valida', () => {
    expect(computeVirtualRange(10, 0, 500, 0).end).toBe(0);
  });
});

describe('useVirtualList', () => {
  const Host = defineComponent({
    setup() {
      const itemCount = ref(100);
      return useVirtualList({ itemCount, itemHeight: 50 });
    },
    template: '<div />',
  });

  it('aggiorna la finestra allo scroll', () => {
    const wrapper = mount(Host);
    const element = { scrollTop: 1000, clientHeight: 400 } as HTMLElement;

    wrapper.vm.onScroll({ target: element } as unknown as Event);

    expect(wrapper.vm.scrollTop).toBe(1000);
    expect(wrapper.vm.viewportHeight).toBe(400);
    expect(wrapper.vm.range.start).toBeGreaterThan(0);
  });

  it('misura il contenitore, anche quando manca', () => {
    const wrapper = mount(Host);

    wrapper.vm.measure({ clientHeight: 320 } as HTMLElement);
    expect(wrapper.vm.viewportHeight).toBe(320);

    wrapper.vm.measure(null);
    expect(wrapper.vm.viewportHeight).toBe(0);
  });
});
