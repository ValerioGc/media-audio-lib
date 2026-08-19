import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../tests/support/mount';
import { makeTrack, makeTracks } from '../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';

import LibraryView from './LibraryView.vue';

const drop = vi.hoisted(() => ({ onDrop: null as ((paths: string[]) => void) | null }));

vi.mock('@/composables/useFileDrop', async () => {
  const { ref: reactiveRef } = await import('vue');

  return {
    useFileDrop: (onDrop: (paths: string[]) => void) => {
      drop.onDrop = onDrop;
      return { isDraggingOver: reactiveRef(false), handle: () => {} };
    },
  };
});

beforeEach(() => {
  resetI18n();
});

async function mountView() {
  const options = withPinia();
  const store = useLibraryStore();
  const load = vi.spyOn(store, 'load').mockResolvedValue();

  const wrapper = mount(LibraryView, options);
  await flushPromises();

  return { wrapper, store, load };
}

describe('LibraryView', () => {
  it('carica la libreria all apertura', async () => {
    const { load } = await mountView();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('mostra lo stato vuoto senza brani', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('La libreria è vuota');
    expect(wrapper.find('.library_table').exists()).toBe(false);
  });

  it('mostra la tabella quando ci sono brani', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    await flushPromises();

    expect(wrapper.findAll('.library_row')).toHaveLength(2);
  });

  it('usa il nome della libreria come titolo quando disponibile', async () => {
    const { wrapper, store } = await mountView();
    store.libraryName = 'Archivio jazz';
    await flushPromises();

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');
  });

  it('mostra lo stato senza risultati quando il filtro non trova nulla', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    store.setQuery('inesistente');
    await flushPromises();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun risultato');
  });

  it('mostra il messaggio di errore dello store', async () => {
    const { wrapper, store } = await mountView();
    store.errorKey = 'shellUnavailable';
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('applicazione desktop');
  });

  it('mostra e chiude l esito di un importazione', async () => {
    const { wrapper, store } = await mountView();
    store.lastReport = { added: [makeTrack()], duplicates: [], failed: [] };
    await flushPromises();

    expect(wrapper.find('[data-testid="import-report"]').exists()).toBe(true);

    await wrapper.get('[data-testid="import-report"] button').trigger('click');
    expect(store.lastReport).toBeNull();
  });

  it('mostra e chiude l esito dell import libreria', async () => {
    const { wrapper, store } = await mountView();
    store.lastLibraryImport = { added: 2, updated: 1, skipped: 0, missing: [], total: 3 };
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toContain('3 brani letti');

    await wrapper.get('[role="status"] button').trigger('click');
    expect(store.lastLibraryImport).toBeNull();
  });

  it('chiede conferma prima di rimuovere un brano', async () => {
    const { wrapper, store } = await mountView();
    const track = makeTrack();
    store.tracks = [track];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[2]?.trigger('click');
    expect(wrapper.get('[role="dialog"]').text()).toContain(track.title);
    expect(remove).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="confirm-remove"]').trigger('click');
    await flushPromises();

    expect(remove).toHaveBeenCalledWith(track.id);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('annulla la rimozione senza toccare la libreria', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [makeTrack()];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[2]?.trigger('click');
    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('importa i file trascinati sulla finestra', async () => {
    const { store } = await mountView();
    const addPaths = vi.spyOn(store, 'addPaths').mockResolvedValue(null);

    drop.onDrop?.(['C:/musica/brano.mp3']);

    expect(addPaths).toHaveBeenCalledWith(['C:/musica/brano.mp3']);
  });

  it('apre l editor dei metadati dalla riga', async () => {
    const { wrapper, store } = await mountView();
    const track = makeTrack();
    store.tracks = [track];
    vi.spyOn(store, 'loadCover').mockResolvedValue(null);
    await flushPromises();

    expect(wrapper.find('[data-testid="metadata-editor"]').exists()).toBe(false);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[0]?.trigger('click');
    await flushPromises();

    expect(store.editingId).toBe(track.id);
    expect(wrapper.find('[data-testid="metadata-editor"]').exists()).toBe(true);
  });

  it('verifica il collegamento del file dalla riga', async () => {
    const { wrapper, store } = await mountView();
    const track = makeTrack();
    store.tracks = [track];
    const verifyTrack = vi.spyOn(store, 'verifyTrack').mockResolvedValue(track);
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');

    expect(verifyTrack).toHaveBeenCalledWith(track);
  });

  it('ordina la tabella dalle intestazioni', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    await flushPromises();

    await wrapper.findAll('.library_table_sort')[3]?.trigger('click');

    expect(store.sort).toEqual({ column: 'year', direction: 'asc' });
  });

  it('offre le stesse azioni anche nella vista anteprima', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    settings.viewMode = 'preview';
    const track = makeTrack();
    store.tracks = [track];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    const verify = vi.spyOn(store, 'verifyTrack').mockResolvedValue(track);
    await flushPromises();

    await wrapper.get('.preview_card .app_menu_trigger').trigger('click');
    await wrapper.findAll('.preview_card .app_menu_item')[1]?.trigger('click');
    expect(verify).toHaveBeenCalledWith(track);

    await wrapper.get('.preview_card .app_menu_trigger').trigger('click');
    await wrapper.findAll('.preview_card .app_menu_item')[2]?.trigger('click');
    await wrapper.get('[data-testid="confirm-remove"]').trigger('click');
    await flushPromises();

    expect(remove).toHaveBeenCalledWith(track.id);
  });
});
