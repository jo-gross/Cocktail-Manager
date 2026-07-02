import React, { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Button, Divider, FormControl, Label, LabelText, Toggle } from '@components/ui';

export interface CocktailExportOptions {
  exportImage: boolean;
  exportDescription: boolean;
  exportNotes: boolean;
  exportHistory: boolean;
  newPagePerCocktail: boolean;
  showHeader: boolean;
  showFooter: boolean;
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
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);

  const handleExport = () => {
    const options: CocktailExportOptions = {
      exportImage,
      exportDescription,
      exportNotes,
      exportHistory,
      newPagePerCocktail,
      showHeader,
      showFooter,
    };
    modalContext.closeModal();
    onExport(options);
  };

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-2xl font-bold'}>Export-Optionen</div>
      <div className={'text-sm text-base-content/70'}>
        Sie können das exportierte PDF nach Ihren Wünschen gestalten.
        <br />
        Der Export-Vorgang kann je nach Anzahl der Rezepte einige Minuten dauern.
      </div>
      <div className={'flex flex-col gap-4'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'text-lg font-semibold'}>Inhalt</div>
          <div className={'flex flex-col gap-2 pl-2'}>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={exportImage} onChange={(e) => setExportImage(e.target.checked)} />
                <LabelText>Bild anzeigen</LabelText>
              </Label>
            </FormControl>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={exportDescription} onChange={(e) => setExportDescription(e.target.checked)} />
                <LabelText>Allgemeine Beschreibung anzeigen</LabelText>
              </Label>
            </FormControl>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={exportNotes} onChange={(e) => setExportNotes(e.target.checked)} />
                <LabelText>Zubereitungsnotizen anzeigen</LabelText>
              </Label>
            </FormControl>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={exportHistory} onChange={(e) => setExportHistory(e.target.checked)} />
                <LabelText>Geschichte und Entstehung anzeigen</LabelText>
              </Label>
            </FormControl>
          </div>
        </div>
        <Divider className="my-0" />
        <div className={'flex flex-col gap-2'}>
          <div className={'text-lg font-semibold'}>Layout</div>
          <div className={'flex flex-col gap-2 pl-2'}>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={newPagePerCocktail} onChange={(e) => setNewPagePerCocktail(e.target.checked)} />
                <LabelText>Neue Seite für jeden Cocktail</LabelText>
              </Label>
            </FormControl>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} />
                <LabelText>Header anzeigen</LabelText>
              </Label>
            </FormControl>
            <FormControl>
              <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                <Toggle checked={showFooter} onChange={(e) => setShowFooter(e.target.checked)} />
                <LabelText>Seitenzahl anzeigen</LabelText>
              </Label>
            </FormControl>
          </div>
        </div>
      </div>
      <div className={'flex justify-end gap-2'}>
        <Button
          variant="outline"
          className="border-error text-error hover:bg-error/10"
          type={'button'}
          onClick={() => {
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </Button>
        <Button variant="primary" type={'button'} onClick={handleExport}>
          Exportieren
        </Button>
      </div>
    </div>
  );
}
