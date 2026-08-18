import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import type { TrackView } from '@/types/library';

import MetadataEditor from './MetadataEditor.vue';

beforeEach(() => {
  resetI18n();
});

async function mountEditor(track: TrackView = makeTrack()) {
  const options = withPinia();
  const store = useLibraryStore();
  vi.spyOn(store, 'loadCover').mockResolvedValue(null);
  const saveMetadata = vi.spyOn(store, 'saveMetadata').mockResolvedValue(track);
  const saveCover = vi.spyOn(store, 'saveCover').mockResolvedValue(track);

  const wrapper = mount(MetadataEditor, { ...options, props: { track } });
  await flushPromises();

  return { wrapper, store, saveMetadata, saveCover };
}

function fieldAt(wrapper: Awaited<ReturnType<typeof mountEditor>>['wrapper'], index: number) {
  return wrapper.findAll('.metadata_field_input')[index];
}

describe('MetadataEditor', () => {
  it('precompila i campi con i valori del brano', async () => {
    const track = makeTrack({ title: 'Brano', album: 'Album', year: 1999, genre: 'Jazz' });
    const { wrapper } = await mountEditor(track);

    expect((fieldAt(wrapper, 0)?.element as HTMLInputElement).value).toBe('Brano');
    expect((fieldAt(wrapper, 1)?.element as HTMLInputElement).value).toBe('Album');
    expect((fieldAt(wrapper, 2)?.element as HTMLInputElement).value).toBe('1999');
    expect((wrapper.get('.genre_select_input').element as HTMLInputElement).value).toBe('Jazz');
  });

  it('lascia vuoti i campi assenti', async () => {
    const { wrapper } = await mountEditor(makeTrack({ album: null, year: null, genre: null }));

    expect((fieldAt(wrapper, 1)?.element as HTMLInputElement).value).toBe('');
    expect((fieldAt(wrapper, 2)?.element as HTMLInputElement).value).toBe('');
  });

  it('blocca il salvataggio con un titolo vuoto', async () => {
    const { wrapper, saveMetadata } = await mountEditor();

    await fieldAt(wrapper, 0)?.setValue('   ');

    expect(wrapper.get('[data-testid="metadata-save"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('vuoto');

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    expect(saveMetadata).not.toHaveBeenCalled();
  });

  it('blocca il salvataggio con un anno non plausibile', async () => {
    const { wrapper } = await mountEditor();

    await fieldAt(wrapper, 2)?.setValue('12');

    expect(wrapper.get('[data-testid="metadata-save"]').attributes('disabled')).toBeDefined();
  });

  it('salva i campi modificati e chiude', async () => {
    const track = makeTrack({ title: 'Vecchio', year: 1999 });
    const { wrapper, saveMetadata, saveCover } = await mountEditor(track);

    await fieldAt(wrapper, 0)?.setValue('Nuovo titolo');
    await fieldAt(wrapper, 2)?.setValue('2001');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledWith(track.id, {
      title: 'Nuovo titolo',
      album: 'Album',
      year: 2001,
      genre: 'Rock',
    });
    expect(saveCover).not.toHaveBeenCalled();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('azzera i campi lasciati vuoti', async () => {
    const { wrapper, saveMetadata } = await mountEditor();

    await fieldAt(wrapper, 1)?.setValue('');
    await fieldAt(wrapper, 2)?.setValue('');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ album: null, year: null }),
    );
  });

  it('non tocca la copertina se l utente non la modifica', async () => {
    const { wrapper, saveCover } = await mountEditor();

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveCover).not.toHaveBeenCalled();
  });

  it('salva la rimozione della copertina esistente', async () => {
    const track = makeTrack({ hasCover: true });
    const options = withPinia();
    const store = useLibraryStore();
    vi.spyOn(store, 'loadCover').mockResolvedValue('data:image/png;base64,AAA');
    vi.spyOn(store, 'saveMetadata').mockResolvedValue(track);
    const saveCover = vi.spyOn(store, 'saveCover').mockResolvedValue(track);

    const wrapper = mount(MetadataEditor, { ...options, props: { track } });
    await flushPromises();

    await wrapper.findAll('.cover_picker_actions button')[1]?.trigger('click');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveCover).toHaveBeenCalledWith(track.id, null);
  });

  it('non chiude se il salvataggio fallisce', async () => {
    const { wrapper, store } = await mountEditor();
    vi.spyOn(store, 'saveMetadata').mockResolvedValue(null);

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('chiede la chiusura dal pulsante Annulla', async () => {
    const { wrapper } = await mountEditor();

    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
