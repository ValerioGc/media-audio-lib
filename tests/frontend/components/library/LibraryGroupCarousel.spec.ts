import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import LibraryGroupCarousel, {
  type CarouselGroup,
} from '@/components/library/LibraryGroupCarousel.vue';

beforeEach(() => {
  resetI18n();
});

const groups: CarouselGroup[] = [
  {
    key: 'First Album',
    name: 'First Album',
    meta: '1999',
    coverTrack: makeTrack({ title: 'Blue', hasCover: true }),
    playing: false,
  },
  { key: 'Second Album', name: 'Second Album', meta: null, coverTrack: null, playing: true },
];

function mountCarousel(props: Partial<InstanceType<typeof LibraryGroupCarousel>['$props']> = {}) {
  return mount(LibraryGroupCarousel, {
    ...withPinia(),
    props: {
      title: 'Album',
      groups,
      actionLabel: 'Espandi album',
      actionIcon: 'expand' as const,
      ...props,
    },
  });
}

describe('LibraryGroupCarousel', () => {
  it('shows one card per group, with its name and meta line', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards).toHaveLength(2);
    expect(cards[0]?.text()).toContain('First Album');
    expect(cards[0]?.text()).toContain('1999');
    expect(cards[1]?.text()).toContain('Second Album');
  });

  it('drops the meta line when the group has none', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards[0]?.find('.library_group_carousel_meta').exists()).toBe(true);
    expect(cards[1]?.find('.library_group_carousel_meta').exists()).toBe(false);
  });

  it('marks the group that holds the playing track', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards[1]?.classes()).toContain('library_group_carousel_card_playing');
    expect(cards[1]?.attributes('aria-current')).toBe('true');
    expect(cards[1]?.text()).toContain('In riproduzione');
    expect(cards[0]?.attributes('aria-current')).toBeUndefined();
  });

  it('reports which group was opened, by key', async () => {
    const wrapper = mountCarousel();

    await wrapper.findAll('.library_group_carousel_card')[1]?.trigger('click');

    expect(wrapper.emitted('open')).toEqual([['Second Album']]);
  });

  it('names the command and reports it when pressed', async () => {
    const wrapper = mountCarousel();
    const action = wrapper.get('[data-testid="carousel-action"]');

    expect(action.attributes('aria-label')).toBe('Espandi album');

    await action.trigger('click');

    expect(wrapper.emitted('action')).toHaveLength(1);
  });

  it('shows the cover only when the group has one', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards[0]?.find('.library_group_carousel_cover').exists()).toBe(true);
    expect(cards[1]?.find('.library_group_carousel_cover').exists()).toBe(false);
  });

  it('takes roomier cards when asked', () => {
    expect(mountCarousel().get('.library_group_carousel').classes()).not.toContain(
      'library_group_carousel_large',
    );
    expect(mountCarousel({ large: true }).get('.library_group_carousel').classes()).toContain(
      'library_group_carousel_large',
    );
  });
});
