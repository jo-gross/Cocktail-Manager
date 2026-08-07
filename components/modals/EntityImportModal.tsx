import React, { useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { FaUpload, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { EntityCombobox } from '../cocktail-import/EntityCombobox';
import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Input,
  Label,
  Loading,
  Radio,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@components/ui';

// ────────────── Types ──────────────

interface EntityImportModalProps {
  workspaceId: string;
  entityType: 'glasses' | 'garnishes' | 'ingredients' | 'calculations';
  onImportComplete: () => void;
}

interface ParsedEntity {
  name: string;
  data: Record<string, unknown>;
  valid: boolean;
  selected: boolean;
}

interface Conflict {
  id: string;
  name: string;
}

interface MappingEntity {
  name: string;
  data: Record<string, unknown>;
  conflicts: Conflict[];
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  groupDecision?: 'keep-exported' | 'use-existing' | 'create-new' | 'no-group';
  existingGroupId?: string;
  newGroupName?: string;
  newGroupDefaultExpanded?: boolean;
  exportedGroupName?: string | null;
}

interface DependencyMatch {
  exportName: string;
  autoMatch: { id: string; name: string } | null;
  options: Array<{ id: string; name: string }>;
}

interface DependencyMapping {
  exportName: string;
  decision: 'use-existing' | 'skip';
  existingId?: string;
}

interface ImportResult {
  name: string;
  status: string;
  message?: string;
}

interface CalculationGroupOption {
  id: string;
  name: string;
  isDefaultExpanded: boolean;
}

// ────────────── Constants ──────────────

const ENTITY_LABEL_KEYS = {
  glasses: { singularKey: 'glass', pluralKey: 'glasses', nameKey: 'glass' },
  garnishes: { singularKey: 'garnish', pluralKey: 'garnishes', nameKey: 'garnish' },
  ingredients: { singularKey: 'ingredient', pluralKey: 'ingredients', nameKey: 'ingredient' },
  calculations: { singularKey: 'calculation', pluralKey: 'calculations', nameKey: 'calculation' },
} as const;

// ────────────── Dependency Mapping Section (matches EntityMappingSection design) ──────────────

interface DependencyMappingSectionProps {
  type: 'cocktail' | 'ingredient' | 'unit';
  title: string;
  matches: DependencyMatch[];
  mappings: DependencyMapping[];
  onUpdate: (exportName: string, existingId: string | null) => void;
  fetchUrl: string;
  placeholder: string;
  workspaceId: string;
  autoMatchedCount: number;
  defaultCollapsed: boolean;
  isAutoMatched: (type: 'cocktail' | 'ingredient' | 'unit', exportName: string) => boolean;
  resetToAutoMatch: (type: 'cocktail' | 'ingredient' | 'unit', exportName: string) => void;
}

function DependencyMappingSection({
  type,
  title,
  matches,
  mappings,
  onUpdate,
  fetchUrl,
  placeholder,
  workspaceId,
  autoMatchedCount,
  defaultCollapsed,
  isAutoMatched,
  resetToAutoMatch,
}: DependencyMappingSectionProps) {
  const { t } = useTranslation(['common', 'entity']);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const fetchOptions = useCallback(
    async (search: string) => {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/${fetchUrl}?search=${encodeURIComponent(search)}`);
      const body = await res.json();
      return body.data || [];
    },
    [workspaceId, fetchUrl],
  );

  return (
    <div className="rounded-lg border border-base-300">
      <div className="flex cursor-pointer items-center justify-between bg-base-200 p-3" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <Badge size="sm">{matches.length}</Badge>
          {autoMatchedCount > 0 && (
            <Badge variant="success" size="sm" className="gap-1">
              <FaCheckCircle className="text-xs" />
              {t('common:autoMatchedCount', { count: autoMatchedCount })}
            </Badge>
          )}
        </div>
        <div>{collapsed ? <FaChevronDown /> : <FaChevronUp />}</div>
      </div>

      {!collapsed && (
        <div className="p-3">
          <div className="flex flex-col gap-3">
            {matches.map((match) => {
              const mapping = mappings.find((m) => m.exportName === match.exportName);
              const isAuto = isAutoMatched(type, match.exportName);
              const isMapped = mapping?.decision === 'use-existing' && mapping?.existingId;

              return (
                <div key={match.exportName} className="rounded-lg border border-base-300 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{match.exportName}</div>
                    {isAuto && (
                      <Badge variant="success" size="sm">
                        {t('common:autoMatched')}
                      </Badge>
                    )}
                    {!isAuto && isMapped && (
                      <button
                        type="button"
                        className="cursor-pointer"
                        title={t('common:restoreAutoMatch')}
                        onClick={() => resetToAutoMatch(type, match.exportName)}
                      >
                        <Badge variant="success" size="sm" outline>
                          {t('common:auto')}
                        </Badge>
                      </button>
                    )}
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    <Label className="cursor-pointer flex-row items-center gap-2">
                      <Radio
                        radioSize="sm"
                        checked={mapping?.decision === 'use-existing'}
                        onChange={() => {
                          if (match.autoMatch) {
                            onUpdate(match.exportName, match.autoMatch.id);
                          } else if (match.options.length > 0) {
                            onUpdate(match.exportName, match.options[0].id);
                          }
                        }}
                      />
                      <span className="text-sm">{t('common:useExisting')}</span>
                    </Label>

                    {mapping?.decision === 'use-existing' && (
                      <div className="ml-6">
                        <EntityCombobox
                          value={mapping.existingId || null}
                          onChange={(value) => onUpdate(match.exportName, value)}
                          fetchOptions={fetchOptions}
                          getOptionLabel={(opt) => opt.name}
                          getOptionValue={(opt) => opt.id}
                          placeholder={placeholder}
                        />
                      </div>
                    )}

                    <Label className="cursor-pointer flex-row items-center gap-2">
                      <Radio radioSize="sm" checked={mapping?.decision === 'skip'} onChange={() => onUpdate(match.exportName, null)} />
                      <span className="text-sm">{t('common:skip')}</span>
                    </Label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────── Component ──────────────

export default function EntityImportModal({ workspaceId, entityType, onImportComplete }: EntityImportModalProps) {
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['common', 'entity', 'cocktail', 'errors', 'nav', 'settings']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelKeys = ENTITY_LABEL_KEYS[entityType];
  const labels = {
    singular: t(`entity:singular.${labelKeys.singularKey}`),
    plural: t(`entity:plural.${labelKeys.pluralKey}`),
    nameKey: labelKeys.nameKey,
  };
  const isCalculation = entityType === 'calculations';

  const totalSteps = isCalculation ? 4 : 3;
  const [currentStep, setCurrentStep] = useState(1);
  const [importComplete, setImportComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1: Upload
  const [parsedEntities, setParsedEntities] = useState<ParsedEntity[]>([]);

  // Step 2: Conflicts
  const [mappingEntities, setMappingEntities] = useState<MappingEntity[]>([]);

  // Step 2b: Dependency mapping (calculations only)
  const [cocktailMatches, setCocktailMatches] = useState<DependencyMatch[]>([]);
  const [ingredientMatches, setIngredientMatches] = useState<DependencyMatch[]>([]);
  const [unitMatches, setUnitMatches] = useState<DependencyMatch[]>([]);
  const [cocktailMappings, setCocktailMappings] = useState<DependencyMapping[]>([]);
  const [ingredientMappings, setIngredientMappings] = useState<DependencyMapping[]>([]);
  const [unitMappings, setUnitMappings] = useState<DependencyMapping[]>([]);
  const [calculationGroups, setCalculationGroups] = useState<CalculationGroupOption[]>([]);

  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [showDetailsCollapsed, setShowDetailsCollapsed] = useState(false);

  // ────── Step 1: File upload ──────

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target?.result as string);
          const dataArray = Array.isArray(content) ? content : [content];

          const parsed: ParsedEntity[] = dataArray.map((item: Record<string, unknown>) => {
            const entityData = item[labels.nameKey] as Record<string, unknown> | undefined;
            if (!entityData?.name) {
              return { name: t('common:unknown'), data: item, valid: false, selected: false };
            }
            return { name: String(entityData.name), data: item, valid: true, selected: true };
          });

          setParsedEntities(parsed);
        } catch {
          alertService.error(t('errors:invalidJson'));
        }
      };
      reader.readAsText(file);
    },
    [labels.nameKey, t],
  );

  const handleToggleSelect = useCallback((index: number) => {
    setParsedEntities((prev) => prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e)));
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setParsedEntities((prev) => {
      const validItems = prev.filter((e) => e.valid);
      const allSelected = validItems.every((e) => e.selected);
      return prev.map((e) => (e.valid ? { ...e, selected: !allSelected } : e));
    });
  }, []);

  // ────── Step 2: Prepare mapping ──────

  const handlePrepareMapping = useCallback(async () => {
    setLoading(true);
    try {
      const selectedItems = parsedEntities.filter((e) => e.selected && e.valid);
      const exportData = selectedItems.map((e) => e.data);

      const response = await fetch(`/api/v1/workspaces/${workspaceId}/${entityType}/import/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'prepare-mapping', exportData }),
      });

      if (!response.ok) {
        alertService.error(t('errors:checkConflicts'));
        return;
      }

      const result = await response.json();

      // Build mapping entities with conflict info (default: overwrite when conflict so a choice is always selected)
      const entities: MappingEntity[] = result.entities.map((entity: { name: string; data: Record<string, unknown>; conflicts?: Conflict[] }) => {
        const calcData = entity.data?.calculation as Record<string, unknown> | undefined;
        return {
          name: entity.name,
          data: entity.data,
          conflicts: entity.conflicts || [],
          decision: (entity.conflicts?.length ?? 0) > 0 ? ('overwrite' as const) : ('import' as const),
          existingId: entity.conflicts?.[0]?.id,
          newName: '',
          groupDecision: calcData?.groupName ? ('keep-exported' as const) : ('no-group' as const),
          existingGroupId: undefined,
          newGroupName: '',
          newGroupDefaultExpanded: false,
          exportedGroupName: calcData?.groupName ? String(calcData.groupName) : null,
        };
      });

      setMappingEntities(entities);

      // Handle calculation-specific dependency mapping
      if (isCalculation) {
        setCalculationGroups(result.calculationGroups || []);
        setCocktailMatches(result.cocktailMatches || []);
        setIngredientMatches(result.ingredientMatches || []);
        setUnitMatches(result.unitMatches || []);

        // Initialize dependency mappings with auto-matches
        setCocktailMappings(
          (result.cocktailMatches || []).map((m: DependencyMatch) => ({
            exportName: m.exportName,
            decision: m.autoMatch ? 'use-existing' : 'skip',
            existingId: m.autoMatch?.id,
          })),
        );
        setIngredientMappings(
          (result.ingredientMatches || []).map((m: DependencyMatch) => ({
            exportName: m.exportName,
            decision: m.autoMatch ? 'use-existing' : 'skip',
            existingId: m.autoMatch?.id,
          })),
        );
        setUnitMappings(
          (result.unitMatches || []).map((m: DependencyMatch) => ({
            exportName: m.exportName,
            decision: m.autoMatch ? 'use-existing' : 'skip',
            existingId: m.autoMatch?.id,
          })),
        );
      }

      setCurrentStep(2);
    } catch (error) {
      console.error('Prepare mapping error:', error);
      alertService.error(t('errors:prepareImport'));
    } finally {
      setLoading(false);
    }
  }, [parsedEntities, workspaceId, entityType, isCalculation, t]);

  // ────── Step 3: Execute import ──────

  const handleExecute = useCallback(async () => {
    setImporting(true);
    try {
      const decisions = mappingEntities.map((entity) => ({
        exportName: entity.name,
        decision: entity.decision,
        existingId: entity.decision === 'overwrite' ? entity.existingId : undefined,
        newName: entity.decision === 'rename' ? entity.newName : undefined,
        groupDecision: isCalculation ? entity.groupDecision : undefined,
        existingGroupId: isCalculation && entity.groupDecision === 'use-existing' ? entity.existingGroupId : undefined,
        newGroupName: isCalculation && entity.groupDecision === 'create-new' ? entity.newGroupName : undefined,
        newGroupDefaultExpanded: isCalculation && entity.groupDecision === 'create-new' ? entity.newGroupDefaultExpanded : undefined,
        data: entity.data,
      }));

      const body: Record<string, unknown> = { phase: 'execute', decisions };

      if (isCalculation) {
        body.cocktailMappings = cocktailMappings;
        body.ingredientMappings = ingredientMappings;
        body.unitMappings = unitMappings;
      }

      const response = await fetch(`/api/v1/workspaces/${workspaceId}/${entityType}/import/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      setResults(result.results || []);
      setImportComplete(true);

      const successCount = (result.results || []).filter((r: ImportResult) => r.status === 'created' || r.status === 'overwritten').length;
      if (successCount > 0) {
        onImportComplete();
      }
      alertService.success(t('entity:importedSuccessfully', { plural: labels.plural }));
    } catch (error) {
      console.error('Execute error:', error);
      alertService.error(t('errors:import'));
    } finally {
      setImporting(false);
    }
  }, [mappingEntities, workspaceId, entityType, isCalculation, cocktailMappings, ingredientMappings, unitMappings, onImportComplete, labels.plural, t]);

  // ────── Helpers ──────

  const updateMappingDecision = useCallback((index: number, update: Partial<MappingEntity>) => {
    setMappingEntities((prev) => prev.map((e, i) => (i === index ? { ...e, ...update } : e)));
  }, []);

  const updateCocktailMapping = useCallback((exportName: string, existingId: string | null) => {
    setCocktailMappings((prev) =>
      prev.map((m) => (m.exportName === exportName ? { ...m, decision: existingId ? 'use-existing' : 'skip', existingId: existingId || undefined } : m)),
    );
  }, []);

  const updateIngredientMapping = useCallback((exportName: string, existingId: string | null) => {
    setIngredientMappings((prev) =>
      prev.map((m) => (m.exportName === exportName ? { ...m, decision: existingId ? 'use-existing' : 'skip', existingId: existingId || undefined } : m)),
    );
  }, []);

  const updateUnitMapping = useCallback((exportName: string, existingId: string | null) => {
    setUnitMappings((prev) =>
      prev.map((m) => (m.exportName === exportName ? { ...m, decision: existingId ? 'use-existing' : 'skip', existingId: existingId || undefined } : m)),
    );
  }, []);

  const resetToAutoMatch = useCallback(
    (type: 'cocktail' | 'ingredient' | 'unit', exportName: string) => {
      const matchesList = type === 'cocktail' ? cocktailMatches : type === 'ingredient' ? ingredientMatches : unitMatches;
      const match = matchesList.find((m) => m.exportName === exportName);
      if (!match?.autoMatch) return;
      const setter = type === 'cocktail' ? setCocktailMappings : type === 'ingredient' ? setIngredientMappings : setUnitMappings;
      setter((prev) => prev.map((m) => (m.exportName === exportName ? { ...m, decision: 'use-existing', existingId: match.autoMatch!.id } : m)));
    },
    [cocktailMatches, ingredientMatches, unitMatches],
  );

  const isAutoMatched = useCallback(
    (type: 'cocktail' | 'ingredient' | 'unit', exportName: string) => {
      const matchesList = type === 'cocktail' ? cocktailMatches : type === 'ingredient' ? ingredientMatches : unitMatches;
      const mappingsList = type === 'cocktail' ? cocktailMappings : type === 'ingredient' ? ingredientMappings : unitMappings;
      const match = matchesList.find((m) => m.exportName === exportName);
      const mapping = mappingsList.find((m) => m.exportName === exportName);
      if (!match?.autoMatch || !mapping) return false;
      return mapping.decision === 'use-existing' && mapping.existingId === match.autoMatch.id;
    },
    [cocktailMatches, ingredientMatches, unitMatches, cocktailMappings, ingredientMappings, unitMappings],
  );

  const selectedCount = parsedEntities.filter((e) => e.selected && e.valid).length;
  const _hasConflicts = mappingEntities.some((e) => e.conflicts.length > 0);
  const hasDependencyMappings = isCalculation && (cocktailMatches.length > 0 || ingredientMatches.length > 0 || unitMatches.length > 0);
  const hasUnmappedDeps =
    isCalculation &&
    (cocktailMappings.some((m) => m.decision === 'skip') ||
      ingredientMappings.some((m) => m.decision === 'skip') ||
      unitMappings.some((m) => m.decision === 'skip'));
  const hasInvalidGroupAssignments =
    isCalculation &&
    mappingEntities.some((entity) => {
      if (entity.decision === 'skip') return false;
      if (entity.groupDecision === 'use-existing') return !entity.existingGroupId;
      if (entity.groupDecision === 'create-new') return !entity.newGroupName || entity.newGroupName.trim() === '';
      return false;
    });
  const singleEntity = mappingEntities.length === 1;

  const stepLabels = isCalculation
    ? [t('cocktail:importStepUpload'), t('entity:importStepConflicts'), t('entity:importStepAssignment'), t('cocktail:importStepImport')]
    : [t('cocktail:importStepUpload'), t('entity:importStepConflicts'), t('cocktail:importStepImport')];

  // ────── Render ──────

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-bold">{t('entity:importPluralTitle', { plural: labels.plural })}</div>

      {/* Progress indicator (same as CocktailImportWizardModal) */}
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <React.Fragment key={i}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${currentStep >= i + 1 ? 'bg-primary text-primary-content' : 'bg-base-300'}`}
            >
              {i + 1}
            </div>
            {i < totalSteps - 1 && <div className={`h-1 flex-1 ${currentStep >= i + 2 ? 'bg-primary' : 'bg-base-300'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="flex justify-between text-xs">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            {label}
          </div>
        ))}
      </div>

      <Divider className="my-0" />

      <div className="min-h-[400px]">
        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">{t('entity:importStep1Upload')}</div>

            {parsedEntities.length === 0 ? (
              <>
                <div className="text-sm text-base-content/70">{t('entity:importUploadHint')}</div>
                <label
                  className={`flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed border-base-300 p-8 transition-colors hover:border-primary ${loading ? 'opacity-50' : ''}`}
                >
                  <FaUpload className="text-4xl text-base-content/50" />
                  <div className="text-center">
                    <div className="font-semibold">{t('entity:importUploadJson')}</div>
                    <div className="text-sm text-base-content/70">{t('entity:importDropHint')}</div>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
                </label>
                {loading && (
                  <div className="flex items-center justify-center gap-2">
                    <Loading />
                    <span>{t('entity:importFileLoading')}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-lg bg-base-200 p-4">
                  <div className="text-sm font-semibold">{t('entity:importDetails')}</div>
                  <div className="mt-2 text-sm text-base-content/70">
                    <div>{t('entity:importEntityCount', { plural: labels.plural, count: parsedEntities.length })}</div>
                  </div>
                </div>

                <div className="text-sm font-semibold">{t('entity:importSelectEntities', { plural: labels.plural })}</div>
                <div className="text-sm text-base-content/70">{t('entity:importSelectHint', { plural: labels.plural })}</div>

                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-base-300">
                  <Table compact>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="w-0">
                          <Checkbox
                            checkboxSize="sm"
                            checked={parsedEntities.filter((e) => e.valid).every((e) => e.selected)}
                            onChange={handleToggleSelectAll}
                          />
                        </TableHeaderCell>
                        <TableHeaderCell>{t('common:name')}</TableHeaderCell>
                        <TableHeaderCell>{t('common:status')}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parsedEntities.map((entity, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="w-0">
                            <Checkbox checkboxSize="sm" checked={entity.selected} disabled={!entity.valid} onChange={() => handleToggleSelect(idx)} />
                          </TableCell>
                          <TableCell>{entity.name}</TableCell>
                          <TableCell>
                            {entity.valid ? (
                              <Badge variant="ghost" size="sm">
                                {t('common:ready')}
                              </Badge>
                            ) : (
                              <Badge variant="error" size="sm">
                                {t('common:invalid')}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-sm text-base-content/70">
                  {t('entity:importSelectedCount', { selected: selectedCount, total: parsedEntities.filter((e) => e.valid).length, plural: labels.plural })}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-error text-error hover:bg-error/10" onClick={() => modalContext.closeModal()}>
                {t('common:cancel')}
              </Button>
              <Button variant="primary" onClick={handlePrepareMapping} disabled={parsedEntities.length === 0 || selectedCount === 0 || loading}>
                {loading ? <Loading size="sm" /> : null}
                {t('common:next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Conflict resolution */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">{t('entity:importStep2Conflicts')}</div>
            <div className="text-sm text-base-content/70">{t('entity:importConflictsHint')}</div>

            <div className="max-h-[300px] overflow-y-auto">
              <div className="flex flex-col gap-3">
                {mappingEntities.map((entity, idx) => (
                  <div key={idx} className={`rounded-lg border p-3 ${entity.conflicts.length > 0 ? 'border-warning' : 'border-base-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.name}</span>
                      {entity.conflicts.length > 0 && (
                        <Badge variant="warning" size="sm">
                          <FaExclamationTriangle className="mr-1" />
                          {t('common:conflict')}
                        </Badge>
                      )}
                      {entity.conflicts.length === 0 && (
                        <Badge variant="success" size="sm">
                          {t('common:new')}
                        </Badge>
                      )}
                    </div>

                    {entity.conflicts.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        <Label className="cursor-pointer flex-row items-center gap-2">
                          <Radio
                            radioSize="sm"
                            name={`decision-${idx}`}
                            checked={entity.decision === 'overwrite'}
                            onChange={() => updateMappingDecision(idx, { decision: 'overwrite', existingId: entity.conflicts[0].id })}
                          />
                          <span className="text-sm">{t('common:overwrite')}</span>
                          {entity.conflicts.length > 1 && entity.decision === 'overwrite' && (
                            <Select
                              selectSize="sm"
                              className="ml-2 w-auto"
                              value={entity.existingId || ''}
                              onChange={(e) => updateMappingDecision(idx, { existingId: e.target.value })}
                            >
                              {entity.conflicts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Select>
                          )}
                        </Label>
                        <Label className="cursor-pointer flex-row items-center gap-2">
                          <Radio
                            radioSize="sm"
                            name={`decision-${idx}`}
                            checked={entity.decision === 'import'}
                            onChange={() => updateMappingDecision(idx, { decision: 'import' })}
                          />
                          <span className="text-sm">{t('common:createNew')}</span>
                        </Label>
                        <Label className="cursor-pointer flex-row items-center gap-2">
                          <Radio
                            radioSize="sm"
                            name={`decision-${idx}`}
                            checked={entity.decision === 'rename'}
                            onChange={() => updateMappingDecision(idx, { decision: 'rename', newName: entity.name + t('entity:importNameSuffix') })}
                          />
                          <span className="text-sm">{t('common:rename')}</span>
                          {entity.decision === 'rename' && (
                            <Input
                              inputSize="sm"
                              type="text"
                              className="ml-2 w-48"
                              value={entity.newName || ''}
                              onChange={(e) => updateMappingDecision(idx, { newName: e.target.value })}
                            />
                          )}
                        </Label>
                        {!singleEntity && (
                          <Label className="cursor-pointer flex-row items-center gap-2">
                            <Radio
                              radioSize="sm"
                              name={`decision-${idx}`}
                              checked={entity.decision === 'skip'}
                              onChange={() => updateMappingDecision(idx, { decision: 'skip' })}
                            />
                            <span className="text-sm">{t('common:skip')}</span>
                          </Label>
                        )}
                      </div>
                    )}

                    {isCalculation && (
                      <div className="mt-3 rounded-md border border-base-300 bg-base-200/40 p-2">
                        <div className="mb-2 text-sm font-semibold">{t('entity:importFolderAssignment')}</div>
                        <div className="flex flex-col gap-1">
                          <Label className="cursor-pointer flex-row items-center gap-2">
                            <Radio
                              radioSize="sm"
                              name={`group-decision-${idx}`}
                              checked={entity.groupDecision === 'keep-exported'}
                              disabled={!entity.exportedGroupName}
                              onChange={() => updateMappingDecision(idx, { groupDecision: 'keep-exported' })}
                            />
                            <span className="text-sm">
                              {t('entity:importUseExportFolder')}
                              {entity.exportedGroupName ? ` (${entity.exportedGroupName})` : t('entity:importNoFolderInExport')}
                            </span>
                          </Label>
                          <Label className="cursor-pointer flex-row items-center gap-2">
                            <Radio
                              radioSize="sm"
                              name={`group-decision-${idx}`}
                              checked={entity.groupDecision === 'use-existing'}
                              onChange={() =>
                                updateMappingDecision(idx, {
                                  groupDecision: 'use-existing',
                                  existingGroupId: entity.existingGroupId ?? calculationGroups[0]?.id,
                                })
                              }
                            />
                            <span className="text-sm">{t('entity:importSelectExistingFolder')}</span>
                          </Label>
                          {entity.groupDecision === 'use-existing' && (
                            <Select
                              selectSize="sm"
                              className="mt-1 ml-6 w-full max-w-xs"
                              value={entity.existingGroupId ?? ''}
                              onChange={(event) => updateMappingDecision(idx, { existingGroupId: event.target.value })}
                            >
                              <option value={''} disabled>
                                {t('entity:importSelectFolder')}
                              </option>
                              {calculationGroups.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                            </Select>
                          )}
                          <Label className="cursor-pointer flex-row items-center gap-2">
                            <Radio
                              radioSize="sm"
                              name={`group-decision-${idx}`}
                              checked={entity.groupDecision === 'create-new'}
                              onChange={() =>
                                updateMappingDecision(idx, {
                                  groupDecision: 'create-new',
                                  newGroupName: entity.newGroupName || entity.exportedGroupName || t('entity:groupNameDefault', { name: entity.name }),
                                })
                              }
                            />
                            <span className="text-sm">{t('entity:importCreateNewFolder')}</span>
                          </Label>
                          {entity.groupDecision === 'create-new' && (
                            <div className="mt-1 ml-6 flex max-w-md flex-col gap-2">
                              <Input
                                inputSize="sm"
                                type="text"
                                className="w-full"
                                placeholder={t('entity:folderNamePlaceholder')}
                                value={entity.newGroupName || ''}
                                onChange={(event) => updateMappingDecision(idx, { newGroupName: event.target.value })}
                              />
                              <Label className="cursor-pointer flex-row items-center gap-2">
                                <Checkbox
                                  checkboxSize="sm"
                                  checked={Boolean(entity.newGroupDefaultExpanded)}
                                  onChange={(event) => updateMappingDecision(idx, { newGroupDefaultExpanded: event.target.checked })}
                                />
                                <span className="text-xs">{t('entity:importDefaultExpanded')}</span>
                              </Label>
                            </div>
                          )}
                          <Label className="cursor-pointer flex-row items-center gap-2">
                            <Radio
                              radioSize="sm"
                              name={`group-decision-${idx}`}
                              checked={entity.groupDecision === 'no-group'}
                              onChange={() => updateMappingDecision(idx, { groupDecision: 'no-group' })}
                            />
                            <span className="text-sm">{t('entity:importWithoutFolder')}</span>
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                {t('common:back')}
              </Button>
              <Button variant="primary" onClick={() => setCurrentStep(hasDependencyMappings ? 3 : totalSteps)} disabled={hasInvalidGroupAssignments}>
                {t('common:next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Dependency mapping (calculations only) */}
        {currentStep === 3 && isCalculation && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">{t('entity:importStep3Mapping')}</div>
            <div className="text-sm text-base-content/70">{t('entity:importMappingHint')}</div>

            <div className="max-h-[400px] overflow-y-auto">
              <div className="flex flex-col gap-4">
                {[
                  {
                    type: 'cocktail' as const,
                    title: t('nav:cocktails'),
                    matches: cocktailMatches,
                    mappings: cocktailMappings,
                    onUpdate: updateCocktailMapping,
                    fetchUrl: 'cocktails',
                    placeholder: t('entity:selectCocktailPlaceholder'),
                  },
                  {
                    type: 'ingredient' as const,
                    title: t('entity:plural.ingredients'),
                    matches: ingredientMatches,
                    mappings: ingredientMappings,
                    onUpdate: updateIngredientMapping,
                    fetchUrl: 'ingredients',
                    placeholder: t('entity:selectIngredientPlaceholder'),
                  },
                  {
                    type: 'unit' as const,
                    title: t('settings:units'),
                    matches: unitMatches,
                    mappings: unitMappings,
                    onUpdate: updateUnitMapping,
                    fetchUrl: 'units',
                    placeholder: t('entity:selectUnitPlaceholder'),
                  },
                ]
                  .filter((section) => section.matches.length > 0)
                  .map((section) => {
                    const autoCount = section.matches.filter((m) => m.autoMatch).length;
                    const allAutoMatched = autoCount === section.matches.length;

                    return (
                      <DependencyMappingSection
                        key={section.type}
                        type={section.type}
                        title={section.title}
                        matches={section.matches}
                        mappings={section.mappings}
                        onUpdate={section.onUpdate}
                        fetchUrl={section.fetchUrl}
                        placeholder={section.placeholder}
                        workspaceId={workspaceId}
                        autoMatchedCount={autoCount}
                        defaultCollapsed={allAutoMatched}
                        isAutoMatched={isAutoMatched}
                        resetToAutoMatch={resetToAutoMatch}
                      />
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                {t('common:back')}
              </Button>
              <Button variant="primary" onClick={() => setCurrentStep(totalSteps)}>
                {t('common:next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 (or 3): Confirmation & execution / Success */}
        {currentStep === totalSteps && importComplete && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">{t('entity:importSuccessTitle')}</div>

            <div className="flex items-center justify-center">
              <FaCheckCircle className="text-6xl text-success" />
            </div>

            <div className="rounded-lg bg-base-200 p-4">
              <div className="text-sm font-semibold">{t('common:summary')}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-base-content/70">{t('common:createdCount')}</div>
                <div className="font-semibold">{results.filter((r) => r.status === 'created').length}</div>
                <div className="text-base-content/70">{t('common:overwrittenCount')}</div>
                <div className="font-semibold">{results.filter((r) => r.status === 'overwritten').length}</div>
                <div className="text-base-content/70">{t('common:skippedCount')}</div>
                <div className="font-semibold">{results.filter((r) => r.status === 'skipped').length}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="primary" onClick={() => modalContext.closeModal()}>
                {t('common:done')}
              </Button>
            </div>
          </div>
        )}

        {currentStep === totalSteps && !importComplete && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">{t('entity:importStepConfirm', { step: totalSteps })}</div>
            <div className="text-sm text-base-content/70">{t('entity:importConfirmHint')}</div>

            <div className="rounded-lg bg-base-200 p-4">
              <div className="mb-3 text-sm font-semibold">{t('entity:importSummaryTitle')}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-base-content/70">{t('entity:importToImport', { plural: labels.plural })}</div>
                <div className="font-semibold">{mappingEntities.filter((e) => e.decision !== 'skip').length}</div>
              </div>
            </div>

            {/* Details anzeigen (same as Cocktail ConfirmationStep) */}
            <div className="rounded-lg border border-base-300">
              <div className="flex cursor-pointer items-center justify-between bg-base-200 p-3" onClick={() => setShowDetailsCollapsed(!showDetailsCollapsed)}>
                <span className="text-sm font-semibold">{t('common:details')}</span>
                {showDetailsCollapsed ? <FaChevronDown /> : <FaChevronUp />}
              </div>
              {!showDetailsCollapsed && (
                <div className="max-h-[300px] overflow-y-auto p-3">
                  <div className="flex flex-col gap-1">
                    {mappingEntities.map((entity, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {entity.decision === 'import' && (
                          <Badge variant="success" size="xs">
                            {t('entity:importCreateBadge')}
                          </Badge>
                        )}
                        {entity.decision === 'overwrite' && (
                          <Badge variant="warning" size="xs">
                            {t('common:overwrite')}
                          </Badge>
                        )}
                        {entity.decision === 'rename' && (
                          <Badge variant="info" size="xs">
                            {t('common:rename')}
                          </Badge>
                        )}
                        {entity.decision === 'skip' && (
                          <Badge variant="ghost" size="xs">
                            {t('common:skip')}
                          </Badge>
                        )}
                        <span className={entity.decision === 'skip' ? 'text-base-content/50 line-through' : ''}>
                          {entity.name}
                          {entity.decision === 'rename' && entity.newName && ` → ${entity.newName}`}
                        </span>
                        {isCalculation && entity.decision !== 'skip' && (
                          <span className="text-xs text-base-content/60">
                            {' · '}
                            {entity.groupDecision === 'no-group'
                              ? t('entity:importSummaryWithoutFolder')
                              : entity.groupDecision === 'use-existing'
                                ? t('entity:importSummaryFolder', {
                                    name: calculationGroups.find((g) => g.id === entity.existingGroupId)?.name ?? t('entity:importSummaryExisting'),
                                  })
                                : entity.groupDecision === 'create-new'
                                  ? t('entity:importSummaryNewFolder', { name: entity.newGroupName || '–' })
                                  : t('entity:importSummaryExportFolder', { name: entity.exportedGroupName || '–' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {isCalculation && hasDependencyMappings && (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold">{t('common:mappings')}</div>
                      {[
                        { label: t('nav:cocktails'), mappings: cocktailMappings, matches: cocktailMatches },
                        { label: t('entity:plural.ingredients'), mappings: ingredientMappings, matches: ingredientMatches },
                        { label: t('settings:units'), mappings: unitMappings, matches: unitMatches },
                      ]
                        .filter((s) => s.mappings.length > 0)
                        .map((section) => (
                          <div key={section.label} className="mb-2">
                            <p className="text-xs font-medium text-base-content/60">{section.label}</p>
                            <div className="flex flex-col gap-0.5">
                              {section.mappings.map((m) => {
                                const match = section.matches.find((mt) => mt.exportName === m.exportName);
                                const targetName =
                                  m.decision === 'use-existing' && match
                                    ? match.options.find((o) => o.id === m.existingId)?.name || match.autoMatch?.name
                                    : null;
                                return (
                                  <div key={m.exportName} className="flex items-center gap-2 text-sm">
                                    {m.decision === 'use-existing' ? (
                                      <Badge variant="success" size="xs">
                                        {String.fromCharCode(0x2713)}
                                      </Badge>
                                    ) : (
                                      <Badge variant="warning" size="xs">
                                        –
                                      </Badge>
                                    )}
                                    <span className={m.decision === 'skip' ? 'text-base-content/50' : ''}>
                                      {m.exportName}
                                      {targetName && targetName !== m.exportName && <span className="text-base-content/60"> → {targetName}</span>}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isCalculation && hasUnmappedDeps && (
              <div className="flex items-start gap-2 rounded-lg border border-warning p-2 text-sm text-warning">
                <FaExclamationTriangle className="mt-0.5 shrink-0" />
                <span>{t('entity:importUnmappedWarning')}</span>
              </div>
            )}
            {isCalculation && hasInvalidGroupAssignments && (
              <div className="flex items-start gap-2 rounded-lg border border-error p-2 text-sm text-error">
                <FaTimesCircle className="mt-0.5 shrink-0" />
                <span>{t('entity:importFolderWarning')}</span>
              </div>
            )}

            {importing ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <Loading size="lg" />
                <span>{t('entity:importRunning')}</span>
                <div className="text-xs text-base-content/50">{t('entity:importRunningHint')}</div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(isCalculation ? 3 : 2)}>
                  {t('common:back')}
                </Button>
                <Button variant="primary" onClick={handleExecute} disabled={mappingEntities.every((e) => e.decision === 'skip') || hasInvalidGroupAssignments}>
                  {t('entity:importStart')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
