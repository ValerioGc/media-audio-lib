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
  it('indexes every topic of the guide, and opens the first one', () => {
    const wrapper = mountHelp();

    const entries = wrapper
      .findAll('.help_view_index_entry')
      .map((entry) => entry.attributes('data-testid'));

    expect(entries).toEqual(HELP_TOPICS.map((topic) => `help-index-${topic}`));
    // One topic at a time: the guide is long, and the index says what else is in it.
    expect(wrapper.findAll('.help_topic')).toHaveLength(1);
    expect(wrapper.get('.help_topic').attributes('data-topic')).toBe(HELP_TOPICS[0]);
  });

  it('changes the page from the index', async () => {
    const wrapper = mountHelp();

    await wrapper.get('[data-testid="help-index-dock"]').trigger('click');

    expect(wrapper.get('.help_topic').attributes('data-topic')).toBe('dock');
    expect(wrapper.get('[data-testid="help-index-dock"]').attributes('aria-current')).toBe('true');
  });

  it('states where each topic is and how to use it', async () => {
    const wrapper = mountHelp();

    for (const topic of HELP_TOPICS) {
      await wrapper.get(`[data-testid="help-index-${topic}"]`).trigger('click');
      const card = wrapper.get('.help_topic');

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
