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

/** Writes the tray menu in the language of the interface. */
export async function applyTrayLabels(show: string, quit: string): Promise<boolean> {
  return invokeCommand('set_tray_labels', { show, quit });
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
