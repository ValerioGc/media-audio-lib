import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

import LibraryView from '@/views/LibraryView.vue';

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
  const load = vi.spyOn(store, 'loadHomeLibrary').mockResolvedValue();

  const wrapper = mount(LibraryView, options);
  await flushPromises();

  return { wrapper, store, load };
}

describe('LibraryView', () => {
  it('loads the library on open', async () => {
    const { load } = await mountView();

    expect(load).toHaveBeenCalledWith(null);
  });

  it('loads the primary library on open when configured', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const store = useLibraryStore();
    settings.mainLibraryId = 'lib-2';
    const load = vi.spyOn(store, 'loadHomeLibrary').mockResolvedValue();

    mount(LibraryView, options);
    await flushPromises();

    expect(load).toHaveBeenCalledWith('lib-2');
  });

  it('shows the empty state with no tracks', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('La libreria è vuota');
    expect(wrapper.find('.library_table').exists()).toBe(false);
  });

  it('shows the default player banner until it is dismissed', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.find('.default_player_banner').exists()).toBe(true);

    useSettingsStore().defaultPlayerBannerDismissed = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.default_player_banner').exists()).toBe(false);
  });

  it('shows previews when there are tracks by default', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    await flushPromises();

    expect(wrapper.findAll('.preview_card')).toHaveLength(2);
    expect(wrapper.find('.library_table').exists()).toBe(false);
  });

  it('switches from the tracks tab to the artists tab', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    store.tracks = [
      makeTrack({ title: 'Uno', artist: 'Artist A' }),
      makeTrack({ title: 'Due', artist: 'Artist B' }),
    ];
    await flushPromises();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Brani',
      'Autori',
      'Album',
      'Generi',
    ]);
    expect(wrapper.find('.library_table').exists()).toBe(true);

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.find('.library_table').exists()).toBe(false);
    expect(wrapper.find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.findAll('.library_facet_card')).toHaveLength(2);
    expect(wrapper.text()).toContain('Artist A');
  });

  it('opens the albums tab in preview view by default', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', album: 'Album A' }),
      makeTrack({ title: 'Green', album: 'Album B' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    expect(wrapper.find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.find('.library_facet_list').exists()).toBe(false);
    expect(wrapper.findAll('.library_facet_card')).toHaveLength(2);
  });

  it('opens linked tracks from a facet group in a modal', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A' }),
      makeTrack({ title: 'Green', artist: 'Artist A' }),
      makeTrack({ title: 'Red', artist: 'Artist B' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.text()).toContain('Brani collegati a Artist A');
    expect(dialog.text()).toContain('2 brani');
    expect(dialog.text()).toContain('Blue');
    expect(dialog.text()).toContain('Green');
    expect(dialog.text()).not.toContain('Red');
  });

  it('shows artist albums as a horizontal preview strip above the linked track list', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'First Album', year: 1999 }),
      makeTrack({ title: 'Green', artist: 'Artist A', album: 'Second Album', year: 2001 }),
      makeTrack({ title: 'Red', artist: 'Artist B', album: 'Other Album', year: 2005 }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[role="dialog"]');
    const albumCards = dialog.findAll('.library_group_carousel_card');

    expect(dialog.find('[data-testid="artist-albums-carousel"]').exists()).toBe(true);
    expect(albumCards).toHaveLength(2);
    expect(albumCards[0]?.text()).toContain('First Album');
    expect(albumCards[0]?.text()).toContain('1999');
    expect(albumCards[0]?.text()).not.toContain('Artist A');
    expect(dialog.find('.library_table').exists()).toBe(true);
    expect(dialog.find('[data-testid="table-column-settings"]').exists()).toBe(false);
    expect(
      dialog
        .findAll('.library_table_heading')
        .map((heading) => heading.text().replace(/[▲▼]/u, '').trim()),
    ).toEqual(['Copertina', 'Nome', 'Album', 'Anno', 'Durata', '']);
  });

  it('marks the artist modal album that contains the playing track', async () => {
    const { wrapper, store } = await mountView();
    const player = usePlayerStore();
    const playingTrack = makeTrack({
      title: 'Barabba',
      artist: 'Achille Lauro',
      album: 'Barabba Mixtape',
      year: 2012,
    });
    store.tracks = [
      playingTrack,
      makeTrack({
        title: 'Ascensore per l inferno',
        artist: 'Achille Lauro',
        album: 'Ragazzi madre',
        year: 2016,
      }),
      makeTrack({ title: 'Other', artist: 'Other Artist', album: 'Other Album' }),
    ];
    player.queue = [playingTrack];
    player.index = 0;
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const playingAlbums = wrapper
      .get('[role="dialog"]')
      .findAll('.library_group_carousel_card_playing');

    expect(playingAlbums).toHaveLength(1);
    expect(playingAlbums[0]?.attributes('aria-current')).toBe('true');
    expect(playingAlbums[0]?.text()).toContain('Barabba Mixtape');
    expect(playingAlbums[0]?.get('[data-testid="playing-bubble"]').attributes('title')).toBe(
      'In riproduzione',
    );
  });

  it('keeps the facet view unchanged when the linked-tracks modal changes view', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', album: 'Album A' }),
      makeTrack({ title: 'Green', album: 'Album A' }),
      makeTrack({ title: 'Red', album: 'Album B' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.find('.library_table').exists()).toBe(true);

    await dialog.get('[data-testid="view-preview"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="dialog"]').find('.preview_grid').exists()).toBe(true);
    expect(wrapper.get('.library_view_panel').find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.get('.library_view_panel').find('.library_facet_list').exists()).toBe(false);
  });

  it('heads the album modal with its cover, title, year, artists and genres', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({
        title: 'Blue',
        artist: 'Artist A',
        album: 'Album A',
        genre: 'Jazz',
        year: 1999,
      }),
      makeTrack({
        title: 'Green',
        artist: 'Artist B',
        album: 'Album A',
        genre: 'Fusion',
        year: 2001,
      }),
      makeTrack({ title: 'Red', artist: 'Artist C', album: 'Album B', genre: 'Rock' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[role="dialog"]');
    const summary = dialog.get('.library_album_summary');
    const artistLinks = summary.findAll('.library_album_summary_artist');
    const headings = dialog
      .findAll('.library_table_heading')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(summary.find('.library_album_summary_cover').exists()).toBe(true);
    expect(summary.get('.library_album_summary_name').text()).toBe('Album A');
    expect(summary.get('.library_album_summary_year').text()).toBe('1999');
    // The fields speak for themselves: no label in front of any of them.
    expect(summary.get('.library_album_summary_genres').text()).toBe('Fusion, Jazz');
    expect(summary.text()).not.toContain('Genere:');
    expect(summary.text()).not.toContain('Autore:');
    expect(artistLinks.map((link) => link.text())).toEqual(['Artist A', 'Artist B']);
    expect(headings).toEqual(['Copertina', 'Nome', 'Anno', 'Durata', '']);
    expect(dialog.find('[data-testid="table-column-settings"]').exists()).toBe(false);

    await artistLinks[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="dialog"]').text()).toContain('Brani collegati a Artist A');

    await wrapper.get('[title="Torna al dettaglio precedente"]').trigger('click');
    await flushPromises();

    const restoredDialog = wrapper.get('[role="dialog"]');
    expect(restoredDialog.text()).toContain('Brani collegati a Album A');
    expect(restoredDialog.get('.library_album_summary_genres').text()).toBe('Fusion, Jazz');
    expect(restoredDialog.find('[title="Torna al dettaglio precedente"]').exists()).toBe(false);
  });

  it('opens genre details on the tracks, under the artist and album carousels', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
      makeTrack({ title: 'Red', artist: 'Artist C', album: 'Album C', genre: 'Rock' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[role="dialog"]');
    const artistCarousel = dialog.get('[data-testid="genre-artists-carousel"]');
    const albumCarousel = dialog.get('[data-testid="genre-albums-carousel"]');

    // Both carousels are there, and the tracks are what the modal lists to begin with.
    expect(
      artistCarousel.findAll('.library_group_carousel_card').map((card) => card.text()),
    ).toEqual([expect.stringContaining('Artist A'), expect.stringContaining('Artist B')]);
    expect(
      albumCarousel.findAll('.library_group_carousel_card').map((card) => card.text()),
    ).toEqual([expect.stringContaining('Album A'), expect.stringContaining('Album B')]);
    expect(dialog.find('.library_table').exists()).toBe(true);
    expect(dialog.find('.library_facet_preview').exists()).toBe(false);
    expect(dialog.text()).not.toContain('Red');
  });

  it('counts the tracks of each artist on its carousel card', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist A', album: 'Album B', genre: 'Jazz' }),
      makeTrack({ title: 'Red', artist: 'Artist B', album: 'Album C', genre: 'Jazz' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const cards = wrapper
      .get('[data-testid="genre-artists-carousel"]')
      .findAll('.library_group_carousel_card');

    expect(cards[0]?.text()).toContain('2 brani');
    expect(cards[1]?.text()).toContain('1 brano');
  });

  it('swaps the genre list between tracks, artists and albums from the carousels', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const artistAction = () =>
      wrapper.get('[data-testid="genre-artists-carousel"]').get('[data-testid="carousel-action"]');
    const albumAction = () =>
      wrapper.get('[data-testid="genre-albums-carousel"]').get('[data-testid="carousel-action"]');

    await artistAction().trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.get('[role="dialog"]').find('.library_table').exists()).toBe(false);

    // Asking for the albums moves the list over instead of stacking a second one.
    await albumAction().trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').findAll('.library_facet_preview')).toHaveLength(1);
    expect(wrapper.get('[role="dialog"]').text()).toContain('Album A');

    // The same command a second time brings the tracks back.
    await albumAction().trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').find('.library_table').exists()).toBe(true);
    expect(wrapper.get('[role="dialog"]').find('.library_facet_preview').exists()).toBe(false);
  });

  it('drills from a genre carousel card into that artist', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    await wrapper
      .get('[data-testid="genre-artists-carousel"]')
      .findAll('.library_group_carousel_card')[0]
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="dialog"]').text()).toContain('Brani collegati a Artist A');
  });

  it('marks the playing track in the library', async () => {
    const { wrapper, store } = await mountView();
    const track = makeTrack();
    const player = usePlayerStore();
    store.tracks = [track];
    player.queue = [track];
    player.index = 0;
    await flushPromises();

    expect(wrapper.get('.preview_card_playing').text()).toContain(track.title);
  });

  it('uses the library name as the title when available', async () => {
    const { wrapper, store } = await mountView();
    store.libraryName = 'Jazz Archive';
    await flushPromises();

    expect(wrapper.get('.library_title_name').text()).toBe('Jazz Archive');
  });

  it('shows the no-results state when the filter finds nothing', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    store.setQuery('inesistente');
    await flushPromises();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun risultato');
  });

  it('shows a specific empty state when the missing-data filter finds nothing', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [makeTrack({ artist: 'Artist' })];
    store.setMissingInfoFilter('artist');
    await flushPromises();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun dato mancante');
  });

  it('shows the store error message', async () => {
    const { wrapper, store } = await mountView();
    store.errorKey = 'shellUnavailable';
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('applicazione desktop');
  });

  it('shows and closes an import result', async () => {
    const { wrapper, store } = await mountView();
    store.lastReport = { added: [makeTrack()], duplicates: [], failed: [] };
    await flushPromises();

    expect(wrapper.find('[data-testid="import-report"]').exists()).toBe(true);

    await wrapper.get('[data-testid="import-report"] button').trigger('click');
    expect(store.lastReport).toBeNull();
  });

  it('shows and closes the library import result', async () => {
    const { wrapper, store } = await mountView();
    store.lastLibraryImport = { added: 2, updated: 1, skipped: 0, missing: [], total: 3 };
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toContain('3 brani letti');

    await wrapper.get('[role="status"] button').trigger('click');
    expect(store.lastLibraryImport).toBeNull();
  });

  it('shows and closes the file verification summary', async () => {
    const { wrapper, store } = await mountView();
    store.lastVerification = { total: 3, missing: 1 };
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toContain('file mancanti 1 su 3 brani');

    await wrapper.get('[role="status"] button').trigger('click');
    expect(store.lastVerification).toBeNull();
  });

  it('asks for confirmation before removing a track', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
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

  it('cancels removal without touching the library', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    store.tracks = [makeTrack()];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[2]?.trigger('click');
    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('imports files dropped on the window', async () => {
    const { store } = await mountView();
    const addPaths = vi.spyOn(store, 'addPaths').mockResolvedValue(null);

    drop.onDrop?.(['C:/music/track.mp3']);

    expect(addPaths).toHaveBeenCalledWith(['C:/music/track.mp3']);
  });

  it('opens the metadata editor from the row', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
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

  it('verifies the file link from the row', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    const track = makeTrack();
    store.tracks = [track];
    const verifyTrack = vi.spyOn(store, 'verifyTrack').mockResolvedValue(track);
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');

    expect(verifyTrack).toHaveBeenCalledWith(track);
  });

  it('sorts the table from the headers', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    store.tracks = makeTracks(2);
    await flushPromises();

    await wrapper.findAll('.library_table_sort')[3]?.trigger('click');

    expect(store.sort).toEqual({ column: 'year', direction: 'asc' });
  });

  it('offers the same actions in preview view', async () => {
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

  it('selects multiple tracks with Ctrl and Shift and opens bulk editing', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    const tracks = makeTracks(4);
    store.tracks = tracks;
    await flushPromises();

    await wrapper.findAll('.library_row')[0]?.trigger('click');
    await wrapper.findAll('.library_row')[2]?.trigger('click', { ctrlKey: true });
    expect(store.selectedIds).toEqual([tracks[0]?.id, tracks[2]?.id]);

    await wrapper.findAll('.library_row')[3]?.trigger('click', { shiftKey: true });
    expect(store.selectedIds).toEqual([tracks[2]?.id, tracks[3]?.id]);

    await wrapper.get('[data-testid="bulk-edit-open"]').trigger('click');

    expect(wrapper.find('[data-testid="bulk-metadata-editor"]').exists()).toBe(true);
  });
});
