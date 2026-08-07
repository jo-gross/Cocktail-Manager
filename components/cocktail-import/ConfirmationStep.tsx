import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { MappingDecisions } from '../modals/CocktailImportWizardModal';
import { alertService } from '@lib/alertService';
import { FaCheckCircle, FaExclamationCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Alert, Button, Card, CardBody, Loading } from '@components/ui';

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

interface ImportResult {
  imported: { cocktails: number };
  created: {
    glasses: number;
    garnishes: number;
    ingredients: number;
    units: number;
    ice: number;
    stepActions: number;
  };
}

export function ConfirmationStep({ workspaceId, exportData, mappingDecisions, selectedCocktailIds, onComplete, onBack }: ConfirmationStepProps) {
  const { t } = useTranslation(['import', 'common', 'errors']);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showDetailsCollapsed, setShowDetailsCollapsed] = useState(false);

  const _selectedCocktails = exportData.cocktailRecipes.filter((c) => selectedCocktailIds.has(c.id));
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
    const entity = exportData[entityType].find((e: { id: string; name: string; [key: string]: unknown }) => e.id === exportId);
    return entity?.name || exportId;
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setErrors([]);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/cocktails/import/json`, {
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
        setError(errorData.message || t('errors:import'));
        if (errorData.errors && Array.isArray(errorData.errors)) {
          setErrors(errorData.errors);
        }
        alertService.error(errorData.message || t('import:importFailed'));
        return;
      }

      const result = await response.json();
      setImportResult(result);
      setImportComplete(true);
      alertService.success(t('import:importSuccessToast'));
    } catch (err) {
      console.error('Import error:', err);
      setError(t('import:importFailed'));
      alertService.error(t('import:importFailed'));
    } finally {
      setImporting(false);
    }
  };

  if (importComplete && importResult) {
    return (
      <div className={'flex flex-col gap-4'}>
        <div className={'text-lg font-semibold'}>{t('import:importSuccess')}</div>

        <div className={'flex items-center justify-center'}>
          <FaCheckCircle className={'text-6xl text-success'} />
        </div>

        <Card variant="elevated">
          <CardBody>
            <div className={'text-sm font-semibold'}>{t('import:summary')}</div>
            <div className={'mt-2 grid grid-cols-2 gap-2 text-sm'}>
              <div className={'text-base-content/70'}>{t('import:cocktailsImported')}</div>
              <div className={'font-semibold'}>{importResult.imported.cocktails}</div>

              {importResult.created.glasses > 0 && (
                <>
                  <div className={'text-base-content/70'}>{t('import:newGlasses')}</div>
                  <div className={'font-semibold'}>{importResult.created.glasses}</div>
                </>
              )}

              {importResult.created.garnishes > 0 && (
                <>
                  <div className={'text-base-content/70'}>{t('import:newGarnishes')}</div>
                  <div className={'font-semibold'}>{importResult.created.garnishes}</div>
                </>
              )}

              {importResult.created.ingredients > 0 && (
                <>
                  <div className={'text-base-content/70'}>{t('import:newIngredients')}</div>
                  <div className={'font-semibold'}>{importResult.created.ingredients}</div>
                </>
              )}

              {importResult.created.units > 0 && (
                <>
                  <div className={'text-base-content/70'}>{t('import:newUnits')}</div>
                  <div className={'font-semibold'}>{importResult.created.units}</div>
                </>
              )}

              {importResult.created.ice > 0 && (
                <>
                  <div className={'text-base-content/70'}>{t('import:newIceTypes')}</div>
                  <div className={'font-semibold'}>{importResult.created.ice}</div>
                </>
              )}

              {importResult.created.stepActions > 0 && (
                <>
                  <div className={'text-base-content/70'}>{t('import:newActions')}</div>
                  <div className={'font-semibold'}>{importResult.created.stepActions}</div>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        <div className={'flex justify-end gap-2'}>
          <Button variant="primary" onClick={onComplete}>
            {t('common:done')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-lg font-semibold'}>{t('import:step4Title')}</div>
      <div className={'text-sm text-base-content/70'}>{t('import:step4Description')}</div>

      <Card variant="elevated">
        <CardBody>
          <div className={'mb-3 text-sm font-semibold'}>{t('import:importSummary')}</div>
          <div className={'grid grid-cols-2 gap-2 text-sm'}>
            <div className={'text-base-content/70'}>{t('import:cocktailsToImport')}</div>
            <div className={'font-semibold'}>{cocktailsToImport}</div>

            {newGlasses.length > 0 && (
              <>
                <div className={'text-base-content/70'}>{t('import:newGlasses')}</div>
                <div className={'font-semibold'}>{newGlasses.length}</div>
              </>
            )}

            {newGarnishes.length > 0 && (
              <>
                <div className={'text-base-content/70'}>{t('import:newGarnishes')}</div>
                <div className={'font-semibold'}>{newGarnishes.length}</div>
              </>
            )}

            {newIngredients.length > 0 && (
              <>
                <div className={'text-base-content/70'}>{t('import:newIngredients')}</div>
                <div className={'font-semibold'}>{newIngredients.length}</div>
              </>
            )}

            {newUnits.length > 0 && (
              <>
                <div className={'text-base-content/70'}>{t('import:newUnits')}</div>
                <div className={'font-semibold'}>{newUnits.length}</div>
              </>
            )}

            {newIce.length > 0 && (
              <>
                <div className={'text-base-content/70'}>{t('import:newIceTypes')}</div>
                <div className={'font-semibold'}>{newIce.length}</div>
              </>
            )}

            {newStepActions.length > 0 && (
              <>
                <div className={'text-base-content/70'}>{t('import:newActions')}</div>
                <div className={'font-semibold'}>{newStepActions.length}</div>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Detailed Preview */}
      <div className={'rounded-lg border border-base-300'}>
        <div
          className={'flex cursor-pointer items-center justify-between border-b border-base-300/60 bg-base-100 px-3 py-3 md:px-4'}
          onClick={() => setShowDetailsCollapsed(!showDetailsCollapsed)}
        >
          <span className={'text-sm font-semibold'}>{t('import:showDetails')}</span>
          {showDetailsCollapsed ? <FaChevronDown /> : <FaChevronUp />}
        </div>
        {!showDetailsCollapsed && (
          <div className={'max-h-[300px] overflow-y-auto p-3'}>
            {newUnits.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:newUnitsCount', { count: newUnits.length })}</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newUnits.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'units')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newIce.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:newIceTypesCount', { count: newIce.length })}</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newIce.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'ice')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newStepActions.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:newActionsCount', { count: newStepActions.length })}</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newStepActions.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'stepActions')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newGlasses.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:newGlassesCount', { count: newGlasses.length })}</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newGlasses.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'glasses')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newGarnishes.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:newGarnishesCount', { count: newGarnishes.length })}</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newGarnishes.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'garnishes')}</li>
                  ))}
                </ul>
              </div>
            )}

            {newIngredients.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:newIngredientsCount', { count: newIngredients.length })}</div>
                <ul className="ml-2 list-inside list-disc text-xs">
                  {newIngredients.map((m) => (
                    <li key={m.exportId}>{getEntityName(m.exportId, 'ingredients')}</li>
                  ))}
                </ul>
              </div>
            )}

            {cocktailsToImport > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold">{t('import:cocktailsCount', { count: cocktailsToImport })}</div>
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
                        label = `${cocktail.name} ${t('import:overwritesExisting')}`;
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
        <Alert variant="error">
          <FaExclamationCircle />
          <span>{error}</span>
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert variant="error">
          <div className="flex w-full flex-col">
            <div className="mb-2 flex items-center gap-2">
              <FaExclamationCircle />
              <span className="font-semibold">{t('import:importErrors')}</span>
            </div>
            <ul className="ml-4 list-inside list-disc text-sm">
              {errors.map((err, index) => (
                <li key={index}>
                  <span className="font-semibold">{err.entityType}:</span> {err.entityName} - {err.error}
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {importing ? (
        <div className={'flex flex-col items-center justify-center gap-4 py-8'}>
          <Loading size="lg" />
          <span>{t('import:importRunning')}</span>
          <div className={'text-xs text-base-content/50'}>{t('import:importRunningHint')}</div>
        </div>
      ) : (
        <div className={'flex justify-end gap-2'}>
          <Button variant="outline" onClick={onBack} disabled={importing}>
            {t('common:back')}
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={importing}>
            {t('import:startImport')}
          </Button>
        </div>
      )}
    </div>
  );
}
