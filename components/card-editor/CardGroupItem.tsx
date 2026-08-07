import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaAngleDown, FaAngleLeft, FaAngleRight, FaAngleUp, FaTrashAlt } from 'react-icons/fa';
import { CompactCocktailRecipeInstruction } from '@components/cocktails/CompactCocktailRecipeInstruction';
import type { CocktailDto, CocktailSummaryDto } from '@lib/schemas/cocktails';
import { fetchCocktail } from '@lib/network/cocktails';
import { Button, Card, CardBody, Skeleton } from '@components/ui';
import '../../lib/NumberUtils';
import { DragHandle } from './CardEditorToolbar';
import { ItemActionMenu } from './ItemActionMenu';
import { CardEditorViewMode } from './types';
import { itemDragId } from './useCardEditorDnD';

interface CardGroupItemProps {
  groupIndex: number;
  itemIndex: number;
  cocktail?: CocktailSummaryDto;
  loadingCocktails: boolean;
  viewMode: CardEditorViewMode;
  isArchived?: boolean;
  singleColumn?: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
}

export function CardGroupItem({
  groupIndex,
  itemIndex,
  cocktail,
  loadingCocktails,
  viewMode,
  isArchived = false,
  singleColumn = false,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: CardGroupItemProps) {
  const { t } = useTranslation('common');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemDragId(groupIndex, itemIndex),
    disabled: isArchived,
  });

  // Detail preview lazy-loads the full CocktailDto by id; the list only needs summaries.
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string;
  const [loadedCocktail, setLoadedCocktail] = useState<CocktailDto | undefined>(undefined);
  const [cocktailLoading, setCocktailLoading] = useState(false);
  const cocktailId = cocktail?.id;
  useEffect(() => {
    if (viewMode === 'names' || !cocktailId) return;
    fetchCocktail(workspaceId, cocktailId, setLoadedCocktail, setCocktailLoading);
  }, [workspaceId, cocktailId, viewMode]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const MoveBackIcon = singleColumn ? FaAngleUp : FaAngleLeft;
  const MoveForwardIcon = singleColumn ? FaAngleDown : FaAngleRight;
  const moveBackLabel = singleColumn ? t('moveUp') : t('moveLeft');
  const moveForwardLabel = singleColumn ? t('moveDown') : t('moveRight');

  if (viewMode === 'names') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="col-span-1 flex min-h-12 shrink-0 items-center gap-2 self-start rounded-lg border border-base-300/60 bg-base-100 px-3 py-2"
      >
        {!isArchived ? <DragHandle attributes={attributes} listeners={listeners} /> : null}
        <div className="min-w-0 flex-1 truncate font-medium">{cocktail?.name ?? (loadingCocktails ? '…' : t('unknown'))}</div>
        {!isArchived ? (
          <ItemActionMenu
            actions={[
              { label: moveBackLabel, icon: <MoveBackIcon />, onClick: onMoveLeft, disabled: !canMoveLeft },
              { label: moveForwardLabel, icon: <MoveForwardIcon />, onClick: onMoveRight, disabled: !canMoveRight },
              { label: t('delete'), icon: <FaTrashAlt />, onClick: onRemove, isDanger: true },
            ]}
          />
        ) : null}
      </div>
    );
  }

  return (
    <Card ref={setNodeRef} style={style} variant="elevated" className="col-span-1 shrink-0 self-start">
      <CardBody className="gap-2">
        {!isArchived ? (
          <div className="flex items-center justify-between gap-2">
            <DragHandle attributes={attributes} listeners={listeners} />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                shape="square"
                size="sm"
                disabled={!canMoveLeft}
                onClick={onMoveLeft}
                aria-label={moveBackLabel}
                title={moveBackLabel}
              >
                <MoveBackIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                shape="square"
                size="sm"
                disabled={!canMoveRight}
                onClick={onMoveRight}
                aria-label={moveForwardLabel}
                title={moveForwardLabel}
              >
                <MoveForwardIcon />
              </Button>
              <Button type="button" variant="outline-error" shape="square" size="sm" onClick={onRemove} aria-label={t('delete')} title={t('delete')}>
                <FaTrashAlt />
              </Button>
            </div>
          </div>
        ) : null}

        {loadedCocktail != undefined ? (
          <CompactCocktailRecipeInstruction showPrice={true} showImage={false} cocktailRecipe={loadedCocktail} />
        ) : cocktailLoading || loadingCocktails || cocktail != undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div>{t('unknown')}</div>
        )}
      </CardBody>
    </Card>
  );
}
