import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { FaFileDownload } from 'react-icons/fa';
import moment from 'moment';
import { buildExportData } from '@lib/auditExport';

interface AuditLogHistoryModalProps {
  entityType: string;
  entityId: string;
  entityName: string;
}

interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes: any;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  snapshot?: any;
  exportData?: any;
}

const LONG_TEXT_FIELDS = ['description', 'preparation', 'history', 'notes'];

/** Maps snapshot keys to German UI header labels */
const GROUP_HEADERS: Record<string, string> = {
  name: 'Name',
  description: 'Beschreibung',
  preparation: 'Zubereitung',
  history: 'Geschichte',
  price: 'Preis',
  glass: 'Glas',
  ice: 'Eis',
  image: 'Bild',
  tags: 'Tags',
  steps: 'Schritte',
  garnishes: 'Garnituren',
  notes: 'Notizen',
  volume: 'Volumen',
  deposit: 'Pfand',
  shortName: 'Kurzname',
  link: 'Link',
  units: 'Einheiten',
  showSalesInfo: 'Betriebswirtschaftliche Ansicht',
  cocktails: 'Cocktails',
  shoppingUnits: 'Einkaufsliste Einheiten',
  unit: 'Einheit',
  checked: 'Ausgewählt',
  plannedAmount: 'Geplante Menge',
  customPrice: 'Sonderpreis',
};

export function AuditLogHistoryModal({ entityType, entityId, entityName }: AuditLogHistoryModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId && entityId) {
      fetchLogs();
    }
  }, [workspaceId, entityId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/audit-logs?entityType=${entityType}&entityId=${entityId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
    } finally {
      setLoading(false);
    }
  };

  const t = (text: string) => userContext.getTranslation(text, 'de');

  /**
   * Collects all changed paths from the changes array into a Map of
   * serialized path strings for quick lookups.
   */
  const buildChangedPaths = (changes: any[]): Map<string, any> => {
    const map = new Map<string, any>();
    if (!Array.isArray(changes)) return map;
    changes.forEach((c: any) => {
      if (c.path) {
        map.set(c.path.join('.'), c);
      }
    });
    return map;
  };

  const isUndefinedish = (val: any): boolean => {
    return val === undefined || val === null || (typeof val === 'string' && val.toLowerCase() === 'undefined');
  };

  // ────────────── TAGS ──────────────

  const renderTags = (log: AuditLog, changes: any[]) => {
    const snapshot = log.snapshot;
    const currentTags: string[] = snapshot?.tags ? Object.keys(snapshot.tags) : [];
    const addedTags = new Set<string>();
    const removedTags = new Set<string>();

    changes.forEach((c: any) => {
      const tagName = c.path?.[1];
      if (tagName == null) return;
      if (c.kind === 'N') addedTags.add(String(tagName));
      if (c.kind === 'D') removedTags.add(String(tagName));
    });

    // All tags = current + removed
    const allTags = [...currentTags];
    removedTags.forEach((tag) => {
      if (!allTags.includes(tag)) allTags.push(tag);
    });

    if (allTags.length === 0 && removedTags.size === 0) return null;

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Tags</div>
        <div className="flex flex-row flex-wrap gap-1.5 p-2">
          {allTags.map((tag) => {
            if (removedTags.has(tag)) {
              return (
                <span key={tag} className="badge badge-error badge-outline badge-sm line-through opacity-70">
                  {tag}
                </span>
              );
            }
            if (addedTags.has(tag)) {
              return (
                <span key={tag} className="badge badge-success badge-outline badge-sm font-medium">
                  + {tag}
                </span>
              );
            }
            return (
              <span key={tag} className="badge badge-outline badge-sm">
                {tag}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── STEPS (full snapshot rendering) ──────────────

  const renderSteps = (log: AuditLog, changes: any[]) => {
    const snapshot = log.snapshot;
    const steps: Record<string, any> = snapshot?.steps ?? {};
    const changedPaths = buildChangedPaths(changes);

    // Collect removed steps (kind='D' with path ['steps', stepKey])
    const removedSteps: Map<string, any> = new Map();
    changes.forEach((c: any) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'steps') {
        removedSteps.set(c.path[1], c.lhs);
      }
    });

    // Detect newly added steps (kind='N' with path ['steps', stepKey])
    const addedSteps = new Set<string>();
    changes.forEach((c: any) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'steps') {
        addedSteps.add(c.path[1]);
      }
    });

    // Sort steps by position
    const sortedSteps = Object.entries(steps).sort(([, a], [, b]) => (a?.position ?? 0) - (b?.position ?? 0));

    // Check if any step position changed
    const hasPositionChange = changes.some((c: any) => c.path?.[0] === 'steps' && c.path?.[2] === 'position' && c.kind === 'E');

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Schritte</div>
        <div className="flex flex-col p-2">
          {hasPositionChange && <div className="mb-2 px-1 text-xs italic text-info">Reihenfolge der Schritte wurde geändert</div>}

          {/* Removed steps */}
          {Array.from(removedSteps.entries()).map(([stepKey, stepData]) => (
            <div key={`removed-${stepKey}`} className="mb-2 border-b border-base-200 pb-2 opacity-60 last:mb-0 last:border-b-0 last:pb-0">
              <div className="font-bold text-error line-through">
                − {t(stepData?.action || stepKey)}
                {stepData?.optional === true ? ' (optional)' : ''}
              </div>
              {stepData?.ingredients &&
                Object.entries(stepData.ingredients).map(([ingName, ing]: [string, any]) => (
                  <div key={ingName} className="flex flex-row gap-2 pl-2 text-sm text-error/70 line-through">
                    <span>{ing?.amount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}</span>
                    <span>{ing?.unit ? t(ing.unit) : ''}</span>
                    <span>
                      {ingName}
                      {ing?.optional === true ? ' (optional)' : ''}
                    </span>
                  </div>
                ))}
            </div>
          ))}

          {/* Current steps from snapshot */}
          {sortedSteps.map(([stepKey, stepData]) => {
            const isNew = addedSteps.has(stepKey);
            const actionName = stepData?.action || stepKey;
            const actionChange = changedPaths.get(`steps.${stepKey}.action`);
            const ingredientsMap: Record<string, any> = stepData?.ingredients ?? {};
            const sortedIngredients = Object.entries(ingredientsMap).sort(
              ([, a]: [string, any], [, b]: [string, any]) => (a?.position ?? 0) - (b?.position ?? 0),
            );

            return (
              <div
                key={stepKey}
                className={`mb-2 border-b border-base-200 pb-2 last:mb-0 last:border-b-0 last:pb-0 ${isNew ? 'rounded bg-success/10 px-1' : ''}`}
              >
                {/* Step title with action name */}
                <div className={`flex flex-wrap items-center gap-1.5 font-bold ${isNew ? 'text-success' : ''}`}>
                  {isNew && <span className="mr-1 text-success">+</span>}
                  {/* Show action change */}
                  {actionChange && actionChange.kind === 'E' ? (
                    <>
                      <span className="text-error line-through">{t(String(actionChange.lhs))}</span>
                      <span className="text-base-content/50">→</span>
                      <span className="text-success">{t(actionName)}</span>
                    </>
                  ) : (
                    <span>{t(actionName)}</span>
                  )}
                  {/* Optional status */}
                  {(() => {
                    const optChange = changedPaths.get(`steps.${stepKey}.optional`);
                    if (optChange) {
                      if (optChange.kind === 'N' || (optChange.kind === 'E' && stepData?.optional === true)) {
                        return <span className="badge badge-success badge-outline badge-xs">+ optional</span>;
                      }
                      if (optChange.kind === 'D' || (optChange.kind === 'E' && stepData?.optional !== true)) {
                        return <span className="badge badge-error badge-outline badge-xs line-through">optional</span>;
                      }
                    }
                    return stepData?.optional === true ? <span className="text-xs font-normal text-base-content/50">(optional)</span> : null;
                  })()}
                </div>
                {/* Ingredient order change indicator */}
                {changes.some(
                  (c: any) =>
                    c.kind === 'E' && c.path?.[0] === 'steps' && c.path?.[1] === stepKey && c.path?.[2] === 'ingredients' && c.path?.[4] === 'position',
                ) && <div className="pl-2 text-xs italic text-info">Reihenfolge der Zutaten wurde geändert</div>}
                {/* Ingredients */}
                {sortedIngredients.map(([ingName, ing]) => {
                  const ingBase = `steps.${stepKey}.ingredients.${ingName}`;
                  const amountChange = changedPaths.get(`${ingBase}.amount`);
                  const unitChange = changedPaths.get(`${ingBase}.unit`);
                  const optionalChange = changedPaths.get(`${ingBase}.optional`);
                  // Check if ingredient is entirely new
                  const isNewIngredient = changedPaths.has(ingBase) && changedPaths.get(ingBase)?.kind === 'N';

                  const amount = ing?.amount;
                  const unit = ing?.unit;

                  return (
                    <div
                      key={ingName}
                      className={`flex flex-row flex-wrap items-baseline gap-1 pl-2 text-sm ${isNew || isNewIngredient ? 'text-success' : ''}`}
                    >
                      {isNewIngredient && !isNew && <span className="mr-0.5 font-medium text-success">+</span>}
                      {/* Amount */}
                      {amountChange && amountChange.kind === 'E' ? (
                        <>
                          {!isUndefinedish(amountChange.lhs) && (
                            <span className="text-error line-through">
                              {Number(amountChange.lhs).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          )}
                          <span className="rounded bg-success/10 px-0.5 font-medium text-success">
                            {amount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}
                          </span>
                        </>
                      ) : (
                        <span>{amount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}</span>
                      )}
                      {/* Unit */}
                      {unitChange && unitChange.kind === 'E' ? (
                        <>
                          {!isUndefinedish(unitChange.lhs) && <span className="text-error line-through">{t(String(unitChange.lhs))}</span>}
                          <span className="rounded bg-success/10 px-0.5 font-medium text-success">{unit ? t(unit) : ''}</span>
                        </>
                      ) : (
                        <span>{unit ? t(unit) : ''}</span>
                      )}
                      {/* Ingredient name */}
                      <span>{ingName}</span>
                      {/* Optional status */}
                      {optionalChange ? (
                        optionalChange.kind === 'N' || (optionalChange.kind === 'E' && ing?.optional === true) ? (
                          <span className="badge badge-success badge-outline badge-xs">+ optional</span>
                        ) : optionalChange.kind === 'D' || (optionalChange.kind === 'E' && ing?.optional !== true) ? (
                          <span className="badge badge-error badge-outline badge-xs line-through">optional</span>
                        ) : null
                      ) : (
                        ing?.optional === true && <span className="text-xs text-base-content/50">(optional)</span>
                      )}
                    </div>
                  );
                })}
                {/* Removed ingredients within this step */}
                {changes
                  .filter(
                    (c: any) => c.kind === 'D' && c.path?.[0] === 'steps' && c.path?.[1] === stepKey && c.path?.[2] === 'ingredients' && c.path?.length === 4,
                  )
                  .map((c: any) => {
                    const removedIngName = c.path[3];
                    const removedIng = c.lhs;
                    return (
                      <div key={`removed-ing-${removedIngName}`} className="flex flex-row items-baseline gap-1 pl-2 text-sm text-error/70 line-through">
                        <span>−</span>
                        <span>{removedIng?.amount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}</span>
                        <span>{removedIng?.unit ? t(removedIng.unit) : ''}</span>
                        <span>{removedIngName}</span>
                        {removedIng?.optional === true && <span>(optional)</span>}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── GARNISHES (full snapshot rendering) ──────────────

  const renderGarnishes = (log: AuditLog, changes: any[]) => {
    const snapshot = log.snapshot;
    const garnishes: Record<string, any> = snapshot?.garnishes ?? {};
    const changedPaths = buildChangedPaths(changes);

    // Collect removed garnishes
    const removedGarnishes: Map<string, any> = new Map();
    changes.forEach((c: any) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'garnishes') {
        removedGarnishes.set(c.path[1], c.lhs);
      }
    });

    const addedGarnishes = new Set<string>();
    changes.forEach((c: any) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'garnishes') {
        addedGarnishes.add(c.path[1]);
      }
    });

    // Position change?
    const hasPositionChange = changes.some((c: any) => c.path?.[0] === 'garnishes' && c.path?.[2] === 'position' && c.kind === 'E');

    const sortedGarnishes = Object.entries(garnishes).sort(([, a], [, b]) => (a?.position ?? 0) - (b?.position ?? 0));

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Garnituren</div>
        <div className="flex flex-col gap-1.5 p-2">
          {hasPositionChange && <div className="px-1 text-xs italic text-info">Reihenfolge der Garnituren wurde geändert</div>}
          {/* Removed */}
          {Array.from(removedGarnishes.entries()).map(([name, data]) => (
            <div key={`removed-${name}`} className="flex flex-wrap items-center gap-1.5 pl-2 text-sm text-error/70 line-through">
              <span>−</span>
              {data?.alternative === true && <span className="font-bold">oder</span>}
              <span>{name}</span>
              {data?.optional === true && <span>(optional)</span>}
              {data?.note && <span className="text-base-content/50">– {data.note}</span>}
            </div>
          ))}
          {/* Current */}
          {sortedGarnishes.map(([name, data]) => {
            const isNew = addedGarnishes.has(name);
            const gBase = `garnishes.${name}`;
            const optionalChange = changedPaths.get(`${gBase}.optional`);
            const alternativeChange = changedPaths.get(`${gBase}.alternative`);
            const noteChange = changedPaths.get(`${gBase}.note`);

            return (
              <div key={name} className={`pl-2 text-sm ${isNew ? 'font-medium text-success' : ''}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {isNew && <span className="text-success">+</span>}
                  {/* Alternative status */}
                  {alternativeChange ? (
                    alternativeChange.kind === 'N' || (alternativeChange.kind === 'E' && data?.alternative === true) ? (
                      <span className="badge badge-success badge-outline badge-xs">+ oder</span>
                    ) : alternativeChange.kind === 'D' || (alternativeChange.kind === 'E' && data?.alternative !== true) ? (
                      <span className="badge badge-error badge-outline badge-xs line-through">oder</span>
                    ) : (
                      data?.alternative === true && <span className="font-bold">oder</span>
                    )
                  ) : (
                    data?.alternative === true && <span className="font-bold">oder</span>
                  )}
                  <span>{name}</span>
                  {/* Optional status */}
                  {optionalChange ? (
                    optionalChange.kind === 'N' || (optionalChange.kind === 'E' && data?.optional === true) ? (
                      <span className="badge badge-success badge-outline badge-xs">+ optional</span>
                    ) : optionalChange.kind === 'D' || (optionalChange.kind === 'E' && data?.optional !== true) ? (
                      <span className="badge badge-error badge-outline badge-xs line-through">optional</span>
                    ) : null
                  ) : (
                    data?.optional === true && <span className="text-xs text-base-content/50">(optional)</span>
                  )}
                </div>
                {/* Note change */}
                {noteChange && !isNew ? (
                  <div className="mt-0.5 pl-4">
                    {noteChange.kind === 'E' && (
                      <div className="flex flex-col gap-0.5">
                        {!isUndefinedish(noteChange.lhs) && <span className="text-xs text-error line-through">Notiz: {String(noteChange.lhs)}</span>}
                        {!isUndefinedish(noteChange.rhs) && <span className="text-xs text-success">Notiz: {String(noteChange.rhs)}</span>}
                      </div>
                    )}
                    {noteChange.kind === 'N' && !isUndefinedish(noteChange.rhs) && (
                      <span className="text-xs text-success">+ Notiz: {String(noteChange.rhs)}</span>
                    )}
                    {noteChange.kind === 'D' && !isUndefinedish(noteChange.lhs) && (
                      <span className="text-xs text-error line-through">Notiz: {String(noteChange.lhs)}</span>
                    )}
                  </div>
                ) : (
                  data?.note && !isNew && <div className="mt-0.5 pl-4 text-xs text-base-content/50">Notiz: {data.note}</div>
                )}
                {isNew && data?.note && <div className="mt-0.5 pl-4 text-xs">Notiz: {data.note}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── UNITS (for Ingredient entity) ──────────────

  const renderUnits = (log: AuditLog, changes: any[]) => {
    const snapshot = log.snapshot;
    const currentUnits: Record<string, string> = snapshot?.units ?? {};
    const addedUnits = new Set<string>();
    const removedUnits = new Map<string, string>(); // unit name -> old volume
    const changedUnits = new Map<string, { oldVolume: string; newVolume: string }>();

    changes.forEach((c: any) => {
      if (c.path?.length === 2 && c.path[0] === 'units') {
        const unitName = c.path[1];
        if (c.kind === 'N') addedUnits.add(String(unitName));
        if (c.kind === 'D') removedUnits.set(String(unitName), String(c.lhs));
        if (c.kind === 'E') changedUnits.set(String(unitName), { oldVolume: String(c.lhs), newVolume: String(c.rhs) });
      }
    });

    // All units = current + removed
    const allUnitNames = [...Object.keys(currentUnits)];
    removedUnits.forEach((_, name) => {
      if (!allUnitNames.includes(name)) allUnitNames.push(name);
    });

    if (allUnitNames.length === 0) return null;

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Einheiten</div>
        <div className="flex flex-col gap-1 p-2">
          {allUnitNames.map((unitName) => {
            if (removedUnits.has(unitName)) {
              return (
                <div key={unitName} className="flex items-center gap-2 pl-2 text-sm text-error/70 line-through">
                  <span>−</span>
                  <span>{t(unitName)}</span>
                  <span className="text-base-content/50">({removedUnits.get(unitName)})</span>
                </div>
              );
            }
            const isAdded = addedUnits.has(unitName);
            const volumeChange = changedUnits.get(unitName);
            return (
              <div key={unitName} className={`flex items-center gap-2 pl-2 text-sm ${isAdded ? 'font-medium text-success' : ''}`}>
                {isAdded && <span className="text-success">+</span>}
                <span>{t(unitName)}</span>
                {volumeChange ? (
                  <span className="flex items-center gap-1">
                    <span className="text-error line-through">{volumeChange.oldVolume}</span>
                    <span className="text-base-content/50">→</span>
                    <span className="font-medium text-success">{volumeChange.newVolume}</span>
                  </span>
                ) : (
                  <span className="text-base-content/50">({currentUnits[unitName]})</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── CALCULATION ITEMS (for CocktailCalculation entity) ──────────────

  const renderCalculationItems = (log: AuditLog, changes: any[]) => {
    const snapshot = log.snapshot;
    const cocktails: Record<string, any> = snapshot?.cocktails ?? {};
    const changedPaths = buildChangedPaths(changes);

    // Collect removed cocktails
    const removedCocktails: Map<string, any> = new Map();
    changes.forEach((c: any) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'cocktails') {
        removedCocktails.set(c.path[1], c.lhs);
      }
    });

    // Detect newly added cocktails
    const addedCocktails = new Set<string>();
    changes.forEach((c: any) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'cocktails') {
        addedCocktails.add(c.path[1]);
      }
    });

    const sortedCocktails = Object.entries(cocktails).sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Cocktails</div>
        <div className="flex flex-col gap-1 p-2">
          {/* Removed cocktails */}
          {Array.from(removedCocktails.entries()).map(([name, data]) => (
            <div key={`removed-${name}`} className="flex items-center gap-2 pl-2 text-sm text-error/70 line-through">
              <span>−</span>
              <span>{name}</span>
              {data?.plannedAmount != null && <span className="text-base-content/50">× {data.plannedAmount}</span>}
              {data?.customPrice != null && <span className="text-base-content/50">({data.customPrice} €)</span>}
            </div>
          ))}
          {/* Current cocktails */}
          {sortedCocktails.map(([name, data]) => {
            const isAdded = addedCocktails.has(name);
            const cBase = `cocktails.${name}`;
            const amountChange = changedPaths.get(`${cBase}.plannedAmount`);
            const priceChange = changedPaths.get(`${cBase}.customPrice`);

            return (
              <div key={name} className={`flex flex-wrap items-center gap-2 pl-2 text-sm ${isAdded ? 'font-medium text-success' : ''}`}>
                {isAdded && <span className="text-success">+</span>}
                <span>{name}</span>
                {/* Planned amount */}
                {amountChange && amountChange.kind === 'E' ? (
                  <span className="flex items-center gap-1">
                    <span className="text-base-content/50">×</span>
                    <span className="text-error line-through">{amountChange.lhs}</span>
                    <span className="text-base-content/50">→</span>
                    <span className="font-medium text-success">{amountChange.rhs}</span>
                  </span>
                ) : (
                  data?.plannedAmount != null && <span className="text-base-content/50">× {data.plannedAmount}</span>
                )}
                {/* Custom price */}
                {priceChange ? (
                  priceChange.kind === 'E' ? (
                    <span className="flex items-center gap-1">
                      {!isUndefinedish(priceChange.lhs) && <span className="text-error line-through">({priceChange.lhs} €)</span>}
                      <span className="text-base-content/50">→</span>
                      {!isUndefinedish(priceChange.rhs) && <span className="font-medium text-success">({priceChange.rhs} €)</span>}
                    </span>
                  ) : priceChange.kind === 'N' && !isUndefinedish(priceChange.rhs) ? (
                    <span className="font-medium text-success">+ Sonderpreis: {priceChange.rhs} €</span>
                  ) : priceChange.kind === 'D' && !isUndefinedish(priceChange.lhs) ? (
                    <span className="text-error line-through">Sonderpreis: {priceChange.lhs} €</span>
                  ) : null
                ) : (
                  data?.customPrice != null && !isAdded && <span className="text-base-content/50">({data.customPrice} €)</span>
                )}
                {isAdded && data?.customPrice != null && <span>({data.customPrice} €)</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── SHOPPING UNITS (for CocktailCalculation entity) ──────────────

  const renderShoppingUnits = (log: AuditLog, changes: any[]) => {
    const snapshot = log.snapshot;
    const shoppingUnits: Record<string, any> = snapshot?.shoppingUnits ?? {};
    const changedPaths = buildChangedPaths(changes);

    // Collect removed shopping units
    const removedUnits: Map<string, any> = new Map();
    changes.forEach((c: any) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'shoppingUnits') {
        removedUnits.set(c.path[1], c.lhs);
      }
    });

    // Detect newly added shopping units
    const addedUnits = new Set<string>();
    changes.forEach((c: any) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'shoppingUnits') {
        addedUnits.add(c.path[1]);
      }
    });

    const sortedUnits = Object.entries(shoppingUnits).sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Einkaufsliste Einheiten</div>
        <div className="flex flex-col gap-1 p-2">
          {/* Removed units */}
          {Array.from(removedUnits.entries()).map(([ingredientName, data]) => (
            <div key={`removed-${ingredientName}`} className="flex items-center gap-2 pl-2 text-sm text-error/70 line-through">
              <span>−</span>
              <span>{ingredientName}</span>
              {data?.unit && <span className="text-base-content/50">→ {t(data.unit)}</span>}
            </div>
          ))}
          {/* Current units */}
          {sortedUnits.map(([ingredientName, data]) => {
            const isAdded = addedUnits.has(ingredientName);
            const base = `shoppingUnits.${ingredientName}`;
            const unitChange = changedPaths.get(`${base}.unit`);
            const checkedChange = changedPaths.get(`${base}.checked`);

            return (
              <div key={ingredientName} className={`flex flex-wrap items-center gap-2 pl-2 text-sm ${isAdded ? 'font-medium text-success' : ''}`}>
                {isAdded && <span className="text-success">+</span>}
                <span>{ingredientName}</span>
                {/* Unit */}
                {unitChange && unitChange.kind === 'E' ? (
                  <span className="flex items-center gap-1">
                    <span className="text-base-content/50">→</span>
                    <span className="text-error line-through">{t(String(unitChange.lhs))}</span>
                    <span className="text-base-content/50">→</span>
                    <span className="font-medium text-success">{t(String(unitChange.rhs))}</span>
                  </span>
                ) : (
                  data?.unit && <span className="text-base-content/50">→ {t(data.unit)}</span>
                )}
                {/* Checked state */}
                {checkedChange &&
                  (checkedChange.kind === 'N' ? (
                    <span className="font-medium text-success">✓</span>
                  ) : checkedChange.kind === 'D' ? (
                    <span className="text-error line-through">✓</span>
                  ) : checkedChange.kind === 'E' ? (
                    checkedChange.rhs === true ? (
                      <span className="font-medium text-success">+ ausgewählt</span>
                    ) : (
                      <span className="text-error">− abgewählt</span>
                    )
                  ) : null)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── GENERAL FIELDS ──────────────

  /** Translates snapshot values to German display values */
  const displayValue = (val: string, useTranslation = false): string => {
    if (val === 'true') return 'Ja';
    if (useTranslation) return t(val);
    return val;
  };

  /** Translates snapshot sub-path keys to German labels */
  const displaySubPath = (pathSegments: string[]): string => {
    return pathSegments.map((seg) => GROUP_HEADERS[seg] || seg).join(' › ');
  };

  const renderGeneralChanges = (group: string, changes: any[]) => {
    const isLongText = LONG_TEXT_FIELDS.includes(group);
    const isIce = group === 'ice';
    const headerLabel = GROUP_HEADERS[group] || group;

    const renderedChanges = changes
      .map((change: any, index: number) => {
        const subPath = change.path?.length > 1 ? displaySubPath(change.path.slice(1)) : '';
        const isPosition = change.path && change.path[change.path.length - 1] === 'position';
        const lhsRaw = change.lhs;
        const rhsRaw = change.rhs;
        const lhsUndef = isUndefinedish(lhsRaw);
        const rhsUndef = isUndefinedish(rhsRaw);
        const lhsDisplay = !lhsUndef ? displayValue(String(lhsRaw), isIce) : '';
        const rhsDisplay = !rhsUndef ? displayValue(String(rhsRaw), isIce) : '';

        if (change.kind === 'E') {
          if (isPosition) {
            return (
              <div key={index} className="flex items-center gap-2">
                {subPath && <span className="text-base-content/50">Reihenfolge:</span>}
                <span className="text-error line-through">{String(lhsRaw)}</span>
                <span className="text-base-content/50">→</span>
                <span className="font-medium text-success">{String(rhsRaw)}</span>
              </div>
            );
          }
          if (isLongText) {
            return (
              <div key={index} className="flex flex-col gap-1">
                {subPath && <div className="text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
                {!lhsUndef && <div className="whitespace-pre-wrap break-words rounded bg-error/10 px-2 py-1 text-error line-through">− {lhsDisplay}</div>}
                {!rhsUndef && <div className="whitespace-pre-wrap break-words rounded bg-success/10 px-2 py-1 text-success">+ {rhsDisplay}</div>}
              </div>
            );
          }
          return (
            <div key={index} className="flex flex-col gap-0.5">
              {subPath && <div className="font-mono text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
              <div className="flex flex-wrap items-center gap-2">
                {!lhsUndef && <span className="rounded bg-error/10 px-1 text-error line-through">{lhsDisplay}</span>}
                {!lhsUndef && !rhsUndef && <span className="text-base-content/50">→</span>}
                {!rhsUndef && <span className="rounded bg-success/10 px-1 font-medium text-success">{rhsDisplay}</span>}
              </div>
            </div>
          );
        }
        if (change.kind === 'N') {
          if (rhsUndef) return null;
          if (isLongText) {
            return (
              <div key={index} className="flex flex-col gap-1">
                {subPath && <div className="text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
                <div className="whitespace-pre-wrap break-words rounded bg-success/10 px-2 py-1 text-success">+ {rhsDisplay}</div>
              </div>
            );
          }
          return (
            <div key={index}>
              {subPath && <div className="font-mono text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
              <span className="font-medium text-success">+ {rhsDisplay}</span>
            </div>
          );
        }
        if (change.kind === 'D') {
          if (lhsUndef) return null;
          if (isLongText) {
            return (
              <div key={index} className="flex flex-col gap-1">
                {subPath && <div className="text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
                <div className="whitespace-pre-wrap break-words rounded bg-error/10 px-2 py-1 text-error line-through">− {lhsDisplay}</div>
              </div>
            );
          }
          return (
            <div key={index}>
              {subPath && <div className="font-mono text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
              <span className="text-error line-through">− {lhsDisplay}</span>
            </div>
          );
        }
        if (change.kind === 'A') {
          const item = change.item;
          const irhsUndef = isUndefinedish(item?.rhs);
          const ilhsUndef = isUndefinedish(item?.lhs);
          return (
            <div key={index} className="flex flex-col gap-0.5">
              {subPath && <div className="font-mono text-[10px] uppercase tracking-wider text-base-content/50">{subPath}</div>}
              {item?.kind === 'N' && !irhsUndef && <span className="font-medium text-success">+ {String(item.rhs)}</span>}
              {item?.kind === 'D' && !ilhsUndef && <span className="text-error line-through">− {String(item.lhs)}</span>}
              {item?.kind === 'E' && (
                <div className="flex flex-wrap items-center gap-2">
                  {!ilhsUndef && <span className="text-error line-through">{String(item.lhs)}</span>}
                  {!ilhsUndef && !irhsUndef && <span className="text-base-content/50">→</span>}
                  {!irhsUndef && <span className="font-medium text-success">{String(item.rhs)}</span>}
                </div>
              )}
            </div>
          );
        }
        return null;
      })
      .filter(Boolean);

    if (renderedChanges.length === 0) return null;

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold capitalize text-base-content">{headerLabel}</div>
        <div className="flex flex-col gap-2 p-2">{renderedChanges}</div>
      </div>
    );
  };

  // ────────────── IMAGE ──────────────

  const renderImage = (changes: any[]) => {
    const change = changes[0];
    if (!change) return null;

    let displayLabel = '';
    let color = '';
    if (change.kind === 'N') {
      displayLabel = '+ Hinzugefügt';
      color = 'text-success';
    } else if (change.kind === 'D') {
      displayLabel = '− Entfernt';
      color = 'text-error';
    } else if (change.kind === 'E') {
      displayLabel = '+ Geändert';
      color = 'text-info';
    }

    if (!displayLabel) return null;

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">Bild</div>
        <div className="p-2">
          <span className={`font-medium ${color}`}>{displayLabel}</span>
        </div>
      </div>
    );
  };

  // ────────────── RENDER DIFF ──────────────

  const renderDiff = (log: AuditLog) => {
    if (log.action === 'CREATE') {
      const name = log.changes?.name || log.snapshot?.name || entityName;
      return <div className="text-sm text-success">+ &quot;{name}&quot; hinzugefügt</div>;
    }

    if (log.action === 'DELETE') {
      return <div className="text-sm text-error">− &quot;{entityName}&quot; gelöscht</div>;
    }

    if (log.action === 'UPDATE' && Array.isArray(log.changes)) {
      const groupedChanges: Record<string, any[]> = {};
      log.changes.forEach((change: any) => {
        const root = change.path?.[0] || 'General';
        if (!groupedChanges[root]) groupedChanges[root] = [];
        groupedChanges[root].push(change);
      });

      return (
        <div className="flex flex-col gap-3 text-sm">
          {Object.entries(groupedChanges).map(([group, changes]) => {
            if (group === 'tags') return <React.Fragment key={group}>{renderTags(log, changes)}</React.Fragment>;
            if (group === 'steps') return <React.Fragment key={group}>{renderSteps(log, changes)}</React.Fragment>;
            if (group === 'garnishes') return <React.Fragment key={group}>{renderGarnishes(log, changes)}</React.Fragment>;
            if (group === 'image') return <React.Fragment key={group}>{renderImage(changes)}</React.Fragment>;
            if (group === 'units') return <React.Fragment key={group}>{renderUnits(log, changes)}</React.Fragment>;
            if (group === 'cocktails') return <React.Fragment key={group}>{renderCalculationItems(log, changes)}</React.Fragment>;
            if (group === 'shoppingUnits') return <React.Fragment key={group}>{renderShoppingUnits(log, changes)}</React.Fragment>;
            return <React.Fragment key={group}>{renderGeneralChanges(group, changes)}</React.Fragment>;
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={'flex h-full max-h-[80vh] flex-col gap-4'}>
      <div>
        <div className={'text-2xl font-bold'}>Bearbeitungshistorie</div>
        <div className="text-sm text-base-content/60">{entityName}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-4">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-center text-base-content/60">Kein Verlauf gefunden.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {logs
              .sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)))
              .map((log) => (
                <div key={log.id} className="relative rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {log.user?.image ? (
                        <img src={log.user.image} alt={log.user.name || 'User'} className="h-6 w-6 rounded-full" />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs">{log.user?.name?.[0] || '?'}</div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{log.user?.name || 'Unbekannt'}</span>
                        <span className="text-xs text-base-content/60">{moment(log.createdAt).format('DD.MM.YYYY HH:mm')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge badge-outline badge-sm ${log.action === 'CREATE' ? 'badge-success' : log.action === 'DELETE' ? 'badge-error' : 'badge-info'}`}
                      >
                        {log.action === 'CREATE' ? 'Erstellt' : log.action === 'UPDATE' ? 'Aktualisiert' : 'Gelöscht'}
                      </span>
                      {(log.exportData || log.snapshot) && (
                        <button
                          className="btn btn-square btn-outline btn-xs"
                          onClick={() => {
                            let exportContent: any;
                            if (log.exportData) {
                              exportContent = buildExportData(entityType, log.exportData, '1.0');
                            } else {
                              exportContent = log.snapshot;
                            }
                            const blob = new Blob([JSON.stringify(exportContent, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${entityName}_${moment(log.createdAt).format('YYYYMMDD_HHmm')}.json`;
                            a.click();
                          }}
                          title="Export"
                        >
                          <FaFileDownload />
                        </button>
                      )}
                    </div>
                  </div>
                  {renderDiff(log)}
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 justify-end border-base-200">
        <button className="btn btn-outline" onClick={() => modalContext.closeModal()}>
          Schließen
        </button>
      </div>
    </div>
  );
}
