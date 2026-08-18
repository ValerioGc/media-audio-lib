import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryEmptyState from './LibraryEmptyState.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryEmptyState', () => {
  it('invita ad aggiungere brani quando la libreria e vuota', () => {
    const wrapper = mount(LibraryEmptyState, { ...withPinia(), props: { variant: 'empty' } });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('La libreria è vuota');
    expect(wrapper.get('button').text()).toBe('Aggiungi brani');
    expect(wrapper.get('.library_empty_hint').text()).toContain('trascinare');
  });

  it('apre il dialog di sistema dal pulsante', async () => {
    const options = withPinia();
    const pickAndAdd = vi.spyOn(useLibraryStore(), 'pickAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryEmptyState, { ...options, props: { variant: 'empty' } });
    await wrapper.get('button').trigger('click');

    expect(pickAndAdd).toHaveBeenCalledTimes(1);
  });

  it('riporta la ricerca senza risultati', () => {
    const options = withPinia();
    useLibraryStore().setQuery('metal');

    const wrapper = mount(LibraryEmptyState, { ...options, props: { variant: 'noMatches' } });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun risultato');
    expect(wrapper.get('.app_placeholder_message').text()).toContain('metal');
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
