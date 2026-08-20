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
  it('prefills fields with track values', async () => {
    const track = makeTrack({
      title: 'Track',
      artist: 'Artist',
      album: 'Album',
      year: 1999,
      genre: 'Jazz',
    });
    const { wrapper } = await mountEditor(track);

    expect((fieldAt(wrapper, 0)?.element as HTMLInputElement).value).toBe('Track');
    expect((fieldAt(wrapper, 1)?.element as HTMLInputElement).value).toBe('Artist');
    expect((fieldAt(wrapper, 2)?.element as HTMLInputElement).value).toBe('Album');
    expect((fieldAt(wrapper, 3)?.element as HTMLInputElement).value).toBe('1999');
    expect((wrapper.get('.genre_select_input').element as HTMLInputElement).value).toBe('Jazz');
  });

  it('offers library metadata suggestions while editing', async () => {
    const { wrapper, store } = await mountEditor();
    store.tracks = [
      makeTrack({ artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ artist: 'Artist B', album: 'Album B', genre: 'Rock' }),
    ];
    await flushPromises();

    expect(wrapper.findAll('.metadata_field datalist')[0]?.findAll('option')).toHaveLength(2);
    expect(
      wrapper
        .findAll('.metadata_field datalist')[1]
        ?.findAll('option')
        .map((option) => option.attributes('value')),
    ).toEqual(['Album A', 'Album B']);
    expect(
      wrapper.findAll('.genre_select option').map((option) => option.attributes('value')),
    ).toEqual(['Jazz', 'Rock']);
  });

  it('leaves missing fields empty', async () => {
    const { wrapper } = await mountEditor(
      makeTrack({ artist: null, album: null, year: null, genre: null }),
    );

    expect((fieldAt(wrapper, 1)?.element as HTMLInputElement).value).toBe('');
    expect((fieldAt(wrapper, 2)?.element as HTMLInputElement).value).toBe('');
    expect((fieldAt(wrapper, 3)?.element as HTMLInputElement).value).toBe('');
  });

  it('blocks saving with an empty title', async () => {
    const { wrapper, saveMetadata } = await mountEditor();

    await fieldAt(wrapper, 0)?.setValue('   ');

    expect(wrapper.get('[data-testid="metadata-save"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('vuoto');

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    expect(saveMetadata).not.toHaveBeenCalled();
  });

  it('blocks saving with an implausible year', async () => {
    const { wrapper } = await mountEditor();

    await fieldAt(wrapper, 3)?.setValue('12');

    expect(wrapper.get('[data-testid="metadata-save"]').attributes('disabled')).toBeDefined();
  });

  it('saves edited fields and closes', async () => {
    const track = makeTrack({ title: 'Old', year: 1999 });
    const { wrapper, saveMetadata, saveCover } = await mountEditor(track);

    await fieldAt(wrapper, 0)?.setValue('New title');
    await fieldAt(wrapper, 1)?.setValue('New Artist');
    await fieldAt(wrapper, 3)?.setValue('2001');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledWith(track.id, {
      title: 'New title',
      artist: 'New Artist',
      album: 'Album',
      year: 2001,
      genre: 'Rock',
    });
    expect(saveCover).not.toHaveBeenCalled();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('clears fields left empty', async () => {
    const { wrapper, saveMetadata } = await mountEditor();

    await fieldAt(wrapper, 1)?.setValue('');
    await fieldAt(wrapper, 2)?.setValue('');
    await fieldAt(wrapper, 3)?.setValue('');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ artist: null, album: null, year: null }),
    );
  });

  it('does not touch the cover if the user does not edit it', async () => {
    const { wrapper, saveCover } = await mountEditor();

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveCover).not.toHaveBeenCalled();
  });

  it('saves removal of the existing cover', async () => {
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

  it('does not close if saving fails', async () => {
    const { wrapper, store } = await mountEditor();
    vi.spyOn(store, 'saveMetadata').mockResolvedValue(null);

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('requests close from the Cancel button', async () => {
    const { wrapper } = await mountEditor();

    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
