import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import type { TrackView } from '@/types/library';

import PreviewCard from './PreviewCard.vue';

beforeEach(() => {
  resetI18n();
});

function mountCard(track: TrackView = makeTrack(), selected = false) {
  return mount(PreviewCard, { ...withPinia(), props: { track, selected } });
}

describe('PreviewCard', () => {
  it('mostra titolo, autore e album', () => {
    const wrapper = mountCard(makeTrack({ title: 'Brano', artist: 'Autore', album: 'Album' }));

    expect(wrapper.get('.preview_card_title').text()).toBe('Brano');
    expect(wrapper.findAll('.preview_card_meta').map((meta) => meta.text())).toEqual([
      'Autore',
      'Album',
    ]);
  });

  it('usa un trattino per i campi mancanti', () => {
    const wrapper = mountCard(makeTrack({ artist: null, album: null }));

    expect(wrapper.findAll('.preview_card_meta').map((meta) => meta.text())).toEqual(['—', '—']);
  });

  it('include la copertina in formato scheda', () => {
    const wrapper = mountCard();

    expect(wrapper.find('.cover_image_card').exists()).toBe(true);
  });

  it('evidenzia la scheda selezionata', () => {
    const wrapper = mountCard(makeTrack(), true);

    expect(wrapper.classes()).toContain('preview_card_selected');
    expect(wrapper.attributes('aria-selected')).toBe('true');
  });

  it('segnala i file spariti dal disco', () => {
    const wrapper = mountCard(makeTrack({ missing: true }));

    expect(wrapper.get('.preview_card_badge').text()).toContain('File non più presente su disco');
    expect(wrapper.get('.preview_card_edit').attributes('disabled')).toBeDefined();
  });

  it('emette la selezione al click e con Invio', async () => {
    const track = makeTrack();
    const wrapper = mountCard(track);

    await wrapper.trigger('click');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('select')).toEqual([[track.id], [track.id]]);
  });

  it('emette la modifica senza selezionare la scheda', async () => {
    const track = makeTrack();
    const wrapper = mountCard(track);

    await wrapper.get('.preview_card_edit').trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });
});
