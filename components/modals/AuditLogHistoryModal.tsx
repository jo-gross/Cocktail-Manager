import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { FaFileDownload } from 'react-icons/fa';
import { buildExportData } from '@lib/auditExport';
import { formatDateTime, formatDateTimeCompact } from '@lib/DateUtils';
import { Badge, Button, Loading } from '@components/ui';

import type { AuditLogDto } from '@lib/schemas/auditLogs';
import { fetchAuditLogsSafe } from '@lib/network/auditLogs';

interface AuditLogHistoryModalProps {
  entityType: string;
  entityId: string;
  entityName: string;
}

interface AuditChange {
  kind: 'N' | 'E' | 'D' | 'A';
  path?: string[];
  lhs?: unknown;
  rhs?: unknown;
  item?: {
    kind: 'N' | 'E' | 'D';
    lhs?: unknown;
    rhs?: unknown;
  };
}

type AuditSnapshot = Record<string, unknown>;
type AuditExportData = Record<string, unknown>;

type AuditLog = AuditLogDto & {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  changes: AuditChange[] | Record<string, unknown> | null;
  snapshot?: AuditSnapshot | null;
  exportData?: AuditExportData | null;
};

const LONG_TEXT_FIELDS = ['description', 'preparation', 'history', 'notes'];

/** Maps snapshot keys to i18n header keys under entity:auditHeader.* */
const GROUP_HEADER_KEYS = {
  name: 'name',
  description: 'description',
  preparation: 'preparation',
  history: 'history',
  price: 'price',
  glass: 'glass',
  ice: 'ice',
  image: 'image',
  tags: 'tags',
  steps: 'steps',
  garnishes: 'garnishes',
  notes: 'notes',
  volume: 'volume',
  deposit: 'deposit',
  shortName: 'shortName',
  link: 'link',
  units: 'units',
  showSalesInfo: 'showSalesInfo',
  cocktails: 'cocktails',
  shoppingUnits: 'shoppingUnits',
  unit: 'unit',
  checked: 'checked',
  plannedAmount: 'plannedAmount',
  customPrice: 'customPrice',
} as const;

type AuditHeaderKey = (typeof GROUP_HEADER_KEYS)[keyof typeof GROUP_HEADER_KEYS];

function isAuditHeaderKey(value: string): value is AuditHeaderKey {
  return Object.prototype.hasOwnProperty.call(GROUP_HEADER_KEYS, value);
}

export function AuditLogHistoryModal({ entityType, entityId, entityName }: AuditLogHistoryModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const { t: ti18n } = useTranslation(['common', 'entity', 'cocktail']);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId && entityId) {
      fetchAuditLogsSafe(workspaceId, { entityType, entityId, limit: 100 }, (logs) => setLogs(logs as AuditLog[]), setLoading);
    }
  }, [workspaceId, entityId, entityType]);

  const t = (text: string) => userContext.getTranslation(text);

  /**
   * Collects all changed paths from the changes array into a Map of
   * serialized path strings for quick lookups.
   */
  const buildChangedPaths = (changes: AuditChange[]): Map<string, AuditChange> => {
    const map = new Map<string, AuditChange>();
    if (!Array.isArray(changes)) return map;
    changes.forEach((c: AuditChange) => {
      if (c.path) {
        map.set(c.path.join('.'), c);
      }
    });
    return map;
  };

  const isUndefinedish = (val: unknown): boolean => {
    return val === undefined || val === null || (typeof val === 'string' && val.toLowerCase() === 'undefined');
  };

  // ────────────── TAGS ──────────────

  const renderTags = (log: AuditLog, changes: AuditChange[]) => {
    const snapshot = log.snapshot;
    const currentTags: string[] = snapshot?.tags ? Object.keys(snapshot.tags) : [];
    const addedTags = new Set<string>();
    const removedTags = new Set<string>();

    changes.forEach((c: AuditChange) => {
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
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.tags')}</div>
        <div className="flex flex-row flex-wrap gap-1.5 p-2">
          {allTags.map((tag) => {
            if (removedTags.has(tag)) {
              return (
                <span key={tag} className="line-through opacity-70">
                  <Badge variant="error" size="sm" outline>
                    {tag}
                  </Badge>
                </span>
              );
            }
            if (addedTags.has(tag)) {
              return (
                <Badge key={tag} variant="success" size="sm" outline className="font-medium">
                  + {tag}
                </Badge>
              );
            }
            return (
              <Badge key={tag} size="sm" outline>
                {tag}
              </Badge>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── STEPS (full snapshot rendering) ──────────────

  const renderSteps = (log: AuditLog, changes: AuditChange[]) => {
    const snapshot = log.snapshot;
    const steps = (snapshot?.steps ?? {}) as Record<string, Record<string, unknown>>;
    const changedPaths = buildChangedPaths(changes);

    // Collect removed steps (kind='D' with path ['steps', stepKey])
    const removedSteps: Map<string, Record<string, unknown>> = new Map();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'steps') {
        removedSteps.set(c.path![1], (c.lhs ?? {}) as Record<string, unknown>);
      }
    });

    const addedSteps = new Set<string>();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'steps') {
        addedSteps.add(c.path![1]);
      }
    });

    const sortedSteps = Object.entries(steps).sort(([, a], [, b]) => (Number(a?.position) || 0) - (Number(b?.position) || 0));

    // Check if any step position changed
    const hasPositionChange = changes.some((c: AuditChange) => c.path?.[0] === 'steps' && c.path?.[2] === 'position' && c.kind === 'E');

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.steps')}</div>
        <div className="flex flex-col p-2">
          {hasPositionChange && <div className="mb-2 px-1 text-xs text-info italic">{ti18n('entity:auditStepOrderChanged')}</div>}

          {/* Removed steps */}
          {Array.from(removedSteps.entries()).map(([stepKey, stepData]) => (
            <div key={`removed-${stepKey}`} className="mb-2 border-b border-base-200 pb-2 opacity-60 last:mb-0 last:border-b-0 last:pb-0">
              <div className="font-bold text-error line-through">
                − {t(String(stepData?.action || stepKey))}
                {stepData?.optional === true ? <>{ti18n('cocktail:optional')}</> : null}
              </div>
              {stepData?.ingredients
                ? Object.entries(stepData.ingredients as Record<string, Record<string, unknown>>).map(([ingName, ing]: [string, Record<string, unknown>]) => (
                    <div key={ingName} className="flex flex-row gap-2 pl-2 text-sm text-error/70 line-through">
                      <span>{Number(ing?.amount)?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}</span>
                      <span>{ing?.unit ? t(String(ing.unit)) : ''}</span>
                      <span>
                        {ingName}
                        {ing?.optional === true ? <>{ti18n('cocktail:optional')}</> : null}
                      </span>
                    </div>
                  ))
                : null}
            </div>
          ))}

          {/* Current steps from snapshot */}
          {sortedSteps.map(([stepKey, stepData]) => {
            const isNew = addedSteps.has(stepKey);
            const actionName = String(stepData?.action || stepKey);
            const actionChange = changedPaths.get(`steps.${stepKey}.action`);
            const ingredientsMap: Record<string, Record<string, unknown>> = (stepData?.ingredients ?? {}) as Record<string, Record<string, unknown>>;
            const sortedIngredients = Object.entries(ingredientsMap).sort(([, a], [, b]) => (Number(a?.position) || 0) - (Number(b?.position) || 0));

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
                      <span className="text-success">{t(String(actionName))}</span>
                    </>
                  ) : (
                    <span>{t(String(actionName))}</span>
                  )}
                  {/* Optional status */}
                  {(() => {
                    const optChange = changedPaths.get(`steps.${stepKey}.optional`);
                    if (optChange) {
                      if (optChange.kind === 'N' || (optChange.kind === 'E' && stepData?.optional === true)) {
                        return (
                          <Badge variant="success" size="xs" outline>
                            {ti18n('common:plusOptional')}
                          </Badge>
                        );
                      }
                      if (optChange.kind === 'D' || (optChange.kind === 'E' && stepData?.optional !== true)) {
                        return (
                          <Badge variant="error" size="xs" outline className="line-through">
                            {ti18n('common:optionalLower')}
                          </Badge>
                        );
                      }
                    }
                    return stepData?.optional === true ? <span className="text-xs font-normal text-base-content/50">{ti18n('cocktail:optional')}</span> : null;
                  })()}
                </div>
                {/* Ingredient order change indicator */}
                {changes.some(
                  (c: AuditChange) =>
                    c.kind === 'E' && c.path?.[0] === 'steps' && c.path?.[1] === stepKey && c.path?.[2] === 'ingredients' && c.path?.[4] === 'position',
                ) && <div className="pl-2 text-xs text-info italic">{ti18n('entity:auditIngredientOrderChanged')}</div>}
                {/* Ingredients */}
                {sortedIngredients.map(([ingName, ing]: [string, Record<string, unknown>]) => {
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
                            {Number(amount)?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}
                          </span>
                        </>
                      ) : (
                        <span>{Number(amount)?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}</span>
                      )}
                      {/* Unit */}
                      {unitChange && unitChange.kind === 'E' ? (
                        <>
                          {!isUndefinedish(unitChange.lhs) && <span className="text-error line-through">{t(String(unitChange.lhs))}</span>}
                          <span className="rounded bg-success/10 px-0.5 font-medium text-success">{unit ? t(String(unit)) : ''}</span>
                        </>
                      ) : (
                        <span>{unit ? t(String(unit)) : ''}</span>
                      )}
                      {/* Ingredient name */}
                      <span>{ingName}</span>
                      {/* Optional status */}
                      {optionalChange ? (
                        optionalChange.kind === 'N' || (optionalChange.kind === 'E' && ing?.optional === true) ? (
                          <Badge variant="success" size="xs" outline>
                            {ti18n('common:plusOptional')}
                          </Badge>
                        ) : optionalChange.kind === 'D' || (optionalChange.kind === 'E' && ing?.optional !== true) ? (
                          <Badge variant="error" size="xs" outline className="line-through">
                            {ti18n('common:optionalLower')}
                          </Badge>
                        ) : null
                      ) : (
                        ing?.optional === true && <span className="text-xs text-base-content/50">{ti18n('cocktail:optional')}</span>
                      )}
                    </div>
                  );
                })}
                {/* Removed ingredients within this step */}
                {changes
                  .filter(
                    (c: AuditChange) =>
                      c.kind === 'D' && c.path?.[0] === 'steps' && c.path?.[1] === stepKey && c.path?.[2] === 'ingredients' && c.path?.length === 4,
                  )
                  .map((c: AuditChange) => {
                    const removedIngName = c.path![3];
                    const removedIng = c.lhs as Record<string, unknown>;
                    return (
                      <div key={`removed-ing-${removedIngName}`} className="flex flex-row items-baseline gap-1 pl-2 text-sm text-error/70 line-through">
                        <span>−</span>
                        <span>{Number(removedIng?.amount)?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? ''}</span>
                        <span>{removedIng?.unit ? t(String(removedIng.unit)) : ''}</span>
                        <span>{String(removedIngName)}</span>
                        {removedIng?.optional === true && <span>{ti18n('cocktail:optional')}</span>}
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

  const renderGarnishes = (log: AuditLog, changes: AuditChange[]) => {
    const snapshot = log.snapshot;
    const garnishes: Record<string, Record<string, unknown>> = (snapshot?.garnishes as Record<string, Record<string, unknown>>) ?? {};
    const changedPaths = buildChangedPaths(changes);

    const removedGarnishes: Map<string, Record<string, unknown>> = new Map();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'garnishes') {
        removedGarnishes.set(c.path[1], (c.lhs ?? {}) as Record<string, unknown>);
      }
    });

    const addedGarnishes = new Set<string>();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'garnishes') {
        addedGarnishes.add(c.path[1]);
      }
    });

    const hasPositionChange = changes.some((c: AuditChange) => c.path?.[0] === 'garnishes' && c.path?.[2] === 'position' && c.kind === 'E');

    const sortedGarnishes = Object.entries(garnishes).sort(
      ([, a]: [string, Record<string, unknown>], [, b]: [string, Record<string, unknown>]) => (Number(a?.position) || 0) - (Number(b?.position) || 0),
    );

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.garnishes')}</div>
        <div className="flex flex-col gap-1.5 p-2">
          {hasPositionChange && <div className="px-1 text-xs text-info italic">{ti18n('entity:auditGarnishOrderChanged')}</div>}
          {/* Removed */}
          {Array.from(removedGarnishes.entries()).map(([name, data]: [string, Record<string, unknown>]) => (
            <div key={`removed-${name}`} className="flex flex-wrap items-center gap-1.5 pl-2 text-sm text-error/70 line-through">
              <span>−</span>
              {data?.alternative === true ? <span className="font-bold">{ti18n('common:or')}</span> : null}
              <span>{name}</span>
              {data?.optional === true && <span>{ti18n('cocktail:optional')}</span>}
              {data?.note != null && data?.note !== '' && <span className="text-base-content/50">– {String(data.note)}</span>}
            </div>
          ))}
          {/* Current */}
          {sortedGarnishes.map(([name, data]: [string, Record<string, unknown>]) => {
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
                      <Badge variant="success" size="xs" outline>
                        {ti18n('common:plusOr')}
                      </Badge>
                    ) : alternativeChange.kind === 'D' || (alternativeChange.kind === 'E' && data?.alternative !== true) ? (
                      <Badge variant="error" size="xs" outline className="line-through">
                        {ti18n('common:or')}
                      </Badge>
                    ) : (
                      Boolean(data?.alternative) && <span className="font-bold">{ti18n('common:or')}</span>
                    )
                  ) : (
                    Boolean(data?.alternative) && <span className="font-bold">{ti18n('common:or')}</span>
                  )}
                  <span>{name}</span>
                  {/* Optional status */}
                  {optionalChange ? (
                    optionalChange.kind === 'N' || (optionalChange.kind === 'E' && data?.optional === true) ? (
                      <Badge variant="success" size="xs" outline>
                        {ti18n('common:plusOptional')}
                      </Badge>
                    ) : optionalChange.kind === 'D' || (optionalChange.kind === 'E' && data?.optional !== true) ? (
                      <Badge variant="error" size="xs" outline className="line-through">
                        {ti18n('common:optionalLower')}
                      </Badge>
                    ) : null
                  ) : data?.optional === true ? (
                    <span className="text-xs text-base-content/50">{ti18n('cocktail:optional')}</span>
                  ) : null}
                </div>
                {/* Note change */}
                {noteChange && !isNew ? (
                  <div className="mt-0.5 pl-4">
                    {noteChange.kind === 'E' && (
                      <div className="flex flex-col gap-0.5">
                        {!isUndefinedish(noteChange.lhs) && (
                          <span className="text-xs text-error line-through">{ti18n('common:notePrefix', { note: String(noteChange.lhs) })}</span>
                        )}
                        {!isUndefinedish(noteChange.rhs) && (
                          <span className="text-xs text-success">{ti18n('common:notePrefix', { note: String(noteChange.rhs) })}</span>
                        )}
                      </div>
                    )}
                    {noteChange.kind === 'N' && !isUndefinedish(noteChange.rhs) && (
                      <span className="text-xs text-success">{ti18n('common:plusNotePrefix', { note: String(noteChange.rhs) })}</span>
                    )}
                    {noteChange.kind === 'D' && !isUndefinedish(noteChange.lhs) && (
                      <span className="text-xs text-error line-through">{ti18n('common:notePrefix', { note: String(noteChange.lhs) })}</span>
                    )}
                  </div>
                ) : (
                  data?.note != null &&
                  data?.note !== '' &&
                  !isNew && <div className="mt-0.5 pl-4 text-xs text-base-content/50">{ti18n('common:notePrefix', { note: String(data.note) })}</div>
                )}
                {isNew && data?.note != null && data?.note !== '' && (
                  <div className="mt-0.5 pl-4 text-xs">{ti18n('common:notePrefix', { note: String(data.note) })}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── UNITS (for Ingredient entity) ──────────────

  const renderUnits = (log: AuditLog, changes: AuditChange[]) => {
    const snapshot = log.snapshot;
    const currentUnits: Record<string, string> = (snapshot?.units as Record<string, string>) ?? {};
    const addedUnits = new Set<string>();
    const removedUnits = new Map<string, string>();
    const changedUnits = new Map<string, { oldVolume: string; newVolume: string }>();

    changes.forEach((c: AuditChange) => {
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
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.units')}</div>
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

  const renderCalculationItems = (log: AuditLog, changes: AuditChange[]) => {
    const snapshot = log.snapshot;
    const cocktails: Record<string, Record<string, unknown>> = (snapshot?.cocktails as Record<string, Record<string, unknown>>) ?? {};
    const changedPaths = buildChangedPaths(changes);

    const removedCocktails: Map<string, Record<string, unknown>> = new Map();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'cocktails') {
        removedCocktails.set(c.path[1], (c.lhs ?? {}) as Record<string, unknown>);
      }
    });

    const addedCocktails = new Set<string>();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'cocktails') {
        addedCocktails.add(c.path[1]);
      }
    });

    const sortedCocktails = Object.entries(cocktails).sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.cocktails')}</div>
        <div className="flex flex-col gap-1 p-2">
          {/* Removed cocktails */}
          {Array.from(removedCocktails.entries()).map(([name, data]: [string, Record<string, unknown>]) => (
            <div key={`removed-${name}`} className="flex items-center gap-2 pl-2 text-sm text-error/70 line-through">
              <span>−</span>
              <span>{name}</span>
              {data?.plannedAmount != null && <span className="text-base-content/50">× {String(data.plannedAmount)}</span>}
              {data?.customPrice != null && <span className="text-base-content/50">{ti18n('common:euroParen', { value: String(data.customPrice) })}</span>}
            </div>
          ))}
          {/* Current cocktails */}
          {sortedCocktails.map(([name, data]: [string, Record<string, unknown>]) => {
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
                    <span className="text-error line-through">{String(amountChange.lhs)}</span>
                    <span className="text-base-content/50">→</span>
                    <span className="font-medium text-success">{String(amountChange.rhs)}</span>
                  </span>
                ) : (
                  data?.plannedAmount != null && <span className="text-base-content/50">× {String(data.plannedAmount)}</span>
                )}
                {/* Custom price */}
                {priceChange ? (
                  priceChange.kind === 'E' ? (
                    <span className="flex items-center gap-1">
                      {!isUndefinedish(priceChange.lhs) && (
                        <span className="text-error line-through">{ti18n('common:euroParen', { value: String(priceChange.lhs) })}</span>
                      )}
                      <span className="text-base-content/50">→</span>
                      {!isUndefinedish(priceChange.rhs) && (
                        <span className="font-medium text-success">{ti18n('common:euroParen', { value: String(priceChange.rhs) })}</span>
                      )}
                    </span>
                  ) : priceChange.kind === 'N' && !isUndefinedish(priceChange.rhs) ? (
                    <span className="font-medium text-success">{ti18n('common:plusCustomPriceLabel', { price: String(priceChange.rhs) })}</span>
                  ) : priceChange.kind === 'D' && !isUndefinedish(priceChange.lhs) ? (
                    <span className="text-error line-through">{ti18n('common:customPriceLabel', { price: String(priceChange.lhs) })}</span>
                  ) : null
                ) : (
                  data?.customPrice != null &&
                  !isAdded && <span className="text-base-content/50">{ti18n('common:euroParen', { value: String(data.customPrice) })}</span>
                )}
                {isAdded && data?.customPrice != null && <span>{ti18n('common:euroParen', { value: String(data.customPrice) })}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────── SHOPPING UNITS (for CocktailCalculation entity) ──────────────

  const renderShoppingUnits = (log: AuditLog, changes: AuditChange[]) => {
    const snapshot = log.snapshot;
    const shoppingUnits: Record<string, Record<string, unknown>> = (snapshot?.shoppingUnits as Record<string, Record<string, unknown>>) ?? {};
    const changedPaths = buildChangedPaths(changes);

    const removedUnits: Map<string, Record<string, unknown>> = new Map();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'D' && c.path?.length === 2 && c.path[0] === 'shoppingUnits') {
        removedUnits.set(c.path[1], (c.lhs ?? {}) as Record<string, unknown>);
      }
    });

    const addedUnits = new Set<string>();
    changes.forEach((c: AuditChange) => {
      if (c.kind === 'N' && c.path?.length === 2 && c.path[0] === 'shoppingUnits') {
        addedUnits.add(c.path[1]);
      }
    });

    const sortedUnits = Object.entries(shoppingUnits).sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.shoppingUnits')}</div>
        <div className="flex flex-col gap-1 p-2">
          {/* Removed units */}
          {Array.from(removedUnits.entries()).map(([ingredientName, data]: [string, Record<string, unknown>]) => (
            <div key={`removed-${ingredientName}`} className="flex items-center gap-2 pl-2 text-sm text-error/70 line-through">
              <span>−</span>
              <span>{ingredientName}</span>
              {data?.unit != null && data?.unit !== '' && <span className="text-base-content/50">→ {t(String(data.unit))}</span>}
            </div>
          ))}
          {/* Current units */}
          {sortedUnits.map(([ingredientName, data]: [string, Record<string, unknown>]) => {
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
                  data?.unit != null && data?.unit !== '' && <span className="text-base-content/50">→ {t(String(data.unit))}</span>
                )}
                {/* Checked state */}
                {checkedChange &&
                  (checkedChange.kind === 'N' ? (
                    <span className="font-medium text-success">{String.fromCharCode(0x2713)}</span>
                  ) : checkedChange.kind === 'D' ? (
                    <span className="text-error line-through">{String.fromCharCode(0x2713)}</span>
                  ) : checkedChange.kind === 'E' ? (
                    checkedChange.rhs === true ? (
                      <span className="font-medium text-success">{ti18n('common:plusSelected')}</span>
                    ) : (
                      <span className="text-error">{ti18n('common:minusDeselected')}</span>
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
    if (val === 'true') return ti18n('common:yes');
    if (useTranslation) return t(val);
    return val;
  };

  /** Translates snapshot sub-path keys to German labels */
  const displaySubPath = (pathSegments: string[]): string => {
    return pathSegments.map((seg) => (isAuditHeaderKey(seg) ? ti18n(`entity:auditHeader.${GROUP_HEADER_KEYS[seg]}`) : seg)).join(' › ');
  };

  const renderGeneralChanges = (group: string, changes: AuditChange[]) => {
    const isLongText = LONG_TEXT_FIELDS.includes(group);
    const isIce = group === 'ice';
    const headerLabel = isAuditHeaderKey(group) ? ti18n(`entity:auditHeader.${GROUP_HEADER_KEYS[group]}`) : group;

    const renderedChanges = changes
      .map((change: AuditChange, index: number) => {
        const path = change.path;
        const subPath = path && path.length > 1 ? displaySubPath(path.slice(1)) : '';
        const isPosition = path != null && path.length > 0 && path[path.length - 1] === 'position';
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
                {subPath && <span className="text-base-content/50">{ti18n('entity:auditOrder')}</span>}
                <span className="text-error line-through">{String(lhsRaw)}</span>
                <span className="text-base-content/50">→</span>
                <span className="font-medium text-success">{String(rhsRaw)}</span>
              </div>
            );
          }
          if (isLongText) {
            return (
              <div key={index} className="flex flex-col gap-1">
                {subPath && <div className="text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
                {!lhsUndef && <div className="rounded bg-error/10 px-2 py-1 break-words whitespace-pre-wrap text-error line-through">− {lhsDisplay}</div>}
                {!rhsUndef && <div className="rounded bg-success/10 px-2 py-1 break-words whitespace-pre-wrap text-success">+ {rhsDisplay}</div>}
              </div>
            );
          }
          return (
            <div key={index} className="flex flex-col gap-0.5">
              {subPath && <div className="font-mono text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
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
                {subPath && <div className="text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
                <div className="rounded bg-success/10 px-2 py-1 break-words whitespace-pre-wrap text-success">+ {rhsDisplay}</div>
              </div>
            );
          }
          return (
            <div key={index}>
              {subPath && <div className="font-mono text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
              <span className="font-medium text-success">+ {rhsDisplay}</span>
            </div>
          );
        }
        if (change.kind === 'D') {
          if (lhsUndef) return null;
          if (isLongText) {
            return (
              <div key={index} className="flex flex-col gap-1">
                {subPath && <div className="text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
                <div className="rounded bg-error/10 px-2 py-1 break-words whitespace-pre-wrap text-error line-through">− {lhsDisplay}</div>
              </div>
            );
          }
          return (
            <div key={index}>
              {subPath && <div className="font-mono text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
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
              {subPath && <div className="font-mono text-[10px] tracking-wider text-base-content/50 uppercase">{subPath}</div>}
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
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content capitalize">{headerLabel}</div>
        <div className="flex flex-col gap-2 p-2">{renderedChanges}</div>
      </div>
    );
  };

  // ────────────── IMAGE ──────────────

  const renderImage = (changes: AuditChange[]) => {
    const change = changes[0];
    if (!change) return null;

    let displayLabel = '';
    let color = '';
    if (change.kind === 'N') {
      displayLabel = ti18n('entity:auditImageAdded');
      color = 'text-success';
    } else if (change.kind === 'D') {
      displayLabel = ti18n('entity:auditImageRemoved');
      color = 'text-error';
    } else if (change.kind === 'E') {
      displayLabel = ti18n('entity:auditImageChanged');
      color = 'text-info';
    }

    if (!displayLabel) return null;

    return (
      <div className="overflow-hidden rounded border bg-base-100">
        <div className="border-b bg-base-200 px-3 py-1 font-bold text-base-content">{ti18n('entity:auditHeader.image')}</div>
        <div className="p-2">
          <span className={`font-medium ${color}`}>{displayLabel}</span>
        </div>
      </div>
    );
  };

  // ────────────── RENDER DIFF ──────────────

  const renderDiff = (log: AuditLog) => {
    if (log.action === 'CREATE') {
      const changesRecord = log.changes as Record<string, unknown> | undefined;
      const name = String(changesRecord?.name ?? log.snapshot?.name ?? entityName);
      return <div className="text-sm text-success">{ti18n('entity:auditEntityAdded', { name })}</div>;
    }

    if (log.action === 'DELETE') {
      return <div className="text-sm text-error">{ti18n('entity:auditEntityDeleted', { name: entityName })}</div>;
    }

    if (log.action === 'UPDATE' && Array.isArray(log.changes)) {
      const groupedChanges: Record<string, AuditChange[]> = {};
      (log.changes as AuditChange[]).forEach((change: AuditChange) => {
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
        <div className={'text-2xl font-bold'}>{ti18n('entity:auditHistoryTitle')}</div>
        <div className="text-sm text-base-content/60">{entityName}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loading size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-center text-base-content/60">{ti18n('entity:auditNoHistory')}</div>
        ) : (
          <div className="flex flex-col gap-4">
            {logs
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
                        <span className="text-sm font-semibold">{log.user?.name || ti18n('common:unknown')}</span>
                        <span className="text-xs text-base-content/60">{formatDateTime(new Date(log.createdAt))}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge size="sm" outline variant={log.action === 'CREATE' ? 'success' : log.action === 'DELETE' ? 'error' : 'info'}>
                        {log.action === 'CREATE' ? ti18n('common:created') : log.action === 'UPDATE' ? ti18n('common:updated') : ti18n('common:deleted')}
                      </Badge>
                      {(log.exportData || log.snapshot) && (
                        <Button
                          variant="outline"
                          size="xs"
                          shape="square"
                          onClick={() => {
                            const exportContent: Record<string, unknown> = log.exportData
                              ? ((buildExportData(entityType, log.exportData, '1.0') ?? {}) as Record<string, unknown>)
                              : ((log.snapshot ?? {}) as Record<string, unknown>);
                            const blob = new Blob([JSON.stringify(exportContent, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${entityName}_${formatDateTimeCompact(new Date(log.createdAt))}.json`;
                            a.click();
                          }}
                          title={ti18n('common:export')}
                        >
                          <FaFileDownload />
                        </Button>
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
        <Button variant="outline" onClick={() => modalContext.closeModal()}>
          {ti18n('common:close')}
        </Button>
      </div>
    </div>
  );
}
