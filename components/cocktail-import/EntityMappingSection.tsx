import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaCheckCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { EntityCombobox } from './EntityCombobox';
import { useRouter } from 'next/router';
import { UnitForm, IceForm, StepActionForm } from './EntityForms';
import { Badge, Card, CardBody, FormControl, Input, Label, LabelText, Radio } from '@components/ui';

interface EntityMapping {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
  newEntityData?: Record<string, unknown>;
}

interface EntityMatch {
  exportId: string;
  exportName: string;
  matches: Array<{ id: string; name: string; actionGroup?: string }>;
}

interface EntityMappingSectionProps {
  title: string;
  entityType: 'units' | 'ice' | 'stepActions' | 'glasses' | 'garnishes' | 'ingredients';
  entities: Array<{ id: string; name: string; actionGroup?: string; [key: string]: unknown }>;
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
          const groups = Array.from(new Set(data.data.map((action: { actionGroup?: string }) => action.actionGroup).filter(Boolean))) as string[];
          setActionGroups(groups);
        })
        .catch((err) => console.error('Error loading action groups:', err));
    }
  }, [entityType, workspaceId]);

  const handleDecisionChange = (exportId: string, decision: 'use-existing' | 'create-new', existingId?: string, newEntityData?: Record<string, unknown>) => {
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
    (option: { id: string; name: string; actionGroup?: string }) => {
      if (entityType === 'stepActions' && option.actionGroup) {
        return `${option.name} (${option.actionGroup})`;
      }
      return option.name;
    },
    [entityType],
  );

  const getOptionValue = useCallback((option: { id: string; name: string }) => option.id, []);

  const getEntityDisplayName = (entity: { id: string; name: string; actionGroup?: string }) => {
    if (entityType === 'stepActions' && entity.actionGroup) {
      return `${entity.name} (${entity.actionGroup})`;
    }
    return entity.name;
  };

  const renderNewEntityForm = (
    exportId: string,
    entity: { id: string; name: string; actionGroup?: string; [key: string]: unknown },
    mapping: EntityMapping,
  ) => {
    const currentData = mapping.newEntityData || {};

    const handleDataChange = (newData: Record<string, unknown>) => {
      handleDecisionChange(exportId, 'create-new', undefined, newData);
    };

    const handleFieldChange = (field: string, value: unknown) => {
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
          <Card variant="elevated" className="ml-6 rounded-lg">
            <CardBody compact>
              <div className="mb-2 text-sm font-semibold">Neues Glas erstellen</div>
              <FormControl>
                <Label className="flex-row">
                  <LabelText className="text-xs">Name</LabelText>
                </Label>
                <Input
                  type="text"
                  inputSize="sm"
                  placeholder="Name"
                  value={String(currentData.name ?? entity.name ?? '')}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                />
              </FormControl>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <FormControl>
                  <Label className="flex-row">
                    <LabelText className="text-xs">Volumen (ml)</LabelText>
                  </Label>
                  <Input
                    type="number"
                    inputSize="sm"
                    placeholder="Volumen"
                    value={String(currentData.volume ?? entity.volume ?? '')}
                    onChange={(e) => handleFieldChange('volume', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormControl>
                  <Label className="flex-row">
                    <LabelText className="text-xs">Pfand (€)</LabelText>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputSize="sm"
                    placeholder="Pfand"
                    value={String(currentData.deposit ?? entity.deposit ?? '')}
                    onChange={(e) => handleFieldChange('deposit', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
              </div>
            </CardBody>
          </Card>
        );

      case 'garnishes':
        return (
          <Card variant="elevated" className="ml-6 rounded-lg">
            <CardBody compact>
              <div className="mb-2 text-sm font-semibold">Neue Garnitur erstellen</div>
              <FormControl>
                <Label className="flex-row">
                  <LabelText className="text-xs">Name</LabelText>
                </Label>
                <Input
                  type="text"
                  inputSize="sm"
                  placeholder="Name"
                  value={String(currentData.name ?? entity.name ?? '')}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                />
              </FormControl>
              <FormControl className="mt-2">
                <Label className="flex-row">
                  <LabelText className="text-xs">Beschreibung</LabelText>
                </Label>
                <Input
                  type="text"
                  inputSize="sm"
                  placeholder="Beschreibung (optional)"
                  value={String(currentData.description ?? entity.description ?? '')}
                  onChange={(e) => handleFieldChange('description', e.target.value || null)}
                />
              </FormControl>
              <FormControl className="mt-2">
                <Label className="flex-row">
                  <LabelText className="text-xs">Preis (€)</LabelText>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  inputSize="sm"
                  placeholder="Preis (optional)"
                  value={String(currentData.price ?? entity.price ?? '')}
                  onChange={(e) => handleFieldChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                />
              </FormControl>
            </CardBody>
          </Card>
        );

      case 'ingredients':
        return (
          <Card variant="elevated" className="ml-6 rounded-lg">
            <CardBody compact>
              <div className="mb-2 text-sm font-semibold">Neue Zutat erstellen</div>
              <div className="grid grid-cols-2 gap-2">
                <FormControl>
                  <Label className="flex-row">
                    <LabelText className="text-xs">Name</LabelText>
                  </Label>
                  <Input
                    type="text"
                    inputSize="sm"
                    placeholder="Name"
                    value={String(currentData.name ?? entity.name ?? '')}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <Label className="flex-row">
                    <LabelText className="text-xs">Kurzname</LabelText>
                  </Label>
                  <Input
                    type="text"
                    inputSize="sm"
                    placeholder="Kurzname (optional)"
                    value={String(currentData.shortName ?? entity.shortName ?? '')}
                    onChange={(e) => handleFieldChange('shortName', e.target.value || null)}
                  />
                </FormControl>
              </div>
              <FormControl className="mt-2">
                <Label className="flex-row">
                  <LabelText className="text-xs">Beschreibung</LabelText>
                </Label>
                <Input
                  type="text"
                  inputSize="sm"
                  placeholder="Beschreibung (optional)"
                  value={String(currentData.description ?? entity.description ?? '')}
                  onChange={(e) => handleFieldChange('description', e.target.value || null)}
                />
              </FormControl>
              <FormControl className="mt-2">
                <Label className="flex-row">
                  <LabelText className="text-xs">Preis (€)</LabelText>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  inputSize="sm"
                  placeholder="Preis (optional)"
                  value={String(currentData.price ?? entity.price ?? '')}
                  onChange={(e) => handleFieldChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                />
              </FormControl>
            </CardBody>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className={'rounded-lg border border-base-300'}>
      <div
        className={'flex cursor-pointer items-center justify-between border-b border-base-300/60 bg-base-100 px-3 py-3 md:px-4'}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={'flex items-center gap-2'}>
          <span className={'font-semibold'}>{title}</span>
          <Badge size="sm">{entities.length}</Badge>
          {autoMatchedCount > 0 && (
            <Badge variant="success" size="sm" className="gap-1">
              <FaCheckCircle className={'text-xs'} />
              {autoMatchedCount} auto-matched
            </Badge>
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
              const _selectedMatch = matches.find((m) => m.id === mapping?.existingId);

              return (
                <Card key={entity.id} variant="elevated" className="rounded-lg">
                  <CardBody compact>
                    <div className={'flex items-center justify-between'}>
                      <div className={'font-semibold'}>{getEntityDisplayName(entity)}</div>
                      {isAutoMatched && (
                        <Badge variant="success" size="sm">
                          Auto-matched
                        </Badge>
                      )}
                    </div>

                    <div className={'mt-2 flex flex-col gap-2'}>
                      <label className={'flex cursor-pointer items-center gap-2'}>
                        <Radio
                          radioSize="sm"
                          checked={mapping?.decision === 'create-new'}
                          onChange={() => {
                            const initialData: Record<string, unknown> = { name: entity.name };
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
                        <Radio
                          radioSize="sm"
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
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
