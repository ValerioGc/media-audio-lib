import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { i18n } from '@/i18n';
import type { AddReport } from '@/types/library';

import LibraryImportReport from './LibraryImportReport.vue';

beforeEach(() => {
  resetI18n();
});

function mountReport(report: Partial<AddReport>) {
  return mount(LibraryImportReport, {
    global: { plugins: [i18n] },
    props: { report: { added: [], duplicates: [], failed: [], ...report } },
  });
}

describe('LibraryImportReport', () => {
  it('non compare quando non c e nulla da segnalare', () => {
    const wrapper = mountReport({});

    expect(wrapper.find('[data-testid="import-report"]').exists()).toBe(false);
  });

  it('riporta i brani aggiunti al plurale corretto', () => {
    const wrapper = mountReport({ added: [makeTrack(), makeTrack()] });

    expect(wrapper.get('[data-testid="report-added"]').text()).toBe('2 brani aggiunti');
  });

  it('riporta i duplicati al singolare', () => {
    const wrapper = mountReport({ duplicates: ['C:/musica/brano.mp3'] });

    expect(wrapper.get('[data-testid="report-duplicates"]').text()).toBe('1 file già in libreria');
  });

  it('elenca i file non importati con il motivo', () => {
    const wrapper = mountReport({
      failed: [{ path: 'C:/musica/rotto.mp3', reason: 'file audio illeggibile' }],
    });

    expect(wrapper.get('[data-testid="report-failed"]').text()).toBe('1 file non importato');
    expect(wrapper.get('.library_report_failures').text()).toContain('file audio illeggibile');
    expect(wrapper.get('.library_report_failures').text()).toContain('rotto.mp3');
  });

  it('mostra solo le voci con almeno un elemento', () => {
    const wrapper = mountReport({ added: [makeTrack()] });

    expect(wrapper.find('[data-testid="report-added"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-duplicates"]').exists()).toBe(false);
  });

  it('chiede la chiusura', async () => {
    const wrapper = mountReport({ added: [makeTrack()] });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
