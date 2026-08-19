import { isTauriRuntime } from '@/config/app-config';

/**
 * Window buttons of the custom titlebar.
 *
 * The Tauri window API is imported on demand: outside the shell (browser, tests) there is
 * no window to drive, so every action is a no-op instead of a crash at import time.
 */
async function withWindow(action: (appWindow: WindowHandle) => Promise<void>): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await action(getCurrentWindow());

    return true;
  } catch (error) {
    console.error('Window command failed', error);

    return false;
  }
}

interface WindowHandle {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
}

export async function minimizeWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.minimize());
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.toggleMaximize());
}

export async function closeWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.close());
}
