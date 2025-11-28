import React, { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';

export interface CocktailExportOptions {
  exportImage: boolean;
  exportDescription: boolean;
  exportNotes: boolean;
  exportHistory: boolean;
  newPagePerCocktail: boolean;
}

interface CocktailExportOptionsModalProps {
  onExport: (options: CocktailExportOptions) => void;
}

export default function CocktailExportOptionsModal({ onExport }: CocktailExportOptionsModalProps) {
  const modalContext = useContext(ModalContext);

  const [exportImage, setExportImage] = useState(true);
  const [exportDescription, setExportDescription] = useState(true);
  const [exportNotes, setExportNotes] = useState(true);
  const [exportHistory, setExportHistory] = useState(true);
  const [newPagePerCocktail, setNewPagePerCocktail] = useState(true);

  const handleExport = () => {
    const options: CocktailExportOptions = {
      exportImage,
      exportDescription,
      exportNotes,
      exportHistory,
      newPagePerCocktail,
    };
    modalContext.closeModal();
    onExport(options);
  };

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-2xl font-bold'}>Export-Optionen</div>
      <div className={'text-sm text-base-content/70'}>
        Sie können das exportierte PDF nach Ihren Wünschen gestalten.<br />
        Der Export-Vorgang kann je nach Anzahl der Rezepte einige Minuten dauern.
      </div>
      <div className={'flex flex-col gap-4'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'text-lg font-semibold'}>Inhalt</div>
          <div className={'flex flex-col gap-2 pl-2'}>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type={'checkbox'}
                  className={'toggle toggle-primary'}
                  checked={exportImage}
                  onChange={(e) => setExportImage(e.target.checked)}
                />
                <span className={'label-text'}>Bild anzeigen</span>
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type={'checkbox'}
                  className={'toggle toggle-primary'}
                  checked={exportDescription}
                  onChange={(e) => setExportDescription(e.target.checked)}
                />
                <span className={'label-text'}>Allgemeine Beschreibung anzeigen</span>
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type={'checkbox'}
                  className={'toggle toggle-primary'}
                  checked={exportNotes}
                  onChange={(e) => setExportNotes(e.target.checked)}
                />
                <span className={'label-text'}>Zubereitungsnotizen anzeigen</span>
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type={'checkbox'}
                  className={'toggle toggle-primary'}
                  checked={exportHistory}
                  onChange={(e) => setExportHistory(e.target.checked)}
                />
                <span className={'label-text'}>Geschichte und Entstehung anzeigen</span>
              </label>
            </div>
          </div>
        </div>
        <div className={'divider my-0'}></div>
        <div className={'flex flex-col gap-2'}>
          <div className={'text-lg font-semibold'}>Layout</div>
          <div className={'flex flex-col gap-2 pl-2'}>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type={'checkbox'}
                  className={'toggle toggle-primary'}
                  checked={newPagePerCocktail}
                  onChange={(e) => setNewPagePerCocktail(e.target.checked)}
                />
                <span className={'label-text'}>Neue Seite für jeden Cocktail</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div className={'flex justify-end gap-2'}>
        <button
          className={'btn btn-outline btn-error'}
          type={'button'}
          onClick={() => {
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </button>
        <button className={'btn btn-primary'} type={'button'} onClick={handleExport}>
          Exportieren
        </button>
      </div>
    </div>
  );
}

