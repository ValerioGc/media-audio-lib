import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { HELP_TOPICS } from '@/config/help';
import { setI18nLocale } from '@/i18n';
import { useNavigationStore } from '@/stores/navigation';

import HelpView from '@/views/HelpView.vue';

beforeEach(() => {
  resetI18n();
});

function mountHelp() {
  return mount(HelpView, withPinia());
}

describe('HelpView', () => {
  it('documents every planned feature', () => {
    const wrapper = mountHelp();

    const topics = wrapper.findAll('.help_topic').map((card) => card.attributes('data-topic'));

    expect(topics).toEqual([...HELP_TOPICS]);
  });

  it('states where each item is and how to use it', () => {
    const wrapper = mountHelp();

    for (const card of wrapper.findAll('.help_topic')) {
      expect(card.get('.help_topic_title').text().length).toBeGreaterThan(0);
      expect(card.get('.help_topic_where').text()).toContain('Dove:');
      expect(card.findAll('.help_topic_steps li').length).toBeGreaterThan(0);
    }
  });

  it('lists steps in the order written in translations', () => {
    const wrapper = mountHelp();
    const firstTopic = wrapper.get('.help_topic[data-topic="import"]');

    const steps = firstTopic.findAll('.help_topic_steps li').map((step) => step.text());

    expect(steps[0]).toContain('Aggiungi brani');
    expect(steps.some((step) => step.includes('Aggiungi cartella'))).toBe(true);
    expect(steps.some((step) => step.includes('trascina'))).toBe(true);
  });

  it('translates the whole guide when the language changes', async () => {
    const wrapper = mountHelp();

    setI18nLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.help_view_title').text()).toBe('Guide');
    expect(wrapper.get('.help_topic[data-topic="import"] .help_topic_title').text()).toBe(
      'Adding tracks and folders',
    );
    expect(wrapper.get('.help_topic_where').text()).toContain('Where:');
  });

  it('returns to the library', async () => {
    const wrapper = mountHelp();
    const navigation = useNavigationStore();
    navigation.go('help');

    await wrapper.get('[data-testid="back-to-library"]').trigger('click');

    expect(navigation.view).toBe('library');
  });
});
