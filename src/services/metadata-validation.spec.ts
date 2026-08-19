import { describe, expect, it } from 'vitest';

import {
  MAX_COVER_BYTES,
  MAX_TITLE_LENGTH,
  MIN_YEAR,
  draftErrors,
  isDraftValid,
  maxYear,
  toUpdate,
  validateCoverFile,
  validateTitle,
  validateYear,
  type DraftMetadata,
} from './metadata-validation';

const now = new Date('2026-08-18T00:00:00Z');

function draft(overrides: Partial<DraftMetadata> = {}): DraftMetadata {
  return {
    title: 'Titolo',
    artist: 'Autore',
    album: 'Album',
    year: '1999',
    genre: 'Rock',
    ...overrides,
  };
}

describe('validateTitle', () => {
  it('accetta un titolo normale', () => {
    expect(validateTitle('Titolo')).toBeNull();
  });

  it('rifiuta un titolo vuoto o di soli spazi', () => {
    expect(validateTitle('')).toBe('titleRequired');
    expect(validateTitle('   ')).toBe('titleRequired');
  });

  it('rifiuta un titolo troppo lungo', () => {
    expect(validateTitle('a'.repeat(MAX_TITLE_LENGTH))).toBeNull();
    expect(validateTitle('a'.repeat(MAX_TITLE_LENGTH + 1))).toBe('titleTooLong');
  });
});

describe('validateYear', () => {
  it('accetta il campo vuoto, che azzera il tag', () => {
    expect(validateYear('', now)).toBeNull();
    expect(validateYear('  ', now)).toBeNull();
  });

  it('accetta gli estremi dell intervallo', () => {
    expect(validateYear(String(MIN_YEAR), now)).toBeNull();
    expect(validateYear(String(maxYear(now)), now)).toBeNull();
  });

  it('rifiuta gli anni fuori intervallo', () => {
    expect(validateYear(String(MIN_YEAR - 1), now)).toBe('yearOutOfRange');
    expect(validateYear(String(maxYear(now) + 1), now)).toBe('yearOutOfRange');
  });

  it('rifiuta un valore non numerico', () => {
    expect(validateYear('millenovecento', now)).toBe('yearOutOfRange');
    expect(validateYear('19x9', now)).toBe('yearOutOfRange');
    expect(validateYear('-1999', now)).toBe('yearOutOfRange');
  });

  it('ammette l anno prossimo per le uscite imminenti', () => {
    expect(maxYear(now)).toBe(2027);
  });
});

describe('validateCoverFile', () => {
  it('accetta png e jpeg entro il limite', () => {
    expect(validateCoverFile({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validateCoverFile({ type: 'image/jpeg', size: MAX_COVER_BYTES })).toBeNull();
  });

  it('rifiuta gli altri formati', () => {
    expect(validateCoverFile({ type: 'image/gif', size: 10 })).toBe('coverType');
    expect(validateCoverFile({ type: 'application/pdf', size: 10 })).toBe('coverType');
  });

  it('rifiuta le immagini troppo grandi', () => {
    expect(validateCoverFile({ type: 'image/png', size: MAX_COVER_BYTES + 1 })).toBe(
      'coverTooLarge',
    );
  });
});

describe('draftErrors', () => {
  it('non segnala nulla su una bozza valida', () => {
    expect(draftErrors(draft(), now)).toEqual({ title: null, year: null });
    expect(isDraftValid(draft(), now)).toBe(true);
  });

  it('segnala i campi non validi', () => {
    const errors = draftErrors(draft({ title: '', year: '12' }), now);

    expect(errors.title).toBe('titleRequired');
    expect(errors.year).toBe('yearOutOfRange');
    expect(isDraftValid(draft({ title: '' }), now)).toBe(false);
  });
});

describe('toUpdate', () => {
  it('ripulisce gli spazi e converte l anno', () => {
    expect(
      toUpdate(
        draft({ title: '  Titolo  ', artist: ' Autore ', album: ' Album ', year: ' 1999 ' }),
      ),
    ).toEqual({
      title: 'Titolo',
      artist: 'Autore',
      album: 'Album',
      year: 1999,
      genre: 'Rock',
    });
  });

  it('trasforma i campi vuoti in null per azzerare i tag', () => {
    expect(toUpdate(draft({ artist: '', album: '', year: '', genre: '   ' }))).toEqual({
      title: 'Titolo',
      artist: null,
      album: null,
      year: null,
      genre: null,
    });
  });
});
