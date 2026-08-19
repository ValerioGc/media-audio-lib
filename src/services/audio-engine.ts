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
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  release: () => void;
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
  const element = new Audio();
  element.preload = 'auto';

  element.addEventListener('timeupdate', () => handlers.onProgress(element.currentTime));
  element.addEventListener('durationchange', () => {
    handlers.onDuration(Number.isFinite(element.duration) ? element.duration : 0);
  });
  element.addEventListener('play', () => handlers.onPlayingChange(true));
  element.addEventListener('pause', () => handlers.onPlayingChange(false));
  element.addEventListener('ended', () => handlers.onEnded());
  element.addEventListener('error', () => handlers.onError(kindOf(element.error)));

  return {
    load(url: string) {
      element.src = url;
      element.load();
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
      element.volume = value;
    },
    release() {
      element.pause();
      element.removeAttribute('src');
      element.load();
    },
  };
}
