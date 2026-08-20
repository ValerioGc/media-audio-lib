import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { GENRES } from '@/config/genres';

import GenreSelect from './GenreSelect.vue';

const props = { modelValue: 'Rock', label: 'Genere', customLabel: 'Scegli o scrivi' };

describe('GenreSelect', () => {
  it('suggests all default genres', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.findAll('datalist option')).toHaveLength(GENRES.length);
  });

  it('links the field to the suggestions list', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.get('input').attributes('list')).toBe(wrapper.get('datalist').attributes('id'));
  });

  it('shows the current genre', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.get('input').element.value).toBe('Rock');
  });

  it('accepts a genre not present in the list', async () => {
    const wrapper = mount(GenreSelect, { props });

    await wrapper.get('input').setValue('Shoegaze');

    expect(wrapper.emitted('update:modelValue')).toEqual([['Shoegaze']]);
  });
});
