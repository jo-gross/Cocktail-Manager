import React, { useContext, useEffect, useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { Button, Card, CardBody, CardTitle, Loading } from '@components/ui';
import { alertApiV1Error, apiV1FetchSafe, apiV1Mutate } from '@lib/network/apiV1';
import type { DeletionResult } from '@lib/schemas/common';

type SavedSetType = 'TAG_SET' | 'INGREDIENT_SET' | 'COCKTAIL_SET';

interface SavedSet {
  id: string;
  name: string;
  type: SavedSetType;
  logic: 'AND' | 'OR' | null;
  items: string[];
}

interface SavedSetSelectorProps {
  workspaceId: string;
  type?: SavedSetType;
  selectedSetId?: string;
  onSelect: (setId: string | undefined, setType?: SavedSetType) => void;
  onDelete?: (setId: string) => void;
  onEdit?: (set: SavedSet) => void;
  refreshKey?: number;
  showAllTypes?: boolean;
  excludeTypes?: SavedSetType[];
}

export function SavedSetSelector({
  workspaceId,
  type,
  selectedSetId,
  onSelect,
  onDelete,
  onEdit,
  refreshKey,
  showAllTypes = false,
  excludeTypes = [],
}: SavedSetSelectorProps) {
  const modalContext = useContext(ModalContext);
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSets = async () => {
    if (!workspaceId) return;

    try {
      setLoading(true);
      let path: string;
      if (showAllTypes) {
        path = `/api/v1/workspaces/${workspaceId}/statistics/advanced/sets?types=TAG_SET,INGREDIENT_SET`;
      } else if (type) {
        path = `/api/v1/workspaces/${workspaceId}/statistics/advanced/sets?type=${type}`;
      } else {
        path = `/api/v1/workspaces/${workspaceId}/statistics/advanced/sets`;
      }
      const data = await apiV1FetchSafe<SavedSet[]>(path);
      if (data) {
        let filteredSets = data;
        if (excludeTypes.length > 0) {
          filteredSets = filteredSets.filter((set) => !excludeTypes.includes(set.type));
        }
        setSets(filteredSets);
      }
    } catch (error) {
      console.error('SavedSetSelector -> loadSets', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSets();
  }, [workspaceId, type, refreshKey, showAllTypes]);

  const handleDelete = (set: SavedSet) => {
    modalContext.openModal(
      <DeleteConfirmationModal
        spelling="DELETE"
        entityName={set.name}
        onApprove={async () => {
          try {
            await apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/statistics/advanced/sets?id=${set.id}`, 'DELETE');
            await loadSets();
            if (selectedSetId === set.id) {
              onSelect(undefined);
            }
            onDelete?.(set.id);
          } catch (error) {
            alertApiV1Error(error, 'Fehler beim Löschen des Sets');
          }
        }}
      />,
    );
  };

  const getTypeLabel = (setType: SavedSetType) => {
    switch (setType) {
      case 'TAG_SET':
        return 'Tags';
      case 'INGREDIENT_SET':
        return 'Zutaten';
      case 'COCKTAIL_SET':
        return 'Cocktails';
      default:
        return setType;
    }
  };

  return (
    <Card>
      <CardBody>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
            Gespeicherte Sets
            {loading && <Loading size="xs" />}
          </span>
        </CardTitle>
        <div className="space-y-2">
          {sets.length === 0 ? (
            <div className="text-sm text-base-content/70">Keine Sets gespeichert</div>
          ) : (
            sets.map((set) => (
              <div
                key={set.id}
                className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                  selectedSetId === set.id ? 'border-primary bg-primary/10' : 'border-base-300'
                }`}
                onClick={() => onSelect(selectedSetId === set.id ? undefined : set.id, set.type)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-semibold">{set.name}</div>
                      <div className="text-xs text-base-content/70">
                        {set.items.length} {getTypeLabel(set.type)}
                        {set.logic && ` · ${set.logic}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(set);
                        }}
                      >
                        <FaEdit />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(set);
                      }}
                    >
                      <FaTrash />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}
