import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaCheckCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { EntityCombobox } from './EntityCombobox';
import { useRouter } from 'next/router';
import { UnitForm, IceForm, StepActionForm } from './EntityForms';

interface EntityMapping {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
  newEntityData?: any;
}

interface EntityMatch {
  exportId: string;
  exportName: string;
  matches: Array<{ id: string; name: string; actionGroup?: string }>;
}

interface EntityMappingSectionProps {
  title: string;
  entityType: 'units' | 'ice' | 'stepActions' | 'glasses' | 'garnishes' | 'ingredients';
  entities: Array<{ id: string; name: string; actionGroup?: string; [key: string]: any }>;
  mappings: EntityMapping[];
  existingMatches: EntityMatch[];
  autoMatchedCount: number;
  onMappingsChange: (mappings: EntityMapping[]) => void;
}

export function EntityMappingSection({
  title,
  entityType,
  entities,
  mappings,
  existingMatches,
  autoMatchedCount,
  onMappingsChange,
}: EntityMappingSectionProps) {
  const [collapsed, setCollapsed] = useState(autoMatchedCount === entities.length);
  const [actionGroups, setActionGroups] = useState<string[]>([]);
  const router = useRouter();
  const { workspaceId } = router.query;

  // Load action groups for stepActions
  useEffect(() => {
    if (entityType === 'stepActions' && workspaceId) {
      fetch(`/api/workspaces/${workspaceId}/actions`)
        .then((res) => res.json())
        .then((data) => {
          const groups = Array.from(new Set(data.data.map((action: any) => action.actionGroup).filter(Boolean))) as string[];
          setActionGroups(groups);
        })
        .catch((err) => console.error('Error loading action groups:', err));
    }
  }, [entityType, workspaceId]);

  const handleDecisionChange = (exportId: string, decision: 'use-existing' | 'create-new', existingId?: string, newEntityData?: any) => {
    const newMappings = mappings.map((m) =>
      m.exportId === exportId
        ? {
            ...m,
            decision,
            existingId: decision === 'use-existing' ? existingId : undefined,
            newEntityData: decision === 'create-new' ? newEntityData : undefined,
          }
        : m,
    );
    onMappingsChange(newMappings);
  };

  const getMapping = (exportId: string) => {
    return mappings.find((m) => m.exportId === exportId);
  };

  const getMatches = (exportId: string) => {
    return existingMatches.find((m) => m.exportId === exportId)?.matches || [];
  };

  const apiEndpoint = useMemo(() => {
    switch (entityType) {
      case 'units':
        return 'units';
      case 'ice':
        return 'ice';
      case 'stepActions':
        return 'actions';
      case 'glasses':
        return 'glasses';
      case 'garnishes':
        return 'garnishes';
      case 'ingredients':
        return 'ingredients';
      default:
        return '';
    }
  }, [entityType]);

  const fetchOptions = useCallback(
    async (search: string) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        return [];
      }
      const response = await fetch(`/api/workspaces/${workspaceId}/${apiEndpoint}?search=${encodeURIComponent(search)}`);
      const data = await response.json();
      return data.data || [];
    },
    [workspaceId, apiEndpoint],
  );

  const getOptionLabel = useCallback(
    (option: any) => {
      if (entityType === 'stepActions' && option.actionGroup) {
        return `${option.name} (${option.actionGroup})`;
      }
      return option.name;
    },
    [entityType],
  );

  const getOptionValue = useCallback((option: any) => option.id, []);

  const getEntityDisplayName = (entity: any) => {
    if (entityType === 'stepActions' && entity.actionGroup) {
      return `${entity.name} (${entity.actionGroup})`;
    }
    return entity.name;
  };

  const renderNewEntityForm = (exportId: string, entity: any, mapping: EntityMapping) => {
    const currentData = mapping.newEntityData || {};

    const handleDataChange = (newData: any) => {
      handleDecisionChange(exportId, 'create-new', undefined, newData);
    };

    const handleFieldChange = (field: string, value: any) => {
      const newData = { ...currentData, [field]: value };
      handleDataChange(newData);
    };

    // Use Formik forms based on entity type
    switch (entityType) {
      case 'units':
        return <UnitForm initialData={currentData} onDataChange={handleDataChange} entity={entity} />;

      case 'ice':
        return <IceForm initialData={currentData} onDataChange={handleDataChange} entity={entity} />;

      case 'stepActions':
        return <StepActionForm initialData={currentData} onDataChange={handleDataChange} entity={entity} existingGroups={actionGroups} />;

      case 'glasses':
        return (
          <div className="ml-6 rounded-lg border border-base-300 bg-base-200 p-3">
            <div className="mb-2 text-sm font-semibold">Neues Glas erstellen</div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-xs">Name</span>
              </label>
              <input
                type="text"
                className="input input-sm"
                placeholder="Name"
                value={currentData.name || entity.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Volumen (ml)</span>
                </label>
                <input
                  type="number"
                  className="input input-sm"
                  placeholder="Volumen"
                  value={currentData.volume ?? entity.volume ?? ''}
                  onChange={(e) => handleFieldChange('volume', e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Pfand (€)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-sm"
                  placeholder="Pfand"
                  value={currentData.deposit ?? entity.deposit ?? ''}
                  onChange={(e) => handleFieldChange('deposit', e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>
          </div>
        );

      case 'garnishes':
        return (
          <div className="ml-6 rounded-lg border border-base-300 bg-base-200 p-3">
            <div className="mb-2 text-sm font-semibold">Neue Garnitur erstellen</div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-xs">Name</span>
              </label>
              <input
                type="text"
                className="input input-sm"
                placeholder="Name"
                value={currentData.name || entity.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text text-xs">Beschreibung</span>
              </label>
              <input
                type="text"
                className="input input-sm"
                placeholder="Beschreibung (optional)"
                value={currentData.description || entity.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value || null)}
              />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text text-xs">Preis (€)</span>
              </label>
              <input
                type="number"
                step="0.01"
                className="input input-sm"
                placeholder="Preis (optional)"
                value={currentData.price ?? entity.price ?? ''}
                onChange={(e) => handleFieldChange('price', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
          </div>
        );

      case 'ingredients':
        return (
          <div className="ml-6 rounded-lg border border-base-300 bg-base-200 p-3">
            <div className="mb-2 text-sm font-semibold">Neue Zutat erstellen</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Name</span>
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="Name"
                  value={currentData.name || entity.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Kurzname</span>
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="Kurzname (optional)"
                  value={currentData.shortName || entity.shortName || ''}
                  onChange={(e) => handleFieldChange('shortName', e.target.value || null)}
                />
              </div>
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text text-xs">Beschreibung</span>
              </label>
              <input
                type="text"
                className="input input-sm"
                placeholder="Beschreibung (optional)"
                value={currentData.description || entity.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value || null)}
              />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text text-xs">Preis (€)</span>
              </label>
              <input
                type="number"
                step="0.01"
                className="input input-sm"
                placeholder="Preis (optional)"
                value={currentData.price ?? entity.price ?? ''}
                onChange={(e) => handleFieldChange('price', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={'rounded-lg border border-base-300'}>
      <div className={'flex cursor-pointer items-center justify-between bg-base-200 p-3'} onClick={() => setCollapsed(!collapsed)}>
        <div className={'flex items-center gap-2'}>
          <span className={'font-semibold'}>{title}</span>
          <span className={'badge badge-sm'}>{entities.length}</span>
          {autoMatchedCount > 0 && (
            <span className={'badge badge-success badge-sm gap-1'}>
              <FaCheckCircle className={'text-xs'} />
              {autoMatchedCount} auto-matched
            </span>
          )}
        </div>
        <div>{collapsed ? <FaChevronDown /> : <FaChevronUp />}</div>
      </div>

      {!collapsed && (
        <div className={'p-3'}>
          <div className={'flex flex-col gap-3'}>
            {entities.map((entity) => {
              const mapping = getMapping(entity.id);
              const matches = getMatches(entity.id);
              const isAutoMatched = mapping?.decision === 'use-existing' && mapping.existingId;
              const selectedMatch = matches.find((m) => m.id === mapping?.existingId);

              return (
                <div key={entity.id} className={'rounded-lg border border-base-300 p-3'}>
                  <div className={'flex items-center justify-between'}>
                    <div className={'font-semibold'}>{getEntityDisplayName(entity)}</div>
                    {isAutoMatched && <span className={'badge badge-success badge-sm'}>Auto-matched</span>}
                  </div>

                  <div className={'mt-2 flex flex-col gap-2'}>
                    <label className={'flex cursor-pointer items-center gap-2'}>
                      <input
                        type={'radio'}
                        className={'radio radio-sm'}
                        checked={mapping?.decision === 'create-new'}
                        onChange={() => {
                          const initialData: any = { name: entity.name };
                          if (entityType === 'stepActions') {
                            initialData.actionGroup = entity.actionGroup;
                          }
                          handleDecisionChange(entity.id, 'create-new', undefined, initialData);
                        }}
                      />
                      <span className={'text-sm'}>Neu erstellen</span>
                    </label>

                    {mapping?.decision === 'create-new' && renderNewEntityForm(entity.id, entity, mapping)}

                    <label className={'flex cursor-pointer items-center gap-2'}>
                      <input
                        type={'radio'}
                        className={'radio radio-sm'}
                        checked={mapping?.decision === 'use-existing'}
                        onChange={() => {
                          if (matches.length > 0) {
                            handleDecisionChange(entity.id, 'use-existing', matches[0].id);
                          } else {
                            handleDecisionChange(entity.id, 'use-existing');
                          }
                        }}
                      />
                      <span className={'text-sm'}>Bestehende verwenden</span>
                    </label>

                    {mapping?.decision === 'use-existing' && (
                      <div className={'ml-6'}>
                        <EntityCombobox
                          value={mapping.existingId || null}
                          onChange={(value) => handleDecisionChange(entity.id, 'use-existing', value || undefined)}
                          fetchOptions={fetchOptions}
                          getOptionLabel={getOptionLabel}
                          getOptionValue={getOptionValue}
                          placeholder={`${title.slice(0, -1)} auswählen`}
                        />
                      </div>
                    )}

                    {matches.length === 0 && mapping?.decision === 'use-existing' && !mapping.existingId && (
                      <div className={'ml-6 text-xs text-base-content/50'}>Keine bestehenden Übereinstimmungen gefunden</div>
                    )}
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
