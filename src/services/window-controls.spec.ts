import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: mocks.minimize,
    toggleMaximize: mocks.toggleMaximize,
    close: mocks.close,
  }),
}));

import { closeWindow, minimizeWindow, toggleMaximizeWindow } from './window-controls';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.minimize.mockResolvedValue(undefined);
  mocks.toggleMaximize.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('window commands', () => {
  it('do nothing outside the desktop shell', async () => {
    await expect(minimizeWindow()).resolves.toBe(false);
    await expect(toggleMaximizeWindow()).resolves.toBe(false);
    await expect(closeWindow()).resolves.toBe(false);

    expect(mocks.minimize).not.toHaveBeenCalled();
    expect(mocks.toggleMaximize).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('pilotano la finestra dentro la shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await expect(minimizeWindow()).resolves.toBe(true);
    await expect(toggleMaximizeWindow()).resolves.toBe(true);
    await expect(closeWindow()).resolves.toBe(true);

    expect(mocks.minimize).toHaveBeenCalledTimes(1);
    expect(mocks.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('report failure without propagating the error', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.close.mockRejectedValue(new Error('finestra gia chiusa'));

    await expect(closeWindow()).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
