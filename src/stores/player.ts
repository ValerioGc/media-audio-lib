import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { createAudioEngine, type AudioEngine } from '@/services/audio-engine';
import type { CoverAccent } from '@/services/cover-accent';
import { ShellUnavailableError } from '@/services/library-api';
import { playbackUrl } from '@/services/playback-api';
import type { TrackView } from '@/types/library';

/** i18n key describing why playback stopped, so the UI stays free of hardcoded text. */
export type PlayerErrorKey = 'missing' | 'unsupported' | 'shellUnavailable' | 'generic' | null;

/** Past this point "previous" restarts the track instead of going back in the queue. */
const RESTART_THRESHOLD_SECONDS = 3;
const DEFAULT_VOLUME = 0.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];

  for (let index_ = result.length - 1; index_ > 0; index_ -= 1) {
    const nextIndex = Math.floor(Math.random() * (index_ + 1));
    const current = result[index_];
    result[index_] = result[nextIndex] as T;
    result[nextIndex] = current as T;
  }

  return result;
}

function buildShuffledQueue(tracks: readonly TrackView[], firstTrackId: string): TrackView[] {
  const first = tracks.find((track) => track.id === firstTrackId);

  if (first === undefined) {
    return [...tracks];
  }

  return [first, ...shuffled(tracks.filter((track) => track.id !== firstTrackId))];
}

/**
 * The playing queue and everything the dock shows.
 *
 * The audio element lives behind [`AudioEngine`]: the store only knows the state, which
 * keeps it testable and lets the browser build fail loudly instead of silently.
 */
export const usePlayerStore = defineStore('player', () => {
  const queue = ref<TrackView[]>([]);
  const sourceQueue = ref<TrackView[]>([]);
  const index = ref(-1);
  const isExpanded = ref(false);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const isShuffleEnabled = ref(false);
  const isRepeatOneEnabled = ref(false);
  const coverAccent = ref<CoverAccent | null>(null);
  const position = ref(0);
  const duration = ref(0);
  const volume = ref(DEFAULT_VOLUME);
  const errorKey = ref<PlayerErrorKey>(null);

  let engine: AudioEngine | null = null;

  const currentTrack = computed<TrackView | null>(() => queue.value[index.value] ?? null);
  const isActive = computed(() => currentTrack.value !== null);
  const hasNext = computed(
    () =>
      currentTrack.value !== null &&
      (isRepeatOneEnabled.value || index.value < queue.value.length - 1),
  );
  const hasPrevious = computed(() => index.value > 0);
  const progress = computed(() => (duration.value > 0 ? position.value / duration.value : 0));

  function fail(key: Exclude<PlayerErrorKey, null>) {
    errorKey.value = key;
    isPlaying.value = false;
    isLoading.value = false;
  }

  function ensureEngine(): AudioEngine {
    if (engine === null) {
      engine = createAudioEngine({
        onProgress: (value) => {
          position.value = value;
        },
        onDuration: (value) => {
          duration.value = value;
        },
        onPlayingChange: (value) => {
          isPlaying.value = value;
        },
        onEnded: () => {
          void next();
        },
        onError: (kind) => {
          fail(kind);
        },
      });
      engine.setVolume(volume.value);
    }

    return engine;
  }

  /** Loads the current track and starts it; the file is granted access one play at a time. */
  async function start() {
    const track = currentTrack.value;

    if (track === null) {
      return;
    }

    position.value = 0;
    duration.value = track.durationMs / 1000;
    errorKey.value = null;

    if (track.missing) {
      fail('missing');
      return;
    }

    isLoading.value = true;

    try {
      const url = await playbackUrl(track.id);
      const audio = ensureEngine();
      audio.load(url);
      await audio.play();
      isLoading.value = false;
    } catch (error) {
      fail(error instanceof ShellUnavailableError ? 'shellUnavailable' : 'generic');
    }
  }

  /** Plays one track, using the given list as the queue for previous and next. */
  async function playFrom(tracks: readonly TrackView[], trackId: string) {
    const start_ = tracks.findIndex((track) => track.id === trackId);

    if (start_ < 0) {
      return;
    }

    sourceQueue.value = [...tracks];
    queue.value = isShuffleEnabled.value ? buildShuffledQueue(tracks, trackId) : [...tracks];
    index.value = isShuffleEnabled.value ? 0 : start_;

    await start();
  }

  async function play(track: TrackView) {
    await playFrom([track], track.id);
  }

  async function resume() {
    if (currentTrack.value === null) {
      return;
    }

    if (engine === null) {
      await start();
      return;
    }

    errorKey.value = null;

    try {
      await engine.play();
    } catch {
      fail('generic');
    }
  }

  function pause() {
    engine?.pause();
    isPlaying.value = false;
  }

  async function toggle() {
    if (isPlaying.value) {
      pause();
      return;
    }

    await resume();
  }

  /** Stops without unloading: the track stays in the dock, ready to start over. */
  function stop() {
    engine?.pause();
    engine?.seek(0);
    isPlaying.value = false;
    position.value = 0;
  }

  async function next() {
    if (isRepeatOneEnabled.value && currentTrack.value !== null) {
      await start();
      return;
    }

    if (!hasNext.value) {
      stop();
      return;
    }

    index.value += 1;
    await start();
  }

  async function previous() {
    if (position.value > RESTART_THRESHOLD_SECONDS || !hasPrevious.value) {
      seek(0);
      return;
    }

    index.value -= 1;
    await start();
  }

  function seek(seconds: number) {
    const target = clamp(seconds, 0, duration.value);
    position.value = target;
    engine?.seek(target);
  }

  function setVolume(value: number) {
    volume.value = clamp(value, 0, 1);
    engine?.setVolume(volume.value);
  }

  function toggleShuffle() {
    isShuffleEnabled.value = !isShuffleEnabled.value;

    const track = currentTrack.value;

    if (track === null) {
      return;
    }

    const orderedQueue = sourceQueue.value.length > 0 ? sourceQueue.value : queue.value;
    queue.value = isShuffleEnabled.value
      ? buildShuffledQueue(orderedQueue, track.id)
      : [...orderedQueue];
    index.value = queue.value.findIndex((item) => item.id === track.id);
  }

  function toggleRepeatOne() {
    isRepeatOneEnabled.value = !isRepeatOneEnabled.value;
  }

  function setCoverAccent(accent: CoverAccent | null) {
    coverAccent.value = accent;
  }

  function close() {
    engine?.release();
    engine = null;
    queue.value = [];
    sourceQueue.value = [];
    index.value = -1;
    isExpanded.value = false;
    isPlaying.value = false;
    isLoading.value = false;
    position.value = 0;
    duration.value = 0;
    errorKey.value = null;
    coverAccent.value = null;
  }

  function expand() {
    isExpanded.value = true;
  }

  function collapse() {
    isExpanded.value = false;
  }

  function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
  }

  return {
    queue,
    sourceQueue,
    index,
    isExpanded,
    isPlaying,
    isLoading,
    isShuffleEnabled,
    isRepeatOneEnabled,
    coverAccent,
    position,
    duration,
    volume,
    errorKey,
    currentTrack,
    isActive,
    hasNext,
    hasPrevious,
    progress,
    playFrom,
    play,
    resume,
    pause,
    toggle,
    stop,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeatOne,
    setCoverAccent,
    close,
    expand,
    collapse,
    toggleExpanded,
  };
});
