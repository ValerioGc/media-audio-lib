import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n } from '@tests/support/mount';
import { APP_NAME, APP_VERSION, GITHUB_URL, WEBSITE_URL } from '@/config/app-config';
import { i18n } from '@/i18n';
import * as externalLink from '@/services/external-link';

import SettingsAppInfo from '@/components/settings/SettingsAppInfo.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

function mountInfo() {
  return mount(SettingsAppInfo, { global: { plugins: [i18n] } });
}

describe('SettingsAppInfo', () => {
  it('shows app name and the bare version number', () => {
    const wrapper = mountInfo();

    expect(wrapper.get('.settings_app_info_name').text()).toBe(APP_NAME);
    // The number speaks for itself: no word in front of it.
    expect(wrapper.get('.settings_app_info_version').text()).toBe(APP_VERSION);
  });

  it('opens the project site, listed before the repository', async () => {
    const openExternal = vi.spyOn(externalLink, 'openExternal').mockResolvedValue(true);
    const wrapper = mountInfo();
    const links = wrapper.findAll('.settings_app_info_link');

    expect(links.map((link) => link.attributes('data-testid'))).toEqual([
      'website-link',
      'github-link',
    ]);

    await wrapper.get('[data-testid="website-link"]').trigger('click');

    expect(openExternal).toHaveBeenCalledWith(WEBSITE_URL);
  });

  it('punta al sito delle pages in https', () => {
    expect(WEBSITE_URL).toMatch(/^https:\/\/valeriogc\.github\.io\//u);
  });

  it('offre il collegamento al progetto', () => {
    const wrapper = mountInfo();

    expect(wrapper.get('[data-testid="github-link"]').text()).toContain('GitHub');
  });

  it('opens the repository in the system browser', async () => {
    const openExternal = vi.spyOn(externalLink, 'openExternal').mockResolvedValue(true);
    const wrapper = mountInfo();

    await wrapper.get('[data-testid="github-link"]').trigger('click');

    expect(openExternal).toHaveBeenCalledWith(GITHUB_URL);
  });

  it('punta a un indirizzo GitHub in https', () => {
    expect(GITHUB_URL).toMatch(/^https:\/\/github\.com\//u);
  });
});
