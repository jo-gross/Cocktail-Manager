import React, { useState } from 'react';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { alertService } from '@lib/alertService';
import { FaUpload } from 'react-icons/fa';

interface UploadAndPreviewStepProps {
  workspaceId: string;
  onComplete: (data: CocktailExportStructure, selectedCocktailIds: Set<string>) => void;
  onCancel: () => void;
}

export function UploadAndPreviewStep({ workspaceId, onComplete, onCancel }: UploadAndPreviewStepProps) {
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<CocktailExportStructure | null>(null);
  const [selectedCocktailIds, setSelectedCocktailIds] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setValidationError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as CocktailExportStructure;

      // Validate with API
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/import-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phase: 'validate',
          exportData: data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setValidationError(error.message || 'Fehler bei der Validierung');
        alertService.error('Ungültige JSON-Datei');
        return;
      }

      const validationResult = await response.json();
      if (!validationResult.valid) {
        setValidationError(validationResult.errors?.join(', ') || 'Ungültige Struktur');
        alertService.error('Ungültige JSON-Datei');
        return;
      }

      setExportData(data);
      // Select all cocktails by default
      setSelectedCocktailIds(new Set(data.cocktailRecipes.map((c) => c.id)));
      alertService.success('Datei erfolgreich geladen');
    } catch (error) {
      console.error('File upload error:', error);
      setValidationError('Fehler beim Lesen der Datei');
      alertService.error('Fehler beim Lesen der Datei');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (cocktailId: string) => {
    const newSelected = new Set(selectedCocktailIds);
    if (newSelected.has(cocktailId)) {
      newSelected.delete(cocktailId);
    } else {
      newSelected.add(cocktailId);
    }
    setSelectedCocktailIds(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (!exportData) return;
    if (selectedCocktailIds.size === exportData.cocktailRecipes.length) {
      setSelectedCocktailIds(new Set());
    } else {
      setSelectedCocktailIds(new Set(exportData.cocktailRecipes.map((c) => c.id)));
    }
  };

  const handleNext = () => {
    if (!exportData) return;
    if (selectedCocktailIds.size === 0) {
      alertService.error('Bitte wählen Sie mindestens einen Cocktail aus');
      return;
    }
    onComplete(exportData, selectedCocktailIds);
  };

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-lg font-semibold'}>Schritt 1: Datei hochladen</div>

      {!exportData ? (
        <div className={'flex flex-col gap-4'}>
          <div className={'text-sm text-base-content/70'}>Laden Sie eine JSON-Datei hoch, die zuvor exportiert wurde.</div>

          <label
            className={`flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed border-base-300 p-8 transition-colors hover:border-primary ${loading ? 'opacity-50' : ''}`}
          >
            <FaUpload className={'text-4xl text-base-content/50'} />
            <div className={'text-center'}>
              <div className={'font-semibold'}>JSON-Datei hochladen</div>
              <div className={'text-sm text-base-content/70'}>Klicken Sie hier oder ziehen Sie eine Datei herein</div>
            </div>
            <input type={'file'} accept={'.json,application/json'} className={'hidden'} onChange={handleFileUpload} disabled={loading} />
          </label>

          {validationError && (
            <div className={'alert alert-error'}>
              <span>{validationError}</span>
            </div>
          )}

          {loading && (
            <div className={'flex items-center justify-center gap-2'}>
              <span className={'loading loading-spinner'}></span>
              <span>Datei wird geladen...</span>
            </div>
          )}
        </div>
      ) : (
        <div className={'flex flex-col gap-4'}>
          <div className={'rounded-lg bg-base-200 p-4'}>
            <div className={'text-sm font-semibold'}>Import-Details</div>
            <div className={'mt-2 text-sm text-base-content/70'}>
              <div>Quelle: {exportData.exportedFrom.workspaceName}</div>
              <div>Export-Datum: {new Date(exportData.exportDate).toLocaleString('de-DE')}</div>
              <div>Version: {exportData.exportVersion}</div>
              <div>Anzahl Cocktails: {exportData.cocktailRecipes.length}</div>
            </div>
          </div>

          <div className={'text-sm font-semibold'}>Cocktails auswählen</div>
          <div className={'text-sm text-base-content/70'}>Wählen Sie die Cocktails aus, die Sie importieren möchten.</div>

          <div className={'max-h-[300px] overflow-y-auto rounded-lg border border-base-300'}>
            <table className={'table table-sm'}>
              <thead>
                <tr>
                  <th>
                    <input
                      type={'checkbox'}
                      className={'checkbox checkbox-sm'}
                      checked={selectedCocktailIds.size === exportData.cocktailRecipes.length && exportData.cocktailRecipes.length > 0}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Glas</th>
                  <th>Preis</th>
                </tr>
              </thead>
              <tbody>
                {exportData.cocktailRecipes.map((cocktail) => {
                  const glass = exportData.glasses.find((g) => g.id === cocktail.glassId);
                  return (
                    <tr key={cocktail.id}>
                      <td>
                        <input
                          type={'checkbox'}
                          className={'checkbox checkbox-sm'}
                          checked={selectedCocktailIds.has(cocktail.id)}
                          onChange={() => handleToggleSelect(cocktail.id)}
                        />
                      </td>
                      <td>{cocktail.name}</td>
                      <td>{glass?.name || '-'}</td>
                      <td>{cocktail.price ? `${cocktail.price} €` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={'text-sm text-base-content/70'}>
            {selectedCocktailIds.size} von {exportData.cocktailRecipes.length} Cocktails ausgewählt
          </div>
        </div>
      )}

      <div className={'flex justify-end gap-2'}>
        <button className={'btn btn-outline btn-error'} onClick={onCancel}>
          Abbrechen
        </button>
        <button className={'btn btn-primary'} onClick={handleNext} disabled={!exportData || selectedCocktailIds.size === 0}>
          Weiter
        </button>
      </div>
    </div>
  );
}
