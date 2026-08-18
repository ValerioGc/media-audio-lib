import { describe, expect, it } from 'vitest';

import { makeTrack } from '../../tests/support/tracks';
import { DEFAULT_SORT } from '@/types/library';

import { filterAndSort, filterTracks, formatDuration, sortTracks } from './track-sorting';

const tracks = [
  makeTrack({ id: 'a', title: 'Zebra', album: 'Bianco', year: 1999, genre: 'Jazz' }),
  makeTrack({ id: 'b', title: 'alfa', album: 'Nero', year: 2020, genre: 'Rock' }),
  makeTrack({ id: 'c', title: 'Mezzo', album: null, year: null, genre: null }),
];

describe('filterTracks', () => {
  it('restituisce tutto quando la ricerca e vuota', () => {
    expect(filterTracks(tracks, '   ')).toHaveLength(3);
  });

  it('cerca senza distinzione di maiuscole', () => {
    expect(filterTracks(tracks, 'ZEB').map((track) => track.id)).toEqual(['a']);
  });

  it('cerca anche in album, genere e percorso', () => {
    expect(filterTracks(tracks, 'nero').map((track) => track.id)).toEqual(['b']);
    expect(filterTracks(tracks, 'jazz').map((track) => track.id)).toEqual(['a']);
    expect(filterTracks(tracks, 'C:/musica').length).toBe(3);
  });

  it('ignora i campi vuoti senza errori', () => {
    expect(filterTracks(tracks, 'inesistente')).toEqual([]);
  });
});

describe('sortTracks', () => {
  it('ordina per titolo ignorando le maiuscole', () => {
    const sorted = sortTracks(tracks, DEFAULT_SORT);

    expect(sorted.map((track) => track.title)).toEqual(['alfa', 'Mezzo', 'Zebra']);
  });

  it('inverte l ordine in direzione discendente', () => {
    const sorted = sortTracks(tracks, { column: 'title', direction: 'desc' });

    expect(sorted.map((track) => track.title)).toEqual(['Zebra', 'Mezzo', 'alfa']);
  });

  it('ordina per anno in modo numerico', () => {
    const sorted = sortTracks(tracks, { column: 'year', direction: 'asc' });

    expect(sorted.map((track) => track.year)).toEqual([1999, 2020, null]);
  });

  it('tiene i campi vuoti in fondo in entrambe le direzioni', () => {
    const ascending = sortTracks(tracks, { column: 'album', direction: 'asc' });
    const descending = sortTracks(tracks, { column: 'album', direction: 'desc' });

    expect(ascending.at(-1)?.album).toBeNull();
    expect(descending.at(-1)?.album).toBeNull();
  });

  it('non modifica l array originale', () => {
    const original = [...tracks];

    sortTracks(tracks, { column: 'year', direction: 'desc' });

    expect(tracks).toEqual(original);
  });

  it('usa il titolo come criterio di parita', () => {
    const sameYear = [
      makeTrack({ title: 'Beta', year: 2001 }),
      makeTrack({ title: 'Alfa', year: 2001 }),
    ];

    const sorted = sortTracks(sameYear, { column: 'year', direction: 'asc' });

    expect(sorted.map((track) => track.title)).toEqual(['Alfa', 'Beta']);
  });
});

describe('filterAndSort', () => {
  it('applica prima il filtro e poi l ordinamento', () => {
    const result = filterAndSort(tracks, 'a', { column: 'title', direction: 'asc' });

    expect(result.map((track) => track.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [1000, '0:01'],
    [65_000, '1:05'],
    [185_000, '3:05'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
    [-5000, '0:00'],
  ])('formatta %i ms come %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});
