/**
 * Renders (author-controlled) menu HTML/CSS in a sandboxed iframe instead of
 * the authenticated app document. `sandbox="allow-same-origin"` without
 * `allow-scripts`: nothing inside the frame can execute, while this component
 * (running in the app) renders React children into the frame document via a
 * portal and attaches the click-to-select listener from outside. Template/custom
 * CSS is document-scoped, so it can no longer overlay the app, restyle it or
 * shadow its fonts.
 *
 * The app's stylesheets (incl. the bundled @fontsource faces) are cloned into the
 * frame and kept in sync, so the preview looks like the public page.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FRAME_DOC = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
const FRAME_BASE_CSS = 'html,body{margin:0;padding:0;height:100%;}body{overflow:auto;}';
const CLONE_SELECTOR = 'link[rel~="stylesheet"], style';
const CLONE_MARK = 'data-gm-preview-clone';

function cloneStyles(source: Document, target: Document, nodes: Iterable<Node>) {
  for (const node of nodes) {
    if (!(node instanceof source.defaultView!.HTMLElement) || !node.matches(CLONE_SELECTOR)) continue;
    const clone = target.importNode(node, true) as HTMLElement;
    if (clone instanceof target.defaultView!.HTMLLinkElement && node instanceof source.defaultView!.HTMLLinkElement) clone.href = node.href;
    clone.setAttribute(CLONE_MARK, '');
    target.head.appendChild(clone);
  }
}

export interface IsolatedPreviewFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Trusted builder CSS (selection highlight) – injected into the frame document. */
  overlayCss?: string;
  /** Attributes for the frame `<body>` (e.g. `data-select-mode`). */
  bodyAttributes?: Record<string, string | undefined>;
  bodyClassName?: string;
  /** Capture-phase click listener on the frame document. */
  onClickCapture?: (event: MouseEvent) => void;
}

export function IsolatedPreviewFrame({
  title,
  children,
  className,
  style,
  overlayCss,
  bodyAttributes,
  bodyClassName,
  onClickCapture,
}: IsolatedPreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);

  const setup = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    // Skip the initial about:blank document and documents that are already set up.
    if (!doc || doc.URL !== 'about:srcdoc' || !doc.body || doc.documentElement.hasAttribute('data-gm-preview')) return;
    doc.documentElement.setAttribute('data-gm-preview', '');
    doc.documentElement.lang = document.documentElement.lang;
    const base = doc.createElement('style');
    base.textContent = FRAME_BASE_CSS;
    doc.head.appendChild(base);
    cloneStyles(document, doc, document.head.querySelectorAll(CLONE_SELECTOR));
    setFrameDocument(doc);
  }, []);

  // `load` can fire before the effect runs; also handle a reload of the frame (re-parenting).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (frame.contentDocument?.readyState === 'complete') setup();
    frame.addEventListener('load', setup);
    return () => frame.removeEventListener('load', setup);
  }, [setup]);

  // Keep app stylesheets in sync (dev HMR, lazily loaded CSS chunks).
  useEffect(() => {
    if (!frameDocument) return;
    const observer = new MutationObserver((records) => {
      for (const record of records) cloneStyles(document, frameDocument, record.addedNodes);
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [frameDocument]);

  useEffect(() => {
    if (!frameDocument) return;
    let element = frameDocument.getElementById('gm-preview-overlay');
    if (!element) {
      element = frameDocument.createElement('style');
      element.id = 'gm-preview-overlay';
    }
    // Last in <head>: wins over cloned app styles.
    frameDocument.head.appendChild(element);
    element.textContent = overlayCss ?? '';
  }, [frameDocument, overlayCss]);

  const attributesKey = JSON.stringify(bodyAttributes ?? {});
  useEffect(() => {
    if (!frameDocument) return;
    const body = frameDocument.body;
    const attributes = JSON.parse(attributesKey) as Record<string, string | undefined>;
    for (const [key, value] of Object.entries(attributes)) {
      if (value == null) body.removeAttribute(key);
      else body.setAttribute(key, value);
    }
    body.setAttribute('class', bodyClassName ?? '');
  }, [frameDocument, attributesKey, bodyClassName]);

  useEffect(() => {
    if (!frameDocument || !onClickCapture) return;
    frameDocument.addEventListener('click', onClickCapture, true);
    return () => frameDocument.removeEventListener('click', onClickCapture, true);
  }, [frameDocument, onClickCapture]);

  return (
    <>
      <iframe
        ref={frameRef}
        title={title}
        sandbox="allow-same-origin"
        srcDoc={FRAME_DOC}
        className={className}
        style={{ border: 0, display: 'block', ...style }}
      />
      {frameDocument?.body && createPortal(children, frameDocument.body)}
    </>
  );
}
