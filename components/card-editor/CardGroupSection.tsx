import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { FieldArray, FormikErrors } from 'formik';
import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import CocktailRecipeCardItem from '@components/cocktails/CocktailRecipeCardItem';
import { SearchModal } from '@components/modals/SearchModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup, Card, CardBody, Collapse, CollapseContent, CollapseTitle, Input, InputAddon } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import { CardGroupItem } from './CardGroupItem';
import { DragHandle } from './CardEditorToolbar';
import { CardEditorGroup, CardEditorViewMode } from './types';
import { groupDragId, itemDragId } from './useCardEditorDnD';

interface CocktailCardGroupError {
  name?: string;
  groupPrice?: string;
}

interface CardGroupSectionProps {
  group: CardEditorGroup;
  groupIndex: number;
  viewMode: CardEditorViewMode;
  columns?: number;
  stackHeader?: boolean;
  cocktails: CocktailSummaryDto[];
  loadingCocktails: boolean;
  isArchived?: boolean;
  errors?: FormikErrors<CocktailCardGroupError>;
  touched?: { name?: boolean; groupPrice?: boolean };
  values: { groups: CardEditorGroup[] };
  onFieldChange: React.ChangeEventHandler<HTMLInputElement>;
  onFieldBlur: React.FocusEventHandler<HTMLInputElement>;
  onRemoveGroup: () => void;
  onReorderItems: (items: CardEditorGroup['items']) => void;
  openModal: (modal: React.ReactNode) => void;
}

export function CardGroupSection({
  group,
  groupIndex,
  viewMode,
  columns = 1,
  stackHeader = false,
  cocktails,
  loadingCocktails,
  isArchived = false,
  errors,
  touched,
  values,
  onFieldChange,
  onFieldBlur,
  onRemoveGroup,
  onReorderItems,
  openModal,
}: CardGroupSectionProps) {
  const { t } = useTranslation(['manage', 'common', 'entity']);
  const [collapsed, setCollapsed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupDragId(groupIndex),
    disabled: isArchived,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const sortedItems = [...group.items].sort((a, b) => a.itemNumber - b.itemNumber);
  const itemIds = sortedItems.map((_, itemIndex) => itemDragId(groupIndex, itemIndex));

  const dragHandle = !isArchived ? (
    <div className="shrink-0">
      <DragHandle attributes={attributes} listeners={listeners} />
    </div>
  ) : null;

  const nameError = errors?.name && touched?.name ? errors.name : undefined;
  const priceError = errors?.groupPrice && touched?.groupPrice ? errors.groupPrice : undefined;

  const nameField = (
    <FormField label={t('group')} htmlFor={`group-${groupIndex}-name`} required error={nameError} className={stackHeader ? undefined : 'sm:flex-2'}>
      <Input
        id={`group-${groupIndex}-name`}
        autoComplete="off"
        disabled={isArchived}
        error={!!nameError}
        name={`groups.${groupIndex}.name`}
        onChange={onFieldChange}
        onBlur={onFieldBlur}
        value={values.groups[groupIndex].name}
      />
    </FormField>
  );

  const priceField = (
    <FormField label={t('groupPrice')} htmlFor={`group-${groupIndex}-price`} error={priceError} className={stackHeader ? undefined : 'sm:flex-1'}>
      <ButtonGroup className="w-full">
        <Input
          id={`group-${groupIndex}-price`}
          type="number"
          inputMode="decimal"
          disabled={isArchived}
          min={0}
          step={0.01}
          joinItem
          error={!!priceError}
          name={`groups.${groupIndex}.groupPrice`}
          onChange={onFieldChange}
          onBlur={onFieldBlur}
          value={values.groups[groupIndex].groupPrice ?? ''}
        />
        <InputAddon>€</InputAddon>
      </ButtonGroup>
    </FormField>
  );

  // Reordering happens via the drag handle (touch, mouse, keyboard) – no extra up/down buttons.
  const actionButtons = !isArchived ? (
    <Button
      type="button"
      variant="ghost"
      shape="square"
      className="shrink-0 text-error hover:bg-error/10"
      aria-label={`${t('common:remove')}: ${group.name || t('group')}`}
      title={t('common:remove')}
      onClick={onRemoveGroup}
    >
      <FaTrashAlt aria-hidden />
    </Button>
  ) : null;

  const renderPreview = () => (
    <Collapse open={!collapsed} arrow className="rounded-xl">
      <CollapseTitle className="text-center text-2xl font-bold" onClick={() => setCollapsed(!collapsed)}>
        {group.name || t('group')}
        {group.groupPrice != undefined ? ` - ${t('common:customPriceLabel', { price: group.groupPrice })}` : ''}
      </CollapseTitle>
      <CollapseContent>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {sortedItems.length === 0 ? (
            <div className="col-span-full text-center text-base-content/70">{t('noCocktailsInGroup')}</div>
          ) : (
            sortedItems.map((item, itemIndex) => {
              const cocktail = cocktails.find((entry) => entry.id === item.cocktailId);
              if (!cocktail) {
                return (
                  <Card key={`preview-item-${itemIndex}`} variant="elevated">
                    <CardBody>{loadingCocktails ? t('common:loadingShort') : t('common:unknown')}</CardBody>
                  </Card>
                );
              }
              return (
                <CocktailRecipeCardItem
                  key={`preview-item-${item.cocktailId}-${itemIndex}`}
                  cocktailRecipe={cocktail.id}
                  showImage={false}
                  showTags={true}
                  showDetailsOnClick={true}
                  showPrice={group.groupPrice == undefined && item.specialPrice == undefined}
                  specialPrice={item.specialPrice ?? group.groupPrice ?? undefined}
                  showDescription={false}
                  showNotes={false}
                  showHistory={false}
                  showRating={false}
                  showStatisticActions={false}
                />
              );
            })
          )}
        </div>
      </CollapseContent>
    </Collapse>
  );

  if (viewMode === 'preview') {
    return (
      <div ref={setNodeRef} style={style} className="shrink-0">
        {renderPreview()}
      </div>
    );
  }

  return (
    <Card ref={setNodeRef} style={style} variant="surface" className="shrink-0 rounded-2xl">
      <CardBody className="gap-3">
        {stackHeader ? (
          <div className="flex flex-col gap-2">
            {!isArchived ? (
              <div className="flex items-center justify-between gap-2">
                {dragHandle}
                {actionButtons}
              </div>
            ) : null}
            {nameField}
            {priceField}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {dragHandle}
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              {nameField}
              {priceField}
            </div>
            {actionButtons}
          </div>
        )}

        <FieldArray name={`groups.${groupIndex}.items`}>
          {({ push: pushItem, remove: removeItem }) => (
            <>
              <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                  {sortedItems.map((item, itemIndex) => {
                    const cocktail = cocktails.find((entry) => entry.id === item.cocktailId);
                    return (
                      <CardGroupItem
                        key={`group-${groupIndex}-item-${item.cocktailId}-${itemIndex}`}
                        groupIndex={groupIndex}
                        itemIndex={itemIndex}
                        cocktail={cocktail}
                        loadingCocktails={loadingCocktails}
                        viewMode={viewMode}
                        isArchived={isArchived}
                        singleColumn={columns === 1}
                        canMoveLeft={itemIndex > 0}
                        canMoveRight={itemIndex < sortedItems.length - 1}
                        specialPrice={item.specialPrice}
                        onSpecialPriceChange={(price) =>
                          onReorderItems(sortedItems.map((entry, index) => (index === itemIndex ? { ...entry, specialPrice: price } : entry)))
                        }
                        onMoveLeft={() => {
                          const reordered = [...sortedItems];
                          const value = reordered[itemIndex];
                          reordered.splice(itemIndex, 1);
                          reordered.splice(itemIndex - 1, 0, value);
                          onReorderItems(reordered.map((entry, index) => ({ ...entry, itemNumber: index })));
                        }}
                        onMoveRight={() => {
                          const reordered = [...sortedItems];
                          const value = reordered[itemIndex];
                          reordered.splice(itemIndex, 1);
                          reordered.splice(itemIndex + 1, 0, value);
                          onReorderItems(reordered.map((entry, index) => ({ ...entry, itemNumber: index })));
                        }}
                        onRemove={() =>
                          openModal(
                            <DeleteConfirmationModal
                              spelling={'REMOVE'}
                              entityName={
                                group.name
                                  ? t('entity:theCocktailFromGroupNamed', { cocktail: cocktail?.name ?? '-', group: group.name })
                                  : t('entity:theCocktailFromGroup', { cocktail: cocktail?.name ?? '-' })
                              }
                              onApprove={async () => removeItem(itemIndex)}
                            />,
                          )
                        }
                      />
                    );
                  })}
                </div>
              </SortableContext>
              {!isArchived ? (
                <Button
                  type="button"
                  variant="outline"
                  block
                  className="border-dashed"
                  onClick={() =>
                    openModal(
                      <SearchModal
                        selectedCocktails={sortedItems.map((entry) => entry.cocktailId)}
                        onCocktailSelectedObject={(cocktail) => {
                          pushItem({ cocktailId: cocktail.id, itemNumber: sortedItems.length });
                        }}
                        selectionLabel={t('common:add')}
                      />,
                    )
                  }
                >
                  <FaPlus aria-hidden />
                  {t('addCocktail')}
                </Button>
              ) : null}
            </>
          )}
        </FieldArray>
      </CardBody>
    </Card>
  );
}
