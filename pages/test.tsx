import ActionFloatButton from '@components/ActionFloatButton';
import FloatingActionButtonTailwindOnly from '@components/FloatingActionButtonTailwindOnly';
import ScrollShadowBox from '@components/ScrollShadowBox';

export default function Home() {
  return (
    /* Grid mit 5 Spalten ab -lg-Breakpoint,
       auf kleineren Bildschirmen untereinander   */
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-5">
      {/* ───────────── ❶ MAIN FRAME ───────────── */}
      <div className={'absolute bottom-2 right-2'}>
        <ActionFloatButton />
      </div>
      <FloatingActionButtonTailwindOnly />
      <main className="col-span-4 space-y-8 p-6">
        {/* Dein eigentlicher Content … */}
        <p>… hier beliebig lang werdender Inhalt …</p>
        {/* ⬆︎ scrollt ganz normal mit der Seite */}
      </main>

      {/* ───────────── ❷ WARTESCHLANGE (Sidebar) ───────────── */}
      {/* sticky sorgt dafür, dass die Sidebar beim Scrollen sichtbar bleibt  */}
      <aside className="col-span-1 flex h-screen flex-col border-l border-gray-200 bg-white lg:sticky lg:top-0">
        {/* Überschrift „Warteschlange“ – bleibt immer oben */}
        <h2 className="p-4 text-xl font-bold">Warteschlange</h2>

        {/* ====== A) Bereich „Wird gemacht“  – bleibt immer sichtbar ====== */}
        <section className="p-4">
          <h3 className="mb-2 text-lg font-semibold">Wird gemacht</h3>

          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>Feature A</li>
            <li>Bugfix B</li>
            <li>Refactoring C</li>
          </ul>
        </section>

        {/* ====== B) Bereich „Wird nicht gemacht“  – kann scrollen ====== */}
        {/* flex-1 füllt den verbleibenden Platz; overflow-y-auto macht NUR
            diesen Teil scrollbar, sobald er höher als der Rest wird.     */}
        <h3 className="mb-2 text-lg font-semibold">Wird nicht gemacht</h3>
        <ScrollShadowBox className="h-max">
          <ul className="list-inside list-disc space-y-1 text-sm">
            {Array.from({ length: 100 }).map((_, i) => (
              <li key={i}>Idee #{i + 1}</li>
            ))}
          </ul>
        </ScrollShadowBox>
      </aside>
    </div>
  );
}
