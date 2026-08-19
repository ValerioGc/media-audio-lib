import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';

import { useFileDrop } from './useFileDrop';

const scopedWindow = window as unknown as Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  onDragDropEvent: vi.fn(),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ onDragDropEvent: mocks.onDragDropEvent }),
}));

function mountHost(onDrop: (paths: string[]) => void) {
  const Host = defineComponent({
    setup: () => useFileDrop(onDrop),
    template: '<div />',
  });

  return mount(Host);
}

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('useFileDrop', () => {
  it('non si registra fuori dalla shell desktop', () => {
    mountHost(vi.fn());

    expect(mocks.onDragDropEvent).not.toHaveBeenCalled();
  });

  it('evidenzia l area durante il trascinamento', () => {
    const wrapper = mountHost(vi.fn());

    wrapper.vm.handle({ type: 'enter' });
    expect(wrapper.vm.isDraggingOver).toBe(true);

    wrapper.vm.handle({ type: 'leave' });
    expect(wrapper.vm.isDraggingOver).toBe(false);
  });

  it('inoltra tutto il contenuto rilasciato, cartelle comprese', () => {
    const onDrop = vi.fn();
    const wrapper = mountHost(onDrop);

    wrapper.vm.handle({
      type: 'drop',
      paths: ['C:/musica/brano.mp3', 'C:/musica/Album 2020', 'C:/musica/altro.FLAC'],
    });

    // Solo il backend puo' guardare dentro una cartella, quindi non si filtra qui.
    expect(onDrop).toHaveBeenCalledWith([
      'C:/musica/brano.mp3',
      'C:/musica/Album 2020',
      'C:/musica/altro.FLAC',
    ]);
    expect(wrapper.vm.isDraggingOver).toBe(false);
  });

  it('regge un evento di drop senza percorsi', () => {
    const onDrop = vi.fn();
    const wrapper = mountHost(onDrop);

    wrapper.vm.handle({ type: 'drop' });

    expect(onDrop).toHaveBeenCalledWith([]);
  });

  it('si registra sulla finestra dentro la shell desktop', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    const unlisten = vi.fn();
    mocks.onDragDropEvent.mockResolvedValue(unlisten);

    const wrapper = mountHost(vi.fn());
    await vi.waitFor(() => expect(mocks.onDragDropEvent).toHaveBeenCalledTimes(1));

    wrapper.unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('non rompe l app se la registrazione fallisce', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.onDragDropEvent.mockRejectedValue(new Error('boom'));

    const wrapper = mountHost(vi.fn());
    await vi.waitFor(() => expect(mocks.onDragDropEvent).toHaveBeenCalledTimes(1));

    expect(() => wrapper.unmount()).not.toThrow();
  });
});
