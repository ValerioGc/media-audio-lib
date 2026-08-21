import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import {
  APP_NAME,
  APP_VERSION,
  CHANGELOG_URL,
  GITHUB_URL,
  RELEASES_URL,
  WEBSITE_URL,
} from '@/config/app-config';
import * as externalLink from '@/services/external-link';

import AppAboutDialog from '@/components/layout/AppAboutDialog.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

function mountDialog() {
  return mount(AppAboutDialog, { ...withPinia(), props: { open: true } });
}

describe('AppAboutDialog', () => {
  it('names the app and its version', () => {
    const wrapper = mountDialog();

    expect(wrapper.get('.app_about_name').text()).toContain(APP_NAME);
    expect(wrapper.get('.app_about_version').text()).toBe(APP_VERSION);
  });

  it('opens site, repository, changelog and releases in the system browser', async () => {
    const openExternal = vi.spyOn(externalLink, 'openExternal').mockResolvedValue(true);
    const wrapper = mountDialog();

    await wrapper.get('[data-testid="about-website"]').trigger('click');
    await wrapper.get('[data-testid="about-repository"]').trigger('click');
    await wrapper.get('[data-testid="about-changelog"]').trigger('click');
    await wrapper.get('[data-testid="about-releases"]').trigger('click');

    expect(openExternal.mock.calls.map(([url]) => url)).toEqual([
      WEBSITE_URL,
      GITHUB_URL,
      CHANGELOG_URL,
      RELEASES_URL,
    ]);
  });

  it('closes on request', async () => {
    const wrapper = mountDialog();

    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
