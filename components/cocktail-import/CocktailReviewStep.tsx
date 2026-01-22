import React, { useEffect, useState } from 'react';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { alertService } from '@lib/alertService';
import { FaExclamationTriangle } from 'react-icons/fa';

interface CocktailMapping {
  exportId: string;
  decision: 'import' | 'skip' | 'rename' | 'overwrite';
  newName?: string;
  overwriteId?: string;
}

interface CocktailConflict {
  exportId: string;
  exportName: string;
  conflicts: Array<{ id: string; name: string }>;
}

interface CocktailReviewStepProps {
  workspaceId: string;
  exportData: CocktailExportStructure;
  selectedCocktailIds: Set<string>;
  onComplete: (cocktailMappings: CocktailMapping[]) => void;
  onBack: () => void;
}

export function CocktailReviewStep({ workspaceId, exportData, selectedCocktailIds, onComplete, onBack }: CocktailReviewStepProps) {
  const [loading, setLoading] = useState(true);
  const [cocktailMappings, setCocktailMappings] = useState<CocktailMapping[]>([]);
  const [conflicts, setConflicts] = useState<CocktailConflict[]>([]);

  useEffect(() => {
    const fetchConflicts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/import-json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phase: 'prepare-mapping',
            exportData,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          alertService.error(error.message || 'Fehler beim Laden der Konflikt-Daten');
          return;
        }

        const result = await response.json();
        setConflicts(result.cocktailConflicts);

        // Initialize mappings
        const selectedCocktails = exportData.cocktailRecipes.filter((c) => selectedCocktailIds.has(c.id));
        const initialMappings: CocktailMapping[] = selectedCocktails.map((cocktail) => {
          const conflict = result.cocktailConflicts.find((c: CocktailConflict) => c.exportId === cocktail.id);
          return {
            exportId: cocktail.id,
            decision: conflict && conflict.conflicts.length > 0 ? 'skip' : 'import',
          };
        });
        setCocktailMappings(initialMappings);
      } catch (error) {
        console.error('Conflict detection error:', error);
        alertService.error('Fehler beim Laden der Konflikt-Daten');
      } finally {
        setLoading(false);
      }
    };

    fetchConflicts();
  }, [workspaceId, exportData, selectedCocktailIds]);

  const handleDecisionChange = (exportId: string, decision: CocktailMapping['decision'], newName?: string, overwriteId?: string) => {
    setCocktailMappings((prev) =>
      prev.map((m) =>
        m.exportId === exportId
          ? {
              ...m,
              decision,
              newName: decision === 'rename' ? newName || m.newName : undefined,
              overwriteId: decision === 'overwrite' ? overwriteId || m.overwriteId : undefined,
            }
          : m,
      ),
    );
  };

  const getMapping = (exportId: string) => {
    return cocktailMappings.find((m) => m.exportId === exportId);
  };

  const getConflict = (exportId: string) => {
    return conflicts.find((c) => c.exportId === exportId);
  };

  const handleNext = () => {
    // Validate all conflicts are resolved
    const unresolvedConflicts = cocktailMappings.filter((m) => {
      const conflict = getConflict(m.exportId);
      return conflict && conflict.conflicts.length > 0 && m.decision === 'skip';
    });

    // Validate rename decisions have new names
    const invalidRenames = cocktailMappings.filter((m) => m.decision === 'rename' && !m.newName?.trim());
    if (invalidRenames.length > 0) {
      alertService.error('Bitte geben Sie für alle umzubenennenden Cocktails einen neuen Namen an');
      return;
    }

    // Validate overwrite decisions have selected cocktail
    const invalidOverwrites = cocktailMappings.filter((m) => m.decision === 'overwrite' && !m.overwriteId);
    if (invalidOverwrites.length > 0) {
      alertService.error('Bitte wählen Sie für alle zu überschreibenden Cocktails einen bestehenden Cocktail aus');
      return;
    }

    onComplete(cocktailMappings);
  };

  if (loading) {
    return (
      <div className={'flex flex-col items-center justify-center gap-4 py-8'}>
        <span className={'loading loading-spinner loading-lg'}></span>
        <span>Konflikte werden analysiert...</span>
      </div>
    );
  }

  const selectedCocktails = exportData.cocktailRecipes.filter((c) => selectedCocktailIds.has(c.id));
  const conflictCount = selectedCocktails.filter((c) => {
    const conflict = getConflict(c.id);
    return conflict && conflict.conflicts.length > 0;
  }).length;

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-lg font-semibold'}>Schritt 3: Cocktails überprüfen</div>
      <div className={'text-sm text-base-content/70'}>Überprüfen Sie die zu importierenden Cocktails und lösen Sie eventuelle Namenskonflikte.</div>

      {conflictCount > 0 && (
        <div className={'alert alert-warning'}>
          <FaExclamationTriangle />
          <span>
            {conflictCount} Cocktail{conflictCount > 1 ? 's haben' : ' hat'} Namenskonflikte und {conflictCount > 1 ? 'müssen' : 'muss'} überprüft werden
          </span>
        </div>
      )}

      <div className={'max-h-[400px] overflow-y-auto'}>
        <div className={'flex flex-col gap-3'}>
          {selectedCocktails.map((cocktail) => {
            const mapping = getMapping(cocktail.id);
            const conflict = getConflict(cocktail.id);
            const hasConflict = conflict && conflict.conflicts.length > 0;

            return (
              <div key={cocktail.id} className={`rounded-lg border ${hasConflict ? 'border-warning' : 'border-base-300'} p-3`}>
                <div className={'flex items-center justify-between'}>
                  <div className={'font-semibold'}>{cocktail.name}</div>
                  {hasConflict && <span className={'badge badge-warning badge-sm'}>Konflikt</span>}
                </div>

                {hasConflict && (
                  <div className={'mt-2 text-sm text-base-content/70'}>
                    Ein Cocktail mit diesem Namen existiert bereits: {conflict.conflicts.map((c) => c.name).join(', ')}
                  </div>
                )}

                <div className={'mt-3 flex flex-col gap-2'}>
                  <label className={'flex cursor-pointer items-center gap-2'}>
                    <input
                      type={'radio'}
                      className={'radio radio-sm'}
                      checked={mapping?.decision === 'import'}
                      onChange={() => handleDecisionChange(cocktail.id, 'import')}
                    />
                    <span className={'text-sm'}>{hasConflict ? 'Trotzdem importieren' : 'Importieren'}</span>
                  </label>

                  {hasConflict && (
                    <>
                      <label className={'flex cursor-pointer items-center gap-2'}>
                        <input
                          type={'radio'}
                          className={'radio radio-sm'}
                          checked={mapping?.decision === 'rename'}
                          onChange={() => handleDecisionChange(cocktail.id, 'rename')}
                        />
                        <span className={'text-sm'}>Umbenennen und importieren</span>
                      </label>

                      {mapping?.decision === 'rename' && (
                        <div className={'ml-6'}>
                          <input
                            type={'text'}
                            className={'input input-sm input-bordered w-full max-w-xs'}
                            placeholder={'Neuer Name'}
                            value={mapping.newName || ''}
                            onChange={(e) => handleDecisionChange(cocktail.id, 'rename', e.target.value)}
                          />
                        </div>
                      )}

                      <label className={'flex cursor-pointer items-center gap-2'}>
                        <input
                          type={'radio'}
                          className={'radio radio-sm'}
                          checked={mapping?.decision === 'overwrite'}
                          onChange={() => handleDecisionChange(cocktail.id, 'overwrite', undefined, conflict.conflicts[0]?.id)}
                        />
                        <span className={'text-sm text-error'}>Bestehenden Cocktail überschreiben (Warnung!)</span>
                      </label>

                      {mapping?.decision === 'overwrite' && (
                        <div className={'ml-6'}>
                          <select
                            className={'select select-bordered select-sm w-full max-w-xs'}
                            value={mapping.overwriteId || ''}
                            onChange={(e) => handleDecisionChange(cocktail.id, 'overwrite', undefined, e.target.value)}
                          >
                            {conflict.conflicts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className={'mt-1 text-xs text-error'}>
                            Achtung: Der ausgewählte Cocktail wird vollständig durch den importierten Cocktail ersetzt!
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <label className={'flex cursor-pointer items-center gap-2'}>
                    <input
                      type={'radio'}
                      className={'radio radio-sm'}
                      checked={mapping?.decision === 'skip'}
                      onChange={() => handleDecisionChange(cocktail.id, 'skip')}
                    />
                    <span className={'text-sm'}>Überspringen</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={'text-sm text-base-content/70'}>
        {cocktailMappings.filter((m) => m.decision !== 'skip').length} von {selectedCocktails.length} Cocktails werden importiert
      </div>

      <div className={'flex justify-end gap-2'}>
        <button className={'btn btn-outline'} onClick={onBack}>
          Zurück
        </button>
        <button className={'btn btn-primary'} onClick={handleNext}>
          Weiter
        </button>
      </div>
    </div>
  );
}
