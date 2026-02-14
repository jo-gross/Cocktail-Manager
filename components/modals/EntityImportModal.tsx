import React, { useCallback, useContext, useRef, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { FaUpload, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { EntityCombobox } from '../cocktail-import/EntityCombobox';

// ────────────── Types ──────────────

interface EntityImportModalProps {
  workspaceId: string;
  entityType: 'glasses' | 'garnishes' | 'ingredients' | 'calculations';
  onImportComplete: () => void;
}

interface ParsedEntity {
  name: string;
  data: any;
  valid: boolean;
  selected: boolean;
}

interface Conflict {
  id: string;
  name: string;
}

interface MappingEntity {
  name: string;
  data: any;
  conflicts: Conflict[];
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
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

// ────────────── Constants ──────────────

const ENTITY_LABELS: Record<string, { singular: string; plural: string; nameKey: string }> = {
  glasses: { singular: 'Glas', plural: 'Gläser', nameKey: 'glass' },
  garnishes: { singular: 'Garnitur', plural: 'Garnituren', nameKey: 'garnish' },
  ingredients: { singular: 'Zutat', plural: 'Zutaten', nameKey: 'ingredient' },
  calculations: { singular: 'Kalkulation', plural: 'Kalkulationen', nameKey: 'calculation' },
};

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
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const fetchOptions = useCallback(
    async (search: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/${fetchUrl}?search=${encodeURIComponent(search)}`);
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
          <span className="badge badge-sm">{matches.length}</span>
          {autoMatchedCount > 0 && (
            <span className="badge badge-success badge-sm gap-1">
              <FaCheckCircle className="text-xs" />
              {autoMatchedCount} auto-matched
            </span>
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
                    {isAuto && <span className="badge badge-success badge-sm">Auto-matched</span>}
                    {!isAuto && isMapped && (
                      <button
                        type="button"
                        className="badge badge-success badge-outline badge-sm cursor-pointer"
                        title="Klicken um automatische Zuordnung wiederherzustellen"
                        onClick={() => resetToAutoMatch(type, match.exportName)}
                      >
                        Auto
                      </button>
                    )}
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        className="radio radio-sm"
                        checked={mapping?.decision === 'use-existing'}
                        onChange={() => {
                          if (match.autoMatch) {
                            onUpdate(match.exportName, match.autoMatch.id);
                          } else if (match.options.length > 0) {
                            onUpdate(match.exportName, match.options[0].id);
                          }
                        }}
                      />
                      <span className="text-sm">Bestehende verwenden</span>
                    </label>

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

                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="radio" className="radio radio-sm" checked={mapping?.decision === 'skip'} onChange={() => onUpdate(match.exportName, null)} />
                      <span className="text-sm">Überspringen</span>
                    </label>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labels = ENTITY_LABELS[entityType];
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

          const parsed: ParsedEntity[] = dataArray.map((item: any) => {
            const entityData = item[labels.nameKey];
            if (!entityData?.name) {
              return { name: 'Unbekannt', data: item, valid: false, selected: false };
            }
            return { name: entityData.name, data: item, valid: true, selected: true };
          });

          setParsedEntities(parsed);
        } catch {
          alertService.error('Ungültige JSON-Datei');
        }
      };
      reader.readAsText(file);
    },
    [labels.nameKey],
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

      const response = await fetch(`/api/workspaces/${workspaceId}/${entityType}/import-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'prepare-mapping', exportData }),
      });

      if (!response.ok) {
        alertService.error('Fehler beim Prüfen der Konflikte');
        return;
      }

      const result = await response.json();

      // Build mapping entities with conflict info (default: overwrite when conflict so a choice is always selected)
      const entities: MappingEntity[] = result.entities.map((entity: any) => ({
        name: entity.name,
        data: entity.data,
        conflicts: entity.conflicts || [],
        decision: entity.conflicts?.length > 0 ? 'overwrite' : 'import',
        existingId: entity.conflicts?.[0]?.id,
        newName: '',
      }));

      setMappingEntities(entities);

      // Handle calculation-specific dependency mapping
      if (isCalculation) {
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
      alertService.error('Fehler beim Vorbereiten des Imports');
    } finally {
      setLoading(false);
    }
  }, [parsedEntities, workspaceId, entityType, isCalculation]);

  // ────── Step 3: Execute import ──────

  const handleExecute = useCallback(async () => {
    setImporting(true);
    try {
      const decisions = mappingEntities.map((entity) => ({
        exportName: entity.name,
        decision: entity.decision,
        existingId: entity.decision === 'overwrite' ? entity.existingId : undefined,
        newName: entity.decision === 'rename' ? entity.newName : undefined,
        data: entity.data,
      }));

      const body: any = { phase: 'execute', decisions };

      if (isCalculation) {
        body.cocktailMappings = cocktailMappings;
        body.ingredientMappings = ingredientMappings;
        body.unitMappings = unitMappings;
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/${entityType}/import-json`, {
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
      alertService.success(`${labels.plural} erfolgreich importiert`);
    } catch (error) {
      console.error('Execute error:', error);
      alertService.error('Fehler beim Importieren');
    } finally {
      setImporting(false);
    }
  }, [mappingEntities, workspaceId, entityType, isCalculation, cocktailMappings, ingredientMappings, unitMappings, onImportComplete]);

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
  const hasConflicts = mappingEntities.some((e) => e.conflicts.length > 0);
  const hasDependencyMappings = isCalculation && (cocktailMatches.length > 0 || ingredientMatches.length > 0 || unitMatches.length > 0);
  const hasUnmappedDeps =
    isCalculation &&
    (cocktailMappings.some((m) => m.decision === 'skip') ||
      ingredientMappings.some((m) => m.decision === 'skip') ||
      unitMappings.some((m) => m.decision === 'skip'));
  const singleEntity = mappingEntities.length === 1;

  const stepLabels = isCalculation ? ['Upload', 'Konflikte', 'Zuordnung', 'Import'] : ['Upload', 'Konflikte', 'Import'];

  // ────── Render ──────

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-bold">{labels.plural} importieren</div>

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

      <div className="divider my-0" />

      <div className="min-h-[400px]">
        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">Schritt 1: Datei hochladen</div>

            {parsedEntities.length === 0 ? (
              <>
                <div className="text-sm text-base-content/70">Laden Sie eine JSON-Datei hoch, die zuvor exportiert wurde.</div>
                <label
                  className={`flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed border-base-300 p-8 transition-colors hover:border-primary ${loading ? 'opacity-50' : ''}`}
                >
                  <FaUpload className="text-4xl text-base-content/50" />
                  <div className="text-center">
                    <div className="font-semibold">JSON-Datei hochladen</div>
                    <div className="text-sm text-base-content/70">Klicken Sie hier oder ziehen Sie eine Datei herein</div>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
                </label>
                {loading && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="loading loading-spinner" />
                    <span>Datei wird geladen...</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-lg bg-base-200 p-4">
                  <div className="text-sm font-semibold">Import-Details</div>
                  <div className="mt-2 text-sm text-base-content/70">
                    <div>
                      Anzahl {labels.plural}: {parsedEntities.length}
                    </div>
                  </div>
                </div>

                <div className="text-sm font-semibold">{labels.plural} auswählen</div>
                <div className="text-sm text-base-content/70">Wählen Sie die {labels.plural} aus, die Sie importieren möchten.</div>

                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-base-300">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th className="w-0">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={parsedEntities.filter((e) => e.valid).every((e) => e.selected)}
                            onChange={handleToggleSelectAll}
                          />
                        </th>
                        <th>Name</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedEntities.map((entity, idx) => (
                        <tr key={idx}>
                          <td className="w-0">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={entity.selected}
                              disabled={!entity.valid}
                              onChange={() => handleToggleSelect(idx)}
                            />
                          </td>
                          <td>{entity.name}</td>
                          <td>
                            {entity.valid ? (
                              <span className="badge badge-ghost badge-sm">Bereit</span>
                            ) : (
                              <span className="badge badge-error badge-sm">Ungültig</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-sm text-base-content/70">
                  {selectedCount} von {parsedEntities.filter((e) => e.valid).length} {labels.plural} ausgewählt
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn btn-outline btn-error" onClick={() => modalContext.closeModal()}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handlePrepareMapping} disabled={parsedEntities.length === 0 || selectedCount === 0 || loading}>
                {loading ? <span className="loading loading-spinner loading-sm" /> : null}
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Conflict resolution */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">Schritt 2: Konflikte lösen</div>
            <div className="text-sm text-base-content/70">
              Bestehende Einträge mit gleichem Namen wurden erkannt. Wählen Sie pro Eintrag, ob überschreiben, neu erstellen, umbenennen oder überspringen.
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              <div className="flex flex-col gap-3">
                {mappingEntities.map((entity, idx) => (
                  <div key={idx} className={`rounded-lg border p-3 ${entity.conflicts.length > 0 ? 'border-warning' : 'border-base-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.name}</span>
                      {entity.conflicts.length > 0 && (
                        <span className="badge badge-warning badge-sm">
                          <FaExclamationTriangle className="mr-1" />
                          Konflikt
                        </span>
                      )}
                      {entity.conflicts.length === 0 && <span className="badge badge-success badge-sm">Neu</span>}
                    </div>

                    {entity.conflicts.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            className="radio radio-sm"
                            name={`decision-${idx}`}
                            checked={entity.decision === 'overwrite'}
                            onChange={() => updateMappingDecision(idx, { decision: 'overwrite', existingId: entity.conflicts[0].id })}
                          />
                          <span className="text-sm">Überschreiben</span>
                          {entity.conflicts.length > 1 && entity.decision === 'overwrite' && (
                            <select
                              className="select select-bordered select-xs ml-2"
                              value={entity.existingId || ''}
                              onChange={(e) => updateMappingDecision(idx, { existingId: e.target.value })}
                            >
                              {entity.conflicts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            className="radio radio-sm"
                            name={`decision-${idx}`}
                            checked={entity.decision === 'import'}
                            onChange={() => updateMappingDecision(idx, { decision: 'import' })}
                          />
                          <span className="text-sm">Trotzdem erstellen</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            className="radio radio-sm"
                            name={`decision-${idx}`}
                            checked={entity.decision === 'rename'}
                            onChange={() => updateMappingDecision(idx, { decision: 'rename', newName: entity.name + ' (Import)' })}
                          />
                          <span className="text-sm">Umbenennen</span>
                          {entity.decision === 'rename' && (
                            <input
                              type="text"
                              className="input input-xs input-bordered ml-2 w-48"
                              value={entity.newName || ''}
                              onChange={(e) => updateMappingDecision(idx, { newName: e.target.value })}
                            />
                          )}
                        </label>
                        {!singleEntity && (
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              className="radio radio-sm"
                              name={`decision-${idx}`}
                              checked={entity.decision === 'skip'}
                              onChange={() => updateMappingDecision(idx, { decision: 'skip' })}
                            />
                            <span className="text-sm">Überspringen</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setCurrentStep(1)}>
                Zurück
              </button>
              <button className="btn btn-primary" onClick={() => setCurrentStep(hasDependencyMappings ? 3 : totalSteps)}>
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Dependency mapping (calculations only) */}
        {currentStep === 3 && isCalculation && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">Schritt 3: Entitäten zuordnen</div>
            <div className="text-sm text-base-content/70">
              Wählen Sie für jede Entität, ob eine bestehende verwendet werden soll. Auto-Matching wurde basierend auf exakten Namen durchgeführt.
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              <div className="flex flex-col gap-4">
                {[
                  {
                    type: 'cocktail' as const,
                    title: 'Cocktails',
                    matches: cocktailMatches,
                    mappings: cocktailMappings,
                    onUpdate: updateCocktailMapping,
                    fetchUrl: 'cocktails',
                    placeholder: 'Cocktail auswählen...',
                  },
                  {
                    type: 'ingredient' as const,
                    title: 'Zutaten',
                    matches: ingredientMatches,
                    mappings: ingredientMappings,
                    onUpdate: updateIngredientMapping,
                    fetchUrl: 'ingredients',
                    placeholder: 'Zutat auswählen...',
                  },
                  {
                    type: 'unit' as const,
                    title: 'Einheiten',
                    matches: unitMatches,
                    mappings: unitMappings,
                    onUpdate: updateUnitMapping,
                    fetchUrl: 'units',
                    placeholder: 'Einheit auswählen...',
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
              <button className="btn btn-outline" onClick={() => setCurrentStep(2)}>
                Zurück
              </button>
              <button className="btn btn-primary" onClick={() => setCurrentStep(totalSteps)}>
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 4 (or 3): Confirmation & execution / Success */}
        {currentStep === totalSteps && importComplete && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">Import erfolgreich!</div>

            <div className="flex items-center justify-center">
              <FaCheckCircle className="text-6xl text-success" />
            </div>

            <div className="rounded-lg bg-base-200 p-4">
              <div className="text-sm font-semibold">Zusammenfassung</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-base-content/70">Erstellt:</div>
                <div className="font-semibold">{results.filter((r) => r.status === 'created').length}</div>
                <div className="text-base-content/70">Überschrieben:</div>
                <div className="font-semibold">{results.filter((r) => r.status === 'overwritten').length}</div>
                <div className="text-base-content/70">Übersprungen:</div>
                <div className="font-semibold">{results.filter((r) => r.status === 'skipped').length}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn btn-primary" onClick={() => modalContext.closeModal()}>
                Fertig
              </button>
            </div>
          </div>
        )}

        {currentStep === totalSteps && !importComplete && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-semibold">Schritt {totalSteps}: Import bestätigen</div>
            <div className="text-sm text-base-content/70">Überprüfen Sie die Import-Zusammenfassung und bestätigen Sie den Import.</div>

            <div className="rounded-lg bg-base-200 p-4">
              <div className="mb-3 text-sm font-semibold">Import-Zusammenfassung</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-base-content/70">{labels.plural} zu importieren:</div>
                <div className="font-semibold">{mappingEntities.filter((e) => e.decision !== 'skip').length}</div>
              </div>
            </div>

            {/* Details anzeigen (same as Cocktail ConfirmationStep) */}
            <div className="rounded-lg border border-base-300">
              <div className="flex cursor-pointer items-center justify-between bg-base-200 p-3" onClick={() => setShowDetailsCollapsed(!showDetailsCollapsed)}>
                <span className="text-sm font-semibold">Details anzeigen</span>
                {showDetailsCollapsed ? <FaChevronDown /> : <FaChevronUp />}
              </div>
              {!showDetailsCollapsed && (
                <div className="max-h-[300px] overflow-y-auto p-3">
                  <div className="flex flex-col gap-1">
                    {mappingEntities.map((entity, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {entity.decision === 'import' && <span className="badge badge-success badge-xs">Erstellen</span>}
                        {entity.decision === 'overwrite' && <span className="badge badge-warning badge-xs">Überschreiben</span>}
                        {entity.decision === 'rename' && <span className="badge badge-info badge-xs">Umbenennen</span>}
                        {entity.decision === 'skip' && <span className="badge badge-ghost badge-xs">Überspringen</span>}
                        <span className={entity.decision === 'skip' ? 'text-base-content/50 line-through' : ''}>
                          {entity.name}
                          {entity.decision === 'rename' && entity.newName && ` → ${entity.newName}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {isCalculation && hasDependencyMappings && (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold">Zuordnungen</div>
                      {[
                        { label: 'Cocktails', mappings: cocktailMappings, matches: cocktailMatches },
                        { label: 'Zutaten', mappings: ingredientMappings, matches: ingredientMatches },
                        { label: 'Einheiten', mappings: unitMappings, matches: unitMatches },
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
                                      <span className="badge badge-success badge-xs">✓</span>
                                    ) : (
                                      <span className="badge badge-warning badge-xs">–</span>
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
                <span>Einige Cocktails, Zutaten oder Einheiten konnten nicht zugeordnet werden und werden beim Import übersprungen.</span>
              </div>
            )}

            {importing ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <span className="loading loading-spinner loading-lg" />
                <span>Import läuft... Bitte warten Sie.</span>
                <div className="text-xs text-base-content/50">Dies kann je nach Anzahl einige Sekunden dauern.</div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button className="btn btn-outline" onClick={() => setCurrentStep(isCalculation ? 3 : 2)}>
                  Zurück
                </button>
                <button className="btn btn-primary" onClick={handleExecute} disabled={mappingEntities.every((e) => e.decision === 'skip')}>
                  Import starten
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
