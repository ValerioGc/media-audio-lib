/** How playback failed, as far as the audio element can tell. */
export type AudioErrorKind = 'unsupported' | 'generic';

export interface AudioEngineHandlers {
  onProgress: (position: number) => void;
  onDuration: (duration: number) => void;
  onPlayingChange: (isPlaying: boolean) => void;
  onEnded: () => void;
  onError: (kind: AudioErrorKind) => void;
}

export interface AudioEngine {
  load: (url: string) => void;
  /** Opens a file ahead of time, so playing it next starts on what is already buffered. */
  preload: (url: string) => void;
  /** The correction the file asks for, in decibels. `null` plays it as it is. */
  setTrackGain: (decibels: number | null) => void;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  release: () => void;
}

/**
 * Turns the position of the slider into the loudness the element should play at.
 *
 * `volume` on an audio element is amplitude, and the ear does not hear amplitude: half the
 * amplitude is nowhere near half as loud, so a linear slider leaves everything useful
 * crammed into its last quarter and drops off a cliff near the bottom. Cubing it is the
 * common approximation of the curve the ear actually follows — it is what a slider that
 * "feels right" is doing underneath.
 */
export function perceivedVolume(sliderPosition: number): number {
  const position = Math.min(1, Math.max(0, sliderPosition));

  return position ** 3;
}

/**
 * The amplitude a correction in decibels comes to.
 *
 * Never above one: an element cannot play louder than its source, and a file asking to be
 * turned up would only be clipped. Corrections that matter are the ones turning a loud
 * master down, which is the whole point of the exercise.
 */
export function gainFactor(decibels: number | null): number {
  if (decibels === null || !Number.isFinite(decibels)) {
    return 1;
  }

  return Math.min(1, 10 ** (decibels / 20));
}

const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

function kindOf(error: MediaError | null): AudioErrorKind {
  if (
    error !== null &&
    (error.code === MEDIA_ERR_DECODE || error.code === MEDIA_ERR_SRC_NOT_SUPPORTED)
  ) {
    return 'unsupported';
  }

  return 'generic';
}

/** Wraps the audio element so the store never touches the DOM. */
export function createAudioEngine(handlers: AudioEngineHandlers): AudioEngine {
  let element = new Audio();
  element.preload = 'auto';

  /**
   * The next file, opened early and waiting.
   *
   * Starting a track means opening the file, reading its header and filling a buffer, and
   * that is the silence between two tracks of the same record. Having the next one already
   * open turns the change into a swap.
   */
  let standby: HTMLAudioElement | null = null;
  let standbyUrl = '';

  /** Where the slider stands, and what the file asks for: the two are multiplied. */
  let sliderPosition = 1;
  let trackGain: number | null = null;

  function applyVolume() {
    element.volume = perceivedVolume(sliderPosition) * gainFactor(trackGain);
  }

  const listeners: [string, EventListener][] = [
    ['timeupdate', () => handlers.onProgress(element.currentTime)],
    [
      'durationchange',
      () => handlers.onDuration(Number.isFinite(element.duration) ? element.duration : 0),
    ],
    ['play', () => handlers.onPlayingChange(true)],
    ['pause', () => handlers.onPlayingChange(false)],
    ['ended', () => handlers.onEnded()],
    ['error', () => handlers.onError(kindOf(element.error))],
  ];

  function listen(target: HTMLAudioElement) {
    for (const [event, handler] of listeners) {
      target.addEventListener(event, handler);
    }
  }

  function stopListening(target: HTMLAudioElement) {
    for (const [event, handler] of listeners) {
      target.removeEventListener(event, handler);
    }
  }

  listen(element);

  return {
    load(url: string) {
      if (standby !== null && standbyUrl === url) {
        // Already open and buffered: the element itself is exchanged rather than the file
        // inside it, which is what makes the change instant.
        stopListening(element);
        element.pause();
        element.removeAttribute('src');

        element = standby;
        standby = null;
        standbyUrl = '';
        listen(element);
        applyVolume();
        handlers.onDuration(Number.isFinite(element.duration) ? element.duration : 0);

        return;
      }

      element.src = url;
      element.load();
    },
    preload(url: string) {
      if (url === '' || standbyUrl === url || element.currentSrc === url) {
        return;
      }

      standby?.removeAttribute('src');
      standby = new Audio();
      standby.preload = 'auto';
      standby.src = url;
      standby.load();
      standbyUrl = url;
    },
    play() {
      return element.play();
    },
    pause() {
      element.pause();
    },
    seek(seconds: number) {
      element.currentTime = seconds;
    },
    setVolume(value: number) {
      sliderPosition = value;
      applyVolume();
    },
    setTrackGain(decibels: number | null) {
      trackGain = decibels;
      applyVolume();
    },
    release() {
      standby?.removeAttribute('src');
      standby = null;
      standbyUrl = '';
      element.pause();
      element.removeAttribute('src');
      element.load();
    },
  };
}
