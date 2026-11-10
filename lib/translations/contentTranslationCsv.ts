/**
 * RFC 4180 CSV helpers for the translation center export/import.
 * Columns: entityType,entityId,field,source,locale,value. Pure module.
 */
import { isContentTranslationEntityType, isTranslatableField, type ContentTranslationEntityType } from './contentTranslationFields';

export const CONTENT_TRANSLATION_CSV_COLUMNS = ['entityType', 'entityId', 'field', 'source', 'locale', 'value'] as const;

export type ContentTranslationCsvColumn = (typeof CONTENT_TRANSLATION_CSV_COLUMNS)[number];

export type ContentTranslationCsvRow = Record<ContentTranslationCsvColumn, string>;

const UTF8_BOM = '﻿';

function escapeCsvCell(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n') || value.includes('\r') || /^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializes rows (first row = header) to CSV with CRLF line endings. */
export function serializeCsv(rows: string[][], delimiter = ','): string {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? '', delimiter)).join(delimiter)).join('\r\n') + '\r\n';
}

/** Guesses `,` vs `;` (Excel with German locale) from the first line. */
export function detectCsvDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ',') commas++;
    else if (!inQuotes && char === ';') semicolons++;
  }
  return semicolons > commas ? ';' : ',';
}

/**
 * Parses CSV into rows of cells. Handles quoted cells with embedded delimiters,
 * escaped quotes (`""`) and line breaks, CRLF/LF endings and a leading BOM.
 * Fully empty lines are skipped.
 */
export function parseCsv(text: string, delimiter = detectCsvDelimiter(text)): string[][] {
  const input = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushRow = () => {
    row.push(cell);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    cell = '';
  };

  while (i < input.length) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\r') {
      if (input[i + 1] === '\n') i++;
      pushRow();
    } else if (char === '\n') {
      pushRow();
    } else {
      cell += char;
    }
    i++;
  }
  if (cell !== '' || row.length > 0) pushRow();
  return rows;
}

/** Cells that spreadsheet apps would evaluate as a formula (optionally behind already added `'` guards). */
const FORMULA_CELL = /^'*[=+\-@\t\r]/;
const GUARDED_FORMULA_CELL = /^'+[=+\-@\t\r]/;

/**
 * CSV formula injection guard: prefixes cells starting with `=`, `+`, `-`, `@`,
 * tab or CR with `'` so Excel/LibreOffice show them as text. Cells that already
 * consist of `'` guards in front of such a character get one more, so
 * {@link unneutralizeCsvFormula} restores every value exactly.
 */
export function neutralizeCsvFormula(value: string): string {
  return FORMULA_CELL.test(value) ? `'${value}` : value;
}

/** Reverts {@link neutralizeCsvFormula}: strips one leading `'` if it guards a formula character. */
export function unneutralizeCsvFormula(value: string): string {
  return GUARDED_FORMULA_CELL.test(value) ? value.slice(1) : value;
}

/** Builds the export file (with BOM so Excel detects UTF-8); formula-like cells are neutralized. */
export function serializeContentTranslationCsv(rows: ContentTranslationCsvRow[]): string {
  const table = [
    [...CONTENT_TRANSLATION_CSV_COLUMNS],
    ...rows.map((row) => CONTENT_TRANSLATION_CSV_COLUMNS.map((column) => neutralizeCsvFormula(row[column] ?? ''))),
  ];
  return UTF8_BOM + serializeCsv(table);
}

export interface ParsedContentTranslationCsvItem {
  entityType: ContentTranslationEntityType;
  entityId: string;
  field: string;
  locale: string;
  value: string;
}

export interface ParsedContentTranslationCsv {
  items: ParsedContentTranslationCsvItem[];
  /** Rows with an empty `value` – ignored so an import never clears translations. */
  skippedEmpty: number;
  /** 1-based line numbers (excluding header) of rows that could not be used. */
  invalidRows: number[];
}

export class ContentTranslationCsvError extends Error {
  constructor(
    public readonly code: 'EMPTY' | 'MISSING_COLUMNS',
    message: string,
  ) {
    super(message);
    this.name = 'ContentTranslationCsvError';
  }
}

/**
 * Parses an import file. Requires the columns entityType, entityId, field,
 * locale and value (any order; `source` is informational and ignored).
 */
export function parseContentTranslationCsv(text: string): ParsedContentTranslationCsv {
  const table = parseCsv(text);
  if (table.length === 0) throw new ContentTranslationCsvError('EMPTY', 'CSV file is empty');

  const header = table[0].map((cell) => cell.trim());
  const required: ContentTranslationCsvColumn[] = ['entityType', 'entityId', 'field', 'locale', 'value'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new ContentTranslationCsvError('MISSING_COLUMNS', `Missing columns: ${missing.join(', ')}`);

  const index = (column: ContentTranslationCsvColumn) => header.indexOf(column);
  const result: ParsedContentTranslationCsv = { items: [], skippedEmpty: 0, invalidRows: [] };

  table.slice(1).forEach((cells, rowIndex) => {
    const get = (column: ContentTranslationCsvColumn) => unneutralizeCsvFormula(cells[index(column)] ?? '');
    const entityType = get('entityType').trim();
    const entityId = get('entityId').trim();
    const field = get('field').trim();
    const locale = get('locale').trim();
    const value = get('value');

    if (!isContentTranslationEntityType(entityType) || !entityId || !isTranslatableField(entityType, field) || !locale) {
      result.invalidRows.push(rowIndex + 1);
      return;
    }
    if (value.trim() === '') {
      result.skippedEmpty++;
      return;
    }
    result.items.push({ entityType, entityId, field, locale, value });
  });

  return result;
}
