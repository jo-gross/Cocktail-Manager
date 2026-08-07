import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { alertService } from '@lib/alertService';
import { toIntlLocale } from '@lib/i18n/format';
import { FaUpload } from 'react-icons/fa';
import { Alert, Button, Card, CardBody, Checkbox, Loading, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';

interface UploadAndPreviewStepProps {
  workspaceId: string;
  onComplete: (data: CocktailExportStructure, selectedCocktailIds: Set<string>) => void;
  onCancel: () => void;
}

export function UploadAndPreviewStep({ workspaceId, onComplete, onCancel }: UploadAndPreviewStepProps) {
  const { t, i18n } = useTranslation(['import', 'common', 'cocktail', 'errors']);
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
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/cocktails/import/json`, {
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
        setValidationError(error.message || t('errors:generic'));
        alertService.error(t('errors:invalidJson'));
        return;
      }

      const validationResult = await response.json();
      if (!validationResult.valid) {
        setValidationError(validationResult.errors?.join(', ') || t('errors:invalidStructure'));
        alertService.error(t('errors:invalidJson'));
        return;
      }

      setExportData(data);
      // Select all cocktails by default
      setSelectedCocktailIds(new Set(data.cocktailRecipes.map((c) => c.id)));
      alertService.success(t('import:fileLoaded'));
    } catch (error) {
      console.error('File upload error:', error);
      setValidationError(t('import:fileReadError'));
      alertService.error(t('import:fileReadError'));
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
      alertService.error(t('errors:selectAtLeastOneCocktail'));
      return;
    }
    onComplete(exportData, selectedCocktailIds);
  };

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-lg font-semibold'}>{t('import:step1Title')}</div>

      {!exportData ? (
        <div className={'flex flex-col gap-4'}>
          <div className={'text-sm text-base-content/70'}>{t('import:step1Description')}</div>

          <label
            className={`flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed border-base-300 p-8 transition-colors hover:border-primary ${loading ? 'opacity-50' : ''}`}
          >
            <FaUpload className={'text-4xl text-base-content/50'} />
            <div className={'text-center'}>
              <div className={'font-semibold'}>{t('import:uploadJson')}</div>
              <div className={'text-sm text-base-content/70'}>{t('import:uploadHint')}</div>
            </div>
            <input type={'file'} accept={'.json,application/json'} className={'hidden'} onChange={handleFileUpload} disabled={loading} />
          </label>

          {validationError && (
            <Alert variant="error">
              <span>{validationError}</span>
            </Alert>
          )}

          {loading && (
            <div className={'flex items-center justify-center gap-2'}>
              <Loading />
              <span>{t('import:fileLoading')}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={'flex flex-col gap-4'}>
          <Card variant="elevated">
            <CardBody>
              <div className={'text-sm font-semibold'}>{t('import:importDetails')}</div>
              <div className={'mt-2 text-sm text-base-content/70'}>
                <div>{t('import:source', { name: exportData.exportedFrom.workspaceName })}</div>
                <div>
                  {t('import:exportDate', {
                    date: new Date(exportData.exportDate).toLocaleString(toIntlLocale(i18n.language)),
                  })}
                </div>
                <div>{t('import:version', { version: exportData.exportVersion })}</div>
                <div>{t('import:cocktailCount', { count: exportData.cocktailRecipes.length })}</div>
              </div>
            </CardBody>
          </Card>

          <div className={'text-sm font-semibold'}>{t('import:selectCocktails')}</div>
          <div className={'text-sm text-base-content/70'}>{t('import:selectCocktailsHint')}</div>

          <div className={'max-h-[300px] overflow-y-auto rounded-lg border border-base-300'}>
            <Table compact>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>
                    <Checkbox
                      checkboxSize="sm"
                      checked={selectedCocktailIds.size === exportData.cocktailRecipes.length && exportData.cocktailRecipes.length > 0}
                      onChange={handleToggleSelectAll}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>{t('common:name')}</TableHeaderCell>
                  <TableHeaderCell>{t('cocktail:glass')}</TableHeaderCell>
                  <TableHeaderCell>{t('common:price')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exportData.cocktailRecipes.map((cocktail) => {
                  const glass = exportData.glasses.find((g) => g.id === cocktail.glassId);
                  return (
                    <TableRow key={cocktail.id}>
                      <TableCell>
                        <Checkbox checkboxSize="sm" checked={selectedCocktailIds.has(cocktail.id)} onChange={() => handleToggleSelect(cocktail.id)} />
                      </TableCell>
                      <TableCell>{cocktail.name}</TableCell>
                      <TableCell>{glass?.name || '-'}</TableCell>
                      <TableCell>{cocktail.price ? t('common:euroValue', { value: cocktail.price }) : '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className={'text-sm text-base-content/70'}>
            {t('import:selectedOfTotal', {
              selected: selectedCocktailIds.size,
              total: exportData.cocktailRecipes.length,
            })}
          </div>
        </div>
      )}

      <div className={'flex justify-end gap-2'}>
        <Button variant="outline" className="border-error text-error hover:bg-error/10" onClick={onCancel}>
          {t('common:cancel')}
        </Button>
        <Button variant="primary" onClick={handleNext} disabled={!exportData || selectedCocktailIds.size === 0}>
          {t('common:next')}
        </Button>
      </div>
    </div>
  );
}
