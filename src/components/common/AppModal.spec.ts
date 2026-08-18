import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppModal from './AppModal.vue';

const props = { open: true, title: 'Rimuovere il brano?' };

describe('AppModal', () => {
  it('non rende nulla da chiuso', () => {
    const wrapper = mount(AppModal, { props: { ...props, open: false } });

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('rende titolo, contenuto e azioni', () => {
    const wrapper = mount(AppModal, {
      props,
      slots: { default: 'Sei sicuro?', actions: '<button>Conferma</button>' },
    });

    expect(wrapper.get('.app_modal_title').text()).toBe('Rimuovere il brano?');
    expect(wrapper.get('.app_modal_body').text()).toBe('Sei sicuro?');
    expect(wrapper.get('.app_modal_actions button').text()).toBe('Conferma');
  });

  it('dichiara il dialog agli screen reader', () => {
    const wrapper = mount(AppModal, { props });
    const dialog = wrapper.get('[role="dialog"]');

    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe(
      wrapper.get('.app_modal_title').attributes('id'),
    );
  });

  it('chiede la chiusura cliccando sullo sfondo', async () => {
    const wrapper = mount(AppModal, { props });

    await wrapper.get('.app_modal').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('chiede la chiusura con Escape', async () => {
    const wrapper = mount(AppModal, { props, attachTo: document.body });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('ignora gli altri tasti', async () => {
    const wrapper = mount(AppModal, { props, attachTo: document.body });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toBeUndefined();
  });
});
