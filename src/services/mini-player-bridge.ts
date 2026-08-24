import { isTauriRuntime } from '@/config/app-config';

/** What the dock shows: the main window owns the sound and sends word of it. */
export interface MiniPlayerState {
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  cover: string | null;
  isPlaying: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  position: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  /** The colour taken from the cover, ready to be painted behind the dock. */
  gradient: string | null;
}

/** What the dock asks for. The main window is the one that can do any of it. */
export interface MiniPlayerCommand {
  action:
    | 'toggle'
    | 'next'
    | 'previous'
    | 'stop'
    | 'expand'
    | 'settings'
    | 'quit'
    | 'sync'
    | 'seek'
    | 'volume'
    | 'mute';
  /** Seconds for a seek, a fraction of one for the volume. */
  value?: number;
}

export interface MiniCloseDecision {
  quitsApp: boolean;
  remember: boolean;
}

const STATE_EVENT = 'mini://state';
const COMMAND_EVENT = 'mini://command';
const CLOSE_DECISION_EVENT = 'mini://close-decision';

type Unlisten = () => void;

async function emitEvent(event: string, payload: unknown): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(event, payload);

    return true;
  } catch (error) {
    console.error(`Mini player event ${event} failed`, error);

    return false;
  }
}

async function listenTo<T>(event: string, run: (payload: T) => void): Promise<Unlisten | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');

    return await listen<T>(event, (received) => run(received.payload));
  } catch (error) {
    console.error(`Mini player listener ${event} failed`, error);

    return null;
  }
}

/** Main window: says what is playing, so the dock can draw it. */
export async function publishPlayerState(state: MiniPlayerState | null): Promise<boolean> {
  return emitEvent(STATE_EVENT, state);
}

/** Dock: follows what the main window is playing. */
export async function onPlayerState(
  run: (state: MiniPlayerState | null) => void,
): Promise<Unlisten | null> {
  return listenTo<MiniPlayerState | null>(STATE_EVENT, run);
}

/** Dock: asks the main window for something only it can do. */
export async function sendMiniCommand(
  action: MiniPlayerCommand['action'],
  value?: number,
): Promise<boolean> {
  return emitEvent(COMMAND_EVENT, value === undefined ? { action } : { action, value });
}

/** Main window: answers the dock. */
export async function onMiniCommand(
  run: (command: MiniPlayerCommand) => void,
): Promise<Unlisten | null> {
  return listenTo<MiniPlayerCommand>(COMMAND_EVENT, run);
}

/** The separate confirmation window sends the answer back to the mini player. */
export async function sendMiniCloseDecision(decision: MiniCloseDecision): Promise<boolean> {
  return emitEvent(CLOSE_DECISION_EVENT, decision);
}

export async function onMiniCloseDecision(
  run: (decision: MiniCloseDecision) => void,
): Promise<Unlisten | null> {
  return listenTo<MiniCloseDecision>(CLOSE_DECISION_EVENT, run);
}
