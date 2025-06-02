import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaPlus, FaTimes } from 'react-icons/fa';

export default function ActionFloatButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ───────── Klick‑Outside Handling ─────────
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* ───────── Dropdown Menü ───────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="fab-menu"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mb-2 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-lg"
          >
            {[
              { label: 'Aktion 1', onClick: () => alert('Aktion 1') },
              { label: 'Aktion 2', onClick: () => alert('Aktion 2') },
              { label: 'Aktion 3', onClick: () => alert('Aktion 3') },
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───────── Haupt‑Button ───────── */}
      <button
        aria-label="Aktionen"
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-all hover:bg-blue-700 focus:outline-none active:scale-95"
      >
        {open ? <FaTimes className="h-6 w-6" /> : <FaPlus className="h-6 w-6" />}
      </button>
    </div>
  );
}
