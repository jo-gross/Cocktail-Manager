import { useEffect, useRef, useState } from 'react';
import { FaEyeSlash } from 'react-icons/fa';

/**
 * FloatingActionButtonTailwindOnly – 100 % Tailwind, keine externen Libs.
 *
 * – Klebt unten rechts.
 * – Klick öffnet/­schließt Menü.
 * – Klick außerhalb schließt.
 * – Einfache CSS‑Transition statt Framer.
 */
export default function FloatingActionButtonTailwindOnly() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ───── Click‑Outside Detection ───── */
  useEffect(() => {
    if (!open) return;

    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="fixed bottom-6 left-6 z-50 flex flex-col items-end gap-2">
      {/* ───── Dropdown Menü ───── */}
      <div
        className={`mb-2 flex origin-bottom-right transform flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-200 ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        {[
          { label: 'Aktion 1', onClick: () => alert('Aktion 1') },
          { label: 'Aktion 2', onClick: () => alert('Aktion 2') },
          { label: 'Aktion 3', onClick: () => alert('Aktion 3') },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={() => {
              onClick();
              setOpen(false);
            }}
            className="px-6 py-3 text-left text-sm hover:bg-gray-50 focus:outline-none"
          >
            {label}
          </button>
        ))}
      </div>

      {/* ───── Haupt-Button ───── */}
      <button
        aria-label="Aktionen"
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-transform duration-200 hover:bg-blue-700 focus:outline-none active:scale-95"
      >
        <FaEyeSlash className={`h-6 w-6 transform transition-transform duration-200 ${open ? 'rotate-45' : 'rotate-0'}`} />
      </button>
    </div>
  );
}
