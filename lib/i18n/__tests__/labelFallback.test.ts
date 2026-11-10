import { describe, expect, it } from 'vitest';
import { resolveLabel, resolveLabelOrNull } from '../labelFallback';

const contentLocales = { primary: 'fr', additional: ['en', 'it'] };

describe('resolveLabelOrNull', () => {
  it('prefers the UI locale if it is an active content language', () => {
    const translations = { fr: { SHAKE: 'Secouer' }, en: { SHAKE: 'Shake' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'en', contentLocales)).toBe('Shake');
  });

  it('ignores the UI locale if it is not an active content language', () => {
    const translations = { fr: { SHAKE: 'Secouer' }, de: { SHAKE: 'Schütteln' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'de', contentLocales)).toBe('Secouer');
  });

  it('falls back to the primary content language', () => {
    const translations = { fr: { SHAKE: 'Secouer' }, it: { SHAKE: 'Agitare' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'en', contentLocales)).toBe('Secouer');
  });

  it('falls back to any other active content language with a value', () => {
    const translations = { it: { SHAKE: 'Agitare' }, es: { SHAKE: 'Agitar' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'en', contentLocales)).toBe('Agitare');
  });

  it('treats blank labels as missing', () => {
    const translations = { en: { SHAKE: '  ' }, fr: { SHAKE: '' }, it: { SHAKE: 'Agitare' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'en', contentLocales)).toBe('Agitare');
  });

  it('falls back to de as legacy safety net', () => {
    const translations = { de: { SHAKE: 'Schütteln' }, es: { SHAKE: 'Agitar' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'en', contentLocales)).toBe('Schütteln');
  });

  it('returns undefined if no label exists', () => {
    expect(resolveLabelOrNull({ es: { SHAKE: 'Agitar' } }, 'SHAKE', 'en', contentLocales)).toBeUndefined();
    expect(resolveLabelOrNull(undefined, 'SHAKE', 'en', contentLocales)).toBeUndefined();
  });

  it('uses UI locale → de while the content locales are unknown', () => {
    const translations = { de: { SHAKE: 'Schütteln' }, en: { SHAKE: 'Shake' }, fr: { SHAKE: 'Secouer' } };
    expect(resolveLabelOrNull(translations, 'SHAKE', 'en', null)).toBe('Shake');
    expect(resolveLabelOrNull(translations, 'SHAKE', 'fr', undefined)).toBe('Secouer');
    expect(resolveLabelOrNull({ de: { SHAKE: 'Schütteln' } }, 'SHAKE', 'en', null)).toBe('Schütteln');
  });
});

describe('resolveLabel', () => {
  it('returns the raw key if no label exists', () => {
    expect(resolveLabel({}, 'SHAKE', 'en', contentLocales)).toBe('SHAKE');
  });

  it('returns the resolved label', () => {
    expect(resolveLabel({ fr: { SHAKE: 'Secouer' } }, 'SHAKE', 'en', contentLocales)).toBe('Secouer');
  });
});
