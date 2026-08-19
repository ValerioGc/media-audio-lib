import { describe, expect, it, vi } from 'vitest';

import { makeTrack } from '../../tests/support/tracks';
import * as api from '@/services/library-api';

import { useTrackFileVerification } from './useTrackFileVerification';

vi.mock('@/services/library-api', () => ({
  verifyTrackFile: vi.fn(),
}));

const verifyTrackFile = vi.mocked(api.verifyTrackFile);

describe('useTrackFileVerification', () => {
  it('verifica una traccia usando il suo identificativo', async () => {
    const track = makeTrack({ missing: false });
    const verified = { ...track, missing: true };
    verifyTrackFile.mockResolvedValue(verified);

    await expect(useTrackFileVerification().verify(track)).resolves.toEqual(verified);
    expect(verifyTrackFile).toHaveBeenCalledWith(track.id);
  });
});
