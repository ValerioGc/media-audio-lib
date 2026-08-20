import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n } from '../../../tests/support/mount';
import { APP_NAME, APP_VERSION, GITHUB_URL } from '@/config/app-config';
import { i18n } from '@/i18n';
import * as externalLink from '@/services/external-link';

import SettingsFooter from './SettingsFooter.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

function mountFooter() {
  return mount(SettingsFooter, { global: { plugins: [i18n] } });
}

describe('SettingsFooter', () => {
  it('shows app name and version', () => {
    const wrapper = mountFooter();

    expect(wrapper.get('.settings_footer_name').text()).toBe(APP_NAME);
    expect(wrapper.get('.settings_footer_version').text()).toContain(APP_VERSION);
  });

  it('offre il collegamento al progetto', () => {
    const wrapper = mountFooter();

    expect(wrapper.get('[data-testid="github-link"]').text()).toContain('GitHub');
  });

  it('opens the repository in the system browser', async () => {
    const openExternal = vi.spyOn(externalLink, 'openExternal').mockResolvedValue(true);
    const wrapper = mountFooter();

    await wrapper.get('[data-testid="github-link"]').trigger('click');

    expect(openExternal).toHaveBeenCalledWith(GITHUB_URL);
  });

  it('punta a un indirizzo GitHub in https', () => {
    expect(GITHUB_URL).toMatch(/^https:\/\/github\.com\//u);
  });
});
