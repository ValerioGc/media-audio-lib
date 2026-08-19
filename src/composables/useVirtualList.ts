import { computed, ref, type Ref } from 'vue';

export interface VirtualRange {
  start: number;
  end: number;
  offsetTop: number;
  totalHeight: number;
}

/**
 * Rows to render for the current scroll position. Kept as a pure function so the
 * windowing maths can be tested without a DOM.
 */
export function computeVirtualRange(
  itemCount: number,
  itemHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan = 4,
): VirtualRange {
  const totalHeight = itemCount * itemHeight;

  if (itemCount === 0 || itemHeight <= 0) {
    return { start: 0, end: 0, offsetTop: 0, totalHeight: Math.max(0, totalHeight) };
  }

  const safeScrollTop = Math.min(Math.max(scrollTop, 0), Math.max(totalHeight - viewportHeight, 0));
  const firstVisible = Math.floor(safeScrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 1;

  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(itemCount, firstVisible + visibleCount + overscan);

  return { start, end, offsetTop: start * itemHeight, totalHeight };
}

export interface VirtualListOptions {
  itemCount: Ref<number>;
  /** A ref: the row height changes with the text size setting. */
  itemHeight: Ref<number>;
  overscan?: number;
}

export function useVirtualList({ itemCount, itemHeight, overscan }: VirtualListOptions) {
  const scrollTop = ref(0);
  const viewportHeight = ref(0);

  const range = computed(() =>
    computeVirtualRange(
      itemCount.value,
      itemHeight.value,
      viewportHeight.value,
      scrollTop.value,
      overscan,
    ),
  );

  function onScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollTop.value = target.scrollTop;
    viewportHeight.value = target.clientHeight;
  }

  function measure(element: HTMLElement | null) {
    viewportHeight.value = element?.clientHeight ?? 0;
  }

  return { range, scrollTop, viewportHeight, onScroll, measure };
}
