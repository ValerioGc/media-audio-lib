import { isTauriRuntime } from '@/config/app-config';

/**
 * The parts of the shell the settings drive: the tray, and the entry the system reads to
 * start the app on its own. Outside the desktop shell every call is a no-op, so the same
 * settings work in the browser and in the tests.
 */
async function invokeCommand(command: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(command, payload);

    return true;
  } catch (error) {
    console.error(`Shell command ${command} failed`, error);

    return false;
  }
}

/** Whether closing the window leaves the app running in the tray. */
export async function applyCloseToTray(enabled: boolean): Promise<boolean> {
  return invokeCommand('set_close_to_tray', { enabled });
}

/**
 * Writes the tray menu: its words, and whether the player has anything to stop.
 *
 * The menu is built by the shell, so it learns both from here, and is written again on a
 * change of language or of what the player holds.
 */
export async function applyTrayMenu(
  show: string,
  stop: string,
  quit: string,
  canStop: boolean,
): Promise<boolean> {
  return invokeCommand('set_tray_menu', { show, stop, quit, canStop });
}

/**
 * Runs the callback when the tray asks for the playback to stop.
 *
 * The sound is played by the webview, so the menu item can only send word: returns the
 * function that stops listening, or null outside the desktop shell.
 */
export async function onTrayStopPlayback(stop: () => void): Promise<(() => void) | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');

    return await listen('tray://stop-playback', () => stop());
  } catch (error) {
    console.error('Tray listener failed', error);

    return null;
  }
}

/**
 * Registers or clears the system autostart entry.
 *
 * The entry always carries the `--minimized` argument: it says the app was started by the
 * system, not by the user. Whether that means staying out of sight is a setting the app
 * reads at launch.
 */
export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');

    if (await isEnabled()) {
      await disable();
    }

    if (enabled) {
      await enable();
    }

    return true;
  } catch (error) {
    console.error('Autostart command failed', error);

    return false;
  }
}
