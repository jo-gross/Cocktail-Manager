import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { alertService } from '@lib/alertService';
import { FaExclamationTriangle } from 'react-icons/fa';
import { Alert, Badge, Button, Input, Loading, Radio, Select } from '@components/ui';

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
  const { t } = useTranslation(['import', 'common']);
  const [loading, setLoading] = useState(true);
  const [cocktailMappings, setCocktailMappings] = useState<CocktailMapping[]>([]);
  const [conflicts, setConflicts] = useState<CocktailConflict[]>([]);

  useEffect(() => {
    const fetchConflicts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/workspaces/${workspaceId}/cocktails/import/json`, {
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
          alertService.error(error.message || t('import:conflictLoadError'));
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
        alertService.error(t('import:conflictLoadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchConflicts();
  }, [workspaceId, exportData, selectedCocktailIds, t]);

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
    const _unresolvedConflicts = cocktailMappings.filter((m) => {
      const conflict = getConflict(m.exportId);
      return conflict && conflict.conflicts.length > 0 && m.decision === 'skip';
    });

    // Validate rename decisions have new names
    const invalidRenames = cocktailMappings.filter((m) => m.decision === 'rename' && !m.newName?.trim());
    if (invalidRenames.length > 0) {
      alertService.error(t('import:renameRequired'));
      return;
    }

    // Validate overwrite decisions have selected cocktail
    const invalidOverwrites = cocktailMappings.filter((m) => m.decision === 'overwrite' && !m.overwriteId);
    if (invalidOverwrites.length > 0) {
      alertService.error(t('import:overwriteRequired'));
      return;
    }

    onComplete(cocktailMappings);
  };

  if (loading) {
    return (
      <div className={'flex flex-col items-center justify-center gap-4 py-8'}>
        <Loading size="lg" />
        <span>{t('import:analyzingConflicts')}</span>
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
      <div className={'text-lg font-semibold'}>{t('import:step3Title')}</div>
      <div className={'text-sm text-base-content/70'}>{t('import:step3Description')}</div>

      {conflictCount > 0 && (
        <Alert variant="warning">
          <FaExclamationTriangle />
          <span>{t('import:conflictsNeedReview', { count: conflictCount })}</span>
        </Alert>
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
                  {hasConflict && (
                    <Badge variant="warning" size="sm">
                      {t('import:conflictBadge')}
                    </Badge>
                  )}
                </div>

                {hasConflict && (
                  <div className={'mt-2 text-sm text-base-content/70'}>
                    {t('import:nameExistsAlready', { names: conflict.conflicts.map((c) => c.name).join(', ') })}
                  </div>
                )}

                <div className={'mt-3 flex flex-col gap-2'}>
                  <label className={'flex cursor-pointer items-center gap-2'}>
                    <Radio radioSize="sm" checked={mapping?.decision === 'import'} onChange={() => handleDecisionChange(cocktail.id, 'import')} />
                    <span className={'text-sm'}>{hasConflict ? t('import:importAnyway') : t('import:importAction')}</span>
                  </label>

                  {hasConflict && (
                    <>
                      <label className={'flex cursor-pointer items-center gap-2'}>
                        <Radio radioSize="sm" checked={mapping?.decision === 'rename'} onChange={() => handleDecisionChange(cocktail.id, 'rename')} />
                        <span className={'text-sm'}>{t('import:renameAndImport')}</span>
                      </label>

                      {mapping?.decision === 'rename' && (
                        <div className={'ml-6'}>
                          <Input
                            type={'text'}
                            inputSize="sm"
                            className="w-full max-w-xs"
                            placeholder={t('import:newNamePlaceholder')}
                            value={mapping.newName || ''}
                            onChange={(e) => handleDecisionChange(cocktail.id, 'rename', e.target.value)}
                          />
                        </div>
                      )}

                      <label className={'flex cursor-pointer items-center gap-2'}>
                        <Radio
                          radioSize="sm"
                          checked={mapping?.decision === 'overwrite'}
                          onChange={() => handleDecisionChange(cocktail.id, 'overwrite', undefined, conflict.conflicts[0]?.id)}
                        />
                        <span className={'text-sm text-error'}>{t('import:overwriteExisting')}</span>
                      </label>

                      {mapping?.decision === 'overwrite' && (
                        <div className={'ml-6'}>
                          <Select
                            selectSize="sm"
                            className="w-full max-w-xs"
                            value={mapping.overwriteId || ''}
                            onChange={(e) => handleDecisionChange(cocktail.id, 'overwrite', undefined, e.target.value)}
                          >
                            {conflict.conflicts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                          <div className={'mt-1 text-xs text-error'}>{t('import:overwriteWarning')}</div>
                        </div>
                      )}
                    </>
                  )}

                  <label className={'flex cursor-pointer items-center gap-2'}>
                    <Radio radioSize="sm" checked={mapping?.decision === 'skip'} onChange={() => handleDecisionChange(cocktail.id, 'skip')} />
                    <span className={'text-sm'}>{t('import:skip')}</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={'text-sm text-base-content/70'}>
        {t('import:willImport', {
          count: cocktailMappings.filter((m) => m.decision !== 'skip').length,
          total: selectedCocktails.length,
        })}
      </div>

      <div className={'flex justify-end gap-2'}>
        <Button variant="outline" onClick={onBack}>
          {t('common:back')}
        </Button>
        <Button variant="primary" onClick={handleNext}>
          {t('common:next')}
        </Button>
      </div>
    </div>
  );
}
