import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { GENRES } from '@/config/genres';

import GenreSelect from './GenreSelect.vue';

const props = { modelValue: 'Rock', label: 'Genere', customLabel: 'Scegli o scrivi' };

describe('GenreSelect', () => {
  it('propone tutti i generi predefiniti', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.findAll('datalist option')).toHaveLength(GENRES.length);
  });

  it('collega il campo alla lista dei suggerimenti', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.get('input').attributes('list')).toBe(wrapper.get('datalist').attributes('id'));
  });

  it('mostra il genere corrente', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.get('input').element.value).toBe('Rock');
  });

  it('accetta un genere non presente in elenco', async () => {
    const wrapper = mount(GenreSelect, { props });

    await wrapper.get('input').setValue('Shoegaze');

    expect(wrapper.emitted('update:modelValue')).toEqual([['Shoegaze']]);
  });
});
