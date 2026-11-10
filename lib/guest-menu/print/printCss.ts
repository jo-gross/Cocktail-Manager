/**
 * Print base CSS for guest menu PDFs (pure, no Tailwind). Applied after the
 * scoped menu CSS; paper sizes per `PrintPaper` (DL = 99 × 210 mm).
 */
import type { PrintPaper } from '../schema';

export type TableTentPaper = 'A6' | 'A5';

export interface PaperSpec {
  width: string;
  height: string;
  margin: string;
  /** Root font size: smaller papers get a slightly smaller base. */
  fontSize: string;
}

export const PRINT_PAPER_SPECS: Record<PrintPaper | TableTentPaper, PaperSpec> = {
  A4: { width: '210mm', height: '297mm', margin: '16mm 15mm 16mm 15mm', fontSize: '11pt' },
  A5: { width: '148mm', height: '210mm', margin: '12mm 11mm 12mm 11mm', fontSize: '9.5pt' },
  DL: { width: '99mm', height: '210mm', margin: '10mm 8mm 10mm 8mm', fontSize: '8.5pt' },
  A6: { width: '105mm', height: '148mm', margin: '0', fontSize: '9pt' },
};

/** Keeps a CSS color value safe for inlining in a declaration. */
export function safeCssValue(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '').replace(/[;{}<>"'\\]/g, '').trim();
  return cleaned || fallback;
}

export function buildPrintBaseCss(paper: PrintPaper, background: string): string {
  const spec = PRINT_PAPER_SPECS[paper];
  return `
@page { size: ${spec.width} ${spec.height}; margin: ${spec.margin}; }
html { font-size: ${spec.fontSize}; background: ${background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
body { background: ${background}; }
/* The page is painted in the theme background; the root must match (base CSS forces white under @media print). */
.gm-print .gm-root[data-gm] { background-color: ${background}; background-attachment: scroll; }
.gm-print .gm-section { padding-left: 0; padding-right: 0; scroll-margin-top: 0; }
.gm-print .gm-header { padding-top: 0; }
.gm-print .gm-menu-header { break-after: avoid; page-break-after: avoid; }
.gm-print .gm-section-header { break-after: avoid; page-break-after: avoid; break-inside: avoid; }
.gm-print .gm-section-header + .gm-items > .gm-item-wrap:first-child { break-before: avoid; page-break-before: avoid; }
.gm-print .gm-item-wrap,
.gm-print .gm-block--image,
.gm-print .gm-block--notice,
.gm-print .gm-legend { break-inside: avoid; page-break-inside: avoid; }
.gm-print .gm-block--image img { max-height: 80mm; }
.gm-print .gm-expand > summary { display: none; }
.gm-print .gm-menu-footer { break-inside: avoid; page-break-inside: avoid; }
.gm-print-qr { display: flex; align-items: center; justify-content: center; gap: 4mm; margin-top: 6mm; break-inside: avoid; page-break-inside: avoid; }
.gm-print-qr-code { width: ${paper === 'A4' ? '26mm' : '22mm'}; height: ${paper === 'A4' ? '26mm' : '22mm'}; background: #fff; padding: 1.5mm; border-radius: 1.5mm; flex: none; }
.gm-print-qr-code svg { width: 100%; height: 100%; display: block; }
.gm-print-qr-text { font-size: 0.85rem; max-width: 60mm; }
.gm-print-qr-url { display: block; font-size: 0.72rem; opacity: 0.75; word-break: break-all; margin-top: 1mm; }
`;
}

export function buildTableTentCss(
  paper: TableTentPaper,
  colors: { bg: string; text: string; muted: string; accent: string },
  fonts: { heading: string; body: string },
): string {
  const spec = PRINT_PAPER_SPECS[paper];
  const scale = paper === 'A5' ? 1.4 : 1;
  return `
@page { size: ${spec.width} ${spec.height}; margin: 0; }
html { font-size: ${spec.fontSize}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: ${colors.bg}; color: ${colors.text}; font-family: ${fonts.body}; }
.tt { box-sizing: border-box; width: ${spec.width}; height: ${spec.height}; padding: ${10 * scale}mm ${8 * scale}mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; overflow: hidden; }
.tt-head { display: flex; flex-direction: column; align-items: center; gap: ${3 * scale}mm; }
.tt-logo { max-height: ${18 * scale}mm; max-width: 70%; object-fit: contain; }
.tt-bar { font-family: ${fonts.heading}; font-size: ${1.5 * scale}rem; font-weight: 700; margin: 0; line-height: 1.15; }
.tt-title { font-family: ${fonts.heading}; font-size: ${2.2 * scale}rem; margin: 0; color: ${colors.accent}; line-height: 1.1; }
.tt-qr { width: ${62 * scale}mm; height: ${62 * scale}mm; background: #fff; padding: ${3 * scale}mm; border-radius: ${2 * scale}mm; box-sizing: border-box; }
.tt-qr svg { width: 100%; height: 100%; display: block; }
.tt-hint { font-size: ${1.05 * scale}rem; margin: 0; }
.tt-url { font-size: ${0.75 * scale}rem; color: ${colors.muted}; word-break: break-all; margin: ${1 * scale}mm 0 0; }
`;
}
