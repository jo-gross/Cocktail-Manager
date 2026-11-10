import { describe, expect, it } from 'vitest';
import {
  ContentTranslationCsvError,
  detectCsvDelimiter,
  neutralizeCsvFormula,
  parseContentTranslationCsv,
  parseCsv,
  serializeContentTranslationCsv,
  serializeCsv,
  unneutralizeCsvFormula,
} from '../contentTranslationCsv';
import { isTranslatableField, contentTranslationKey } from '../contentTranslationFields';

describe('serializeCsv / parseCsv', () => {
  it('quotes cells containing delimiters, quotes, line breaks and surrounding whitespace', () => {
    const csv = serializeCsv([
      ['a', 'b,c', 'say "hi"'],
      ['line1\nline2', ' padded', ''],
    ]);
    expect(csv).toBe('a,"b,c","say ""hi"""\r\n"line1\nline2"," padded",\r\n');
  });

  it('round-trips arbitrary content', () => {
    const rows = [
      ['entityType', 'value'],
      ['cocktail', 'Mit "Zucker", Limette;\r\nund Minze'],
      ['glass', ''],
      ['ingredient', 'Ümlaut – ✓'],
    ];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
    expect(parseCsv(serializeCsv(rows, ';'), ';')).toEqual(rows);
  });

  it('handles LF endings, BOM, missing trailing newline and empty lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('detects semicolon-separated files', () => {
    expect(detectCsvDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectCsvDelimiter('a,b;c\n')).toBe(',');
    expect(detectCsvDelimiter('"x;y",b,c')).toBe(',');
    expect(parseCsv('a;"b;c"\n1;2')).toEqual([
      ['a', 'b;c'],
      ['1', '2'],
    ]);
  });
});

describe('content translation CSV', () => {
  const row = { entityType: 'cocktail', entityId: 'c1', field: 'description', source: 'Süß, "fruchtig"', locale: 'en', value: 'Sweet,\n"fruity"' };

  it('exports with BOM and header and imports the same items back', () => {
    const csv = serializeContentTranslationCsv([row]);
    expect(csv.startsWith('﻿entityType,entityId,field,source,locale,value\r\n')).toBe(true);
    const parsed = parseContentTranslationCsv(csv);
    expect(parsed.items).toEqual([{ entityType: 'cocktail', entityId: 'c1', field: 'description', locale: 'en', value: 'Sweet,\n"fruity"' }]);
    expect(parsed.invalidRows).toEqual([]);
  });

  it('skips empty values and reports invalid rows', () => {
    const csv = [
      'locale;value;entityType;entityId;field',
      'en;;cocktail;c1;name',
      'en;Hi;cocktail;c1;notes',
      'en;Hi;unknown;c1;name',
      'en;Glass;glass;g1;name',
    ].join('\n');
    const parsed = parseContentTranslationCsv(csv);
    expect(parsed.items).toEqual([{ entityType: 'glass', entityId: 'g1', field: 'name', locale: 'en', value: 'Glass' }]);
    expect(parsed.skippedEmpty).toBe(1);
    expect(parsed.invalidRows).toEqual([2, 3]);
  });

  it('rejects empty files and missing columns', () => {
    expect(() => parseContentTranslationCsv('')).toThrow(ContentTranslationCsvError);
    expect(() => parseContentTranslationCsv('entityType,entityId,field\n')).toThrow(/locale, value/);
  });
});

describe('CSV formula injection guard', () => {
  const formulaValues = ['=HYPERLINK("http://evil","x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\r=1'];

  it('prefixes formula-like cells with an apostrophe', () => {
    for (const value of formulaValues) expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
    expect(neutralizeCsvFormula('Mojito')).toBe('Mojito');
    expect(neutralizeCsvFormula("It's fine")).toBe("It's fine");
    expect(neutralizeCsvFormula('')).toBe('');
    // Values already looking like a guarded formula get another guard (exact round trip).
    expect(neutralizeCsvFormula("'=1")).toBe("''=1");
  });

  it('strips exactly one added apostrophe again', () => {
    expect(unneutralizeCsvFormula("'=1")).toBe('=1');
    expect(unneutralizeCsvFormula("''=1")).toBe("'=1");
    expect(unneutralizeCsvFormula("'quoted'")).toBe("'quoted'");
    expect(unneutralizeCsvFormula("'")).toBe("'");
    for (const value of [...formulaValues, "'=1", "''-x", "'plain", 'plain']) {
      expect(unneutralizeCsvFormula(neutralizeCsvFormula(value))).toBe(value);
    }
  });

  it('neutralizes the export and restores the values on import', () => {
    const values = ['=1+1', '-Zitrone', "'@user", 'Normal'];
    const csv = serializeContentTranslationCsv(
      values.map((value, i) => ({ entityType: 'cocktail', entityId: `c${i}`, field: 'name', source: value, locale: 'en', value })),
    );
    const cells = parseCsv(csv).slice(1);
    expect(cells.map((row) => row[5])).toEqual(["'=1+1", "'-Zitrone", "''@user", 'Normal']);
    expect(cells.map((row) => row[3])).toEqual(["'=1+1", "'-Zitrone", "''@user", 'Normal']);
    expect(cells.every((row) => !/^[=+\-@\t\r]/.test(row[5]))).toBe(true);
    expect(parseContentTranslationCsv(csv).items.map((item) => item.value)).toEqual(values);
  });
});

describe('content translation fields', () => {
  it('never allows notes and only known fields per entity', () => {
    expect(isTranslatableField('cocktail', 'history')).toBe(true);
    expect(isTranslatableField('cocktail', 'notes')).toBe(false);
    expect(isTranslatableField('ingredient', 'guestName')).toBe(true);
    expect(isTranslatableField('glass', 'description')).toBe(false);
    expect(contentTranslationKey('glass', 'g1', 'name', 'en')).toBe('glass:g1:name:en');
  });
});
