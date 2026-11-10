/**
 * Minimal, safe Markdown → HTML for guest menu texts (descriptions, notices,
 * text blocks). Supports paragraphs, line breaks, `#`–`###` headings, `-`/`*`
 * and `1.` lists, `**bold**`, `*italic*`/`_italic_`, `` `code` `` and
 * `[links](https://…)`. All input is HTML-escaped first; the result is
 * additionally passed through the sanitizer by the renderer.
 */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i;

function inline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    // `href` is already escaped; unescape &amp; for the protocol check only.
    const raw = href.replace(/&amp;/g, '&');
    if (!SAFE_LINK.test(raw)) return label;
    const external = /^https?:/i.test(raw);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
  return html;
}

export function markdownToHtml(markdown: string | null | undefined): string {
  if (!markdown) return '';
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 2; // h3–h5: menus already use h1/h2
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      const current = list as { type: 'ul' | 'ol'; items: string[] } | null;
      if (!current || current.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      (list as unknown as { items: string[] }).items.push((bullet ?? ordered)![1]);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return out.join('');
}
