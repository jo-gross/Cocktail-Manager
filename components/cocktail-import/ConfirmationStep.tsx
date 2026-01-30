import React, { useState } from 'react';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { MappingDecisions } from '../modals/CocktailImportWizardModal';
import { alertService } from '@lib/alertService';
import { FaCheckCircle, FaExclamationCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';

interface ConfirmationStepProps {
  workspaceId: string;
  exportData: CocktailExportStructure;
  mappingDecisions: MappingDecisions;
  selectedCocktailIds: Set<string>;
  onComplete: () => void;
  onBack: () => void;
}

interface ImportError {
  step: string;
  entityType: string;
  entityName: string;
  error: string;
}

export function ConfirmationStep({ workspaceId, exportData, mappingDecisions, selectedCocktailIds, onComplete, onBack }: ConfirmationStepProps) {
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showDetailsCollapsed, setShowDetailsCollapsed] = useState(false);

  const selectedCocktails = exportData.cocktailRecipes.filter((c) => selectedCocktailIds.has(c.id));
  const cocktailsToImport = mappingDecisions.cocktails.filter((m) => m.decision !== 'skip').length;

  // Calculate what will be created
  const newGlasses = mappingDecisions.glasses.filter((m) => m.decision === 'create-new');
  const newGarnishes = mappingDecisions.garnishes.filter((m) => m.decision === 'create-new');
  const newIngredients = mappingDecisions.ingredients.filter((m) => m.decision === 'create-new');
  const newUnits = mappingDecisions.units.filter((m) => m.decision === 'create-new');
  const newIce = mappingDecisions.ice.filter((m) => m.decision === 'create-new');
  const newStepActions = mappingDecisions.stepActions.filter((m) => m.decision === 'create-new');

  // Get entity names for display
  const getEntityName = (exportId: string, entityType: 'glasses' | 'garnishes' | 'ingredients' | 'units' | 'ice' | 'stepActions') => {
    const entity = exportData[entityType].find((e: any) => e.id === exportId);
    return entity?.name || exportId;
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setErrors([]);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/import-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phase: 'execute',
          exportData,
          mappingDecisions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Fehler beim Importieren');
        if (errorData.errors && Array.isArray(errorData.errors)) {
          setErrors(errorData.errors);
        }
        alertService.error(errorData.message || 'Fehler beim Importieren der Cocktails');
        return;
      }

      const result = await response.json();
      setImportResult(result);
      setImportComplete(true);
      alertService.success('Cocktails erfolgreich importiert');
    } catch (err) {
      console.error('Import error:', err);
      setError('Fehler beim Importieren der Cocktails');
      alertService.error('Fehler beim Importieren der Cocktails');
    } finally {
      setImporting(false);
    }
  };

  if (importComplete && importResult) {
    return (
      <div className={'flex flex-col gap-4'}>
        <div className={'text-lg font-semibold'}>Import erfolgreich!</div>

        <div className={'flex items-center justify-center'}>
          <FaCheckCircle className={'text-6xl text-success'} />
        </div>

        <div className={'rounded-lg bg-base-200 p-4'}>
          <div className={'text-sm font-semibold'}>Zusammenfassung</div>
          <div className={'mt-2 grid grid-cols-2 gap-2 text-sm'}>
            <div className={'text-base-content/70'}>Cocktails importiert:</div>
            <div className={'font-semibold'}>{importResult.imported.cocktails}</div>

            {importResult.created.glasses > 0 && (
              <>
                <div className={'text-base-content/70'}>Neue Gläser:</div>
                <div className={'font-semibold'}>{importResult.created.glasses}</div>
              </>
            )}

            {importResult.created.garnishes > 0 && (
              <>
                <div className={'text-base-content/70'}>Neue Garnituren:</div>
                <div className={'font-semibold'}>{importResult.created.garnishes}</div>
              </>
            )}

            {importResult.created.ingredients > 0 && (
              <>
                <div className={'text-base-content/70'}>Neue Zutaten:</div>
                <div className={'font-semibold'}>{importResult.created.ingredients}</div>
              </>
            )}

            {importResult.created.units > 0 && (
              <>
                <div className={'text-base-content/70'}>Neue Einheiten:</div>
                <div className={'font-semibold'}>{importResult.created.units}</div>
              </>
            )}

            {importResult.created.ice > 0 && (
              <>
                <div className={'text-base-content/70'}>Neue Eis-Typen:</div>
                <div className={'font-semibold'}>{importResult.created.ice}</div>
              </>
            )}

            {importResult.created.stepActions > 0 && (
              <>
                <div className={'text-base-content/70'}>Neue Aktionen:</div>
                <div className={'font-semibold'}>{importResult.created.stepActions}</div>
              </>
            )}
          </div>
        </div>

        <div className={'flex justify-end gap-2'}>
          <button className={'btn btn-primary'} onClick={onComplete}>
            Fertig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-lg font-semibold'}>Schritt 4: Import bestätigen</div>
      <div className={'text-sm text-base-content/70'}>Überprüfen Sie die Import-Zusammenfassung und bestätigen Sie den Import.</div>

      <div className={'rounded-lg bg-base-200 p-4'}>
        <div className={'mb-3 text-sm font-semibold'}>Import-Zusammenfassung</div>
        <div className={'grid grid-cols-2 gap-2 text-sm'}>
          <div className={'text-base-content/70'}>Cocktails zu importieren:</div>
          <div className={'font-semibold'}>{cocktailsToImport}</div>

          {newGlasses.length > 0 && (
            <>
              <div className={'text-base-content/70'}>Neue Gläser:</div>
              <div className={'font-semibold'}>{newGlasses.length}</div>
            </>
          )}

          {newGarnishes.length > 0 && (
            <>
              <div className={'text-base-content/70'}>Neue Garnituren:</div>
              <div className={'font-semibold'}>{newGarnishes.length}</div>
            </>
          )}

          {newIngredients.length > 0 && (
            <>
              <div className={'text-base-content/70'}>Neue Zutaten:</div>
              <div className={'font-semibold'}>{newIngredients.length}</div>
            </>
          )}

          {newUnits.length > 0 && (
            <>
              <div className={'text-base-content/70'}>Neue Einheiten:</div>
              <div className={'font-semibold'}>{newUnits.length}</div>
            </>
          )}

          {newIce.length > 0 && (
            <>
              <div className={'text-base-content/70'}>Neue Eis-Typen:</div>
              <div className={'font-semibold'}>{newIce.length}</div>
            </>
          )}

          {newStepActions.length > 0 && (
            <>
              <div className={'text-base-content/70'}>Neue Aktionen:</div>
              <div className={'font-semibold'}>{newStepActions.length}</div>
            </>
          )}
        </div>
      </div>

      {/* Detailed Preview */}
      <div className={'rounded-lg border border-base-300'}>
        <div className={'flex cursor-pointer items-center justify-between bg-base-200 p-3'} onClick={() => setShowDetailsCollapsed(!showDetailsCollapsed)}>
          <span className={'text-sm font-semibold'}>Details anzeigen</span>
          {showDetailsCollapsed ? <FaChevronDown /> : <FaChevronUp />}
        </div>
        {!showDetailsCollapsed && (
          <div className={'max-h-[300px] overflow-y-auto p-3'}>
            {newUnits.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Neue Einheiten ({newUnits.length}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newUnits.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'units')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newIce.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Neue Eis-Typen ({newIce.length}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newIce.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'ice')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newStepActions.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Neue Aktionen ({newStepActions.length}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newStepActions.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'stepActions')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newGlasses.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Neue Gläser ({newGlasses.length}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newGlasses.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'glasses')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newGarnishes.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Neue Garnituren ({newGarnishes.length}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newGarnishes.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'garnishes')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newIngredients.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Neue Zutaten ({newIngredients.length}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newIngredients.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'ingredients')}</li>
                  ))}
                </ul>
              </div>
            )}

            {cocktailsToImport > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">Cocktails ({cocktailsToImport}):</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {mappingDecisions.cocktails
                    .filter((m) => m.decision !== 'skip')
                    .map((m) => {
                      const cocktail = exportData.cocktailRecipes.find((c) => c.id === m.exportId);
                      if (!cocktail) return null;
                      let label = cocktail.name;
                      if (m.decision === 'rename' && m.newName) {
                        label = `${cocktail.name} → ${m.newName}`;
                      } else if (m.decision === 'overwrite') {
                        label = `${cocktail.name} (überschreibt bestehenden)`;
                      }
                      return <li key={m.exportId}>{label}</li>;
                    })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {error && !errors.length && (
        <div className={'alert alert-error'}>
          <FaExclamationCircle />
          <span>{error}</span>
        </div>
      )}

      {errors.length > 0 && (
        <div className={'alert alert-error'}>
          <div className="flex w-full flex-col">
            <div className="mb-2 flex items-center gap-2">
              <FaExclamationCircle />
              <span className="font-semibold">Import-Fehler aufgetreten:</span>
            </div>
            <ul className="ml-4 list-inside list-disc text-sm">
              {errors.map((err, index) => (
                <li key={index}>
                  <span className="font-semibold">{err.entityType}:</span> {err.entityName} - {err.error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {importing ? (
        <div className={'flex flex-col items-center justify-center gap-4 py-8'}>
          <span className={'loading loading-spinner loading-lg'}></span>
          <span>Import läuft... Bitte warten Sie.</span>
          <div className={'text-xs text-base-content/50'}>Dies kann je nach Anzahl der Cocktails einige Sekunden dauern.</div>
        </div>
      ) : (
        <div className={'flex justify-end gap-2'}>
          <button className={'btn btn-outline'} onClick={onBack} disabled={importing}>
            Zurück
          </button>
          <button className={'btn btn-primary'} onClick={handleImport} disabled={importing}>
            Import starten
          </button>
        </div>
      )}
    </div>
  );
}
