import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { createAudioEngine, type AudioEngine } from '@/services/audio-engine';
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

/**
 * The playing queue and everything the dock shows.
 *
 * The audio element lives behind [`AudioEngine`]: the store only knows the state, which
 * keeps it testable and lets the browser build fail loudly instead of silently.
 */
export const usePlayerStore = defineStore('player', () => {
  const queue = ref<TrackView[]>([]);
  const index = ref(-1);
  const isExpanded = ref(false);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const position = ref(0);
  const duration = ref(0);
  const volume = ref(DEFAULT_VOLUME);
  const errorKey = ref<PlayerErrorKey>(null);

  let engine: AudioEngine | null = null;

  const currentTrack = computed<TrackView | null>(() => queue.value[index.value] ?? null);
  const isActive = computed(() => currentTrack.value !== null);
  const hasNext = computed(() => index.value >= 0 && index.value < queue.value.length - 1);
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

    queue.value = [...tracks];
    index.value = start_;

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

  function close() {
    engine?.release();
    engine = null;
    queue.value = [];
    index.value = -1;
    isExpanded.value = false;
    isPlaying.value = false;
    isLoading.value = false;
    position.value = 0;
    duration.value = 0;
    errorKey.value = null;
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
    index,
    isExpanded,
    isPlaying,
    isLoading,
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
    close,
    expand,
    collapse,
    toggleExpanded,
  };
});
