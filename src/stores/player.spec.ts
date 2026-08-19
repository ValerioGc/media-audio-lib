import { setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia } from '../../tests/support/mount';
import { makeTrack, makeTracks } from '../../tests/support/tracks';
import type { AudioEngine, AudioEngineHandlers } from '@/services/audio-engine';
import { ShellUnavailableError } from '@/services/library-api';

const mocks = vi.hoisted(() => ({
  playbackUrl: vi.fn(),
  createAudioEngine: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({ playbackUrl: mocks.playbackUrl }));
vi.mock('@/services/audio-engine', () => ({ createAudioEngine: mocks.createAudioEngine }));

import { usePlayerStore } from './player';

let engine: AudioEngine;
let handlers: AudioEngineHandlers | null = null;

function makeEngine(): AudioEngine {
  return {
    load: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    release: vi.fn(),
  };
}

/** Events the audio element would send back to the store. */
function engineHandlers(): AudioEngineHandlers {
  if (handlers === null) {
    throw new Error('nessun engine creato');
  }

  return handlers;
}

beforeEach(() => {
  setActivePinia(createTestPinia());
  engine = makeEngine();
  handlers = null;
  mocks.createAudioEngine.mockImplementation((given: AudioEngineHandlers) => {
    handlers = given;
    return engine;
  });
  mocks.playbackUrl.mockResolvedValue('asset://brano.mp3');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('usePlayerStore', () => {
  it('parte senza nulla in riproduzione', () => {
    const player = usePlayerStore();

    expect(player.currentTrack).toBeNull();
    expect(player.isActive).toBe(false);
    expect(player.isPlaying).toBe(false);
    expect(mocks.createAudioEngine).not.toHaveBeenCalled();
  });

  it('carica e avvia il brano scelto', async () => {
    const player = usePlayerStore();
    const track = makeTrack({ title: 'Brano' });

    await player.play(track);

    expect(mocks.playbackUrl).toHaveBeenCalledWith(track.id);
    expect(engine.load).toHaveBeenCalledWith('asset://brano.mp3');
    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(player.currentTrack?.title).toBe('Brano');
    expect(player.isLoading).toBe(false);
  });

  it('usa la durata dei metadati finche il file non dichiara la sua', async () => {
    const player = usePlayerStore();

    await player.play(makeTrack({ durationMs: 185_000 }));

    expect(player.duration).toBe(185);

    engineHandlers().onDuration(184.2);

    expect(player.duration).toBe(184.2);
  });

  it('prende la lista visibile come coda', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(3);
    const secondo = tracks[1];

    await player.playFrom(tracks, secondo?.id ?? '');

    expect(player.queue).toHaveLength(3);
    expect(player.currentTrack?.id).toBe(secondo?.id);
    expect(player.hasPrevious).toBe(true);
    expect(player.hasNext).toBe(true);
  });

  it('prepara una coda casuale mantenendo per primo il brano scelto', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(4);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    player.toggleShuffle();
    await player.playFrom(tracks, tracks[1]?.id ?? '');

    expect(player.isShuffleEnabled).toBe(true);
    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
    expect(player.queue.map((track) => track.id)).toEqual([
      tracks[1]?.id,
      tracks[2]?.id,
      tracks[3]?.id,
      tracks[0]?.id,
    ]);
  });

  it('ripristina l ordine della libreria quando si disattiva la coda casuale', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(3);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await player.playFrom(tracks, tracks[0]?.id ?? '');
    player.toggleShuffle();
    player.toggleShuffle();

    expect(player.isShuffleEnabled).toBe(false);
    expect(player.queue.map((track) => track.id)).toEqual(tracks.map((track) => track.id));
    expect(player.currentTrack?.id).toBe(tracks[0]?.id);
  });

  it('ignora un brano che non e nella lista', async () => {
    const player = usePlayerStore();

    await player.playFrom(makeTracks(2), 'id-assente');

    expect(player.isActive).toBe(false);
  });

  it('scorre la coda avanti e indietro', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(3);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    await player.next();
    expect(player.currentTrack?.id).toBe(tracks[1]?.id);

    await player.previous();
    expect(player.currentTrack?.id).toBe(tracks[0]?.id);
    expect(player.hasPrevious).toBe(false);
  });

  it('si ferma alla fine della coda', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    const ultimo = tracks[1];
    await player.playFrom(tracks, ultimo?.id ?? '');
    engineHandlers().onProgress(30);

    await player.next();

    expect(player.currentTrack?.id).toBe(ultimo?.id);
    expect(player.position).toBe(0);
    expect(player.isPlaying).toBe(false);
    expect(engine.pause).toHaveBeenCalled();
  });

  it('ripete il brano corrente invece di fermarsi a fine coda', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    const ultimo = tracks[1];
    await player.playFrom(tracks, ultimo?.id ?? '');

    player.toggleRepeatOne();
    await player.next();

    expect(player.isRepeatOneEnabled).toBe(true);
    expect(player.currentTrack?.id).toBe(ultimo?.id);
    expect(player.hasNext).toBe(true);
    expect(engine.pause).not.toHaveBeenCalled();
    expect(engine.load).toHaveBeenCalledTimes(2);
  });

  it('passa al brano successivo quando quello corrente finisce', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    engineHandlers().onEnded();
    await Promise.resolve();

    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
  });

  it('il precedente riparte dall inizio se il brano e gia avviato', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    const secondo = tracks[1];
    await player.playFrom(tracks, secondo?.id ?? '');
    engineHandlers().onProgress(10);

    await player.previous();

    expect(player.currentTrack?.id).toBe(secondo?.id);
    expect(player.position).toBe(0);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('mette in pausa e riprende con lo stesso comando', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    engineHandlers().onPlayingChange(true);

    await player.toggle();
    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(false);

    await player.toggle();
    expect(engine.play).toHaveBeenCalledTimes(2);
  });

  it('interrompe riportando la posizione a zero', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    engineHandlers().onProgress(45);

    player.stop();

    expect(player.position).toBe(0);
    expect(player.isPlaying).toBe(false);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('limita la posizione cercata alla durata del brano', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 100_000 }));

    player.seek(-5);
    expect(player.position).toBe(0);

    player.seek(500);
    expect(player.position).toBe(100);
    expect(engine.seek).toHaveBeenLastCalledWith(100);
  });

  it('calcola l avanzamento come frazione della durata', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 200_000 }));

    engineHandlers().onProgress(50);

    expect(player.progress).toBe(0.25);
  });

  it('tiene il volume tra zero e uno e lo applica al player', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());

    player.setVolume(2);
    expect(player.volume).toBe(1);

    player.setVolume(-1);
    expect(player.volume).toBe(0);
    expect(engine.setVolume).toHaveBeenLastCalledWith(0);
  });

  it('applica il volume scelto prima dell avvio', async () => {
    const player = usePlayerStore();
    player.setVolume(0.3);

    await player.play(makeTrack());

    expect(engine.setVolume).toHaveBeenCalledWith(0.3);
  });

  it('non prova a riprodurre un file sparito dal disco', async () => {
    const player = usePlayerStore();

    await player.play(makeTrack({ missing: true }));

    expect(player.errorKey).toBe('missing');
    expect(mocks.playbackUrl).not.toHaveBeenCalled();
    expect(mocks.createAudioEngine).not.toHaveBeenCalled();
  });

  it('spiega che nel browser non si riproduce nulla', async () => {
    mocks.playbackUrl.mockRejectedValue(new ShellUnavailableError());
    const player = usePlayerStore();

    await player.play(makeTrack());

    expect(player.errorKey).toBe('shellUnavailable');
    expect(player.isPlaying).toBe(false);
    expect(player.isLoading).toBe(false);
  });

  it('segnala un avvio non riuscito', async () => {
    mocks.playbackUrl.mockRejectedValue(new Error('permesso negato'));
    const player = usePlayerStore();

    await player.play(makeTrack());

    expect(player.errorKey).toBe('generic');
  });

  it('riporta il formato non riproducibile segnalato dal player', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());

    engineHandlers().onError('unsupported');

    expect(player.errorKey).toBe('unsupported');
    expect(player.isPlaying).toBe(false);
  });

  it('cancella l errore quando si riparte', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack({ missing: true }));

    await player.play(makeTrack());

    expect(player.errorKey).toBeNull();
  });

  it('chiudendo il player libera la sorgente e svuota la coda', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');
    player.expand();

    player.close();

    expect(engine.release).toHaveBeenCalledTimes(1);
    expect(player.queue).toHaveLength(0);
    expect(player.isActive).toBe(false);
    expect(player.isExpanded).toBe(false);
    expect(player.position).toBe(0);
  });

  it('ricrea la sorgente dopo la chiusura', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    player.close();

    await player.play(makeTrack());

    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(2);
  });

  it('espande e riduce la vista', () => {
    const player = usePlayerStore();

    player.toggleExpanded();
    expect(player.isExpanded).toBe(true);

    player.collapse();
    expect(player.isExpanded).toBe(false);
  });
});
