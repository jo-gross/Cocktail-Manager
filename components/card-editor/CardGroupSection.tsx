import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { FieldArray, FormikErrors } from 'formik';
import { FaAngleDown, FaAngleUp, FaEuroSign, FaTrashAlt } from 'react-icons/fa';
import CocktailRecipeCardItem from '@components/cocktails/CocktailRecipeCardItem';
import { SearchModal } from '@components/modals/SearchModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import {
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Collapse,
  CollapseContent,
  CollapseTitle,
  FormControl,
  Input,
  Label,
  LabelText,
  LabelTextAlt,
} from '@components/ui';
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
  cocktails: CocktailRecipeFull[];
  loadingCocktails: boolean;
  isArchived?: boolean;
  errors?: FormikErrors<CocktailCardGroupError>;
  touched?: { name?: boolean; groupPrice?: boolean };
  values: { groups: CardEditorGroup[] };
  onFieldChange: React.ChangeEventHandler<HTMLInputElement>;
  onFieldBlur: React.FocusEventHandler<HTMLInputElement>;
  onMoveGroupUp: () => void;
  onMoveGroupDown: () => void;
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
  onMoveGroupUp,
  onMoveGroupDown,
  onRemoveGroup,
  onReorderItems,
  openModal,
}: CardGroupSectionProps) {
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

  const nameField = (
    <FormControl className={stackHeader ? undefined : 'sm:flex-2'}>
      <Label className="flex-row items-center justify-between">
        <LabelText>Gruppe</LabelText>
        <LabelTextAlt className="text-error">
          <span>{errors?.name && touched?.name ? errors.name : ''}</span>
          <span>*</span>
        </LabelTextAlt>
      </Label>
      <Input
        type="text"
        disabled={isArchived}
        className={`w-full ${errors?.name && touched?.name ? 'border-error' : ''}`}
        name={`groups.${groupIndex}.name`}
        onChange={onFieldChange}
        onBlur={onFieldBlur}
        value={values.groups[groupIndex].name}
      />
    </FormControl>
  );

  const priceField = (
    <FormControl className={stackHeader ? undefined : 'sm:flex-1'}>
      <Label className="flex-row items-center justify-between">
        <LabelText>Gruppen Preis</LabelText>
        <LabelTextAlt className="text-error">
          <span>{errors?.groupPrice && touched?.groupPrice ? errors.groupPrice : ''}</span>
        </LabelTextAlt>
      </Label>
      <ButtonGroup className="w-full">
        <Input
          type="number"
          disabled={isArchived}
          min={0}
          step={0.01}
          joinItem
          className={`w-full ${errors?.groupPrice && touched?.groupPrice ? 'border-error' : ''}`}
          name={`groups.${groupIndex}.groupPrice`}
          onChange={onFieldChange}
          onBlur={onFieldBlur}
          value={values.groups[groupIndex].groupPrice ?? ''}
        />
        <Button type="button" variant="primary" joinItem tabIndex={-1}>
          <FaEuroSign />
        </Button>
      </ButtonGroup>
    </FormControl>
  );

  const actionButtons = !isArchived ? (
    <div className="flex shrink-0 space-x-2">
      <Button type="button" variant="outline" shape="square" size="sm" disabled={groupIndex === 0} onClick={onMoveGroupUp}>
        <FaAngleUp />
      </Button>
      <Button type="button" variant="outline" shape="square" size="sm" disabled={groupIndex === values.groups.length - 1} onClick={onMoveGroupDown}>
        <FaAngleDown />
      </Button>
      <Button type="button" variant="outline-error" shape="square" size="sm" onClick={onRemoveGroup}>
        <FaTrashAlt />
      </Button>
    </div>
  ) : null;

  const renderPreview = () => (
    <Collapse open={!collapsed} arrow className="rounded-xl">
      <CollapseTitle className="text-center text-2xl font-bold" onClick={() => setCollapsed(!collapsed)}>
        {group.name || 'Gruppe'}
        {group.groupPrice != undefined ? ` - Special Preis: ${group.groupPrice}€` : ''}
      </CollapseTitle>
      <CollapseContent>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {sortedItems.length === 0 ? (
            <div className="col-span-full text-center text-base-content/70">Keine Cocktails in dieser Gruppe</div>
          ) : (
            sortedItems.map((item, itemIndex) => {
              const cocktail = cocktails.find((entry) => entry.id === item.cocktailId);
              if (!cocktail) {
                return (
                  <Card key={`preview-item-${itemIndex}`} variant="elevated">
                    <CardBody>{loadingCocktails ? 'Lade…' : 'Unbekannt'}</CardBody>
                  </Card>
                );
              }
              return (
                <CocktailRecipeCardItem
                  key={`preview-item-${item.cocktailId}-${itemIndex}`}
                  cocktailRecipe={cocktail}
                  showImage={false}
                  showTags={true}
                  showDetailsOnClick={true}
                  showPrice={group.groupPrice == undefined}
                  specialPrice={group.groupPrice ?? undefined}
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
          <div className="flex items-center gap-2">
            {dragHandle}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
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
                              entityName={`den Cocktail '${cocktail?.name ?? '-'}' von der Gruppe${group.name ? ` '${group.name}'` : ''}`}
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
                <div className="flex flex-row justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-secondary text-secondary hover:bg-secondary/10"
                    onClick={() =>
                      openModal(
                        <SearchModal
                          selectedCocktails={sortedItems.map((entry) => entry.cocktailId)}
                          onCocktailSelectedObject={(cocktail) => {
                            pushItem({ cocktailId: cocktail.id, itemNumber: sortedItems.length });
                          }}
                          selectionLabel={'Hinzufügen'}
                        />,
                      )
                    }
                  >
                    Cocktail hinzufügen
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </FieldArray>
      </CardBody>
    </Card>
  );
}
