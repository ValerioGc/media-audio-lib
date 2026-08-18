import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';

import LibraryRow from './LibraryRow.vue';

beforeEach(() => {
  resetI18n();
});

function mountRow(track = makeTrack(), selected = false) {
  return mount(LibraryRow, { ...withPinia(), props: { track, selected } });
}

describe('LibraryRow', () => {
  it('mostra i campi del brano nelle colonne', () => {
    const track = makeTrack({ title: 'Brano', album: 'Album', year: 1999, genre: 'Jazz' });

    const cells = mountRow(track).findAll('[role="cell"]');

    expect(cells[1]?.text()).toContain('Brano');
    expect(cells[2]?.text()).toBe('Album');
    expect(cells[3]?.text()).toBe('1999');
    expect(cells[4]?.text()).toBe('Jazz');
  });

  it('mostra un trattino per i campi mancanti', () => {
    const cells = mountRow(makeTrack({ album: null, year: null, genre: null })).findAll(
      '[role="cell"]',
    );

    expect(cells[2]?.text()).toBe('—');
    expect(cells[3]?.text()).toBe('—');
    expect(cells[4]?.text()).toBe('—');
  });

  it('formatta la durata', () => {
    const wrapper = mountRow(makeTrack({ durationMs: 185_000 }));

    expect(wrapper.get('.library_row_duration').text()).toBe('3:05');
  });

  it('segnala i file spariti dal disco', () => {
    const wrapper = mountRow(makeTrack({ missing: true }));

    expect(wrapper.classes()).toContain('library_row_missing');
    expect(wrapper.get('.library_row_badge').text()).toContain('File non più presente su disco');
    expect(wrapper.find('.library_row_badge .app_icon_warning').exists()).toBe(true);
  });

  it('evidenzia la riga selezionata', () => {
    const wrapper = mountRow(makeTrack(), true);

    expect(wrapper.classes()).toContain('library_row_selected');
    expect(wrapper.attributes('aria-selected')).toBe('true');
  });

  it('emette la selezione al click e con Invio', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.trigger('click');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('select')).toEqual([[track.id], [track.id]]);
  });

  it('emette la rimozione senza selezionare la riga', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.findAll('button')[1]?.trigger('click');

    expect(wrapper.emitted('remove')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emette la richiesta di modifica dei metadati', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.findAll('button')[0]?.trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('non permette di modificare un file mancante', () => {
    const wrapper = mountRow(makeTrack({ missing: true }));

    expect(wrapper.findAll('button')[0]?.attributes('disabled')).toBeDefined();
  });

  it('descrive i pulsanti agli screen reader', () => {
    const wrapper = mountRow(makeTrack({ title: 'Brano' }));
    const buttons = wrapper.findAll('button');

    expect(buttons[0]?.attributes('aria-label')).toBe('Modifica i metadati di Brano');
    expect(buttons[1]?.attributes('aria-label')).toBe('Rimuovi Brano dalla libreria');
  });
});
