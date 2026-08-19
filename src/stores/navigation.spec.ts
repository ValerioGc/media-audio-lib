import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestPinia } from '../../tests/support/mount';

import { useNavigationStore } from './navigation';

beforeEach(() => {
  setActivePinia(createTestPinia());
});

describe('useNavigationStore', () => {
  it('parte dalla libreria', () => {
    const navigation = useNavigationStore();

    expect(navigation.view).toBe('library');
    expect(navigation.isLibrary).toBe(true);
    expect(navigation.isSettings).toBe(false);
  });

  it('apre la vista richiesta', () => {
    const navigation = useNavigationStore();

    navigation.go('settings');

    expect(navigation.isSettings).toBe(true);
    expect(navigation.isLibrary).toBe(false);
  });

  it('l icona delle impostazioni fa da interruttore', () => {
    const navigation = useNavigationStore();

    navigation.toggleSettings();
    expect(navigation.view).toBe('settings');

    navigation.toggleSettings();
    expect(navigation.view).toBe('library');
  });
});
