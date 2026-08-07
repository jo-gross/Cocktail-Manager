import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { alertService } from '@lib/alertService';
import { EntityMappingSection } from './EntityMappingSection';
import { Button, Loading } from '@components/ui';

interface EntityMapping {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
}

interface CocktailMapping {
  exportId: string;
  decision: 'import' | 'skip' | 'rename' | 'overwrite';
  newName?: string;
  overwriteId?: string;
}

interface EntityMatchResult {
  exportId: string;
  exportName: string;
  matches: Array<{ id: string; name: string; actionGroup?: string }>;
}

interface ExistingMatchesMap {
  units: EntityMatchResult[];
  ice: EntityMatchResult[];
  stepActions: EntityMatchResult[];
  glasses: EntityMatchResult[];
  garnishes: EntityMatchResult[];
  ingredients: EntityMatchResult[];
}

export interface MappingDecisions {
  glasses: EntityMapping[];
  garnishes: EntityMapping[];
  ingredients: EntityMapping[];
  units: EntityMapping[];
  ice: EntityMapping[];
  stepActions: EntityMapping[];
  cocktails: CocktailMapping[];
}

interface EntityMappingStepProps {
  workspaceId: string;
  exportData: CocktailExportStructure;
  selectedCocktailIds: Set<string>;
  onComplete: (decisions: MappingDecisions) => void;
  onBack: () => void;
}

export function EntityMappingStep({ workspaceId, exportData, selectedCocktailIds: _selectedCocktailIds, onComplete, onBack }: EntityMappingStepProps) {
  const { t } = useTranslation(['import', 'common']);
  const [loading, setLoading] = useState(true);
  const [glassMappings, setGlassMappings] = useState<EntityMapping[]>([]);
  const [garnishMappings, setGarnishMappings] = useState<EntityMapping[]>([]);
  const [ingredientMappings, setIngredientMappings] = useState<EntityMapping[]>([]);
  const [unitMappings, setUnitMappings] = useState<EntityMapping[]>([]);
  const [iceMappings, setIceMappings] = useState<EntityMapping[]>([]);
  const [stepActionMappings, setStepActionMappings] = useState<EntityMapping[]>([]);

  const [existingMatches, setExistingMatches] = useState<ExistingMatchesMap | null>(null);

  useEffect(() => {
    const fetchMappingData = async () => {
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
          alertService.error(error.message || t('import:mappingLoadError'));
          return;
        }

        const result = await response.json();
        setExistingMatches(result.existingMatches);

        // Set auto-mappings
        setGlassMappings(result.autoMappings.glasses);
        setGarnishMappings(result.autoMappings.garnishes);
        setIngredientMappings(result.autoMappings.ingredients);
        setUnitMappings(result.autoMappings.units);
        setIceMappings(result.autoMappings.ice);
        setStepActionMappings(result.autoMappings.stepActions);
      } catch (error) {
        console.error('Mapping preparation error:', error);
        alertService.error(t('import:mappingLoadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchMappingData();
  }, [workspaceId, exportData, t]);

  const handleNext = () => {
    const decisions: MappingDecisions = {
      glasses: glassMappings,
      garnishes: garnishMappings,
      ingredients: ingredientMappings,
      units: unitMappings,
      ice: iceMappings,
      stepActions: stepActionMappings,
      cocktails: [],
    };
    onComplete(decisions);
  };

  if (loading) {
    return (
      <div className={'flex flex-col items-center justify-center gap-4 py-8'}>
        <Loading size="lg" />
        <span>{t('import:mappingLoading')}</span>
      </div>
    );
  }

  const autoMatchedCount = {
    glasses: glassMappings.filter((m) => m.decision === 'use-existing').length,
    garnishes: garnishMappings.filter((m) => m.decision === 'use-existing').length,
    ingredients: ingredientMappings.filter((m) => m.decision === 'use-existing').length,
    units: unitMappings.filter((m) => m.decision === 'use-existing').length,
    ice: iceMappings.filter((m) => m.decision === 'use-existing').length,
    stepActions: stepActionMappings.filter((m) => m.decision === 'use-existing').length,
  };

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-lg font-semibold'}>{t('import:step2Title')}</div>
      <div className={'text-sm text-base-content/70'}>
        {t('import:step2Description')}
        <br />
        {t('import:step2AutoMatch')}
      </div>

      <div className={'max-h-[400px] overflow-y-auto'}>
        <div className={'flex flex-col gap-4'}>
          {exportData.units.length > 0 && (
            <EntityMappingSection
              title={t('import:unitsTitle')}
              entityType={'units'}
              entities={exportData.units}
              mappings={unitMappings}
              existingMatches={existingMatches?.units || []}
              autoMatchedCount={autoMatchedCount.units}
              onMappingsChange={setUnitMappings}
            />
          )}

          {exportData.ice.length > 0 && (
            <EntityMappingSection
              title={t('import:iceTitle')}
              entityType={'ice'}
              entities={exportData.ice}
              mappings={iceMappings}
              existingMatches={existingMatches?.ice || []}
              autoMatchedCount={autoMatchedCount.ice}
              onMappingsChange={setIceMappings}
            />
          )}

          {exportData.stepActions.length > 0 && (
            <EntityMappingSection
              title={t('import:actionsTitle')}
              entityType={'stepActions'}
              entities={exportData.stepActions}
              mappings={stepActionMappings}
              existingMatches={existingMatches?.stepActions || []}
              autoMatchedCount={autoMatchedCount.stepActions}
              onMappingsChange={setStepActionMappings}
            />
          )}

          {exportData.glasses.length > 0 && (
            <EntityMappingSection
              title={t('import:glassesTitle')}
              entityType={'glasses'}
              entities={exportData.glasses}
              mappings={glassMappings}
              existingMatches={existingMatches?.glasses || []}
              autoMatchedCount={autoMatchedCount.glasses}
              onMappingsChange={setGlassMappings}
            />
          )}

          {exportData.garnishes.length > 0 && (
            <EntityMappingSection
              title={t('import:garnishesTitle')}
              entityType={'garnishes'}
              entities={exportData.garnishes}
              mappings={garnishMappings}
              existingMatches={existingMatches?.garnishes || []}
              autoMatchedCount={autoMatchedCount.garnishes}
              onMappingsChange={setGarnishMappings}
            />
          )}

          {exportData.ingredients.length > 0 && (
            <EntityMappingSection
              title={t('import:ingredientsTitle')}
              entityType={'ingredients'}
              entities={exportData.ingredients}
              mappings={ingredientMappings}
              existingMatches={existingMatches?.ingredients || []}
              autoMatchedCount={autoMatchedCount.ingredients}
              onMappingsChange={setIngredientMappings}
            />
          )}
        </div>
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
