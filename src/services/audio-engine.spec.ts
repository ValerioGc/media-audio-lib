import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAudioEngine, type AudioEngineHandlers } from './audio-engine';

const elements: HTMLAudioElement[] = [];
const originalAudio = window.Audio;

function handlers(): AudioEngineHandlers {
  return {
    onProgress: vi.fn(),
    onDuration: vi.fn(),
    onPlayingChange: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  };
}

/** jsdom has no media pipeline: the element is real, playback is stubbed. */
function lastElement(): HTMLAudioElement {
  const element = elements.at(-1);

  if (element === undefined) {
    throw new Error('nessun elemento audio creato');
  }

  return element;
}

beforeEach(() => {
  window.Audio = class extends originalAudio {
    constructor() {
      super();
      elements.push(this as unknown as HTMLAudioElement);
    }
  } as unknown as typeof Audio;

  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
});

afterEach(() => {
  window.Audio = originalAudio;
  elements.length = 0;
  vi.restoreAllMocks();
});

describe('createAudioEngine', () => {
  it('carica una sorgente e la avvia', async () => {
    const engine = createAudioEngine(handlers());

    engine.load('asset://brano.mp3');
    await engine.play();

    expect(lastElement().src).toContain('brano.mp3');
    expect(lastElement().play).toHaveBeenCalledTimes(1);
  });

  it('riporta avanzamento, durata e stato di riproduzione', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);
    const element = lastElement();

    Object.defineProperty(element, 'currentTime', { value: 12.5, configurable: true });
    Object.defineProperty(element, 'duration', { value: 180, configurable: true });
    element.dispatchEvent(new Event('timeupdate'));
    element.dispatchEvent(new Event('durationchange'));
    element.dispatchEvent(new Event('play'));
    element.dispatchEvent(new Event('pause'));

    expect(callbacks.onProgress).toHaveBeenCalledWith(12.5);
    expect(callbacks.onDuration).toHaveBeenCalledWith(180);
    expect(callbacks.onPlayingChange).toHaveBeenNthCalledWith(1, true);
    expect(callbacks.onPlayingChange).toHaveBeenNthCalledWith(2, false);
  });

  it('tratta una durata non finita come sconosciuta', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);
    const element = lastElement();

    Object.defineProperty(element, 'duration', { value: Number.NaN, configurable: true });
    element.dispatchEvent(new Event('durationchange'));

    expect(callbacks.onDuration).toHaveBeenCalledWith(0);
  });

  it('segnala la fine del brano', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);

    lastElement().dispatchEvent(new Event('ended'));

    expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
  });

  it('distingue il formato non supportato dagli altri errori', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);
    const element = lastElement();

    Object.defineProperty(element, 'error', { value: { code: 4 }, configurable: true });
    element.dispatchEvent(new Event('error'));
    Object.defineProperty(element, 'error', { value: { code: 2 }, configurable: true });
    element.dispatchEvent(new Event('error'));

    expect(callbacks.onError).toHaveBeenNthCalledWith(1, 'unsupported');
    expect(callbacks.onError).toHaveBeenNthCalledWith(2, 'generic');
  });

  it('sposta la posizione e imposta il volume', () => {
    const engine = createAudioEngine(handlers());

    engine.seek(42);
    engine.setVolume(0.25);

    expect(lastElement().currentTime).toBe(42);
    expect(lastElement().volume).toBe(0.25);
  });

  it('libera la sorgente quando il player viene chiuso', () => {
    const engine = createAudioEngine(handlers());
    engine.load('asset://brano.mp3');

    engine.release();

    expect(lastElement().pause).toHaveBeenCalled();
    expect(lastElement().hasAttribute('src')).toBe(false);
  });
});
