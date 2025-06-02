import { PropsWithChildren, useEffect, useRef, useState } from 'react';

/**
 * ScrollShadowBox – Scroll‑Container mit dynamischen Top/Bottom‑Fades
 * ---------------------------------------------------------------
 * • Reine Tailwind‑Klassen, keine externen Libs
 * • Overlay‑Gradients (pointer‑events‑none) zeigen an, dass ober‑/unterhalb
 *   noch Inhalt vorhanden ist.
 * • JS‑Logik (< 20 Zeilen) toggelt Sichtbarkeit per `opacity-0`/`opacity-100`.
 *
 * ➜ Height steuerbar über `className`‑Prop (z.B. "h-64"), default = h-64
 */
export default function ScrollShadowBox({ children, className }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* Initial calc */
    const update = () => {
      setAtTop(el.scrollTop === 0);
      setAtBottom(Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight);
    };
    update();

    el.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {' '}
      {/* Wrapper sorgt für positioning */}
      {/* Scrollable Content */}
      <div ref={ref} className="h-full overflow-y-auto pr-2" /* optional pr-2 for scroll bar space */>
        {children}
      </div>
      {/* Top Shadow */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-gray-300/50 to-transparent transition-opacity duration-200 ${
          atTop ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {/* Bottom Shadow */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-gray-300/50 to-transparent transition-opacity duration-200 ${
          atBottom ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
}
