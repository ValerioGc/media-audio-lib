import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import type { TrackView } from '@/types/library';

import PreviewCard from '@/components/library/PreviewCard.vue';

beforeEach(() => {
  resetI18n();
});

function mountCard(track: TrackView = makeTrack(), selected = false, playing = false) {
  return mount(PreviewCard, { ...withPinia(), props: { track, selected, playing } });
}

describe('PreviewCard', () => {
  it('shows title, artist, and album', () => {
    const wrapper = mountCard(makeTrack({ title: 'Track', artist: 'Artist', album: 'Album' }));

    expect(wrapper.get('.preview_card_title').text()).toBe('Track');
    expect(wrapper.findAll('.preview_card_meta').map((meta) => meta.text())).toEqual([
      'Artist',
      'Album',
    ]);
  });

  it('uses a dash for missing fields', () => {
    const wrapper = mountCard(makeTrack({ artist: null, album: null }));

    expect(wrapper.findAll('.preview_card_meta').map((meta) => meta.text())).toEqual(['—', '—']);
  });

  it('includes the cover in card format', () => {
    const wrapper = mountCard();

    expect(wrapper.find('.cover_image_card').exists()).toBe(true);
  });

  it('highlights the selected card', () => {
    const wrapper = mountCard(makeTrack(), true);

    expect(wrapper.classes()).toContain('preview_card_selected');
    expect(wrapper.attributes('aria-selected')).toBe('true');
  });

  it('marks the playing card', () => {
    const wrapper = mountCard(makeTrack(), false, true);

    expect(wrapper.classes()).toContain('preview_card_playing');
    expect(wrapper.attributes('aria-current')).toBe('true');
    const bubble = wrapper.get('[data-testid="playing-bubble"]');

    // The state reads as a notification on the cover, not as a line of the body.
    expect(bubble.attributes('title')).toBe('In riproduzione');
    expect(bubble.get('.app_icon').classes()).toContain('app_icon_play');
    expect(bubble.get('.app_icon').attributes('aria-label')).toBe('In riproduzione');
    expect(wrapper.get('.preview_card_body').text()).not.toContain('In riproduzione');
  });

  it('takes focus as an option of the grid, not as a document section', () => {
    const wrapper = mountCard();

    expect(wrapper.element.tagName).toBe('DIV');
    expect(wrapper.attributes('role')).toBe('option');
    expect(wrapper.attributes('tabindex')).toBe('0');
  });

  it('reports files missing from disk', () => {
    const wrapper = mountCard(makeTrack({ missing: true }));

    expect(wrapper.get('.preview_card_badge').text()).toContain('File non più presente su disco');
  });

  it('emits selection on click and Enter', async () => {
    const track = makeTrack();
    const wrapper = mountCard(track);

    await wrapper.trigger('click');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('select')).toEqual([
      [{ id: track.id, additive: false, range: false }],
      [{ id: track.id, additive: false, range: false }],
    ]);
  });

  it('offers the same actions as list view from the menu', async () => {
    const wrapper = mountCard(makeTrack({ title: 'Track' }));

    await wrapper.get('.app_menu_trigger').trigger('click');

    expect(
      wrapper.findAll('.app_menu_item').map((item) => item.get('.app_menu_item_label').text()),
    ).toEqual(['Modifica', 'Verifica', 'Elimina']);
  });

  it('emits edit, verify, and remove without selecting the card', async () => {
    const track = makeTrack();
    const wrapper = mountCard(track);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[0]?.trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[2]?.trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('verify')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('does not allow editing a file missing from disk', async () => {
    const wrapper = mountCard(makeTrack({ missing: true }));

    await wrapper.get('.app_menu_trigger').trigger('click');

    expect(wrapper.findAll('.app_menu_item')[0]?.attributes('disabled')).toBeDefined();
  });
});
